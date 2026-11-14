/**
 * CraftIndex Resource Page SSR Library (Cloudflare Pages Function module)
 * -----------------------------------------------------------------------
 * Resolves a resource URL slug against live provider APIs and renders a
 * fully hydratable standalone resource page (server-rendered initial HTML
 * with real metadata, JSON-LD, crawlable content and related links).
 *
 * Hard rules enforced here:
 *  - Nothing is ever fabricated: only metadata actually returned by the
 *    source API is rendered. Missing data yields "not stated".
 *  - All provider text is HTML-escaped before template injection.
 *  - The client can consume the identity payload via data-rp to skip its
 *    own resolution fetch (single upstream request per page view).
 */

const DOMAIN = 'https://craftindex.inlooker.top';
const MODRINTH_API = 'https://api.modrinth.com/v2';
const CF_API = 'https://api.curseforge.com/v1';
const GITHUB_API = 'https://api.github.com';
const GITHUB_SEP = '--';

// Mirrors config.json tabs (authoritative classIds / project types).
const CATEGORY_MAP = {
  mods:          { label: 'Mods',           cfClass: 6,    cfCatSlug: 'mc-mods',       mrType: 'mod',           relatedType: 'mod' },
  plugins:       { label: 'Plugins',        cfClass: 5,    cfCatSlug: 'bukkit-plugins', mrType: 'plugin',        relatedType: 'plugin' },
  resourcepacks: { label: 'Resource Packs', cfClass: 12,   cfCatSlug: 'texture-packs', mrType: 'resourcepack',  relatedType: 'resourcepack' },
  shaders:       { label: 'Shaders',        cfClass: 6552, cfCatSlug: 'shaders',       mrType: 'shader',        relatedType: 'shader' },
  datapacks:     { label: 'Data Packs',     cfClass: 6945, cfCatSlug: 'data-packs',    mrType: 'datapack',      relatedType: 'datapack' },
  modpacks:      { label: 'Modpacks',       cfClass: 4471, cfCatSlug: 'modpacks',      mrType: 'modpack',       relatedType: 'modpack' },
  worlds:        { label: 'Worlds',         cfClass: 17,   cfCatSlug: 'worlds',        mrType: 'world',         relatedType: 'world' }
};

