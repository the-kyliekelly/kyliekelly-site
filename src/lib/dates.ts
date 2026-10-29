// Episode dates come from the podcast feed with a time zone (for example "Fri, 30 Oct 2026 07:00:00 +1100").
// The site is built on a server in UTC, so a plain toLocaleDateString shows an early-morning Australian
// release as the day before. Dates that carry a time zone are shown as the Sydney calendar day instead.
// Dates with no time zone (the old blog posts) are left exactly as they were.
const HAS_ZONE = /(?:Z|GMT|UTC|[+-]\d{2}:?\d{2})\s*$/i;

export function formatAuDate(d: string, options: Intl.DateTimeFormatOptions): string {
  const zone = HAS_ZONE.test(String(d).trim()) ? { timeZone: 'Australia/Sydney' } : {};
  return new Date(d).toLocaleDateString('en-AU', { ...options, ...zone });
}
