// Email sign-up endpoint. The Inner Circle waitlist form posts here instead of straight to Flodesk.
// It checks the visitor with Cloudflare Turnstile (a "are you human" check), then adds them to the right
// Flodesk segment through Flodesk's API. Bots that skip the page cannot get past the Turnstile check.
//
// Two secrets live in Vercel's environment variables, never in the page:
//   TURNSTILE_SECRET_KEY  the secret key of the Cloudflare Turnstile widget for kyliekelly.com
//   FLODESK_API_KEY       a Flodesk API key (Flodesk > Integrations > API keys)
//
// To add another form, add its name and Flodesk segment ID(s) to LISTS and use that name as "list" in the form.

const ALLOWED_HOSTS = new Set([
  'kyliekelly.com',
  'www.kyliekelly.com',
  'kyliekelly-site.vercel.app',
  'localhost',
  '127.0.0.1',
]);

// list name -> the Flodesk segment IDs to add the person to (an empty list means "just add them to Flodesk")
const LISTS = {
  'inner-circle': ['6ae968ef06fd210ed1e3dac0'], // Inner Circle Waitlist
  freebie: [], // the "You almost left without this freebie?" form: the Your Next 1000 Subscribers quiz
};

const clip = (value, max) => String(value ?? '').slice(0, max);

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method-not-allowed' });
  }

  // Only accept posts that come from this site.
  const origin = hostOf(req.headers.origin || req.headers.referer || '');
  if (!ALLOWED_HOSTS.has(origin)) {
    return res.status(403).json({ ok: false, error: 'forbidden' });
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  const flodeskKey = process.env.FLODESK_API_KEY;
  if (!turnstileSecret || !flodeskKey) {
    return res.status(500).json({ ok: false, error: 'not-configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body && typeof body === 'object' ? body : {};

  const list = clip(body.list, 40);
  const firstName = clip(body.firstName, 120).trim();
  const email = clip(body.email, 200).trim().toLowerCase();
  const token = clip(body.token, 2100);
  const website = clip(body.website, 200).trim(); // hidden honeypot field

  // Bots fill in the hidden field. Pretend it worked so they move on, but sign nobody up.
  if (website) {
    return res.status(200).json({ ok: true });
  }

  // People take a few seconds to fill in a form. Instant posts are bots.
  const loadedAt = Number(body.loadedAt);
  if (Number.isFinite(loadedAt) && Date.now() - loadedAt < 2000) {
    return res.status(200).json({ ok: true });
  }

  const segmentIds = LISTS[list];
  if (!segmentIds) {
    return res.status(400).json({ ok: false, error: 'unknown-list' });
  }
  if (!firstName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'missing-fields' });
  }
  if (!token) {
    return res.status(400).json({ ok: false, error: 'captcha' });
  }

  // Ask Cloudflare whether the Turnstile check really passed.
  const ip = clip(String(req.headers['x-forwarded-for'] || '').split(',')[0], 64).trim();
  try {
    const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: token, ...(ip ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await verify.json();
    if (!result || result.success !== true) {
      return res.status(400).json({ ok: false, error: 'captcha' });
    }
  } catch {
    return res.status(502).json({ ok: false, error: 'captcha-unavailable' });
  }

  // Add them to Flodesk.
  try {
    const response = await fetch('https://api.flodesk.com/v1/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${flodeskKey}:`).toString('base64')}`,
        'User-Agent': 'kyliekelly.com (https://kyliekelly.com)',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, first_name: firstName, ...(segmentIds.length ? { segment_ids: segmentIds } : {}) }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return res.status(502).json({ ok: false, error: 'signup-failed' });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, error: 'signup-failed' });
  }
}
