import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(rootDirectory, file), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [indexHtml, resumeHtml, siteCss, siteJs, sourceCss, sourceJs, resumeCss, sourceResumeCss, apiJs, profileJson] = await Promise.all([
  read('index.html'),
  read('resume.html'),
  read('assets/styles.css'),
  read('assets/site.js'),
  read('src/styles.css'),
  read('src/site.js'),
  read('assets/resume.css'),
  read('src/resume.css'),
  read('api/chat.js'),
  read('content/profile.json')
]);
const profile = JSON.parse(profileJson);

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

for (const id of ['main-content', 'about', 'experience', 'case-studies', 'capabilities', 'leadership', 'connect', 'chat-panel']) {
  assert(ids.includes(id), `index.html is missing #${id}.`);
}
for (const removedId of ['how-i-operate', 'director-next-heading']) {
  assert(!ids.includes(removedId), `Removed website section remains in the DOM: #${removedId}.`);
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

for (const removedMarkup of [
  'class="pl-support"',
  'class="pl-kpis"',
  'class="pl-kpi"',
  'class="operating-block"',
  'class="director-next"',
  'class="micro-anim',
  'class="site-footer"'
]) {
  assert(!indexHtml.includes(removedMarkup), `Removed website markup remains: ${removedMarkup}.`);
}
const deliveredWebAssets = indexHtml + siteCss + siteJs;
for (const removedMicroVisual of ['micro-anim', 'anim-gauge', 'anim-line-chart', 'anim-swift', 'gauge-svg']) {
  assert(!deliveredWebAssets.includes(removedMicroVisual), `Removed experience micro-visual remains: ${removedMicroVisual}.`);
}
assert(!indexHtml.includes('made with love in kenmore'), 'The removed Kenmore footer copy remains visible.');

const experiencePosition = indexHtml.indexOf('id="experience"');
const caseStudiesPosition = indexHtml.indexOf('id="case-studies"');
assert(experiencePosition >= 0 && experiencePosition < caseStudiesPosition, 'Experience must appear before Case studies.');

assert(countClassToken(indexHtml, 'organization-block') === 2, 'Experience must contain exactly two company blocks.');
for (const organizationId of ['experience-keybank', 'experience-citi']) {
  assert(ids.includes(organizationId), `Experience is missing #${organizationId}.`);
}
assert(countClassToken(indexHtml, 'organization-company') === 2, 'Each company block needs one company heading.');
assert(countClassToken(indexHtml, 'organization-dates') === 2, 'Each company block needs one date range.');
assert(countClassToken(indexHtml, 'organization-takeaway') === 2, 'Each company block needs one takeaway summary.');
for (const organizationMarkup of ['class="organization-list"', 'class="organization-focus-list"', 'class="organization-timeline"']) {
  assert(indexHtml.includes(organizationMarkup), `Experience is missing ${organizationMarkup}.`);
}
assert(!indexHtml.includes('class="experience-list"'), 'The former flat experience list remains in the DOM.');
assert(!indexHtml.includes('class="exp-entry'), 'The former per-role experience entries remain in the DOM.');
assert(!/>\s*undefined\s*</i.test(indexHtml), 'Generated HTML contains a visible undefined value.');

const outdatedPhrases = [
  'connective fiber',
  'my edge',
  'early adopter',
  'among the first',
  'served as chief of staff',
  '13 years',
  'senior business analytics associate',
  'banking strategy · portfolio management · risk analytics',
  'turning portfolio data, risk signals',
  'cloud automation · data infrastructure · technical management',
  'vertex notebooks',
  'bigquery',
  '402 gb',
  'data commentary pipeline',
  '$2.9m',
  'credit exposure mitigated',
  'built analytical frameworks',
  'backlog',
  'executed approximately $10b'
];
const publicCopy = (indexHtml + resumeHtml + apiJs + profileJson).toLowerCase();
for (const phrase of outdatedPhrases) {
  assert(!publicCopy.includes(phrase), `Stale or inaccurate public language remains: "${phrase}".`);
}

const positioning = profile.positioning;
assert(positioning && typeof positioning === 'object' && !Array.isArray(positioning), 'The canonical positioning object is missing.');
for (const field of ['label', 'statement']) {
  assert(typeof positioning[field] === 'string' && positioning[field].trim(), `Canonical positioning is missing ${field}.`);
}
assert(!positioning.support, 'The removed hero support copy remains in the canonical web profile.');
assert(Array.isArray(profile.metrics) && profile.metrics.length === 0, 'Hero KPI data must remain empty for the simplified web presentation.');
const escapedPositioningStatement = escapeForHtmlCheck(positioning.statement);
assert(
  indexHtml.includes(escapedPositioningStatement) && resumeHtml.includes(escapedPositioningStatement),
  'The canonical positioning statement is not synchronized across the site and resume.'
);
assert(
  resumeHtml.includes(escapeForHtmlCheck(positioning.label)),
  'The resume is missing the canonical short positioning label.'
);
const expectedCurrentTitle = 'Vice President, Business Banking Portfolio Analytics';
assert(profile.person.currentTitle === expectedCurrentTitle, 'The official current title in profile.json is missing or stale.');
assert(
  indexHtml.includes(profile.person.currentTitle) && resumeHtml.includes(profile.person.currentTitle),
  'The official current title is not synchronized across the site and resume.'
);
assert(
  !publicCopy.includes('senior business analytics associate'),
  'The former KeyBank title remains in generated public copy.'
);

const expectedCaseStudyIds = [
  'credit-risk-rating-freeze',
  'swift-settlement-migration',
  'liquidity-crisis-response',
  'other-enhancements'
];
const caseStudyFields = ['id', 'company', 'status', 'title', 'narrative', 'result', 'role'];
assert(Array.isArray(profile.caseStudies) && profile.caseStudies.length === 4, 'The profile must define exactly four website case studies.');
assert(
  profile.caseStudies.every((caseStudy) => caseStudy && typeof caseStudy === 'object' && !Array.isArray(caseStudy)),
  'Every case study must be an object.'
);
assert(
  JSON.stringify(profile.caseStudies.map((caseStudy) => caseStudy.id)) === JSON.stringify(expectedCaseStudyIds),
  'The four canonical case studies are missing, duplicated, or out of order.'
);
for (const caseStudy of profile.caseStudies) {
  for (const field of caseStudyFields) {
    assert(
      typeof caseStudy[field] === 'string' && caseStudy[field].trim(),
      `Case study ${caseStudy.id || '(missing id)'} requires non-empty ${field}.`
    );
  }
  assert(indexHtml.includes(escapeForHtmlCheck(caseStudy.title)), `The site is missing case study: ${caseStudy.title}`);
}
let previousCaseStudyPosition = caseStudiesPosition;
for (const caseStudy of profile.caseStudies) {
  const position = indexHtml.indexOf(escapeForHtmlCheck(caseStudy.title), previousCaseStudyPosition);
  assert(position > previousCaseStudyPosition, `Website case-study order is incorrect at: ${caseStudy.title}`);
  previousCaseStudyPosition = position;
}

const keyBankRole = profile.experience.find((role) => role.id === 'keybank');
assert(keyBankRole, 'The canonical KeyBank role is missing.');
assert(Array.isArray(keyBankRole.resumeBullets) && keyBankRole.resumeBullets.length === 3, 'The resume must include three KeyBank bullets.');
for (const bullet of keyBankRole.resumeBullets) {
  assert(resumeHtml.includes(escapeForHtmlCheck(bullet)), `The generated resume is missing a KeyBank bullet: ${bullet}`);
}

const keyBankCopy = JSON.stringify(keyBankRole);
assertContainsTerms(keyBankCopy, [
  'risk-scoring dashboard',
  'UAT',
  'relationship-manager compensation decisions',
  'freezing or downgrading risk ratings',
  'manual',
  'Excel-based',
  'Regulation B',
  'hundreds of applications a day',
  'fully automated',
  'risk partners',
  'operate an existing exposure model',
  '$55M',
  '$3M',
  'recovered'
], 'The canonical KeyBank record');
assert(Array.isArray(profile.leadership) && profile.leadership.length === 3, 'The resume layout requires exactly three leadership items.');

const caseStudiesById = new Map(profile.caseStudies.map((caseStudy) => [caseStudy.id, caseStudy]));
assertContainsTerms(
  JSON.stringify(caseStudiesById.get('liquidity-crisis-response')),
  ['core, hands-on contributor', 'not sole owner', '$10B', '$5B'],
  'The liquidity case-study ownership framing'
);
assertContainsTerms(
  JSON.stringify(caseStudiesById.get('swift-settlement-migration')),
  ['product-processor review', 'drove', '$29M'],
  'The SWIFT case-study ownership framing'
);
assertContainsTerms(
  JSON.stringify(caseStudiesById.get('credit-risk-rating-freeze')),
  ['rating downgrades', 'line-freeze decisions', 'governance', 'no final outcome metric'],
  'The active credit-freeze case-study framing'
);
const otherEnhancements = caseStudiesById.get('other-enhancements');
assert(
  JSON.stringify(otherEnhancements.highlights) === JSON.stringify([
    'Spreadsheet enhancements',
    'Commentary automation for repetitive P&L pushes',
    'Daily and manual upload automation',
    'Verification and QC automation'
  ]),
  'Other enhancements must retain the four coordinated highlights in order.'
);
assertContainsTerms(
  JSON.stringify(otherEnhancements),
  ['cumulatively', 'saved hundreds of hours', 'more consistent', 'easier to verify', 'time saved is cumulative', 'not a single-project claim'],
  'The other-enhancements ownership framing'
);

const expectedConnect = {
  heading: "Let's compare notes",
  paragraphs: [
    "I'm interested in work where problems need new solutions and a fresh set of eyes—especially when the answer has to reflect how operations flow, how risk is managed, and how disciplined execution can scale.",
    "If you're working through something like that, I'd be glad to compare notes."
  ]
};
assert(JSON.stringify(profile.connect) === JSON.stringify(expectedConnect), 'The canonical closing invitation is missing or stale.');
for (const value of [expectedConnect.heading, ...expectedConnect.paragraphs]) {
  assert(indexHtml.includes(escapeForHtmlCheck(value)), `The generated site is missing closing copy: ${value}`);
}

assert(
  (resumeHtml.match(/class="record-node"/g) || []).length === profile.experience.length,
  'Each resume role must have one timeline node.'
);

const capabilityNames = profile.capabilities.map((group) => group.name);
const capabilityOrder = profile.careerLetter.capabilityOrder;
assert(
  Array.isArray(capabilityOrder) &&
    capabilityOrder.length === new Set(capabilityOrder).size &&
    capabilityOrder.length === capabilityNames.length &&
    capabilityOrder.every((name) => capabilityNames.includes(name)),
  'careerLetter.capabilityOrder must list every capability group exactly once.'
);
let previousCapabilityPosition = -1;
for (const name of capabilityOrder) {
  const position = resumeHtml.indexOf(escapeForHtmlCheck(name));
  assert(position > previousCapabilityPosition, `Resume capability order is incorrect at: ${name}`);
  previousCapabilityPosition = position;
}
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

function assertContainsTerms(value, terms, context) {
  const normalized = String(value).toLowerCase();
  for (const term of terms) {
    assert(normalized.includes(String(term).toLowerCase()), `${context} is missing required language: "${term}".`);
  }
}

function countClassToken(html, className) {
  return [...String(html).matchAll(/class="([^"]*)"/g)]
    .filter((match) => match[1].split(/\s+/).includes(className))
    .length;
}

function escapeForHtmlCheck(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
