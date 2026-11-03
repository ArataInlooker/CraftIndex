const { onRequest } = require('../functions/api/fetch.js');

async function testPagesFunction() {
  console.log('Testing Cloudflare Pages Function: /api/fetch...');
  let passed = 0;
  let total = 0;

  function assert(title, cond, detail = '') {
    total++;
    if (cond) {
      passed++;
      console.log(`✅ PASS: ${title} ${detail ? '(' + detail + ')' : ''}`);
    } else {
      console.error(`❌ FAIL: ${title} ${detail ? '(' + detail + ')' : ''}`);
    }
  }

  // 1. Test OPTIONS preflight
  const optReq = new Request('http://localhost/api/fetch', { method: 'OPTIONS' });
  const optRes = await onRequest({ request: optReq, env: {} });
  assert('OPTIONS returns 204', optRes.status === 204);
  assert('OPTIONS has CORS origin *', optRes.headers.get('Access-Control-Allow-Origin') === '*');

  // 2. Test missing url parameter
  const noUrlReq = new Request('http://localhost/api/fetch', { method: 'GET' });
  const noUrlRes = await onRequest({ request: noUrlReq, env: {} });
  assert('Missing url returns 400', noUrlRes.status === 400);

  // 3. Test SSRF protection - localhost rejection
  const ssrfReq1 = new Request('http://localhost/api/fetch?url=http://localhost:3000/admin', { method: 'GET' });
  const ssrfRes1 = await onRequest({ request: ssrfReq1, env: {} });
  assert('SSRF localhost rejected with 403', ssrfRes1.status === 403);

  // 4. Test SSRF protection - private IP rejection (169.254.169.254, 10.0.0.1, 192.168.1.1)
  const ssrfReq2 = new Request('http://localhost/api/fetch?url=http://169.254.169.254/latest/meta-data', { method: 'GET' });
  const ssrfRes2 = await onRequest({ request: ssrfReq2, env: {} });
  assert('SSRF AWS metadata IP rejected with 403', ssrfRes2.status === 403);

  const ssrfReq3 = new Request('http://localhost/api/fetch?url=http://10.0.0.1/admin', { method: 'GET' });
  const ssrfRes3 = await onRequest({ request: ssrfReq3, env: {} });
  assert('SSRF private IP 10.0.0.1 rejected with 403', ssrfRes3.status === 403);

  const ssrfReq4 = new Request('http://localhost/api/fetch?url=http://192.168.1.1/router', { method: 'GET' });
  const ssrfRes4 = await onRequest({ request: ssrfReq4, env: {} });
  assert('SSRF private IP 192.168.1.1 rejected with 403', ssrfRes4.status === 403);

  // 5. Test Non-HTTP protocol rejection (file://)
  const fileProtoReq = new Request('http://localhost/api/fetch?url=file:///etc/passwd', { method: 'GET' });
  const fileProtoRes = await onRequest({ request: fileProtoReq, env: {} });
  assert('Non-HTTP file:// protocol rejected with 403', fileProtoRes.status === 403);

  // 6. Test Non-whitelisted domain rejection
  const nonWhiteReq = new Request('http://localhost/api/fetch?url=https://evil-attacker.com/steal', { method: 'GET' });
  const nonWhiteRes = await onRequest({ request: nonWhiteReq, env: {} });
  assert('Non-whitelisted domain rejected with 403', nonWhiteRes.status === 403);

  // 6. Test Whitelisted domain allow (api.modrinth.com)
  const validReq = new Request('http://localhost/api/fetch?url=https://api.modrinth.com/v2/search?limit=1', { method: 'GET' });
  const validRes = await onRequest({ request: validReq, env: {} });
  assert('Whitelisted Modrinth API allowed (status 200)', validRes.status === 200);
  const data = await validRes.json();
  assert('Valid JSON response returned from upstream', Array.isArray(data.hits));

  console.log(`\nPages Function Tests: ${passed} / ${total} PASSED\n`);
  if (passed !== total) process.exit(1);
}

testPagesFunction().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
