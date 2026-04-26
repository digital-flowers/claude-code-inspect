import { MousePointer2 } from 'lucide-react';
import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import browser from 'webextension-polyfill';

import { ChannelStatus } from './components/ChannelStatus';
import { ChatBox } from './components/ChatBox';
import { DotGrid } from './components/DotGrid';
import { ElementTags } from './components/ElementTags';
import { MessageBubble } from './components/MessageBubble';
import { PhotoBorderGlow } from './components/PhotoBorderGlow';
import { RippleReveal } from './components/RippleReveal';
import { useClaudeChannel } from './hooks/useClaudeChannel';
import { usePort } from './hooks/usePort';
import { Button } from './ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';

import type { InspectedElement } from '@/types/inspection';
import type { BackgroundToPanelMessage, PanelToBackgroundMessage } from '@/types/messages';

const STORAGE_KEY_ELEMENT = (tabId: number) => `cci-element-${tabId}`;
const STORAGE_KEY_LAYER = (tabId: number) => `cci-layer-${tabId}`;

const loadElement = (tabId: number): InspectedElement | null => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_ELEMENT(tabId));
    return raw ? (JSON.parse(raw) as InspectedElement) : null;
  } catch {
    return null;
  }
};

const saveElement = (tabId: number, element: InspectedElement | null) => {
  try {
    if (element) sessionStorage.setItem(STORAGE_KEY_ELEMENT(tabId), JSON.stringify(element));
    else sessionStorage.removeItem(STORAGE_KEY_ELEMENT(tabId));
  } catch {
    // ignore quota errors
  }
};

const clearTabStorage = (tabId: number) => {
  sessionStorage.removeItem(STORAGE_KEY_ELEMENT(tabId));
  sessionStorage.removeItem(STORAGE_KEY_LAYER(tabId));
};

type ActiveLayer = 'element' | 'conversation';

