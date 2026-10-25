const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../core.js');
test('typing comparison rejects incomplete code and reports mismatches',()=>{
  assert.deepEqual(C.compare('abc','abc'),{accuracy:100,reproduced:100,mistakes:0,first:-1,complete:true});
  assert.equal(C.compare('abcdef','abc').complete,false);
  assert.equal(C.compare('abcdef','abc').reproduced,50);
  assert.equal(C.compare('abc','abX').mistakes,1);
  assert.equal(C.compare('abc','abX').first,2);
  assert.equal(C.compare('abc','abcd').complete,false);
  assert.equal(C.compare('','').complete,false);
});
test('revision cycle advances 1, 7, 30 days then completes without losing code',()=>{
  const now='2026-10-25T06:00:00.000Z';let r=C.solve({code:'saved',saved:true},now);
  assert.equal(r.dueAt,'2026-10-26T06:00:00.000Z');
  r=C.review(r,r.dueAt);assert.equal(r.dueAt,'2026-11-02T06:00:00.000Z');
  r=C.review(r,r.dueAt);assert.equal(r.dueAt,'2026-12-02T06:00:00.000Z');
  r=C.review(r,r.dueAt);assert.equal(r.dueAt,null);assert.equal(r.reviewStep,3);assert.equal(r.code,'saved');assert.equal(r.saved,true);
});
test('streak uses local dates and allows an unfinished today',()=>{
  const now=new Date(2026,9,25,12),at=d=>new Date(2026,9,d,12).toISOString();
  assert.equal(C.streak([{at:at(24)},{at:at(23)},{at:at(23)}],now),2);
  assert.equal(C.streak([{at:at(25)},{at:at(24)},{at:at(22)}],now),2);
  assert.equal(C.streak([],now),0);
});
test('calendar uses CRLF, escapes fields, folds UTF-8 and includes alarms',()=>{
  const now='2026-10-25T06:00:00Z',title='Go, arrays; '+ '✿'.repeat(40);
  const text=C.calendar([{id:'one',title,url:'https://example.com'}],{one:{done:true,dueAt:'2026-11-01T06:00:00Z',reviewStep:0}},now);
  assert.match(text,/BEGIN:VCALENDAR\r\n/);assert.match(text,/BEGIN:VALARM/);assert.match(text,/SUMMARY:Revise: Go\\, arrays\\;/);assert.match(text,/TRIGGER:-PT15M/);
  for(const line of text.split('\r\n'))assert(Buffer.byteLength(line,'utf8')<=75);
  assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,1);
  assert(!C.calendar([{id:'one',title:'x'}],{one:{done:false,dueAt:now}},now).includes('BEGIN:VEVENT'));
});
test('backup validation accepts full data and rejects broken relationships and URLs',()=>{
  const valid={version:2,topics:[{id:'t1',name:'Arrays'}],problems:[{id:'1',lc:1,title:'Two Sum',topic:'t1',difficulty:'Easy',url:'https://leetcode.com/problems/two-sum/'}],records:{'1':{code:'package main',done:true,dueAt:'2026-10-26',reviewStep:0}},activity:[]};
  assert.equal(C.validate(valid),valid);
  const mutate=fn=>{const copy=structuredClone(valid);fn(copy);assert.throws(()=>C.validate(copy))};
  mutate(v=>v.problems[0].topic='missing');mutate(v=>v.problems[0].url='javascript:alert(1)');mutate(v=>v.records['1'].code={});mutate(v=>v.problems.push(v.problems[0]));mutate(v=>v.records['1'].dueAt='bad');mutate(v=>v.activity.push({problemId:'missing',type:'solve',at:'2026-10-25'}));
});
