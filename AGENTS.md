## Cursor Agent Guide (homepage repo)

This repository hosts the personal homepage for `matthewsdavies.com`. Keep changes focused on the site and its
deployment configuration.

### Goals

- Keep the repo minimal and homepage-focused
- Keep site content in `src/`
- Keep infrastructure and CI assets in `ci/`

### Structure

- **`src/`**: static site source (HTML, assets, Dockerfile)
- **`ci/`**: CloudFormation + CI/CD configuration

### Git hygiene

- Commit small, meaningful increments
- Avoid committing credentials, `.env`, or large binaries unrelated to the site

### If you’re a Cursor agent running here

- Read `README.md` and this file first
- Prefer changes within `src/` or `ci/`
