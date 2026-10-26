// Splits an episode write-up (the HTML your episode skill produces) into its parts, so the show notes
// template can lay them out properly: intro, player, links mentioned, "what you'll learn", the
// numbered sections, the call to action, the Pinterest pin and the timestamped transcript.
// It only reads the HTML. Nothing is added or invented.

import pageOverrides from '../data/page-overrides.json';

export interface PageOverride {
  quickAnswer?: string;
  metaDescription?: string;
  cta?: { eyebrow: string; headline: string; text: string; label: string; href: string };
  replaceLinks?: Array<{ match: string; html: string }>;
  cutHtml?: Array<{ find: string; replace?: string }>;
  highlights?: string[];
  pullQuotes?: string[];
}
export const overridesFor = (slug?: string): PageOverride => ((slug && (pageOverrides as Record<string, unknown>)[slug]) as PageOverride) || {};

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

// The kinds of block that make up an intro, in order.
const BLOCK = /<p[^>]*>[\s\S]*?<\/p>|<(?:ul|ol)[^>]*>[\s\S]*?<\/(?:ul|ol)>|<h[3-6][^>]*>[\s\S]*?<\/h[3-6]>|<blockquote[\s\S]*?<\/blockquote>/g;

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

// Transcript paragraphs: "[00:00:20] text" or "Speaker Name [00:00:20]: text"; a paragraph with no time carries on from the last.
function parseTranscript(chunk: string): ParsedNotes['transcript'] {
  const out: ParsedNotes['transcript'] = [];
  for (const m of chunk.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) {
    const t = stripTags(m[1].replace(/<br\s*\/?>/gi, ' '));
    if (!t) continue;
    const tm = t.match(/^(?:([A-Za-z][\w .'’-]{0,40}?)\s*)?\[(\d\d:\d\d:\d\d)\]:?\s*([\s\S]*)$/);
    if (tm) {
      out.push({ time: tm[2], speaker: tm[1]?.trim() || undefined, text: tm[3].replace(/\s*\[\d\d:\d\d:\d\d\]\s*/g, ' ').trim() });
    } else if (out.length) {
      out[out.length - 1].text += ` ${t}`;
    }
  }
  return out;
}


// ---------------------------------------------------------------------------------------------
// Making long copy easier to read

// The Start Here template now lives in Flodesk (Kylie has left Kit). Old write-ups still point at the Kit address.
const ADDRESS_FIXES: Array<[RegExp, string]> = [[/https?:\/\/kyliekelly\.kit\.com\/starthere/g, 'https://kyliekelly.myflodesk.com/starthere']];

// A "how I can help" pitch near the start or end of an old write-up. The one-sheet sign-up and the call to action
// have replaced these, so they are left out.
const OFFER_PITCH = /book (?:a|your) (?:\$?\d+ )?business breakthrough|business breakthrough (?:audit|session)|here.s how i can (?:help|support)|how i can support you/i;

// Offers Kylie no longer sells. Old write-ups still end with "join The Email Growth Club" style pitches; the free
// Skool community call to action replaces them. Past-tense mentions ("my members in the Club") are left alone.
const RETIRED_OFFER = /email growth club|emailgrowthclub|headliner|empress|spotlight club/i;
const RETIRED_HREF = /emailgrowthclub|headliner|empress|email-growth-club/i;
const PITCH_WORDS = /\b(?:join(?:ing)?|come (?:and )?join|check out|hop into|sign up|click here|learn more|find out more|more info|apply|waitlist|book a)\b|\$27 a month|inside (?:the )?(?:email growth club|headliner mastermind),?\s+(?:we|i|you)\b|support you inside|what.s waiting inside|(?:what we.re all about|what we (?:do|focus on)|what we.re working on) inside/i;
// Words that are a pitch on their own once the paragraph around them is about a retired offer.
const STRONG_PITCH = /click here|\$27 a month|more info|learn more|find out more|waitlist|\bjoin(?:ing)?\b/i;
const NOT_A_PITCH = /for (?:example|instance)|try something like|let.s say|imagine (?:instead )?you|you could say|you might say|ways i can help you/i;
// Episodes that are about a retired offer itself: left as they are.
const KEEP_AS_IS = new Set(['grow-your-email-list-without-social-media-inside-the-email-growth-club']);
const SKOOL_CTA = {
  eyebrow: 'your next step…',
  headline: 'Join Email Marketing Skool',
  text: 'It’s my free community for business owners who want to grow their audience, build their email list and create a business that doesn’t rely on feeding the social media machine every bloody day.',
  label: 'Join for free today →',
  href: 'https://www.skool.com/email-marketing-skool/about',
};
const isRetiredCta = (c: { headline: string; text: string; label: string; href: string }) =>
  RETIRED_OFFER.test(`${c.headline} ${c.text} ${c.label}`) || RETIRED_HREF.test(c.href);

// A sentence that opens a quote which closes in the next sentence is an example being quoted.
const opensQuote = (t: string) => (t.match(/“/g) ?? []).length > (t.match(/”/g) ?? []).length;

// Find CoLab links on show notes pages carry tags, so Find CoLab can see which episode and which spot on the page
// sent each visitor: source = podcast, medium = show-notes, campaign = the episode's address, content = where on the page.
export function tagFindCoLabUrl(url: string, campaign: string, placement: string): string {
  try {
    const u = new URL(url);
    if (!/^(?:www\.)?findcolab\.com$/i.test(u.hostname)) return url;
    u.searchParams.set('utm_source', 'podcast');
    u.searchParams.set('utm_medium', 'show-notes');
    u.searchParams.set('utm_campaign', campaign);
    u.searchParams.set('utm_content', placement);
    return u.toString();
  } catch {
    return url;
  }
}
/** The same, for every Find CoLab link (href="...") inside a piece of HTML. */
export function tagFindCoLab(html: string, campaign: string, placement: string): string {
  return html.replace(/href="(https?:\/\/(?:www\.)?findcolab\.com[^"]*)"/gi, (_, href: string) => `href="${tagFindCoLabUrl(href.replace(/&amp;|&#038;/g, '&'), campaign, placement).replace(/&/g, '&amp;')}"`);
}

/** True for a piece of text that pitches a retired offer (and is not an example of a pitch, in quotes or "for example"). */
function pitchesRetiredOffer(text: string, html: string): boolean {
  const retired = RETIRED_OFFER.test(text) || RETIRED_HREF.test(html.match(/href="[^"]*"/g)?.join(' ') ?? '');
  if (!retired || !PITCH_WORDS.test(text) || NOT_A_PITCH.test(text)) return false;
  if (opensQuote(text)) return false;
  // a pitch quoted as an example ("…come join my Email Growth Club…") is teaching, not a pitch
  return !(text.match(/[“"][^”"]*[”"]/g) ?? []).some((q) => RETIRED_OFFER.test(q));
}

/**
 * Takes out what pitches a retired offer: whole blocks, or just the pitching sentences of a paragraph that also has
 * real writing in it. A "click here" line (or a list) that only followed a pitch goes with it.
 */
function dropRetiredPitches(html: string, slug = ''): { html: string; removed: string[] } {
  const removed: string[] = [];
  let prevRemoved = false;
  let prevColon = false;
  const out = html.replace(BLOCK, (block) => {
    const text = stripTags(block);
    const follows = prevRemoved && ((text.length < 100 && /click here|join|learn more|link|more info|apply|waitlist/i.test(text)) || (/^<(?:ul|ol)/i.test(block) && prevColon));
    let result: string | null = null; // null: remove the whole block
    if (!follows) {
      if (/^<p[\s>]/i.test(block) && text.length < 1500 && !NOT_A_PITCH.test(text)) {
        const open = block.match(/^<p[^>]*>/)![0];
        const inner = block.slice(open.length, -4);
        const sentences = inner.split(/(?<=[.!?…:])(?:\s|<br\s*\/?>)+(?![^<]*>)/);
        const blockRetired = RETIRED_OFFER.test(text) || RETIRED_HREF.test(block.match(/href="[^"]*"/g)?.join(' ') ?? '');
        const kept: string[] = [];
        let drop = false;
        for (const sentence of sentences) {
          const t = stripTags(sentence);
          const pitch = pitchesRetiredOffer(t, sentence) || (blockRetired && STRONG_PITCH.test(t) && !NOT_A_PITCH.test(t) && !opensQuote(t)) || (drop && t.length < 100 && /click here|join|learn more|link|more info|apply|waitlist/i.test(t));
          if (pitch) { drop = true; removed.push(t.slice(0, 110)); } else { drop = false; kept.push(sentence); }
        }
        if (kept.length === sentences.length) result = block;
        else {
          // a "Links mentioned:" lead-in or a bare name left hanging where the pitch was
          while (kept.length && /:$/.test(stripTags(kept[kept.length - 1])) && (RETIRED_OFFER.test(stripTags(kept[kept.length - 1])) || stripTags(kept[kept.length - 1]).length < 90)) kept.pop();
          const joined = kept.join(' ').replace(/(?:<br\s*\/?>\s*)?links mentioned:?\s*$/i, '').trim();
          result = stripTags(joined).replace(/[…\s,.:]/g, '').length >= 25 ? `${open}${joined}</p>` : null;
        }
      } else if (pitchesRetiredOffer(text, block) && text.length < 700) {
        result = null;
        removed.push(text.slice(0, 110));
      } else result = block;
    } else removed.push(text.slice(0, 110));
    prevRemoved = result === null || result !== block;
    prevColon = result === null && /:$/.test(text);
    return result ?? '';
  });
  if (removed.length && process.env.PITCH_DEBUG) console.log(`[pitch] ${slug} :: ${removed.join(' || ')}`);
  return { html: out, removed };
}

const INLINE_TAGS = /<(\/?)(a|strong|em|b|i|mark|span|u)\b[^>]*>/gi;
function tagsBalanced(fragment: string): boolean {
  let depth = 0;
  for (const m of fragment.matchAll(INLINE_TAGS)) depth += m[1] ? -1 : 1;
  return depth === 0;
}

/** Splits one long paragraph, at sentence ends, into paragraphs of a comfortable length. */
function splitLong(inner: string): string[] {
  const text = stripTags(inner);
  if (text.length <= 520) return [inner];
  const middle = text.length / 2;
  let best: { at: number; gap: number } | null = null;
  const sentenceEnd = /[.!?](?:&#8221;|&#8217;|["”’'])?\s+(?=(?:&#8220;|&#8216;|[A-Z“"‘'(]))/g;
  for (const m of inner.matchAll(sentenceEnd)) {
    const at = (m.index ?? 0) + m[0].length;
    const before = inner.slice(0, at);
    if (/\b(?:Mr|Mrs|Ms|Dr|St|vs|e\.g|i\.e|etc)\.\s*$/i.test(before)) continue;
    if (!tagsBalanced(before)) continue;
    const left = stripTags(before).length;
    const right = text.length - left;
    if (left < 170 || right < 170) continue;
    const gap = Math.abs(left - middle);
    if (!best || gap < best.gap) best = { at, gap };
  }
  if (!best) return [inner];
  return [...splitLong(inner.slice(0, best.at).trim()), ...splitLong(inner.slice(best.at).trim())];
}
export function splitLongParagraphs(html: string): string {
  return html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/g, (whole, attrs, inner) => {
    if (/<br/i.test(inner)) return whole;
    return splitLong(inner).map((part) => `<p${attrs}>${part}</p>`).join('');
  });
}

// A phrase copied from the episode, found whatever way the old write-up wrote its quotes, dashes and ampersands.
function phrasePattern(phrase: string): RegExp {
  const esc = phrase
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/[’'‘]/g, "(?:’|'|‘|&#8217;|&#8216;|&#039;|&#x27;)")
    .replace(/[“”"]/g, '(?:“|”|"|&#8220;|&#8221;|&quot;)')
    .replace(/[–—]/g, '(?:–|—|-|&#8211;|&#8212;)')
    .replace(/…/g, '(?:…|&#8230;|\\.\\.\\.)')
    .replace(/&/g, '(?:&amp;|&#038;|&)')
    .replace(/\s+/g, '\\s+');
  return new RegExp(esc);
}

/** Wraps the first appearance of each phrase in a <mark> (the marker highlight). Text only, never inside a tag. */
export function highlightPhrases(html: string, phrases: string[], where = ''): string {
  let parts = html.split(/(<[^>]+>)/);
  for (const phrase of phrases) {
    const re = phrasePattern(phrase);
    let done = false;
    parts = parts.map((part, i) => {
      // split() with a capture group puts the tags at the odd positions
      if (done || i % 2 === 1) return part;
      const m = part.match(re);
      if (!m || m.index === undefined) return part;
      done = true;
      return `${part.slice(0, m.index)}<mark>${m[0]}</mark>${part.slice(m.index + m[0].length)}`;
    });
    if (!done) console.warn(`[highlight] not found${where ? ` in ${where}` : ''}: "${phrase}"`);
  }
  return parts.join('');
}

/** Repeats a sentence from the episode as a pull quote straight after the paragraph it comes from. */
export function addPullQuotes(html: string, quotes: string[], where = ''): string {
  let out = html;
  for (const quote of quotes) {
    const re = phrasePattern(quote);
    let done = false;
    out = out.replace(/<p[^>]*>[\s\S]*?<\/p>/g, (para) => {
      if (done) return para;
      const m = para.match(re);
      if (!m) return para;
      done = true;
      return `${para}<aside class="pull-quote"><p>${m[0]}</p></aside>`;
    });
    if (!done) console.warn(`[pull quote] not found${where ? ` in ${where}` : ''}: "${quote}"`);
  }
  return out;
}

export function parseShowNotes(raw: string, slug?: string): ParsedNotes {
  const override = overridesFor(slug);
  let html = raw.replace(/<!--[\s\S]*?-->/g, '');
  for (const [from, to] of ADDRESS_FIXES) html = html.replace(from, to);
  for (const cut of override.cutHtml ?? []) html = html.replace(new RegExp(cut.find, 'gis'), cut.replace ?? '');
  html = html.replace(/<div style="height:\d+px"[^>]*class="wp-block-spacer"><\/div>/g, '').replace(/<hr[^>]*\/?>/g, '');

  // The "EP 262 · WITH NAME · 32 MIN LISTEN" line: keep only the guest's website, if there is one.
  let guestUrl: string | null = null;
  const statLine = [...html.matchAll(/<p[^>]*>\s*(?:<[^>]+>\s*)*(?:EP\b|EPISODE\b|THE EMAIL GROWTH SHOW)[\s\S]*?<\/p>/gi)].find((m) => (m.index ?? 0) < 2500);
  if (statLine) {
    guestUrl = statLine[0].match(/href="([^"]+)"/)?.[1] ?? null;
    html = html.replace(statLine[0], '');
  }

  html = html.replace(/<h[1-6][^>]*>\s*(?:<[^>]+>\s*)*(?:THE EMAIL GROWTH SHOW\s+)?EPISODE\s+\d+(?:\s|<[^>]+>)*<\/h[1-6]>/gi, '');

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

  // Transcript: folded away in a <details>, or written out at the end under a "Full Transcript" heading
  let transcript: ParsedNotes['transcript'] = [];
  const details = html.match(/<details[\s\S]*?<\/details>/);
  if (details) {
    transcript = parseTranscript(details[0]);
    html = html.replace(details[0], '');
  } else {
    const heading = html.match(/<h2[^>]*>(?:(?!<\/h2>)[\s\S])*full transcript(?:(?!<\/h2>)[\s\S])*<\/h2>/i);
    if (heading && heading.index !== undefined) {
      transcript = parseTranscript(html.slice(heading.index + heading[0].length));
      html = html.slice(0, heading.index);
    }
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

  // The "Feat. <guest>" and "Listen to this episode here" headings are only labels: drop the heading, keep what follows it.
  html = html.replace(/<h2[^>]*>(?:(?!<\/h2>)[\s\S])*?<\/h2>/g, (h) => {
    const t = stripTags(h);
    if (/^(feat\.?|featuring)\b/i.test(t)) {
      guestUrl = guestUrl ?? h.match(/href="([^"]+)"/)?.[1] ?? null;
      return '';
    }
    return /^listen to this episode/i.test(t) ? '' : h;
  });

  // Everything left: intro (before the first heading) and the numbered sections
  html = tidyLinks(html.replace(/\sstyle="[^"]*"/g, '').replace(/\sclass="[^"]*"/g, '')).trim();
  const firstH2 = html.search(/<h2/);
  const intro = firstH2 === -1 ? html : html.slice(0, firstH2).trim();
  const rest = firstH2 === -1 ? '' : html.slice(firstH2);
  // The intro, tidied: drop "TL:DR" and "Episode duration" lines, and lift a plain-paragraph "What you'll learn" list
  const introBlocks = [...intro.matchAll(BLOCK)].map((m) => m[0]);
  const introKept: string[] = [];
  for (let i = 0; i < introBlocks.length; i++) {
    const t = stripTags(introBlocks[i]);
    if ((t.length < 160 && /^(if you want to listen|press play|listen (to|in) |you can listen|to listen)/i.test(t)) || /^tl:?\s*dr:?$/i.test(t) || /^\*+\s*(episode duration|read time|listen time)/i.test(t)) continue;
    if (!takeaways.length && /^(what you.ll learn|in this episode|today we covered|we covered|what we covered)(?: in this episode)?:?$/i.test(t) && introBlocks[i + 1]) {
      const next = introBlocks[i + 1];
      const items = /^<ul/i.test(next)
        ? [...next.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => stripTags(m[1]))
        : next.replace(/<\/?p[^>]*>/g, '').split(/<br\s*\/?>/i).map((x) => stripTags(x).replace(/^[–—•\-✅✔️*]+\s*/u, '')).filter(Boolean);
      // Long, paragraph-length items read better as part of the text than as a short checklist.
      if (items.length && items.reduce((n, x) => n + x.length, 0) / items.length < 170) {
        takeaways = items;
        i += 1;
        continue;
      }
    }
    introKept.push(introBlocks[i]);
  }
  const introClean = introKept.join('');
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
    if (!takeaways.length && /^(what we (covered|cover|chat about|talk about)|what you.ll learn|in this episode)/i.test(title)) {
      const items = [...body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => stripTags(m[1])).filter(Boolean);
      if (items.length) {
        takeaways = items;
        continue;
      }
    }
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
  const isPromo = (sec: NotesSection) => {
    const text = stripTags(sec.html);
    const hasLink = /<a\s/i.test(sec.html);
    const titled = /^(?:\p{Extended_Pictographic}|ready\b|your next (?:step|move)|a (?:grounded|supportive|simple|clear)\b|need someone|let.?s build|it.?s time to|want to know how|want help|step into|come build)/iu.test(sec.title);
    return hasLink && text.length < 700 && titled;
  };
  const promos = sections.filter(isPromo);
  // Offer pitches at the very start or end of the write-up: the call to action and the one-sheet replace them.
  // If the section opens with real writing before the pitch begins, that writing stays.
  const withoutPitch = (sec: NotesSection, i: number): NotesSection | null => {
    if (isPromo(sec)) return null;
    if (i !== 0 && i !== sections.length - 1) return sec;
    const text = stripTags(sec.html);
    if (!(text.length < 800 && /<a\s/i.test(sec.html) && (OFFER_PITCH.test(text) || OFFER_PITCH.test(sec.title)))) return sec;
    if (OFFER_PITCH.test(sec.title)) return null;
    const blocks = sec.html.match(BLOCK) ?? [];
    const first = blocks.findIndex((blk) => OFFER_PITCH.test(stripTags(blk)));
    const keep = first > 0 ? blocks.slice(0, first) : [];
    while (keep.length && /(?::|…|\.\.\.)$/.test(stripTags(keep[keep.length - 1]))) keep.pop(); // a line that only led into the pitch
    const kept = keep.join('');
    return stripTags(kept).length >= 150 ? { ...sec, html: kept } : null;
  };
  const body = sections.map(withoutPitch).filter((sec): sec is NotesSection => sec !== null);
  if (!cta && promos.length) {
    const sec = promos[0];
    const a = sec.html.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const text = stripTags(sec.html.replace(/<a[\s\S]*?<\/a>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (a) {
      cta = {
        eyebrow: 'your next step…',
        headline: sec.title.replace(/^\p{Extended_Pictographic}+\s*/u, '').replace(/\s*\[[^\]]*\]/g, '').trim(),
        text: text.length > 420 ? `${text.slice(0, 417).replace(/\s+\S*$/, '')}…` : text,
        label: /^(click here|here|link|read more)$/i.test(stripTags(a[2])) ? 'Find out more →' : `${stripTags(a[2])} →`,
        href: decode(a[1]),
      };
    }
  }

  // Retired offers: pitches come out, and a retired call to action becomes the free Skool community
  let introNoPitch = introClean;
  let bodyNoPitch = body;
  let pitchesRemoved = 0;
  if (!KEEP_AS_IS.has(slug ?? '')) {
    const cleanedIntro = dropRetiredPitches(introClean, slug);
    introNoPitch = cleanedIntro.html;
    pitchesRemoved += cleanedIntro.removed.length;
    bodyNoPitch = body
      .map((sec) => {
        const r = dropRetiredPitches(sec.html, slug);
        pitchesRemoved += r.removed.length;
        return { ...sec, html: r.html };
      })
      .filter((sec) => stripTags(sec.html).length > 0);
    links = links.filter((l) => !RETIRED_OFFER.test(stripTags(l)) && !RETIRED_HREF.test(l.match(/href="[^"]*"/g)?.join(' ') ?? ''));
    if ((cta && isRetiredCta(cta)) || (!cta && pitchesRemoved)) cta = SKOOL_CTA;
  }

  // Per-episode changes (src/data/page-overrides.json)
  if (override.cta) cta = override.cta;
  for (const swap of override.replaceLinks ?? []) {
    const re = new RegExp(swap.match, 'i');
    links = links.map((l) => (re.test(stripTags(l)) ? swap.html : l));
  }

  // Easier to read: long paragraphs broken up, then the marker highlight and pull quotes chosen for the episode
  let introOut = splitLongParagraphs(introNoPitch);
  const sectionsOut = bodyNoPitch.map((sec) => ({ ...sec, html: splitLongParagraphs(sec.html) }));
  if (override.pullQuotes?.length) {
    introOut = addPullQuotes(introOut, override.pullQuotes.filter((q) => phrasePattern(q).test(introOut)), slug);
    for (const sec of sectionsOut) sec.html = addPullQuotes(sec.html, override.pullQuotes.filter((q) => phrasePattern(q).test(sec.html)), slug);
  }
  if (override.highlights?.length) {
    introOut = highlightPhrases(introOut, override.highlights.filter((q) => phrasePattern(q).test(introOut)), slug);
    for (const sec of sectionsOut) sec.html = highlightPhrases(sec.html, override.highlights.filter((q) => phrasePattern(q).test(sec.html)), slug);
  }

  return { intro: introOut, guestUrl, player, links, takeaways, sections: sectionsOut, guestSection, guestImage, cta, pin, transcript };
}

// ---------------------------------------------------------------------------------------------
// Pages made from a write-up that has no entry in src/data/show-notes.json

/**
 * True for write-ups in the standard format. They have a transcript (folded away, or under a "Full Transcript"
 * heading) or the usual blocks, plus the "Listen to this episode here" player heading or the links /
 * "what you'll learn" boxes.
 */
export function isStructuredWriteUp(html: string): boolean {
  const hasTranscript = /<details/i.test(html) || /<h[1-6][^>]*>(?:(?!<\/h[1-6]>)[\s\S])*full transcript/i.test(html);
  const hasBlocks = /LINKS MENTIONED|LEARN IN THIS EPISODE/i.test(html);
  const hasPlayer = /buzzsprout-player-\d+/.test(html);
  return (hasTranscript || hasBlocks) && hasPlayer;
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
    if (first.length >= 220) break;
  }
  if (!first) first = fallback;
  // Two or three sentences (about 220 to 380 characters), so the box reads as a proper summary
  const sentences = first.match(/[^.!?]+[.!?]+["”’']?(\s|$)/g) ?? [first];
  let quickAnswer = '';
  for (const sentence of sentences) {
    if ((quickAnswer + sentence).length > 380 && quickAnswer) break;
    quickAnswer += sentence;
    if (quickAnswer.length >= 220) break;
  }
  quickAnswer = (quickAnswer || first).trim();
  const metaDescription = quickAnswer.length > 155 ? `${quickAnswer.slice(0, 152).replace(/\s+\S*$/, '')}…` : quickAnswer;
  return { quickAnswer, metaDescription, used };
}

/** Builds the full-version page for a standard write-up, using the opening of the write-up itself. */
export function autoFullPage(html: string, title: string, slug?: string) {
  const notes = parseShowNotes(html, slug);
  const override = overridesFor(slug);
  const blocks = [...notes.intro.matchAll(BLOCK)].map((m) => m[0]);
  const introParas = blocks.filter((b) => /^<p[\s>]/i.test(b));
  // If the opening is only a line or two, borrow the start of the first section so the box says something useful.
  const firstSection = [...(notes.sections[0]?.html ?? '').matchAll(/<p[^>]*>[\s\S]*?<\/p>/g)].map((m) => m[0]);
  const { quickAnswer, metaDescription, used } = summariseIntro([...introParas, ...firstSection], title);
  // The paragraphs the box used come out of the intro; lists, headings and quotes stay where they were.
  let toRemove = override.quickAnswer ? 0 : Math.min(used, introParas.length); // a written-out answer leaves the opening where it is
  notes.intro = blocks.filter((b) => !(toRemove > 0 && /^<p[\s>]/i.test(b) && (toRemove--, true))).join('');
  return {
    notes,
    extra: {
      level: 'full' as const,
      quickAnswer: override.quickAnswer ?? quickAnswer,
      quickAnswerLabel: 'About this episode',
      metaDescription: override.metaDescription ?? metaDescription,
      keyMoments: [] as Array<{ time: string; label: string }>,
      faqs: [] as Array<{ q: string; a: string }>,
    },
  };
}
