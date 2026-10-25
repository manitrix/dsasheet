(function(root){
  'use strict';
  const dayKey=value=>{const d=new Date(value);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  function addDays(value,n){const d=new Date(value);d.setDate(d.getDate()+n);return d.toISOString()}
  function compare(reference,draft){let matched=0,first=-1;for(let i=0;i<draft.length;i++){if(draft[i]===reference[i])matched++;else if(first<0)first=i}return {accuracy:draft.length?Math.round(matched/draft.length*100):100,reproduced:reference.length?Math.round(matched/Math.max(reference.length,draft.length)*100):0,mistakes:draft.length-matched,first,complete:!!reference&&reference===draft}}
  function solve(record,now=new Date().toISOString()){return {...record,done:true,solvedAt:now,lastReviewed:null,reviewStep:0,dueAt:addDays(now,1)}}
  function review(record,now=new Date().toISOString()){const step=Math.min((record.reviewStep||0)+1,3);return {...record,lastReviewed:now,reviewStep:step,dueAt:step===3?null:addDays(now,step===1?7:30)}}
  function streak(activity,now=new Date()){const days=new Set(activity.map(e=>dayKey(e.at)));let d=new Date(now),count=0;if(!days.has(dayKey(d)))d.setDate(d.getDate()-1);while(days.has(dayKey(d))){count++;d.setDate(d.getDate()-1)}return count}
  const escapeICS=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');
  // Fold iCalendar content lines at 75 UTF-8 bytes, including continuation spaces.
  function foldICS(line){let parts=[],part='',size=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(size+n>75){parts.push(part);part=' ';size=1}part+=char;size+=n}parts.push(part);return parts.join('\r\n')}
  function calendar(problems,records,now=new Date().toISOString()){const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DSA Garden//Revision Planner//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH'];for(const p of problems){const r=records[p.id];if(!r?.done||!r.dueAt)continue;const due=new Date(r.dueAt);due.setHours(9,0,0,0);if(due<new Date(now)){due.setTime(new Date(now).getTime()+60*60*1000)}lines.push('BEGIN:VEVENT',`UID:dsa-${p.id}-review-${r.reviewStep||0}@garden.local`,`DTSTAMP:${stamp(now)}`,`DTSTART:${stamp(due)}`,`DTEND:${stamp(new Date(due.getTime()+25*60000))}`,`SUMMARY:${escapeICS('Revise: '+p.title)}`,`DESCRIPTION:${escapeICS('Review your saved code. Revision '+((r.reviewStep||0)+1)+' of 3. '+(p.url||''))}`,'BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY',`DESCRIPTION:${escapeICS('Time to revise '+p.title)}`,'END:VALARM','END:VEVENT')}lines.push('END:VCALENDAR');return lines.map(foldICS).join('\r\n')+'\r\n'}
  function safeURL(value){if(!value)return '';try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return ''}}
  function validate(data){
    if(!data||data.version!==2||!Array.isArray(data.topics)||!Array.isArray(data.problems)||!data.records||typeof data.records!=='object'||Array.isArray(data.records)||!Array.isArray(data.activity))throw Error('This is not a DSA Garden backup.');
    const topics=new Set(),ids=new Set();
    const validID=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
    for(const t of data.topics){if(!t||!validID(t.id)||topics.has(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>80)throw Error('Invalid or duplicate topic.');topics.add(t.id)}
    for(const p of data.problems){if(!p||!validID(p.id)||ids.has(p.id)||!topics.has(p.topic)||typeof p.title!=='string'||!p.title.trim()||p.title.length>160||!['Easy','Medium','Hard'].includes(p.difficulty)||(p.url&&!safeURL(p.url))||(p.lc!==null&&(!Number.isInteger(p.lc)||p.lc<1)))throw Error('Invalid or duplicate question.');ids.add(p.id)}
    for(const [id,r] of Object.entries(data.records)){if(!ids.has(id)||!r||typeof r!=='object'||Array.isArray(r))throw Error('Invalid problem record.');for(const k of ['done','saved'])if(r[k]!==undefined&&typeof r[k]!=='boolean')throw Error('Invalid mastery or favorite flag.');for(const k of ['code','reference','draft','tests','notes','testOutput'])if(r[k]!==undefined&&typeof r[k]!=='string')throw Error('Invalid saved code.');for(const k of ['solvedAt','lastReviewed','dueAt'])if(r[k]!=null&&!Number.isFinite(Date.parse(r[k])))throw Error('Invalid revision date.');if(r.reviewStep!==undefined&&(!Number.isInteger(r.reviewStep)||r.reviewStep<0||r.reviewStep>3))throw Error('Invalid revision stage.')}
    for(const a of data.activity){if(!a||!ids.has(a.problemId)||!['solve','revision'].includes(a.type)||!Number.isFinite(Date.parse(a.at)))throw Error('Invalid activity history.')}
    return data;
  }
  const api={dayKey,addDays,compare,solve,review,streak,calendar,safeURL,validate};
  if(typeof module!=='undefined')module.exports=api;else root.GardenCore=api;
})(typeof window==='undefined'?globalThis:window);
