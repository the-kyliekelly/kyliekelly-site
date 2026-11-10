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

// list name -> where to add the person in Flodesk.
//   segmentIds: the segments to add them to (an empty list means "just add them to Flodesk")
//   formId: the old Flodesk form. Only used as a back-up if the Flodesk API refuses the sign-up.
const LISTS = {
  'inner-circle': { segmentIds: ['6ae968ef06fd210ed1e3dac0'], formId: '6ae968b630164fafb1274552' }, // Inner Circle Waitlist
  freebie: { segmentIds: [], formId: '6a389632c69dbd7193980270' }, // the "You almost left without this freebie?" form
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

  const turnstileSecret = (process.env.TURNSTILE_SECRET_KEY || '').trim();
  const flodeskKey = (process.env.FLODESK_API_KEY || '').trim();
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

  const target = LISTS[list];
  if (!target) {
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

  // Add them to Flodesk through the API.
  const upstream = {};
  try {
    const response = await fetch('https://api.flodesk.com/v1/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${flodeskKey}:`).toString('base64')}`,
        'User-Agent': 'kyliekelly.com (https://kyliekelly.com)',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, first_name: firstName, ...(target.segmentIds.length ? { segment_ids: target.segmentIds } : {}) }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      return res.status(200).json({ ok: true });
    }
    upstream.api = response.status;
    console.error('Flodesk API refused the sign-up', response.status, (await response.text().catch(() => '')).slice(0, 300));
  } catch (error) {
    upstream.api = 'error';
    console.error('Flodesk API call failed', String(error).slice(0, 300));
  }

  // Back-up: the visitor has already passed the human check, so send them through the old Flodesk form instead.
  try {
    const response = await fetch(`https://form.flodesk.com/forms/${target.formId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'kyliekelly.com (https://kyliekelly.com)' },
      body: new URLSearchParams({ firstName, email }),
      signal: AbortSignal.timeout(10000),
    });
    upstream.form = response.status;
    if (response.status < 400) {
      return res.status(200).json({ ok: true });
    }
    console.error('Flodesk form back-up refused the sign-up', response.status);
  } catch (error) {
    upstream.form = 'error';
    console.error('Flodesk form back-up failed', String(error).slice(0, 300));
  }
  return res.status(502).json({ ok: false, error: 'signup-failed', upstream });
}
