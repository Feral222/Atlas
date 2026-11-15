const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('const atlasHybridCacheKey07610='),end=html.indexOf('// Unified organizer:',start);
assert(start>0&&end>start);
const source=html.slice(start,end);
function fixture(n){
 const storage=new Map();let uploads=0;
 const ctx={console,JSON,Set,Map,Promise,setTimeout,uid:()=>String(Math.random()),atlasBulkBusy07611:false,loadDocs:async()=>{},atlasSmartStamp0766:()=>"stamp",atlasSmartReadDocs0766:async()=>[],atlasVaultFolders:[{id:'f',name:'Inbox',parentId:''}],docs:Array.from({length:n},(_,i)=>({id:String(i),name:`document-${i}.pdf`,folderId:'f',size:100,type:'application/pdf'})),atlasVaultFolderPath:()=>'',atlasBulkScope07611:()=>new Set(['f']),atlasBulkText07611:async()=>'',atlasBulkChoose07611:()=>({category:null,confidence:'unclassified'}),atlasBulkHash07611:async()=>null,atlasExtractDocument:async()=>({kind:'pdf',base64:'AA=='}),brainPassword:()=>'',localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},fetch:async()=>{uploads++;return {ok:true,json:async()=>({ok:true,analysis:{category:'Housing',confidence:'high',summary:'housing'}})}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,uploads:()=>uploads,run:async(cloud)=>vm.runInContext(`atlasBulkPreview07611('all',{cloud:${cloud}})`,ctx)};
}
test('1500 documents classified in simulated library without changing source docs',async()=>{
 const f=fixture(1500),before=JSON.stringify(f.ctx.docs),plan=await f.run(true);
 assert.equal(plan.scanned,1500);assert.equal(plan.proposals.length,1500);assert.equal(f.uploads(),1500);assert.equal(JSON.stringify(f.ctx.docs),before);
 const repeat=await f.run(true);assert.equal(repeat.scanned,1500);assert.equal(f.uploads(),1500);
});
test('local-only preview never uploads',async()=>{const f=fixture(40);await f.run(false);assert.equal(f.uploads(),0)});
test('cloud analysis stops on service error and preserves existing files',async()=>{
 const f=fixture(3);f.ctx.fetch=async()=>({ok:false,json:async()=>({error:'API unavailable'})});
 await assert.rejects(f.run(true),/checkpointed; retry to resume/);assert.equal(f.ctx.docs.length,3);
});

test('unsupported AI category fails closed and leaves documents untouched',async()=>{
 const f=fixture(2),before=JSON.stringify(f.ctx.docs);
 f.ctx.fetch=async()=>({ok:true,json:async()=>({ok:true,analysis:{category:'Untrusted New Root',confidence:'high'}})});
 await assert.rejects(f.run(true),/unsupported or incomplete classification/);
 assert.equal(JSON.stringify(f.ctx.docs),before);
});
test('cancelled bulk analysis leaves all documents unchanged',async()=>{
 const f=fixture(12),before=JSON.stringify(f.ctx.docs);
 await assert.rejects(vm.runInContext(`atlasBulkPreview07611('all',{cloud:true,signal:{aborted:true}})`,f.ctx),/cancelled/);
 assert.equal(JSON.stringify(f.ctx.docs),before);
});
