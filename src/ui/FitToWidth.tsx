import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Shrinks fixed-size content (the machine cabinet) to fit narrow screens such as a phone,
 * keeping its proportions. Never enlarges it.
 */
export function FitToWidth({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const measure = () => {
      const scale = Math.min(1, outer.clientWidth / inner.offsetWidth);
      setFit({ scale, height: inner.offsetHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="w-full overflow-hidden" style={{ height: fit.height || undefined }}>
      <div
        ref={innerRef}
        className="mx-auto w-fit"
        style={{ transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  );
}
