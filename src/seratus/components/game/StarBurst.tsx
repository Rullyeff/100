import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

/** One short, presentation-only burst; never persists or changes the game. */
export function StarBurst({ point }: { point?: { x: number; y: number } }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 850);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  const style: CSSProperties | undefined = point ? { left: point.x, top: point.y } : undefined;
  const burst = (
    <div aria-hidden="true" className={`arcade-star-burst ${point ? "arcade-star-burst-dice" : "arcade-star-burst-card"}`} style={style}>
      {Array.from({ length: 8 }, (_, i) => <span key={i}>✦</span>)}
    </div>
  );
  return point ? createPortal(burst, document.body) : burst;
}