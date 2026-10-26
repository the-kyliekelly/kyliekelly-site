// Builds a show notes page for an episode that has no write-up of its own, from the show notes
// written in Buzzsprout. The notes follow a pattern ("We chat about", "About <guest>", "Connect with
// <guest>", "Links mentioned", then Kylie's usual promo and links), so they can be split into the
// same parts the show notes template uses. Nothing is added or invented: the first paragraph becomes
// the "About this episode" box, and the same promo block that ends every episode is left out.
import type { Episode } from './episodes';
import type { ParsedNotes } from './showNotes';

const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const plain = (s: string) => decode(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// Keep only simple formatting and links; every link opens in a new tab.
const clean = (s: string) =>
  s
    .replace(/<(?!\/?(?:a|b|strong|em|i)\b)[^>]+>/gi, '')
    .replace(/<a\s+[^>]*?href="([^"]*)"[^>]*>/gi, '<a href="$1" target="_blank" rel="noopener">')
    .replace(/<(b|strong|em|i)>\s*<\/\1>/gi, '')
    .trim();

const toParagraphs = (html: string): string[] =>
  clean(
    html
      .replace(/<ul[\s\S]*?<\/ul>/gi, '')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
  )
    .split(/\n{2,}/)
    .map((p) => p.trim().replace(/\n/g, '<br>'))
    .filter((p) => plain(p).length > 1);

const toLines = (html: string): string[] =>
  clean(html.replace(/<\/?(?:p|ul)[^>]*>/gi, '\n').replace(/<\/li>/gi, '\n').replace(/<li[^>]*>/gi, '').replace(/<br\s*\/?>/gi, '\n'))
    .split('\n')
    .map((l) => l.replace(/^\s*(?:→|•|-|\*)\s*/, '').trim())
    .filter((l) => plain(l).length > 1);

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const MARKER =
  /<b>\s*((?:what you.ll learn|we chat about|i chat about|we talk about|i talk about)[^<:]*|about [^<:]{2,40}|connect with [^<:]{2,40}|links mentioned|mentioned links|tools mentioned|resources[^<:]*)\s*:?\s*<\/b>\s*:?/gi;

export interface FeedPage {
  notes: ParsedNotes;
  extra: {
    level: 'simple';
    quickAnswer: string;
    quickAnswerLabel: string;
    metaDescription: string;
    keyMoments: [];
    faqs: [];
  };
}

export function parseFeedNotes(ep: Episode): FeedPage {
  let html = (ep.notesHtml ?? '').replace(/href='([^']*)'/g, 'href="$1"');

  // Drop the promo and links block that ends every episode, and empty paragraphs.
  const dropPara = (test: RegExp) => {
    html = html.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*<\/p>/gi, (para) => (test.test(plain(para)) ? '' : para));
  };
  dropPara(/find colab/i);
  dropPara(/ready to grow your business without social media/i);
  dropPara(/^→?\s*digital shop/i);
  dropPara(/loving the show\?/i);
  html = html.replace(/<p[^>]*>(?:\s|<br\s*\/?>)*<\/p>/gi, '');

  // Split at the headings
  const marks = [...html.matchAll(MARKER)];
  const pre = marks.length ? html.slice(0, marks[0].index) : html;
  const sections = marks.map((m, i) => ({
    label: plain(m[1]).toLowerCase(),
    body: html.slice((m.index ?? 0) + m[0].length, marks[i + 1]?.index ?? html.length),
  }));

  const introParas = toParagraphs(pre);
  let takeaways: string[] = [];
  let guestBio: string[] = [];
  let guestLines: string[] = [];
  let guestName = '';
  let links: string[] = [];

  for (const s of sections) {
    if (/(learn|chat about|talk about)/.test(s.label)) {
      takeaways = [...s.body.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => plain(m[1])).filter(Boolean);
      // Anything written after the list, in the same section, reads as part of the intro.
      introParas.push(...toParagraphs(s.body.replace(/<ul[\s\S]*?<\/ul>/gi, '')));
    } else if (s.label.startsWith('about ')) {
      const who = titleCase(s.label.replace(/^about /, '').trim());
      if (who.toLowerCase() === 'kylie') continue;
      guestName = guestName || who;
      guestBio.push(...toParagraphs(s.body));
    } else if (s.label.startsWith('connect with')) {
      guestLines.push(...toLines(s.body));
    } else {
      links.push(...toLines(s.body));
    }
  }

  // The "About this episode" box: the opening paragraph, or the first few if the opener is only a line.
  let used = 0;
  let first = '';
  for (const para of introParas) {
    first += `${first ? ' ' : ''}${plain(para)}`;
    used += 1;
    if (first.length >= 80) break;
  }
  if (!first) first = ep.title;
  const sentences = first.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [first];
  let quickAnswer = '';
  for (const sentence of sentences) {
    if ((quickAnswer + sentence).length > 340 && quickAnswer) break;
    quickAnswer += sentence;
  }
  quickAnswer = (quickAnswer || first).trim();
  const metaDescription = quickAnswer.length > 155 ? `${quickAnswer.slice(0, 152).replace(/\s+\S*$/, '')}…` : quickAnswer;

  const name = ep.guest ?? guestName;
  const guestHtml = [...guestBio.map((p) => `<p>${p}</p>`), ...guestLines.map((l) => `<p>${l}</p>`)].join('');

  return {
    notes: {
      intro: introParas.slice(used).map((p) => `<p>${p}</p>`).join(''),
      guestUrl: null,
      player:
        ep.buzzId && ep.listenPage
          ? { id: ep.buzzId, src: `${ep.listenPage}.js?container_id=buzzsprout-player-${ep.buzzId}&player=small` }
          : null,
      links,
      takeaways,
      sections: [],
      guestSection: guestHtml ? { id: 'guest', title: `About ${name}`, html: guestHtml } : null,
      cta: null,
      pin: null,
      transcript: [],
    },
    extra: {
      level: 'simple',
      quickAnswer,
      quickAnswerLabel: 'About this episode',
      metaDescription,
      keyMoments: [],
      faqs: [],
    },
  };
}
