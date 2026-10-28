// Run only against a local Firestore emulator loaded with firestore.rules.
// Example: FIRESTORE_EMULATOR_HOST=127.0.0.1:18086 node scripts/test_exam_program_rules.cjs
const assert=require('node:assert/strict');
const endpoint=process.env.FIRESTORE_EMULATOR_HOST||'127.0.0.1:18086';
assert.match(endpoint,/^127\.0\.0\.1:\d+$/,'Local emulator only');
const host='http://'+endpoint,project='demo-exam-rules';
const root=`projects/${project}/databases/(default)/documents`;
const encode=v=> v===null?{nullValue:null}:v?.__timestamp?{timestampValue:v.__timestamp}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?(Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v}):Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}};
const jwt=role=>[Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({iss:`https://securetoken.google.com/${project}`,aud:project,sub:role,user_id:role,email:`${role}@example.test`,email_verified:true,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,firebase:{sign_in_provider:'google.com'}})).toString('base64url'),''].join('.');
async function commit(id,data,role='admin',stamps=[],mode='normal'){
const writes=[{update:{name:root+'/'+id,fields:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]))},...(stamps.length?{updateTransforms:stamps.map(fieldPath=>({fieldPath,setToServerValue:'REQUEST_TIME'}))}:{})}];
if(id.startsWith('examPrograms/')&&mode!=='parent-only'){
const n=data.day===3?3:5;
for(let i=0;i<data.cells.length;i+=n)writes.push({update:{name:root+'/'+id+'/rows/'+i/n,fields:{cells:encode(data.cells.slice(i,i+n))}},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]});
}
if(mode==='row-only')writes.shift();
if(mode==='mismatch')writes[1].update.fields.cells.arrayValue.values[0].mapValue.fields.subject={stringValue:'不一致'};
let r=await fetch(`${host}/v1/projects/${project}/databases/(default)/documents:commit`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(role==='owner'?'owner':jwt(role))},body:JSON.stringify({writes})});const result={status:r.status,body:await r.json()};if(role==='owner'&&r.status!==200)console.log(result);return result;}
(async()=>{
for(const role of ['admin','exam','teacher','patrol']){assert.equal((await commit('members/'+role+'@example.test',{name:'測試人員',role,active:true},'owner')).status,200);}
const results=[];
for(const division of ['junior','senior'])for(const day of [1,2,3])for(const role of ['admin','exam']){
const periods=day===3?3:5,n=(division==='junior'?3:6)*periods;
const data={category:'first',division,day,cells:Array.from({length:n},(_,i)=>({subject:'國文',minutes:[60,60,80,70,80][i%periods]})),revision:1,createdBy:role,createdName:'測試人員',updatedBy:role,updatedName:'測試人員'};
const id=`examPrograms/first_${division}_${day}`;
await fetch(`${host}/v1/${root}/${id}`,{method:'DELETE',headers:{Authorization:'Bearer owner'}});
const result=await commit(id,data,role,['createdAt','updatedAt']);results.push({division,day,role,...result});
if(result.status===200){
const existing=await(await fetch(`${host}/v1/${root}/${id}`,{headers:{Authorization:'Bearer owner'}})).json();
const updated={...data,revision:2,createdAt:existing.fields.createdAt};
updated.createdAt={__timestamp:existing.fields.createdAt.timestampValue};
const second=await commit(id,updated,role,['updatedAt']);assert.equal(second.status,200,JSON.stringify(second));
const next={...updated,revision:3};
for(const badRole of ['teacher','patrol','stranger'])assert.equal((await commit(id,{...next,updatedBy:badRole},badRole,['updatedAt'])).status,403);
assert.equal((await commit(id,next,role,['updatedAt'],'mismatch')).status,403);
assert.equal((await commit(id,next,role,['updatedAt'],'row-only')).status,403);
for(let i=0;i<n;i++){
const bad=structuredClone(next);bad.cells[i].minutes=[60,60,80,70,80][i%periods]+1;
assert.equal((await commit(id,bad,role,['updatedAt'])).status,403,`overlong cell ${division}/${day}/${i}`);
}
for(const change of [c=>{c.minutes=-1},c=>{c.minutes=1.5},c=>{c.subject='';c.minutes=1},c=>{c.subject='x'.repeat(81)},c=>{c.extra=true},c=>{delete c.subject},c=>{c.minutes='50'}]){
const bad=structuredClone(next);change(bad.cells[n-1]);assert.equal((await commit(id,bad,role,['updatedAt'])).status,403);
}
const blank=structuredClone(next);blank.cells=blank.cells.map(()=>({subject:'',minutes:0}));assert.equal((await commit(id,blank,role,['updatedAt'])).status,200);
assert.equal((await commit(id,blank,role,['updatedAt'])).status,403,'stale revision');
}
}

if(results.some(r=>r.status!==200))process.exitCode=1;
console.log('PASS valid create/update/blank cells, all cell duration bounds, malformed data, role denial, row-only/mismatch denial and stale revision across six tables and two roles. Demo emulator only.');
})().catch(e=>{console.error(e);process.exitCode=1;});
