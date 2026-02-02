// ===== Utility: SHA-256 and Base32 ===== 
async function sha256(str){const buf=new TextEncoder().encode(str);const hash=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');}
function base32ToBytes(base32){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';base32.split('').forEach(c=>{const i=alphabet.indexOf(c);if(i<0)return;bits+=i.toString(2).padStart(5,'0');});let out=[];for(let i=0;i+8<=bits.length;i+=8) out.push(parseInt(bits.substring(i,i+8),2));return new Uint8Array(out);} 
async function generateTOTP(secret){const key=await crypto.subtle.importKey('raw',base32ToBytes(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);const counter=Math.floor(Date.now()/30000);let buf=new ArrayBuffer(8);new DataView(buf).setUint32(4,counter);const hmac=await crypto.subtle.sign('HMAC',key,buf);const bytes=new Uint8Array(hmac);const offset=bytes[19]&0xf;const binary=((bytes[offset]&0x7f)<<24)|((bytes[offset+1]&0xff)<<16)|((bytes[offset+2]&0xff)<<8)|(bytes[offset+3]&0xff);return (binary%1000000).toString().padStart(6,'0');}
// ===== Auth (existing) ===== 
let ADMINS=[];let DEALERS=[];let editingDealer=null; 
fetch('./admins.json').then(r=>r.json()).then(j=>ADMINS=j.admins); 
async function startLogin(){const u=document.getElementById('username').value;const p=document.getElementById('password').value;const hash=await sha256(p);const admin=ADMINS.find(a=>a.username===u && a.passwordHash===hash);if(!admin){document.getElementById('login-msg').textContent='Onjuiste gegevens';return;}sessionStorage.setItem('fsid_admin',JSON.stringify(admin));document.getElementById('login-screen').style.display='none';document.getElementById('totp-screen').style.display='block';} 
async function verifyTOTP(){const admin=JSON.parse(sessionStorage.getItem('fsid_admin'));const code=document.getElementById('totp').value;const valid=await generateTOTP(admin.totpSecret);if(code===valid){document.getElementById('totp-screen').style.display='none';document.getElementById('app').style.display='block';}else document.getElementById('totp-msg').textContent='Ongeldige code';} 
function logout(){sessionStorage.clear();location.reload();} 
// ===== Dealers (Phase 2 remnants) ===== 
async function loadDealers(){const res=await fetch('./dealers.json');DEALERS=await res.json();renderDealers(DEALERS);} 
function showDealers(){document.getElementById('dealers-screen').style.display='block';document.getElementById('codes-screen').style.display='none';loadDealers();} 
function renderDealers(list){const tbody=document.querySelector('#dealersTable tbody');tbody.innerHTML='';list.forEach(d=>{const row=document.createElement('tr');row.innerHTML=`<td>${d.name}</td><td>${d.city}</td><td>${d.code}</td><td>${d.active?'✓':'✗'}</td><td><button onclick=\"editDealer('${d.id}')\">✏️</button><button onclick=\"deleteDealer('${d.id}')\">🗑️</button></td>`;tbody.appendChild(row);});} 
function filterDealers(){const q=document.getElementById('dealerSearch').value.toLowerCase();const filtered=DEALERS.filter(d=>d.name.toLowerCase().includes(q)||d.city.toLowerCase().includes(q)||d.code.toLowerCase().includes(q));renderDealers(filtered);}  
function newDealer(){editingDealer=null;document.getElementById('dealer-form-title').textContent='Nieuwe dealer';document.getElementById('form-name').value='';document.getElementById('form-city').value='';document.getElementById('form-code').value='';document.getElementById('form-active').checked=true;document.getElementById('dealer-form').style.display='block';}  
function editDealer(id){const d=DEALERS.find(x=>x.id===id);if(!d)return;editingDealer=d;document.getElementById('dealer-form-title').textContent='Dealer bewerken';document.getElementById('form-name').value=d.name;document.getElementById('form-city').value=d.city;document.getElementById('form-code').value=d.code;document.getElementById('form-active').checked=d.active;document.getElementById('dealer-form').style.display='block';} 
function deleteDealer(id){if(!confirm('Weet je zeker dat je deze dealer wilt verwijderen?'))return;DEALERS=DEALERS.filter(d=>d.id!==id);renderDealers(DEALERS);}  
function saveDealer(){const name=document.getElementById('form-name').value;const city=document.getElementById('form-city').value;const code=document.getElementById('form-code').value;const active=document.getElementById('form-active').checked;if(!name||!city||!code){alert('Naam, stad en code zijn verplicht.');return;}if(editingDealer){editingDealer.name=name;editingDealer.city=city;editingDealer.code=code;editingDealer.active=active;}else{const id='d'+Math.floor(Math.random()*1000000);DEALERS.push({id,name,city,code,active});}document.getElementById('dealer-form').style.display='none';renderDealers(DEALERS);}  
function cancelDealerForm(){document.getElementById('dealer-form').style.display='none';}  
// ===== CODES (Phase 3) =====  
let GH={owner:'fietsserviceid',repo:'fiets-inruil-calculator',path:'codes.json',branch:'main'};  
let CODES_FULL=null;  
let CODES_SHA=null;   
let CODES_VIEW=[];    
function openSettings(){const dlg=document.getElementById('settingsDialog');  
 document.getElementById('ghOwner').value=GH.owner;document.getElementById('ghRepo').value=GH.repo;document.getElementById('ghPath').value=GH.path;document.getElementById('ghBranch').value=GH.branch;document.getElementById('ghToken').value=sessionStorage.getItem('ghToken')||'';dlg.showModal();}  
function closeSettings(){document.getElementById('settingsDialog').close();}  
function saveSettings(){GH.owner=document.getElementById('ghOwner').value.trim();GH.repo=document.getElementById('ghRepo').value.trim();GH.path=document.getElementById('ghPath').value.trim();GH.branch=document.getElementById('ghBranch').value.trim();const t=document.getElementById('ghToken').value; if(t){sessionStorage.setItem('ghToken',t);} else {sessionStorage.removeItem('ghToken');} closeSettings();}  
function showCodes(){document.getElementById('dealers-screen').style.display='none';document.getElementById('codes-screen').style.display='block';loadCodesFromGitHub();}  
function ghHeaders(){const h={'Accept':'application/vnd.github+json'};const t=sessionStorage.getItem('ghToken');if(t) h['Authorization']='Bearer '+t;return h;}  
async function loadCodesFromGitHub(){try{setCodesStatus('Laden...');   
 const url=`https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${GH.path}?ref=${GH.branch}`;   
 const res=await fetch(url,{headers:ghHeaders()});   
 if(!res.ok){const txt=await res.text(); throw new Error('GitHub GET fout: '+res.status+' '+txt);}   
 const data=await res.json(); CODES_SHA=data.sha;   
 const content=atob(data.content.replace(/\n/g,''));   
 CODES_FULL=JSON.parse(content);   
 CODES_VIEW=[...CODES_FULL.codes];   
 renderCodes(CODES_VIEW);   
 document.getElementById('codes-meta').textContent=`version: ${CODES_FULL.version} • price_eur_per_year: €${CODES_FULL.price_eur_per_year}`;   
 setCodesStatus('Gereed.');   
}catch(e){console.error(e); setCodesStatus('Kon codes.json niet laden: '+e.message);}}  
function renderCodes(list){const tbody=document.querySelector('#codesTable tbody');tbody.innerHTML='';list.forEach((c,idx)=>{   
 const tr=document.createElement('tr');   
 const exp = c.expires ? String(c.expires).slice(0,10) : '';   
 tr.innerHTML = `   
   <td style="font-family:monospace;">${c.code}</td>   
   <td><input data-field="note" data-code="${c.code}" value="${c.note?escapeHtml(c.note):''}" style="width:95%"></td>   
   <td style="text-align:center"><input type="checkbox" data-field="active" data-code="${c.code}" ${c.active?'checked':''}></td>   
   <td><input type="date" data-field="expires" data-code="${c.code}" value="${exp}"></td>`;   
 tbody.appendChild(tr);   
});   
 tbody.querySelectorAll('input').forEach(inp=>{   
   inp.addEventListener('change', onCodeFieldChange);   
   inp.addEventListener('input', (e)=>{ if(e.target.type==='date'||e.target.type==='text') onCodeFieldChange(e); });   
 });  
}  
function escapeHtml(s){return s?String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])):'';}  
function onCodeFieldChange(e){const field=e.target.getAttribute('data-field');const code=e.target.getAttribute('data-code');const obj=CODES_FULL.codes.find(x=>x.code===code);if(!obj) return; if(field==='active'){obj.active=e.target.checked;} else if(field==='note'){obj.note=e.target.value;} else if(field==='expires'){obj.expires = e.target.value? e.target.value : null;}}  
function filterCodes(){const q=document.getElementById('codesSearch').value.toLowerCase();if(!CODES_FULL){return;} CODES_VIEW=CODES_FULL.codes.filter(c=> (c.code||'').toLowerCase().includes(q) || (c.note||'').toLowerCase().includes(q)); renderCodes(CODES_VIEW);}  
function setCodesStatus(msg){document.getElementById('codes-status').textContent=msg;}  
async function saveCodesToGitHub(){   
 if(!CODES_FULL){alert('Nog geen codes geladen.');return;}   
 const t=sessionStorage.getItem('ghToken'); if(!t){alert('Voer eerst je GitHub token in bij Instellingen.'); return;}   
 try{   
 setCodesStatus('Opslaan bezig...');   
 const newObj={ price_eur_per_year: CODES_FULL.price_eur_per_year, version: CODES_FULL.version+1, codes: CODES_FULL.codes };   
 const jsonStr=JSON.stringify(newObj, null, 2)+'\n';   
 const b64 = btoa(unescape(encodeURIComponent(jsonStr)));   
 const url=`https://api.github.com/repos/${GH.owner}/${GH.repo}/contents/${GH.path}`;   
 const body={ message: 'FSID beheer: update codes.json (active/expires/note)', content: b64, sha: CODES_SHA, branch: GH.branch };   
 const res=await fetch(url,{method:'PUT', headers:{...ghHeaders(),'Content-Type':'application/json'}, body: JSON.stringify(body)});   
 if(!res.ok){const txt=await res.text(); throw new Error('GitHub PUT fout: '+res.status+' '+txt);}   
 const result=await res.json();   
 CODES_SHA=result.content.sha;   
 CODES_FULL.version=newObj.version;   
 document.getElementById('codes-meta').textContent=`version: ${CODES_FULL.version} • price_eur_per_year: €${CODES_FULL.price_eur_per_year}`;   
 setCodesStatus('Opgeslagen ✔');   
 }catch(e){console.error(e); setCodesStatus('Opslaan mislukt: '+e.message);}   
}