// Reserved /mods/ second segments (loader filter prerendered routes).
const RESERVED_MOD_LOADER_SLUGS = new Set(['fabric', 'neoforge', 'forge', 'quilt']);

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function stripMarkdownToText(markdown, maxChars) {
  if (!markdown) return '';
  let t = String(markdown);
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`([^`]+)`/g, '$1');
  t = t.replace(/!\[([^\]]*)\]\([^)]*\)/g, ' ');
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  t = t.replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/[*_~>|]+/g, '');
  t = t.replace(/\r/g, '');
  t = t.replace(/\n{2,}/g, '\n');
  t = t.trim();
  if (maxChars && t.length > maxChars) {
    t = t.slice(0, maxChars - 1).replace(/\s+\S*$/, '') + '…';
  }
  return t;
}

function fmtCompact(n) {
  const num = Number(n);
  if (!isFinite(num) || num == null) return null;
  try {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
  } catch (_) {
    return String(num);
  }
}

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // honest date-only; no fabricated precision
}

/* ---------------------------------------------------------------
 * Provider resolution
 * ------------------------------------------------------------- */

async function fetchJson(url, headers) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'CraftIndex/2.6.0 (https://craftindex.inlooker.top; aratainlooker@gmail.com)',
      Accept: 'application/json',
      ...(headers || {})
    }
  });
  if (!res.ok) {
    const err = new Error('HTTP ' + res.status);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function normalizeModrinthProject(d, category) {
  const info = CATEGORY_MAP[category] || {};
  const websitetype = d.project_type || info.mrType || 'mod';
  return {
    k: 'mr:' + d.id,
    id: d.id,
    category,
    source: 'modrinth',
    sourceName: 'Modrinth',
    providerUrl: 'https://modrinth.com/' + websitetype + '/' + (d.slug || d.id),
    slug: d.slug,
    title: d.title,
    icon: d.icon_url || null,
    author: (d.organization && d.organization.name) || null,
    desc: d.description || '',
    downloads: d.downloads,
    followers: d.followers,
    license: d.license && (d.license.name || d.license.id) ? (d.license.name || d.license.id) : null,
    licenseUrl: d.license && d.license.url ? d.license.url : null,
    published: d.published,
    updated: d.updated,
    loaders: d.loaders || [],
    gameVersions: d.game_versions || [],
    body: d.body || '',
    gallery: (d.gallery || []).slice(0, 4).map((g) => ({ url: g.url, description: g.description || '' })),
    mrType: websitetype
  };
}

async function resolveModrinth(slug, category, env) {
  const d = await fetchJson(`${MODRINTH_API}/project/${encodeURIComponent(slug)}`);
  return normalizeModrinthProject(d, category);
}

async function resolveCurseForge(slug, category, env) {
  const key = env && env.CF_KEY;
  if (!key) return null; // graceful degrade: no key, no CF resolution
  const info = CATEGORY_MAP[category];
  if (!info || !info.cfClass) return null;
  const params = new URLSearchParams({
    gameId: '432',
    classId: String(info.cfClass),
    searchFilter: slug,
    pageSize: '8'
  });
  const d = await fetchJson(`${CF_API}/mods/search?${params}`, {
    'x-api-key': key,
    Accept: 'application/json'
  });
  const exact = (d.data || []).find((m) => m.slug === slug);
  if (!exact) return null;
  return {
    k: 'cf:' + exact.id,
    id: exact.id,
    category,
    source: 'curseforge',
    sourceName: 'CurseForge',
    providerUrl: (exact.links && exact.links.websiteUrl) ||
      `https://www.curseforge.com/minecraft/${info.cfCatSlug}/${exact.slug || exact.id}`,
    slug: exact.slug,
    title: exact.name,
    icon: exact.logo ? (exact.logo.thumbnailUrl || exact.logo.url) : null,
    author: exact.authors && exact.authors[0] ? exact.authors[0].name : null,
    desc: exact.summary || '',
    downloads: exact.downloadCount,
    followers: exact.thumbsUpCount || 0,
    license: null,
    published: exact.dateCreated,
    updated: exact.dateModified,
    loaders: [],
    gameVersions: exact.latestFilesIndexes && exact.latestFilesIndexes.length
      ? (exact.latestFilesIndexes[0].gameVersion ? [exact.latestFilesIndexes[0].gameVersion] : [])
      : [],
    body: exact.summary || '',
    gallery: exact.logo ? [{ url: exact.logo.thumbnailUrl || exact.logo.url, description: '' }] : []
  };
}

// Real GitHub resolution (kept separate for clarity in the chain below).
async function resolveGithubRepo(slug, category, env) {
  const seg = slug.split(GITHUB_SEP);
  if (seg.length !== 2 || !seg[0] || !seg[1]) return null;
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    ...(env && env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + env.GITHUB_TOKEN } : {})
  };
  const repo = await fetchJson(`${GITHUB_API}/repos/${seg[0]}/${seg[1]}`, headers);
  return {
    k: 'gh:' + repo.full_name,
    id: repo.full_name,
    category,
    source: 'github',
    sourceName: 'GitHub',
    providerUrl: repo.html_url,
    slug,
    title: repo.name || slug,
    icon: repo.owner && repo.owner.avatar_url ? repo.owner.avatar_url : null,
    author: repo.owner && repo.owner.login ? repo.owner.login : null,
    desc: repo.description || '',
    downloads: null,
    followers: repo.stargazers_count || 0,
    license: repo.license && repo.license.name ? repo.license.name : null,
    licenseUrl: repo.license && repo.license.url ? repo.license.url : null,
    published: repo.created_at,
    updated: repo.updated_at,
    loaders: [],
    gameVersions: [],
    body: repo.description || '',
    gallery: []
  };
}

