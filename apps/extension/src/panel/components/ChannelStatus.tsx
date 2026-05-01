import { Check, Copy } from 'lucide-react';
import { ReactNode, useState } from 'react';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '../ui/input-group';

import type { ChannelStatusType } from '../hooks/useClaudeChannel';

interface Props {
  status: ChannelStatusType;
  lastError?: string;
  /** When true, renders without outer padding (for use inside overlays) */
  inline?: boolean;
}

const INSTALL_COMMAND = '/plugin install claude-code-inspect@claude-plugins-official';

const CONNECT_COMMAND = 'claude --channels plugin:claude-code-inspect@claude-plugins-official';

const CopyBlock = ({ label, value }: { label: ReactNode; value: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <InputGroup className="backdrop-blur-xs">
        <InputGroupTextarea
          readOnly
          value={value}
          rows={2}
          className="font-mono text-[10px] cursor-text select-all resize-none"
        />
        <InputGroupAddon align="block-end" className="justify-end pt-0">
          <InputGroupButton
            onClick={copy}
            title="Copy command"
            size="sm"
            className="text-xs font-medium active:translate-y-0!"
          >
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied!' : 'Copy'}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
};

export const ChannelStatus = ({ status, lastError, inline = false }: Props) => {
  const wrapper = (children: ReactNode) =>
    inline ? <div className="w-full">{children}</div> : <div className="px-2 pb-1">{children}</div>;

  if (status === 'error') {
    return wrapper(
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-[11px]">
        <span className="size-1.5 rounded-full bg-red-500" />
        <span className="text-red-600 dark:text-red-400 truncate">
          {lastError ? lastError.slice(0, 60) : 'Send failed'}
        </span>
      </div>,
    );
  }

  if (status === 'disconnected' || status === 'checking') {
    return wrapper(
      <div className="flex w-full flex-col gap-3">
        <span className="text-muted-foreground font-medium">
          Connect Claude Code to this extension:
        </span>
        <CopyBlock
          label={
            <>
              <span className="font-semibold text-foreground">Step 1 (one-time only)</span> - Run
              inside Claude Code
            </>
          }
          value={INSTALL_COMMAND}
        />
        <CopyBlock
          label={
            <>
              <span className="font-semibold text-foreground">Step 2</span> - Start Claude Code with
              the extension connected
            </>
          }
          value={CONNECT_COMMAND}
        />
      </div>,
    );
  }

  return null;
};
