import axios from 'axios';
import { useState, useEffect, useRef } from 'react';
import browser from 'webextension-polyfill';

import type { InspectedElement } from '@/types/inspection';

const BRIDGE_URL = 'http://127.0.0.1:9999';
const POLL_INTERVAL = 5000;

export type ChannelStatusType = 'checking' | 'connected' | 'disconnected' | 'sending' | 'error';

export interface Message {
  id: string;
  text: string;
  ts: number;
  role: 'user' | 'claude' | 'waiting';
}

const WAITING_ID = '__waiting__';

type MessagesByTab = Record<number, Message[]>;

const STORAGE_KEY_MESSAGES = (tabId: number) => `cci-messages-${tabId}`;

const loadMessages = (tabId: number): Message[] => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY_MESSAGES(tabId)) ?? '[]') as Message[];
  } catch {
    return [];
  }
};

const saveMessages = (tabId: number, messages: Message[]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY_MESSAGES(tabId), JSON.stringify(messages));
  } catch {
    // sessionStorage quota — ignore
  }
};

const clearMessages = (tabId: number) => {
  sessionStorage.removeItem(STORAGE_KEY_MESSAGES(tabId));
};

interface UseClaudeChannelResult {
  status: ChannelStatusType;
  sendMessage: (content: string, element: InspectedElement | null) => Promise<void>;
  clearConversation: () => void;
  lastError: string;
  messages: Message[];
  isWaiting: boolean;
}

export const useClaudeChannel = (tabId: number | null): UseClaudeChannelResult => {
  const [status, setStatus] = useState<ChannelStatusType>('checking');
  const [lastError, setLastError] = useState('');
  const [messagesByTab, setMessagesByTab] = useState<MessagesByTab>(() => {
    // Hydrate from sessionStorage for all tabs we know about
    const result: MessagesByTab = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith('cci-messages-')) continue;
      const id = parseInt(key.slice('cci-messages-'.length), 10);
      if (!isNaN(id)) result[id] = loadMessages(id);
    }
    return result;
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const checkHealth = async () => {
    try {
      await axios.get(`${BRIDGE_URL}/health`, { timeout: 2000 });
      setStatus((prev) => (prev === 'sending' || prev === 'error' ? prev : 'connected'));
    } catch {
      setStatus((prev) => (prev === 'sending' || prev === 'error' ? prev : 'disconnected'));
    }
  };

  useEffect(() => {
    void checkHealth();
    intervalRef.current = setInterval(() => void checkHealth(), POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // SSE message stream
  useEffect(() => {
    let destroyed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (destroyed) return;
      const es = new EventSource(`${BRIDGE_URL}/reply`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as { text: string };
          const message: Message = {
            id: crypto.randomUUID(),
            text: data.text,
            ts: Date.now(),
            role: 'claude',
          };
          setMessagesByTab((prev) => {
            const tid = tabId ?? -1;
            const existing = (prev[tid] ?? []).filter((m) => m.id !== WAITING_ID);
            const updated = [...existing, message];
            saveMessages(tid, updated);
            return { ...prev, [tid]: updated };
          });
        } catch {
          // ignore malformed events
        }
      };

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!destroyed) retryTimer = setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      destroyed = true;
      if (retryTimer) clearTimeout(retryTimer);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [tabId]);

  // Clean up sessionStorage when a tab is closed
  useEffect(() => {
    const onTabRemoved = (removedTabId: number) => {
      clearMessages(removedTabId);
      setMessagesByTab((prev) => {
        const next = { ...prev };
        delete next[removedTabId];
        return next;
      });
    };
    browser.tabs.onRemoved.addListener(onTabRemoved);
    return () => browser.tabs.onRemoved.removeListener(onTabRemoved);
  }, []);

  const sendMessage = async (content: string, element: InspectedElement | null) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      text: content,
      ts: Date.now(),
      role: 'user',
    };
    const waitingMsg: Message = { id: WAITING_ID, text: '', ts: Date.now(), role: 'waiting' };
    const tid = tabId ?? -1;
    setMessagesByTab((prev) => {
      const existing = (prev[tid] ?? []).filter((m) => m.id !== WAITING_ID);
      const updated = [...existing, userMsg, waitingMsg];
      saveMessages(tid, updated);
      return { ...prev, [tid]: updated };
    });

    setStatus('sending');
    try {
      const sourceFile = element?.reactPath.find((p) => p.fileName);
      await axios.post(`${BRIDGE_URL}/message`, {
        content,
        context: element
          ? {
              url: element.url,
              htmlPath: element.htmlPath,
              reactComponent: element.reactComponent?.name ?? null,
              srcFile: sourceFile?.fileName ?? null,
              srcLine: sourceFile?.lineNumber ?? null,
              screenshot: element?.screenshot,
            }
          : undefined,
      });
      setStatus('connected');
      setLastError('');
    } catch (e) {
      setStatus('error');
      setMessagesByTab((prev) => {
        const tid = tabId ?? -1;
        const updated = (prev[tid] ?? []).filter((m) => m.id !== WAITING_ID);
        saveMessages(tid, updated);
        return { ...prev, [tid]: updated };
      });
      if (axios.isAxiosError(e)) {
        const data = e.response?.data as { error?: string } | undefined;
        setLastError(data?.error ?? e.message);
      } else {
        setLastError(e instanceof Error ? e.message : 'Failed to send');
      }
    }
  };

  const clearConversation = () => {
    const tid = tabId ?? -1;
    clearMessages(tid);
    setMessagesByTab((prev) => ({ ...prev, [tid]: [] }));
  };

  const messages = tabId != null ? (messagesByTab[tabId] ?? []) : [];
  const isWaiting = messages.some((m) => m.role === 'waiting');

  return { status, sendMessage, clearConversation, lastError, messages, isWaiting };
};
