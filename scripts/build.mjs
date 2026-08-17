import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(scriptDirectory, '..');
const sourceDirectory = path.join(rootDirectory, 'src');
const assetsDirectory = path.join(rootDirectory, 'assets');

const profile = JSON.parse(await readFile(path.join(rootDirectory, 'content', 'profile.json'), 'utf8'));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderTemplate(template, replacements) {
  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.split(`{{${key}}}`).join(String(value));
  }

  const unresolved = output.match(/{{[A-Z0-9_]+}}/g);
  if (unresolved) throw new Error(`Unresolved template values: ${[...new Set(unresolved)].join(', ')}`);
  return output;
}

function renderMetric(metric) {
  return `<div class="pl-kpi">
            <dt class="pl-kpi-lbl">${escapeHtml(metric.label)}</dt>
            <dd class="pl-kpi-val" id="metric-${escapeHtml(metric.id)}">${escapeHtml(metric.value)}</dd>
          </div>`;
}

function renderMicroVisual(type) {
  if (type === 'gauge') {
    return `<span class="micro-anim anim-gauge" aria-hidden="true">
                <svg class="gauge-svg" viewBox="0 0 22 11"><path class="gauge-track danger" d="M 1 11 A 10 10 0 0 1 21 11" pathLength="100"></path><path class="gauge-track warn" d="M 1 11 A 10 10 0 0 1 21 11" pathLength="100"></path><path class="gauge-track safe" d="M 1 11 A 10 10 0 0 1 21 11" pathLength="100"></path><line x1="11" y1="11" x2="11" y2="2" class="gauge-needle"></line><circle cx="11" cy="11" r="1.5" class="gauge-base"></circle></svg>
              </span>`;
  }

  if (type === 'line') {
    return `<span class="micro-anim anim-line-chart" aria-hidden="true"><svg viewBox="0 0 24 16" width="24" height="16"><polyline class="lc-path" points="2,14 8,9 14,12 22,4"></polyline><circle class="lc-dot" cx="22" cy="4" r="2"></circle></svg></span>`;
  }

  if (type === 'swift') {
    return `<span class="micro-anim anim-swift" aria-hidden="true"><span class="swift-lat"></span><span class="swift-lng"></span><span class="swift-node"></span><span class="swift-node2"></span></span>`;
  }

  return '';
}

function renderExperience(role) {
  const descriptions = role.description
    .map((paragraph) => `<p class="exp-desc">${escapeHtml(paragraph)}</p>`)
    .join('\n                ');
  const tags = role.tags
    .map((tag) => `<li class="exp-tag">${escapeHtml(tag)}</li>`)
    .join('');
  const functionalTitle = role.functionalTitle
    ? `\n                <p class="exp-functional">${escapeHtml(role.functionalTitle)}</p>`
    : '';

  return `<li class="exp-entry reveal">
              <time class="exp-dates">${escapeHtml(role.dates)}</time>
              <article class="exp-content">
                <h3 class="exp-title">${escapeHtml(role.title)}</h3>${functionalTitle}
                <div class="exp-company"><span>${escapeHtml(role.company)}</span>${renderMicroVisual(role.visual)}</div>
                ${descriptions}
                <ul class="exp-tags" aria-label="Relevant capabilities">${tags}</ul>
              </article>
            </li>`;
}

function renderCapability(group) {
  const items = group.items
    .map((item) => `<li class="skill-tag">${escapeHtml(item)}</li>`)
    .join('');

  return `<section class="skills-block">
              <h3 class="skills-cat-name">${escapeHtml(group.name)}</h3>
              <ul class="skills-list">${items}</ul>
            </section>`;
}

function renderLeadership(item) {
  return `<article class="lead-item">
              <h3 class="lead-title">${escapeHtml(item.title)}</h3>
              <p class="lead-desc">${escapeHtml(item.description)}</p>
            </article>`;
}

function renderResumeCapability(group) {
  return `<section class="capability-group">
            <h3 class="capability-name">${escapeHtml(group.name)}</h3>
            <p class="capability-items">${group.items.map(escapeHtml).join(', ')}</p>
          </section>`;
}

function renderResumeExperience(role) {
  const functionalTitle = role.functionalTitle
    ? `\n              <p class="record-function">${escapeHtml(role.functionalTitle)}</p>`
    : '';
  const narrative = Array.isArray(role.resumeBullets) && role.resumeBullets.length
    ? `<ul class="record-bullets">${role.resumeBullets
        .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
        .join('')}</ul>`
    : `<p class="record-summary">${escapeHtml(role.careerLetterSummary || role.resumeDescription)}</p>`;
  const currentClass = role.id === 'keybank' ? ' is-current' : '';

  return `<article class="record-entry${currentClass}">
            <time class="record-dates">${escapeHtml(role.dates)}</time>
            <span class="record-node" aria-hidden="true"></span>
            <div class="record-body">
              <div class="record-heading">
                <div class="record-title-group">
                  <h3 class="record-role">${escapeHtml(role.title)}</h3>
                  <span class="record-company">${escapeHtml(role.company)}</span>
                </div>
              </div>${functionalTitle}
              ${narrative}
            </div>
          </article>`;
}

function resumeCapabilities() {
  const requestedOrder = profile.careerLetter.capabilityOrder || [];
  const groupsByName = new Map(profile.capabilities.map((group) => [group.name, group]));
  const ordered = requestedOrder.map((name) => groupsByName.get(name)).filter(Boolean);
  const requestedNames = new Set(requestedOrder);
  return [...ordered, ...profile.capabilities.filter((group) => !requestedNames.has(group.name))];
}

const personJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  name: profile.person.name,
  givenName: profile.person.givenName,
  familyName: profile.person.familyName,
  url: profile.site.url,
  email: `mailto:${profile.person.email}`,
  telephone: profile.person.phoneHref,
  image: new URL('og-image.png', profile.site.url).href,
  jobTitle: profile.person.currentTitle,
  worksFor: { '@type': 'Organization', name: profile.person.currentEmployer },
  alumniOf: { '@type': 'Organization', name: 'Citi' },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Kenmore',
    addressRegion: 'NY',
    addressCountry: 'US'
  },
  sameAs: [profile.person.linkedinUrl],
  knowsAbout: profile.capabilities.flatMap((group) => group.items)
};

const commonValues = {
  PERSON_NAME: escapeHtml(profile.person.name),
  PERSON_NAME_LINES: profile.person.name.split(' ').map(escapeHtml).join('<br>'),
  GIVEN_NAME: escapeHtml(profile.person.givenName),
  FAMILY_NAME: escapeHtml(profile.person.familyName),
  EMAIL: escapeHtml(profile.person.email),
  PHONE_HREF: escapeHtml(profile.person.phoneHref),
  PHONE_DISPLAY: escapeHtml(profile.person.phoneDisplay),
  LINKEDIN_URL: escapeHtml(profile.person.linkedinUrl),
  LINKEDIN_DISPLAY: escapeHtml(profile.person.linkedinDisplay),
  CURRENT_TITLE: escapeHtml(profile.person.currentTitle),
  CURRENT_FUNCTION: escapeHtml(profile.person.currentFunction),
  CURRENT_EMPLOYER: escapeHtml(profile.person.currentEmployer),
  LOCATION: escapeHtml(profile.person.location),
  YEARS_EXPERIENCE: escapeHtml(profile.person.yearsExperience)
};

const indexTemplate = await readFile(path.join(sourceDirectory, 'index.template.html'), 'utf8');
const indexHtml = renderTemplate(indexTemplate, {
  ...commonValues,
  SITE_TITLE: escapeHtml(profile.site.title),
  SITE_DESCRIPTION: escapeHtml(profile.site.description),
  SITE_URL: escapeHtml(profile.site.url),
  OG_IMAGE_URL: escapeHtml(new URL('og-image.png', profile.site.url).href),
  PERSON_JSON_LD: JSON.stringify(personJsonLd).replaceAll('<', '\\u003c'),
  HERO_EYEBROW: escapeHtml(profile.person.eyebrow),
  HERO_STATEMENT: escapeHtml(profile.person.heroStatement),
  METRICS: profile.metrics.map(renderMetric).join('\n          '),
  ABOUT: profile.about.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n          '),
  EXPERIENCE: profile.experience.map(renderExperience).join('\n            '),
  CAPABILITIES: profile.capabilities.map(renderCapability).join('\n            '),
  LEADERSHIP: profile.leadership.map(renderLeadership).join('\n            '),
  CONNECT_HEADING: escapeHtml(profile.connect.heading),
  CONNECT_COPY: profile.connect.paragraphs.map((paragraph) => `<p class="connect-sub">${escapeHtml(paragraph)}</p>`).join(''),
  ROBBOT_GREETING: escapeHtml(profile.robbot.greeting),
  ROBBOT_DISCLOSURE: escapeHtml(profile.robbot.disclosure),
  ROBBOT_ERROR: escapeHtml(profile.robbot.error)
});

const resumeTemplate = await readFile(path.join(sourceDirectory, 'resume.template.html'), 'utf8');
const resumeHtml = renderTemplate(resumeTemplate, {
  ...commonValues,
  RESUME_INTRO_LABEL: escapeHtml(profile.careerLetter.label),
  CAREER_LETTER_HEADLINE: escapeHtml(profile.careerLetter.headline),
  RESUME_POSITIONING: escapeHtml(profile.careerLetter.positioning),
  CAREER_LETTER_DECK: escapeHtml(profile.careerLetter.deck),
  CAREER_LETTER_INTRO: profile.careerLetter.openingParagraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('\n          '),
  CAREER_LETTER_THESIS: escapeHtml(profile.careerLetter.operatingThesis),
  CAREER_LETTER_RECORD: profile.experience.map(renderResumeExperience).join('\n          '),
  CAREER_LETTER_CAPABILITIES: resumeCapabilities().map(renderResumeCapability).join('\n              '),
  CAREER_LETTER_LEADERSHIP: profile.leadership.map(renderLeadership).join('\n              '),
  CAREER_LETTER_CLOSING: profile.careerLetter.closingParagraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('\n          ')
});

await mkdir(assetsDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(rootDirectory, 'index.html'), indexHtml),
  writeFile(path.join(rootDirectory, 'resume.html'), resumeHtml),
  writeFile(path.join(assetsDirectory, 'site.js'), await readFile(path.join(sourceDirectory, 'site.js'), 'utf8')),
  writeFile(path.join(assetsDirectory, 'styles.css'), await readFile(path.join(sourceDirectory, 'styles.css'), 'utf8')),
  writeFile(path.join(assetsDirectory, 'resume.css'), await readFile(path.join(sourceDirectory, 'resume.css'), 'utf8'))
]);

console.log('Built index.html, narrative resume preview, and static assets.');
