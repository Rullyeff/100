/** Visual energy only: never supplies a dice value to the game. */
export function diceCharge(elapsedMs: number): number {
  const phase = (Math.max(0, elapsedMs) % 1800) / 900;
  return Math.round((phase <= 1 ? phase : 2 - phase) * 100);
}