## Cursor Agent Guide (repo purpose + conventions)

This repository exists to **play with Cursor agents** with minimal stakes and minimal “product” expectations.
It is intentionally small and flexible, but we still keep structure so anything valuable is easy to extract later.

### Goals

- Keep experiments fast, disposable, and low-risk
- Make it easy to copy useful output into other repos later
- Avoid clutter in the repo root

### Suggested structure

- **`playground/`**: quick spikes, prototypes, throwaway scripts, “try it and delete it”
- **`snippets/`**: reusable code fragments (small + portable) with a short README per snippet
- **`notes/`**: markdown notes, prompts, decisions, scratch writeups
- **`tmp/`**: local-only scratch output (gitignored)

If you’re adding a new “area”, prefer creating a folder with a `README.md` describing its intent.

### Naming conventions

- Prefer date- or topic-based folders for larger experiments, e.g.:
  - `playground/2026-01-13-agent-evals/`
  - `snippets/react-hook-form/`
- For snippets, include:
  - a minimal example
  - usage notes
  - any constraints (runtime, deps, Node/Python versions, etc.)

### Git hygiene

- Commit small, meaningful increments.
- Avoid committing credentials, `.env`, large binaries, or generated artifacts.
- Keep the default branch clean; experiments should live in `playground/` instead of the repo root.

### If you’re a Cursor agent running here

- Read `README.md` and this file first.
- Prefer adding new files under the structure above.
- If you introduce a new language/tool, add the smallest reasonable setup file (e.g. `package.json`, `requirements.txt`)
  and keep it scoped to the experiment folder when practical.
