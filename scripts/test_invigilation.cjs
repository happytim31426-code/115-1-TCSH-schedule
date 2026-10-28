// Pure model regression tests: no browser, Firebase connection or production writes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),window={WEEKLY:{esc:String}},document={getElementById:()=>({})};
const context=vm.createContext({window,document,console});
vm.runInContext(fs.readFileSync(path.join(root,'data/schedules.js'),'utf8'),context);
const program=fs.readFileSync(path.join(root,'js/exam-program.js'),'utf8').split("  $('exam-program-subject-options')")[0]+'})();';
vm.runInContext(program,context);window.EXAM_CONTEXT={get:()=>({category:'first'})};
const invig=fs.readFileSync(path.join(root,'js/invigilation.js'),'utf8').split('  function headerHtml(s)')[0]+'})();';vm.runInContext(invig,context);
const m=window.INVIGILATION_MODEL;
assert.equal(m.roster.length,97);assert.equal(m.rooms.length,41);assert.equal(m.roster[0].id,'101');assert.equal(m.roster.at(-1).id,'649');
assert(!m.rooms.some(c=>['119','129','128'].includes(c.code)));
const junior=window.EXAM_PROGRAM_MODEL.blank('first','junior',1),senior=window.EXAM_PROGRAM_MODEL.blank('first','senior',1);
for(const p of [junior,senior])for(const c of p.cells){c.subject=c.period===1?(p.division==='junior'?'英文':'國文'):'自習';c.minutes=20;}
const source={ready:true,signature:'saved-first-v1',junior,senior},d=m.blank(source);d.reviewed=true;
assert.equal(m.reasons(d,source,'101',0,'111').length,0);
d.assignments['101'][0]='111';assert.match(m.reasons(d,source,'102',0,'111').join(),/已安排其他教師/);
d.assignments['101'][2]='112';assert.equal(m.minutes(d,'101'),140);
assert.match(m.reasons(d,source,'101',0,'213').join(),/導師班/);
assert.match(m.reasons(d,source,'101',0,'216').join(),/該科任課/);
assert.equal(m.reasons(d,source,'101',1,'213').length,0,'self-study may use homeroom teacher');
assert.match(m.reasons(d,source,'214',0,'112').join(),/試務/);
d.constraints['101'].children=['113'];assert.match(m.reasons(d,source,'101',1,'113').join(),/子女/);
d.constraints['101'].blocked[4]=true;assert.match(m.reasons(d,source,'101',4,'114').join(),/不得監考/);
assert.equal(m.report(d,source).complete,false);
const full=m.blank(source);full.reviewed=true;
for(let p=0;p<5;p++){
  const match=new Map();
  function augment(room,seen){for(const t of m.roster){if(seen.has(t.id)||m.reasons(full,source,t.id,p,room.code,{duplicate:false}).length)continue;seen.add(t.id);if(!match.has(t.id)||augment(match.get(t.id),seen)){match.set(t.id,room);return true;}}return false;}
  for(const room of m.rooms)assert(augment(room,new Set()),'Each room must have an eligible teacher');
  for(const [id,room] of match)full.assignments[id][p]=room.code;
}
assert.equal(m.report(full,source).complete,true);
assert.equal(m.report(full,{...source,signature:'changed'}).complete,false);
full.reviewed=false;assert.equal(m.report(full,source).complete,false);full.reviewed=true;
const backup={format:'tcsh-invigilation-day1-v1',category:'first',source:full.source,assignments:full.assignments,constraints:full.constraints};
assert.equal(m.validateBackup(backup).reviewed,false);
for(const mutate of [b=>b.category='second',b=>b.assignments['101'][0]='999',b=>b.constraints['101'].duty='false',b=>b.constraints['101'].blocked=[true],b=>b.constraints['101'].children=['128'],b=>{b.assignments['101'][0]='111';b.assignments['102'][0]='111';},b=>b.assignments['000']=Array(5).fill('')]){
 const bad=JSON.parse(JSON.stringify(backup));mutate(bad);assert.throws(()=>m.validateBackup(bad));
}
console.log('PASS day1: 97-teacher PDF roster, 41 room codes, full-slot minutes, duplicate/complete coverage, policy restrictions and self-study, changed-source guard, backup validation. No production writes.');
