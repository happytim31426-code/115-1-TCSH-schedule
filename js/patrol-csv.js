(() => {
  function parse(text){
    const rows=[];let row=[],value='',quoted=false;
    text=text.replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(value);value='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}else value+=c;}
    if(quoted)throw Error('CSV引號未閉合，請重新下載完整CSV。');
    if(row.length||value){row.push(value);rows.push(row);}return rows;
  }
  function extract(text,classes,issues){
    const rows=parse(text),headers=rows.shift()||[],entries=[],notes=[],warnings=[],seen=new Map();
    if(!['日期','巡堂人員','巡堂時段'].every(h=>headers.includes(h)))throw Error('找不到日期、巡堂人員、巡堂時段欄位，請使用原表單回覆CSV。');
    const column=h=>headers.indexOf(h);let duplicateCount=0;
    rows.forEach((r,index)=>{
      if(!r.some(v=>v.trim()))return;const sourceRow=index+2,dateText=r[column('日期')]||'',m=dateText.match(/^(\d{3,4})[\/-](\d{1,2})[\/-](\d{1,2})$/),pm=(r[column('巡堂時段')]||'').match(/第([一二三四五六七八1-8])節/),observer=(r[column('巡堂人員')]||'').trim();
      const year=m?Number(m[1])+(m[1].length===3?1911:0):0,date=m?`${year}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'',period=pm?('一二三四五六七八'.indexOf(pm[1])+1||Number(pm[1])):0;
      if(!m||!period||!observer||Number.isNaN(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date){warnings.push(`第${sourceRow}列：日期、節次或巡堂者無法辨識。`);return;}
      const byClass=new Map();
      for(let j=0;j<headers.length;j++){
        const value=(r[j]||'').trim();if(!value)continue;
        const match=headers[j].match(/班級記錄\s*\[([^\]]+)\]/);
        if(match){const c=classes.find(c=>c.name===match[1].trim());if(!c){warnings.push(`第${sourceRow}列：班級「${match[1]}」未對應。`);continue;}const found=issues.filter(s=>value.includes(s));if(!found.length){warnings.push(`第${sourceRow}列 ${c.name}：未辨識項目「${value}」。`);continue;}if(!byClass.has(c.id))byClass.set(c.id,{date,period,observer,classId:c.id,issues:[],sourceRow,duplicateRows:[]});const entry=byClass.get(c.id);entry.issues=[...new Set([...entry.issues,...found])].sort();}
        else if(headers[j].includes('其他問題'))notes.push({date,period,observer,grade:headers[j].slice(0,2),note:value,sourceRow});
      }
      for(const entry of byClass.values()){const key=[date,period,observer,entry.classId].join('|');if(seen.has(key)){const original=seen.get(key);original.issues=[...new Set([...original.issues,...entry.issues])].sort();original.duplicateRows.push(sourceRow);duplicateCount++;}else{seen.set(key,entry);entries.push(entry);}}
    });
    return {responseCount:rows.filter(r=>r.some(v=>v.trim())).length,entries,notes,warnings,duplicateCount};
  }
  window.PATROL_CSV={parse,extract};
})();
