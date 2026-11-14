# ATLAS Command Center — 0.7.6.9

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

## Version notes
0.7.6.9 updates displayed version labels from 0.7.6.8, adds this README,
and adds minimal Vercel configuration. Older 0.7.6.6 references are
intentionally retained because they describe historical import behavior.
No new application features or data migrations are included.

## Tests
Run `npm ci` and `npm test` in a Node.js environment.
