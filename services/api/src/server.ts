import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { createReport, hashPrefix, lookup, markLegitimate, vote } from './community.ts';
import type { Config } from './config.ts';
import { datasetFile, datasetIndex, listCampaigns, manifestBytes } from './datasets.ts';
import type { Db } from './db.ts';
import { authenticate, issueChallenge, registerDevice } from './devices.ts';
import { clientIp, HttpError, networkKey, readJson, Router, send, type Ctx } from './http.ts';
import { hit } from './limits.ts';
import { decideContest, listContests, quarantineDevice, requireModerator } from './moderation.ts';

export function buildRouter(config: Config, db: Db): Router {
  const lookupLimit = (ctx: Ctx) => hit(db, `lookup:net:${ctx.network}`, 60, config.limits.networkLookupsPerMinute);
  const device = (ctx: Ctx) => authenticate(db, config, ctx.network, ctx.req);
  const id = (raw: string) => (/^\d{1,18}$/.test(raw) ? Number(raw) : -1);

  return new Router()
    .on('GET', '/healthz', async () => {
      await db.query('SELECT 1');
      return { body: { ok: true } };
    })
    .on('GET', '/v1/devices/challenge', async () => ({ body: issueChallenge(config) }))
    .on('POST', '/v1/devices', async (ctx) => ({
      status: 201, body: await registerDevice(db, config, ctx.network, ctx.reputationNetwork, await ctx.body()),
    }))

    .on('GET', '/v1/numbers/:number/reputation', async (ctx) => {
      await lookupLimit(ctx);
      return { body: await lookup(db, ctx.params.number) };
    })
    .on('GET', '/v1/reputation/hash-prefix/:prefix', async (ctx) => {
      await lookupLimit(ctx);
      return { body: await hashPrefix(db, ctx.params.prefix), headers: { 'cache-control': 'public, max-age=300' } };
    })
    .on('POST', '/v1/reports', async (ctx) => {
      const d = await device(ctx);
      return { status: 201, body: await createReport(db, config, d, ctx.network, await ctx.body()) };
    })
    .on('POST', '/v1/reports/:ref/vote', async (ctx) => {
      const d = await device(ctx);
      return { body: await vote(db, config, d, ctx.network, ctx.params.ref, await ctx.body()) };
    })
    .on('POST', '/v1/numbers/:number/legitimate', async (ctx) => {
      const d = await device(ctx);
      return { status: 201, body: await markLegitimate(db, config, d, ctx.network, ctx.params.number, await ctx.body()) };
    })
    .on('GET', '/v1/campaigns', async (ctx) => {
      await lookupLimit(ctx);
      return { body: await listCampaigns(db) };
    })

    .on('GET', '/v1/datasets/manifest', async () => ({ raw: await manifestBytes(db, null, false) }))
    .on('GET', '/v1/datasets/manifest.sig', async () => ({ raw: await manifestBytes(db, null, true) }))
    .on('GET', '/v1/datasets/:version', async (ctx) => ({ body: await datasetIndex(db, ctx.params.version) }))
    .on('GET', '/v1/datasets/:version/manifest.json', async (ctx) => ({ raw: await manifestBytes(db, ctx.params.version, false), headers: immutable }))
    .on('GET', '/v1/datasets/:version/manifest.json.sig', async (ctx) => ({ raw: await manifestBytes(db, ctx.params.version, true), headers: immutable }))
    .on('GET', '/v1/datasets/:version/brazil/:file', async (ctx) => ({
      raw: await datasetFile(db, ctx.params.version, `brazil/${ctx.params.file}`), headers: immutable,
    }))
    .on('GET', '/v1/datasets/:version/brazil/deltas/:file', async (ctx) => ({
      raw: await datasetFile(db, ctx.params.version, `brazil/deltas/${ctx.params.file}`), headers: immutable,
    }))

    .on('GET', '/v1/moderation/contests', async (ctx) => {
      requireModerator(config, ctx.req);
      return { body: await listContests(db, ctx.url.searchParams.get('status') ?? 'PENDING') };
    })
    .on('POST', '/v1/moderation/contests/:id/decision', async (ctx) => {
      const moderator = requireModerator(config, ctx.req);
      return { body: await decideContest(db, config, moderator, id(ctx.params.id), await ctx.body()) };
    })
    .on('POST', '/v1/moderation/devices/:id/quarantine', async (ctx) => {
      const moderator = requireModerator(config, ctx.req);
      return { body: await quarantineDevice(db, config, moderator, id(ctx.params.id), await ctx.body()) };
    })

    .on('GET', '/', async () => web(config, 'index.html', 'text/html; charset=utf-8'))
    .on('GET', '/index.html', async () => web(config, 'index.html', 'text/html; charset=utf-8'))
    .on('GET', '/app.js', async () => web(config, 'app.js', 'text/javascript; charset=utf-8'))
    .on('GET', '/normalize.js', async () => web(config, 'normalize.js', 'text/javascript; charset=utf-8'));
}

const immutable = { 'cache-control': 'public, max-age=31536000, immutable' };

async function web(config: Config, file: 'index.html' | 'app.js' | 'normalize.js', contentType: string) {
  if (!config.webDir) throw new HttpError(404, 'NOT_FOUND');
  return { raw: { contentType, data: await readFile(join(config.webDir, file)) } };
}

export function buildServer(config: Config, db: Db, log: (msg: string) => void = console.error): Server {
  const router = buildRouter(config, db);
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      const match = router.match(req.method ?? 'GET', url.pathname);
      if (match === null) throw new HttpError(404, 'NOT_FOUND');
      if (match === 'METHOD') throw new HttpError(405, 'METHOD_NOT_ALLOWED');
      const ip = clientIp(req, config);
      const ctx: Ctx = {
        req, url, params: match.params,
        network: networkKey(ip, config.serverSecret),
        reputationNetwork: networkKey(ip, config.serverSecret, 2),
        body: () => readJson(req),
      };
      send(res, await match.handler(ctx));
    } catch (err) {
      if (err instanceof HttpError) {
        const headers: Record<string, string> = {};
        if (typeof err.extra.retry_after_seconds === 'number') headers['retry-after'] = String(err.extra.retry_after_seconds);
        send(res, { status: err.status, headers, body: { error: err.code, message: err.message, ...err.extra } });
        return;
      }
      // Detalhes só no log do servidor; o número consultado nunca vai para o log.
      log(`[api] ${req.method} ${url.pathname.split('/').slice(0, 3).join('/')} → ${(err as Error).stack ?? err}`);
      send(res, { status: 500, body: { error: 'INTERNAL' } });
    }
  });
}
