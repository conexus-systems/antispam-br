import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalize, e164ToKey } from '../src/index.ts';

const vectors = JSON.parse(readFileSync(new URL('../../../data/test-vectors/phone-normalization.json', import.meta.url), 'utf8'));

for (const c of vectors.cases) {
  test(`normalize ${JSON.stringify(c.input)} (ddd=${c.user_ddd})`, () => {
    const r = normalize(c.input, c.user_ddd);
    assert.equal(r.kind, c.kind);
    assert.equal(r.e164, c.e164);
    assert.equal(r.shard, c.shard);
  });
}

test('e164ToKey', () => {
  assert.equal(e164ToKey('+5511987654321'), 5511987654321n);
  assert.throws(() => e164ToKey('5511'));
});
