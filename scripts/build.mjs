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

function renderOrganizationExperience(item) {
  const currentFocus = Array.isArray(item.currentFocus) && item.currentFocus.length
    ? `<ul class="organization-focus-list" aria-label="${escapeHtml(item.company)} current focus">${item.currentFocus
        .map((focus) => `<li>${escapeHtml(focus)}</li>`)
        .join('')}</ul>`
    : '';
  const progression = Array.isArray(item.progression) && item.progression.length
    ? `<ol class="organization-timeline" aria-label="${escapeHtml(item.company)} role progression">${item.progression
        .map((role) => `<li class="organization-role">
                    <span class="organization-role-dates">${escapeHtml(role.dates)}</span>
                    <span class="organization-role-title">${escapeHtml(role.title)}</span>
                  </li>`)
        .join('')}</ol>`
    : '';
  const enables = item.enables
    ? `<div class="organization-takeaway">
                <p class="organization-takeaway-label">${escapeHtml(item.takeawayLabel || 'Takeaway')}</p>
                <p class="organization-takeaway-copy">${escapeHtml(item.enables)}</p>
              </div>`
    : '';
  const currentClass = item.id === 'keybank' ? ' is-current' : '';
  const currentTitle = item.id === 'keybank'
    ? `\n                  <p class="organization-current-title">${escapeHtml(profile.person.currentTitle)}</p>`
    : '';
  const organizationId = `experience-${escapeHtml(item.id)}`;

  return `<article class="organization-block${currentClass}" id="${organizationId}" aria-labelledby="${organizationId}-title">
              <header class="organization-header">
                <div>
                  <h3 class="organization-company" id="${organizationId}-title">${escapeHtml(item.company)}</h3>${currentTitle}
                  <p class="organization-heading">${escapeHtml(item.heading)}</p>
                </div>
                <p class="organization-dates">${escapeHtml(item.dates)}</p>
              </header>
              ${currentFocus}${progression}${enables}
            </article>`;
}

function renderCaseStudy(study, index) {
  const caseId = `case-${escapeHtml(study.id)}`;
  const highlights = Array.isArray(study.highlights) && study.highlights.length
    ? `<ul class="case-study-highlights" aria-label="Selected examples">${study.highlights
        .map((highlight) => `<li>${escapeHtml(highlight)}</li>`)
        .join('')}</ul>`
    : '';

  return `<article class="case-study-row reveal" id="${caseId}" aria-labelledby="${caseId}-title">
              <header class="case-study-row-header">
                <p class="case-study-meta"><span class="case-study-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span>${escapeHtml(study.company)}</span><span aria-hidden="true">·</span><span>${escapeHtml(study.status)}</span></p>
                <h3 class="case-study-title" id="${caseId}-title">${escapeHtml(study.title)}</h3>
              </header>
              <div class="case-study-row-body">
                <p class="case-study-narrative">${escapeHtml(study.narrative)}</p>${highlights}
                <div class="case-study-result">
                  <p class="case-study-result-label">Result</p>
                  <p class="case-study-result-copy">${escapeHtml(study.result)}</p>
                </div>
                <p class="case-study-role"><span>Role</span>${escapeHtml(study.role)}</p>
              </div>
            </article>`;
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
  OG_IMAGE_ALT: escapeHtml(`${profile.person.name} — ${profile.positioning.statement}`),
  PERSON_JSON_LD: JSON.stringify(personJsonLd).replaceAll('<', '\\u003c'),
  HERO_EYEBROW: escapeHtml(profile.positioning.label),
  HERO_STATEMENT: escapeHtml(profile.positioning.statement),
  ABOUT: profile.about.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('\n          '),
  EXPERIENCE: profile.siteExperience.map(renderOrganizationExperience).join('\n            '),
  CASE_STUDIES: profile.caseStudies.map(renderCaseStudy).join('\n            '),
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
  CAREER_LETTER_HEADLINE: escapeHtml(profile.positioning.statement),
  RESUME_POSITIONING: escapeHtml(profile.positioning.label),
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
