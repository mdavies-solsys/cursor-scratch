## Cursor Agent Guide (homepage repo)

This repository hosts the personal homepage for `matthewsdavies.com`. Keep changes focused on the site and its
deployment configuration.

### Goals

- Keep the repo minimal and homepage-focused
- Keep site content in `src/`
- Keep infrastructure and CI assets in `ci/`
- Preserve useful context in `history/`

### Structure

- **`src/`**: static site source (HTML, assets, Dockerfile)
- **`ci/`**: CloudFormation + CI/CD configuration
- **`docs/`**: technical research and reference documentation
- **`history/`**: PR context archive (agent-maintained)

### Git hygiene

- Commit small, meaningful increments
- Avoid committing credentials, `.env`, or large binaries unrelated to the site

### If you're a Cursor agent running here

- Read `README.md` and this file first
- Prefer changes within `src/` or `ci/`
- Check `history/` for prior context on related features

### PR History Documentation (Required)

When working on a pull request, **create and maintain a history file** to capture useful context:

1. **Create a file** in `history/` with a timestamp prefix and branch name (e.g., `history/20260123-1430-feature-my-feature.md`)
2. **Document as you work**:
   - Problem being solved
   - Key findings from investigation/analysis
   - Design decisions and trade-offs considered
   - Implementation details worth preserving
   - Future considerations or deferred options
3. **Update before completing** the PR with final insights
4. **Commit the history file** alongside your code changes

This preserves valuable context for future agents and developers working on related features.

See `history/README.md` for the full file structure guide.
