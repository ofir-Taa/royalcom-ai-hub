const el = {
  pingNotice: document.querySelector('#pingNotice'),
  checkPing: document.querySelector('#checkPing'),
  device: document.querySelector('#device'),
  vlan: document.querySelector('#vlan'),
  urgency: document.querySelector('#urgency'),
  symptom: document.querySelector('#symptom'),
  tried: document.querySelector('#tried'),
  build: document.querySelector('#build'),
  output: document.querySelector('#output'),
  copy: document.querySelector('#copy'),
  toChat: document.querySelector('#toChat'),
};

function setNotice(node, text, kind) {
  node.textContent = text;
  node.className = 'notice' + (kind ? ' ' + kind : '');
}

// Availability check only: a fetch to a local port either resolves (something
// is listening) or rejects (nothing there / blocked). With mode:'no-cors' we
// cannot read the response body or status, so this never pretends to read
// real data from Royal Network Insight — it only reports reachability.
async function checkPing() {
  setNotice(el.pingNotice, 'בודק זמינות על 127.0.0.1:8080...', 'info');
  el.checkPing.disabled = true;
  try {
    await fetch('http://127.0.0.1:8080/', { mode: 'no-cors', cache: 'no-store' });
    setNotice(el.pingNotice, '🟢 משהו מגיב על 127.0.0.1:8080 (בדיקת זמינות בלבד, לא קריאת מידע)', 'ok');
  } catch {
    setNotice(el.pingNotice, '🔴 אין תגובה על 127.0.0.1:8080 — ודא ש-Royal Network Insight פועל במחשב הזה', 'err');
  } finally {
    el.checkPing.disabled = false;
  }
}

el.checkPing.onclick = checkPing;
checkPing();

el.build.onclick = () => {
  const lines = [
    'פתק תקלת רשת — ' + new Date().toLocaleString('he-IL'),
    '',
    'מכשיר / אזור: ' + (el.device.value.trim() || '—'),
    'VLAN / רשת: ' + (el.vlan.value.trim() || '—'),
    'דחיפות: ' + el.urgency.value,
    '',
    'תיאור התקלה:',
    el.symptom.value.trim() || '—',
    '',
    'מה נבדק עד כה:',
    el.tried.value.trim() || '—',
  ];
  el.output.value = lines.join('\n');
};

el.copy.onclick = () => {
  if (!el.output.value) return alert('הכן פתק תחילה');
  navigator.clipboard.writeText(el.output.value)
    .then(() => alert('הפתק הועתק'))
    .catch(() => alert('לא ניתן להעתיק בדפדפן הזה'));
};

el.toChat.onclick = () => {
  if (!el.output.value) return alert('הכן פתק תחילה');
  localStorage.setItem('royalcom-prefill-איתי', el.output.value);
  location.href = './chat.html?name=' + encodeURIComponent('איתי');
};
