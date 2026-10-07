/**
 * Envia um AAB assinado para um track da Google Play (API Android Publisher v3).
 *
 *   node apps/android/scripts/play-upload.ts --aab <arquivo.aab> \
 *     [--package br.antispam.app] [--track internal] [--status draft] [--name "0.1.0 (1)"] [--dry-run]
 *
 * Credencial: GOOGLE_PLAY_SERVICE_ACCOUNT (caminho do JSON da conta de serviço), nunca versionada.
 * App novo (ainda em rascunho na Console) só aceita releases com status "draft".
 */
import { createSign } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';

const API = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const UPLOAD = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

const { values } = parseArgs({
  options: {
    aab: { type: 'string' },
    package: { type: 'string', default: 'br.antispam.app' },
    track: { type: 'string', default: 'internal' },
    status: { type: 'string', default: 'draft' },
    name: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
});

function fail(message: string): never {
  console.error(`erro: ${message}`);
  process.exit(1);
}

const b64url = (data: string | Buffer) => Buffer.from(data).toString('base64url');

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri, iat: now, exp: now + 3600 }));
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(sa.private_key);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) fail(`token OAuth recusado (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function call<T>(token: string, method: string, url: string, body?: unknown, raw?: Buffer): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': raw ? 'application/octet-stream' : 'application/json',
    },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text();
  if (!res.ok) fail(`${method} ${url.replace(/\?.*/, '')} → ${res.status}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

const aabPath = values.aab ?? fail('informe --aab');
const saPath = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT ?? fail('defina GOOGLE_PLAY_SERVICE_ACCOUNT');
if (!['draft', 'completed', 'inProgress', 'halted'].includes(values.status!)) fail(`status inválido: ${values.status}`);

const sa = JSON.parse(readFileSync(saPath, 'utf8')) as ServiceAccount;
const aab = readFileSync(aabPath);
const pkg = values.package!;
console.log(`AAB ${aabPath} (${(statSync(aabPath).size / 1048576).toFixed(1)} MB) → ${pkg} track ${values.track} (${values.status})`);

const token = await accessToken(sa);
const app = `${API}/${pkg}`;
const edit = await call<{ id: string }>(token, 'POST', `${app}/edits`, {});
try {
  const bundle = await call<{ versionCode: number; sha256: string }>(
    token, 'POST', `${UPLOAD}/${pkg}/edits/${edit.id}/bundles?uploadType=media`, undefined, aab,
  );
  console.log(`bundle aceito: versionCode ${bundle.versionCode}, sha256 ${bundle.sha256}`);
  await call(token, 'PUT', `${app}/edits/${edit.id}/tracks/${values.track}`, {
    track: values.track,
    releases: [{
      name: values.name ?? `versionCode ${bundle.versionCode}`,
      versionCodes: [String(bundle.versionCode)],
      status: values.status,
    }],
  });
  if (values['dry-run']) {
    await call(token, 'POST', `${app}/edits/${edit.id}:validate`);
    await call(token, 'DELETE', `${app}/edits/${edit.id}`);
    console.log('dry-run: edição validada e descartada');
  } else {
    await call(token, 'POST', `${app}/edits/${edit.id}:commit`);
    console.log(`publicado no track ${values.track} como ${values.status}`);
  }
} catch (e) {
  await call(token, 'DELETE', `${app}/edits/${edit.id}`).catch(() => undefined);
  throw e;
}
