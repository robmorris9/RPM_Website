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
- `tests/api-chat.test.cjs`: retained experimental endpoint security/error tests.

Run the build after source edits and commit the outputs. All career content and links work with JavaScript disabled. Keyboard focus is visible, contact targets are at least 44px high, and reduced motion disables link transitions. Mobile uses a single column with dates below role headings. Capability groups become a single column on narrow phones.

## Deployment

Existing Vercel configuration and CNAME are preserved. This change does not switch hosting providers. The homepage makes no requests to the experimental `/api/chat` endpoint. That endpoint remains server-only with its existing protections and now reads the current resume data. Its environment variables remain `GEMINI_API_KEY`, optional `GEMINI_MODEL`, and optional `ROBBOT_ALLOWED_ORIGINS`.

## Verification limit

Automated build, static lint, and API tests can run without a browser. Visual inspection in desktop browsers and mobile Safari is still required before merging this redesign; this implementation session did not have the supported browser preview capability.

## Company marks

`src/logos/` contains inline, path-based SVG marks rendered in the heading color (`currentColor`). They are decorative beside accessible company names. KeyBank’s key symbol is extracted from https://www.logo.wine/a/logo/KeyBank/KeyBank-Logo.wine.svg; Citi’s mark is from https://commons.wikimedia.org/wiki/File:Citi_logo_March_2023.svg. Original trademark shapes are retained with a monochrome presentation.
