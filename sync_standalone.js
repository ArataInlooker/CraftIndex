const fs = require('fs');
const path = require('path');

let indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
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

// Replace <link rel="stylesheet" href="css/styles.css" /> with inline <style>
let standalone = indexHtml.replace(
  /<link rel="stylesheet" href="css\/styles\.css(?:\?[^"]*)?"\s*\/?>/,
  `<style>\n${stylesCss}\n</style>`
);

// Update config inside <script id="cfg" type="application/json"> with adjusted asset paths
const standaloneConfig = configJson.replace(/"images\//g, '"../images/');
standalone = standalone.replace(
  /<script id="cfg" type="application\/json">[\s\S]*?<\/script>/,
  `<script id="cfg" type="application/json">\n${standaloneConfig}\n</script>`
);

// Replace external about_docs.js script with inline script and adjusted asset paths
const standaloneDocs = aboutDocsJs.replace(/images\//g, '../images/');
standalone = standalone.replace(
  /<script src="js\/about_docs\.js(?:\?[^"]*)?"><\/script>/,
  `<script>\n${standaloneDocs}\n</script>`
);

// Replace external pack_studio.js script with inline script
standalone = standalone.replace(
  /<script src="js\/pack_studio\.js(?:\?[^"]*)?"><\/script>/,
  `<script>\n${packStudioJs}\n</script>`
);

// Replace external app.js script with inline app.js
standalone = standalone.replace(
  /<script src="js\/app\.js(?:\?[^"]*)?"><\/script>/,
  `<script>\n${appJs}\n</script>`
);

const outPath = path.join(distDir, 'index.standalone.html');
fs.writeFileSync(outPath, standalone, 'utf-8');
console.log('✅ dist/index.standalone.html synchronized successfully! File size:', fs.statSync(outPath).size, 'bytes');

