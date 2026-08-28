# TONNAGE Staff v0.5.0

Offline Windows desktop client for the TONNAGE mobile workout tracker.

## What it does

- Keeps the exercise folders, exercise editor, plans and 28-day schedule from the HTML prototype.
- Imports the mobile `tonnage-database` v1 (`.tonnage-db`) snapshot.
- Exports a mobile-compatible `tonnage-planning` v2 (`.tonnage`) package.
- Adds athlete, coach, project and note metadata without changing the mobile planning schema.
- Calculates volume, frequency, duration, density, estimated 1RM, records, streaks, gaps, muscle/folder distribution, rep/intensity zones, history and data-quality checks.
- Exports the filtered set history to CSV and the visible report to PDF.
- Stores the working project and last imported analytics snapshot locally and atomically.

## Development

```bash
npm install
npm test
npm start
```

Build the unsigned portable Windows x64 executable:

```bash
npm run dist:win
```

The application does not require a server or internet connection at runtime.

## Repository workflow

The repository is intended to keep source history separate from generated Windows binaries.

- `main` is the stable development branch.
- Every push or pull request runs the automated test suite.
- Successful pushes to `main` also build an unsigned Windows x64 portable executable in GitHub Actions.
- Generated `dist/` files are not committed to source control; download them from the workflow artifacts instead.
