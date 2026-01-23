# History - PR Context Archive

This folder contains context documents from pull request conversations. Each file captures useful insights, decisions, and technical knowledge that emerged during PR development.

## Purpose

- **Preserve institutional knowledge** across PR conversations
- **Provide context** for future agents and developers
- **Document decisions** and their rationale
- **Capture research** and technical findings

## File Naming Convention

Files should be named with a **timestamp prefix** (YYYYMMDD-HHMM) followed by the branch name or descriptive identifier. This ensures chronological ordering when viewing the folder, even for multiple PRs on the same day.

```
{YYYYMMDD}-{HHMM}-{branch-name}.md
```

Examples:
- `20260123-1430-feature-large-room-mobile-performance.md`
- `20260123-0915-fix-webxr-session-handling.md`
- `20260122-1645-refactor-lighting-system.md`

Use the timestamp (UTC preferred) when the work began or the PR was created.

## File Structure

Each history file should include relevant sections from:

- **Problem Statement**: What issue was being addressed
- **Analysis**: Key findings and investigation results
- **Solution**: What was implemented and why
- **Design Decisions**: Trade-offs considered and choices made
- **Future Considerations**: Deferred options or next steps
- **Code References**: Key files and functions involved
- **Performance Metrics**: Before/after measurements (if applicable)

Not all sections are required - include what's relevant to the PR.

## Usage

When starting work on a related feature or investigating similar issues, check this folder for prior context that may inform your approach.
