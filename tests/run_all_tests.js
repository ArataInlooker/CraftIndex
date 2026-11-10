/**
 * CraftIndex Master Test Runner & Deployment Quality Assurance Suite
 * Runs all validation suites in a predictable order and enforces strict exit codes:
 * 1. Documentation synchronization & markdown validity (build_docs.js)
 * 2. Security & API proxy / SSRF validation (test_pages_function.js)
 * 3. Pre-rendered distribution compilation (build_pages.js + sync_standalone.js)
 * 4. Preflight Pages deployment audit (verify_pages_deployment.js: 187 checks)
 * 5. Full-stack browser integration suite (server.js + round-trip + IDB + routing + visual)
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_PORT = 3000;

function runNodeScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const fullPath = path.isAbsolute(scriptPath) ? scriptPath : path.join(ROOT_DIR, scriptPath);
    const relPath = path.relative(ROOT_DIR, fullPath);
    console.log(`\n================================================================`);
    console.log(`RUNNING SUITE: ${relPath}`);
    console.log(`================================================================`);

    const child = spawn(process.execPath, [fullPath, ...args], {
      cwd: ROOT_DIR,
      stdio: 'inherit',
      env: { ...process.env, PORT: String(SERVER_PORT) }
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n>>> [PASS] ${relPath} exited with code 0\n`);
        resolve({ script: relPath, passed: true, code });
      } else {
        console.error(`\n>>> [FAIL] ${relPath} exited with code ${code}\n`);
        resolve({ script: relPath, passed: false, code });
      }
    });

    child.on('error', (err) => {
      console.error(`\n>>> [ERROR] Failed to spawn ${relPath}: ${err.message}\n`);
      resolve({ script: relPath, passed: false, error: err.message });
    });
  });
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.abort();
      resolve(false);
    });
  });
}

async function startServerIfNeeded() {
  const alreadyRunning = await isPortOpen(SERVER_PORT);
  if (alreadyRunning) {
    console.log(`CraftIndex server already active on port ${SERVER_PORT}.`);
    return { child: null, alreadyRunning: true };
  }

  console.log(`Starting CraftIndex production server on port ${SERVER_PORT}...`);
  const serverPath = path.join(ROOT_DIR, 'server.js');
  const child = spawn(process.execPath, [serverPath], {
    cwd: ROOT_DIR,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(SERVER_PORT) }
  });

  // Wait for server to become responsive
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await isPortOpen(SERVER_PORT)) {
      console.log(`Server responsive on http://localhost:${SERVER_PORT}/.`);
      return { child, alreadyRunning: false };
    }
  }

  throw new Error(`Timed out waiting for server to start on port ${SERVER_PORT}`);
}

async function stopServer(serverInfo) {
  if (serverInfo && serverInfo.child) {
    console.log('Shutting down runner-managed server process...');
    serverInfo.child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function runMasterTestSuite() {
  console.log('################################################################');
  console.log('CRAFTINDEX v2.6.0 MASTER VERIFICATION SUITE');
  console.log(`Node.js Runtime: ${process.version}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('################################################################\n');

  const suiteResults = [];

  // Phase 1: Documentation Audit
  suiteResults.push(await runNodeScript('build_docs.js'));

  // Phase 2: Security & API Proxy Tests (no browser/server required)
  suiteResults.push(await runNodeScript('tests/test_pages_function.js'));

  // Phase 3: Fresh Build Compilation
  suiteResults.push(await runNodeScript('build_pages.js'));
  suiteResults.push(await runNodeScript('sync_standalone.js'));

  // Phase 3b: Breadcrumb structured-data regression guard (generated output)
  suiteResults.push(await runNodeScript('tests/verify_breadcrumbs.js'));

  // Phase 4: Cloudflare Pages Deployment Preflight (self-hosting port 3033)
  suiteResults.push(await runNodeScript('tests/verify_pages_deployment.js'));

  // Phase 5: Live Server Integration Tests (require server on port 3000)
  let serverInfo = null;
  try {
    serverInfo = await startServerIfNeeded();

    // 5a. ZIP Round-Trip & Manifest 1.1.0 Verification
    suiteResults.push(await runNodeScript('tests/verify_zip_roundtrip.js'));

    // 5b. IndexedDB Binary Persistence Across Relaunch
    suiteResults.push(await runNodeScript('tests/verify_binary_persistence.js'));

    // 5c. Multi-Route SPA Navigation & Popstate
    suiteResults.push(await runNodeScript('tests/verify_browser_routing.js'));

    // 5d. Visual Header, Logo & Favicon Matrix
    suiteResults.push(await runNodeScript('tests/verify_header_logo_and_favicon.js'));
  } finally {
    if (serverInfo) {
      await stopServer(serverInfo);
    }
  }

  // Final Summary & Exit Code
  console.log('\n================================================================');
  console.log('MASTER TEST SUITE SUMMARY LEDGER');
  console.log('================================================================');

  let allPassed = true;
  for (const r of suiteResults) {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(` ${status}  ${r.script}`);
    if (!r.passed) allPassed = false;
  }

  console.log('================================================================');
  console.log(`OVERALL STATUS: ${allPassed ? 'ALL SUITES PASSED ✅' : 'TEST FAILURES DETECTED ❌'}`);
  console.log('================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runMasterTestSuite().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