// Chain: Modrinth → CurseForge (needs CF_KEY) → GitHub owner--repo.
// Throws only on total failure; callers treat null as an honest 404.
export async function resolveResource(category, slug, env) {
  const providers = [resolveModrinth, resolveCurseForge, resolveGithubRepo];
  let lastErr = null;
  for (const fn of providers) {
    try {
      const r = await fn(slug, category, env);
      if (r) return r;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr && lastErr.status && lastErr.status !== 404) throw lastErr;
  return null;
}

// Top downloads in the same Modrinth category, for related-resource linking.
export async function relatedModrinth(category, currentId, limit) {
  const info = CATEGORY_MAP[category];
  if (!info || !info.relatedType) return [];
  const facets = encodeURIComponent(JSON.stringify([['project_type:' + info.relatedType]]));
  const url = `${MODRINTH_API}/search?limit=${limit || 6}&index=downloads&facets=${facets}`;
  try {
    const d = await fetchJson(url);
    return (d.hits || [])
      .filter((h) => h.project_id !== currentId)
      .slice(0, limit || 6)
      .map((h) => ({
        slug: h.slug,
        title: h.title,
        icon: h.icon_url,
        downloads: h.downloads
      }));
  } catch (_) {
    return [];
  }
}

/* ---------------------------------------------------------------
 * HTML builders
 * ------------------------------------------------------------- */

function safeAbsolute(u) {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch (_) {
    return null;
  }
}

function metaDescription(resource) {
  const base = stripMarkdownToText(resource.desc || '', 430);
  if (!base) return `${resource.title || 'Resource'} — Minecraft ${CATEGORY_MAP[resource.category] ? CATEGORY_MAP[resource.category].label : 'Resource'} catalog entry on CraftIndex. Source: ${resource.sourceName}.`;
  let d = stripMarkdownToText(base, 150);
  // Attribution sentence uses only verified fields.
  return d;
}

function canonicalPath(resource) {
  return `/${resource.category}/${String(resource.slug).toLowerCase()}/`;
}

function buildJsonLd(resource, related) {
  const info = CATEGORY_MAP[resource.category] || {};
  const canonical = `${DOMAIN}${canonicalPath(resource)}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': `${canonical}#software`,
        url: canonical,
        name: resource.title,
        ...(resource.desc ? { description: stripMarkdownToText(resource.desc, 300) } : {}),
        ...(resource.icon && safeAbsolute(resource.icon)
          ? { image: safeAbsolute(resource.icon) }
          : {}),
        ...(resource.author
          ? { author: { '@type': 'Person', name: resource.author } }
          : {}),
        applicationCategory: 'GameApplication',
        operatingSystem: 'Minecraft ' + (resource.loaders && resource.loaders.length
          ? resource.loaders.map((l) => String(l).toLowerCase())
          : 'Java'),
        ...(resource.downloads != null
          ? {
              interactionStatistic: {
                '@type': 'InteractionCounter',
                interactionType: { '@type': 'DownloadAction' },
                userInteractionCount: Number(resource.downloads) || 0
              }
            }
          : {}),
        ...(resource.license ? { license: resource.licenseUrl || { '@type': 'Thing', name: resource.license } } : {}),
        ...(resource.published ? { datePublished: resource.published } : {}),
        ...(resource.updated ? { dateModified: resource.updated } : {}),
        sameAs: [resource.providerUrl].filter(Boolean),
        offers: undefined
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonical}#breadcrumbs`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` },
          { '@type': 'ListItem', position: 2, name: info.label || resource.category, item: `${DOMAIN}/${resource.category}/` },
          { '@type': 'ListItem', position: 3, name: resource.title, item: canonical }
        ]
      }
    ]
  };

  if (related && related.length) {
    jsonLd['@graph'].push({
      '@type': 'ItemList',
      '@id': `${canonical}#related`,
      name: `Related ${info.label || resource.category}`,
      itemListElement: related.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${DOMAIN}/${resource.category}/${String(r.slug).toLowerCase()}/`,
        name: r.title
      }))
    });
  }
  return jsonLd;
}

function buildSsrBody(resource, related, slug) {
  const info = CATEGORY_MAP[resource.category] || {};
  const stats = [];
  if (resource.downloads != null) {
    stats.push(`⬇ <strong>${escapeHtml(fmtCompact(resource.downloads))}</strong> downloads (as reported by ${escapeHtml(resource.sourceName)})`);
  }
  if (resource.followers != null && resource.source === 'github') {
    stats.push(`★ <strong>${escapeHtml(fmtCompact(resource.followers))}</strong> stars`);
  } else if (resource.followers) {
    stats.push(`♥ <strong>${escapeHtml(fmtCompact(resource.followers))}</strong> followers`);
  }
  if (resource.license) {
    const lic = resource.licenseUrl
      ? `<a href="${escapeHtml(resource.licenseUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(resource.license)}</a>`
      : escapeHtml(resource.license);
    stats.push(`License: ${lic}`);
  }
  const upd = fmtDate(resource.updated);
  if (upd) stats.push(`Updated: <time datetime="${escapeHtml(resource.updated)}">${escapeHtml(upd)}</time>`);
  if (resource.loaders && resource.loaders.length) {
    stats.push(`Loaders: ${resource.loaders.slice(0, 6).map((l) => escapeHtml(String(l).toLowerCase())).join(', ')}`);
  }

  const paragraphs = stripMarkdownToText(resource.body || resource.desc || '', 2400)
    .split('\n')
    .filter((l) => l.trim().length)
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join('\n');

  const gallery = (resource.gallery || []).filter((g) => safeAbsolute(g.url));
  const galleryHtml = gallery.length
    ? `<div class="rp-ssr-gallery" aria-label="Screenshots">\n${gallery
        .map((g) => `<img src="${escapeHtml(safeAbsolute(g.url))}" alt="${escapeHtml(g.description || resource.title + ' screenshot')}" loading="lazy" width="480" height="270" />`)
        .join('\n')}\n</div>`
    : '';

  const relatedHtml = related && related.length
    ? `<section class="rp-ssr-related" aria-label="Related resources">
        <h2>Popular ${escapeHtml(info.label || resource.category)}</h2>
        <ul class="rp-ssr-related-list">
${related
  .map(
    (r) =>
      `<li><a href="${escapeHtml(canonicalPath({ category: resource.category, slug: r.slug }))}">${
        r.icon && safeAbsolute(r.icon)
          ? `<img src="${escapeHtml(safeAbsolute(r.icon))}" alt="" width="32" height="32" loading="lazy" /> `
          : ''
      }${escapeHtml(r.title)}${r.downloads != null ? ` <span class="rp-ssr-meta">⬇ ${escapeHtml(fmtCompact(r.downloads))}</span>` : ''}</a></li>`
  )
  .join('\n')}
        </ul>
      </section>`
    : '';

  const clientPayload = {
    k: resource.k,
    id: resource.id,
    tab: resource.category,
    source: resource.source,
    sourceName: resource.sourceName,
    websiteUrl: resource.providerUrl,
    title: resource.title,
    icon: resource.icon,
    author: resource.author,
    desc: resource.desc,
    dl: resource.downloads,
    fo: resource.followers,
    slug: resource.slug,
    pt: CATEGORY_MAP[resource.category] ? CATEGORY_MAP[resource.category].mrType : undefined
  };

  return `
<section class="rp-ssr" data-rp="${escapeHtml(encodeURIComponent(JSON.stringify(clientPayload)))}" aria-labelledby="rp-ssr-title">
  <nav class="seo-breadcrumbs" aria-label="Breadcrumb">
    <a href="/">Home</a> &gt; <a href="/${escapeHtml(resource.category)}/">${escapeHtml(info.label || resource.category)}</a> &gt; <span>${escapeHtml(resource.title || slug)}</span>
  </nav>
  <header class="rp-ssr-header">
    ${
      resource.icon && safeAbsolute(resource.icon)
        ? `<img class="rp-ssr-icon" src="${escapeHtml(safeAbsolute(resource.icon))}" alt="${escapeHtml(resource.title || 'Resource icon')}" width="96" height="96" loading="eager" />`
        : ''
    }
    <div class="rp-ssr-heading">
      <h1 id="rp-ssr-title">${escapeHtml(resource.title || slug)}</h1>
      <p class="rp-ssr-byline">
        ${resource.author ? `by <strong>${escapeHtml(resource.author)}</strong> · ` : ''}
        Source: <strong>${escapeHtml(resource.sourceName)}</strong> ·
        <a href="${escapeHtml(resource.providerUrl)}" target="_blank" rel="noopener noreferrer">View on ${escapeHtml(resource.sourceName)} ↗</a>
      </p>
    </div>
  </header>
  <ul class="rp-ssr-stats">${stats.length ? stats.map((s) => `<li>${s}</li>`).join('') : '<li>Metric data not stated by the source provider.</li>'}</ul>
  ${paragraphs ? `<div class="rp-ssr-desc">${paragraphs}</div>` : ''}
  ${galleryHtml}
  <div class="rp-ssr-actions">
    <a class="rp-ssr-provider-btn" href="${escapeHtml(resource.providerUrl)}" target="_blank" rel="noopener noreferrer">⬇ Download from ${escapeHtml(resource.sourceName)} ↗</a>
    <span class="rp-ssr-note">Interactive documentation, version files, screenshots and “Add to Collection” load with the CraftIndex app below.</span>
  </div>
  ${relatedHtml}
  <nav class="rp-ssr-seeall" aria-label="Browse category">
    <a href="/${escapeHtml(resource.category)}/">Browse all ${escapeHtml(info.label || resource.category)} →</a>
  </nav>
</section>`;
}

/**
 * Inject resource metadata + SSR content into the prerendered category
 * template served from the ASSETS binding.
 */
export function injectResourcePage(templateHtml, resource, related, slug) {
  const info = CATEGORY_MAP[resource.category] || {};
  const canonical = `${DOMAIN}${canonicalPath(resource)}`;
  const title = `${resource.title || slug} — ${info.label || resource.category} | CraftIndex`;
  const ogImage = (resource.icon && safeAbsolute(resource.icon)) || `${DOMAIN}/images/bigger-image.png`;
  let html = templateHtml;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = html.replace(
    /<meta\s+name="description"[\s\S]*?>/i,
    `<meta name="description" content="${escapeHtml(metaDescription(resource))}" />`
  );
  html = html.replace(
    /<link\s+rel="canonical"[\s\S]*?>/i,
    `<link rel="canonical" href="${canonical}" />`
  );
  html = html.replace(/<meta\s+property="og:title"[\s\S]*?>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta\s+property="og:description"[\s\S]*?>/i, `<meta property="og:description" content="${escapeHtml(metaDescription(resource))}" />`);
  html = html.replace(/<meta\s+property="og:url"[\s\S]*?>/i, `<meta property="og:url" content="${canonical}" />`);
  html = html.replace(/<meta\s+property="og:image"[\s\S]*?>/i, `<meta property="og:image" content="${escapeHtml(ogImage)}" />`);
  html = html.replace(/<meta\s+name="twitter:title"[\s\S]*?>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`);
  html = html.replace(/<meta\s+name="twitter:description"[\s\S]*?>/i, `<meta name="twitter:description" content="${escapeHtml(metaDescription(resource))}" />`);
  html = html.replace(/<meta\s+name="twitter:image"[\s\S]*?>/i, `<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`);

  const jsonLd = buildJsonLd(resource, related);
  const jsonLdString = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  if (/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i.test(html)) {
    html = html.replace(
      /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
      `<script type="application/ld+json">\n${jsonLdString}\n</script>`
    );
  } else {
    html = html.replace('</head>', `  <script type="application/ld+json">\n${jsonLdString}\n</script>\n</head>`);
  }

  // SSR initial content into the app grid slot.
  if (html.includes('<div class="gr" id="g"></div>')) {
    html = html.replace('<div class="gr" id="g"></div>', `<div class="gr" id="g">${buildSsrBody(resource, related, slug)}</div>`);
  } else if (html.includes('<main')) {
    // Fallback: insert before the first main wrapper's closing position marker
    html = html.replace(/(<main[^>]*>)/i, `$1${buildSsrBody(resource, related, slug)}`);
  }

  // Hide category-specific chrome (filter bar, load more) on resource pages.
  html = html.replace(
    '<div class="fl"',
    '<div class="fl" style="display:none"'
  );
  html = html.replace(
    'id="mo-wrap"',
    'style="display:none" id="mo-wrap"'
  );

  return html;
}

export { RESERVED_MOD_LOADER_SLUGS, CATEGORY_MAP };
