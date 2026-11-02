import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// Pages that only forward visitors elsewhere, or are tests, stay out of the sitemap.
const notInSitemap = ['/404', '/animation-demo', '/ask', '/terms', '/disclaimer'];

export default defineConfig({
  site: 'https://kyliekelly.com',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap({ filter: (page) => !notInSitemap.some((p) => new URL(page).pathname.replace(/\/$/, '') === p) }),
  ],
});
