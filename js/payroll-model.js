export const grades=['國一','國二','國三','高一','高二','高三'];
export const plus=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
export const weekDate=(week,day=0)=>plus('2026-08-31',(week-1)*7+day);
export const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
export function missed(lesson,date,ranges){return ranges.some(r=>date>=r.start&&date<=r.end&&(r.grade==='all'||r.grade===lesson.grade));}
export function calculate(rows,week,ranges,partTime,special,foreign){
  const groups=['一般教師','特聘教師','外籍教師'],totals=groups.flatMap(group=>['國中部','高中部'].map(division=>({group,division,eighth:0,saturday:0,eighthMissed:0,saturdayMissed:0})));const unresolved=[];
  const teachers=rows.map(t=>{
    const result={id:t.id,name:t.name,eighth:0,partTime:0,details:[]};
    for(const l of t.lessons||[]){const date=weekDate(week,l.day);if(date>'2027-01-20')continue;
      const paid8=l.day<5&&l.period===8&&!l.marks.includes('基'),sat=l.day===5;
      if(!l.grade){if(paid8||sat||partTime.includes(t.name))unresolved.push({...l,teacher:t.name,date});}
      const cut=missed(l,date,ranges);
      if(cut&&paid8){result.eighth++;result.details.push(`${date} 第8節 ${l.grade||'年段待核對'}`);}
      if(cut&&l.day<5&&l.period<=7&&partTime.includes(t.name)){result.partTime++;result.details.push(`${date} 第${l.period}節 ${l.grade||'年段待核對'}`);}
      const division=l.grade?.startsWith('國')?'國中部':l.grade?.startsWith('高')?'高中部':null;
      const group=special.includes(t.name)?'特聘教師':foreign.includes(t.name)?'外籍教師':'一般教師';const total=totals.find(x=>x.group===group&&x.division===division);
      if(total&&paid8){if(cut)total.eighthMissed++;else total.eighth++;}
      if(total&&sat){if(cut)total.saturdayMissed++;else total.saturday++;}
    }return result;
  });return {teachers,totals,unresolved,unsupported:rows.filter(r=>r.unsupported).length};
}
