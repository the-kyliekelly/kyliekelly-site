// The blog's feed (/blog/rss.xml): the newest posts, each with its cover image. Readers, Zapier and Pinterest's
// RSS auto-publish can pick new posts up from here. Podcast episodes have their own feed in Buzzsprout.
import type { APIRoute } from 'astro';
import posts from '../../data/blog-posts.json';
import { blogCovers } from '../../lib/blog';

const SITE = 'https://kyliekelly.com';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&[#\w]+;/g, ' ').replace(/\s+/g, ' ').trim();

export const GET: APIRoute = () => {
  const items = posts
    .filter((p) => p.categories.includes(35) && blogCovers[p.slug])
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .map((p) => {
      const url = `${SITE}/${p.slug}/`;
      const cover = blogCovers[p.slug].image;
      const image = cover ? `${SITE}${cover}` : '';
      const type = image.endsWith('.png') ? 'image/png' : 'image/jpeg';
      return `    <item>
      <title>${esc(p.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      <category>${esc(blogCovers[p.slug].topic)}</category>
      <description>${esc(plain(p.excerpt).slice(0, 300))}</description>
${image ? `      <enclosure url="${image}" length="0" type="${type}" />
      <media:content url="${image}" medium="image" />
` : ''}    </item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>The Kylie Kelly Blog</title>
    <link>${SITE}/blog/</link>
    <atom:link href="${SITE}/blog/rss.xml" rel="self" type="application/rss+xml" />
    <description>Email marketing, visibility and growing a business without living on social media.</description>
    <language>en-au</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
