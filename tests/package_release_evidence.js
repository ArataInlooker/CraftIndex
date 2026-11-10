const fs = require('fs');
const path = require('path');
const JSZip = require('../js/vendor/jszip.min.js');

async function packageEvidence() {
  console.log('================================================================');
  console.log('PACKAGING CRAFTINDEX v2.6.1 RELEASE EVIDENCE ARCHIVE');
  console.log('================================================================\n');

  const zip = new JSZip();
  const screenshotsDir = path.resolve(__dirname, 'screenshots_v261');
  const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));

  console.log(`Found ${files.length} PNG screenshot files in ${screenshotsDir}.`);

  // Priority reproduction screenshots list
  const primaryReproduction = [
    'remediation_screenshot_a_advertise_light.png',
    'remediation_screenshot_a_advertise_dark.png',
    'remediation_screenshot_b_dependencies_light.png',
    'remediation_screenshot_b_dependencies_dark.png'
  ];

  // 1. Add Primary Reproduction Screenshots folder
  const primaryFolder = zip.folder('01_primary_reproduction_evidence');
  for (const pf of primaryReproduction) {
    const fullPath = path.join(screenshotsDir, pf);
    if (fs.existsSync(fullPath)) {
      const data = fs.readFileSync(fullPath);
      primaryFolder.file(pf, data);
      console.log(`  + [Primary] ${pf} (${(data.length / 1024).toFixed(1)} KB)`);
    } else {
      console.error(`  ! Missing primary file: ${pf}`);
    }
  }

  // 2. Add All Supporting Screenshots folder
  const allFolder = zip.folder('02_all_application_screenshots');
  for (const f of files) {
    const fullPath = path.join(screenshotsDir, f);
    const data = fs.readFileSync(fullPath);
    allFolder.file(f, data);
  }
  console.log(`  + Added all ${files.length} PNG screenshots to 02_all_application_screenshots/`);

  // 3. Add Raw Contrast Audit Data & Summary
  const rawAuditPath = path.resolve(__dirname, '..', 'information', 'RAW_LIGHT_THEME_CONTRAST_AUDIT.json');
  if (fs.existsSync(rawAuditPath)) {
    const rawData = fs.readFileSync(rawAuditPath, 'utf8');
    zip.file('RAW_LIGHT_THEME_CONTRAST_AUDIT.json', rawData);
    console.log(`  + Added RAW_LIGHT_THEME_CONTRAST_AUDIT.json (${(rawData.length / 1024).toFixed(1)} KB)`);
  }

  // 4. Add Summary Index Markdown inside ZIP
  const summaryContent = `# CraftIndex v2.6.1 Release Evidence Manifest

This archive contains authoritative visual and mathematical contrast evidence for the CraftIndex v2.6.1 release.

## Contents
1. **01_primary_reproduction_evidence/**:
   - \`remediation_screenshot_a_advertise_light.png\` (Advertise modal in Light Theme, high-contrast headings & readable bullets)
   - \`remediation_screenshot_a_advertise_dark.png\` (Advertise modal in Dark Theme)
   - \`remediation_screenshot_b_dependencies_light.png\` (Dependencies modal in Light Theme, readable lead & callout)
   - \`remediation_screenshot_b_dependencies_dark.png\` (Dependencies modal in Dark Theme)
2. **02_all_application_screenshots/**:
   - Full 21-file capture across Homepage, Category Catalog, Resource Details, Pack Studio, Docs, Settings, History, Cart Drawer, and Socials.
3. **RAW_LIGHT_THEME_CONTRAST_AUDIT.json**:
   - Complete machine-readable audit ledger of all 84 audited component states, with exact sRGB coordinates, alpha compositing layers, and 2-decimal truncated contrast ratios.

## Key Mathematical Verification
- All ordinary text complies with WCAG 2.2 AA (>= 4.5:1).
- Lowest measured ratio in the application: **4.53 : 1** (Modrinth Source Link & Resource Packs Chip).
- Special Rate Banner Lead Text: **7.93 : 1** (FG: #713f12, BG: #faf6d7).
- Special Rate Price Label: **17.00 : 1** (FG: #180c2e, BG: #faf6d7).
- Active Navigation Tab: **8.72 : 1** (FG: #6b21a8, BG: #ffffff).
`;
  zip.file('README_EVIDENCE_SUMMARY.md', summaryContent);

  // Generate ZIP file
  const outZipPath = path.resolve(__dirname, '..', 'information', 'craftindex_v261_release_evidence.zip');
  console.log('\nCompiling compressed ZIP buffer...');
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  fs.writeFileSync(outZipPath, buffer);
  const sizeMb = (buffer.length / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Release evidence archive created successfully!`);
  console.log(`   Path: ${outZipPath}`);
  console.log(`   File size: ${buffer.length.toLocaleString()} bytes (${sizeMb} MB)`);
  console.log(`   Total screenshots packaged: ${files.length} unique PNG files (plus 4 in priority folder)`);
}

packageEvidence().catch(console.error);
