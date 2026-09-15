const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(`${__dirname}/../static/schedule/validation.js`,'utf8'),context);
const {validDate,validateSchedule} = context.window.schedulerValidation;
const fixture = () => ({event:{id:'fixture',slug:'fixture',title:'Rehearsal',dates:['2026-09-21'],start_time:'10:00:00',end_time:'12:00:00',slot_minutes:30,timezone:'Asia/Seoul'},responses:[{display_name:'Alice',availability:['2026-09-21T10:00']}]});
test('canonical dates and leap days',()=>{
  assert.equal(validDate('2024-02-29'),true);
  for(const value of ['2026-02-29','2026-02-30','2026-13-01','2026-09-21<img>',null]) assert.equal(validDate(value),false);
});
test('valid schedule and literal user content',()=>{
  const f=fixture(); f.event.title='<script>alert(1)</script>'; assert.equal(validateSchedule(f),f);
});
test('legacy 66-day schedules remain readable',()=>{
  const f=fixture(); f.event.dates=Array.from({length:66},(_,i)=>new Date(Date.UTC(2026,8,21+i)).toISOString().slice(0,10));
  assert.equal(validateSchedule(f),f);
});
test('reject malformed and oversized stored records',()=>{
  for(const change of [f=>f.event.dates=['<img>'],f=>f.event.dates=Array(32).fill('2026-09-21'),f=>f.event.dates.push('2026-09-21'),f=>f.event.slot_minutes=0,f=>f.event.start_time='25:00',f=>f.event.timezone='Asia/Seoul\r\nBEGIN:VEVENT',f=>f.responses[0].availability=['2026-09-21T10:15'],f=>f.responses[0].availability=['2026-09-22T10:00'],f=>f.responses={}]) {
    const f=fixture();change(f);assert.throws(()=>validateSchedule(f));
  }
});
