# Robert Morris | robmorris.me

A resume-first static website with IBM Plex Sans, a soft charcoal palette with warm off-white headings and muted sage accents, and no browser JavaScript. The homepage presents experience, capabilities, education and leadership, and contact links in one vertical flow.

## Update content

Edit `content/profile.json`. Career bullets, roles, capabilities, and contact details live here. Repeated numeric claims live in `metrics`; bullets reference them with `{metricName}`. Preserve qualifiers and distinctions between ownership and support.

The source for this revision is the supplied **Robert Morris Resume(3).pdf**, October 2026. The exact supplied PDF is served at the existing `Robert Perry Morris _ Resume.pdf` path to preserve old links. Replace that file with an approved resume when updating it. It is intentionally not regenerated from the website.

## Build and verify

Node.js 20 or newer; no package installation required.

```sh
npm run build
npm run lint
npm test
# or all three:
npm run verify
```

- `src/index.template.html`: semantic page structure.
- `src/styles.css`: typography, spacing, palette, responsive and print rules.
- `scripts/build.mjs`: escaped static HTML rendering from centralized data.
- `index.html`, `resume.html`, `assets/styles.css`: committed build outputs. `/resume.html` uses the same current content, replacing the old narrative resume.
- `assets/fonts`: self-hosted IBM Plex Sans regular and medium, with license.
- `scripts/check.mjs`: dependency-free static lint, local links/assets, metadata, content invariants and contrast checks.
- `tests/site.test.cjs`: static deployment and social-preview regression checks.
- `og-image.png`: 1200 × 630 social-preview card. `scripts/build_social_preview.py` regenerates it from the profile, CSS palette, and bundled fonts (requires Python and Pillow).

Run the build after source edits and commit the outputs. All career content and links work with JavaScript disabled. Keyboard focus is visible, contact targets are at least 44px high, and reduced motion disables link transitions. Mobile uses a single column with dates below role headings. Capability groups become a single column on narrow phones.

## Deployment

Vercel deploys the `main` branch to https://robmorris.me/. Generated HTML and assets are committed, so the site can be served as plain static files. Existing security headers and CNAME are preserved.

RobBot and its serverless endpoint have been removed. The site requires no API credentials or runtime environment variables. Previously configured Gemini variables in Vercel are unused and may be removed there.

## Validation

Run `npm run verify` before publishing. It builds the pages, checks static markup and links, verifies text contrast, and runs deployment and social-preview tests. After a deployment, confirm the new version at robmorris.me, then review desktop and mobile Safari, keyboard focus, contact links, and the resume download. Automated browser visual testing was unavailable during this redesign.

## Company marks

`src/logos/` contains inline, path-based SVG marks rendered in the heading color (`currentColor`). They are decorative beside accessible company names. KeyBank’s key symbol is extracted from https://www.logo.wine/a/logo/KeyBank/KeyBank-Logo.wine.svg; Citi’s mark is from https://commons.wikimedia.org/wiki/File:Citi_logo_March_2023.svg. Original trademark shapes are retained with a monochrome presentation.
