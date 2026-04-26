import browser from 'webextension-polyfill';

import type { InspectedElement, ReactComponentInfo, ReactPathEntry } from '@/types/inspection';
import type { ContentToBackgroundMessage } from '@/types/messages';

import { RELEVANT_CSS_PROPS } from '@/shared/constants';

// ─── React fiber utilities ────────────────────────────────────────
// Content scripts run in an isolated JS world — React's fiber properties are
// only visible in the page (MAIN) world. react-bridge.ts runs in MAIN world
// and listens for this CustomEvent, reads the fiber, and dispatches the response.
// CustomEvents cross the JS isolation boundary because they travel via the DOM.

const REACT_EVENT_REQUEST = '__claude_inspect_react_req__';
const REACT_EVENT_RESPONSE = '__claude_inspect_react_res__';
const REACT_PATH_REQUEST = '__claude_inspect_react_path_req__';
const REACT_PATH_RESPONSE = '__claude_inspect_react_path_res__';

const REACT_LOOKUP_ATTR = '__claude_inspect_target__';

const withLookupAttr = <T>(el: Element, fn: () => T): T => {
  el.setAttribute(REACT_LOOKUP_ATTR, '1');
  const result = fn();
  el.removeAttribute(REACT_LOOKUP_ATTR);
  return result;
};

const dispatchAndReceive = <T>(requestEvent: string, responseEvent: string): T | null => {
  let result: T | null = null;
  let received = false;

  const handler = (e: Event): void => {
    result = (e as CustomEvent<T | null>).detail ?? null;
    received = true;
  };

  window.addEventListener(responseEvent, handler, { once: true });
  window.dispatchEvent(new CustomEvent(requestEvent));

  if (!received) window.removeEventListener(responseEvent, handler);
  return result;
};

const getReactComponentName = (el: Element): ReactComponentInfo | null =>
  withLookupAttr(el, () =>
    dispatchAndReceive<ReactComponentInfo>(REACT_EVENT_REQUEST, REACT_EVENT_RESPONSE),
  );

const getReactComponentPath = (el: Element): ReactPathEntry[] =>
  withLookupAttr(el, () =>
    dispatchAndReceive<ReactPathEntry[]>(REACT_PATH_REQUEST, REACT_PATH_RESPONSE),
  ) ?? [];

const OVERLAY_ID = '__claude_inspect_overlay__';
const OVERLAY_LABEL_ID = '__claude_inspect_label__';

class ElementInspector {
  private overlay: HTMLElement | null = null;
  private label: HTMLElement | null = null;
  private isActive = false;

  activate(): void {
    if (this.isActive) return;
    this.isActive = true;

    this.createOverlay();

    document.addEventListener('mousemove', this.handleMouseMove, true);
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('keydown', this.handleKeydown, true);
    document.body.style.cursor = 'crosshair';

    const msg: ContentToBackgroundMessage = { type: 'INSPECT_MODE_READY' };
    browser.runtime.sendMessage(msg).catch(console.error);
  }

  deactivate(): void {
    if (!this.isActive) return;
    this.isActive = false;

    document.removeEventListener('mousemove', this.handleMouseMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.removeEventListener('keydown', this.handleKeydown, true);
    document.body.style.cursor = '';

    this.removeOverlay();

    const msg: ContentToBackgroundMessage = { type: 'INSPECT_MODE_CANCELLED' };
    browser.runtime.sendMessage(msg).catch(console.error);
  }

  private createOverlay(): void {
    // Remove any stale overlay
    this.removeOverlay();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      'position: fixed',
      'pointer-events: none',
      'z-index: 2147483647',
      'background: rgba(217, 119, 87, 0.15)',
      'outline: 2px solid rgba(217, 119, 87, 0.8)',
      'outline-offset: -1px',
      'transition: top 0.05s, left 0.05s, width 0.05s, height 0.05s',
      'box-sizing: border-box',
    ].join('; ');

    // Wrapper sits above the overlay and holds the orange label + React badge side by side
    const labelRow = document.createElement('div');
    labelRow.style.cssText = [
      'position: absolute',
      'bottom: calc(100% + 4px)',
      'left: 0',
      'display: flex',
      'align-items: center',
      'gap: 4px',
      'white-space: nowrap',
      'pointer-events: none',
    ].join('; ');

    const label = document.createElement('div');
    label.id = OVERLAY_LABEL_ID;
    label.style.cssText = [
      'background: rgba(10, 20, 30, 0.85)',
      'color: #f0916a',
      'border: 1px solid rgba(240, 145, 106, 0.5)',
      'font-family: monospace',
      'font-size: 11px',
      'padding: 2px 6px',
      'border-radius: 3px',
      'white-space: nowrap',
    ].join('; ');

    labelRow.appendChild(label);
    overlay.appendChild(labelRow);
    document.documentElement.appendChild(overlay);

    this.overlay = overlay;
    this.label = label;
  }

