/**
 * CraftIndex Breadcrumb Structured-Data Regression Guard
 * -----------------------------------------------------
 * Pins the exact itemListElement content (count, position, name, absolute URL)
 * of the BreadcrumbList JSON-LD in generated output. This guards against BOTH
 * accidental loss of a route hierarchy AND a regression back to a misleading
 * multi-level homepage chain.
 *
 * Rationale (Finding 1 remediation):
 *  - Category routes MUST carry a real hierarchy (Home -> Category, and for
 *    subcategories Home -> Category -> Subcategory). The exact items are pinned
 *    below so an accidental reduction to a single Home item fails the build.
 *  - The homepage / standalone default is intentionally a single Home entry.
 *    The other top-level routes (Pack Studio, Mods, Documentation) are sibling
 *    sections, not ancestors of the homepage, so a single Home item is the
 *    correct schema.org representation there. Pinning it to exactly one item
 *    also prevents re-introducing a misleading 4-item homepage chain.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = path.join(ROOT, 'dist', 'pages');
const STANDALONE = path.join(ROOT, 'dist', 'index.standalone.html');
const DOMAIN = 'https://craftindex.inlooker.top';

function readBreadcrumb(html) {
  const m = html.match(/"@type": "BreadcrumbList"[\s\S]{0,1500}?\]/);
  if (!m) return { present: false, items: [] };
  const items = [...m[0].matchAll(/"position": (\d+),\s*"name": "([^"]+)",\s*"item": "([^"]+)"/g)].map((x) => ({
    position: Number(x[1]),
    name: x[2],
    item: x[3],
  }));
  return { present: true, items };
}

// Validate exact item list: full count, position, name AND item URL.
function validateExact(items, expected, label) {
  const errors = [];
  if (items.length !== expected.length) {
    errors.push(`expected exactly ${expected.length} items, got ${items.length}`);
  }
  expected.forEach((exp, i) => {
    const it = items[i];
    if (!it) {
      errors.push(`item ${i + 1} missing`);
      return;
    }
    if (it.position !== exp.position) {
      errors.push(`item ${i + 1} position expected ${exp.position}, got ${it.position}`);
    }
    if (it.name !== exp.name) {
      errors.push(`item ${i + 1} name expected "${exp.name}", got "${it.name}"`);
    }
    if (it.item !== exp.item) {
      errors.push(`item ${i + 1} URL expected "${exp.item}", got "${it.item}"`);
    }
  });
  if (errors.length) {
    console.error(`  ❌ FAIL: ${label} -> ${errors.join('; ')}`);
    return false;
  }
  console.log(`  ✅ PASS: ${label} (${expected.length} item(s): ${expected.map((e) => e.name).join(' > ')})`);
  return true;
}

let total = 0;
let passed = 0;

function checkRoute(rel, expected) {
  total++;
  const file = path.join(PAGES, rel, 'index.html');
  if (!fs.existsSync(file)) {
    console.error(`  ❌ FAIL: dist/pages/${rel}/index.html missing`);
    return;
  }
  const html = fs.readFileSync(file, 'utf-8');
  const { present, items } = readBreadcrumb(html);
  if (!present) {
    console.error(`  ❌ FAIL: dist/pages/${rel} has no BreadcrumbList`);
    return;
  }
  if (validateExact(items, expected, `dist/pages/${rel}`)) passed++;
}

// --- Route breadcrumbs: pin the exact hierarchy (count + names + URLs) -----
checkRoute('mods', [
  { position: 1, name: 'Home', item: `${DOMAIN}/` },
  { position: 2, name: 'Mods', item: `${DOMAIN}/mods/` },
]);

checkRoute('mods/fabric', [
  { position: 1, name: 'Home', item: `${DOMAIN}/` },
  { position: 2, name: 'Mods', item: `${DOMAIN}/mods/` },
  { position: 3, name: 'Fabric', item: `${DOMAIN}/mods/fabric/` },
]);

checkRoute('plugins', [
  { position: 1, name: 'Home', item: `${DOMAIN}/` },
  { position: 2, name: 'Plugins', item: `${DOMAIN}/plugins/` },
]);

checkRoute('studio', [
  { position: 1, name: 'Home', item: `${DOMAIN}/` },
  { position: 2, name: 'Pack Studio', item: `${DOMAIN}/studio/` },
]);

checkRoute('docs', [
  { position: 1, name: 'Home', item: `${DOMAIN}/` },
  { position: 2, name: 'Documentation', item: `${DOMAIN}/docs/` },
]);

// --- Standalone: must exist and carry exactly the Home-only homepage breadcrumb
total++;
if (fs.existsSync(STANDALONE)) {
  const html = fs.readFileSync(STANDALONE, 'utf-8');
  const { present, items } = readBreadcrumb(html);
  if (!present) {
    console.error('  ❌ FAIL: standalone has no BreadcrumbList');
  } else if (validateExact(items, [{ position: 1, name: 'Home', item: `${DOMAIN}/` }], 'standalone (homepage)')) {
    passed++;
  }
} else {
  console.error('  ❌ FAIL: dist/index.standalone.html missing');
}

console.log(`\nBREADCRUMB GUARD: ${passed}/${total} checks passed`);
process.exit(passed === total ? 0 : 1);
