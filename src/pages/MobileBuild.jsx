import React from "react";
import { Link } from "react-router-dom";

const MobileBuild = () => {
  return (
    <>
      <div className="ambient">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <div className="shell">
        <header className="site-header">
          <div className="brand">
            <span className="brand-dot"></span>
            <span className="brand-name">Matt Davies</span>
          </div>
          <div className="social-links">
            <a
              className="social-link"
              href="https://github.com/mdavies-solsys/cursor-scratch"
              target="_blank"
              rel="noreferrer"
              aria-label="View this site on GitHub"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.54 2.87 8.39 6.84 9.75.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.71-2.78.62-3.36-1.38-3.36-1.38-.45-1.18-1.11-1.49-1.11-1.49-.9-.64.07-.63.07-.63 1 .07 1.52 1.05 1.52 1.05.89 1.57 2.34 1.12 2.91.85.09-.66.35-1.12.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.32.1-2.75 0 0 .84-.27 2.75 1.03A9.3 9.3 0 0 1 12 6.85c.85 0 1.71.12 2.5.35 1.91-1.3 2.75-1.03 2.75-1.03.55 1.43.2 2.49.1 2.75.64.72 1.03 1.63 1.03 2.75 0 3.94-2.35 4.8-4.58 5.05.36.32.68.95.68 1.92 0 1.39-.01 2.5-.01 2.84 0 .27.18.59.69.48 3.96-1.36 6.82-5.21 6.82-9.75C22 6.58 17.52 2 12 2z"></path>
              </svg>
            </a>
            <a
              className="social-link"
              href="https://x.com/m_davies94"
              target="_blank"
              rel="noreferrer"
              aria-label="View Matt Davies on X"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.507 11.24h-6.53l-5.117-6.69-5.86 6.69H2.016l7.73-8.84L1.6 2.25h6.694l4.62 6.11 5.33-6.11zm-1.16 17.52h1.834L7.34 4.126H5.37l11.714 15.643z"></path>
              </svg>
            </a>
          </div>
        </header>

        <div className="profile-photo">
          <img
            className="profile-photo__image"
            src="https://0.gravatar.com/avatar/0bda7c9e330d80383200b194d88c6c48?s=240"
            alt="Portrait of Matt Davies"
            width="120"
            height="120"
            loading="eager"
            decoding="async"
          />
        </div>

        <main>
          <section className="glass hero">
            <div>
              <h1 className="hero-title">Built on a phone, shipped to AWS.</h1>
              <p className="hero-lede">
                This site is intentionally simple, but the deployment is real: it’s containerized and shipped to AWS ECS
                Fargate behind an ALB with TLS, with CI/CD wired up so changes can automatically roll out from Git.
              </p>
              <p>
                Every step of the process was done on an iPhone. Cursor agent instructions, GitHub interactions, and AWS
                operations were all executed mobile-first to prove the entire workflow can be done without a laptop.
              </p>
            </div>
            <div className="hero-actions">
              <h2>Mobile-only build notes</h2>
              <p>Below is the full breakdown of the workflow, infrastructure, and mobile tooling used.</p>
              <Link className="guestbook-button" to="/">
                Back to homepage
              </Link>
            </div>
          </section>

          <section className="glass">
            <ul>
              <li>
                <strong>Start small:</strong> a single static <code>index.html</code> in <code>src/</code>.
              </li>
              <li>
                <strong>Containerize:</strong> an NGINX <code>Dockerfile</code> serves the static HTML on port 80.
              </li>
              <li>
                <strong>Infrastructure:</strong> a CloudFormation template provisions VPC networking, an internet-facing
                ALB, an ACM certificate validated via Route 53, and an ECS Fargate service pulling from ECR.
              </li>
              <li>
                <strong>Automated delivery:</strong> a CodePipeline + CodeBuild flow (via an existing CodeStar/CodeConnections
                connection) builds the image and deploys it to the running service when the repo updates.
              </li>
              <li>
                <strong>Git sync:</strong> a <code>ci/deployment.yaml</code> is included to make CloudFormation GitSync
                deployments straightforward.
              </li>
            </ul>
          </section>

          <div className="content-grid">
            <section className="glass">
              <h2>Mobile-only workflow highlights</h2>
              <ul>
                <li>
                  <strong>Cursor agents on iPhone:</strong> all prompt iterations, code generation, and review flowed through a
                  mobile session.
                </li>
                <li>
                  <strong>GitHub fully mobile:</strong> the initial repo was created on GitHub from the phone, with subsequent
                  commits, reviews, and merges also handled on mobile.
                </li>
                <li>
                  <strong>AWS fully mobile:</strong> parameter ARNs were gathered (Route 53 zone, ACM cert, CodeConnections),
                  the CloudFormation stack was deployed, and ECS services + CloudFormation events + pipeline runs were
                  monitored from the iPhone.
                </li>
              </ul>
            </section>

            <section className="glass">
              <h2>Closing notes</h2>
              <p>
                The overall effort was a short set of iterations: specify the outcome, generate an initial version, review it,
                remove unnecessary knobs, and then lock in the final domain + connection details.
              </p>
              <p>
                A key part of making an agent effective is human product intuition. Matthew Davies guided the agent with clear
                constraints, practical AWS context (Route 53 zone + connection ARN), and quick reviews that kept the solution
                focused and deployable without overengineering.
              </p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
};

export default MobileBuild;