  private removeOverlay(): void {
    try {
      document.getElementById(OVERLAY_ID)?.remove();
    } catch {
      // ignore
    }
    this.overlay = null;
    this.label = null;
  }

  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.overlay || !this.label) return;

    const target = e.target as Element;
    if (target === this.overlay || target === this.label) return;
    if (target.id === OVERLAY_ID || target.id === OVERLAY_LABEL_ID) return;

    const rect = target.getBoundingClientRect();
    Object.assign(this.overlay.style, {
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });

    this.label.textContent = this.buildTagText(target);
    this.updateReactBadge(target);
  };

  private handleClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const target = e.target as Element;
    if (target.id === OVERLAY_ID || target.id === OVERLAY_LABEL_ID) return;

    // Hide overlay so it doesn't appear in the screenshot
    this.removeOverlay();

    setTimeout(() => {
      const msg: ContentToBackgroundMessage = {
        type: 'ELEMENT_INSPECTED',
        payload: this.extractElementData(target),
      };

      // Wait for the browser to repaint without the overlay before sending,
      // so captureVisibleTab in the background sees a clean frame
      requestAnimationFrame(() => {
        browser.runtime.sendMessage(msg).catch(console.error);
      });

      this.deactivate();
    }, 100);
  };

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.deactivate();
    }
  };

  private buildTagText(el: Element): string {
    let tag = el.tagName.toLowerCase();
    if (el.id) tag += `#${el.id}`;
    if (el.classList.length > 0) tag += `.${Array.from(el.classList).slice(0, 3).join('.')}`;
    return tag;
  }

  private updateReactBadge(el: Element): void {
    if (!this.label) return;
    const labelRow = this.label.parentElement;
    if (!labelRow) return;

    // Remove any existing React badge
    labelRow.querySelector('#__claude_react_badge__')?.remove();

    const react = getReactComponentName(el);
    if (!react) return;

    const badge = document.createElement('div');
    badge.id = '__claude_react_badge__';
    badge.style.cssText = [
      'display: inline-flex',
      'align-items: center',
      'gap: 3px',
      'background: rgba(10, 20, 30, 0.85)',
      'color: #61dafb',
      'border: 1px solid rgba(97, 218, 251, 0.5)',
      'font-family: monospace',
      'font-size: 11px',
      'padding: 2px 6px',
      'border-radius: 3px',
      'white-space: nowrap',
    ].join('; ');
    badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" style="flex-shrink:0"><circle cx="12" cy="12" r="2.5" fill="#61dafb"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61dafb" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61dafb" stroke-width="1.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" fill="none" stroke="#61dafb" stroke-width="1.5" transform="rotate(120 12 12)"/></svg>&lt;${react.name} /&gt;`;
    labelRow.appendChild(badge);
  }

  private extractElementData(el: Element): InspectedElement {
    const computed = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    return {
      url: window.location.href,
      tagName: el.tagName.toLowerCase(),
      id: el.id || null,
      classList: Array.from(el.classList),
      attributes: this.getAttributes(el),
      textContent: el.textContent?.trim().slice(0, 200) ?? null,
      boundingRect: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      computedStyles: this.extractKeyStyles(computed),
      htmlPath: this.buildSelector(el),
      outerHTML: el.outerHTML.slice(0, 2000),
      reactComponent: getReactComponentName(el),
      reactPath: getReactComponentPath(el),
    };
  }

  private getAttributes(el: Element): Record<string, string> {
    const result: Record<string, string> = {};
    for (const attr of el.attributes) {
      result[attr.name] = attr.value;
    }
    return result;
  }

  private extractKeyStyles(computed: CSSStyleDeclaration): Record<string, string> {
    const result: Record<string, string> = {};
    for (const prop of RELEVANT_CSS_PROPS) {
      const value = computed.getPropertyValue(prop);
      if (value) result[prop] = value;
    }
    return result;
  }

  private buildSelector(el: Element): string {
    const parts: string[] = [];
    let current: Element | null = el;

    while (current && current !== document.documentElement) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += `#${current.id}`;
        parts.unshift(part);
        break;
      }

      const parent = current.parentElement;
      if (parent) {
        const tagName = current.tagName;
        const siblings = Array.from(parent.children).filter((c) => c.tagName === tagName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          part += `:nth-of-type(${idx})`;
        }
      }

      parts.unshift(part);
      current = current.parentElement;
    }

    return parts.join(' > ');
  }
}

// Singleton inspector instance
const inspector = new ElementInspector();

// Listen for messages from the background service worker
browser.runtime.onMessage.addListener((message: any) => {
  const msg = message as { type: string };
  switch (msg.type) {
    case 'ACTIVATE_INSPECTOR':
      inspector.activate();
      break;
    case 'DEACTIVATE_INSPECTOR':
      inspector.deactivate();
      break;
    case 'GET_DEVICE_PIXEL_RATIO':
      return Promise.resolve(window.devicePixelRatio);
  }
  return undefined;
});
