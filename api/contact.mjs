// Contact form endpoint. The form on /contact posts here; this checks the message and passes it
// to a Zapier workflow that emails it to hello@kyliekelly.com. The Zapier address lives in the
// CONTACT_WEBHOOK_URL environment variable so it never appears in the public page.

const ALLOWED_HOSTS = new Set([
  'kyliekelly.com',
  'www.kyliekelly.com',
  'kyliekelly-site.vercel.app',
  'localhost',
  '127.0.0.1',
]);

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

  const hook = process.env.CONTACT_WEBHOOK_URL;
  if (!hook) {
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

  const data = {
    name: clip(body.name, 120).trim(),
    email: clip(body.email, 200).trim(),
    subject: clip(body.subject, 150).trim(),
    found: clip(body.found, 200).trim(),
    message: clip(body.message, 5000).trim(),
    website: clip(body.website, 200).trim(), // hidden honeypot field
  };

  // Bots fill in the hidden field. Pretend it worked so they move on, but send nothing.
  if (data.website) {
    return res.status(200).json({ ok: true });
  }

  // People take a few seconds to fill in a form. Instant posts are bots.
  const loadedAt = Number(body.loadedAt);
  if (Number.isFinite(loadedAt) && Date.now() - loadedAt < 2500) {
    return res.status(200).json({ ok: true });
  }

  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  if (!data.name || !emailLooksValid || !data.message) {
    return res.status(400).json({ ok: false, error: 'missing-fields' });
  }

  try {
    const response = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return res.status(502).json({ ok: false, error: 'delivery-failed' });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, error: 'delivery-failed' });
  }
}
