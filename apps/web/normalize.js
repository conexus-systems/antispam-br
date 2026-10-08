/**
 * Normalização E.164 do portal (formatos comuns). Paridade com packages/phone-normalizer verificada
 * contra data/test-vectors/phone-normalization.json em services/api/test/portal.test.ts.
 */
(function (root) {
  'use strict';
  // DDD + assinante; celular antigo de 8 dígitos (7–9) ganha o nono dígito.
  function national(n) {
    if (n.length !== 10 && n.length !== 11) return null;
    var ddd = n.slice(0, 2);
    var sub = n.slice(2);
    if (!/^[1-9][1-9]$/.test(ddd)) return null;
    if (sub.length === 9) return sub.charAt(0) === '9' ? '+55' + ddd + sub : null;
    if (/^[7-9]/.test(sub)) sub = '9' + sub;
    return '+55' + ddd + sub;
  }
  function toE164(raw) {
    var t = String(raw || '').trim();
    var d = t.replace(/\D/g, '');
    if (!d || d.length <= 5) return null;
    if (t.charAt(0) === '+') {
      if (d.indexOf('55') === 0) {
        var rest = d.slice(2);
        if (/^(300|303|500|800|900)\d{7}$/.test(rest) || /^(300\d|400\d|4020|4062|4090|4091)\d{4}$/.test(rest)) return '+55' + rest;
        return national(rest);
      }
      return d.length >= 8 && d.length <= 15 ? '+' + d : null;
    }
    if (d.indexOf('00') === 0) return toE164('+' + d.slice(4));
    if (/^0(300|303|500|800|900)\d{7}$/.test(d)) return '+55' + d.slice(1);
    if (d.charAt(0) === '0') {
      if (d.length === 11 || d.length === 12) return national(d.slice(1));
      if (d.length === 13 || d.length === 14) return national(d.slice(3));
      return null;
    }
    if (/^(300\d|400\d|4020|4062|4090|4091)\d{4}$/.test(d)) return '+55' + d;
    if (d.indexOf('55') === 0 && (d.length === 12 || d.length === 13)) return national(d.slice(2));
    return national(d);
  }
  root.AntispamNormalize = { toE164: toE164 };
})(typeof window !== 'undefined' ? window : globalThis);
