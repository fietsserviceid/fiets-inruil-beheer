// === Utilities ===
async function sha256(str){const buf=new TextEncoder().encode(str);const hash=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function base32ToBytes(base32){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';base32.split('').forEach(c=>{const i=alphabet.indexOf(c);if(i<0)return;bits+=i.toString(2).padStart(5,'0');});let out=[];for(let i=0;i+8<=bits.length;i+=8) out.push(parseInt(bits.substring(i,i+8),2));return new Uint8Array(out);}
async function generateTOTP(secret){const key=await crypto.subtle.importKey('raw',base32ToBytes(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);const counter=Math.floor(Date.now()/30000);let buf=new ArrayBuffer(8);new DataView(buf).setUint32(4,counter);const hmac=await crypto.subtle.sign('HMAC',key,buf);const bytes=new Uint8Array(hmac);const offset=bytes[19]&0xf;const binary=((bytes[offset]&0x7f)<<24)
|((bytes[offset+1]&0xff)<<16)
|((bytes[offset+2]&0xff)<<8)
| (bytes[offset+3]&0xff);return (binary%1000000).toString().padStart(6,'0');}

// === Auth === 
let ADMINS=[];let DEALERS=[];let editingDealer=null;
fetch('./admins.json').then(r=>r.json()).then(j=>ADMINS=j.admins);

async function startLogin(){
  const u=document.getElementById('username').value;
  const p=document.getElementById('password').value;
  const hash=await sha256(p);
  const admin=ADMINS.find(a=>a.username===u && a.passwordHash===hash);
  if(!admin){document.getElementById('login-msg').textContent='Onjuiste gegevens';return;}
  sessionStorage.setItem('fsid_admin',JSON.stringify(admin));
  document.getElementById('login-screen').style.display='none';
  document.getElementById('totp-screen').style.display='block';
}

async function verifyTOTP(){
  const admin=JSON.parse(sessionStorage.getItem('fsid_admin'));
  const code=document.getElementById('totp').value;
  const valid=await generateTOTP(admin.totpSecret);
  if(code===valid){
    document.getElementById('totp-screen').style.display='none';
    document.getElementById('app').style.display='block';
  } else document.getElementById('totp-msg').textContent='Ongeldige code';
}

function logout(){sessionStorage.clear();location.reload();}

// === Settings (codes + dealers) === 
let GH={owner:'fietsserviceid',repo:'fiets-inruil-calculator',path:'codes.json',branch:'main'}; 
let GHD={owner:'fietsserviceid',repo:'fiets-inruil-beheer',path:'docs/dealers.json',branch:'main'}; 

function openSettings(){
  const d=document.getElementById('settingsDialog');
  document.getElementById('ghOwner').value=GH.owner;
  document.getElementById('ghRepo').value=GH.repo;
  document.getElementById('ghPath').value=GH.path;
  document.getElementById('ghBranch').value=GH.branch;

  document.getElementById('ghDOwner').value=GHD.owner;
  document.getElementById('ghDRepo').value=GHD.repo;
  document.getElementById('ghDPath').value=GHD.path;
  document.getElementById('ghDBranch').value=GHD.branch;

  document.getElementById('ghToken').value=sessionStorage.getItem('ghToken')||'';
  d.showModal();
}

function closeSettings(){document.getElementById('settingsDialog').close();}
function saveSettings(){
  GH.owner=document.getElementById('ghOwner').value.trim()||GH.owner;
  GH.repo=document.getElementById('ghRepo').value.trim()||GH.repo;
  GH.path=document.getElementById('ghPath').value.trim()||GH.path;
  GH.branch=document.getElementById('ghBranch').value.trim()||GH.branch;

  GHD.owner=document.getElementById('ghDOwner').value.trim()||GHD.owner;
  GHD.repo=document.getElementById('ghDRepo').value.trim()||GHD.repo;
  GHD.path=document.getElementById('ghDPath').value.trim()||GHD.path;
  GHD.branch=document.getElementById('ghDBranch').value.trim()||GHD.branch;

  const t=document.getElementById('ghToken').value;
  if(t){sessionStorage.setItem('ghToken',t);}
  closeSettings();
}

function ghHeaders(){
  const h={'Accept':'application/vnd.github+json'};
  const t=sessionStorage.getItem('ghToken');
  if(t) h['Authorization']='Bearer '+t;
  return h;
}

// === Dealers (autosave to GitHub) === 
let DEALERS_SHA=null; 
function setDealersStatus(m){document.getElementById('dealers-status').textContent=m||'';}

async function loadDealersFromGitHub(){
  try{
    setDealersStatus('Laden...');
    const url=`https://api.github.com/repos/${GHD.owner}/${GHD.repo}/contents/${GHD.path}?ref=${GHD.branch}`;
    const res=await fetch(url,{headers:ghHeaders()});
    if(!res.ok){const txt=await res.text(); throw new Error('GET dealers: '+res.status+' '+txt);}
    const data=await res.json();
    DEALERS_SHA=data.sha;
    const content=atob(data.content.replace(/\n/g,''));
    DEALERS=JSON.parse(content);
    renderDealers(DEALERS);
    setDealersStatus('Gereed.');
  }catch(e){ console.error(e); setDealersStatus('Kon dealers.json niet laden: '+e.message); }
}

function showDealers(){
  document.getElementById('dealers-screen').style.display='block';
  document.getElementById('codes-screen').style.display='none';
  loadDealersFromGitHub();
}

function renderDealers(list){
  const tbody=document.querySelector('#dealersTable tbody');
  tbody.innerHTML='';
  list.forEach(d=>{
    const row=document.createElement('tr');
    row.innerHTML=`<td>${d.name}</td><td>${d.city}</td><td>${d.code}</td><td>${d.active?'✓':'✗'}</td>
                   <td><button onclick="editDealer('${d.id}')">✏️</button>
                   <button onclick="deleteDealer('${d.id}')">🗑️</button></td>`;
    tbody.appendChild(row);
  });
}

// === ⭐ GEHEEL AANGEPASTE FUNCTIE HIERONDER ===
// CODES-scherm gebruikt nu dezelfde dealers-lijst
async function ensureDealersLoaded(){
  if(DEALERS_LIST?.length) return;

  try{
    const url='https://raw.githubusercontent.com/fietsserviceid/fiets-inruil-beheer/main/docs/dealers.json';
    const r=await fetch(url);
    DEALERS_LIST=await r.json();
  }catch(e){
    console.warn('Dealers laden voor datalist mislukt (optioneel):', e);
  }
}
// === EINDE AANPASSING ===

function renderDealerDatalist(){
  const dl=document.getElementById('dealerNames');
  if(!dl || dl.dataset.ready==='1') return;
  dl.innerHTML=(DEALERS_LIST||[])
      .filter(d=>d.active!==false)
      .map(d=>`<option value="${escapeHtml(d.name)}"></option>`)
      .join('');
  dl.dataset.ready='1';
}

// etc… (rest van jouw bestand exact hetzelfde)
