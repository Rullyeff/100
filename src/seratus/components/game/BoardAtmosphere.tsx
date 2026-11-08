import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type SpaceInspection = { id: string; label: string; description: string; anchor: DOMRect };

/** Subtle center texture below all hit areas; presentation only. */
export function TabletopDecor() {
  return <g className="tabletop-decor" aria-hidden="true">
    <defs>
      <pattern id="center-weave" width="5" height="5" patternUnits="userSpaceOnUse">
        <path d="M0 1H5 M1 0V5" className="tabletop-weave-thread" />
      </pattern>
    </defs>
    {/* Transparent woven overlay retains the original central star and artwork. */}
    <path d="M500 443 573 493 547 587 453 587 427 493Z" fill="url(#center-weave)" />
  </g>;
}

/** Tiny, deterministic dust flecks; never intercept board input. */
export function TableLightParticles() {
  return <div className="table-light-particles" aria-hidden="true">
    {Array.from({ length: 16 }, (_, i) => <span key={i} style={{
      "--dust-x": `${8 + (i * 29) % 84}%`,
      "--dust-y": `${12 + (i * 37) % 76}%`,
      "--dust-delay": `${-i * 1.7}s`,
      "--dust-duration": `${11 + i % 6}s`,
      "--dust-drift": `${i % 2 ? 12 : -12}px`,
    } as CSSProperties} />)}
  </div>;
}

export function InspectableSpace({ id, label, description, point, here, inspected, onInspect, children, width = 27, height = 27 }: {
  id: string; label: string; description: string; point: { x: number; y: number; rot: number };
  here: boolean; inspected: boolean; onInspect: (space: SpaceInspection | null) => void;
  children: ReactNode; width?: number; height?: number;
}) {
  const show = (element: SVGGElement) => onInspect({ id, label, description, anchor: element.getBoundingClientRect() });
  return <g className={`board-space ${here ? "destination-space" : ""} ${inspected ? "board-space-inspected" : ""}`}
    data-space={id} tabIndex={0} role="img" aria-label={label} aria-describedby={inspected ? "board-space-tooltip" : undefined}
    transform={`translate(${point.x} ${point.y})`}
    onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) show(e.currentTarget); }} onBlur={() => onInspect(null)}
    onPointerEnter={(e) => { if (e.pointerType === "mouse") show(e.currentTarget); }}
    onPointerLeave={(e) => { if (e.pointerType === "mouse") onInspect(null); }}
    onClick={(e) => show(e.currentTarget)}>
    {children}
    <rect className="board-space-highlight" transform={`rotate(${point.rot})`} x={-width / 2} y={-height / 2}
      width={width} height={height} rx="3" />
  </g>;
}

/** Screen-space tooltip remains upright and inside the viewport even on a tilted/zoomed board. */
export function SpaceTooltip({ space, onDismiss }: { space: SpaceInspection; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const { anchor } = space;
    const left = Math.max(8, Math.min(window.innerWidth - box.width - 8, anchor.left + anchor.width / 2 - box.width / 2));
    const above = anchor.top - box.height - 16;
    const top = Math.max(8, Math.min(window.innerHeight - box.height - 8, above >= 8 ? above : anchor.bottom + 16));
    setPosition({ left, top });
  }, [space]);
  useEffect(() => {
    const outside = (e: PointerEvent) => { if (!(e.target instanceof Element) || !e.target.closest(".board-space")) onDismiss(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("click", outside, true);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", onDismiss);
    window.addEventListener("scroll", onDismiss, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("click", outside, true);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", onDismiss);
      window.removeEventListener("scroll", onDismiss, true);
    };
  }, [onDismiss]);
  return createPortal(<div ref={ref} id="board-space-tooltip" role="tooltip" className="board-space-tooltip"
    style={position ? { ...position, visibility: "visible" } : { visibility: "hidden" }}>
    <strong>{space.label}</strong><p>{space.description}</p>
  </div>, document.body);
}