// Runs in MAIN world — has access to page JS globals including React fiber nodes.
// Communicates with the isolated-world content script via CustomEvents.

const REACT_EVENT_REQUEST = '__claude_inspect_react_req__';
const REACT_EVENT_RESPONSE = '__claude_inspect_react_res__';
const REACT_PATH_REQUEST = '__claude_inspect_react_path_req__';
const REACT_PATH_RESPONSE = '__claude_inspect_react_path_res__';

const REACT_LOOKUP_ATTR = '__claude_inspect_target__';

type FiberNode = Record<string, unknown>;

const getFiberName = (node: FiberNode): string | null => {
  const type = node['type'];
  let name: string | null = null;

  if (typeof type === 'function') {
    const fn = type as { displayName?: string; name?: string };
    name = fn.displayName || fn.name || null;
  } else if (type && typeof type === 'object') {
    const obj = type as {
      displayName?: string;
      type?: { displayName?: string; name?: string };
      render?: { displayName?: string; name?: string };
    };
    name =
      obj.displayName ||
      obj.type?.displayName ||
      obj.type?.name ||
      obj.render?.displayName ||
      obj.render?.name ||
      null;
  }

  if (name && name !== 'Anonymous' && /^[A-Z]/.test(name)) return name;
  return null;
};

const getFiberFromElement = (el: Element): FiberNode | null => {
  const fiberKey = Object.keys(el).find(
    (k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'),
  );
  if (!fiberKey) return null;
  return (el as unknown as Record<string, unknown>)[fiberKey] as FiberNode | null;
};

// Returns the nearest named component for the element
window.addEventListener(REACT_EVENT_REQUEST, () => {
  const el = document.querySelector(`[${REACT_LOOKUP_ATTR}]`);
  if (!el) {
    window.dispatchEvent(new CustomEvent(REACT_EVENT_RESPONSE, { detail: null }));
    return;
  }

  const fiber = getFiberFromElement(el);
  if (!fiber) {
    window.dispatchEvent(new CustomEvent(REACT_EVENT_RESPONSE, { detail: null }));
    return;
  }

  let node: FiberNode | null = fiber;
  while (node) {
    const name = getFiberName(node);
    if (name) {
      const type = node['type'] as { displayName?: string } | null;
      const displayName = type?.displayName;
      window.dispatchEvent(
        new CustomEvent(REACT_EVENT_RESPONSE, {
          detail: {
            name,
            ...(displayName && displayName !== name ? { displayName } : {}),
          },
        }),
      );
      return;
    }
    node = (node['return'] as FiberNode | null) ?? null;
  }

  window.dispatchEvent(new CustomEvent(REACT_EVENT_RESPONSE, { detail: null }));
});

interface ReactPathEntry {
  name: string;
  fileName: string | null;
  lineNumber: number | null;
}

// Returns the full ancestor component chain from nearest to root, with source info
window.addEventListener(REACT_PATH_REQUEST, () => {
  const el = document.querySelector(`[${REACT_LOOKUP_ATTR}]`);
  if (!el) {
    window.dispatchEvent(new CustomEvent(REACT_PATH_RESPONSE, { detail: [] }));
    return;
  }

  const fiber = getFiberFromElement(el);
  if (!fiber) {
    window.dispatchEvent(new CustomEvent(REACT_PATH_RESPONSE, { detail: [] }));
    return;
  }

  const path: ReactPathEntry[] = [];
  let node: FiberNode | null = fiber;
  while (node) {
    const name = getFiberName(node);
    if (name && name !== path[path.length - 1]?.name) {
      const src = node['_debugSource'] as
        | { fileName?: string; lineNumber?: number }
        | null
        | undefined;
      path.push({
        name,
        fileName: src?.fileName ?? null,
        lineNumber: src?.lineNumber ?? null,
      });
    }
    node = (node['return'] as FiberNode | null) ?? null;
  }

  window.dispatchEvent(new CustomEvent(REACT_PATH_RESPONSE, { detail: path }));
});
