// Sorts episodes into the topics used by the filters on the episode library.
// The topics and their words live in src/data/topic-rules.json, so they can be edited without
// touching code. An episode is placed by the words in its title first (up to two topics), and by
// its show notes only when the title gives no clue. New episodes are placed the same way
// whenever the site rebuilds.

export interface TopicRules {
  overrides: Record<string, string[]>;
  topics: Array<{ id: string; label: string; words: string[] }>;
}

const countHits = (text: string, words: string[]) => {
  const padded = ` ${text.toLowerCase()} `;
  return words.filter((w) => padded.includes(w)).length;
};

export function topicsFor(num: string, title: string, summary: string, rules: TopicRules): string[] {
  const manual = rules.overrides?.[String(Number(num))];
  if (manual) return manual;

  const byTitle = rules.topics
    .map((t) => ({ id: t.id, score: countHits(title, t.words) }))
    .filter((t) => t.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  if (byTitle.length) return byTitle.map((t) => t.id);

  const byNotes = rules.topics
    .map((t) => ({ id: t.id, score: Math.min(countHits(summary, t.words), 6) }))
    .filter((t) => t.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 1);
  return byNotes.map((t) => t.id);
}
