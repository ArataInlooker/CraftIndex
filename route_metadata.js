/**
 * CraftIndex Authoritative Route Metadata & Initial HTML Provider
 * Provides route-specific titles, descriptions, canonical links, Open Graph,
 * Twitter tags, Schema.org JSON-LD, and semantic initial body content.
 */

const fs = require('fs');
const path = require('path');

const DOMAIN = process.env.CRAFTINDEX_DOMAIN || 'https://craftindex.inlooker.top';
const AUTHOR = {
  '@type': 'Person',
  name: 'Arata Inlooker',
  url: 'https://inlooker.top',
  email: 'aratainlooker@gmail.com'
};

const PUBLISHER = {
  '@type': 'Organization',
  name: 'CraftIndex',
  url: DOMAIN,
  logo: {
    '@type': 'ImageObject',
    url: `${DOMAIN}/images/craftindex-logo.png`
  }
};

// Generate documentation HTML for /docs/ initial HTML response
function getDocsInitialHtml() {
  const docPath = path.resolve(__dirname, 'docs', 'CRAFTINDEX_DOCUMENTATION.md');
  let md = '';
  try {
    md = fs.readFileSync(docPath, 'utf-8');
  } catch (_) {}

  // Build clean HTML from markdown sections
  const lines = md.split('\n');
  let bodyHtml = `
  <div class="standalone-docs-container" id="standaloneDocsView">
    <div class="doc-header-banner">
      <div class="doc-header-badge">⚡ OFFICIAL DOCUMENTATION & ARCHITECTURE</div>
      <h1 class="doc-main-title">CraftIndex Documentation</h1>
      <p class="doc-main-subtitle">Comprehensive guide to Minecraft resource discovery, Pack Studio workflows, persistent IndexedDB binary storage, and manifest schemas.</p>
      
      <div class="doc-creator-pill-card">
        <div class="doc-creator-avatar">AI</div>
        <div class="doc-creator-info">
          <div class="doc-creator-name">Arata Inlooker <span class="doc-creator-tag">Authoritative Maintainer</span></div>
          <div class="doc-creator-desc">Independent developer working across software systems, web engineering, and networking infrastructure.</div>
        </div>
        <div class="doc-creator-actions">
          <a href="https://inlooker.top" target="_blank" rel="noopener noreferrer" class="doc-pill-btn">Portfolio ↗</a>
          <a href="https://github.com/ArataInlooker/CraftIndex" target="_blank" rel="noopener noreferrer" class="doc-pill-btn secondary">GitHub ↗</a>
        </div>
      </div>
    </div>

    <div class="doc-layout-grid">
      <nav class="doc-toc-sidebar" aria-label="Documentation table of contents">
        <h2 class="doc-toc-title">Table of Contents</h2>
        <ul class="doc-toc-list">
          <li><a href="/docs/#01-overview">01. Overview</a></li>
          <li><a href="/docs/#02-introduction">02. Introduction</a></li>
          <li><a href="/docs/#03-why-craftindex">03. Why CraftIndex</a></li>
          <li><a href="/docs/#04-who-it-is-for">04. Who It Is For</a></li>
          <li><a href="/docs/#05-resource-categories">05. Resource Categories</a></li>
          <li><a href="/docs/#06-how-the-interface-works">06. Interface Workflow</a></li>
          <li><a href="/docs/#07-supported-sources">07. Supported Sources</a></li>
          <li><a href="/docs/#08-resource-discovery">08. Resource Discovery</a></li>
          <li><a href="/docs/#09-collections">09. Collections Cart</a></li>
          <li><a href="/docs/#10-pack-studio-collection-exports">10. Pack Studio &amp; Exports</a></li>
          <li><a href="/docs/#11-settings-preferences">11. Settings &amp; Preferences</a></li>
          <li><a href="/docs/#12-settings-import-export">12. Settings Transfer</a></li>
          <li><a href="/docs/#13-modpack-import-export">13. Modpack Interop</a></li>
          <li><a href="/docs/#14-data-browser-storage">14. IndexedDB &amp; Storage</a></li>
          <li><a href="/docs/#15-technical-architecture">15. Technical Architecture</a></li>
          <li><a href="/docs/#16-api-backend">16. API &amp; Proxy</a></li>
          <li><a href="/docs/#17-hosting-deployment">17. Hosting &amp; Deployment</a></li>
          <li><a href="/docs/#18-standalone-version">18. Standalone Distribution</a></li>
          <li><a href="/docs/#19-privacy-security">19. Privacy &amp; Security</a></li>
          <li><a href="/docs/#20-compatibility">20. Compatibility Matrix</a></li>
          <li><a href="/docs/#21-troubleshooting">21. Troubleshooting Guide</a></li>
          <li><a href="/docs/#22-frequently-asked-questions-faq">22. FAQ</a></li>
          <li><a href="/docs/#23-credits-project-links">23. Credits &amp; Legal</a></li>
        </ul>
      </nav>

      <article class="doc-article-content">
  `;

  // Parse markdown headings and text simply into valid HTML
  let inCode = false;
  let inList = false;
  let codeBuffer = '';

  for (let line of lines) {
    line = line.trimEnd();
    if (line.startsWith('```')) {
      if (inCode) {
        bodyHtml += `<pre><code>${escapeHtml(codeBuffer)}</code></pre>\n`;
        codeBuffer = '';
        inCode = false;
      } else {
        if (inList) { bodyHtml += '</ul>\n'; inList = false; }
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuffer += line + '\n';
      continue;
    }

    if (line.startsWith('# ')) {
      if (inList) { bodyHtml += '</ul>\n'; inList = false; }
      const text = line.slice(2).trim();
      bodyHtml += `<h1 id="${slugify(text)}">${escapeHtml(text)}</h1>\n`;
    } else if (line.startsWith('## ')) {
      if (inList) { bodyHtml += '</ul>\n'; inList = false; }
      const text = line.slice(3).trim();
      bodyHtml += `<h2 id="${slugify(text)}">${escapeHtml(text)}</h2>\n`;
    } else if (line.startsWith('### ')) {
      if (inList) { bodyHtml += '</ul>\n'; inList = false; }
      const text = line.slice(4).trim();
      bodyHtml += `<h3 id="${slugify(text)}">${escapeHtml(text)}</h3>\n`;
    } else if (line.startsWith('- ')) {
      if (!inList) { bodyHtml += '<ul class="doc-list">\n'; inList = true; }
      bodyHtml += `  <li>${formatInline(line.slice(2))}</li>\n`;
    } else if (/^\d+\.\s/.test(line)) {
      if (inList) { bodyHtml += '</ul>\n'; inList = false; }
      const itemText = line.replace(/^\d+\.\s+/, '');
      bodyHtml += `<div class="doc-numbered-step">${formatInline(itemText)}</div>\n`;
    } else if (line.startsWith('> ')) {
      if (inList) { bodyHtml += '</ul>\n'; inList = false; }
      bodyHtml += `<blockquote>${formatInline(line.slice(2))}</blockquote>\n`;
    } else if (line.trim() === '---') {
      if (inList) { bodyHtml += '</ul>\n'; inList = false; }
      bodyHtml += '<hr class="doc-divider" />\n';
    } else if (line.trim().length > 0) {
      if (inList) { bodyHtml += '</ul>\n'; inList = false; }
      bodyHtml += `<p>${formatInline(line)}</p>\n`;
    }
  }

  if (inList) bodyHtml += '</ul>\n';
  bodyHtml += `
      </article>
    </div>
  </div>
  `;
  return bodyHtml;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function formatInline(str) {
  return str
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
}

function getSocialsInitialHtml() {
  return `
  <div class="standalone-socials-container" id="standaloneSocialsView">
    <div class="socials-hero-banner">
      <div class="socials-hero-badge">✦ OFFICIAL DIRECT CONTACT &amp; SOCIALS</div>
      <h1 class="socials-main-title">Arata Inlooker &middot; Socials &amp; Direct Channels</h1>
      <p class="socials-main-subtitle">Official communication channels for creator and maintainer of CraftIndex. Direct messages and collaboration inquiries accepted.</p>
      
      <div class="creator-card socials-creator-card">
        <div class="creator-top-row">
          <div class="creator-avatar" aria-hidden="true">AI</div>
          <div class="creator-info">
            <h2 class="creator-name">Arata Inlooker</h2>
            <span class="creator-role">Creator &amp; Maintainer &bull; CraftIndex</span>
          </div>
          <a href="https://inlooker.top" target="_blank" rel="noopener noreferrer" class="creator-portfolio-btn" title="Open Arata Inlooker's Portfolio in a new tab">
            Visit Portfolio ↗
          </a>
        </div>
        <p class="creator-bio">
          Independent developer building performant Minecraft tooling and systems architecture. Direct messages, questions, and sponsorship inquiries are accepted across the official accounts below.
        </p>
        <div class="socials-dm-status">
          <span class="status-dot"></span> <strong>Direct Messages (DMs) Accepted</strong>
        </div>
      </div>
    </div>

    <!-- 4 Official Social Cards (Zero GitHub, Zero LinkedIn) -->
    <div class="socials-cards-grid">
      <!-- 1. Discord -->
      <div class="social-card discord-card">
        <div class="social-card-top">
          <div class="social-icon-box discord">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
          </div>
          <div class="social-info">
            <div class="social-header-row">
              <h3 class="social-platform-title">Discord</h3>
              <span class="social-pill-badge dm-badge">Accepted DMs</span>
            </div>
            <div class="social-username" id="discordUserText">arata_inlooker</div>
          </div>
        </div>
        <p class="social-card-desc">Send direct messages for inquiries, sponsorship, or feedback on CraftIndex.</p>
        <div class="social-card-actions">
          <button type="button" class="btn p copy-discord-btn" onclick="copyDiscordUsername(this)" aria-label="Copy Discord username arata_inlooker">
            Copy Discord ↗
          </button>
          <a href="https://discord.com/app" target="_blank" rel="noopener noreferrer" class="btn" aria-label="Go to Discord web app">
            Go to Discord ↗
          </a>
        </div>
      </div>

      <!-- 2. X (Twitter) -->
      <div class="social-card x-card">
        <div class="social-card-top">
          <div class="social-icon-box x">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </div>
          <div class="social-info">
            <div class="social-header-row">
              <h3 class="social-platform-title">X (Twitter)</h3>
              <span class="social-pill-badge">Official</span>
            </div>
            <div class="social-username">@arata_inlooker</div>
          </div>
        </div>
        <p class="social-card-desc">Follow project updates, engineering announcements, and Minecraft tooling releases.</p>
        <div class="social-card-actions">
          <a href="https://x.com/arata_inlooker" target="_blank" rel="noopener noreferrer" class="btn p" aria-label="Visit X profile @arata_inlooker">
            Visit X ↗
          </a>
        </div>
      </div>

      <!-- 3. Instagram -->
      <div class="social-card insta-card">
        <div class="social-card-top">
          <div class="social-icon-box instagram">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
          </div>
          <div class="social-info">
            <div class="social-header-row">
              <h3 class="social-platform-title">Instagram</h3>
              <span class="social-pill-badge">Official</span>
            </div>
            <div class="social-username">@arata_inlooker</div>
          </div>
        </div>
        <p class="social-card-desc">Visual development snapshots, UI/UX design experiments, and creator updates.</p>
        <div class="social-card-actions">
          <a href="https://instagram.com/arata_inlooker" target="_blank" rel="noopener noreferrer" class="btn p" aria-label="Visit Instagram profile @arata_inlooker">
            Visit Instagram ↗
          </a>
        </div>
      </div>

      <!-- 4. Email -->
      <div class="social-card email-card">
        <div class="social-card-top">
          <div class="social-icon-box email">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <div class="social-info">
            <div class="social-header-row">
              <h3 class="social-platform-title">Email</h3>
              <span class="social-pill-badge">Direct</span>
            </div>
            <div class="social-username">aratainlooker@gmail.com</div>
          </div>
        </div>
        <p class="social-card-desc">For formal partnerships, bug bounties, technical inquiries, or platform discussions.</p>
        <div class="social-card-actions">
          <a href="https://mail.google.com/mail/?view=cm&fs=1&to=aratainlooker%40gmail.com" target="_blank" rel="noopener noreferrer" class="btn p" aria-label="Send email to aratainlooker@gmail.com via Gmail">
            Send an Email ↗
          </a>
        </div>
      </div>
    </div>
  </div>
  `;
}

const ROUTE_CONFIG = {
  '': {
    title: 'CraftIndex | Minecraft Resource Discovery & Modpack Builder',
    description: 'CraftIndex: Lightning-fast Minecraft resource discovery engine, Pack Studio, and collection packager. Discover, curate, inspect and export mods, plugins, shaders, and resource packs with zero friction.',
    canonicalPath: '/',
    ogType: 'website',
    initialBodyHtml: '',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${DOMAIN}/#website`,
          url: `${DOMAIN}/`,
          name: 'CraftIndex',
          description: 'Lightning-fast Minecraft resource discovery engine, Pack Studio, and collection packager.',
          author: AUTHOR,
          publisher: PUBLISHER,
          potentialAction: {
            '@type': 'SearchAction',
            target: `${DOMAIN}/mods/?q={search_term_string}`,
            'query-input': 'required name=search_term_string'
          },
          inLanguage: 'en-US'
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${DOMAIN}/#software`,
          name: 'CraftIndex',
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web, Windows, macOS, Linux',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD'
          },
          author: AUTHOR
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${DOMAIN}/#breadcrumbs`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` }
          ]
        }
      ]
    }
  },

  'studio': {
    title: 'Pack Studio | CraftIndex',
    description: 'Compose custom Minecraft modpacks and multi-resource collections in CraftIndex Pack Studio. Drag-and-drop ZIP inspection, persistent IndexedDB binary storage, and clean export.',
    canonicalPath: '/studio/',
    ogType: 'website',
    initialBodyHtml: `
      <section class="seo-crawler-intro" aria-label="Pack Studio">
        <h1>CraftIndex Pack Studio | In-Browser Modpack Builder & Archive Packaging</h1>
        <p class="seo-crawler-lead">CraftIndex Pack Studio empowers players and administrators to curate, inspect, and package multi-resource collections into standard-compliant Minecraft archives with persistent IndexedDB binary storage.</p>
        <div class="seo-crawler-features">
          <div class="seo-feature-item"><strong>Binary Persistence:</strong> Raw files stored locally as Blobs in CraftIndexDB IndexedDB with SHA-256 integrity checks.</div>
          <div class="seo-feature-item"><strong>Automated Manifests:</strong> Generates craftindex_manifest.json (schema 1.0.0) alongside Modrinth .mrpack compatibility.</div>
          <div class="seo-feature-item"><strong>Organized Folders:</strong> Automatic routing into mods/, plugins/, resourcepacks/, shaderpacks/, and datapacks/.</div>
        </div>
      </section>
    `,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'SoftwareApplication',
          '@id': `${DOMAIN}/studio/#software`,
          name: 'CraftIndex Pack Studio',
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Web, Windows, macOS, Linux',
          description: 'Custom modpack composer, ZIP archive inspector, and persistent binary packager for Minecraft.',
          author: AUTHOR,
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${DOMAIN}/studio/#breadcrumbs`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` },
            { '@type': 'ListItem', position: 2, name: 'Pack Studio', item: `${DOMAIN}/studio/` }
          ]
        }
      ]
    }
  },

  'docs': {
    title: 'CraftIndex Documentation | Complete User Guide & Technical Reference',
    description: 'Comprehensive documentation for CraftIndex: Minecraft resource discovery, Pack Studio workflows, persistent IndexedDB storage, manifest schemas, and API integration.',
    canonicalPath: '/docs/',
    ogType: 'article',
    getInitialHtml: getDocsInitialHtml,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'TechArticle',
          '@id': `${DOMAIN}/docs/#article`,
          url: `${DOMAIN}/docs/`,
          headline: 'CraftIndex Official Documentation & Engineering Architecture',
          description: 'Comprehensive guide covering Minecraft resource discovery, client-side ZIP packaging, IndexedDB binary storage, and manifest schemas.',
          author: AUTHOR,
          publisher: PUBLISHER,
          datePublished: '2026-10-25',
          dateModified: '2026-11-02',
          inLanguage: 'en-US'
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${DOMAIN}/docs/#breadcrumbs`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` },
            { '@type': 'ListItem', position: 2, name: 'Documentation', item: `${DOMAIN}/docs/` }
          ]
        }
      ]
    }
  },

  'socials': {
    title: 'Official Socials & Creator Contact | CraftIndex',
    description: 'Official direct contact channels for Arata Inlooker, creator and maintainer of CraftIndex. Discord (Accepted DMs: arata_inlooker), X (@arata_inlooker), Instagram (@arata_inlooker), and Email.',
    canonicalPath: '/socials/',
    ogType: 'profile',
    getInitialHtml: getSocialsInitialHtml,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Person',
          '@id': `${DOMAIN}/socials/#person`,
          name: 'Arata Inlooker',
          url: 'https://inlooker.top',
          email: 'aratainlooker@gmail.com',
          sameAs: [
            'https://x.com/arata_inlooker',
            'https://instagram.com/arata_inlooker',
            'https://discord.com/app'
          ],
          jobTitle: 'Software Systems & Web Engineer',
          description: 'Creator and maintainer of CraftIndex.'
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${DOMAIN}/socials/#breadcrumbs`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` },
            { '@type': 'ListItem', position: 2, name: 'Socials', item: `${DOMAIN}/socials/` }
          ]
        }
      ]
    }
  },

  'mods': {
    title: 'Minecraft Mods | CraftIndex',
    description: 'Discover and download top Minecraft mods across Modrinth and CurseForge. Filter by Fabric, Forge, NeoForge, and Quilt with automated dependency detection and pack export.',
    canonicalPath: '/mods/',
    category: 'Mods',
    loaders: ['fabric', 'forge', 'neoforge', 'quilt'],
    ogType: 'website'
  },

  'mods/fabric': {
    title: 'Fabric Mods for Minecraft | CraftIndex',
    description: 'Explore high-performance Fabric mods for Minecraft. Curate Sodium, Lithium, Iris, and essential utility mods into your custom collection with zero friction.',
    canonicalPath: '/mods/fabric/',
    category: 'Mods',
    loader: 'Fabric',
    ogType: 'website'
  },

  'mods/forge': {
    title: 'Forge Mods for Minecraft | CraftIndex',
    description: 'Explore top Forge mods for Minecraft across all game versions. Seamlessly discover, inspect, and bundle Forge mods into organized collection archives.',
    canonicalPath: '/mods/forge/',
    category: 'Mods',
    loader: 'Forge',
    ogType: 'website'
  },

  'mods/neoforge': {
    title: 'NeoForge Mods for Minecraft | CraftIndex',
    description: 'Discover the latest NeoForge mods for modern Minecraft versions. Filter, inspect manifests, and bundle NeoForge mods into clean collection ZIPs.',
    canonicalPath: '/mods/neoforge/',
    category: 'Mods',
    loader: 'NeoForge',
    ogType: 'website'
  },

  'mods/quilt': {
    title: 'Quilt Mods for Minecraft | CraftIndex',
    description: 'Explore Quilt and Quilt-compatible mods for Minecraft. Build tailored modpacks with fast client-side packaging and persistent storage.',
    canonicalPath: '/mods/quilt/',
    category: 'Mods',
    loader: 'Quilt',
    ogType: 'website'
  },

  'plugins': {
    title: 'Minecraft Plugins | CraftIndex',
    description: 'Discover high-performance server plugins for Paper, Spigot, Purpur, Velocity, and Sponge. Stage plugins into organized server folders and export instantly.',
    canonicalPath: '/plugins/',
    category: 'Plugins',
    loaders: ['paper', 'spigot', 'purpur', 'velocity', 'sponge'],
    ogType: 'website'
  },

  'resourcepacks': {
    title: 'Minecraft Resource Packs | CraftIndex',
    description: 'Browse curated Minecraft resource packs and texture packs across Modrinth and CurseForge. Preview resolutions, pack formats, and export to resourcepacks/.',
    canonicalPath: '/resourcepacks/',
    category: 'Resource Packs',
    ogType: 'website'
  },

  'shaders': {
    title: 'Minecraft Shaders | CraftIndex',
    description: 'Discover breathtaking shaderpacks for Minecraft with Iris and OptiFine support. Enhance lighting, shadows, and water with instant ZIP packaging.',
    canonicalPath: '/shaders/',
    category: 'Shaders',
    ogType: 'website'
  },

  'datapacks': {
    title: 'Minecraft Datapacks | CraftIndex',
    description: 'Find vanilla-friendly datapacks, custom world generation, crafting recipes, and structures. Download organized datapacks directly for your singleplayer or server worlds.',
    canonicalPath: '/datapacks/',
    category: 'Datapacks',
    ogType: 'website'
  },

  'modpacks': {
    title: 'Minecraft Modpacks | CraftIndex',
    description: 'Explore popular community modpacks from Modrinth and CurseForge. Import .mrpack archives into Pack Studio and inspect individual mod components.',
    canonicalPath: '/modpacks/',
    category: 'Modpacks',
    ogType: 'website'
  },

  'worlds': {
    title: 'Minecraft Worlds | CraftIndex',
    description: 'Discover community adventure maps, parkour challenges, puzzle worlds, and survival spawns from PlanetMinecraft and creators worldwide.',
    canonicalPath: '/worlds/',
    category: 'Worlds',
    ogType: 'website'
  },

  'serversoftwares': {
    title: 'Minecraft Server Software | CraftIndex',
    description: 'Compare and find optimized Minecraft server software implementations including PaperMC, Purpur, Folia, Velocity, and Fabric Server.',
    canonicalPath: '/serversoftwares/',
    category: 'Server Software',
    ogType: 'website'
  },

  'modloaders': {
    title: 'Minecraft Mod Loaders | CraftIndex',
    description: 'Information and guides for Minecraft mod loaders. Understand differences between Fabric, Forge, NeoForge, and Quilt for building modpacks.',
    canonicalPath: '/modloaders/',
    category: 'Mod Loaders',
    ogType: 'website'
  },

  'launchers': {
    title: 'Minecraft Launchers | CraftIndex',
    description: 'Discover modern open-source Minecraft launchers that seamlessly support CraftIndex modpack exports and custom collections.',
    canonicalPath: '/launchers/',
    category: 'Launchers',
    ogType: 'website'
  }
};

