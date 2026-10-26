// The podcast was called "This Mama Means Business" until it was renamed The Email Growth Show at Ep 148.
// Episodes before that point carry the old name on their covers and show notes pages.
export const REBRAND_EPISODE = 148;

export const OLD_SHOW = 'This Mama Means Business';
export const NEW_SHOW = 'The Email Growth Show';

export function isOldShow(num: string | number): boolean {
  const n = Number(num);
  return n > 0 && n < REBRAND_EPISODE;
}

export function showName(num: string | number): string {
  return isOldShow(num) ? OLD_SHOW : NEW_SHOW;
}
