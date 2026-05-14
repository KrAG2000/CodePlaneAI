# CodePlaneAI MVP

It does four real things (For now! More features planned):

1. accepts a plain-English engineering trigger,
2. triages it into a structured execution plan,
3. waits for the coding agent to return the result,
4. validates and optionally performs branch, commit, push, and PR creation.

## What This MVP Is

This is a small orchestration service, not the coding agent itself.

Current flow:

```text
Plain text trigger
-> triage
-> policy check
-> structured agent handoff plan
-> agent makes changes in repo
-> microservice validates
-> git branch/commit/push
-> GitHub PR
```

## What This MVP Is Not Yet 

- Slack-integrated (Any communication platform integration: Planned)
- queue-backed (Planned)
- multi-tenant (Planned)
- provider-routed across many agents (Planned)
- production hardened (Building for personal use for now)

## Endpoints

### `GET /health`

Health check.

### `POST /api/triggers/text`

Creates an execution plan from a plain-English issue report. 
[Planned for future - Image assessment for better triage accuracy]

Headers:

```text
x-api-token: <API_TRIGGER_TOKEN>
```

Example body:

```json
{
  "message": "The backend is showing wrong data on our segment page. Please check."
}
```

### `GET /api/executions`

Lists saved executions.

### `GET /api/executions/:id`

Gets one execution.

### `POST /api/executions/:id/agent-result`

Use this after the coding agent has made changes in the configured local repo.

Example body:

```json
{
  "summary": "Fixed incorrect segment mapping in backend response formatter and added tests.",
  "changedFiles": [
    "src/services/segment-service.ts",
    "src/controllers/segment-controller.ts",
    "tests/segment-service.test.ts"
  ],
  "notes": [
    "Added a regression test for segment filtering"
  ]
}
```

This endpoint:

1. runs validation commands,
2. checks protected path policy,
3. creates a branch,
4. commits changes,
5. pushes to GitHub,
6. creates a PR if configured.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the env file and fill it in:

```bash
cp .env.example .env
```

3. Start in dev mode:

```bash
npm run dev
```

4. Build for production:

```bash
npm run build
npm start
```

## Environment Variables (A separate dashboard + secure DB implementation for saving of sensitive data securely required - P2)

### Required for plan-only mode

- `API_TRIGGER_TOKEN`

### Required for validation and Git operations

- `LOCAL_REPO_PATH`
- `GITHUB_BASE_BRANCH`
- `VALIDATION_COMMANDS`

### Required for PR creation

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_TOKEN`



## Example Request Flow

### 1. Create execution

```bash
curl -X POST http://localhost:3000/api/triggers/text \
  -H "content-type: application/json" \
  -H "x-api-token: change-me" \
  -d '{"message":"The backend is showing wrong data on our segment page. Please check."}'
```

### 2. Copy `plan.handoffPrompt` into your coding agent

The coding agent then works on your repo and makes changes locally.

### 3. Finalize the run

```bash
curl -X POST http://localhost:3000/api/executions/<execution-id>/agent-result \
  -H "content-type: application/json" \
  -H "x-api-token: change-me" \
  -d '{
    "summary":"Fixed backend segment data mapping and updated tests.",
    "changedFiles":["src/example.ts","tests/example.test.ts"]
  }'
```

## Files

- `src/index.ts`: Fastify API
- `src/services/triage.ts`: simple natural-language triage
- `src/services/policy.ts`: lightweight policy checks
- `src/services/context.ts`: repo/context shaping
- `src/services/planner.ts`: structured agent handoff plan
- `src/services/git-service.ts`: validation, branch, commit, push, PR
- `src/services/execution-service.ts`: orchestration state transitions
- `src/store/file-store.ts`: local JSON persistence

## Pre-requisites

To connect this MVP to your real repo and make it useful, below items are requried beforehand:

1. The GitHub repository URL or `owner/repo`.
2. The local filesystem path where that repo is checked out on this machine. (Commands that make changes to local files outside the scope will be restricted and this service will not have access to files and folders outside the set scope aka `git clone` will not work unless access is given to the parent directory: `Needs handling`)
3. The default base branch, usually `main` (Multiple branch support: P2).
4. The validation commands that should run before commit/PR(If repo has followed any validations practices).
5. Whether I should allow auto-push and PR creation immediately(Permission control setup, handled via dashboard: P2).
6. A GitHub token with repo access, or confirmation that you want PR creation skipped for now(P2).
7. Any protected paths that must never be auto-committed, such as `infra/`, `db/migrations/`, or billing/auth code(Exclude/Blacklist folder/files: P3).
8. Real platform integration (e.g. Slack)
