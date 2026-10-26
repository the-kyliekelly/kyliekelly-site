// Episodes for the homepage and the podcast page.
// Read from the podcast feed at build time, with the episode library as a backup.
import episodePosts from '../data/blog-posts.json';
import topicRules from '../data/topic-rules.json';
import { guestFromTitle } from './guests';
import { topicsFor, type TopicRules } from './topics';

const handBuiltEpisodes = new Set([
  'low-lift-email-list-growth',
  'claude-claude-code-chrome-extension-delegate',
  'plan-rest-of-year-without-burning-out',
]);
const knownEpisodePages = new Set(episodePosts.map((p) => p.slug));

// Episode number -> the episode's own page on this site, from the episode write-ups.
const siteHrefByNumber = new Map<number, string>();
for (const p of episodePosts) {
  const n =
    p.excerpt.match(/EP\s*(\d+)/i)?.[1] ??
    p.title.match(/\[?Ep\.?\s*#?(\d+)\]?/i)?.[1] ??
    p.content.match(/EPISODE\s+(\d+)/i)?.[1] ??
    p.content.match(/\bEP\.?\s*#?(\d+)\b/i)?.[1];
  if (n && !p.categories.includes(35)) {
    siteHrefByNumber.set(Number(n), handBuiltEpisodes.has(p.slug) ? `/podcast/episodes/${p.slug}/` : `/${p.slug}/`);
  }
}

const decodeText = (text: string) =>
  text
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
const feedTag = (item: string, name: string) => {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeText(m[1]) : null;
};
const formatDate = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });

async function loadFeedEpisodes() {
  try {
    const res = await fetch('https://feeds.buzzsprout.com/2065148.rss', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const xml = await res.text();
    return (xml.match(/<item>[\s\S]*?<\/item>/g) ?? [])
      .map((item: string) => {
        const num = feedTag(item, 'itunes:episode');
        if (!num) return null;
        const title = (feedTag(item, 'title') ?? '').replace(/\s*\[Ep\.?\s*\d+\]\s*$/i, '');
        const rawDuration = feedTag(item, 'itunes:duration') ?? '';
        const seconds = rawDuration.includes(':')
          ? rawDuration.split(':').reduce((acc, part) => acc * 60 + Number(part), 0)
          : Number(rawDuration);
        const summary = (feedTag(item, 'description') ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
        const siteSlug = (feedTag(item, 'link') ?? '').match(/kyliekelly\.com\/([^/]+)\/?$/)?.[1];
        const audio = item.match(/<enclosure[^>]*url="([^"]+)"/)?.[1] ?? '';
        const listenPage = audio.replace(/\.(mp3|m4a)(\?.*)?$/, '');
        return {
          num,
          mins: seconds ? String(Math.round(seconds / 60)) : null,
          seconds: seconds || null,
          title,
          summary,
          iso: feedTag(item, 'pubDate'),
          date: formatDate(feedTag(item, 'pubDate')),
          // The episode's own page on this site: by the address in the feed, or failing that by episode number.
          href: siteSlug && knownEpisodePages.has(siteSlug)
            ? (handBuiltEpisodes.has(siteSlug) ? `/podcast/episodes/${siteSlug}/` : `/${siteSlug}/`)
            : siteHrefByNumber.get(Number(num)) ?? listenPage,
        };
      })
      .filter((e) => e && e.href);
  } catch {
    return [];
  }
}

const libraryEpisodes = episodePosts
  .map((p) => {
    const ep = p.excerpt.match(/EP\s*(\d+)/i);
    if (!ep) return null;
    const mins = p.excerpt.match(/(\d+)\s*MIN\s*LISTEN/i);
    return {
      num: ep[1],
      mins: mins ? mins[1] : null,
      seconds: mins ? Number(mins[1]) * 60 : null,
      title: p.title,
      summary: String(p.excerpt ?? ''),
      iso: p.date,
      date: formatDate(p.date),
      href: handBuiltEpisodes.has(p.slug) ? `/podcast/episodes/${p.slug}/` : `/${p.slug}/`,
    };
  })
  .filter(Boolean);


export interface Episode {
  num: string;
  mins: string | null;
  seconds: number | null;
  title: string;
  /** Plain-text show notes, used for sorting episodes into topics. */
  summary: string;
  /** The guest's name when the title names one, otherwise null (a solo episode). */
  guest: string | null;
  /** Topic ids from src/data/topic-rules.json. */
  topics: string[];
  iso: string;
  date: string;
  href: string;
}

// Newest first.
export async function getEpisodes(): Promise<Episode[]> {
  const feedEpisodes: Episode[] = await loadFeedEpisodes();
  const list = (feedEpisodes.length ? feedEpisodes : libraryEpisodes) as Array<Omit<Episode, 'guest' | 'topics'>>;
  return list
    .map((ep) => ({
      ...ep,
      guest: guestFromTitle(ep.title),
      topics: topicsFor(ep.num, ep.title, ep.summary, topicRules as TopicRules),
    }))
    .sort((x, y) => Number(y.num) - Number(x.num));
}
