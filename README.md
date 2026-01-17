# matthewsdavies.com

Personal homepage site for Matt Davies.

## Structure

- `src/`: static site source (HTML, assets, Dockerfile).
- `ci/`: CloudFormation + CI/CD assets for AWS ECS Fargate deployment.

## Local preview

- Open `src/index.html` directly for a quick preview.
- Build the container with `docker build -t simple-site -f src/Dockerfile src`.

## PR previews

Pull requests deploy to `preview.matthewsdavies.com`, always showing the most recently updated PR. Details and setup
are documented in `ci/README.md`.
