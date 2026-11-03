export const grades=['國一','國二','國三','高一','高二','高三'];
export const plus=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const weekDate=(week,day=0)=>plus('2026-08-31',(week-1)*7+day);
export const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
export function missed(lesson,date,ranges){return ranges.some(r=>date>=r.start&&date<=r.end&&(r.grade==='all'||r.grade===lesson.grade));}
export function deductionColumns(week,ranges,grouping='day'){
  const days=Array.from({length:6},(_,day)=>weekDate(week,day)).filter(d=>d<='2027-01-20');
  const label=r=>`${r.reason||'停課'}（${r.grade==='all'?'全年段':r.grade}）`;
  if(grouping==='event')return ranges.map((r,i)=>({key:`event-${i}`,indices:[i],dates:days.filter(d=>d>=r.start&&d<=r.end),reason:label(r)})).filter(c=>c.dates.length).sort((a,b)=>a.dates[0].localeCompare(b.dates[0]));
  return days.map(date=>{const indices=ranges.flatMap((r,i)=>date>=r.start&&date<=r.end?[i]:[]);return {key:date,indices,dates:[date],reason:[...new Set(indices.map(i=>label(ranges[i])))].join('、')};}).filter(c=>c.indices.length);
}
export function calculate(rows,week,ranges,partTime,special,foreign,grouping='day'){
  const columns=deductionColumns(week,ranges,grouping);
  const groups=['一般教師','特聘教師','外籍教師'],totals=groups.flatMap(group=>['國中部','高中部'].map(division=>({group,division,eighth:0,saturday:0,eighthMissed:0,saturdayMissed:0})));const unresolved=[];
  const teachers=rows.map(t=>{
    const result={id:t.id,name:t.name,eighth:0,partTime:0,details:[],cuts:Object.fromEntries(columns.map(c=>[c.key,{eighth:0,partTime:0}]))};
    for(const l of t.lessons||[]){const date=weekDate(week,l.day);if(date>'2027-01-20')continue;
      const paid8=l.day<5&&l.period===8&&!l.marks.includes('基'),sat=l.day===5;
      if(!l.grade){if(paid8||sat||partTime.includes(t.name))unresolved.push({...l,teacher:t.name,date});}
      const cut=missed(l,date,ranges);
      // Assign overlapping events to the first matching column, never twice.
      const column=cut?columns.find(c=>c.dates.includes(date)&&c.indices.some(i=>ranges[i].grade==='all'||ranges[i].grade===l.grade)):null;
      if(cut&&paid8){result.eighth++;if(column)result.cuts[column.key].eighth++;result.details.push(`${date} 第8節 ${l.grade||'年段待核對'}`);}
      if(cut&&l.day<5&&l.period<=7&&partTime.includes(t.name)){result.partTime++;if(column)result.cuts[column.key].partTime++;result.details.push(`${date} 第${l.period}節 ${l.grade||'年段待核對'}`);}
      const division=l.grade?.startsWith('國')?'國中部':l.grade?.startsWith('高')?'高中部':null;
      const group=special.includes(t.name)?'特聘教師':foreign.includes(t.name)?'外籍教師':'一般教師';const total=totals.find(x=>x.group===group&&x.division===division);
      if(total&&paid8){if(cut)total.eighthMissed++;else total.eighth++;}
      if(total&&sat){if(cut)total.saturdayMissed++;else total.saturday++;}
    }return result;
  });return {teachers,totals,columns,unresolved,unsupported:rows.filter(r=>r.unsupported).length};
}
export function payrollReport(rows,result,partTime){
  const short=d=>`${Number(d.slice(5,7))}/${Number(d.slice(8))}`;
  const heading=c=>`${short(c.dates[0])}${c.dates.length>1?'～'+short(c.dates.at(-1)):''} ${c.reason}`;
  const negative=n=>n?-n:'';
  const headers=['教師編號','姓名','基本節數','週一～五超鐘點',...result.columns.map(c=>heading(c)+' 兼課1～7節扣除'),'兼課扣除合計','實上實銷','週三第六節實','週一～五第八節',...result.columns.map(c=>heading(c)+' 第八節扣除'),'第八節扣除合計','週六授課','週六用餐午休'];
  const values=rows.map((r,i)=>{const t=result.teachers[i],part=partTime.includes(r.name);return [r.id,r.name,r.basic??null,r.over??null,...result.columns.map(c=>part?negative(t.cuts[c.key].partTime):''),part?negative(t.partTime):'',r.actual??null,r.wednesdayActual??null,r.eighth??null,...result.columns.map(c=>negative(t.cuts[c.key].eighth)),negative(t.eighth),r.saturday??null,r.lunch??null];});
  const totals=headers.map((_,i)=>i<2?(i===0?'合計':''):values.some(r=>r[i]===null)?'待核對':values.reduce((n,r)=>n+(typeof r[i]==='number'?r[i]:0),0));
  return {headers,values,totals};
}
