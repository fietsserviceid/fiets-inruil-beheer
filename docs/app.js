
async function sha256(str){const buf=new TextEncoder().encode(str);const hash=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');}

function base32ToBytes(base32){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';base32.split('').forEach(c=>bits+=alphabet.indexOf(c).toString(2).padStart(5,'0'));let out=[];for(let i=0;i+8<=bits.length;i+=8) out.push(parseInt(bits.substring(i,i+8),2));return new Uint8Array(out);} 

async function generateTOTP(secret){const key=await crypto.subtle.importKey('raw',base32ToBytes(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);const counter=Math.floor(Date.now()/30000);let buf=new ArrayBuffer(8);new DataView(buf).setUint32(4,counter);const hmac=await crypto.subtle.sign('HMAC',key,buf);const bytes=new Uint8Array(hmac);const offset=bytes[19]&0xf;const binary=((bytes[offset]&0x7f)<<24)|((bytes[offset+1]&0xff)<<16)|((bytes[offset+2]&0xff)<<8)|(bytes[offset+3]&0xff);return (binary%1000000).toString().padStart(6,'0');}

let ADMINS=[];let DEALERS=[];let editingDealer=null;
fetch('./admins.json').then(r=>r.json()).then(j=>ADMINS=j.admins);

async function startLogin(){const u=document.getElementById('username').value;const p=document.getElementById('password').value;const hash=await sha256(p);const admin=ADMINS.find(a=>a.username===u && a.passwordHash===hash);if(!admin){document.getElementById('login-msg').textContent='Onjuiste gegevens';return;}sessionStorage.setItem('fsid_admin',JSON.stringify(admin));document.getElementById('login-screen').style.display='none';document.getElementById('totp-screen').style.display='block';}

async function verifyTOTP(){const admin=JSON.parse(sessionStorage.getItem('fsid_admin'));const code=document.getElementById('totp').value;const valid=await generateTOTP(admin.totpSecret);if(code===valid){document.getElementById('totp-screen').style.display='none';document.getElementById('app').style.display='block';}else document.getElementById('totp-msg').textContent='Ongeldige code';}

function logout(){sessionStorage.clear();location.reload();}

async function loadDealers(){const r=await fetch('./dealers.json');DEALERS=await r.json();renderDealers(DEALERS);} 
function showDealers(){document.getElementById('dealers-screen').style.display='block';loadDealers();}

function renderDealers(list){const tbody=document.querySelector('#dealersTable tbody');tbody.innerHTML='';list.forEach(d=>{const row=document.createElement('tr');row.innerHTML=`<td>${d.name}</td><td>${d.city}</td><td>${d.code}</td><td>${d.active?'✓':'✗'}</td><td><button onclick="editDealer('${d.id}')">✏️</button><button onclick="deleteDealer('${d.id}')">🗑️</button></td>`;tbody.appendChild(row);});}

function filterDealers(){const q=document.getElementById('dealerSearch').value.toLowerCase();renderDealers(DEALERS.filter(d=>d.name.toLowerCase().includes(q)||d.city.toLowerCase().includes(q)||d.code.toLowerCase().includes(q)));}

function newDealer(){editingDealer=null;document.getElementById('dealer-form-title').textContent='Nieuwe dealer';document.getElementById('form-name').value='';document.getElementById('form-city').value='';document.getElementById('form-code').value='';document.getElementById('form-active').checked=true;document.getElementById('dealer-form').style.display='block';}

function editDealer(id){const d=DEALERS.find(x=>x.id===id);if(!d)return;editingDealer=d;document.getElementById('dealer-form-title').textContent='Dealer bewerken';document.getElementById('form-name').value=d.name;document.getElementById('form-city').value=d.city;document.getElementById('form-code').value=d.code;document.getElementById('form-active').checked=d.active;document.getElementById('dealer-form').style.display='block';}

function deleteDealer(id){if(!confirm('Weet je zeker dat je deze dealer wilt verwijderen?'))return;DEALERS=DEALERS.filter(d=>d.id!==id);renderDealers(DEALERS);} 

function saveDealer(){const name=document.getElementById('form-name').value;const city=document.getElementById('form-city').value;const code=document.getElementById('form-code').value;const active=document.getElementById('form-active').checked;if(!name||!city||!code){alert('Naam, stad en code zijn verplicht.');return;}if(editingDealer){editingDealer.name=name;editingDealer.city=city;editingDealer.code=code;editingDealer.active=active;}else{const id='d'+Math.floor(Math.random()*1000000);DEALERS.push({id,name,city,code,active});}document.getElementById('dealer-form').style.display='none';renderDealers(DEALERS);} 

function cancelDealerForm(){document.getElementById('dealer-form').style.display='none';}
