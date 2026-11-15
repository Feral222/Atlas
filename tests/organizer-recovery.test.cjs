const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const begin=html.indexOf('async function atlasBulkUndo07611(){'),end=html.indexOf('async function atlasBulkOpen07611(){',begin);
assert(begin>0&&end>begin);
const code=html.slice(begin,end);
function make({changed=false,interrupted=false}={}){
 const initial=[{id:'in',name:'Inbox',parentId:''}],after=[...initial,{id:'out',name:'Housing',parentId:''}];
 let folders=changed?[...after,{id:'later',name:'Later',parentId:''}]:interrupted?initial:after;
 let files=[{id:'doc',folderId:interrupted?'in':'out'}];
 const record={status:interrupted?'pending':'complete',foldersBefore:initial,foldersAfter:after,moves:[{id:'doc',from:'in',to:'out'}]};
 const storage=new Map([['atlasBulkOrganizer07611',JSON.stringify(record)]]);
 const ctx={console,JSON,Map,structuredClone,atlasBulkBusy07611:false,atlasBulkKey07611:'atlasBulkOrganizer07611',atlasVaultFolders:folders,
 localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
 atlasSmartReadDocs0766:async()=>structuredClone(files),
 atlasSmartWriteMoves0766:async moves=>{for(const m of moves){const f=files.find(f=>f.id===m.id);if(f.folderId!==m.from)throw Error('stale');f.folderId=m.to}},
 atlasSaveVaultFolders(){folders=structuredClone(ctx.atlasVaultFolders)},loadDocs:async()=>{},render:()=>{}};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 return {ctx,storage,files,run:()=>vm.runInContext('atlasBulkUndo07611()',ctx)};
}
test('undo restores moved files and folder metadata',async()=>{
 const f=make(),r=await f.run();assert.equal(r.ok,true);assert.equal(f.files[0].folderId,'in');assert.equal(f.ctx.atlasVaultFolders.length,1);assert.equal(JSON.parse(f.storage.get('atlasBulkOrganizer07611')).status,'undone');
});
test('pending interrupted operation is recoverable without losing files',async()=>{
 const f=make({interrupted:true}),r=await f.run();assert.equal(r.ok,true);assert.equal(f.files[0].folderId,'in');
});
test('undo refuses to overwrite later manual folder changes',async()=>{
 const f=make({changed:true}),r=await f.run();assert.equal(r.ok,false);assert.match(r.error,/Folder structure changed/);assert.equal(f.files[0].folderId,'out');assert.equal(f.ctx.atlasVaultFolders.length,3);
});
