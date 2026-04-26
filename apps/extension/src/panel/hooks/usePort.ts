import { useEffect, useRef } from 'react';
import browser from 'webextension-polyfill';

import type { BackgroundToPanelMessage, PanelToBackgroundMessage } from '@/types/messages';

import { PORT_PREFIX } from '@/shared/constants';

export const usePort = (
  tabId: number | null,
  onMessage: (message: BackgroundToPanelMessage) => void,
): ((message: PanelToBackgroundMessage) => void) => {
  const portRef = useRef<browser.Runtime.Port | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (tabId == null) return;

    const connect = (): browser.Runtime.Port => {
      const p = browser.runtime.connect({ name: `${PORT_PREFIX}${tabId}` });
      p.onMessage.addListener((message: any) => {
        onMessageRef.current(message as BackgroundToPanelMessage);
      });
      p.onDisconnect.addListener(() => {
        portRef.current = connect();
      });
      return p;
    };

    portRef.current = connect();
    return () => {
      portRef.current?.disconnect();
      portRef.current = null;
    };
  }, [tabId]);

  return (message: PanelToBackgroundMessage) => portRef.current?.postMessage(message);
};
