import test from 'node:test';
import assert from 'assert';

test('health endpoint returns ok', async () => {
  const res = await fetch('http://localhost:4000/api/health');
  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.strictEqual(json.ok, true);
});
