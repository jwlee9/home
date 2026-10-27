const {test} = require('node:test');
const assert = require('node:assert/strict');
const {isExpectedResponse} = require('../scripts/scheduler-healthcheck.cjs');
test('database probe recognizes only the expected database exception', () => {
  const body = {code: 'P0002', message: 'Schedule not found.'};
  assert.equal(isExpectedResponse(500, body), true);
  for (const status of [200,401,403,404,406,429,503]) assert.equal(isExpectedResponse(status, body), false);
  assert.equal(isExpectedResponse(500, null), false);
  assert.equal(isExpectedResponse(500, {code:'PGRST301'}), false);
});