// Generate standard category and subcategory schemas & initial HTML dynamically
for (const [key, cfg] of Object.entries(ROUTE_CONFIG)) {
  if (key === '' || key === 'studio' || key === 'docs' || key === 'socials') continue;

  const isSubcategory = key.includes('/');
  const categoryName = cfg.category;
  const canonicalUrl = `${DOMAIN}${cfg.canonicalPath}`;

  // Breadcrumbs
  const breadcrumbElements = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${DOMAIN}/` }
  ];

  if (isSubcategory) {
    const parentPath = '/' + key.split('/')[0] + '/';
    breadcrumbElements.push({
      '@type': 'ListItem',
      position: 2,
      name: categoryName,
      item: `${DOMAIN}${parentPath}`
    });
    breadcrumbElements.push({
      '@type': 'ListItem',
      position: 3,
      name: cfg.loader || 'Subcategory',
      item: canonicalUrl
    });
  } else {
    breadcrumbElements.push({
      '@type': 'ListItem',
      position: 2,
      name: categoryName,
      item: canonicalUrl
    });
  }

  cfg.jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: cfg.title,
        description: cfg.description,
        isPartOf: { '@type': 'WebSite', '@id': `${DOMAIN}/#website`, name: 'CraftIndex', url: `${DOMAIN}/` },
        about: { '@type': 'Thing', name: `Minecraft ${cfg.loader ? cfg.loader + ' ' : ''}${categoryName}` }
      },
      {
        '@type': 'ItemList',
        '@id': `${canonicalUrl}#itemlist`,
        name: `${cfg.loader ? cfg.loader + ' ' : ''}${categoryName} Catalog`,
        description: cfg.description,
        numberOfItems: 24
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${canonicalUrl}#breadcrumbs`,
        itemListElement: breadcrumbElements
      }
    ]
  };

  cfg.initialBodyHtml = `
    <section class="seo-crawler-intro" aria-label="${escapeHtml(categoryName)} Discovery">
      <nav class="seo-breadcrumbs" aria-label="Breadcrumbs">
        <a href="/">Home</a> &gt; ${isSubcategory ? `<a href="/${key.split('/')[0]}/">${escapeHtml(categoryName)}</a> &gt; <span>${escapeHtml(cfg.loader)}</span>` : `<span>${escapeHtml(categoryName)}</span>`}
      </nav>
      <h1>${escapeHtml(cfg.title.split('|')[0].trim())}</h1>
      <p class="seo-crawler-lead">${escapeHtml(cfg.description)}</p>
      <div class="seo-crawler-features">
        <div class="seo-feature-item"><strong>Unified Discovery:</strong> Curate selections directly from Modrinth and CurseForge into your collection cart.</div>
        <div class="seo-feature-item"><strong>Pack Packaging:</strong> Export selected ${escapeHtml(categoryName.toLowerCase())} directly into standard Minecraft directories.</div>
        <div class="seo-feature-item"><strong>Persistent Storage:</strong> Local IndexedDB binary persistence keeps your downloaded archives intact across sessions.</div>
      </div>
    </section>
  `;
}

