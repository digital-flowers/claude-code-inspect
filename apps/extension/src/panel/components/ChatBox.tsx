import { ArrowUp, Square } from 'lucide-react';
import { useState, useRef, useEffect, type KeyboardEvent } from 'react';

import { BorderGlow } from './BorderGlow';

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/panel/ui/input-group';

interface Props {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  onStop?: () => void;
}

export const ChatBox = ({ onSubmit, isLoading = false, disabled = false, onStop }: Props) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSubmit(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-border bg-background p-2">
      <BorderGlow
        borderRadius={12}
        glowRadius={28}
        colors={['#da7756', '#ffffff', '#ef4444']}
        glowColor="20 70 60"
      >
        <InputGroup className="rounded-xl border-none">
          <InputGroupTextarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            disabled={disabled}
            className="text-sm px-3 pt-2.5 pb-1"
            placeholder={
              disabled
                ? 'Connect Claude Code to send messages…'
                : 'Ask Claude Code about this element…'
            }
          />
          <InputGroupAddon align="block-end" className="justify-end px-2 pb-2">
            {isLoading ? (
              <InputGroupButton
                size="icon-xs"
                variant="default"
                onClick={onStop}
                title="Stop"
                disabled={true}
              >
                <Square className="size-3 fill-current" />
              </InputGroupButton>
            ) : (
              <InputGroupButton
                size="icon-xs"
                variant="default"
                onClick={submit}
                disabled={!value.trim() || disabled}
                title="Send (Enter)"
              >
                <ArrowUp className="size-3.5" />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </BorderGlow>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground/50">
        Shift+Enter for new line · Enter to send
      </p>
    </div>
  );
};
