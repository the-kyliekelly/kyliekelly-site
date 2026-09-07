# kyliekelly-site

Astro rebuild of kyliekelly.com. Brand tokens (colors, fonts, buttons) live in `tailwind.config.mjs` and `src/styles/global.css`, pulled from the kylie-kelly-branding skill.

## What's in here

- `src/layouts/Layout.astro` — shared head, nav, footer wrapper
- `src/components/Nav.astro`, `Footer.astro` — shared across every page
- `src/pages/` — one file per route: home, meet-kylie, services, podcast, resources, contact, press, privacy-policy
- Content on every page was pulled directly from the live Showit site content export

## Local development

```
npm install
npm run dev
```

Opens at `http://localhost:4321`.

## What still needs doing

- Swap the placeholder `[ portrait photo ]` box on the homepage for a real image (pull from Showit media library, see the content export doc for the full asset list)
- Wire the contact form to an actual handler (Formspree, Resend, or similar), it's markup only right now
- Individual podcast episodes / blog posts aren't migrated yet, that's a separate pass
- Legal review pass on `/privacy-policy` before it goes live

## Deploying

1. Push this to a new GitHub repo
2. Import the repo in Vercel, framework preset auto-detects as Astro
3. Every push to `main` auto-deploys
