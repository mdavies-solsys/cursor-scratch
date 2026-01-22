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
- `Dockerfile`: Container image for the static site

### Guestbook API (optional)

The CloudFormation template also provisions a small DynamoDB-backed guestbook API (Lambda + HTTP API) and maps it to
`https://api.<RootDomainName>` via an API Gateway custom domain.
After deploy, ensure the `guestbook-api` meta tag in `index.html` points at that URL (this repo defaults to
`https://api.matthewsdavies.com`). Outputs include `GuestbookApiUrl` (custom domain) and `GuestbookApiGatewayUrl`
(execute-api) for debugging.

New guestbook entries are approved by default, but you can still hide or remove them with the admin panel. Admin
endpoints are protected by a shared phrase stored in Secrets Manager (`GuestbookAdminSecretArn`).

### Required parameters

- `HostedZoneId`: Route53 hosted zone id that contains your record
- `RootDomainName`: root/apex domain name (e.g. `example.com`). The stack also serves `www.<root>`.
- `CodeStarConnectionArn`: ARN of your existing CodeStar connection to GitHub
- `GitHubOwner`: GitHub org/user
- `GitHubRepo`: repo name
- `DockerHubSecretArn`: ARN of Secrets Manager secret with Docker Hub `username` + `password`

Optional parameters you may want to override:

- `BranchName` (default `main`)
- `DesiredCount`, `Cpu`, `Memory`
- `GuestbookRateLimitMax` (default `5`)
- `GuestbookRateLimitWindowSeconds` (default `3600`)
- `GuestbookAdminSecretArn` (default empty, Secrets Manager ARN with admin phrase)

### Guestbook moderation (admin)

To approve or remove entries you can either use the AWS console (DynamoDB table) or the built-in admin panel.

1. Create a Secrets Manager secret that contains your admin phrase. Either store the phrase as plain text or as JSON:

```
my easy phrase
```

or

```json
{"token":"my easy phrase"}
```

2. Deploy the updated stack with `GuestbookAdminSecretArn` set to the secret ARN.
3. Open the site with `?guestbookAdmin=1`, paste the **phrase**, and hide/remove entries as needed.

If you prefer the console, open the DynamoDB table from the stack output (`GuestbookTableName`) and delete or edit
items with `pk` values like `handle#<xhandle>` (set `approved` to `true` or remove the item).

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

