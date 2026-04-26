import { useEffect, useRef, type CSSProperties } from 'react';

interface Props {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties | undefined;
  duration?: number;
  blockSize?: number;
}

export const RippleReveal = ({
  src,
  alt = '',
  className = '',
  style,
  duration = 400,
  blockSize = 4,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sizer = imgRef.current;
    if (!canvas || !sizer) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const img = new Image();

    const render = () => {
      if (!canvas || !ctx || !sizer) return;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const dpr = window.devicePixelRatio || 1;
      const cssW = sizer.clientWidth;
      const cssH = sizer.clientHeight;
      if (cssW === 0 || cssH === 0) return;

      const physW = Math.round(cssW * dpr);
      const physH = Math.round(cssH * dpr);

      canvas.width = physW;
      canvas.height = physH;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;

      const off = new OffscreenCanvas(physW, physH);
      const offCtx = off.getContext('2d');
      if (!offCtx) return;
      offCtx.drawImage(img, 0, 0, physW, physH);
      const imageData = offCtx.getImageData(0, 0, physW, physH);
      const src32 = new Uint32Array(imageData.data.buffer);

      const physBlockSize = Math.round(blockSize * dpr);
      const cols = Math.ceil(physW / physBlockSize);
      const rows = Math.ceil(physH / physBlockSize);
      const cx = (cols - 1) / 2;
      const cy = (rows - 1) / 2;
      const maxDist = Math.sqrt(cx * cx + cy * cy);

      const threshold = new Float32Array(rows * cols);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const dx = c - cx;
          const dy = r - cy;
          threshold[r * cols + c] = (Math.sqrt(dx * dx + dy * dy) / maxDist) * 0.7;
        }
      }

      const output = new ImageData(physW, physH);
      const out32 = new Uint32Array(output.data.buffer);
      const drawCtx = ctx;
      const startTime = performance.now();

      const draw = (now: number) => {
        const progress = Math.min((now - startTime) / duration, 1);

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const t = threshold[r * cols + c] ?? 0;
            const bp = Math.max(0, Math.min(1, (progress - t) / 0.3));

            const bx = c * physBlockSize;
            const by = r * physBlockSize;
            const bw = Math.min(physBlockSize, physW - bx);
            const bh = Math.min(physBlockSize, physH - by);

            if (bp <= 0) {
              for (let dy = 0; dy < bh; dy++) {
                for (let dx = 0; dx < bw; dx++) {
                  out32[(by + dy) * physW + (bx + dx)] = 0;
                }
              }
              continue;
            }

            const glowT = Math.max(0, 1 - bp / 0.4);
            const glow = 1 + glowT * 1.8;

            for (let dy = 0; dy < bh; dy++) {
              for (let dx = 0; dx < bw; dx++) {
                const pi = (by + dy) * physW + (bx + dx);
                const px = src32[pi] ?? 0;

                const rr = px & 0xff;
                const gg = (px >> 8) & 0xff;
                const bb = (px >> 16) & 0xff;
                const aa = (px >> 24) & 0xff;

                const fr = Math.min(255, (rr * glow) | 0);
                const fg = Math.min(255, (gg * glow) | 0);
                const fb = Math.min(255, (bb * glow) | 0);
                const fa = (aa * bp) | 0;

                out32[pi] = (fa << 24) | (fb << 16) | (fg << 8) | fr;
              }
            }
          }
        }

        drawCtx.putImageData(output, 0, 0);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(draw);
        } else {
          drawCtx.drawImage(img, 0, 0, physW, physH);
        }
      };

      rafRef.current = requestAnimationFrame(draw);
    };

    img.onload = () => {
      render();

      const ro = new ResizeObserver(render);
      ro.observe(sizer);
      return () => ro.disconnect();
    };

    img.src = src;

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [src, duration, blockSize]);

  return (
    <div className={`relative ${className}`} style={style}>
      {/* Invisible sizer image — drives the layout dimensions via aspect-ratio */}
      <img
        ref={imgRef}
        src={src}
        alt=""
        aria-hidden
        className="block max-w-full max-h-100 w-auto h-auto object-contain opacity-0"
      />
      {/* Canvas overlaid on top, sized to match the sizer */}
      <canvas
        ref={canvasRef}
        aria-label={alt}
        style={{
          display: 'block',
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
        }}
      />
    </div>
  );
};
