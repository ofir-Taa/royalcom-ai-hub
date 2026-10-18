import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// agents-registry.json lives at the repo root (one level above server/).
const REGISTRY_PATH = path.join(__dirname, '..', '..', 'agents-registry.json');

// Read fresh every call so edits to agents-registry.json (e.g. flipping
// "enabled") take effect without restarting the server.
function loadRegistry() {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.agents)) {
    throw new Error('agents-registry.json is missing an "agents" array');
  }
  return parsed;
}

export function getAgent(name) {
  const { agents } = loadRegistry();
  return agents.find((a) => a.name === name) || null;
}

// Strip system_instructions before sending agent metadata to the browser —
// the prompt itself has no reason to leave the server.
export function listAgentsPublic() {
  const { agents } = loadRegistry();
  return agents.map(({ name, domain, planned_connectors, enabled, connection_status }) => ({
    name,
    domain,
    planned_connectors,
    enabled,
    connection_status,
  }));
}
