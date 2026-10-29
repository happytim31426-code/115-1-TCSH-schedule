// No production services: coefficient arithmetic and carry-forward tests in a VM.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const roster=[{id:'101',name:'測試教師'},{id:'617',name:'零課務教師'}];
const actual={first:{minutes:{101:80,617:0},days:[true,false,false],complete:false},second:{minutes:{101:10,617:0},days:[true,false,false],complete:false}};
const window={WEEKLY:{esc:String},INVIGILATION_MODEL:{roster},EXAM_CONTEXT:{get:()=>({category:'first'}),saved:()=>({revision:1,dates:['2026-10-13','2026-10-14','2026-10-15']})},EXAM_CALCULATOR:{totals:()=>[{id:'101',minutes:100},{id:'617',minutes:0}]},INVIGILATION_STATE:{actual:cat=>actual[cat]||actual.first}};
const ctx=vm.createContext({window,document:{getElementById:()=>({})},Intl,console});
vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/coefficient.js'),'utf8').split('  function render(){')[0]+'})();',ctx);
const m=window.EXAM_COEFFICIENT;
function draft(){return {pool:{totalInvig:'500',totalPaper:'100',dutyWork:'50',teaching:'400',count:'5'},rows:{101:{share:'',carry:'',paper:'20'},617:{share:'',carry:'',paper:'0'}},final:null};}
const a=draft(),b=draft(),backup={format:'tcsh-coefficient-v1',categories:{first:a,second:b}};
m.restore(backup);let r=m.results('first');assert.equal(r.pool.value,50);assert.equal(r.rows[0].base,100);assert.equal(r.rows[0].due,130);assert.equal(r.rows[0].actual,80);assert.equal(r.rows[0].balance,50);assert.equal(r.rows[1].base,0);assert.equal(r.canFinalize,false);
assert.equal(m.poolResult({...a.pool,count:'0'}).value,null);assert.equal(m.poolResult({...a.pool,count:'1.5'}).value,null);assert.equal(m.poolResult({...a.pool,totalPaper:'hello'}).value,null);assert.equal(m.poolResult({...a.pool,totalPaper:'1+2'}).value,null);
assert.equal(m.poolResult({totalInvig:'0',totalPaper:'0',dutyWork:'0',teaching:'100',count:'2'}).value,-50);
assert.equal(m.results('second').rows[0].carry,null,'unconfirmed previous balance must not be called zero');
a.final={signature:r.signature,balances:Object.fromEntries(r.rows.map(t=>[t.id,t.balance])),at:'2026-10-29'};m.restore(backup);assert.equal(m.results('second').rows[0].carry,null,'partial results cannot become confirmed carry');actual.first.days=[true,true,true];actual.first.complete=true;r=m.results('first');a.final={signature:r.signature,balances:Object.fromEntries(r.rows.map(t=>[t.id,t.balance])),at:'2026-10-29'};m.restore(backup);assert.equal(m.results('second').rows[0].carry,50);assert.equal(m.results('second').rows[0].due,180);
a.pool.totalInvig='600';m.restore(backup);assert.equal(m.results('second').rows[0].carry,null,'changed previous sources invalidate carry-forward');
b.rows['101'].carry='-10';b.rows['101'].share='0';m.restore(backup);assert.equal(m.results('second').rows[0].due,70);assert.equal(m.results('second').rows[0].balance,60);
b.rows['101'].paper='-1';m.restore(backup);assert.equal(m.results('second').rows[0].due,null);
assert.equal(m.number('Infinity'),null);assert.equal(m.number('NaN'),null);assert.equal(m.number('2.5'),2.5);
const bad=JSON.parse(JSON.stringify(backup));bad.categories.first.rows['101'].share=10;assert.throws(()=>m.validateBackup(bad));
actual.first.days=[true,true,true];actual.first.complete=true;m.restore({format:'tcsh-coefficient-v1',categories:{first:draft()}});assert.equal(m.results('first').canFinalize,true,'finalize requires all three days and complete schedule');
console.log('PASS pool formula, zero/invalid denominator, negative sharing, zero teaching base, seven columns, signed overrides, missing/confirmed/stale previous balances, partial-day finalize guard and backup types.');
