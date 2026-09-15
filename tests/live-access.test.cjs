const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(`${__dirname}/../static/schedule/config.js`,'utf8'),context);
const config = context.window.SCHEDULER_CONFIG;
test('only a public Supabase key is shipped',()=>{
  const key=config.supabaseAnonKey;
  if(key.startsWith('sb_publishable_')) return;
  assert.equal(JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role,'anon');
});
test('live API denies table access and rejects malformed events without creating data',{skip:process.env.SCHEDULER_LIVE_TESTS!=='1'},async()=>{
  const headers={apikey:config.supabaseAnonKey,Authorization:`Bearer ${config.supabaseAnonKey}`,'Content-Type':'application/json'};
  for(const table of ['schedule_events','schedule_responses']) {
    const result=await fetch(`${config.supabaseUrl}/rest/v1/${table}?select=id&limit=0`,{headers});
    assert.ok([401,403].includes(result.status),`${table} must deny direct reads`);
  }
  const missing=await fetch(`${config.supabaseUrl}/rest/v1/rpc/get_schedule`,{method:'POST',headers,body:JSON.stringify({p_slug:'security-audit-nonexistent'})});
  assert.equal((await missing.json()).code,'P0002');
  const malformed=await fetch(`${config.supabaseUrl}/rest/v1/rpc/create_schedule_event`,{method:'POST',headers,body:JSON.stringify({p_title:'Rejected security check',p_dates:['not-a-date'],p_start_time:'10:00',p_end_time:'12:00',p_slot_minutes:30,p_timezone:'Asia/Seoul'})});
  assert.equal(malformed.ok,false);
  assert.match((await malformed.json()).message,/Invalid date/);
});
