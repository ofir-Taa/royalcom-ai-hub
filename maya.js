const STORAGE_KEY = 'royalcom-maya-thailand-2027';

const fieldIds = [
  'startDate', 'endDate', 'travelers', 'origin',
  'lockedFlights', 'lockedStays', 'visaPassport', 'leaveDates',
  'budgetCeiling', 'otherConstraints', 'pace', 'budgetTier', 'notes',
];

const el = {};
fieldIds.forEach((id) => { el[id] = document.getElementById(id); });
el.regions = document.querySelectorAll('#regions input[type=checkbox]');
el.save = document.querySelector('#save');
el.load = document.querySelector('#load');
el.exportJson = document.querySelector('#exportJson');
el.importJson = document.querySelector('#importJson');
el.clear = document.querySelector('#clear');
el.build = document.querySelector('#build');
el.output = document.querySelector('#output');
el.copy = document.querySelector('#copy');
el.toChat = document.querySelector('#toChat');

// Default trip window is only a Feb 2027 placeholder; the form itself is
// where the real, locked-in dates/constraints should be entered.
if (!el.startDate.value) el.startDate.value = '2027-02-01';
if (!el.endDate.value) el.endDate.value = '2027-02-14';

function collect() {
  const data = {};
  fieldIds.forEach((id) => { data[id] = el[id].value; });
  data.regions = Array.from(el.regions).filter((c) => c.checked).map((c) => c.value);
  return data;
}

function apply(data) {
  if (!data) return;
  fieldIds.forEach((id) => { if (id in data) el[id].value = data[id]; });
  const selected = new Set(data.regions || []);
  el.regions.forEach((c) => { c.checked = selected.has(c.value); });
}

el.save.onclick = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collect()));
  alert('נשמר בדפדפן זה');
};

el.load.onclick = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!data) return alert('אין טופס שמור בדפדפן זה');
    apply(data);
  } catch {
    alert('שמירה קודמת פגומה, לא ניתן לטעון');
  }
};

el.exportJson.onclick = () => {
  const blob = new Blob([JSON.stringify(collect(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'maya-thailand-2027.json';
  a.click();
  URL.revokeObjectURL(url);
};

el.importJson.onchange = async () => {
  const file = el.importJson.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    apply(data);
  } catch {
    alert('לא ניתן לקרוא את הקובץ שנבחר');
  } finally {
    el.importJson.value = '';
  }
};

el.clear.onclick = () => {
  if (!confirm('לנקות את כל שדות הטופס?')) return;
  fieldIds.forEach((id) => { el[id].value = ''; });
  el.regions.forEach((c) => { c.checked = false; });
  el.pace.value = 'מאוזן';
  el.budgetTier.value = 'בינוני';
};

function line(label, value) {
  return label + ': ' + (value && value.trim() ? value.trim() : '—');
}

el.build.onclick = () => {
  const d = collect();
  const parts = [
    'בריף תכנון טיול — תאילנד, פברואר 2027',
    '',
    line('תאריכים', (d.startDate || '—') + ' עד ' + (d.endDate || '—')),
    line('מספר נוסעים', d.travelers),
    line('נקודת מוצא', d.origin),
    '',
    '--- אילוצי מסלול קיימים (אין לשנות) ---',
    'טיסות שהוזמנו:',
    d.lockedFlights.trim() || '—',
    'לינה שהוזמנה/שולמה:',
    d.lockedStays.trim() || '—',
    line('דרכון / ויזה', d.visaPassport),
    line('אילוצי חופש', d.leaveDates),
    line('תקציב מקסימלי כולל', d.budgetCeiling),
    'אילוצים נוספים:',
    d.otherConstraints.trim() || '—',
    '',
    '--- העדפות ---',
    line('אזורים מעניינים', d.regions.join(', ')),
    line('קצב מסלול', d.pace),
    line('רמת תקציב ליום', d.budgetTier),
    'הערות:',
    d.notes.trim() || '—',
    '',
    'הערה: אין כאן מחירים מאומתים או זמינות חיה — יש לבדוק בפועל לפני הזמנה.',
  ];
  el.output.value = parts.join('\n');
};

el.copy.onclick = () => {
  if (!el.output.value) return alert('הכן בריף תחילה');
  navigator.clipboard.writeText(el.output.value)
    .then(() => alert('הבריף הועתק'))
    .catch(() => alert('לא ניתן להעתיק בדפדפן הזה'));
};

el.toChat.onclick = () => {
  if (!el.output.value) return alert('הכן בריף תחילה');
  localStorage.setItem('royalcom-prefill-מאיה', el.output.value);
  location.href = './chat.html?name=' + encodeURIComponent('מאיה');
};
