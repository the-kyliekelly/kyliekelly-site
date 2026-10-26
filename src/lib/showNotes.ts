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
  /** The guest's photo from the old write-up, used when there is no cropped headshot for them. */
  guestImage: string | null;
  cta: { eyebrow: string; headline: string; text: string; label: string; href: string } | null;
  pin: string | null;
  transcript: Array<{ time: string; speaker?: string; text: string }>;
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
  const statLine = [...html.matchAll(/<p[^>]*>\s*(?:EP\b|EPISODE\b|THE EMAIL GROWTH SHOW)[\s\S]*?<\/p>/gi)].find((m) => (m.index ?? 0) < 2500);
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

  // Transcript: "[00:00:20] text" or "Speaker Name [00:00:20]: text"; a paragraph with no time carries on from the last
  const transcript: ParsedNotes['transcript'] = [];
  const details = html.match(/<details[\s\S]*?<\/details>/);
  if (details) {
    for (const m of details[0].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
      const t = stripTags(m[1].replace(/<br\s*\/?>/gi, ' '));
      if (!t) continue;
      const tm = t.match(/^(?:([A-Za-z][\w .'’-]{0,40}?)\s*)?\[(\d\d:\d\d:\d\d)\]:?\s*([\s\S]*)$/);
      if (tm) {
        transcript.push({ time: tm[2], speaker: tm[1]?.trim() || undefined, text: tm[3].replace(/\s*\[\d\d:\d\d:\d\d\]\s*/g, ' ').trim() });
      } else if (transcript.length) {
        transcript[transcript.length - 1].text += ` ${t}`;
      }
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
  let guestImage: string | null = null;
  for (const part of rest.split(/(?=<h2)/)) {
    const h = part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
    if (!h) continue;
    const title = stripTags(h[1]);
    const body = part.replace(h[0], '').trim();
    if (/^listen to this episode/i.test(title)) continue; // the player is shown separately
    if (/^(feat\.?|featuring)\b/i.test(title)) continue; // a guest credit line, shown in the hero instead
    const section = { id: slugify(title), title, html: body };
    if (/^guest spotlight/i.test(title)) {
      guestImage = body.match(/<img[^>]*src="([^"]+)"/i)?.[1] ?? null;
      section.html = body.replace(/<figure[\s\S]*?<\/figure>/gi, '').replace(/<img[^>]*>/gi, '').trim();
      guestSection = section;
    }
    else sections.push(section);
  }

  // Offer blocks written as headings (a short section with a link, usually first or last, or titled "Ready to…" /
  // "Your next step…"): show them as the call to action instead of as chapters of the episode.
  const isPromo = (sec: NotesSection, i: number) => {
    const text = stripTags(sec.html);
    const hasLink = /<a\s/i.test(sec.html);
    const titled = /^(?:\p{Extended_Pictographic}|ready\b|your next step|a (?:grounded|supportive|simple)\b|need someone|let.?s build|it.?s time to|want to know how)/iu.test(sec.title);
    return hasLink && text.length < 700 && (titled || i === 0 || i === sections.length - 1);
  };
  const promos = sections.filter(isPromo);
  const body = sections.filter((sec, i) => !isPromo(sec, i));
  if (!cta && promos.length) {
    const sec = promos[0];
    const a = sec.html.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const text = stripTags(sec.html.replace(/<a[\s\S]*?<\/a>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (a) {
      cta = {
        eyebrow: 'your next step…',
        headline: sec.title.replace(/^\p{Extended_Pictographic}+\s*/u, '').replace(/\s*\[[^\]]*\]/g, '').trim(),
        text: text.length > 260 ? `${text.slice(0, 257).replace(/\s+\S*$/, '')}…` : text,
        label: /^(click here|here|link|read more)$/i.test(stripTags(a[2])) ? 'Find out more →' : `${stripTags(a[2])} →`,
        href: decode(a[1]),
      };
    }
  }

  return { intro, guestUrl, player, links, takeaways, sections: body, guestSection, guestImage, cta, pin, transcript };
}

// ---------------------------------------------------------------------------------------------
// Pages made from a write-up that has no entry in src/data/show-notes.json

/** True for write-ups in the standard format (links box, "what you'll learn", transcript). */
export function isStructuredWriteUp(html: string): boolean {
  return /<details/i.test(html) && /LINKS MENTIONED|LEARN IN THIS EPISODE/i.test(html);
}

/**
 * The "About this episode" box: the opening paragraph, or the first few if the opener is only a line,
 * cut at a sentence end. `used` is how many paragraphs it took, so the rest can follow as the intro.
 */
export function summariseIntro(paragraphs: string[], fallback: string) {
  let used = 0;
  let first = '';
  for (const para of paragraphs) {
    first += `${first ? ' ' : ''}${stripTags(para.replace(/<br\s*\/?>/gi, ' '))}`;
    used += 1;
    if (first.length >= 80) break;
  }
  if (!first) first = fallback;
  const sentences = first.match(/[^.!?]+[.!?]+["”’']?(\s|$)/g) ?? [first];
  let quickAnswer = '';
  for (const sentence of sentences) {
    if ((quickAnswer + sentence).length > 340 && quickAnswer) break;
    quickAnswer += sentence;
  }
  quickAnswer = (quickAnswer || first).trim();
  const metaDescription = quickAnswer.length > 155 ? `${quickAnswer.slice(0, 152).replace(/\s+\S*$/, '')}…` : quickAnswer;
  return { quickAnswer, metaDescription, used };
}

/** Builds the full-version page for a standard write-up, using the opening of the write-up itself. */
export function autoFullPage(html: string, title: string) {
  const notes = parseShowNotes(html);
  const introParas = [...notes.intro.matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map((m) => m[0]);
  // If the opening is only a line or two, borrow the start of the first section so the box says something useful.
  const firstSection = [...(notes.sections[0]?.html ?? '').matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map((m) => m[0]);
  const { quickAnswer, metaDescription, used } = summariseIntro([...introParas, ...firstSection], title);
  notes.intro = introParas.slice(Math.min(used, introParas.length)).join('');
  return {
    notes,
    extra: {
      level: 'full' as const,
      quickAnswer,
      quickAnswerLabel: 'About this episode',
      metaDescription,
      keyMoments: [] as Array<{ time: string; label: string }>,
      faqs: [] as Array<{ q: string; a: string }>,
    },
  };
}
