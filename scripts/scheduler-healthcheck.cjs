// Read-only database probe. A deliberately nonexistent slug avoids reading
// participant data while still exercising the get_schedule database query.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function isExpectedResponse(status, body) {
  // PostgREST maps PL/pgSQL's P0002 (no_data_found) to HTTP 500. Matching
  // both code and message distinguishes our deliberate miss from an outage.
  return status === 500 && body?.code === 'P0002'
    && body?.message === 'Schedule not found.';
}

async function main() {
  const context = {window: {}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../static/schedule/config.js'), 'utf8'), context);
  const {supabaseUrl, supabaseAnonKey} = context.window.SCHEDULER_CONFIG;
  if (!supabaseAnonKey.startsWith('sb_publishable_')) throw new Error('Expected a public publishable key. Do not use a private key.');
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) throw new Error('Unexpected backend URL.');
  const response = await fetch(`${url.origin}/rest/v1/rpc/get_schedule`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: {apikey: supabaseAnonKey, 'Content-Type': 'application/json'},
    body: JSON.stringify({p_slug: 'scheduler-healthcheck-nonexistent'})
  });
  const body = await response.json().catch(() => null);
  if (!isExpectedResponse(response.status, body)) {
    throw new Error(`Database probe failed (HTTP ${response.status}). Check Supabase project status and resume it manually if paused.`);
  }
  console.log('Database lookup reached PostgreSQL. No schedule data read or changed.');
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = {isExpectedResponse};
