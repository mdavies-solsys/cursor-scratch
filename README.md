# matthewsdavies.com

Personal homepage site for Matt Davies.

## Structure

- `src/`: static site source (HTML, assets, Dockerfile).
- `ci/`: CloudFormation + CI/CD assets for AWS ECS Fargate deployment.

## Local preview

- Install dependencies with `npm install`.
- Run the Vite dev server with `npm run dev`.
- Build the static bundle with `npm run build`.
- Start the production servers with `npm run start` (HTTP on 3000, WS on 4000).

Build the container with `docker build -t simple-site .`.
