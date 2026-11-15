const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {IDBFactory}=require('fake-indexeddb');
const html=fs.readFileSync(new URL('../index.html','file://'+__filename),'utf8');
const source=html.slice(html.indexOf('const atlasSmartHistoryKey0766='),html.indexOf('async function executeAtlasToolImpl'));
async function fixture(folders,files=[]){
 const ctx=vm.createContext({structuredClone,console,indexedDB:new IDBFactory(),initialFolders:folders,initialFiles:files});
 vm.runInContext(`let atlasVaultFolders=structuredClone(initialFolders),docs=[],seq=0;const atlasVaultFoldersKey='folders';const kv=new Map();const localStorage={getItem:k=>kv.get(k)||null,setItem:(k,v)=>kv.set(k,v)};
 const uid=()=>String(++seq),confirm=()=>true,render=()=>{};
 async function openDB(){return await new Promise((resolve,reject)=>{const r=indexedDB.open('test',1);r.onupgradeneeded=()=>r.result.createObjectStore('documents',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 async function loadDocs(){docs=(await atlasSmartReadDocs0766()).filter(d=>!d.atlasTrashed)}
 function atlasVaultFolderDescendants(id){const ids=new Set([id]);let size=-1;while(size!==ids.size){size=ids.size;for(const f of atlasVaultFolders)if(ids.has(f.parentId))ids.add(f.id)}return ids}
 function atlasVaultFolderPath(id){return atlasVaultFolders.find(f=>f.id===id)?.name||''}
 `+source,ctx);
 await vm.runInContext(`(async()=>{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('documents','readwrite');for(const f of initialFiles)tx.objectStore('documents').put(f);tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});db.close()})()`,ctx);
 return async code=>JSON.parse(JSON.stringify(await vm.runInContext(code,ctx))??'null');
}
const folder=(id,name,parentId='')=>({id,name,parentId});
const file=(id,folderId,extra={})=>({id,folderId,name:id+'.txt',bytes:'unchanged-'+id,...extra});
test('nested aliases merge, archive and non-Latin distinctions remain, bytes survive Undo',async()=>{
 const run=await fixture([folder('a','Vet Records'),folder('b','Veterinary Records'),folder('c','Bills','a'),folder('d','Bills','b'),folder('archive','Vet Records Archive'),folder('cn','病历'),folder('jp','診療'),folder('empty','Empty')],[file('1','c'),file('2','d'),file('3','archive'),file('4','cn'),file('5','jp')]);
 const result=await run(`(async()=>{const plan=await atlasSmartPlan0766('all');const result=await atlasSmartApply0766(plan);return {result,plan,files:await atlasSmartReadDocs0766()}})()`);
 assert.equal(result.result.merged,2);assert.equal(result.result.emptyFolders,1);assert.equal(result.result.renamed,2);
 assert.equal(result.files.find(f=>f.id==='3').folderId,'archive');assert.equal(result.files.find(f=>f.id==='2').bytes,'unchanged-2');
 assert.equal((await run(`atlasSmartUndo0766({skipConfirmation:true})`)).ok,true);
 assert.equal((await run(`atlasSmartReadDocs0766()`)).find(f=>f.id==='2').folderId,'d');
});
test('Undo preserves later folders, imports, renames and file moves',async()=>{
 const run=await fixture([folder('a','Vet Records'),folder('b','Veterinary Records')],[file('1','a'),file('2','b')]);
 await run(`(async()=>{await atlasSmartApply0766(await atlasSmartPlan0766('all'));atlasVaultFolders.push({id:'new',name:'Later',parentId:''});atlasVaultFolders.find(f=>f.id==='a').name='My chosen name';const db=await openDB();await new Promise(resolve=>{const tx=db.transaction('documents','readwrite'),s=tx.objectStore('documents');s.put({id:'3',folderId:'new',bytes:'new file'});s.put({id:'2',folderId:'new',bytes:'edited file'});tx.oncomplete=resolve});db.close();return true})()`);
 assert.equal((await run(`atlasSmartUndo0766({skipConfirmation:true})`)).ok,true);
 const folders=await run('atlasVaultFolders');assert(folders.some(f=>f.id==='new'));assert.equal(folders.find(f=>f.id==='a').name,'My chosen name');
 const files=await run('atlasSmartReadDocs0766()');assert(files.every(d=>folders.some(f=>f.id===d.folderId)));assert.equal(files.find(f=>f.id==='2').bytes,'edited file');assert.equal(files.find(f=>f.id==='2').folderId,'new');
});
test('scopes, backups and trashed content are protected; invalid scope cannot clean entire library',async()=>{
 const run=await fixture([folder('root','Root'),folder('in','Empty','root'),folder('out','Empty'),folder('backup','Backups'),folder('series','Series','backup'),folder('trash','Recoverable')],[file('trashed','trash',{atlasTrashed:true})]);
 const plan=await run(`atlasSmartPlan0766('root')`);assert.deepEqual(plan.empty.map(f=>f.id),['in']);
 const all=await run(`atlasSmartPlan0766('all')`);assert(!all.empty.some(f=>['backup','series','trash'].includes(f.id)));
 await assert.rejects(()=>run(`atlasSmartPlan0766('unfiled')`));
});
test('stale preview, concurrent run and storage failure are rejected without changes',async()=>{
 const run=await fixture([folder('a','Vet Records'),folder('b','Veterinary Records')],[file('1','b')]);
 const stale=await run(`(async()=>{const p=await atlasSmartPlan0766('all');atlasVaultFolders.push({id:'new',name:'Later'});return atlasSmartApply0766(p)})()`);assert.equal(stale.ok,false);assert.match(stale.error,/changed/);
 const concurrent=await run(`(async()=>{const p=await atlasSmartPlan0766('all');atlasSmartBusy0766=true;const r=await atlasSmartApply0766(p);atlasSmartBusy0766=false;return r})()`);assert.equal(concurrent.ok,false);
 const failure=await run(`(async()=>{const p=await atlasSmartPlan0766('all');localStorage.setItem=()=>{throw new Error('Quota exceeded')};return atlasSmartApply0766(p)})()`);assert.equal(failure.ok,false);assert.equal((await run('atlasSmartReadDocs0766()'))[0].folderId,'b');
});
test('interrupted folder save recovers after a simulated reload; later cleanup cannot overwrite recovery',async()=>{
 const run=await fixture([folder('a','Vet Records'),folder('b','Veterinary Records')],[file('1','b')]);
 const failure=await run(`(async()=>{const p=await atlasSmartPlan0766('all');const save=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k===atlasVaultFoldersKey)throw new Error('disk full');save(k,v)};const r=await atlasSmartApply0766(p);localStorage.setItem=save;atlasSmartPending0766=null;return r})()`);assert.equal(failure.ok,false);
 assert.equal((await run('atlasSmartReadDocs0766()'))[0].folderId,'a');
 const retry=await run(`(async()=>atlasSmartApply0766(await atlasSmartPlan0766('all')))()`);assert.equal(retry.ok,false);assert.match(retry.error,/recover/);
 assert.equal((await run('atlasSmartUndo0766({skipConfirmation:true})')).ok,true);assert.equal((await run('atlasSmartReadDocs0766()'))[0].folderId,'b');
});
test('atomic IndexedDB abort does not leave a partial file move',async()=>{
 const run=await fixture([folder('a','A'),folder('b','B')],[file('1','a'),file('2','a')]);
 await assert.rejects(()=>run(`atlasSmartWriteMoves0766([{id:'1',from:'a',to:'b'},{id:'2',from:'wrong',to:'b'}])`));
 assert((await run('atlasSmartReadDocs0766()')).every(f=>f.folderId==='a'));
});
test('no-op does not overwrite Undo; legacy recovery preserves later folders',async()=>{
 const run=await fixture([folder('a','Medical'),folder('new','Later')],[file('1','a'),file('2','new')]);
 await run(`localStorage.setItem(atlasSmartHistoryKey0766,JSON.stringify({folders:[{id:'a',name:'Medical'},{id:'old',name:'Old'}],moves:[{id:'1',from:'old',to:'a'}],status:'complete'}))`);
 await run(`(async()=>atlasSmartApply0766(await atlasSmartPlan0766('all')))()`);
 assert.equal((await run('atlasSmartUndo0766({skipConfirmation:true})')).ok,true);assert((await run('atlasVaultFolders')).some(f=>f.id==='new'));assert.equal((await run('atlasSmartReadDocs0766()')).find(f=>f.id==='1').folderId,'old');
});
test('both AI endpoints expose identical cleanup tools and frontend handlers',()=>{
 for(const path of ['api/chat.js','api/realtime.js']){const source=fs.readFileSync(new URL('../'+path,'file://'+__filename),'utf8');for(const name of ['preview_vault_folder_consolidation','apply_vault_folder_consolidation','undo_vault_folder_consolidation']){assert(source.includes('"name": "'+name+'"'));assert(html.includes('name==="'+name+'"'))}}
});
