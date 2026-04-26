export interface BoundingRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ReactComponentInfo {
  name: string;
  displayName?: string;
}

export interface ReactPathEntry {
  name: string;
  fileName: string | null;
  lineNumber: number | null;
}

export interface InspectedElement {
  url: string;
  tagName: string;
  id: string | null;
  classList: string[];
  attributes: Record<string, string>;
  textContent: string | null;
  boundingRect: BoundingRect;
  computedStyles: Record<string, string>;
  htmlPath: string;
  outerHTML: string;
  reactComponent: ReactComponentInfo | null;
  reactPath: ReactPathEntry[];
  screenshot?: string;
}
