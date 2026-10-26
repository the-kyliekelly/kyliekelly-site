// Splits an episode write-up (the HTML your episode skill produces) into its parts, so the show notes
// template can lay them out properly: intro, player, links mentioned, "what you'll learn", the
// numbered sections, the call to action, the Pinterest pin and the timestamped transcript.
// It only reads the HTML. Nothing is added or invented.

export interface NotesSection {
  id: string;
  title: string;
  html: string;
}

export interface ParsedNotes {
  intro: string;
  guestUrl: string | null;
  player: { id: string; src: string } | null;
  links: string[];
  takeaways: string[];
  sections: NotesSection[];
  guestSection: NotesSection | null;
  cta: { eyebrow: string; headline: string; text: string; label: string; href: string } | null;
  pin: string | null;
  transcript: Array<{ time: string; text: string }>;
}

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const stripTags = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
export const slugify = (s: string) =>
  stripTags(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

// Fixes the odd link that slips into a write-up: placeholder addresses, a stray "]", a missing https:.
function tidyLinks(html: string): string {
  return html.replace(/<a\s+([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g, (_m, pre, href, post, text) => {
    let url = href.trim();
    const label = stripTags(text);
    if (url === '[URL]' || url === '') url = /^https?:\/\//.test(label) ? label : /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(label) ? `https://${label}` : '';
    url = url.replace(/\]+$/, '');
    if (url.startsWith('//')) url = `https:${url}`;
    if (!url) return text;
    return `<a ${pre}href="${url}"${post}>${text}</a>`;
  });
}

export function parseShowNotes(raw: string): ParsedNotes {
  let html = raw.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<div style="height:\d+px"[^>]*class="wp-block-spacer"><\/div>/g, '').replace(/<hr[^>]*\/?>/g, '');

  // The "EP 262 · WITH NAME · 32 MIN LISTEN" line: keep only the guest's website, if there is one.
  let guestUrl: string | null = null;
  const statLine = html.match(/^\s*<p[^>]*>(?:EP\b|THE EMAIL GROWTH SHOW)[\s\S]*?<\/p>/i);
  if (statLine) {
    guestUrl = statLine[0].match(/href="([^"]+)"/)?.[1] ?? null;
    html = html.replace(statLine[0], '');
  }

  // Audio player
  let player: ParsedNotes['player'] = null;
  const playerMatch = html.match(/<div id="buzzsprout-player-(\d+)"><\/div>\s*<script[^>]*src="([^"]+)"[^>]*><\/script>/);
  if (playerMatch) {
    player = { id: playerMatch[1], src: decode(playerMatch[2]) };
    html = html.replace(playerMatch[0], '');
  }

  // Links mentioned
  let links: string[] = [];
  const linksBox = html.match(/<div style="border:1\.5px solid[^>]*>([\s\S]*?)<\/div>/);
  if (linksBox) {
    links = [...linksBox[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
      .map((m) => m[1].replace(/^\s*→\s*/, '').trim())
      .filter((l) => l && !/^LINKS MENTIONED/i.test(stripTags(l)));
    links = links.map(tidyLinks);
    html = html.replace(linksBox[0], '');
  }

  // What you'll learn
  let takeaways: string[] = [];
  const learnBox = html.match(/<div style="background:#f5f4f2[^>]*>([\s\S]*?)<\/div>/);
  if (learnBox) {
    takeaways = [...learnBox[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)]
      .map((m) => stripTags(m[1]).replace(/^✅\s*/, ''))
      .filter((t) => t && !/LEARN IN THIS EPISODE/i.test(t));
    html = html.replace(learnBox[0], '');
  }

  // Call to action
  let cta: ParsedNotes['cta'] = null;
  const ctaBox = html.match(/<div style="background:#1a1a1a[^>]*>([\s\S]*?<\/a>)\s*<\/div>/);
  if (ctaBox) {
    const ps = [...ctaBox[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => stripTags(m[1]));
    const a = ctaBox[1].match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (ps.length >= 3 && a) cta = { eyebrow: ps[0], headline: ps[1], text: ps[2], label: stripTags(a[2]), href: decode(a[1]) };
    html = html.replace(ctaBox[0], '');
  }

  // Transcript
  const transcript: ParsedNotes['transcript'] = [];
  const details = html.match(/<details[\s\S]*?<\/details>/);
  if (details) {
    for (const m of details[0].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
      const t = stripTags(m[1]);
      const tm = t.match(/^\[(\d\d:\d\d:\d\d)\]\s*([\s\S]*)$/);
      if (tm) transcript.push({ time: tm[1], text: tm[2].replace(/\s*\[\d\d:\d\d:\d\d\]\s*/g, ' ').trim() });
    }
    html = html.replace(details[0], '');
  }

  // Pinterest pin ("Love this post? Save it for later")
  let pin: string | null = null;
  const pinHeading = html.match(/<h2[^>]*>(?:(?!<\/h2>)[\s\S])*Love this post[\s\S]*?<\/h2>/i);
  if (pinHeading) {
    html = html.replace(pinHeading[0], '');
    const fig = html.match(/<figure[\s\S]*?<\/figure>/);
    if (fig) {
      pin = fig[0].match(/src="([^"]+)"/)?.[1] ?? null;
      html = html.replace(fig[0], '');
    }
  }

  // Everything left: intro (before the first heading) and the numbered sections
  html = tidyLinks(html.replace(/\sstyle="[^"]*"/g, '').replace(/\sclass="[^"]*"/g, '')).trim();
  const firstH2 = html.search(/<h2/);
  const intro = firstH2 === -1 ? html : html.slice(0, firstH2).trim();
  const rest = firstH2 === -1 ? '' : html.slice(firstH2);
  const sections: NotesSection[] = [];
  let guestSection: NotesSection | null = null;
  for (const part of rest.split(/(?=<h2)/)) {
    const h = part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    if (!h) continue;
    const title = stripTags(h[1]);
    const body = part.replace(h[0], '').trim();
    const section = { id: slugify(title), title, html: body };
    if (/^guest spotlight/i.test(title)) guestSection = section;
    else sections.push(section);
  }

  return { intro, guestUrl, player, links, takeaways, sections, guestSection, cta, pin, transcript };
}
