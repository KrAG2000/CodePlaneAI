# CodePlaneAI MVP

It does six real things (For now! More features planned):

1. accepts a plain-English engineering trigger,
2. triages it into a structured execution plan,
3. writes a Codex handoff file,
4. sends optional Slack status notifications,
5. waits for the coding agent to return the result,
6. validates and optionally performs branch, commit, push, and PR creation.

## What This MVP Is

This is a small orchestration service, not the coding agent itself.

Current flow:

```text
Plain text trigger
-> triage
-> policy check
-> structured Codex handoff file
-> agent makes changes in repo
-> microservice validates
-> git branch/commit/push
-> GitHub PR if enabled
```

## What This MVP Is Not Yet 

- full Slack Events API verification (P2)
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

### `POST /api/triggers/slack`

Creates an execution from a Slack-like JSON payload.

Headers:

```text
x-api-token: <API_TRIGGER_TOKEN>
```

Example body:

```json
{
  "text": "The backend is showing wrong data on our segment page. Please check.",
  "user": "backend-team",
  "channel": "engineering"
}
```

### `POST /slack/command`

Slack slash-command compatible endpoint.

Example form body:

```text
text=The backend is showing wrong data on our segment page. Please check.
```

If `SLACK_VERIFICATION_TOKEN` is configured, the request must include the matching Slack token.

### `POST /slack/events`

Slack Events API compatible endpoint.

It handles Slack URL verification and creates executions from plain channel message events. It ignores bot messages and message subtypes.

### `GET /api/executions/:id/handoff`

Returns the generated Codex handoff Markdown for an execution.

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
- `TRIAGE_MODEL_ID`

### AI routing configuration

- `AI_CONFIG_DIR` defaults to `config/ai-models`
- `TRIAGE_MODEL_ID` selects the primary model config file by id
- `TRIAGE_FALLBACK_MODEL_IDS` is an optional comma-separated fallback chain
- provider API keys are read directly inside each `.js` model config from `process.env`

### AI model configs

CodePlaneAI now uses a provider-agnostic HTTP middleware layer.

- Runtime model configs live in `config/ai-models/*.js`
- Each file exports a model config object and can read secrets directly from `process.env`
- Each file defines the provider name, platform name, base URL, endpoint path, auth style, model id, default params, and payload protocol
- Supported protocol families in this repo are:
  - `openai-responses`
  - `openai-chat`
  - `anthropic-messages`
  - `google-gemini-generate-content`
- Add a new model on an existing protocol by dropping in another config file
- Add a new provider wire format by adding one adapter under `src/ai/providers`

### Required for validation and Git operations

- `LOCAL_REPO_PATH`
- `GITHUB_BASE_BRANCH`
- `VALIDATION_COMMANDS` if you want validation. Empty means validation is skipped.

### Required for PR creation

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_TOKEN`

### Required for Slack notifications

- `SLACK_INCOMING_WEBHOOK_URL`

Important: Slack incoming webhooks can send messages into Slack. They cannot receive channel messages. For Slack-originated triggers, use a Slack slash command pointed at `/slack/command`, Slack Events API pointed at `/slack/events`, or a relay service that calls `/api/triggers/slack`.

### Optional automatic agent execution

- `ENABLE_AGENT_AUTO_RUN=true`
- `AGENT_PROVIDER=codex` or `claude`
- `AGENT_COMMAND=codex` or `claude`
- `AGENT_MODEL` to pin a CLI model if needed
- `AGENT_TIMEOUT_MS` for longer-running automated sessions
- `CODEX_SANDBOX` applies when using Codex CLI automation

## Current Config Defaults

The local `.env` and `.env.example` are configured for:

- repo: `KrAG2000/CodePlaneAI`
- base branch: `main`
- PR creation: disabled
- git push: enabled
- validation: skipped
- Codex handoff directory: `.data/handoffs`



## Example Request Flow

### 1. Create execution

```bash
curl -X POST http://localhost:3000/api/triggers/text \
  -H "content-type: application/json" \
  -H "x-api-token: change-me" \
  -d '{"message":"The backend is showing wrong data on our segment page. Please check."}'
```

### 2. Open the generated Codex handoff file

The response includes `handoffPath`, for example:

```text
.data/handoffs/exec_abc123.md
```

Open that file in VS Code and use it as the Codex task prompt. Codex then works on your repo and makes changes locally.

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
- `src/services/handoff-service.ts`: Codex handoff Markdown writer
- `src/services/slack-service.ts`: Slack webhook notifications
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

Test pipeline change: README updated through CodePlaneAI flow.
