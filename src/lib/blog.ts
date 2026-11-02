// Shared by the blog index and the blog post page: each post's cover image and topic, and the pieces the
// post page needs (headings with addresses, the "In this post" list, reading time).

// Blog posts are category 35 in src/data/blog-posts.json. A post only appears on /blog (and gets a cover on its own
// page) once it has an entry here: the pin image from public/images/blog and a short topic label.
/** image is the Pinterest pin graphic; a post without one has no pin button, pin block or share image. */
export const blogCovers: Record<string, { image?: string; topic: string }> = {
  'should-i-run-a-black-friday-sale': {
    image: '/images/blog/should-i-run-a-black-friday-sale.jpg',
    topic: 'Launching & selling',
  },
  'welcome-sequence-start-here-email': {
    image: '/images/blog/welcome-sequence-start-here-email.jpg',
    topic: 'Email marketing',
  },
  'interactive-lead-magnet': {
    image: '/images/blog/interactive-lead-magnet.jpg',
    topic: 'List growth',
  },
  'how-long-does-it-take-to-grow-an-online-business': {
    image: '/images/blog/how-long-does-it-take-to-grow-an-online-business.jpg',
    topic: 'Mindset & life',
  },
  'legal-mistakes-business-owners': {
    image: '/images/blog/3-Legal-Mistakes-Most-Creatives-Make-Before-They-Hit-100K-and-How-to-Fix-Them-Fast-683x1024.jpg',
    topic: 'Business',
  },
  'website-planet-feature': {
    image: '/images/blog/Website-Planet-Feature-Kylie-Kelly-Quote-1024x1024.png',
    topic: 'In the press',
  },
  'using-events-to-grow-audience': {
    image: '/images/blog/7-Powerful-Ways-to-Use-Events-to-Build-Your-Brand-and-Attract-the-Right-People-Kylie-Kelly-Pinterest-683x1024.jpg',
    topic: 'Visibility',
  },
  'how-to-blog-for-business': {
    image: '/images/blog/How-to-Use-Blogging-to-Attract-Aligned-Clients-and-Grow-Your-Email-List-Eden-from-Maven-Made-Copy-683x1024.jpg',
    topic: 'Content',
  },
  'email-marketing-myths-2026': {
    topic: 'Email marketing',
  },
  'the-rise-framework-explained-how-to-grow-your-audience-without-burning-out': {
    image: '/images/blog/Kylie-Kelly-Blog-How-To-Grow-Your-Audience-Without-Burning-Out2-791x1024.jpg',
    topic: 'Audience growth',
  },
};

import type { ImageMetadata } from 'astro';
import allPosts from '../data/blog-posts.json';

// Free stock photos in src/assets/blog-banners/pexels (see SOURCES.txt there), in this order. A post's photo is picked
// by its place in the blog (newest first), so neighbouring posts get different photos. The same photo is its banner, its
// card on the blog page and its round thumbnail. To change the mix, change this list.
const bannerNames = ['01-pink-notebooks', '02-mic-on-desk', '03-pink-workspace', '04-hands-typing', '05-pink-stationery', '06-overhead-planner', '07-pink-notebook-laptop', '08-pink-flatlay', '09-phone-over-laptop', '10-phone-email'];
const bannerFiles = import.meta.glob<{ default: ImageMetadata }>('../assets/blog-banners/pexels/*.{jpg,jpeg,png,webp}', { eager: true });
const bannerPhotos = bannerNames
  .map((name) => Object.entries(bannerFiles).find(([path]) => path.includes(`/${name}.`))?.[1].default)
  .filter((img): img is ImageMetadata => Boolean(img));
const newestFirst = allPosts.filter((p) => p.categories.includes(35)).sort((a, b) => +new Date(b.date) - +new Date(a.date));

export function bannerFor(slug: string): ImageMetadata | undefined {
  if (!bannerPhotos.length) return undefined;
  const position = Math.max(0, newestFirst.findIndex((p) => p.slug === slug));
  return bannerPhotos[position % bannerPhotos.length];
}

const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
const decodeEntities = (t: string) =>
  t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
// Plain text of some HTML, with entities turned into real characters (so "&amp;" stays an "&").
const stripTags = (html: string) => decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const slugify = (text: string) =>
  stripTags(text)
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '');

const NOT_A_SECTION = /^(in this (post|episode)\b|what you.ll learn|love this post|save it for later|with special guest|listen to|links? mentioned|about the (author|blogger)|about [a-z]+$)/i;

export interface BlogToc {
  id: string;
  title: string;
  level: 2 | 3;
}

/**
 * Gives every h2 and h3 an id (keeping any it already has), then splits the post at its first h2:
 * the intro, and everything from there on. The "In this post" list goes between the two, and is plain links to
 * the headings. No script, so search and AI crawlers read it as it is.
 */
export function prepareBlogHtml(source: string): { intro: string; rest: string; cta: string; toc: BlogToc[]; words: number } {
  // The closing call to action (a <div class="post-cta">) is shown full width under the article, not inside it.
  const cta = source.match(/<div class="post-cta">[\s\S]*?<\/div>/)?.[0] ?? '';
  const html = cta ? source.replace(cta, '') : source;
  // Older posts open their list of takeaways with an "In this post, you'll learn:" heading and a plain list. Show it the
  // same way as the newer posts: a "What you'll learn in this post" title over a list with plus signs.
  const learnBlock = /<h2[^>]*>(?:(?!<\/h2>)[\s\S])*in this post,? you.ll learn(?:(?!<\/h2>)[\s\S])*<\/h2>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i;
  const withLearn = html.replace(learnBlock, (_m, items: string) => `<div class="post-learn"><p class="post-learn-title">What you'll learn in this post</p><ul>${items}</ul></div>`);
  const used = new Set<string>();
  const toc: BlogToc[] = [];
  const withIds = withLearn.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (whole, level: string, attrs: string, inner: string) => {
    const title = stripTags(inner);
    if (!title) return whole;
    let id = attrs.match(/\sid="([^"]+)"/)?.[1];
    if (!id) {
      const base = slugify(title) || `section-${toc.length + 1}`;
      id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    }
    used.add(id);
    toc.push({ id, title, level: Number(level) as 2 | 3 });
    return attrs.match(/\sid="/) ? whole : `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
  const firstH2 = withIds.search(/<h2[\s>]/i);
  const h2Count = toc.filter((t) => t.level === 2).length;
  // The list shows the h2 headings; the h3s join it only when there are more than 8 h2s.
  // Labels left over from the old podcast-style posts ("In this post, you'll learn", "Love this post? Save it for later") are not sections.
  const shown = toc.filter((t) => (t.level === 2 || h2Count > 8) && !NOT_A_SECTION.test(t.title));
  return {
    intro: firstH2 === -1 ? withIds : withIds.slice(0, firstH2),
    rest: firstH2 === -1 ? '' : withIds.slice(firstH2),
    cta,
    toc: shown.filter((t) => t.level === 2).length >= 2 ? shown : [],
    words: stripTags(withIds).split(' ').filter(Boolean).length,
  };
}
