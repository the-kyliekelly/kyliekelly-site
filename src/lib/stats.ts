// Live podcast numbers for the homepage and podcast page.
//
// Total downloads and each episode's plays are read from Buzzsprout every time the site is built (and
// the site rebuilds whenever a new episode is published). That needs Buzzsprout's API token in the
// Vercel environment variable BUZZSPROUT_API_TOKEN. Without it, or if Buzzsprout cannot be reached,
// the last known figure below is shown and the Top Episodes use the hand-picked list on the podcast
// page, so the page never breaks.

const PODCAST_ID = '2065148'; // The Email Growth Show on Buzzsprout
const FALLBACK_DOWNLOADS = 54000;

export interface Downloads {
  /** Exact total when live, a rounded last-known figure otherwise. */
  value: number;
  /** True when the number came straight from Buzzsprout. Show it exactly, with no "+". */
  live: boolean;
}

export interface PodcastStats {
  downloads: Downloads;
  /** Total plays per episode number, empty when Buzzsprout could not be reached. */
  plays: Map<number, number>;
}

let cached: Promise<PodcastStats> | null = null;

async function load(): Promise<PodcastStats> {
  const fallback: PodcastStats = { downloads: { value: FALLBACK_DOWNLOADS, live: false }, plays: new Map() };
  const raw = import.meta.env.BUZZSPROUT_API_TOKEN ?? (typeof process !== 'undefined' ? process.env.BUZZSPROUT_API_TOKEN : undefined);
  // Pasted tokens often carry a stray space or line break, which would break the request header.
  const token = typeof raw === 'string' ? raw.trim() : '';
  if (!token) {
    console.warn('[stats] BUZZSPROUT_API_TOKEN is not set; using the last known downloads figure.');
    return fallback;
  }

  try {
    const res = await fetch(`https://www.buzzsprout.com/api/${PODCAST_ID}/episodes.json`, {
      headers: { Authorization: `Token token=${token}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn(`[stats] Buzzsprout answered ${res.status}; using the last known downloads figure.`);
      return fallback;
    }
    const episodes: Array<{ episode_number?: number | null; total_plays?: number }> = await res.json();
    const plays = new Map<number, number>();
    let total = 0;
    for (const ep of episodes) {
      const n = Number(ep.total_plays) || 0;
      total += n;
      if (ep.episode_number) plays.set(Number(ep.episode_number), n);
    }
    if (!total) {
      console.warn(`[stats] Buzzsprout returned ${episodes.length} episodes with no plays; using the last known downloads figure.`);
      return fallback;
    }
    console.log(`[stats] Buzzsprout: ${episodes.length} episodes, ${total} total plays.`);
    return { downloads: { value: total, live: true }, plays };
  } catch (err) {
    console.warn(`[stats] Could not reach Buzzsprout (${err instanceof Error ? err.message : 'unknown error'}); using the last known downloads figure.`);
    return fallback;
  }
}

// One request per build, shared by every page that asks.
export function getPodcastStats(): Promise<PodcastStats> {
  cached ??= load();
  return cached;
}

export async function getDownloads(): Promise<Downloads> {
  return (await getPodcastStats()).downloads;
}
