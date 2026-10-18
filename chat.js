const name = new URLSearchParams(location.search).get('name') || 'רונה';

const el = {
  photo: document.querySelector('#photo'),
  name: document.querySelector('#name'),
  role: document.querySelector('#role'),
  tools: document.querySelector('#tools'),
  connection: document.querySelector('#connection'),
  log: document.querySelector('#log'),
  msg: document.querySelector('#msg'),
  send: document.querySelector('#send'),
  mic: document.querySelector('#mic'),
  clear: document.querySelector('#clear'),
};

el.name.textContent = name;
el.photo.src = 'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=' + encodeURIComponent(name);
el.photo.onerror = () => { el.photo.style.display = 'none'; };

// Workspace pages (itai.html, maya.html, yuval.html) hand off a prepared
// brief this way instead of auto-sending it, so the user still reviews and
// sends it themselves.
const prefillKey = 'royalcom-prefill-' + name;
const prefill = localStorage.getItem(prefillKey);
if (prefill) {
  el.msg.value = prefill;
  localStorage.removeItem(prefillKey);
}

const storageKey = 'royalcom-chat-' + name;
let history = [];
try {
  history = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
} catch {
  history = [];
}

function bubble(role, text) {
  const node = document.createElement('div');
  node.className = 'msg ' + (role === 'user' ? 'user' : role === 'assistant' ? 'ai' : 'sys');
  node.textContent = text;
  el.log.append(node);
  el.log.scrollTop = el.log.scrollHeight;
  return node;
}

function typingBubble() {
  const node = document.createElement('div');
  node.className = 'msg ai';
  node.innerHTML = '<span class="dots"><span></span><span></span><span></span></span>';
  el.log.append(node);
  el.log.scrollTop = el.log.scrollHeight;
  return node;
}

history.forEach((m) => bubble(m.role, m.content));

let agent = null;
let serverOk = false;
let apiKeyConfigured = false;

function setNotice(text, kind) {
  el.connection.textContent = text;
  el.connection.className = 'notice' + (kind ? ' ' + kind : '');
}

function refreshSendState() {
  const ready = serverOk && agent && agent.enabled && apiKeyConfigured;
  el.send.disabled = !ready;
}

async function loadStatus() {
  try {
    const [healthRes, agentsRes] = await Promise.all([
      fetch('/api/health'),
      fetch('/api/agents'),
    ]);
    if (!healthRes.ok || !agentsRes.ok) throw new Error('bad response');

    const health = await healthRes.json();
    const { agents } = await agentsRes.json();

    serverOk = true;
    apiKeyConfigured = Boolean(health.hasApiKey);
    agent = agents.find((a) => a.name === name) || null;

    if (!agent) {
      setNotice(`הסוכן "${name}" לא נמצא במרשם agents-registry.json`, 'err');
    } else {
      el.role.textContent = agent.domain || '';
      el.tools.textContent = agent.planned_connectors ? 'כלים מתוכננים: ' + agent.planned_connectors : '';

      if (!agent.enabled) {
        setNotice(`הסוכן אינו מופעל (enabled:false). ${agent.connection_status || ''}`, 'err');
      } else if (!apiKeyConfigured) {
        setNotice('שרת ה-AI מחובר, אך ANTHROPIC_API_KEY לא מוגדר (ראה server/.env.example)', 'err');
      } else {
        setNotice('מחובר לשרת ה-AI — מוכן לשיחה', 'ok');
      }
    }
  } catch {
    serverOk = false;
    setNotice('שרת ה-AI המקומי אינו פעיל. הרץ: cd server && npm install && npm start', 'err');
  }
  refreshSendState();
}

loadStatus();

el.send.onclick = async () => {
  const content = el.msg.value.trim();
  if (!content || el.send.disabled) return;

  el.send.disabled = true;
  bubble('user', content);
  history.push({ role: 'user', content });
  el.msg.value = '';

  const aiNode = typingBubble();
  let reply = '';
  let gotFirstToken = false;

  try {
    const res = await fetch('/api/chat/' + encodeURIComponent(name), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-20) }),
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `שגיאת שרת (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const block of events) {
        let eventType = 'message';
        let dataLine = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) eventType = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLine = line.slice(5).trim();
        }
        if (!dataLine) continue;

        let payload;
        try {
          payload = JSON.parse(dataLine);
        } catch {
          continue;
        }

        if (eventType === 'error') {
          throw new Error(payload.error || 'שגיאת מודל');
        }
        if (eventType === 'done') continue;
        if (payload.delta) {
          if (!gotFirstToken) {
            gotFirstToken = true;
            aiNode.textContent = '';
          }
          reply += payload.delta;
          aiNode.textContent = reply;
          el.log.scrollTop = el.log.scrollHeight;
        }
      }
    }

    if (!reply) throw new Error('לא התקבלה תשובה מהמודל');

    history.push({ role: 'assistant', content: reply });
    sessionStorage.setItem(storageKey, JSON.stringify(history));
  } catch (err) {
    aiNode.className = 'msg sys';
    aiNode.textContent = 'הבקשה לא בוצעה: ' + err.message;
    history.pop(); // drop the unanswered user turn so it isn't resent silently
  } finally {
    refreshSendState();
  }
};

el.msg.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    el.send.click();
  }
});

el.clear.onclick = () => {
  history = [];
  el.log.replaceChildren();
  sessionStorage.removeItem(storageKey);
};

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognitionImpl) {
  const recognizer = new SpeechRecognitionImpl();
  recognizer.lang = 'he-IL';
  recognizer.interimResults = false;

  recognizer.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    el.msg.value += (el.msg.value ? ' ' : '') + transcript;
  };
  recognizer.onerror = (e) => {
    setNotice('זיהוי דיבור נכשל: ' + e.error, 'err');
  };
  recognizer.onstart = () => el.mic.classList.add('on');
  recognizer.onend = () => el.mic.classList.remove('on');

  el.mic.onclick = () => recognizer.start();
} else {
  el.mic.disabled = true;
  el.mic.textContent = 'מיקרופון לא נתמך בדפדפן זה';
}

