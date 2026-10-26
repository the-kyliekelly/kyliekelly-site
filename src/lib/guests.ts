// Works out who the guest is from an episode title such as
// "How To Write Authentic Email Copy That Sounds Like You with Marisa Corcoran [Ep 152]".
// Returns null for solo episodes, or when the words after "with" are a topic rather than a person
// (for example "...Consistent With Your Email Marketing").

// Words that mean the text after "with" is not a person's name.
const NOT_A_NAME = new Set([
  'your', 'my', 'the', 'a', 'an', 'in', 'on', 'of', 'for', 'and', 'to', 'our', 'you', 'me', 'us',
  'email', 'marketing', 'business', 'claude', 'code', 'chrome', 'chatgpt', 'ai', 'kit', 'flodesk',
  'canva', 'pinterest', 'instagram', 'google', 'youtube', 'seo', 'big', 'deal', 'energy', 'zapier',
  'notion', 'meta', 'facebook', 'tiktok', 'linkedin', 'skool', 'podcast', 'list', 'sales', 'clients',
]);

const SOLO_NAMES = new Set(['kylie kelly']);

export function guestFromTitle(title: string): string | null {
  const cleaned = title
    .replace(/\s*\[Ep\.?\s*#?\d+\]\s*$/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  const m = cleaned.match(/\b[Ww]ith\s+([A-Z][A-Za-z'’.\-]+(?:\s+[A-Z][A-Za-z'’.\-]+){1,3})(?:\s+from\b.*)?$/);
  if (!m) return null;
  const name = m[1].replace(/\s+/g, ' ').trim();
  const words = name.split(' ');
  if (words.some((w) => NOT_A_NAME.has(w.toLowerCase()))) return null;
  if (SOLO_NAMES.has(name.toLowerCase())) return null;
  return name;
}