function resolveRouteKey(cleanPath) {
  let normalized = cleanPath.toLowerCase().replace(/^\/+|\/+$/g, '');
  if (!normalized) return '';
  if (ROUTE_CONFIG[normalized]) return normalized;

  // Check subcategory pattern (e.g. mods/fabric)
  const parts = normalized.split('/');
  if (parts.length === 2 && ROUTE_CONFIG[`${parts[0]}/${parts[1]}`]) {
    return `${parts[0]}/${parts[1]}`;
  }
  if (parts.length >= 1 && ROUTE_CONFIG[parts[0]]) {
    return parts[0];
  }
  return null;
}

function injectRouteHtml(rawHtml, cleanPath) {
  const routeKey = resolveRouteKey(cleanPath);
  const cfg = routeKey !== null ? ROUTE_CONFIG[routeKey] : ROUTE_CONFIG[''];
  if (!cfg) return rawHtml;

  const canonicalUrl = `${DOMAIN}${cfg.canonicalPath}`;
  const initialContent = cfg.getInitialHtml ? cfg.getInitialHtml() : (cfg.initialBodyHtml || '');

  let html = rawHtml;

  // 1. Replace Title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(cfg.title)}</title>`);

  // 2. Replace Meta Description
  html = html.replace(/<meta\s+name="description"[\s\S]*?>/i, `<meta name="description" content="${escapeHtml(cfg.description)}" />`);

  // 3. Replace Canonical Link
  html = html.replace(/<link\s+rel="canonical"[\s\S]*?>/i, `<link rel="canonical" href="${canonicalUrl}" />`);

  // 4. Replace Open Graph Tags
  html = html.replace(/<meta\s+property="og:title"[\s\S]*?>/i, `<meta property="og:title" content="${escapeHtml(cfg.title)}" />`);
  html = html.replace(/<meta\s+property="og:description"[\s\S]*?>/i, `<meta property="og:description" content="${escapeHtml(cfg.description)}" />`);
  html = html.replace(/<meta\s+property="og:url"[\s\S]*?>/i, `<meta property="og:url" content="${canonicalUrl}" />`);
  html = html.replace(/<meta\s+property="og:type"[\s\S]*?>/i, `<meta property="og:type" content="${cfg.ogType || 'website'}" />`);
  html = html.replace(/<meta\s+property="og:site_name"[\s\S]*?>/i, `<meta property="og:site_name" content="CraftIndex" />`);

  const imageUrl = `${DOMAIN}/images/bigger-image.png`;
  const imageAlt = "CraftIndex - Minecraft resource discovery, pack studio, and collection packager";

  html = html.replace(/<meta\s+property="og:image"[\s\S]*?>/i, `<meta property="og:image" content="${imageUrl}" />`);
  html = html.replace(/<meta\s+property="og:image:secure_url"[\s\S]*?>/i, `<meta property="og:image:secure_url" content="${imageUrl}" />`);
  html = html.replace(/<meta\s+property="og:image:type"[\s\S]*?>/i, `<meta property="og:image:type" content="image/png" />`);
  html = html.replace(/<meta\s+property="og:image:width"[\s\S]*?>/i, `<meta property="og:image:width" content="1672" />`);
  html = html.replace(/<meta\s+property="og:image:height"[\s\S]*?>/i, `<meta property="og:image:height" content="941" />`);
  html = html.replace(/<meta\s+property="og:image:alt"[\s\S]*?>/i, `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`);

  // 5. Replace Twitter Tags
  html = html.replace(/<meta\s+name="twitter:card"[\s\S]*?>/i, `<meta name="twitter:card" content="summary_large_image" />`);
  html = html.replace(/<meta\s+name="twitter:title"[\s\S]*?>/i, `<meta name="twitter:title" content="${escapeHtml(cfg.title)}" />`);
  html = html.replace(/<meta\s+name="twitter:description"[\s\S]*?>/i, `<meta name="twitter:description" content="${escapeHtml(cfg.description)}" />`);
  html = html.replace(/<meta\s+name="twitter:image"[\s\S]*?>/i, `<meta name="twitter:image" content="${imageUrl}" />`);
  html = html.replace(/<meta\s+name="twitter:image:alt"[\s\S]*?>/i, `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`);

  // 6. Replace Schema.org JSON-LD
  const jsonLdString = JSON.stringify(cfg.jsonLd, null, 2);
  html = html.replace(/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">\n${jsonLdString}\n    </script>`);

  // 7. Inject Initial HTML into <div class="gr" id="g">
  if (initialContent) {
    html = html.replace('<div class="gr" id="g"></div>', `<div class="gr" id="g">${initialContent}</div>`);
  }

  return html;
}

module.exports = {
  ROUTE_CONFIG,
  resolveRouteKey,
  injectRouteHtml,
  getDocsInitialHtml,
  getSocialsInitialHtml
};
