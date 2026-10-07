/** Leitura/escrita do formato binário v1 — docs/specs/DATASET_FORMAT.md §3. */

export const MAGIC = 'ASBR';
export const FORMAT_VERSION = 1;
export const HEADER_SIZE = 32;
export const RECORD_SIZE = 16;

export const ShardKind = { FULL: 0, DELTA: 1 } as const;
export type ShardKind = (typeof ShardKind)[keyof typeof ShardKind];

export const Flags = {
  TOMBSTONE: 1 << 0,
  CAMPAIGN: 1 << 1,
  DISPUTED: 1 << 2,
  VERIFIED_ORG: 1 << 3,
} as const;

export const CATEGORIES = [
  'OTHER', 'TELEMARKETING', 'ROBOCALL', 'SILENT_CALL', 'COLLECTION', 'BANK_SCAM', 'PIX_SCAM',
  'PHISHING', 'DELIVERY_SCAM', 'FAKE_SUPPORT', 'LOAN', 'SURVEY', 'SPOOFING', 'LEGITIMATE',
] as const;
export type Category = (typeof CATEGORIES)[number];

const EPOCH_MS = Date.UTC(2020, 0, 1);

export interface DatasetRecord {
  number: bigint;
  score: number;
  category: Category;
  confidence: number;
  flags: number;
  reporters: number;
  lastSeen: Date;
}

export interface ShardFile {
  kind: ShardKind;
  version: bigint;
  fromVersion: bigint;
  records: DatasetRecord[];
}

export class DatasetFormatError extends Error {}

function clampByte(n: number, max: number): number {
  if (!Number.isInteger(n) || n < 0 || n > max) throw new DatasetFormatError(`valor fora de faixa: ${n}`);
  return n;
}

export function dayIndex(d: Date): number {
  return Math.max(0, Math.min(0xffff, Math.floor((d.getTime() - EPOCH_MS) / 86_400_000)));
}

export function encodeShard(shard: ShardFile): Buffer {
  const { records } = shard;
  for (let i = 1; i < records.length; i++) {
    if (records[i].number <= records[i - 1].number) {
      throw new DatasetFormatError('registros devem estar em ordem estritamente crescente');
    }
  }
  if (shard.kind === ShardKind.FULL && records.some((r) => r.flags & Flags.TOMBSTONE)) {
    throw new DatasetFormatError('shard FULL não pode conter TOMBSTONE');
  }
  const buf = Buffer.alloc(HEADER_SIZE + RECORD_SIZE * records.length);
  buf.write(MAGIC, 0, 'ascii');
  buf.writeUInt8(FORMAT_VERSION, 4);
  buf.writeUInt8(shard.kind, 5);
  buf.writeUInt32BE(records.length, 8);
  buf.writeBigUInt64BE(shard.version, 16);
  buf.writeBigUInt64BE(shard.fromVersion, 24);
  let off = HEADER_SIZE;
  for (const r of records) {
    const cat = CATEGORIES.indexOf(r.category);
    if (cat < 0) throw new DatasetFormatError(`categoria inválida: ${r.category}`);
    buf.writeBigUInt64BE(r.number, off);
    buf.writeUInt8(clampByte(r.score, 100), off + 8);
    buf.writeUInt8(cat, off + 9);
    buf.writeUInt8(clampByte(r.confidence, 100), off + 10);
    buf.writeUInt8(clampByte(r.flags, 0x0f), off + 11);
    buf.writeUInt16BE(Math.min(0xffff, Math.max(0, Math.round(r.reporters))), off + 12);
    buf.writeUInt16BE(dayIndex(r.lastSeen), off + 14);
    off += RECORD_SIZE;
  }
  return buf;
}

export function decodeShard(buf: Buffer): ShardFile {
  if (buf.length < HEADER_SIZE) throw new DatasetFormatError('arquivo menor que o header');
  if (buf.toString('ascii', 0, 4) !== MAGIC) throw new DatasetFormatError('magic inválido');
  if (buf.readUInt8(4) !== FORMAT_VERSION) throw new DatasetFormatError('format_version não suportada');
  const kind = buf.readUInt8(5);
  if (kind !== ShardKind.FULL && kind !== ShardKind.DELTA) throw new DatasetFormatError('kind inválido');
  const count = buf.readUInt32BE(8);
  if (buf.length !== HEADER_SIZE + RECORD_SIZE * count) throw new DatasetFormatError('tamanho não confere com record_count');
  const version = buf.readBigUInt64BE(16);
  const fromVersion = buf.readBigUInt64BE(24);
  const records: DatasetRecord[] = [];
  let prev = -1n;
  for (let i = 0; i < count; i++) {
    const off = HEADER_SIZE + i * RECORD_SIZE;
    const number = buf.readBigUInt64BE(off);
    if (number <= prev) throw new DatasetFormatError('registros fora de ordem');
    prev = number;
    const flags = buf.readUInt8(off + 11);
    if (kind === ShardKind.FULL && flags & Flags.TOMBSTONE) throw new DatasetFormatError('TOMBSTONE em shard FULL');
    const catCode = buf.readUInt8(off + 9);
    records.push({
      number,
      score: Math.min(100, buf.readUInt8(off + 8)),
      category: CATEGORIES[catCode] ?? 'OTHER',
      confidence: Math.min(100, buf.readUInt8(off + 10)),
      flags,
      reporters: buf.readUInt16BE(off + 12),
      lastSeen: new Date(EPOCH_MS + buf.readUInt16BE(off + 14) * 86_400_000),
    });
  }
  return { kind, version, fromVersion, records };
}

/** Aplica um delta sobre os registros de um shard completo. */
export function applyDelta(base: ShardFile, delta: ShardFile): ShardFile {
  if (base.kind !== ShardKind.FULL || delta.kind !== ShardKind.DELTA) throw new DatasetFormatError('tipos incompatíveis');
  if (delta.fromVersion !== base.version) throw new DatasetFormatError('delta não parte da versão instalada');
  const map = new Map<bigint, DatasetRecord>(base.records.map((r) => [r.number, r]));
  for (const r of delta.records) {
    if (r.flags & Flags.TOMBSTONE) map.delete(r.number);
    else map.set(r.number, r);
  }
  const records = [...map.values()].sort((a, b) => (a.number < b.number ? -1 : a.number > b.number ? 1 : 0));
  return { kind: ShardKind.FULL, version: delta.version, fromVersion: 0n, records };
}
