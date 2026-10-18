const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Opens a streaming completion against the real Anthropic Messages API.
// Returns the raw fetch Response; the caller relays its SSE body to the
// browser chunk by chunk, so no reply is ever invented on the server.
export function streamAnthropicMessage({ apiKey, model, system, messages, signal }) {
  return fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      system,
      max_tokens: 1024,
      stream: true,
      messages,
    }),
    signal,
  });
}
