import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(rootDirectory, file), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [indexHtml, resumeHtml, siteCss, siteJs, sourceCss, sourceJs, resumeCss, sourceResumeCss, apiJs] = await Promise.all([
  read('index.html'),
  read('resume.html'),
  read('assets/styles.css'),
  read('assets/site.js'),
  read('src/styles.css'),
  read('src/site.js'),
  read('assets/resume.css'),
  read('src/resume.css'),
  read('api/chat.js')
]);

assert(!/{{[A-Z0-9_]+}}/.test(indexHtml + resumeHtml), 'Generated HTML contains an unresolved template value.');
assert(siteCss === sourceCss, 'assets/styles.css is out of sync with src/styles.css.');
assert(siteJs === sourceJs, 'assets/site.js is out of sync with src/site.js.');
assert(resumeCss === sourceResumeCss, 'assets/resume.css is out of sync with src/resume.css.');
assert(resumeHtml.includes('| Resume'), 'The generated resume preview has a stale title.');
assert(indexHtml.includes('Resume.pdf'), 'The site does not link the resume PDF.');

new vm.Script(siteJs, { filename: 'assets/site.js' });
new vm.Script(apiJs, { filename: 'api/chat.js' });

const ids = [...indexHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert(ids.length === new Set(ids).size, 'index.html contains duplicate IDs.');
assert((indexHtml.match(/<h1\b/g) || []).length === 1, 'index.html must contain exactly one h1.');

for (const id of ['main-content', 'about', 'experience', 'capabilities', 'leadership', 'connect', 'chat-panel']) {
  assert(ids.includes(id), `index.html is missing #${id}.`);
}

for (const requirement of [
  'name="description"',
  'rel="canonical"',
  'property="og:image"',
  'type="application/ld+json"',
  'class="skip-link"',
  'aria-label="Page sections"',
  'aria-modal="true"',
  'aria-live="polite"',
  'prefers-reduced-motion',
  ':focus-visible'
]) {
  assert((indexHtml + siteCss).includes(requirement), `Missing required site feature: ${requirement}`);
}

const outdatedPhrases = [
  'connective fiber',
  'my edge',
  'early adopter',
  'among the first',
  'served as chief of staff',
  '13 years'
];
const publicCopy = (indexHtml + resumeHtml + apiJs).toLowerCase();
for (const phrase of outdatedPhrases) {
  assert(!publicCopy.includes(phrase), `Outdated positioning remains: "${phrase}".`);
}

const profile = JSON.parse(await read('content/profile.json'));
assert(
  indexHtml.includes(profile.person.currentTitle) && resumeHtml.includes(profile.person.currentTitle),
  'The official current title is not synchronized across the site and resume.'
);
assert(
  !publicCopy.includes('senior business analytics associate'),
  'The former KeyBank title remains in generated public copy.'
);
assert(
  resumeHtml.includes(profile.careerLetter.positioning),
  'The resume is missing its technical positioning line.'
);

const keyBankRole = profile.experience.find((role) => role.id === 'keybank');
assert(keyBankRole, 'The canonical KeyBank role is missing.');
assert(Array.isArray(keyBankRole.resumeBullets) && keyBankRole.resumeBullets.length === 3, 'The resume must include three KeyBank technical bullets.');
for (const bullet of keyBankRole.resumeBullets) {
  assert(resumeHtml.includes(escapeForHtmlCheck(bullet)), `The generated resume is missing a KeyBank bullet: ${bullet}`);
}
assert(
  (resumeHtml.match(/class="record-node"/g) || []).length === profile.experience.length,
  'Each resume role must have one timeline node.'
);
assert(
  resumeHtml.indexOf('Analytics &amp; Technology') < resumeHtml.indexOf('Banking &amp; Markets'),
  'Analytics & Technology must precede Banking & Markets in the resume.'
);
assert(
  resumeHtml.indexOf('id="capabilities-title"') < resumeHtml.indexOf('id="experience-title"') &&
    resumeHtml.indexOf('id="experience-title"') < resumeHtml.indexOf('id="leadership-title"'),
  'Resume sections must appear in Capabilities, Experience, Leadership order.'
);
for (const stagedElement of ['class="section-index"', 'class="transferability"']) {
  assert(!resumeHtml.includes(stagedElement), `The simplified cover page still contains ${stagedElement}.`);
}
for (const stagedPhrase of ['technology for its own sake', 'where the work travels']) {
  assert(!resumeHtml.toLowerCase().includes(stagedPhrase), `The cover page retains staged phrasing: "${stagedPhrase}".`);
}

const blankTargets = [...indexHtml.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].map((match) => match[0]);
for (const link of blankTargets) {
  assert(/rel="[^"]*noopener/.test(link), 'A target="_blank" link is missing rel="noopener".');
}

const localReferences = [...indexHtml.matchAll(/\s(?:href|src)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((reference) => !/^(?:https?:|mailto:|tel:|data:|#|\/api\/)/.test(reference));

for (const reference of localReferences) {
  const clean = decodeURIComponent(reference.split('#')[0].split('?')[0]);
  if (clean) await access(path.join(rootDirectory, clean));
}

console.log('Static checks passed.');

function escapeForHtmlCheck(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
