const fs = require('fs');
const path = require('path');

let indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
// Replace <link rel="stylesheet" href="css/tokens.css" /> (design tokens)
// and <link rel="stylesheet" href="css/styles.css" /> with inline <style>,
// preserving their order: tokens must come before the component stylesheet
// so legacy aliases resolve through the token layer.
const tokensCss = fs.readFileSync(path.join(__dirname, 'css', 'tokens.css'), 'utf-8');
const stylesCss = fs.readFileSync(path.join(__dirname, 'css', 'styles.css'), 'utf-8');
const configJson = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8');
const aboutDocsJs = fs.readFileSync(path.join(__dirname, 'js', 'about_docs.js'), 'utf-8');
const packStudioJs = fs.readFileSync(path.join(__dirname, 'js', 'pack_studio.js'), 'utf-8');
const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf-8');

// Ensure dist directory exists
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Adjust relative asset paths for dist/ location
indexHtml = indexHtml.replace(/<base href="\/" \/>\r?\n?/, '');
indexHtml = indexHtml.replace(/href="images\//g, 'href="../images/');
indexHtml = indexHtml.replace(/content="images\//g, 'content="../images/');
indexHtml = indexHtml.replace(/src="images\//g, 'src="../images/');
indexHtml = indexHtml.replace(/href="fonts\//g, 'href="../fonts/');
indexHtml = indexHtml.replace(/src="js\/vendor\//g, 'src="../js/vendor/');
indexHtml = indexHtml.replace(/src="media\//g, 'src="../media/');
indexHtml = indexHtml.replace(/href="favicon\.ico"/g, 'href="../favicon.ico"');
indexHtml = indexHtml.replace(/href="site\.webmanifest"/g, 'href="../site.webmanifest"');

// Inline stylesheets in source order: tokens.css BEFORE styles.css so any
// custom-property dependency is defined ahead of its consumers. var()
// resolution is order-independent, but this keeps standalone output
// consistent with index.html and makes token availability deterministic.
let standalone = indexHtml.replace(
  /<link rel="stylesheet" href="css\/tokens\.css(?:\?[^"]*)?"\s*\/?>/,
  `<style>\n${tokensCss}\n</style>`
);

standalone = standalone.replace(
  /<link rel="stylesheet" href="css\/styles\.css(?:\?[^"]*)?"\s*\/?>/,
  `<style>\n${stylesCss}\n</style>`
);

// Update config inside <script id="cfg" type="application/json"> with adjusted asset paths
const standaloneConfig = configJson.replace(/"images\//g, '"../images/');
standalone = standalone.replace(
  /<script id="cfg" type="application\/json">[\s\S]*?<\/script>/,
  `<script id="cfg" type="application/json">\n${standaloneConfig}\n</script>`
);

// Inline the heavy feature modules (about_docs.js, pack_studio.js) and the
// main app.js. These are injected unconditionally ahead of app.js so the
// standalone file is fully self-contained and offline-capable even though
// index.html now lazy-loads them externally (app.js guards its references,
// so the pre-defined globals simply resolve without any network fetch).
const standaloneDocs = aboutDocsJs.replace(/images\//g, '../images/');
const standaloneFeatureScripts =
  `<script>\n${standaloneDocs}\n</script>\n` +
  `<script>\n${packStudioJs}\n</script>\n`;

// Replace external about_docs.js script with inline script (if still present)
standalone = standalone.replace(
  /<script src="js\/about_docs\.js(?:\?[^"]*)?"><\/script>/,
  `<script>\n${standaloneDocs}\n</script>`
);

// Replace external pack_studio.js script with inline script (if still present)
standalone = standalone.replace(
  /<script src="js\/pack_studio\.js(?:\?[^"]*)?"><\/script>/,
  `<script>\n${packStudioJs}\n</script>`
);

// Replace external app.js script with inline app.js, prepending the feature
// scripts so order is preserved (docs -> studio -> app).
standalone = standalone.replace(
  /<script src="js\/app\.js(?:\?[^"]*)?"><\/script>/,
  `${standaloneFeatureScripts}<script>\n${appJs}\n</script>`
);

const outPath = path.join(distDir, 'index.standalone.html');
// Integrity guard: both token and component stylesheets MUST be inlined,
// in the correct order, and the legacy design tokens must resolve.
if (!standalone.includes(tokensCss) || !standalone.includes(stylesCss)) {
  throw new Error('sync_standalone: inline style substitution failed — tokens.css or styles.css missing from dist output.');
}
const LEGACY_TOKENS = ['--r2', '--bd', '--w', '--g', '--on', '--red'];
for (const tok of LEGACY_TOKENS) {
  if (!tokensCss.includes(tok + ':')) {
    throw new Error(`sync_standalone: legacy design token ${tok} is missing from css/tokens.css.`);
  }
  if (!standalone.includes(tok + ':')) {
    throw new Error(`sync_standalone: legacy design token ${tok} is missing from standalone output.`);
  }
}
const tokIdx = standalone.indexOf(tokensCss);
const styleIdx = standalone.indexOf(stylesCss);
if (tokIdx === -1 || styleIdx === -1 || tokIdx > styleIdx) {
  throw new Error('sync_standalone: token stylesheet must be inlined before the component stylesheet.');
}
fs.writeFileSync(outPath, standalone, 'utf-8');
console.log('✅ dist/index.standalone.html synchronized successfully! File size:', fs.statSync(outPath).size, 'bytes');

