/**
 * node src/cli.ts migrate
 * node src/cli.ts publish   (DATASET_SIGNING_SEED_FILE = semente Ed25519 de 32 bytes em base64; DATASET_KEY_ID)
 */
import { readFileSync } from 'node:fs';
import { privateKeyFromSeed } from '@antispam-br/datasets';
import { loadConfig } from './config.ts';
import { createPool, migrate } from './db.ts';
import { publishDataset } from './datasets.ts';

const [command] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ausente');
const db = createPool(url, { max: 2 });

try {
  if (command === 'migrate') {
    const applied = await migrate(db);
    console.log(applied.length ? `aplicadas: ${applied.join(', ')}` : 'nada a aplicar');
  } else if (command === 'publish') {
    const seedFile = process.env.DATASET_SIGNING_SEED_FILE;
    const keyId = process.env.DATASET_KEY_ID;
    if (!seedFile || !keyId) throw new Error('DATASET_SIGNING_SEED_FILE e DATASET_KEY_ID são obrigatórios');
    const seed = Buffer.from(readFileSync(seedFile, 'utf8').trim(), 'base64');
    if (seed.length !== 32) throw new Error('semente Ed25519 deve ter 32 bytes');
    const out = await publishDataset(db, loadConfig(), { privateKey: privateKeyFromSeed(seed), keyId });
    console.log(JSON.stringify(out));
  } else {
    console.error('uso: cli.ts migrate | publish');
    process.exitCode = 2;
  }
} finally {
  await db.end();
}
