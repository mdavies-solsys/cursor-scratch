# matthewsdavies.com

Personal homepage site for Matt Davies.

## Structure

- `src/`: static site source (HTML, assets, Dockerfile).
- `ci/`: CloudFormation + CI/CD assets for AWS ECS Fargate deployment.

## Local preview

- Open `src/index.html` directly for a quick preview.
- Build the container with `docker build -t simple-site -f src/Dockerfile src`.
