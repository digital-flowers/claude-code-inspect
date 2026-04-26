import type { InspectedElement } from './inspection';

// Content script → Background service worker
export type ContentToBackgroundMessage =
  | { type: 'ELEMENT_INSPECTED'; payload: InspectedElement }
  | { type: 'INSPECT_MODE_READY' }
  | { type: 'INSPECT_MODE_CANCELLED' };

// Side panel → Background service worker (via port)
export type PanelToBackgroundMessage =
  | { type: 'ACTIVATE_INSPECTOR' }
  | { type: 'DEACTIVATE_INSPECTOR' };

// Background service worker → Side panel (via port)
export type BackgroundToPanelMessage =
  | { type: 'ELEMENT_INSPECTED'; payload: InspectedElement }
  | { type: 'INSPECT_ACTIVATED' }
  | { type: 'INSPECT_DEACTIVATED' }
  | { type: 'OPEN_INSPECTOR_FROM_CONTEXT_MENU' };
