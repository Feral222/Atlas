# ATLAS Command Center — 0.7.6.11

ATLAS is a mobile-friendly personal command center with tasks, notes,
records, timeline, people, voice features, and a local Files & Vault library.

## Deployment
Upload the contents of this ZIP (not the ZIP itself) to the root of
`Feral222/Atlas` on the `main` branch. Vercel deploys from that branch.

- `index.html`: application UI and local vault logic
- `api/`: Vercel serverless API routes
- `vendor/`: bundled JSZip library
- `tests/`: folder-cleanup tests
- `package.json` and `package-lock.json`: Node dependencies
- `vercel.json`: minimal Vercel configuration, preserving automatic detection
- `.gitignore`: excludes local dependencies, secrets, and generated files

## Data safety
Tasks and other shared records may sync using configured backend services.
Vault documents/photos are stored locally in the browser; updating or
removing the installed web app, clearing site data, or switching origins
may make local documents inaccessible. Export a backup before doing so.

## Version notes — 0.7.6.10
This consolidated release adds a unified review-first organizer for file moves,
matching folder merges, standard naming, and verified empty-folder cleanup.
Exact SHA-256 duplicate candidates are reported but never deleted.
Text/DOCX content is read locally. PDFs and images can be sent individually
for cloud AI analysis only after explicit user consent; bulk PDF/image semantic
classification is NOT automated. No image OCR runs locally.

**Important limitations:** The organizer still relies on local keyword-based
classification for bulk decisions; it does not implement comprehensive semantic
classification of every PDF/image in one batch. Large document analysis and
end-to-end interruption recovery need device testing. Back up your Vault before
using any organizer. Do not clear browser data or uninstall the Home Screen app.

## Tests
Run `npm ci` and `npm test` in a Node.js environment.
