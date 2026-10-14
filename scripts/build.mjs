import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const read = (name) => readFile(new URL(name, root), 'utf8');
const profile = JSON.parse(await read('content/profile.json'));
const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const text = (value) => escape(value.replace(/\{(\w+)\}/g, (_, key) => {
  if (!(key in profile.metrics)) throw new Error(`Unknown metric: ${key}`);
  return profile.metrics[key];
}));
const bullets = (items) => `<ul class="achievements">${items.map(item => `<li>${text(item)}</li>`).join('\n')}</ul>`;
const experience = profile.experience.map(job => `<article class="company" aria-labelledby="${escape(job.id)}-title">
  <header class="role-heading"><div><h3 id="${escape(job.id)}-title">${escape(job.company)}</h3><p class="practice">${escape(job.area)}</p><p class="job-title">${escape(job.title)}</p></div><p class="dates">${escape(job.dates)}</p></header>
  ${job.bullets ? bullets(job.bullets) : job.roles.map(role => `<section class="sub-role"><div class="role-heading"><h4>${escape(role.title)}</h4><p class="dates">${escape(role.dates)}</p></div>${bullets(role.bullets)}</section>`).join('\n')}
</article>`).join('\n');
const contact = `<ul class="contact-links"><li><a href="mailto:${escape(profile.email)}">Email</a></li><li><a href="${escape(profile.linkedinUrl)}">LinkedIn</a></li><li><a href="${encodeURI(profile.resumeFile)}" download="Robert-Morris-Resume.pdf">Download Resume <span class="file-type">PDF</span></a></li></ul>`;
const values = {
 NAME: escape(profile.name), SUMMARY: escape(profile.summary), HEADLINE: escape(profile.headline), CONTACT: contact, EXPERIENCE: experience,
 CAPABILITIES: profile.capabilities.map(group => `<section><h3>${escape(group.name)}</h3><ul class="capability-list">${group.items.map(item => `<li>${escape(item)}</li>`).join('')}</ul></section>`).join('\n'),
 EDUCATION: `<article><h3>${escape(profile.education.degree)}</h3><p>${escape(profile.education.school)}<br><span class="muted">${escape(profile.education.honors)}</span></p></article>`,
 LEADERSHIP: profile.leadership.map(item => `<article><h3>${escape(item.title)}</h3><p>${escape(item.description)}</p></article>`).join('\n'),
 JSON_LD: JSON.stringify({'@context':'https://schema.org','@type':'Person',name:profile.name,url:profile.url,email:`mailto:${profile.email}`,jobTitle:'Vice President',worksFor:{'@type':'Organization',name:'KeyBank'},alumniOf:{'@type':'CollegeOrUniversity',name:'Niagara University'},sameAs:[profile.linkedinUrl],knowsAbout:profile.capabilities.flatMap(group => group.items)}).replaceAll('<','\\u003c')
};
const template = await read('src/index.template.html');
const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
 if (!(key in values)) throw new Error(`Unknown template key: ${key}`);
 return values[key];
});
await writeFile(new URL('index.html', root), html);
// Preserve the existing /resume.html URL without a second, divergent narrative.
await writeFile(new URL('resume.html', root), html.replace('<title>Robert Morris |', '<title>Robert Morris | Resume |'));
await copyFile(new URL('src/styles.css', root), new URL('assets/styles.css', root));
console.log(`Built static resume pages in ${fileURLToPath(root)}. No browser JavaScript required.`);
