/**
 * CraftIndex Dynamic Resource Sitemap Builder
 * --------------------------------------------
 * Fetches the top-downloaded resources per category directly from the
 * Modrinth public API at build time and emits sitemap-resources.xml with
 * canonical resource URLs. Build stops are graceful: if the Modrinth API
 * is unreachable, the sitemap is still emitted with category links only
 * (resource URLs are never fabricated).
 *
 * Usage: node build_sitemap.js
 * Output: dist/pages/sitemap-resources.xml (+ root copy for inspection)
 */

const fs = require('fs');
const path = require('path');

const DOMAIN = process.env.CRAFTINDEX_DOMAIN || 'https://craftindex.inlooker.top';
const MODRINTH_API = 'https://api.modrinth.com/v2';
const LIMIT_PER_CATEGORY = parseInt(process.env.SITEMAP_LIMIT || '100', 10);

// Mirrors config.json / functions/lib/resource_render.js project types.
const CATEGORIES = [
  { id: 'mods', ptype: 'mod' },
  { id: 'plugins', ptype: 'plugin' },
  { id: 'resourcepacks', ptype: 'resourcepack' },
  { id: 'shaders', ptype: 'shader' },
  { id: 'datapacks', ptype: 'datapack' },
  { id: 'modpacks', ptype: 'modpack' },
  { id: 'worlds', ptype: 'world' }
];

function categoryStaticUrls() {
  // Category roots are pre-rendered and always crawlable.
  return CATEGORIES.map((c) => `  <url><loc>${DOMAIN}/${c.id}/</loc></url>`);
}

function esc(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

async function fetchCategory(ptype) {
  const facets = encodeURIComponent(JSON.stringify([['project_type:' + ptype]]));
  const url = `${MODRINTH_API}/search?limit=${LIMIT_PER_CATEGORY}&index=downloads&facets=${facets}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'CraftIndex/sitemap-builder (https://craftindex.inlooker.top; aratainlooker@gmail.com)'
    }
  });
  if (!res.ok) throw new Error('Modrinth HTTP ' + res.status);
  const d = await res.json();
  return (d.hits || []).filter((h) => h.slug && h.title);
}

async function main() {
  console.log('🗺️  Building resource sitemap…');
  const perCategory = {};
  let total = 0;
  let okCategories = 0;
  for (const cat of CATEGORIES) {
    try {
      const hits = await fetchCategory(cat.ptype);
      perCategory[cat.id] = hits;
      total += hits.length;
      okCategories++;
      console.log(`   ✓ ${cat.id}: ${hits.length} resources`);
    } catch (err) {
      perCategory[cat.id] = [];
      console.warn(`   ⚠️ ${cat.id}: Modrinth fetch failed (${err.message}) — skipped gracefully`);
    }
  }

  if (okCategories === 0) {
    console.warn('No provider data available: emitting category-only sitemap.');
  }

  const urls = [...categoryStaticUrls()];
  const seen = new Set();
  for (const cat of CATEGORIES) {
    for (const h of perCategory[cat.id]) {
      const loc = `${DOMAIN}/${cat.id}/${String(h.slug).toLowerCase()}/`;
      if (seen.has(loc)) continue; // slugs are unique on Modrinth, dedupe defensively
      seen.add(loc);
      // lastmod only when Modrinth actually provides it
      const lastmod = h.date_modified ? `<lastmod>${esc(h.date_modified.slice(0, 10))}</lastmod>` : '';
      urls.push(`  <url><loc>${esc(loc)}</loc>${lastmod}</url>`);
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;

  const outPages = path.join(__dirname, 'dist', 'pages', 'sitemap-resources.xml');
  if (fs.existsSync(path.dirname(outPages))) fs.writeFileSync(outPages, sitemap, 'utf-8');
  fs.writeFileSync(path.join(__dirname, 'sitemap-resources.xml'), sitemap, 'utf-8');
  console.log(`✅ sitemap-resources.xml written: ${urls.length} URLs (${total} resource URLs from ${okCategories} categories).`);
}

main().catch((err) => {
  // Never break the deployment build on fetch errors.
  console.error('Sitemap build failed non-critically:', err.message);
  process.exit(0);
});
