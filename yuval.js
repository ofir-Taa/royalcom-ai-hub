const REPO_URL = 'https://github.com/ofir-Taa/Task-system';

const el = {
  issueType: document.querySelector('#issueType'),
  priority: document.querySelector('#priority'),
  title: document.querySelector('#title'),
  area: document.querySelector('#area'),
  description: document.querySelector('#description'),
  acceptance: document.querySelector('#acceptance'),
  build: document.querySelector('#build'),
  output: document.querySelector('#output'),
  copy: document.querySelector('#copy'),
  openIssue: document.querySelector('#openIssue'),
  toChat: document.querySelector('#toChat'),
};

const typeLabel = {
  feature: 'תכונה חדשה',
  bug: 'תיקון באג',
  chore: 'תחזוקה',
  docs: 'תיעוד',
};

function buildMarkdown() {
  const type = typeLabel[el.issueType.value] || el.issueType.value;
  return [
    '### סוג: ' + type + ' | עדיפות: ' + el.priority.value,
    '',
    '**אזור / קומפוננטה:** ' + (el.area.value.trim() || '—'),
    '',
    '**תיאור**',
    el.description.value.trim() || '—',
    '',
    '**קריטריוני קבלה**',
    el.acceptance.value.trim() || '—',
  ].join('\n');
}

el.build.onclick = () => {
  if (!el.title.value.trim()) return alert('יש להזין כותרת');
  const body = buildMarkdown();
  el.output.value = body;
  const params = new URLSearchParams({ title: el.title.value.trim(), body });
  el.openIssue.href = REPO_URL + '/issues/new?' + params.toString();
};

el.copy.onclick = () => {
  if (!el.output.value) return alert('הכן Issue תחילה');
  navigator.clipboard.writeText(el.output.value)
    .then(() => alert('הועתק'))
    .catch(() => alert('לא ניתן להעתיק בדפדפן הזה'));
};

el.toChat.onclick = () => {
  if (!el.output.value) return alert('הכן Issue תחילה');
  localStorage.setItem('royalcom-prefill-יובל', 'כותרת: ' + el.title.value.trim() + '\n\n' + el.output.value);
  location.href = './chat.html?name=' + encodeURIComponent('יובל');
};
