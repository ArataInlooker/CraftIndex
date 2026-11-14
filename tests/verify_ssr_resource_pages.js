/**
 * CraftIndex SSR Resource Page Verification
 * -----------------------------------------
 * Verifies that functions/lib/resource_render.js produces genuine,
 * server-rendered resource profile HTML with real resource-specific
 * content, SEO metadata, canonical URLs, and structured data.
 *
 * Runs purely in Node.js (no browser required) by directly invoking
 * injectResourcePage() with mock provider data.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { injectResourcePage } = require('../functions/lib/resource_render.js');

const ROOT_DIR = path.resolve(__dirname, '..');
const templatePath = path.join(ROOT_DIR, 'index.html');
const template = fs.readFileSync(templatePath, 'utf-8');

function fabricApiResource() {
  return {
    k: 'mr:P7dR8mSH',
    id: 'P7dR8mSH',
    category: 'mods',
    source: 'modrinth',
    sourceName: 'Modrinth',
    providerUrl: 'https://modrinth.com/mod/fabric-api',
    slug: 'fabric-api',
    title: 'Fabric API',
    icon: 'https://cdn.modrinth.com/data/P7dR8mSH/icon.png',
    author: 'Fabric',
    desc: 'Lightweight and modular API providing common hooks and intercompatibility measures utilized by mods using the Fabric toolchain.',
    downloads: 287050101,
    followers: 37799,
    license: 'Apache License 2.0',
    licenseUrl: 'https://www.apache.org/licenses/LICENSE-2.0',
    published: '2021-01-22T11:04:41.419169Z',
    updated: '2026-11-11T13:44:09.177173Z',
    loaders: ['fabric'],
    gameVersions: ['1.21', '1.20.1'],
    body: 'The Fabric API is a library mod that provides hooks and utilities for Fabric mods.',
    gallery: [{ url: 'https://cdn.modrinth.com/data/P7dR8mSH/screenshots/1.png', description: 'Fabric API screenshot' }],
    mrType: 'mod'
  };
}

function sodiumResource() {
  return {
    k: 'mr:AANobbMI',
    id: 'AANobbMI',
    category: 'mods',
    source: 'modrinth',
    sourceName: 'Modrinth',
    providerUrl: 'https://modrinth.com/mod/sodium',
    slug: 'sodium',
    title: 'Sodium',
    icon: 'https://cdn.modrinth.com/data/AANobbMI/295862f4724dc3f78df3447ad6072b2dcd3ef0c9_96.webp',
    author: null,
    desc: 'A high-performance rendering engine replacement for Minecraft, which greatly improves frame rates and reduces micro-stutter.',
    downloads: 252096523,
    followers: 42780,
    license: 'LicenseRef-Polyform-Shield-1.0.0',
    licenseUrl: 'https://github.com/CaffeineMC/sodium/blob/dev/LICENSE.md',
    published: '2021-01-03T00:53:34.185936Z',
    updated: '2026-11-12T01:12:30.162066Z',
    loaders: ['fabric', 'neoforge', 'quilt'],
    gameVersions: ['1.21', '1.20.1'],
    body: 'Sodium is a powerful optimization mod for the Minecraft client.',
    gallery: [
      { url: 'https://cdn.modrinth.com/data/AANobbMI/images/1.png', description: 'Sodium comparison' },
      { url: 'https://cdn.modrinth.com/data/AANobbMI/images/2.png', description: 'Sodium biome blending' }
    ],
    mrType: 'mod'
  };
}

function relatedResources() {
  return [
    { slug: 'sodium', title: 'Sodium', icon: null, downloads: 252096523 },
    { slug: 'iris', title: 'Iris Shaders', icon: null, downloads: 194711281 },
    { slug: 'entityculling', title: 'Entity Culling', icon: null, downloads: 188300000 }
  ];
}

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${name}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${name}`);
  }
}

async function main() {
  console.log('================================================================');
  console.log('CRAFTINDEX SSR RESOURCE PAGE VERIFICATION');
  console.log('================================================================\n');

  // ── Test 1: Fabric API resource page ──
  console.log('1. Fabric API resource page SSR');
  const fabricHtml = injectResourcePage(template, fabricApiResource(), relatedResources(), 'fabric-api');

  check('HTTP 200 equivalent (no error thrown)', true);
  check('Title contains resource name', fabricHtml.includes('<title>Fabric API — Mods | CraftIndex</title>'));
  check('Canonical URL uses correct domain', fabricHtml.includes('canonical" href="https://craftindex.inlooker.top/mods/fabric-api/"'));
  check('Canonical URL NOT using craftindex.inlooker/', !fabricHtml.includes('canonical" href="https://craftindex.inlooker/mods/fabric-api/'));
  check('Meta description is resource-specific', fabricHtml.includes('name="description" content="Lightweight and modular API'));
  check('OG title is resource-specific', fabricHtml.includes('og:title" content="Fabric API — Mods | CraftIndex"'));
  check('OG URL is canonical', fabricHtml.includes('og:url" content="https://craftindex.inlooker.top/mods/fabric-api/"'));
  check('OG image from provider icon', fabricHtml.includes('og:image" content="https://cdn.modrinth.com/data/P7dR8mSH/icon.png"'));
  check('Twitter card present', fabricHtml.includes('name="twitter:card" content="summary_large_image"'));
  check('JSON-LD structured data present', fabricHtml.includes('application/ld+json'));
  check('JSON-LD contains SoftwareApplication', fabricHtml.includes('"@type":"SoftwareApplication"'));
  check('JSON-LD contains BreadcrumbList', fabricHtml.includes('"@type":"BreadcrumbList"'));
  check('Resource name in body h1', fabricHtml.includes('<h1 id="rp-ssr-title">Fabric API</h1>'));
  check('Author in body', fabricHtml.includes('by <strong>Fabric</strong>'));
  check('Source in body', fabricHtml.includes('Source: <strong>Modrinth</strong>'));
  check('Provider link in body', fabricHtml.includes('View on Modrinth ↗'));
  check('Downloads in stats', fabricHtml.includes('downloads'));
  check('Followers in stats', fabricHtml.includes('followers'));
  check('License in stats', fabricHtml.includes('License:'));
  check('Updated date in stats', fabricHtml.includes('Updated:'));
  check('Loaders in stats', fabricHtml.includes('Loaders:'));
  check('Gallery images present', fabricHtml.includes('loading="lazy"'));
  check('Related resources section present', fabricHtml.includes('Popular Mods'));
  check('Download button present', fabricHtml.includes('Download from Modrinth'));
  check('Category chrome hidden (filter bar)', fabricHtml.includes('<div class="fl" style="display:none"'));
  check('Category chrome hidden (load more)', fabricHtml.includes('style="display:none" id="mo-wrap"'));
  check('Client payload data-rp present', fabricHtml.includes('data-rp='));
  check('No loading spinner text', !fabricHtml.includes('Resolving'));
  check('No empty loading shell', !fabricHtml.includes('rp-loading'));
  check('No nested <li><li> invalid HTML', !fabricHtml.includes('<li><li>'));
  check('Valid stats list structure', /<ul class="rp-ssr-stats"><li>⬇/.test(fabricHtml));

  // ── Test 2: Sodium resource page ──
  console.log('\n2. Sodium resource page SSR');
  const sodiumHtml = injectResourcePage(template, sodiumResource(), relatedResources(), 'sodium');

  check('Title contains resource name', sodiumHtml.includes('<title>Sodium — Mods | CraftIndex</title>'));
  check('Canonical URL correct', sodiumHtml.includes('canonical" href="https://craftindex.inlooker.top/mods/sodium/"'));
  check('Meta description resource-specific', sodiumHtml.includes('name="description" content="A high-performance rendering engine'));
  check('Resource name in body h1', sodiumHtml.includes('<h1 id="rp-ssr-title">Sodium</h1>'));
  check('Stats present', sodiumHtml.includes('252.1M') || sodiumHtml.includes('252096523'));
  check('Gallery images present', sodiumHtml.includes('loading="lazy"'));
  check('Related resources present', sodiumHtml.includes('Popular Mods'));
  check('No nested <li><li> invalid HTML', !sodiumHtml.includes('<li><li>'));
  check('Valid stats list structure', /<ul class="rp-ssr-stats"><li>⬇/.test(sodiumHtml));

  // ── Test 3: Iris resource page ──
  console.log('\n3. Iris Shaders resource page SSR');
  const irisHtml = injectResourcePage(template, {
    ...sodiumResource(),
    id: 'YL57xq9U',
    slug: 'iris',
    title: 'Iris Shaders',
    providerUrl: 'https://modrinth.com/mod/iris',
    icon: 'https://cdn.modrinth.com/data/YL57xq9U/18d0e7f076d3d6ed5bedd472b853909aac5da202_96.webp',
    desc: 'A modern shader pack loader for Minecraft intended to be compatible with existing OptiFine shader packs',
    downloads: 194711281,
    followers: 30716,
    license: 'GNU Lesser General Public License v3.0 only',
    updated: '2026-09-30T02:58:24.095409Z',
    loaders: ['fabric', 'neoforge', 'quilt'],
    body: 'Iris is a modern shader pack loader for Minecraft.',
    gallery: [{ url: 'https://cdn.modrinth.com/data/YL57xq9U/images/1.png', description: 'Iris screenshot' }]
  }, relatedResources(), 'iris');

  check('Title contains resource name', irisHtml.includes('<title>Iris Shaders — Mods | CraftIndex</title>'));
  check('Canonical URL correct', irisHtml.includes('canonical" href="https://craftindex.inlooker.top/mods/iris/"'));
  check('Resource name in body h1', irisHtml.includes('<h1 id="rp-ssr-title">Iris Shaders</h1>'));
  check('Stats present', irisHtml.includes('194.7M') || irisHtml.includes('194711281'));
  check('No nested <li><li> invalid HTML', !irisHtml.includes('<li><li>'));

  // ── Test 4: Content visibility without JavaScript ──
  console.log('\n4. Content visibility without JavaScript (SSR content in raw HTML)');
  check('rp-ssr section present in initial HTML', fabricHtml.includes('<section class="rp-ssr"'));
  check('Resource title visible without JS', fabricHtml.includes('<h1 id="rp-ssr-title">Fabric API</h1>'));
  check('Description visible without JS', fabricHtml.includes('<div class="rp-ssr-desc">'));
  check('Stats visible without JS', fabricHtml.includes('<ul class="rp-ssr-stats">'));
  check('Gallery visible without JS', fabricHtml.includes('<div class="rp-ssr-gallery"'));
  check('Related links visible without JS', fabricHtml.includes('<a href="/mods/sodium/">'));
  check('Download link visible without JS', fabricHtml.includes('Download from Modrinth'));
  check('Breadcrumb visible without JS', fabricHtml.includes('<nav class="seo-breadcrumbs"'));

  // ── Test 5: No duplicate rendering ──
  console.log('\n5. No duplicate rendering');
  check('Only one rp-ssr section', (fabricHtml.match(/<section class="rp-ssr"/g) || []).length === 1);
  check('Only one data-rp attribute', (fabricHtml.match(/data-rp=/g) || []).length === 1);
  check('standaloneResourceView is empty (not duplicated)', fabricHtml.includes('<div id="standaloneResourceView" class="standalone-resource-container" aria-live="polite"></div>'));

  console.log(`\n================================================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
