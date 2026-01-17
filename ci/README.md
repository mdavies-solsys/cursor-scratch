## ci/

CloudFormation + CI/CD to deploy the simple static website (`src/`) to **AWS ECS Fargate** behind an **Application Load Balancer**, with:

- **ACM** certificate (DNS validation in Route53)
- **Route53** A-record alias pointing at the ALB
- **ECR** for container images
- **CodePipeline** triggered by changes to `main` (or your configured branch) via an existing **CodeStar Connection**
- **CodeBuild** that builds/pushes the image and outputs `imagedefinitions.json` for ECS deploy

### Files

- `ci/fargate-simple-site.yml`: CloudFormation template
- `ci/buildspec.yml`: CodeBuild buildspec used by the pipeline
- `src/Dockerfile`: Container image for the static site

### Guestbook API (path-based)

The CloudFormation template provisions a DynamoDB-backed guestbook API (Lambda) and routes it through the ALB at
`/api/guestbook` on the same domain. The `guestbook-api` meta tag in `src/index.html` should be `/api`, and the
`GuestbookApiUrl` output includes the full URL. When previews are enabled, the preview subdomain uses a separate
Lambda + DynamoDB table for isolated testing.

### Required parameters

- `HostedZoneId`: Route53 hosted zone id that contains your record
- `RootDomainName`: root/apex domain name (e.g. `example.com`). The stack also serves `www.<root>`.
- `CodeStarConnectionArn`: ARN of your existing CodeStar connection to GitHub
- `GitHubOwner`: GitHub org/user
- `GitHubRepo`: repo name
- `DockerHubSecretArn`: ARN of Secrets Manager secret with Docker Hub `username` + `password`

Optional parameters you may want to override:

- `BranchName` (default `main`)
- `EnablePipeline` (default `true`)
- `EnablePreview` (default `false`)
- `PreviewSubdomain` (default `preview`)
- `PreviewDesiredCount` (default `0`)
- `DesiredCount`, `Cpu`, `Memory`
- `GuestbookRateLimitMax` (default `5`)
- `GuestbookRateLimitWindowSeconds` (default `3600`)

### First deploy bootstrap

The ECS service references an image in ECR. On the first deploy that image doesn't exist yet,
so the stack can hang waiting for tasks to start. Set `DesiredCount=0` on the initial deploy,
run the pipeline once to publish the image (console or `aws codepipeline start-pipeline-execution --name <PipelineName>`),
then update the stack to your desired count.

### Deploy (example)

Use your preferred deployment mechanism (Console, CLI, or IaC orchestration). Example CLI:

```bash
aws cloudformation deploy \
  --stack-name simple-site-fargate \
  --template-file ci/fargate-simple-site.yml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    RootDomainName=example.com \
    HostedZoneId=Z123456ABCDEFG \
    CodeStarConnectionArn=arn:aws:codeconnections:... \
    GitHubOwner=mdavies-solsys \
    GitHubRepo=cursor-scratch \
    DockerHubSecretArn=arn:aws:secretsmanager:us-east-2:834184586696:secret:dockerhub-kst0iN \
    BranchName=main
```

After creation completes, visit the `WebsiteUrl` output.

### PR preview environments

Pull request previews deploy to a single preview subdomain (default `preview.<RootDomainName>`). The workflow builds
the PR image, pushes the `:preview` tag to ECR, and forces a new deployment of the preview ECS service. The most
recently updated PR wins.

Required setup (one-time):

- Set `EnablePreview=true` and `PreviewDesiredCount=1` in the stack parameters.
- Create an IAM role for GitHub OIDC with permissions to:
  - Read the Docker Hub secret in Secrets Manager.
  - Push images to ECR.
  - Describe CloudFormation stacks (for the ECR repo output).
  - Update the preview ECS service.
- Add the role ARN as a GitHub Actions secret named `AWS_PREVIEW_ROLE_ARN`.

Notes:

- The workflow skips PRs from forks (no secrets/credentials).
- Closing a PR scales the preview service down to 0.
