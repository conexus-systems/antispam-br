(function () {
  'use strict';
  var API = window.ANTISPAM_API_BASE || location.origin;

  var CATEGORIES = [
    ['TELEMARKETING', 'Telemarketing insistente'], ['ROBOCALL', 'Ligação robotizada'], ['SILENT_CALL', 'Ligação muda'],
    ['COLLECTION', 'Cobrança'], ['BANK_SCAM', 'Golpe do falso banco'], ['PIX_SCAM', 'Golpe do PIX'],
    ['PHISHING', 'Pede senha, código ou dados'], ['DELIVERY_SCAM', 'Falsa entrega / taxa'], ['FAKE_SUPPORT', 'Falso suporte técnico'],
    ['LOAN', 'Oferta de empréstimo'], ['SURVEY', 'Pesquisa'], ['SPOOFING', 'Número falsificado'], ['OTHER', 'Outro'],
  ];
  var LABELS = { CLEAN: 'Sem indícios', LOW_RISK: 'Risco baixo', SUSPICIOUS: 'Suspeito', SPAM: 'Spam', HIGH_RISK: 'Alto risco' };
  var ERRORS = {
    EMERGENCY_NUMBER: 'Números de emergência e utilidade pública não recebem denúncias.',
    INVALID_NUMBER: 'Número inválido. Use DDD + número.',
    RATE_LIMITED: 'Muitas ações em pouco tempo. Tente de novo mais tarde.',
    REPLAY: 'Pedido repetido.',
    INSUFFICIENT_WORK: 'Falha na verificação anti-robô. Tente de novo.',
  };

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    (children || []).forEach(function (c) { e.append(c instanceof Node ? c : document.createTextNode(String(c))); });
    return e;
  }
  function render(id, nodes) { document.getElementById(id).replaceChildren.apply(document.getElementById(id), nodes); }
  function msg(id, cls, text) { render(id, [el('p', { class: cls }, [text])]); }
  function value(id) { return document.getElementById(id).value; }

  // ---------- navegação ----------
  var nav = document.getElementById('nav');
  nav.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-view]');
    if (!btn) return;
    document.querySelectorAll('main > section').forEach(function (s) { s.classList.toggle('hidden', s.id !== 'view-' + btn.dataset.view); });
    nav.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === btn); });
  });

  var select = document.getElementById('d-category');
  var catBody = document.querySelector('#cat-table tbody');
  CATEGORIES.forEach(function (c) {
    select.append(el('option', { value: c[0] }, [c[1]]));
    catBody.append(el('tr', {}, [el('td', {}, [el('code', {}, [c[0]])]), el('td', {}, [c[1]])]));
  });

  var toE164 = window.AntispamNormalize.toE164;

  async function sha256Hex(text) {
    var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  async function api(method, path, body, token) {
    var headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Device ' + token;
    var res = await fetch(API + path, { method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
    var data = null;
    try { data = await res.json(); } catch (e) { /* sem corpo */ }
    return { status: res.status, data: data || {} };
  }

  function verdict(score, label) {
    var color = score >= 60 ? 'var(--danger)' : score >= 40 ? 'var(--warn)' : 'var(--primary)';
    return [
      el('div', { class: 'verdict ' + label }, [LABELS[label] || label]),
      el('div', { class: 'score', style: 'color:' + color }, [score, el('span', { style: 'font-size:14px;color:var(--dim)' }, ['/100'])]),
    ];
  }

  // ---------- consulta k-anônima ----------
  document.getElementById('q-btn').addEventListener('click', async function () {
    var e164 = toE164(value('q-number'));
    if (!e164) return msg('q-result', 'err', ERRORS.INVALID_NUMBER);
    msg('q-result', 'muted', 'Consultando…');
    try {
      var hash = await sha256Hex(e164);
      var r = await api('GET', '/v1/reputation/hash-prefix/' + hash.slice(0, 5));
      var hit = (r.data.entries || []).find(function (x) { return x.sha256 === hash; });
      if (!hit) {
        return render('q-result', [el('p', { class: 'ok' }, ['Este número não está na base pública de spam.']),
          el('p', { class: 'muted' }, ['Ele ainda pode ter denúncias recentes não publicadas — use "Ver detalhes".'])]);
      }
      var cat = CATEGORIES.find(function (c) { return c[0] === hit.category; });
      render('q-result', verdict(hit.score, hit.label).concat([
        el('p', { class: 'muted' }, ['Categoria predominante: ' + (cat ? cat[1] : hit.category) + (hit.disputed ? ' · contestado' : '')]),
      ]));
    } catch (e) { msg('q-result', 'err', 'API indisponível.'); }
  });

  document.getElementById('q-detail').addEventListener('click', async function () {
    var raw = value('q-number').trim();
    if (!raw) return msg('q-result', 'err', ERRORS.INVALID_NUMBER);
    try {
      var r = await api('GET', '/v1/numbers/' + encodeURIComponent(raw) + '/reputation');
      if (r.status !== 200) return msg('q-result', 'err', ERRORS[r.data.error] || 'Erro ' + r.status);
      var d = r.data;
      if (d.status === 'NEVER_BLOCK') return msg('q-result', 'ok', 'Emergência / utilidade pública: nunca é bloqueado.');
      if (!d.published) {
        return render('q-result', [el('p', { class: 'ok' }, ['Este número não está na base pública de spam.']),
          el('p', { class: 'muted' }, ['Só aparecem números com denúncias de várias pessoas independentes, em redes diferentes, há mais de 48 horas e sem contestação em análise.'])]);
      }
      var items = [
        el('li', {}, [el('b', {}, [d.evidence.distinct_reporters]), ' denunciantes independentes (peso ' + d.evidence.weighted_reporters + ')']),
      ];
      if (d.disputed) items.push(el('li', {}, ['Contestado por quem diz ser legítimo']));
      if (d.verified_org) items.push(el('li', {}, ['Organização verificada']));
      (d.factors || []).forEach(function (f) { items.push(el('li', {}, [el('code', {}, [f.factor]), ' ' + f.value + ' — ' + f.note])); });
      render('q-result', verdict(d.score, d.label).concat([el('p', { class: 'muted' }, [d.number]), el('ul', { class: 'clean' }, items)]));
    } catch (e) { msg('q-result', 'err', 'API indisponível.'); }
  });

  // ---------- dispositivo pseudônimo (prova de trabalho) ----------
  function zeroBits(bytes) {
    var n = 0;
    for (var i = 0; i < bytes.length; i++) {
      if (bytes[i] === 0) { n += 8; continue; }
      return n + Math.clz32(bytes[i]) - 24;
    }
    return n;
  }

  async function deviceToken(outId) {
    var saved = localStorage.getItem('antispam-device');
    if (saved) return saved;
    msg(outId, 'muted', 'Verificação anti-robô (alguns segundos)…');
    var ch = (await api('GET', '/v1/devices/challenge')).data;
    var enc = new TextEncoder();
    for (var i = 0; ; i++) {
      var s = i.toString(36);
      var digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(ch.challenge + ':' + s)));
      if (zeroBits(digest) >= ch.bits) {
        var r = await api('POST', '/v1/devices', { challenge: ch.challenge, solution: s });
        if (r.status !== 201) throw new Error(r.data.error || 'registro falhou');
        localStorage.setItem('antispam-device', r.data.device_token);
        return r.data.device_token;
      }
    }
  }

  function nonce() {
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return Array.from(b).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }

  async function submit(outId, path, body, okText) {
    try {
      var token = await deviceToken(outId);
      body.nonce = nonce();
      body.timestamp = Date.now();
      var r = await api('POST', path, body, token);
      if (r.status === 401) localStorage.removeItem('antispam-device');
      if (r.status === 201) return msg(outId, 'ok', okText);
      msg(outId, 'err', ERRORS[r.data.error] || 'Recusado: ' + (r.data.error || r.status));
    } catch (e) { msg(outId, 'err', 'API indisponível.'); }
  }

  document.getElementById('d-btn').addEventListener('click', function () {
    var number = value('d-number').trim();
    if (!number) return msg('d-result', 'err', ERRORS.INVALID_NUMBER);
    submit('d-result', '/v1/reports', { number: number, category: value('d-category'), comment: value('d-comment') },
      'Denúncia registrada. Ela soma com outras denúncias independentes antes de qualquer bloqueio.');
  });

  document.getElementById('c-btn').addEventListener('click', function () {
    var number = value('c-number').trim();
    if (!number) return msg('c-result', 'err', ERRORS.INVALID_NUMBER);
    submit('c-result', '/v1/numbers/' + encodeURIComponent(number) + '/legitimate', { comment: value('c-comment') },
      'Contestação recebida. A moderação vai analisar; contestações de dispositivos com histórico confiável suspendem a publicação até a decisão.');
  });

  // ---------- campanhas ----------
  document.getElementById('camp-btn').addEventListener('click', async function () {
    var tbody = document.querySelector('#camp-table tbody');
    try {
      var list = (await api('GET', '/v1/campaigns')).data.campaigns || [];
      tbody.replaceChildren.apply(tbody, list.length ? list.map(function (c) {
        return el('tr', {}, [el('td', {}, [el('code', {}, [c.pattern])]), el('td', {}, [c.numbers]), el('td', {}, [c.category]), el('td', {}, [String(c.last_seen).slice(0, 10)])]);
      }) : [el('tr', {}, [el('td', { colspan: '4', class: 'muted' }, ['Nenhuma campanha ativa no momento.'])])]);
    } catch (e) {
      tbody.replaceChildren(el('tr', {}, [el('td', { colspan: '4', class: 'err' }, ['API indisponível.'])]));
    }
  });

  // ---------- datasets ----------
  document.getElementById('ds-btn').addEventListener('click', async function () {
    try {
      var r = await api('GET', '/v1/datasets/manifest');
      if (r.status === 404) return msg('ds-result', 'muted', 'Nenhum dataset publicado ainda.');
      var m = r.data;
      render('ds-result', [el('ul', { class: 'clean' }, [
        el('li', {}, ['Versão: ', el('b', {}, [m.version])]),
        el('li', {}, ['Criado: ', el('b', {}, [m.created_at])]),
        el('li', {}, ['Expira: ', el('b', {}, [m.expires_at])]),
        el('li', {}, ['Registros: ', el('b', {}, [m.record_count])]),
        el('li', {}, ['Chave: ', el('code', {}, [m.key_id]), ' (Ed25519 — assinatura em /v1/datasets/manifest.sig)']),
        el('li', {}, ['Política: ≥' + m.publication_policy.min_weighted_reporters + ' denunciantes ponderados, ≥' +
          m.publication_policy.min_age_hours + ' h, score ≥' + m.publication_policy.min_score]),
      ]), el('pre', {}, [JSON.stringify(m.shards, null, 2)])]);
    } catch (e) { msg('ds-result', 'err', 'API indisponível.'); }
  });
})();
