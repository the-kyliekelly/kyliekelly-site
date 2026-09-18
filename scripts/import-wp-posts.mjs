// One-off migration script: pulls every WordPress post from the current
// Showit/WP blog and writes them to src/data/blog-posts.json, downloading
// any inline images into public/images/blog/ so the new site doesn't
// depend on the old host once Showit is cancelled.
import fs from 'node:fs/promises';
import path from 'node:path';

const SITE = 'https://kyliekelly.com';
const OUT_JSON = new URL('../src/data/blog-posts.json', import.meta.url);
const IMAGES_DIR = new URL('../public/images/blog/', import.meta.url);

async function fetchAllPosts() {
  const posts = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${SITE}/wp-json/wp/v2/posts?per_page=50&page=${page}&orderby=date&order=desc`);
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    posts.push(...batch);
    const totalPages = Number(res.headers.get('X-WP-TotalPages') || '1');
    if (page >= totalPages) break;
    page++;
  }
  return posts;
}

function decodeEntities(str) {
  return str
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8230;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

const imageCache = new Map();

async function downloadImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);
  const filename = decodeURIComponent(path.basename(new URL(url).pathname));
  const dest = new URL(filename, IMAGES_DIR);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, buf);
    const localPath = `/images/blog/${filename}`;
    imageCache.set(url, localPath);
    return localPath;
  } catch (err) {
    console.warn(`  ! failed to download ${url}: ${err.message}`);
    imageCache.set(url, url);
    return url;
  }
}

async function localizeImages(html) {
  const imgRegex = /<img[^>]+>/g;
  const matches = html.match(imgRegex) || [];
  let out = html;
  for (const tag of matches) {
    const srcMatch = tag.match(/src="([^"]+)"/);
    if (!srcMatch) continue;
    const src = srcMatch[1];
    if (!src.includes('kyliekelly.com/wp-content/uploads')) continue;
    const localSrc = await downloadImage(src);
    let newTag = tag.replace(src, localSrc);
    // strip srcset/sizes since we only keep one resolution locally
    newTag = newTag.replace(/\s(srcset|sizes)="[^"]*"/g, '');
    out = out.replace(tag, newTag);
  }
  return out;
}

async function main() {
  await fs.mkdir(new URL('.', OUT_JSON), { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });

  console.log('Fetching post list...');
  const raw = await fetchAllPosts();
  console.log(`Found ${raw.length} posts. Downloading content + images...`);

  const posts = [];
  for (const [i, p] of raw.entries()) {
    const title = decodeEntities(p.title.rendered);
    const excerpt = decodeEntities(p.excerpt.rendered.replace(/<[^>]+>/g, '').trim());
    process.stdout.write(`  [${i + 1}/${raw.length}] ${p.slug}\r\n`);
    const content = await localizeImages(p.content.rendered);
    posts.push({
      slug: p.slug,
      title,
      date: p.date,
      excerpt,
      content,
      categories: p.categories,
      link: p.link,
    });
  }

  await fs.writeFile(OUT_JSON, JSON.stringify(posts, null, 2));
  console.log(`\nWrote ${posts.length} posts to ${OUT_JSON.pathname}`);
  console.log(`Downloaded ${imageCache.size} unique images to ${IMAGES_DIR.pathname}`);
}

main();
