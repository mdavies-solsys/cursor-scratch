## ci/

CloudFormation + CI/CD to deploy the simple static website (`projects/simple-site/`) to **AWS ECS Fargate** behind an **Application Load Balancer**, with:

- **ACM** certificate (DNS validation in Route53)
- **Route53** A-record alias pointing at the ALB
- **ECR** for container images
- **CodePipeline** triggered by changes to `main` (or your configured branch) via an existing **CodeStar Connection**
- **CodeBuild** that builds/pushes the image and outputs `imagedefinitions.json` for ECS deploy

### Files

- `ci/fargate-simple-site.yml`: CloudFormation template
- `ci/buildspec.yml`: CodeBuild buildspec used by the pipeline
- `projects/simple-site/Dockerfile`: Container image for the static site

### Required parameters

- `HostedZoneId`: Route53 hosted zone id that contains your record
- `DomainName`: full domain name (e.g. `www.example.com`)
- `CodeStarConnectionArn`: ARN of your existing CodeStar connection to GitHub
- `GitHubOwner`: GitHub org/user
- `GitHubRepo`: repo name

Optional parameters you may want to override:

- `BranchName` (default `main`)
- `DesiredCount`, `Cpu`, `Memory`

### Deploy (example)

Use your preferred deployment mechanism (Console, CLI, or IaC orchestration). Example CLI:

```bash
aws cloudformation deploy \
  --stack-name simple-site-fargate \
  --template-file ci/fargate-simple-site.yml \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    DomainName=www.example.com \
    HostedZoneId=Z123456ABCDEFG \
    CodeStarConnectionArn=arn:aws:codestar-connections:... \
    GitHubOwner=mdavies-solsys \
    GitHubRepo=cursor-scratch \
    BranchName=main
```

After creation completes, visit the `WebsiteUrl` output.

