// The hand-picked "Classics" episodes, shown on the podcast page and as the "Start here" strip on the
// episode library. To change one, swap its entry:
//   { slug: '...' } matches the page address, { num: '243' } matches the episode number.
import type { Episode } from './episodes';

export const classicsPicks: Array<{ slug: string } | { num: string }> = [
  { slug: 'low-lift-email-list-growth' }, // Ep 265
  { slug: 'grow-email-list-without-instagram-ads' },
  { slug: 'why-i-dont-send-welcome-sequences-anymore' },
  { num: '243' }, // The Only 4 Emails You Need to Stay Consistent
];

export function pickClassics(episodes: Episode[]): Episode[] {
  return classicsPicks
    .map((pick) => episodes.find((ep) => ('slug' in pick ? ep.href.includes(pick.slug) : ep.num === pick.num)))
    .filter((ep): ep is Episode => Boolean(ep));
}