export const App = () => {
  const [isInspecting, setIsInspecting] = useState(false);
  const [tabId, setTabId] = useState<number | null>(null);

  // Per-tab element state
  const [elementByTab, setElementByTab] = useState<Record<number, InspectedElement | null>>(() => {
    const result: Record<number, InspectedElement | null> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith('cci-element-')) continue;
      const id = parseInt(key.slice('cci-element-'.length), 10);
      if (!isNaN(id)) result[id] = loadElement(id);
    }
    return result;
  });

  // Per-tab active layer
  const [layerByTab, setLayerByTab] = useState<Record<number, ActiveLayer>>(() => {
    const result: Record<number, ActiveLayer> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith('cci-layer-')) continue;
      const id = parseInt(key.slice('cci-layer-'.length), 10);
      if (!isNaN(id)) {
        const val = sessionStorage.getItem(key);
        result[id] = (val === 'conversation' ? 'conversation' : 'element') as ActiveLayer;
      }
    }
    return result;
  });

  const currentElement = tabId != null ? (elementByTab[tabId] ?? null) : null;
  const activeLayer: ActiveLayer = layerByTab[tabId ?? -1] ?? 'element';

  const setCurrentElement = useCallback(
    (element: InspectedElement | null) => {
      if (tabId == null) return;
      setElementByTab((prev) => ({ ...prev, [tabId]: element }));
      saveElement(tabId, element);
    },
    [tabId],
  );

  const setActiveLayer = useCallback(
    (layer: ActiveLayer) => {
      const tid = tabId ?? -1;
      setLayerByTab((prev) => ({ ...prev, [tid]: layer }));
      if (tabId != null) {
        try {
          sessionStorage.setItem(STORAGE_KEY_LAYER(tabId), layer);
        } catch {
          // ignore
        }
      }
    },
    [tabId],
  );

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      setTabId(tabs[0]?.id ?? null);
    });

    const onTabActivated = (info: browser.Tabs.OnActivatedActiveInfoType) => {
      setTabId(info.tabId);
      setIsInspecting(false);
    };

    const onTabRemoved = (removedTabId: number) => {
      clearTabStorage(removedTabId);
      setElementByTab((prev) => {
        const next = { ...prev };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[removedTabId];
        return next;
      });
      setLayerByTab((prev) => {
        const next = { ...prev };
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete next[removedTabId];
        return next;
      });
    };

    browser.tabs.onActivated.addListener(onTabActivated);
    browser.tabs.onRemoved.addListener(onTabRemoved);
    return () => {
      browser.tabs.onActivated.removeListener(onTabActivated);
      browser.tabs.onRemoved.removeListener(onTabRemoved);
    };
  }, []);

  const clearConversationRef = useRef<() => void>(() => {
    /* empty */
  });

  const handleMessage = useCallback(
    (message: BackgroundToPanelMessage) => {
      switch (message.type) {
        case 'ELEMENT_INSPECTED':
          setIsInspecting(false);
          setCurrentElement(message.payload);
          setActiveLayer('element');
          clearConversationRef.current();
          break;
        case 'INSPECT_ACTIVATED':
          setIsInspecting(true);
          break;
        case 'INSPECT_DEACTIVATED':
          setIsInspecting(false);
          break;
        case 'OPEN_INSPECTOR_FROM_CONTEXT_MENU':
          setIsInspecting(true);
          sendToBackground({ type: 'ACTIVATE_INSPECTOR' });
          break;
      }
    },
    [setCurrentElement, setActiveLayer],
  );

  const sendToBackground = usePort(tabId, handleMessage);
  const {
    status: channelStatus,
    sendMessage,
    clearConversation,
    lastError,
    messages,
    isWaiting,
  } = useClaudeChannel(tabId);

  clearConversationRef.current = clearConversation;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isInspecting) {
        setIsInspecting(false);
        sendToBackground({ type: 'DEACTIVATE_INSPECTOR' });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isInspecting, sendToBackground]);

  const toggleInspect = () => {
    const next = !isInspecting;
    setIsInspecting(next);
    const msg: PanelToBackgroundMessage = next
      ? { type: 'ACTIVATE_INSPECTOR' }
      : { type: 'DEACTIVATE_INSPECTOR' };
    sendToBackground(msg);
  };

  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when replies change
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, channelStatus]);

  const isDisconnected =
    channelStatus === 'disconnected' || channelStatus === 'checking' || channelStatus === 'error';
  const hasContent = currentElement !== null || messages.length > 0;

  // Layer CSS classes
  const elementLayerClass = activeLayer === 'element' ? 'layer layer-front' : 'layer layer-back';
  const conversationLayerClass =
    activeLayer === 'conversation' ? 'layer layer-front' : 'layer layer-back-right';

  return (
    <div className="flex flex-col h-full bg-background text-foreground relative">
      <DotGrid
        dotSize={2}
        gap={8}
        baseColor="#444444"
        glowColor="#da7756"
        proximity={200}
        className={'z-0'}
      />
      <div className={'z-10 flex flex-col h-full w-full'}>
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border shrink-0 bg-background/80">
          <Tooltip>
            <TooltipTrigger>
              <Button
                size="default"
                variant={isInspecting ? 'secondary' : 'outline'}
                onClick={toggleInspect}
                disabled={channelStatus === 'sending' || isDisconnected}
              >
                <MousePointer2 />
                {isInspecting ? 'Inspecting…' : 'Inspect'}
              </Button>
            </TooltipTrigger>
            {channelStatus !== 'sending' && !isDisconnected && (
              <TooltipContent side="bottom">
                {isInspecting ? 'Cancel inspection (Esc)' : 'Pick an element to inspect'}
              </TooltipContent>
            )}
          </Tooltip>
          <span className="flex-1" />
          <div className="text-xs font-medium flex items-center gap-1.5 select-none">
            {channelStatus === 'connected' || channelStatus === 'sending' ? (
              <>
                <span className="size-2 rounded-full bg-green-500" />
                <span className="text-green-600 dark:text-green-400">Connected</span>
              </>
            ) : (
              <>
                <span className="size-2 rounded-full bg-red-500" />
                <span className="text-red-600 dark:text-red-400">Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* 3-layer content area */}
        <div className="layer-container">
          {/* ── Instructions layer ── */}
          {/* Disconnected: always shown as a full overlay */}
          {isDisconnected && (
            <div className="layer-instructions-overlay gap-3 text-muted-foreground text-center px-4">
              <ChannelStatus status={channelStatus} lastError={lastError} inline />
            </div>
          )}
          {/* No content + connected: show inspect prompt */}
          {!hasContent && !isDisconnected && (
            <div className="layer layer-front flex flex-col items-center justify-center gap-3 text-muted-foreground text-center px-6">
              <p className="text-[13px] leading-relaxed max-w-60">
                Click <strong className="text-foreground">Inspect</strong> then click any element on
                the page.
                <br />
                Press{' '}
                <kbd className="inline-block px-1 py-px border border-border rounded text-[11px] bg-muted font-mono">
                  Esc
                </kbd>{' '}
                to cancel.
              </p>
            </div>
          )}

          {/* ── Element layer ── */}
          {hasContent && !isDisconnected && (
            <div className={elementLayerClass}>
              {currentElement ? (
                <div className="flex items-center justify-center h-full overflow-hidden">
                  <div className="flex shrink min-h-0 flex-col items-center justify-center p-6 pb-3">
                    {currentElement.screenshot && (
                      <PhotoBorderGlow
                        key={currentElement.screenshot}
                        className="screenshot-card"
                        sweepDelay={0}
                        sweepDuration={800}
                        style={
                          parseFloat(`${currentElement.computedStyles['border-radius']}`)
                            ? ({
                                '--border-radius': currentElement.computedStyles['border-radius'],
                              } as CSSProperties)
                            : {}
                        }
                      >
                        <RippleReveal
                          src={currentElement.screenshot}
                          alt="Element screenshot"
                          duration={600}
                        />
                      </PhotoBorderGlow>
                    )}
                    <ElementTags
                      key={currentElement.htmlPath ?? currentElement.url ?? ''}
                      element={currentElement}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-[13px]">
                  No element selected
                </div>
              )}
            </div>
          )}

          {/* ── Conversation layer ── */}
          {hasContent && !isDisconnected && (
            <div className={conversationLayerClass}>
              <div className="flex flex-col h-full overflow-y-auto px-3 py-3 gap-2">
                <div className="flex-1" />
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={scrollAnchorRef} className="shrink-0" />
              </div>
            </div>
          )}
        </div>
        <ChatBox
          onSubmit={async (msg) => {
            setActiveLayer('conversation');
            await sendMessage(msg, currentElement);
          }}
          isLoading={channelStatus === 'sending' || isWaiting}
          disabled={isDisconnected}
        />
      </div>
    </div>
  );
};
