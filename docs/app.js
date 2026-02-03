// === Utilities ===
async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function base32ToBytes(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of base32) {
    const i = alphabet.indexOf(c);
    if (i < 0) continue;
    bits += i.toString(2).padStart(5, '0');
  }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.substring(i, i + 8), 2));
  return new Uint8Array(out);
}
async function generateTOTP(secret) {
  const key = await crypto.subtle.importKey('raw', base32ToBytes(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const counter = Math.floor(Date.now() / 30000);
  const buf = new ArrayBuffer(8);
  new DataView(buf).setUint32(4, counter);
  const hmac = await crypto.subtle.sign('HMAC', key, buf);
  const bytes = new Uint8Array(hmac);
  const offset = bytes[19] & 0xf;
  const binary = ((bytes[offset] & 0x7f) << 24)
               | ((bytes[offset + 1] & 0xff) << 16)
               | ((bytes[offset + 2] & 0xff) << 8)
               |  (bytes[offset + 3] & 0xff);
  return (binary % 1000000).toString().padStart(6, '0');
}

// === Auth ===
let ADMINS = [];
let DEALERS = [];
let editingDealer = null;

fetch('./admins.json').then(r => r.json()).then(j => { ADMINS = j.admins; });

async function startLogin() {
  const u = document.getElementById('username').value;
  const p = document.getElementById('password').value;
  const hash = await sha256(p);
  const admin = ADMINS.find(a => a.username === u && a.passwordHash === hash);
  if (!admin) {
    document.getElementById('login-msg').textContent = 'Onjuiste gegevens';
    return;
  }
  sessionStorage.setItem('fsid_admin', JSON.stringify(admin));
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('totp-screen').style.display = 'block';
}

async function verifyTOTP() {
  const admin = JSON.parse(sessionStorage.getItem('fsid_admin'));
  const code = document.getElementById('totp').value;
  const valid = await generateTOTP(admin.totpSecret);
  if (code === valid) {
    document.getElementById('totp-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
  } else {
    document.getElementById('totp-msg').textContent = 'Ongeldige code';
  }
}

function logout() {
  // Bij uitloggen token ook wissen
  localStorage.removeItem('ghToken');
  sessionStorage.clear();
  location.reload();
}

// === Settings (codes + dealers) ===
let GH  = { owner: 'fietsserviceid', repo: 'fiets-inruil-calculator', path: 'codes.json',         branch: 'main' }; // codes.json
let GHD = { owner: 'fietsserviceid', repo: 'fiets-inruil-beheer',     path: 'docs/dealers.json', branch: 'main' }; // dealers.json

function openSettings() {
  const d = document.getElementById('settingsDialog');

  document.getElementById('ghOwner').value  = GH.owner;
  document.getElementById('ghRepo').value   = GH.repo;
  document.getElementById('ghPath').value   = GH.path;
  document.getElementById('ghBranch').value = GH.branch;

  document.getElementById('ghDOwner').value  = GHD.owner;
  document.getElementById('ghDRepo').value   = GHD.repo;
  document.getElementById('ghDPath').value   = GHD.path;
  document.getElementById('ghDBranch').value = GHD.branch;

  // Token voortaan uit localStorage lezen
  document.getElementById('ghToken').value = localStorage.getItem('ghToken') || '';
  d.showModal();
}
function closeSettings() {
  document.getElementById('settingsDialog').close();
}
function saveSettings() {
  GH.owner  = document.getElementById('ghOwner').value.trim()  || GH.owner;
  GH.repo   = document.getElementById('ghRepo').value.trim()   || GH.repo;
  GH.path   = document.getElementById('ghPath').value.trim()   || GH.path;
  GH.branch = document.getElementById('ghBranch').value.trim() || GH.branch;

  GHD.owner  = document.getElementById('ghDOwner').value.trim()  || GHD.owner;
  GHD.repo   = document.getElementById('ghDRepo').value.trim()   || GHD.repo;
  GHD.path   = document.getElementById('ghDPath').value.trim()   || GHD.path;
  GHD.branch = document.getElementById('ghDBranch').value.trim() || GHD.branch;

  const t = document.getElementById('ghToken').value;
  if (t) localStorage.setItem('ghToken', t); // ← blijvend opslaan

  closeSettings();
}
function ghHeaders() {
  const h = { 'Accept': 'application/vnd.github+json' };
  const t = localStorage.getItem('ghToken'); // ← uit localStorage halen
  if (t) h['Authorization'] = 'Bearer ' + t;
  return h;
}

// === Dealers (autosave to GitHub) ===
let DEALERS_SHA = null; // sha van docs/dealers.json
function setDealersStatus(m) { document.getElementById('dealers-status').textContent = m || ''; }

async function loadDealersFromGitHub() {
  try {
    setDealersStatus('Laden...');
    const url = `https://api.github.com/repos/${GHD.owner}/${GHD.repo}/contents/${GHD.path}?ref=${GHD.branch}`;
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) { const txt = await res.text(); throw new Error('GET dealers: ' + res.status + ' ' + txt); }
    const data = await res.json();
    DEALERS_SHA = data.sha;
    const content = atob(data.content.replace(/\n/g, ''));
    DEALERS = JSON.parse(content);
    renderDealers(DEALERS);
    setDealersStatus('Gereed.');
  } catch (e) {
    console.error(e);
    setDealersStatus('Kon dealers.json niet laden: ' + e.message);
  }
}
function showDealers() {
  document.getElementById('dealers-screen').style.display = 'block';
  document.getElementById('codes-screen').style.display   = 'none';
  loadDealersFromGitHub();
}
function renderDealers(list) {
  const tbody = document.querySelector('#dealersTable tbody');
  tbody.innerHTML = '';
  list.forEach(d => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${d.name}</td>
      <td>${d.city}</td>
      <td>${d.code}</td>
      <td>${d.active ? '✓' : '✗'}</td>
      <td>
        <button onclick="editDealer('${d.id}')">✏️</button>
        <button onclick="deleteDealer('${d.id}')">🗑️</button>
      </td>`;
    tbody.appendChild(row);
  });
}
function filterDealers() {
  const q = document.getElementById('dealerSearch').value.toLowerCase();
  renderDealers(
    DEALERS.filter(d =>
      String(d.name || '').toLowerCase().includes(q) ||
      String(d.city || '').toLowerCase().includes(q) ||
      String(d.code || '').toLowerCase().includes(q)
    )
  );
}
function nextDealerCode() { // DLR-0001 sequence
  let max = 0;
  const re = /^DLR-(\d{4})$/i;
  for (const d of DEALERS) {
    const m = String(d.code || '').match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const n = String(max + 1).padStart(4, '0');
  return `DLR-${n}`;
}
function formGenerateCode() { document.getElementById('form-code').value = nextDealerCode(); }
function newDealer() {
  editingDealer = null;
  document.getElementById('dealer-form-title').textContent = 'Nieuwe dealer';
  document.getElementById('form-name').value  = '';
  document.getElementById('form-city').value  = '';
  document.getElementById('form-code').value  = nextDealerCode();
  document.getElementById('form-active').checked = true;
  document.getElementById('dealer-form').style.display = 'block';
}
function editDealer(id) {
  const d = DEALERS.find(x => x.id === id); if (!d) return;
  editingDealer = d;
  document.getElementById('dealer-form-title').textContent = 'Dealer bewerken';
  document.getElementById('form-name').value  = d.name || '';
  document.getElementById('form-city').value  = d.city || '';
  document.getElementById('form-code').value  = d.code || '';
  document.getElementById('form-active').checked = !!d.active;
  document.getElementById('dealer-form').style.display = 'block';
}
function deleteDealer(id) {
  if (!confirm('Weet je zeker dat je deze dealer wilt verwijderen?')) return;
  DEALERS = DEALERS.filter(d => d.id !== id);
  renderDealers(DEALERS);
  saveDealersToGitHub('delete'); // auto-save
}
async function saveDealersToGitHub(action) {
  if (!DEALERS) { alert('Nog geen dealers geladen.'); return; }
  const t = localStorage.getItem('ghToken');
  if (!t) {
    alert('Voer eerst je GitHub token in bij Instellingen.');
    try { openSettings(); } catch (_) {}
    return;
  }
  try {
    const btn = document.getElementById('dealerSaveBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Opslaan…'; }
    setDealersStatus('Opslaan…');

    const jsonStr = JSON.stringify(DEALERS, null, 2) + '\n';
    const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
    const url = `https://api.github.com/repos/${GHD.owner}/${GHD.repo}/contents/${GHD.path}`;
    const message =
      action === 'update' ? 'FSID beheer: dealer bijgewerkt' :
      action === 'create' ? 'FSID beheer: dealer toegevoegd' :
      action === 'delete' ? 'FSID beheer: dealer verwijderd' :
                            'FSID beheer: update dealers.json';
    const body = { message, content: b64, sha: DEALERS_SHA, branch: GHD.branch };

    const res = await fetch(url, {
      method: 'PUT',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('PUT dealers: ' + res.status + ' ' + txt);
    }
    const result = await res.json();
    DEALERS_SHA = result.content.sha;
    setDealersStatus('Opgeslagen ✔');
  } catch (e) {
    console.error(e);
    setDealersStatus('Opslaan mislukt: ' + e.message);
  } finally {
    const btn = document.getElementById('dealerSaveBtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Opslaan'; }
  }
}
function saveDealer() {
  const name   = document.getElementById('form-name').value.trim();
  const city   = document.getElementById('form-city').value.trim();
  const code   = document.getElementById('form-code').value.trim();
  const active = document.getElementById('form-active').checked;

  if (!name || !city || !code) { alert('Naam, stad en code zijn verplicht.'); return; }

  let action = 'update';
  if (editingDealer) {
    editingDealer.name = name;
    editingDealer.city = city;
    editingDealer.code = code;
    editingDealer.active = active;
  } else {
    const id = 'd' + Math.floor(Math.random() * 1e9).toString(36);
    DEALERS.push({ id, name, city, code, active });
    action = 'create';
  }

  document.getElementById('dealer-form').style.display = 'none';
  renderDealers(DEALERS);
  saveDealersToGitHub(action); // auto-commit
}

// === Codes (bestaande flow) ===
let CODES_FULL = null;
let CODES_SHA  = null;
let CODES_VIEW = [];
let DEALERS_LIST = [];

async function ensureDealersLoaded() {
  if (DEALERS_LIST.length) return;
  try {
    // Zelfde bron als Dealers-tab: via GitHub API
    const url = `https://api.github.com/repos/${GHD.owner}/${GHD.repo}/contents/${GHD.path}?ref=${GHD.branch}`;
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) { const txt = await res.text(); throw new Error('GET dealers (datalist): ' + res.status + ' ' + txt); }
    const data = await res.json();
    const content = atob(data.content.replace(/\n/g, ''));
    DEALERS_LIST = JSON.parse(content);
  } catch (e) {
    console.warn('Dealers laden voor datalist mislukt (optioneel):', e);
  }
}
function renderDealerDatalist() {
  const dl = document.getElementById('dealerNames');
  if (!dl || dl.dataset.ready === '1') return;
  dl.innerHTML = (DEALERS_LIST || [])
    .filter(d => d.active !== false)
    .map(d => `<option value="${escapeHtml(d.name)}"></option>`)
    .join('');
  dl.dataset.ready = '1';
}
async function showCodes() {
  document.getElementById('dealers-screen').style.display = 'none';
  document.getElementById('codes-screen').style.display   = 'block';
  await ensureDealersLoaded();
  loadCodesFromGitHub();
}
function setCodesStatus(m) { document.getElementById('codes-status').textContent = m || ''; }
function escapeHtml(s) {
  return s
    ? String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
    : '';
}
function ghCodesUrl() {
  return `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${GH.path}?ref=${GH.branch}`;
}
async function loadCodesFromGitHub() {
  try {
    setCodesStatus('Laden...');
    const res = await fetch(ghCodesUrl(), { headers: ghHeaders() });
    if (!res.ok) { const txt = await res.text(); throw new Error('GET codes: ' + res.status + ' ' + txt); }
    const data = await res.json();
    CODES_SHA = data.sha;
    const content = atob(data.content.replace(/\n/g, ''));
    CODES_FULL = JSON.parse(content);
    CODES_VIEW = [...CODES_FULL.codes];
    renderDealerDatalist();
    renderCodes(CODES_VIEW);
    document.getElementById('codes-meta').textContent =
      `version: ${CODES_FULL.version} • price_eur_per_year: €${CODES_FULL.price_eur_per_year}`;
    setCodesStatus('Gereed.');
  } catch (e) {
    console.error(e);
    setCodesStatus('Kon codes.json niet laden: ' + e.message);
  }
}
function renderCodes(list) {
  const tbody = document.querySelector('#codesTable tbody');
  tbody.innerHTML = '';
  list.forEach(c => {
    const exp = c.expires ? String(c.expires).slice(0, 10) : '';
    const safeNote = escapeHtml(c.note || '');
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td style="font-family:monospace;">${c.code}</td>
        <td><input list="dealerNames" data-field="note" data-code="${c.code}" value="${safeNote}" style="width:95%"></td>
        <td style="text-align:center"><input type="checkbox" data-field="active" data-code="${c.code}" ${c.active ? 'checked' : ''}></td>
        <td><input type="date" data-field="expires" data-code="${c.code}" value="${exp}"></td>
      </tr>`);
  });
  tbody.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('change', onCodeFieldChange);
    inp.addEventListener('input', e => { if (e.target.type === 'date' || e.target.type === 'text') onCodeFieldChange(e); });
  });
}
function onCodeFieldChange(e) {
  const field = e.target.getAttribute('data-field');
  const code  = e.target.getAttribute('data-code');
  const obj   = CODES_FULL?.codes?.find(x => x.code === code);
  if (!obj) return;

  if (field === 'active') {
    obj.active = e.target.checked;
  } else if (field === 'note') {
    const val = e.target.value;
    const n = String(val || '').toLowerCase();
    const ok = (DEALERS_LIST || []).some(d => (d.active !== false) && String(d.name || '').toLowerCase() === n);
    if (!ok) { e.target.setCustomValidity('Kies een dealer uit de lijst'); e.target.reportValidity(); return; }
    e.target.setCustomValidity('');
    obj.note = val;
  } else if (field === 'expires') {
    obj.expires = e.target.value ? e.target.value : null;
  }
}
function filterCodes() {
  const q = document.getElementById('codesSearch').value.toLowerCase();
  if (!CODES_FULL) return;
  CODES_VIEW = CODES_FULL.codes.filter(c =>
    String(c.code || '').toLowerCase().includes(q) ||
    String(c.note || '').toLowerCase().includes(q)
  );
  renderCodes(CODES_VIEW);
}
async function saveCodesToGitHub() {
  if (!CODES_FULL) { alert('Nog geen codes geladen.'); return; }
  const t = localStorage.getItem('ghToken');
  if (!t) { alert('Voer eerst je GitHub token in bij Instellingen.'); return; }
  try {
    setCodesStatus('Opslaan...');
    const newObj = {
      price_eur_per_year: CODES_FULL.price_eur_per_year,
      version: CODES_FULL.version + 1,
      codes: CODES_FULL.codes
    };
    const jsonStr = JSON.stringify(newObj, null, 2) + '\n';
    const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
    const url = `https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${GH.path}`;
    const body = { message: 'FSID beheer: update codes.json (active/expires/note)', content: b64, sha: CODES_SHA, branch: GH.branch };
    const res = await fetch(url, { method: 'PUT', headers: { ...ghHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const txt = await res.text(); throw new Error('PUT codes: ' + res.status + ' ' + txt); }
    const result = await res.json();
    CODES_SHA = result.content.sha;
    CODES_FULL.version = newObj.version;
    document.getElementById('codes-meta').textContent =
      `version: ${CODES_FULL.version} • price_eur_per_year: €${CODES_FULL.price_eur_per_year}`;
    setCodesStatus('Opgeslagen ✔');
  } catch (e) {
    console.error(e);
    setCodesStatus('Opslaan mislukt: ' + e.message);
  }
}
