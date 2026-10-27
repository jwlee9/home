const {test}=require('node:test');
const assert=require('node:assert/strict');
const tz=require('../static/schedule/time-zones.js');
const theme=require('../static/schedule/theme.js');
const event=(extra={})=>({dates:['2026-09-21'],start_time:'10:00',end_time:'12:00',slot_minutes:30,timezone:'Asia/Seoul',...extra});
test('Seoul to New York moves to previous date without changing keys',()=>{
  const grid=tz.project(event(),'America/New_York');
  assert.equal(grid.columns[0].date,'2026-09-20');
  assert.equal(grid.rows[0].start,21*60);
  assert.equal(grid.rows[0].cells[0].key,'2026-09-21T10:00');
  assert.equal(grid.rows.length,4);
});
test('conversion handles winter offsets and fractional-hour zones',()=>{
  assert.equal(tz.project(event({dates:['2026-12-21']}),'America/New_York').rows[0].start,20*60);
  assert.equal(tz.project(event(),'Asia/Kathmandu').rows[0].start,6*60+45);
});
test('midnight splits one source slot without losing either piece',()=>{
  const grid=tz.project(event({start_time:'03:00',end_time:'04:00'}),'Asia/Kathmandu');
  assert.deepEqual(grid.columns.map(c=>c.date),['2026-09-20','2026-09-21']);
  const parts=grid.columns.flatMap(c=>c.segments).filter(s=>s.key==='2026-09-21T03:00');
  assert.equal(parts.length,2);assert.equal(parts.reduce((n,s)=>n+s.end-s.start,0),30);
});
test('destination DST repeated hours are separate offset-labelled columns',()=>{
  const grid=tz.project(event({timezone:'UTC',dates:['2026-11-01'],start_time:'05:00',end_time:'07:00'}),'America/New_York');
  assert.equal(grid.columns.length,2);assert.ok(grid.columns.every(c=>c.split));
  assert.deepEqual(grid.columns.map(c=>c.offset),[-240,-300]);
  assert.equal(new Set(grid.columns.flatMap(c=>c.segments.map(s=>s.key))).size,4);
});
test('destination spring-forward keeps elapsed slot length',()=>{
  const grid=tz.project(event({timezone:'UTC',dates:['2026-03-08'],start_time:'06:30',end_time:'07:30'}),'America/New_York');
  assert.equal(grid.columns.flatMap(c=>c.segments).reduce((n,s)=>n+s.end-s.start,0),60);
  assert.deepEqual(grid.rows.filter(r=>r.cells.some(Boolean)).map(r=>r.start),[90,180]);
});
test('reject missing/repeated source times rather than guessing a UTC instant',()=>{
  assert.throws(()=>tz.resolve('2026-03-08',150,'America/New_York'),/DST_WALL_TIME/);
  assert.throws(()=>tz.resolve('2026-11-01',90,'America/New_York'),/DST_WALL_TIME/);
  assert.throws(()=>tz.validateEvent(event({timezone:'America/New_York',dates:['2026-11-01'],start_time:'00:00',end_time:'04:00'})),/DST_WALL_TIME/);
  assert.doesNotThrow(()=>tz.validateEvent(event({timezone:'America/New_York',dates:['2026-11-01']})));
});
test('local view is a lossless mapping, including date-boundary segments',()=>{
  for(const zone of ['UTC','Pacific/Auckland','Asia/Kathmandu','America/Los_Angeles','Europe/London']){
    const input=event({dates:['2026-09-21','2026-09-22'],start_time:'00:00',end_time:'23:30'}),grid=tz.project(input,zone);
    const segments=grid.columns.flatMap(c=>c.segments);
    assert.equal(new Set(segments.map(s=>s.key)).size,94);
    assert.equal(segments.reduce((n,s)=>n+s.end-s.start,0),2820);
  }
});
test('confirmed time and slot detail show both dates when crossing midnight',()=>{
  assert.match(tz.range('2026-09-21',180,240,'Asia/Seoul','Asia/Kathmandu'),/2026\/09\/20.*23:45.*2026\/09\/21 00:45/);
});
test('range labels distinguish repeated clocks across daylight-saving changes',()=>{
  assert.equal(tz.range('2026-11-01',330,390,'UTC','America/New_York'),'2026/11/01 · 01:30 (UTC−04:00)–01:30 (UTC−05:00) · America/New_York');
});
test('theme button text and meeting outline contrast',()=>{
  for(const color of ['#ffff00','#f9d63c','#ffffff','#000000','#2a4997','#6c3df4','#ff0000','#00ff00','#00ffff']){
    const p=theme.palette(color),base=theme.luminance(theme.rgb(color)),fill=theme.luminance(theme.rgb(color).map(c=>c*.88));
    assert.ok(theme.contrast(base,theme.luminance(theme.rgb(p.text)))>=4.5,color+' button');
    assert.ok(theme.contrast(fill,theme.luminance(theme.rgb(p.outline)))>=3,color+' outline');
    assert.ok(theme.contrast(theme.luminance(theme.rgb(p.chipFill)),theme.luminance(theme.rgb(p.chipText)))>=4.5,color+' participant chip');
  }
  assert.equal(theme.palette('#ffff00').outline,'#493500');
});
