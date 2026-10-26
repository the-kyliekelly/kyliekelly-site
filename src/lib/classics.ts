// The hand-picked "Classics" episodes, shown on the podcast page and as the "Start here" strip on the
// episode library. To change one, swap its entry:
//   slug  matches the page address, num matches the episode number
//   short is a shorter title for the Start here cards, so all four are about the same length
//         (leave it out to use the full title)
import type { Episode } from './episodes';

type Pick = ({ slug: string } | { num: string }) & { short?: string };

export const classicsPicks: Pick[] = [
  { slug: 'low-lift-email-list-growth', short: "The Low-Lift Way I'm Growing My List Right Now" }, // Ep 265
  { slug: 'grow-email-list-without-instagram-ads', short: "Instagram Isn't Working? Grow Your Email List" },
  { slug: 'why-i-dont-send-welcome-sequences-anymore', short: "Why I Don't Send a Traditional Welcome Sequence" },
  { num: '243', short: 'The Only 4 Emails You Need to Stay Consistent' },
];

export type ClassicEpisode = Episode & { shortTitle: string };

export function pickClassics(episodes: Episode[]): ClassicEpisode[] {
  return classicsPicks
    .map((pick) => {
      const ep = episodes.find((e) => ('slug' in pick ? e.href.includes(pick.slug) : e.num === pick.num));
      return ep ? { ...ep, shortTitle: pick.short ?? ep.title } : null;
    })
    .filter((ep): ep is ClassicEpisode => Boolean(ep));
}
