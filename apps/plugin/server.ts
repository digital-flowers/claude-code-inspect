#!/usr/bin/env node
/**
 * Claude Code Inspect — MCP bridge plugin.
 *
 * Listens on localhost:9999 for POST /message requests from the browser
 * extension and forwards them into the Claude Code session as channel
 * notifications.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v3';

const PORT = Number(process.env.BRIDGE_PORT ?? 9999);
const VERSION = '0.1.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// SSE listeners for pushing replies back to the extension
const replyListeners = new Set<(chunk: string) => void>();

const pushReply = (text: string) => {
  const chunk = `data: ${JSON.stringify({ text })}\n\n`;
  for (const emit of replyListeners) emit(chunk);
};

// Screenshot store: message_id -> base64 data (without the data URI prefix)
const screenshots = new Map<string, { data: string; mimeType: string }>();

// Parse a data URI like "data:image/png;base64,<data>" into parts.
const parseDataUri = (dataUri: string): { data: string; mimeType: string } | null => {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match || !match[1] || !match[2]) return null;
  return { mimeType: match[1], data: match[2] };
};

const mcp = new McpServer(
  { name: 'claude-code-inspect', version: VERSION },
  {
    capabilities: { tools: {}, experimental: { 'claude/channel': {} } },
    instructions:
      'Messages arrive from the Claude Code Inspect browser extension as <channel> tags. ' +
      "They include the user's question and context about the inspected page element. " +
      'When a screenshot is available, call get_screenshot to view it as an image before answering. ' +
      'Always reply using the reply tool, so the response is sent back to the extension. ' +
      'When you are about to make file edits that require user approval, first call the reply tool with a message describing what you are about to change and that you are waiting for approval (e.g. "Waiting for your approval to edit foo.ts..."). ' +
      'Once the edit is approved and applied, call the reply tool again to confirm it is done.',
  },
);

mcp.registerTool(
  'reply',
  {
    description: 'Send a reply back to the browser extension.',
    inputSchema: { text: z.string().describe('The reply text to send to the extension.') },
  },
  ({ text }) => {
    pushReply(text);
    return { content: [{ type: 'text' as const, text: 'reply sent to extension' }] };
  },
);

mcp.registerTool(
  'get_screenshot',
  {
    description:
      'Retrieve the screenshot for a message as an image. Call this when the channel message indicates a screenshot is available.',
    inputSchema: {
      message_id: z.string().describe('The message_id from the channel notification.'),
    },
  },
  ({ message_id }) => {
    const entry = screenshots.get(message_id);
    if (!entry) {
      return {
        content: [
          { type: 'text' as const, text: `No screenshot found for message_id: ${message_id}` },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: 'image' as const, data: entry.data, mimeType: entry.mimeType }],
    };
  },
);

await mcp.connect(new StdioServerTransport());

interface MessageBody {
  content: string;
  context?: {
    url?: string;
    htmlPath?: string;
    reactComponent?: string | null;
    srcFile?: string | null;
    srcLine?: number | null;
    screenshot?: string;
  };
}

const formatContent = (body: MessageBody, message_id: string): string => {
  if (!body.context) return body.content;

  const { url, htmlPath, reactComponent, srcFile, srcLine, screenshot } = body.context;
  const lines: string[] = [body.content, '', '---'];

  if (url) lines.push(`url: ${url}`);
  if (htmlPath) lines.push(`html: ${htmlPath}`);
  if (reactComponent) lines.push(`react: <${reactComponent} />`);
  if (srcFile) lines.push(`src: ${srcFile}${srcLine ? `:${srcLine}` : ''}`);
  if (screenshot)
    lines.push(`screenshot: available — call get_screenshot('${message_id}') to view it`);

  return lines.join('\n');
};

const sendJson = (res: ServerResponse, status: number, body: unknown) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
  res.end(payload);
};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  if (url.pathname === '/reply' && req.method === 'GET') {
    res.writeHead(200, {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    const emit = (chunk: string) => res.write(chunk);
    replyListeners.add(emit);
    req.on('close', () => replyListeners.delete(emit));
    return;
  }

  if (url.pathname === '/health' && req.method === 'GET') {
    sendJson(res, 200, { status: 'ok', version: VERSION });
    return;
  }

  if (url.pathname === '/message' && req.method === 'POST') {
    let body: MessageBody;
    try {
      body = JSON.parse(await readBody(req)) as MessageBody;
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' });
      return;
    }

    if (!body.content?.trim()) {
      sendJson(res, 400, { error: 'content is required' });
      return;
    }

    const message_id = crypto.randomUUID();

    // Store screenshot out-of-band so it's never inlined into the channel text.
    if (body.context?.screenshot) {
      const parsed = parseDataUri(body.context.screenshot);
      if (parsed) screenshots.set(message_id, parsed);
    }

    const content = formatContent(body, message_id);
    process.stderr.write(`claude-code-inspect: channel message:\n${content}\n---\n`);

    void mcp.server.notification({
      method: 'notifications/claude/channel',
      params: {
        content,
        meta: {
          chat_id: 'browser',
          message_id,
          user: 'browser',
          ts: new Date().toISOString(),
        },
      },
    });

    sendJson(res, 200, { ok: true, message_id });
    return;
  }

  sendJson(res, 404, { error: 'not found' });
}).listen(PORT, '127.0.0.1');

process.stderr.write(`claude-code-inspect: listening on http://localhost:${PORT}\n`);
