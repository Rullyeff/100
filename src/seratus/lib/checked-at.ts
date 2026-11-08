/** Indexed game data must exist; reject corrupt state instead of silently rendering it. */
export function checkedAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error('Data permainan tidak lengkap.');
  return item;
}