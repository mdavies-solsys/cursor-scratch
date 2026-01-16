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

### Guestbook API (optional)

The CloudFormation template also provisions a small DynamoDB-backed guestbook API (Lambda + HTTP API) and maps it to
`https://api.<RootDomainName>` via an API Gateway custom domain.
After deploy, ensure the `guestbook-api` meta tag in `src/index.html` points at that URL (this repo defaults to
`https://api.matthewsdavies.com`). Outputs include `GuestbookApiUrl` (custom domain) and `GuestbookApiGatewayUrl`
(execute-api) for debugging.

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

Pull request previews are deployed by GitHub Actions to stack names like `simple-site-pr-16` and
domains like `pr-16.<RootDomainName>`. The workflow keeps previews around while the PR is open,
deploys new commits automatically, and deletes the stack on close.

Required setup (one-time):

- Create an IAM role for GitHub OIDC with permissions to create/update/delete the CloudFormation stack
  (ECS, ECR, ALB, ACM, Route53, CloudWatch Logs, IAM).
- Allow the role to read the Docker Hub secret in Secrets Manager.
- Add the role ARN as a GitHub Actions secret named `AWS_PREVIEW_ROLE_ARN`.

Notes:

- The workflow skips PRs from forks (no secrets/credentials).
- Preview stacks set `EnablePipeline=false` so CodePipeline resources are not created.
- Preview domains are `pr-<number>.<RootDomainName>`; the hosted zone must be the root domain zone.
- The workflow uses `DesiredCount=0` on the first deploy and scales to 1 after the image is pushed.
