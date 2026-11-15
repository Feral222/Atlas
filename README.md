# ATLAS Command Center — 0.7.6.15

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

## Hybrid organizer validation status (0.7.6.10 candidate)

The organizer now offers explicit consent for a batch of AI-assisted document
classifications. Supported PDF and image bytes, and extracted text, are sent to
the configured Atlas AI backend only when consent is granted. Successful
classifications are checkpointed locally so an interrupted scan can resume.
Unrecognized or oversized formats are left unresolved rather than classified
by filename and represented as content-analyzed.

A 1,500-item simulated inventory and local-only/no-upload test pass. These tests
do not establish correctness of live AI output, iPhone IndexedDB quotas,
background suspension, network interruptions, or the complete move/Undo flow.
Do not run against an irreplaceable Library without an independent export and
an on-device pilot. This is a development candidate, not a production-certified build.


## Organizer validation status
The hybrid organizer is an integration build. Local inventory, supported-file cloud classification with consent, preview, metadata transactions, checkpointing and recovery tests exist. Full real-device iPhone validation, API rate/size behavior, scanned-image and PDF coverage, and interruption testing on a real Vault remain unverified. Do not use on the only copy of your files.
