const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
// Lightweight DOM for exercising application state transitions without a browser.
function workspace(saved={}){
  const ids={},elements=[],storage={...saved};
  class Element {
    constructor(tag='div'){this.tagName=tag;this.children=[];this.style={setProperty(){}};this.attrs={};this.dataset={};this.value='';this.hidden=false;this.selectionStart=0;this.selectionEnd=0;this.events={};this.classList={add(){},remove(){},toggle(){}};elements.push(this)}
    set id(value){this._id=value;ids[value]=this}get id(){return this._id}
    set textContent(value){this.text=String(value);this.children=[]}get textContent(){return (this.text||'')+this.children.map(c=>c.textContent||'').join('')}
    append(...items){this.children.push(...items)}replaceChildren(...items){this.text='';this.children=items}
    setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]}
    addEventListener(k,fn){(this.events[k]??=[]).push(fn)}dispatchEvent(e){e.target=this;for(const fn of this.events[e.type]||[])fn(e);this['on'+e.type]?.(e)}
    click(){this.dispatchEvent({type:'click',preventDefault(){}})}focus(){}remove(){}showModal(){this.open=true}close(){this.open=false}
    reset(){}setRangeText(text,start,end){this.value=this.value.slice(0,start)+text+this.value.slice(end);this.selectionStart=this.selectionEnd=start+text.length}
  }
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  for(const match of html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new Element(match[1]);el.id=match[2];el.hidden=/\shidden(?:\s|>)/.test(match[0])}
  for(const id of ['status','difficulty'])ids[id].value='all';ids['question-difficulty'].value='Medium';
  const document={getElementById:id=>ids[id]||null,createElement:tag=>new Element(tag),createTextNode:text=>({textContent:String(text)}),body:new Element('body'),querySelectorAll(selector){if(selector==='.group')return elements.filter(e=>e.className==='group');return []}};
  const context=vm.createContext({document,window:{addEventListener(){}},localStorage:{getItem:k=>storage[k]||null,setItem:(k,v)=>storage[k]=v},location:{protocol:'file:'},structuredClone,Date,URL,Blob,TextEncoder,crypto:require('node:crypto').webcrypto,AbortSignal,AbortController,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},confirm(){return true},Event:class{constructor(type){this.type=type}},console,navigator:{clipboard:{writeText:async()=>{}}}});
  for(const file of ['data.js','core.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
  return {ids,storage,run:script=>vm.runInContext(script,context),input(id,value){ids[id].value=value;ids[id].selectionStart=ids[id].selectionEnd=value.length;ids[id].dispatchEvent({type:'input'})},submit(id){ids[id].dispatchEvent({type:'submit',preventDefault(){}})}};
}
test('renders all questions and migrates old mastery/favorites without invented solve dates',()=>{
  const app=workspace({'manitrix-backend60-v1':'{"1":true}','dsa-saved-v1':'{"20":true}'});
  assert.equal(app.ids.completed.textContent,'1');assert.equal(app.ids.results.textContent,'58 of 58 problems');assert.equal(app.ids.list.children.length,10);assert.equal(app.run('state.records["20"].saved'),true);assert.equal(app.run('state.records["1"].solvedAt'),undefined);
});
test('Pasted code autosave, reference, typing accuracy, draft restore, notes and mastery',()=>{
  const app=workspace();app.run('openEditor("20")');
  const code='package main\nfunc isValid(s string) bool { return true }\n';app.input('code',code);app.input('notes','Remember stack order');app.ids['save-reference'].click();app.ids['mode-practice'].click();assert.equal(app.ids.code.value,'');app.input('code','package maX');assert.equal(app.ids.mistakes.textContent,'1');app.input('code',code);assert.equal(app.ids.reproduced.textContent,'100%');assert.match(app.ids['code-feedback'].textContent,/Perfect match/);
  app.ids['master-editor'].click();assert.equal(app.ids.completed.textContent,'1');assert.equal(app.run('state.activity[0].type'),'solve');assert(app.run('state.records["20"].dueAt'));
  app.ids['review-editor'].click();assert.equal(app.run('state.records["20"].reviewStep'),1);assert.equal(app.run('state.activity[1].type'),'revision');
  const restored=workspace(app.storage);restored.run('openEditor("20")');assert.equal(restored.ids.code.value,code);assert.equal(restored.ids.notes.value,'Remember stack order');restored.ids['mode-practice'].click();assert.equal(restored.ids.code.value,code);
});
test('topic/question add, edit, move, filter and delete preserve saved code',()=>{
  const app=workspace();app.ids['new-topic'].value='Bit Manipulation';app.submit('topic-form');assert.equal(app.run('state.topics.length'),11);const topic=app.run('state.topics.at(-1).id');
  app.run('editQuestion()');app.ids['question-title'].value='Counting Bits';app.ids['question-lc'].value='338';app.ids['question-topic'].value=topic;app.ids['question-difficulty'].value='Easy';app.ids['question-url'].value='https://leetcode.com/problems/counting-bits/';app.submit('question-form');assert.equal(app.run('state.problems.length'),59);
  const id=app.run('state.problems.at(-1).id');app.run(`openEditor(${JSON.stringify(id)})`);app.input('code','package main\n// custom code');app.run(`editQuestion(${JSON.stringify(id)})`);app.ids['question-title'].value='Counting Bits — revisit';app.ids['question-topic'].value='t0';app.submit('question-form');assert.equal(app.run(`state.records[${JSON.stringify(id)}].code`),'package main\n// custom code');assert.equal(app.run('state.problems.at(-1).topic'),'t0');
  app.input('search','Counting Bits');assert.equal(app.ids.results.textContent,'1 of 59 problems');app.run(`editQuestion(${JSON.stringify(id)})`);app.ids['delete-question'].click();assert.equal(app.run('state.problems.length'),58);assert.equal(app.run(`state.records[${JSON.stringify(id)}]`),undefined);
});
test('activity date filter and revision due filter show only relevant questions',()=>{
  const app=workspace();app.run('toggleMaster("1")');app.ids['filter-day'].click();assert.equal(app.ids.results.textContent,'1 of 58 problems');app.ids['clear-filters'].click();assert.equal(app.ids.results.textContent,'58 of 58 problems');app.run('state.records["1"].dueAt="2020-01-01T12:00:00Z"');app.ids['show-due'].click();assert.equal(app.ids.results.textContent,'1 of 58 problems');assert.equal(app.ids['due-count'].textContent,'1');
});
test('paste then Practice immediately shows a gray guide with green/red typing feedback',()=>{
  const app=workspace();app.run('openEditor("20")');
  const code='def solve():\n    return True';app.input('code',code);app.ids['mode-practice'].click();
  assert.equal(app.ids.code.value,'');assert.equal(app.ids['typing-overlay'].hidden,false);assert.equal(app.ids['typing-overlay'].children[0].textContent,'d');assert.equal(app.ids['typing-overlay'].children[0].className,'not-typed');
  app.input('code','dX');assert.equal(app.ids['typing-overlay'].children[0].className,'typed-correct');assert.equal(app.ids['typing-overlay'].children[1].className,'typed-wrong');
  app.ids['blank-mode'].checked=true;app.ids['blank-mode'].onchange();assert.match(app.ids['typing-overlay'].children[2].className,/hidden-guide/);
  app.ids['mode-edit'].click();assert.equal(app.ids.code.value,code);assert.equal(app.ids['typing-overlay'].hidden,true);
});
test('practice automatically advances blank lines and exact indentation, including tabs',()=>{
  const app=workspace();app.run('openEditor("1")');
  const code='package main\n\nfunc solve() {\n\treturn\n}\n';
  app.input('code',code);app.ids['mode-practice'].click();
  app.input('code','package main');assert.equal(app.ids.code.value,'package main\n\n');assert.equal(app.ids.code.selectionStart,14);
  app.input('code','package main\n\nfunc solve() {');assert.equal(app.ids.code.value,'package main\n\nfunc solve() {\n\t');
  app.input('code',app.ids.code.value+'return');assert.equal(app.ids.code.value,'package main\n\nfunc solve() {\n\treturn\n');
  app.input('code',app.ids.code.value+'}');assert.equal(app.ids.code.value,code);assert.equal(app.ids.reproduced.textContent,'100%');
});
test('Tab follows pasted spaces and Enter does not add a second newline after auto-advance',()=>{
  const app=workspace();app.run('openEditor("1")');app.input('code','a    b\n    c');app.ids['mode-practice'].click();app.input('code','a');
  app.ids.code.dispatchEvent({type:'keydown',key:'Tab',preventDefault(){}});assert.equal(app.ids.code.value,'a    ');
  app.input('code','a    b');assert.equal(app.ids.code.value,'a    b\n    ');
  app.ids.code.dispatchEvent({type:'keydown',key:'Enter',preventDefault(){}});assert.equal(app.ids.code.value,'a    b\n    ');
  app.ids.code.dispatchEvent({type:'keydown',key:'Tab',preventDefault(){}});assert.equal(app.ids.code.value,'a    b\n    ');
  app.input('code',app.ids.code.value+'c');assert.equal(app.ids.mistakes.textContent,'0');
});
