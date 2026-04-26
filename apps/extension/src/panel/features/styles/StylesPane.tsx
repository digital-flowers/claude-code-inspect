import type { InspectedElement } from '@/types/inspection';

interface Props {
  element: InspectedElement;
}

const STYLE_GROUPS: Record<string, string[]> = {
  Layout: [
    'display',
    'position',
    'width',
    'height',
    'min-width',
    'min-height',
    'max-width',
    'max-height',
  ],
  'Box Model': [
    'margin',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'padding',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'box-sizing',
  ],
  Flexbox: ['flex', 'flex-direction', 'align-items', 'justify-content'],
  Grid: ['grid', 'grid-template-columns', 'grid-template-rows'],
  Typography: ['font-family', 'font-size', 'font-weight', 'line-height', 'text-align', 'color'],
  Visual: [
    'background-color',
    'border',
    'border-radius',
    'box-shadow',
    'opacity',
    'visibility',
    'overflow',
  ],
  Transform: ['transform', 'z-index', 'cursor', 'pointer-events'],
};

const isColorValue = (value: string): boolean => {
  return (
    value.startsWith('#') ||
    value.startsWith('rgb') ||
    value.startsWith('hsl') ||
    value === 'transparent' ||
    value === 'currentcolor'
  );
};

const StyleRow = ({ prop, value }: { prop: string; value: string }) => {
  return (
    <div className="flex gap-2 py-0.5 font-mono text-[11px]">
      <span className="text-(--prop-color) whitespace-nowrap shrink-0">{prop}:</span>
      <span className="text-(--val-color) break-all flex items-center gap-1">
        {isColorValue(value) && (
          <span
            className="inline-block w-2.5 h-2.5 rounded-xs border border-black/15 shrink-0"
            style={{ background: value }}
          />
        )}
        {value}
      </span>
    </div>
  );
};

const StyleGroup = ({
  name,
  props,
  styles,
}: {
  name: string;
  props: string[];
  styles: Record<string, string>;
}) => {
  const relevant = props.filter(
    (p) => styles[p] && styles[p] !== 'none' && styles[p] !== 'normal' && styles[p] !== '0px',
  );
  if (relevant.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground mb-1 pb-0.5 border-b border-border">
        {name}
      </div>
      {relevant.map((prop) => (
        <StyleRow key={prop} prop={prop} value={styles[prop] ?? ''} />
      ))}
    </div>
  );
};

export const StylesPane = ({ element }: Props) => {
  const styles = element.computedStyles;
  const allGroupedProps = Object.values(STYLE_GROUPS).flat();
  const remaining = Object.entries(styles).filter(
    ([k, v]) => !allGroupedProps.includes(k) && v && v !== 'none',
  );

  return (
    <div>
      {Object.entries(STYLE_GROUPS).map(([name, props]) => (
        <StyleGroup key={name} name={name} props={props} styles={styles} />
      ))}
      {remaining.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground mb-1 pb-0.5 border-b border-border">
            Other
          </div>
          {remaining.map(([prop, value]) => (
            <StyleRow key={prop} prop={prop} value={value} />
          ))}
        </div>
      )}
    </div>
  );
};
