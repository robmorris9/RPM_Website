# RPM Website

Robert Perry Morris's static career website, deployed at [robmorris.me](https://robmorris.me/).

## Architecture

- `content/profile.json` is the canonical source for positioning, career facts, metrics, case studies, operating principles, capabilities, leadership, contact details, resume summaries, and RobBot's public context.
- `src/index.template.html`, `src/styles.css`, and `src/site.js` contain the site presentation and browser behavior.
- `src/resume.template.html` and `src/resume.css` contain the two-page narrative-resume presentation.
- `scripts/build.mjs` generates the root `index.html`, `resume.html`, and `assets/` files served in production.
- `scripts/build_resume_pdf.py` generates the linked two-page PDF from the same profile data and bundled IBM Plex fonts.
- `api/chat.js` is a zero-dependency Vercel function. Its system instructions stay on the server and its facts come from `content/profile.json`.

The generated root files remain committed so the site can be served as plain static files. Edit source files, run the build, then commit both source and generated outputs.

### Case-study content model

The `caseStudies` array in `content/profile.json` keeps each story evidence-based and explicit about Rob's scope. Every entry defines `id`, `company`, `status`, `title`, `narrative`, `result`, and `role`, with optional `highlights` for compact supporting examples. The site renderer and RobBot both consume this canonical array; do not duplicate case-study copy in generated HTML or the chat function.

## Local workflow

Requires Node.js 20 or newer.

```sh
npm run build
npm run check
npm test
```

`npm run verify` runs that complete site sequence. After installing the PDF dependencies below, `npm run verify:all` runs the site build and checks, API tests, deterministic resume build, and resume PDF checks together. The existing `npm run verify:resume` command remains available for resume-only work.

Serve the repository root with any static server to review the site. RobBot requires the Vercel function environment; the rest of the site works without it.

The downloadable resume is a separate, deterministic build. Its first page is a concise professional profile; its second page combines an experience timeline with compact capabilities and leadership sections. It requires Python 3 and the pinned packages in `requirements-pdf.txt`:

```sh
python3 -m pip install -r requirements-pdf.txt
npm run verify:resume
```

The PDF check confirms its two-page Letter format, metadata, canonical narrative, role and capability content, and removal of stale positioning. Visually review both rendered pages after material content changes.

## Deployment

Vercel is the authoritative runtime because `/api/chat` depends on a serverless function. Configure these environment variables in Vercel:

- `GEMINI_API_KEY` (required)
- `GEMINI_MODEL` (optional; defaults to `gemini-2.5-flash-lite`)
- `ROBBOT_ALLOWED_ORIGINS` (optional; comma-separated additional trusted origins)

Never place credentials in HTML, source files, client-side environment variables, or Git history. Any key previously committed to public history must be revoked and replaced; removing it from the current tree is not sufficient.

The repository also has legacy GitHub Pages configuration through `CNAME`. If GitHub Pages remains enabled, verify that DNS still points to Vercel so the RobBot endpoint is not bypassed.

DNS was verified on 2026-08-22: the apex A record resolves to `76.76.21.21`, `www` aliases to `cname.vercel-dns.com`, and both HTTPS responses identify Vercel as the server. Keep `CNAME` for the legacy configuration unless GitHub Pages is intentionally disabled; the Pages setting itself was not available through the connected GitHub integration.
