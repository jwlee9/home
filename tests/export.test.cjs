const { test } = require('node:test');
const assert = require('node:assert/strict');
const scheduleExport = require('../static/schedule/export.js');

test('exports saved schedules without credentials or response identifiers', () => {
  const event = {
    id:'event-id', slug:'public-slug', owner_token:'private-owner', title:'Rehearsal',
    timezone:'Asia/Seoul', dates:['2026-11-11'], start_time:'10:00:00', end_time:'12:00:00',
    slot_minutes:30, confirmed_date:null
  };
  const responses = [
    {id:'response-id', display_name:'Mina', availability:['2026-11-11T11:00','2026-11-11T10:00'], edit_token:'private-edit', password_hash:'private-hash'},
    {display_name:'Jaewon', availability:[]}
  ];
  const result = scheduleExport(event, responses);
  assert.deepEqual(result.responses, [
    {name:'Jaewon', available_times:[]},
    {name:'Mina', available_times:['2026-11-11T10:00','2026-11-11T11:00']}
  ]);
  assert.deepEqual(result.confirmed_time, null);
  assert.equal(result.timezone, 'Asia/Seoul');
  assert.doesNotMatch(JSON.stringify(result), /private-|response-id|event-id|public-slug/);
  assert.deepEqual(responses[0].availability, ['2026-11-11T11:00','2026-11-11T10:00']);
});

test('includes a confirmed time without changing event dates', () => {
  const event = {title:'Rehearsal', timezone:'Asia/Seoul', dates:['2026-11-11'], start_time:'10:00:00', end_time:'12:00:00', slot_minutes:30, confirmed_date:'2026-11-11', confirmed_start_time:'10:00:00', confirmed_end_time:'11:00:00'};
  const result = scheduleExport(event, []);
  assert.deepEqual(result.confirmed_time, {date:'2026-11-11', start_time:'10:00:00', end_time:'11:00:00'});
  assert.deepEqual(result.dates, ['2026-11-11']);
});
