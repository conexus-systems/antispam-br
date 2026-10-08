import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const root = new URL('../../../', import.meta.url);
const sandbox: { AntispamNormalize?: { toE164(raw: string): string | null } } = {};
runInNewContext(readFileSync(new URL('apps/web/normalize.js', root), 'utf8'), sandbox);
const vectors = JSON.parse(readFileSync(new URL('data/test-vectors/phone-normalization.json', root), 'utf8'));

test('normalização do portal = normalizador compartilhado (vetores sem DDD do usuário)', () => {
  const toE164 = sandbox.AntispamNormalize!.toE164;
  let checked = 0;
  for (const c of vectors.cases) {
    if (c.user_ddd) continue;
    if (c.e164) {
      assert.equal(toE164(c.input), c.e164, c.input);
      checked++;
    } else if (c.kind === 'EMERGENCY') {
      assert.equal(toE164(c.input), null, `emergência nunca vira consulta: ${c.input}`);
    }
  }
  assert.ok(checked >= 20, `vetores verificados: ${checked}`);
});
