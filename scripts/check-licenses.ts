/**
 * Falha se alguma dependência de produção do workspace tiver licença copyleft (GPL/AGPL/LGPL) ou ausente.
 * Uso: node scripts/check-licenses.ts @antispam-br/api
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Node { version?: string; resolved?: string; dependencies?: Record<string, Node> }

const workspace = process.argv[2];
if (!workspace) throw new Error('uso: check-licenses.ts <workspace>');

const tree = JSON.parse(execFileSync('npm', ['ls', '--omit=dev', '--all', '--json', '--workspace', workspace], { encoding: 'utf8' })) as Node;
const seen = new Map<string, string>();
const walk = (deps: Record<string, Node> = {}) => {
  for (const [name, node] of Object.entries(deps)) {
    // peer/opcional não instalado (ex.: pg-native) aparece sem versão
    if (seen.has(name) || !node.version) continue;
    if (node.resolved?.startsWith('file:')) {
      seen.set(name, 'WORKSPACE');
    } else {
      const pkg = JSON.parse(readFileSync(join('node_modules', name, 'package.json'), 'utf8'));
      seen.set(name, typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? 'UNKNOWN');
    }
    walk(node.dependencies);
  }
};
walk(tree.dependencies);

const bad = [...seen].filter(([, l]) => l !== 'WORKSPACE' && (/GPL/i.test(l) || l === 'UNKNOWN'));
for (const [name, license] of [...seen].sort()) console.log(`${license.padEnd(12)} ${name}`);
if (bad.length) {
  for (const [name, license] of bad) console.error(`::error::licença não permitida: ${name} (${license})`);
  process.exit(1);
}
console.log(`OK: ${seen.size} dependências de produção de ${workspace}`);
