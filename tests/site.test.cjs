const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = name => readFileSync(path.join(root, name));
test('social cards reference an existing 1200 × 630 PNG on both pages', () => {
 const png = read('og-image.png');
 assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
 assert.equal(png.readUInt32BE(16), 1200);
 assert.equal(png.readUInt32BE(20), 630);
 for (const file of ['index.html', 'resume.html']) {
  const html = read(file).toString();
  assert.match(html, /property="og:image" content="https:\/\/robmorris.me\/og-image.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.match(html, /name="twitter:image:alt" content="[^"]+"/);
 }
});
test('deployment is static and has no retired chatbot function', () => {
 const config = JSON.parse(read('vercel.json'));
 assert.equal(config.functions, undefined);
 assert.equal(existsSync(path.join(root, 'api/chat.js')), false);
 assert.equal(existsSync(path.join(root, '.env.example')), false);
 assert.ok(config.headers[0].headers.some(h => h.key === 'X-Content-Type-Options'));
});
test('contact refinements remain accessible without raster company logos', () => {
 const html = read('index.html').toString();
 assert.equal((html.match(/class="company-logo company-logo-/g) || []).length, 2);
 assert.equal((html.match(/class="link-arrow link-arrow-download" aria-hidden="true"/g) || []).length, 2);
 assert.doesNotMatch(html, /class="file-type"|<image\b/);
});
