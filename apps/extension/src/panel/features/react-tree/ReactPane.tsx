import { ReactNode, useState } from 'react';

import type { InspectedElement, ReactPathEntry } from '@/types/inspection';

import { cn } from '@/panel/lib/utils';

interface Props {
  element: InspectedElement;
}

const NOISE_PATTERN = /Provider|Wrapper|Router|Adapter|Boundary|Guard|Sibling|Children/;

const formatPath = (filePath: string, lineNumber: number | null): string => {
  const srcIdx = filePath.lastIndexOf('/src/');
  const short =
    srcIdx !== -1 ? filePath.slice(srcIdx + 1) : filePath.split('/').slice(-2).join('/');
  return lineNumber ? `${short}:${lineNumber}` : short;
};

const ChevronDown = () => (
  <svg viewBox="0 0 8 8" width="8" height="8">
    <path
      d="M1.5 2.5l2.5 3 2.5-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 8 8" width="8" height="8">
    <path
      d="M2 1.5l3.5 2.5-3.5 2.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Dot = () => (
  <svg viewBox="0 0 8 8" width="8" height="8">
    <circle cx="4" cy="4" r="1.5" fill="currentColor" />
  </svg>
);

interface RowProps {
  entry: ReactPathEntry;
  isCurrent: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  indent: number;
  onToggle: () => void;
}

const ReactTreeRow = ({
  entry,
  isCurrent,
  hasChildren,
  isCollapsed,
  indent,
  onToggle,
}: RowProps) => {
  const isNoise = NOISE_PATTERN.test(entry.name) && !isCurrent;
  return (
    <div
      className={cn(
        'flex items-start gap-1 py-0.5 pr-3 rounded cursor-default',
        'hover:bg-muted/50',
        isCurrent ? 'opacity-100' : isNoise ? 'opacity-20' : 'opacity-45',
      )}
      style={{ paddingLeft: `${indent}px` }}
    >
      <span
        className={cn(
          'shrink-0 w-3.5 h-4.5 flex items-center justify-center mt-0.5 rounded-sm',
          hasChildren
            ? 'text-muted-foreground hover:text-foreground hover:bg-border cursor-pointer'
            : 'text-border cursor-default',
        )}
        onClick={
          hasChildren
            ? (e) => {
                e.stopPropagation();
                onToggle();
              }
            : undefined
        }
      >
        {hasChildren ? isCollapsed ? <ChevronRight /> : <ChevronDown /> : <Dot />}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0 overflow-hidden">
        <div
          className={cn(
            'font-mono text-[11px] text-[#61dafb] whitespace-nowrap',
            isCurrent && 'font-bold',
          )}
        >
          {`<${entry.name}>`}
        </div>
        {entry.fileName && (
          <div
            className="font-mono text-[10px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis"
            title={entry.fileName}
          >
            {formatPath(entry.fileName, entry.lineNumber)}
          </div>
        )}
      </div>
    </div>
  );
};

export const ReactPane = ({ element }: Props) => {
  const entries = [...element.reactPath].reverse();
  const currentIdx = entries.length - 1;

  const [collapsed, setCollapsed] = useState<Set<number>>(
    () => new Set(entries.length > 6 ? [0] : []),
  );

  if (entries.length === 0) {
    return <p className="text-[11px] text-muted-foreground p-3">No React components detected.</p>;
  }

  const toggle = (idx: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const rows: ReactNode[] = [];
  let i = 0;
  let visualDepth = 0;

  while (i <= currentIdx) {
    const entry = entries[i];
    if (!entry) break;
    const isCurrent = i === currentIdx;
    const hasChildren = i < currentIdx;
    const isCollapsed = collapsed.has(i);
    const skipCount = currentIdx - i - 1;
    const idx = i;

    rows.push(
      <ReactTreeRow
        key={i}
        entry={entry}
        isCurrent={isCurrent}
        hasChildren={hasChildren}
        isCollapsed={isCollapsed}
        indent={visualDepth * 12}
        onToggle={() => toggle(idx)}
      />,
    );
    visualDepth++;

    if (isCollapsed && skipCount > 0) {
      rows.push(
        <div
          key={`pill-${i}`}
          className="font-mono text-[10px] text-muted-foreground opacity-50 hover:opacity-100 hover:text-[#61dafb] cursor-pointer py-0.5"
          style={{ paddingLeft: `${visualDepth * 12 + 14}px` }}
          onClick={() => toggle(idx)}
        >
          {`··· ${skipCount} more`}
        </div>,
      );
      i = currentIdx;
    } else {
      i++;
    }
  }

  return <div className="py-1.5">{rows}</div>;
};
