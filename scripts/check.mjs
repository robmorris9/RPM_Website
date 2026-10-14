import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
const [html, resume, css, sourceCss, raw] = await Promise.all(['index.html','resume.html','assets/styles.css','src/styles.css','content/profile.json'].map(read));
const profile = JSON.parse(raw);
assert.equal(css, sourceCss, 'Generated CSS must match source');
assert(!/{{[A-Z_]+}}/.test(html + resume), 'Unresolved template');
assert.equal((html.match(/<h1\b/g) || []).length, 1);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(ids.length, new Set(ids).size, 'Duplicate IDs');
for (const match of html.matchAll(/(?:href="#|aria-labelledby=")([^"]+)"/g)) assert(ids.includes(match[1]), `Missing target ${match[1]}`);
for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
 const url = match[1];
 if (!/^(https?:|mailto:|data:|#)/.test(url)) await access(new URL(decodeURI(url), root));
}
for (const match of css.matchAll(/url\('([^']+)'\)/g)) await access(new URL(`assets/${match[1]}`, root));
assert(!/<script(?![^>]*application\/ld\+json)/.test(html), 'Homepage must not require browser JavaScript');
for (const value of ['lang="en"','name="viewport"','name="description"','rel="canonical"','type="application/ld+json"','class="skip-link"','<main','<footer']) assert(html.includes(value), `Missing ${value}`);
for (const value of ['prefers-reduced-motion',':focus-visible','@media (max-width: 760px)','@media (max-width: 420px)']) assert(css.includes(value), `Missing ${value}`);
assert.equal(profile.experience[0].bullets.length, 6);
assert.equal(profile.experience[1].roles.length, 4);
assert.equal(profile.capabilities.length, 4);
for (const value of ['RobBot','operating thesis','case-studies','$55M','$3M','skill-tag','chat-panel']) assert(!html.includes(value), `Retired content: ${value}`);
for (const amount of Object.values(profile.metrics)) assert(html.includes(amount), `Missing metric ${amount}`);
const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/)[1]);
assert.equal(jsonLd.name, profile.name);
const luminance = hex => {
 const channels = hex.match(/[a-f\d]{2}/gi).map(x => parseInt(x,16)/255).map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4);
 return channels[0]*.2126 + channels[1]*.7152 + channels[2]*.0722;
};
const tokens = Object.fromEntries([...css.matchAll(/--(paper|ink|heading|muted|accent): #(\w{6});/g)].slice(0, 5).map(m => [m[1], m[2]]));
const background = luminance(tokens.paper);
for (const key of ['ink','heading','muted','accent']) {
 const foreground = luminance(tokens[key]);
 const ratio = (Math.max(background,foreground)+.05)/(Math.min(background,foreground)+.05);
 assert(ratio >= 4.5, `Text contrast below WCAG AA: ${key}`);
 console.log(`${key}: ${ratio.toFixed(2)}:1 contrast`);
}
console.log('Static lint passed: markup invariants, local assets, data, structured metadata, source parity, and AA text contrast.');
