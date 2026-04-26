import type { Message } from '../hooks/useClaudeChannel';

import { cn } from '@/panel/lib/utils';

interface Props {
  message: Message;
}

export const MessageBubble = ({ message }: Props) => {
  return (
    <div
      className={cn(
        'text-sm text-foreground whitespace-pre-wrap max-w-[85%] rounded-lg px-3 py-2 bg-muted/80 self-start',
        { 'bg-primary/80 self-end': message.role === 'user' },
      )}
    >
      {message.role === 'waiting' ? (
        <>
          <span className="typing-dot">·</span>
          <span className="typing-dot">·</span>
          <span className="typing-dot">·</span>
        </>
      ) : (
        message.text
      )}
    </div>
  );
};
