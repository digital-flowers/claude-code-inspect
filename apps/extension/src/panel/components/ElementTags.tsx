import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

import type { InspectedElement } from '@/types/inspection';

interface Props {
  element: InspectedElement;
}

interface TagItem {
  label: string;
  value: string;
}

const Tag = ({ label, value }: TagItem) => {
  const trimmed = value.length > 28 ? value.slice(0, 28) + '…' : value;
  const needsTooltip = value.length > 28;
  const tag = (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted border border-border text-[10px] font-mono leading-5 cursor-default">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground">{trimmed}</span>
    </span>
  );

  if (!needsTooltip) return tag;

  return (
    <Tooltip>
      <TooltipTrigger>{tag}</TooltipTrigger>
      <TooltipContent side="top" className="font-mono text-[11px] max-w-xs break-all">
        {value}
      </TooltipContent>
    </Tooltip>
  );
};

export const ElementTags = ({ element }: Props) => {
  const tags: TagItem[] = [];

  if (element.url) {
    tags.push({ label: 'url', value: element.url });
  }

  if (element.htmlPath) {
    tags.push({ label: 'html', value: element.htmlPath });
  }

  if (element.reactComponent) {
    tags.push({ label: 'react', value: `<${element.reactComponent.name} />` });
  }

  const sourceFile = element.reactPath.find((p) => p.fileName);
  if (sourceFile?.fileName) {
    const full = sourceFile.lineNumber
      ? `${sourceFile.fileName}:${sourceFile.lineNumber}`
      : sourceFile.fileName;
    tags.push({ label: 'src', value: full });
  }

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 py-2">
      {tags.map((tag, i) => (
        <span
          key={tag.label}
          className="animate-fade-in-up"
          style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
        >
          <Tag label={tag.label} value={tag.value} />
        </span>
      ))}
    </div>
  );
};
