import browser from 'webextension-polyfill';

import type { BoundingRect } from '@/types/inspection';
import type {
  BackgroundToPanelMessage,
  ContentToBackgroundMessage,
  PanelToBackgroundMessage,
} from '@/types/messages';

import { PORT_PREFIX } from '@/shared/constants';

const captureElementScreenshot = async (
  tabId: number,
  rect: BoundingRect,
): Promise<string | null> => {
  try {
    const dataUrl = await (browser as any).tabs.captureVisibleTab({
      format: 'jpeg',
      quality: 70,
    });
    const dpr = (await browser.tabs
      .sendMessage(tabId, { type: 'GET_DEVICE_PIXEL_RATIO' })
      .catch(() => 1)) as unknown;
    const ratio = typeof dpr === 'number' && dpr > 0 ? dpr : 1;

    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const srcX = Math.max(0, rect.left);
    const srcY = Math.max(0, rect.top);
    const srcW = Math.min(rect.width, bitmap.width / ratio - srcX);
    const srcH = Math.min(rect.height, bitmap.height / ratio - srcY);

    const canvas = new OffscreenCanvas(Math.round(srcW * ratio), Math.round(srcH * ratio));
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(
      bitmap,
      Math.round(srcX * ratio),
      Math.round(srcY * ratio),
      Math.round(srcW * ratio),
      Math.round(srcH * ratio),
      0,
      0,
      Math.round(srcW * ratio),
      Math.round(srcH * ratio),
    );

    const outBlob = await canvas.convertToBlob({ type: 'image/png' });
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(outBlob);
    });
  } catch {
    return null;
  }
};

// Map of tabId → side panel port (alive while the side panel is open for that tab)
const panelPorts = new Map<number, browser.Runtime.Port>();

// Tabs where context menu was clicked and panel should auto-activate on connection
const pendingActivations = new Set<number>();

// Register context menu on installation
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'inspect-with-claude',
    title: 'Inspect with Claude Code',
    contexts: ['all'],
  });
});

// Handle context menu clicks
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'inspect-with-claude' || tab?.id == null) return;

  const tabId = tab.id;

  // Must be called synchronously inside the user gesture handler
  // Note: sidePanel is not in polyfill types for some reason, or might need special handling,
  // but usually it works if we use the chrome object for things not polyfill,
  // or we can try to cast browser if it's there.
  (browser as any).sidePanel.open({ tabId }).catch(console.error);
  pendingActivations.add(tabId);
});

// Also open side panel when the toolbar icon is clicked
browser.action.onClicked.addListener((tab) => {
  if (tab.id == null) return;
  (browser as any).sidePanel.open({ tabId: tab.id }).catch(console.error);
});

// Long-lived connections from the side panel
browser.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith(PORT_PREFIX)) return;

  const tabId = parseInt(port.name.slice(PORT_PREFIX.length), 10);
  if (isNaN(tabId)) return;

  panelPorts.set(tabId, port);

  // If the panel was opened via context menu, tell it to activate the inspector
  if (pendingActivations.has(tabId)) {
    pendingActivations.delete(tabId);
    const msg: BackgroundToPanelMessage = { type: 'OPEN_INSPECTOR_FROM_CONTEXT_MENU' };
    port.postMessage(msg);
  }

  // Messages from the side panel → forward to content script
  port.onMessage.addListener((message: any) => {
    const msg = message as PanelToBackgroundMessage;
    switch (msg.type) {
      case 'ACTIVATE_INSPECTOR':
        browser.tabs.sendMessage(tabId, { type: 'ACTIVATE_INSPECTOR' }).catch(console.error);
        break;
      case 'DEACTIVATE_INSPECTOR':
        browser.tabs.sendMessage(tabId, { type: 'DEACTIVATE_INSPECTOR' }).catch(console.error);
        break;
    }
  });

  port.onDisconnect.addListener(() => {
    panelPorts.delete(tabId);
    browser.tabs.sendMessage(tabId, { type: 'DEACTIVATE_INSPECTOR' }).catch(() => {
      // Tab may already be gone — ignore
    });
  });
});

// Messages from content scripts → relay to side panel
browser.runtime.onMessage.addListener((message: any, sender: browser.Runtime.MessageSender) => {
  const msg = message as ContentToBackgroundMessage;
  const tabId = sender.tab?.id;
  if (tabId == null) return;

  const port = panelPorts.get(tabId);
  if (!port) return;

  switch (msg.type) {
    case 'ELEMENT_INSPECTED': {
      const payload = msg.payload;
      captureElementScreenshot(tabId, payload.boundingRect)
        .then((result) => {
          const outMsg: BackgroundToPanelMessage = {
            type: 'ELEMENT_INSPECTED',
            payload: result ? { ...payload, screenshot: result } : payload,
          };
          port.postMessage(outMsg);
        })
        .catch(() => {
          port.postMessage({ type: 'ELEMENT_INSPECTED', payload } as BackgroundToPanelMessage);
        });
      break;
    }
    case 'INSPECT_MODE_READY': {
      const outMsg: BackgroundToPanelMessage = { type: 'INSPECT_ACTIVATED' };
      port.postMessage(outMsg);
      break;
    }
    case 'INSPECT_MODE_CANCELLED': {
      const outMsg: BackgroundToPanelMessage = { type: 'INSPECT_DEACTIVATED' };
      port.postMessage(outMsg);
      break;
    }
  }
});
