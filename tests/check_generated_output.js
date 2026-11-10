const fs = require('fs');
const path = require('path');

function getHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(getHtmlFiles(full));
    } else if (file.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

const htmls = getHtmlFiles('dist/pages');
console.log('Total pre-rendered HTML documents in dist/pages:', htmls.length);
for (const h of htmls) {
  const content = fs.readFileSync(h, 'utf8');
  const hasTitle = /<title>[^<]+<\/title>/.test(content);
  const hasBase = content.includes('<base href="/">');
  const hasTokens = content.includes('css/tokens.css');
  const hasStyles = content.includes('css/styles.css');
  const hasBodyTab = /<body[^>]*data-tab=/.test(content);
  console.log('  ' + path.relative('dist/pages', h).padEnd(28) + ' => Title: ' + hasTitle + ', Base: ' + hasBase + ', Tokens: ' + hasTokens + ', BodyTab: ' + hasBodyTab);
}

// Check sitemap-resources.xml and sitemap.xml
const sitemap = fs.readFileSync('dist/pages/sitemap.xml', 'utf8');
const sitemapResources = fs.readFileSync('dist/pages/sitemap-resources.xml', 'utf8');
console.log('\nSitemap.xml size:', sitemap.length, 'bytes');
console.log('Sitemap-resources.xml size:', sitemapResources.length, 'bytes');

// Check standalone
const standalone = fs.readFileSync('dist/index.standalone.html', 'utf8');
console.log('Standalone file size:', standalone.length, 'bytes');
