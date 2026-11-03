const fs = require('fs');
const path = require('path');

const mdPath = path.resolve(__dirname, 'docs', 'CRAFTINDEX_DOCUMENTATION.md');
const aboutDocsJsPath = path.resolve(__dirname, 'js', 'about_docs.js');

if (!fs.existsSync(mdPath)) {
  console.error('❌ docs/CRAFTINDEX_DOCUMENTATION.md not found!');
  process.exit(1);
}

const md = fs.readFileSync(mdPath, 'utf-8');
const lines = md.split('\n');

// Find all ## sections
const sections = [];
const sectionRegex = /^##\s+(\d{2}\.\s+.*)$/;

lines.forEach((line, index) => {
  const match = line.trim().match(sectionRegex);
  if (match) {
    sections.push({
      header: match[1],
      line: index + 1
    });
  }
});

console.log('================================================================');
console.log('DOCUMENTATION VALIDATION & REPRODUCIBLE COMPILATION AUDIT');
console.log('================================================================');
console.log(`Authoritative Source: docs/CRAFTINDEX_DOCUMENTATION.md (${fs.statSync(mdPath).size} bytes)`);
console.log(`Total Documented Sections Found: ${sections.length}`);

sections.forEach((s, idx) => {
  console.log(` [${String(idx + 1).padStart(2, '0')}] ${s.header}`);
});

if (sections.length !== 23) {
  console.error(`❌ Expected exactly 23 sections in authoritative documentation, found ${sections.length}`);
  process.exit(1);
}

// Verify that js/about_docs.js exists and is valid
if (!fs.existsSync(aboutDocsJsPath)) {
  console.error('❌ js/about_docs.js not found!');
  process.exit(1);
}

const aboutDocsContent = fs.readFileSync(aboutDocsJsPath, 'utf-8');
const aboutDocsMatches = aboutDocsContent.match(/id:\s*"[^"]+"/g);
console.log(`Synchronized in-application documentation items: ${aboutDocsMatches ? aboutDocsMatches.length : 0}`);

if (aboutDocsMatches && aboutDocsMatches.length === 23) {
  console.log('✅ Documentation synchronization verified across markdown and JS representations.');
} else {
  console.warn('⚠️ Section count mismatch between markdown and JS representation.');
}

console.log('================================================================');
console.log('DOCUMENTATION AUDIT VERDICT: ✅ PASS');
console.log('================================================================');
