import type { InspectedElement } from '@/types/inspection';

import { Badge } from '@/panel/ui/badge';

interface Props {
  element: InspectedElement;
}

const escapeHtml = (str: string): string =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const Row = ({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) => (
  <tr className="group hover:bg-muted/50">
    <td
      className={`py-0.5 pr-3 text-[11px] whitespace-nowrap align-top text-(--attr-key-color) ${mono ? 'font-mono' : ''}`}
    >
      {label}
    </td>
    <td
      className={`py-0.5 text-[11px] break-all align-top text-(--attr-val-color) ${mono ? 'font-mono' : ''}`}
    >
      {value}
    </td>
  </tr>
);

export const GeneralPane = ({ element }: Props) => {
  let tagText = `<${element.tagName}`;
  if (element.id) tagText += `#${element.id}`;
  if (element.classList.length > 0) tagText += `.${element.classList.slice(0, 3).join('.')}`;
  tagText += '>';

  const attrRows = Object.entries(element.attributes);

  return (
    <>
      <table className="w-full border-collapse">
        <tbody>
          <Row label="selector" value={element.htmlPath} />
          <Row label="tag" value={tagText} />
          <Row
            label="size"
            value={`${element.boundingRect.width} × ${element.boundingRect.height}px`}
          />
          {element.reactComponent &&
            (() => {
              const label = element.reactComponent.displayName ?? element.reactComponent.name;
              return (
                <tr className="group hover:bg-muted/50">
                  <td className="py-0.5 pr-3 text-[11px] whitespace-nowrap align-top text-(--attr-key-color) font-mono">
                    react
                  </td>
                  <td className="py-0.5 text-[11px] align-top">
                    <Badge
                      variant="outline"
                      className="text-[#61dafb] border-[#61dafb]/30 bg-[#61dafb]/5 font-mono text-[10px] h-4 px-1"
                    >
                      &lt;{escapeHtml(label)} /&gt;
                    </Badge>
                  </td>
                </tr>
              );
            })()}
          {attrRows.map(([key, value]) => (
            <Row key={key} label={key} value={`"${value}"`} />
          ))}
          {element.textContent && <Row label="text" value={element.textContent} />}
        </tbody>
      </table>
    </>
  );
};
