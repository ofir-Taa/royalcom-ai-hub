import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getAgent, listAgentsPublic } from './registry.js';
import { streamAnthropicMessage } from './anthropicClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');

const PORT = process.env.PORT || 3001;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 8000;

const app = express();

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '32kb' }));

const chatLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'יותר מדי בקשות. נסה שוב בעוד דקה.' },
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.get('/api/agents', (req, res) => {
  try {
    res.json({ agents: listAgentsPublic() });
  } catch (err) {
    res.status(500).json({ error: 'לא ניתן לקרוא את מרשם הסוכנים (agents-registry.json)' });
  }
});

app.post('/api/chat/:agentName', chatLimiter, async (req, res) => {
  const { agentName } = req.params;

  let agent;
  try {
    agent = getAgent(agentName);
  } catch (err) {
    return res.status(500).json({ error: 'לא ניתן לקרוא את מרשם הסוכנים (agents-registry.json)' });
  }

  if (!agent) {
    return res.status(404).json({ error: `הסוכן "${agentName}" לא נמצא במרשם הסוכנים` });
  }

  if (!agent.enabled) {
    return res.status(403).json({
      error: `הסוכן "${agentName}" מוגדר כלא פעיל (enabled:false). עדכן את agents-registry.json כדי להפעיל אותו.`,
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'מפתח ANTHROPIC_API_KEY לא מוגדר בשרת. צור server/.env מתוך server/.env.example והוסף מפתח.',
    });
  }

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
  if (!messages || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: `יש לשלוח מערך הודעות (עד ${MAX_MESSAGES})` });
  }
  for (const m of messages) {
    const roleOk = m && (m.role === 'user' || m.role === 'assistant');
    const contentOk = typeof m?.content === 'string' && m.content.length > 0 && m.content.length <= MAX_MESSAGE_LENGTH;
    if (!roleOk || !contentOk) {
      return res.status(400).json({ error: 'פורמט הודעה לא תקין' });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const upstream = await streamAnthropicMessage({
      apiKey,
      model: MODEL,
      system: agent.system_instructions,
      messages,
      signal: controller.signal,
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => '');
      res.write(`event: error\ndata: ${JSON.stringify({ error: `שגיאה מספק ה-AI (${upstream.status}): ${errText.slice(0, 300)}` })}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;

        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }

        if (event.type === 'content_block_delta' && event.delta?.text) {
          res.write(`data: ${JSON.stringify({ delta: event.delta.text })}\n\n`);
        } else if (event.type === 'message_stop') {
          res.write(`event: done\ndata: {}\n\n`);
        } else if (event.type === 'error') {
          res.write(`event: error\ndata: ${JSON.stringify({ error: event.error?.message || 'שגיאת מודל' })}\n\n`);
        }
      }
    }

    res.end();
  } catch (err) {
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'החיבור לשרת ה-AI נכשל: ' + err.message })}\n\n`);
      res.end();
    }
  }
});

// Serve the static frontend (index.html, agent.html, chat.html, chat.js,
// agents-registry.json) from the repo root, same-origin with the API so no
// cross-origin setup is needed for local use. /server and dotfiles (incl.
// server/.env) are explicitly blocked so secrets never become reachable
// over HTTP even though they live under the same repo tree.
app.use('/server', (req, res) => res.status(404).end());
const publicFiles = new Set(['index.html','agent.html','chat.html','chat.js','itai.html','itai.js','maya.html','maya.js','yuval.html','yuval.js','workspace.html','workspace.css','rona.jpg']);
app.get('/', (req,res)=>res.sendFile(path.join(REPO_ROOT,'index.html')));
app.get('/:file', (req,res,next)=>{if(!publicFiles.has(req.params.file))return res.status(404).end();res.sendFile(path.join(REPO_ROOT,req.params.file));});

app.listen(PORT, process.env.HOST || '127.0.0.1', () => {
  console.log(`RoyalCom AI Hub server listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set — chat requests will fail until server/.env is configured.');
  }
});
