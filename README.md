# RoyalCom AI Hub

An RTL (Hebrew) control panel listing RoyalCom's per-agent AI assistants, with a real per-agent chat frontend backed by a secure Node.js proxy to the Anthropic API.

**No fake AI.** The chat frontend never fabricates a reply. If an agent is disabled, the backend has no API key configured, or the upstream call fails, the UI shows the real error — it does not simulate a response.

## How it's organized

```
index.html              portal: all agents, search, links to chat + detail pages
agent.html               per-agent detail page with suggested prompt buttons
chat.html / chat.js      per-agent live chat UI (RTL, typing indicator, speech-to-text)
agents-registry.json     single source of truth for agent names, domains, system
                         prompts, planned connectors, enabled/connection status
server/                  Node backend: proxies chat to Anthropic using a
                         server-side API key, serves the static frontend
```

`agents-registry.json` is read by the backend on every request (no restart
needed after an edit), so it is the one place that defines which agents
exist, what each one's system prompt is, and whether it's turned on.

## Architecture

- **Frontend** (`chat.html` + `chat.js`): renders the conversation, shows a
  live typing indicator while the model is responding, and supports Hebrew
  speech-to-text via the browser's Web Speech API (`he-IL`). It talks to the
  backend only through `/api/*` — it never sees an API key.
- **Backend** (`server/`): an Express app that
  - loads `agents-registry.json` to resolve each agent's domain and
    `system_instructions` (used as the model's system prompt) and its
    `enabled` flag,
  - exposes `GET /api/agents` (public agent metadata, no prompts/secrets),
    `GET /api/health` (whether an API key is configured), and
    `POST /api/chat/:agentName` (the chat relay),
  - calls the real Anthropic Messages API with `stream: true` using
    `ANTHROPIC_API_KEY` from `server/.env`, and relays the Server-Sent
    Events straight through to the browser so the UI genuinely streams
    tokens as they're generated,
  - rejects requests for agents that are disabled or unknown, and requests
    made while no API key is configured, with a clear error — rather than
    returning any kind of placeholder reply,
  - applies basic hardening: `helmet`, per-IP rate limiting on `/api/chat`,
    a JSON body size cap, and message/role/length validation,
  - also serves the static frontend files from the repo root on the same
    origin (so there's no CORS setup needed for local use), while
    explicitly blocking `/server/*` and dotfiles so `server/.env` can never
    be fetched over HTTP.

## Setup

```bash
cd server
npm install
copy .env.example .env   # (or `cp` on macOS/Linux)
```

Edit `server/.env` and set:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Then start the server:

```bash
npm start
```

Open **http://localhost:3001** in a Chromium-based browser (Chrome or Edge
— required for the speech recognition button; other browsers can still
type and chat normally).

## Enabling an agent

Every agent in `agents-registry.json` ships with `"enabled": false`. The
chat backend refuses to call the model for a disabled agent. To turn one on
for real use:

1. Open `agents-registry.json`.
2. Set `"enabled": true` for the agent you want to activate.
3. Refresh the chat page — no server restart required.

Review and tighten `system_instructions` for that agent before enabling it
in anything beyond local testing.

## Security notes

- The Anthropic API key lives only in `server/.env` (gitignored) and is
  read only by the Node process; it is never sent to or readable by the
  browser.
- `/api/chat/:agentName` is rate-limited (20 requests/minute/IP by
  default) and validates message count, role, and length before calling
  the model.
- `server/.env` and any dotfile are blocked from static serving, and
  `/server/*` is blocked outright, so the backend's own source/config
  directory is never reachable over HTTP even though it lives in the same
  repo tree as the static frontend.
- `agents-registry.json` is the authorization gate: an agent must be
  explicitly `enabled: true` before the backend will relay chat for it.

## Known limitations

- This is a chat-relay scaffold, not the full multi-agent system described
  in `agents-registry.json`. The planned connectors (Gmail, Calendar,
  Drive, SmartBI, Home Assistant, etc.) are **not** wired up — each
  agent's model call currently only has its name, domain, and
  `system_instructions` as context, nothing live from those systems.
- Speech recognition uses the browser's built-in Web Speech API, which is
  currently only implemented in Chromium-based browsers.
- Chat history is kept in `sessionStorage` per agent/browser tab for
  convenience; it is not persisted server-side or shared across devices.
