/** Local visual weight only; never mutates the board or game state. */
export function shakeTable() {
  if (document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const stage = document.querySelector<HTMLElement>(".board-stage");
  if (!stage) return;
  stage.animate([
    { translate: "0 0" }, { translate: "1px 1px", offset: .2 },
    { translate: "-1px -1px", offset: .45 }, { translate: "1px 0", offset: .7 }, { translate: "0 0" },
  ], { duration: 150, easing: "ease-out" });
}