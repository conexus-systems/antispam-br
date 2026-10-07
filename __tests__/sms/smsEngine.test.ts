import { analyzeSms, SMS_THRESHOLDS } from '../../src/core/sms/smsEngine';
import { extractUrls, findHomoglyphs, isImpersonatedDomain } from '../../src/core/sms/urlExtractor';
import { analyzeTextSignals, isLegitOtpSender } from '../../src/core/sms/heuristics';
import corpus from '../../data/sms-corpus/anonymous-corpus.json';

describe('urlExtractor', () => {
  it('extrai URLs simples e limpa pontuação final', () => {
    const urls = extractUrls('Acesse bit.ly/abc123. Depois www.exemplo.com/xyz!');
    expect(urls).toHaveLength(2);
    expect(urls[0].host).toBe('bit.ly');
    expect(urls[1].host).toBe('exemplo.com');
  });

  it('detecta encurtador', () => {
    expect(extractUrls('clique bit.ly/x1')[0].isShortener).toBe(true);
  });

  it('detecta host IP', () => {
    expect(extractUrls('veja http://193.22.11.4/pag')[0].isIpHost).toBe(true);
  });

  it('não marca IP inválido (octeto > 255)', () => {
    expect(extractUrls('http://999.999.999.999/x')[0].isIpHost).toBe(false);
  });

  it('detecta http inseguro', () => {
    expect(extractUrls('http://ok.com.br')[0].isHttp).toBe(true);
    expect(extractUrls('https://ok.com.br')[0].isHttp).toBe(false);
  });

  it('detecta impersonação de marca (nubank em TLD estranho)', () => {
    expect(isImpersonatedDomain('nubank-promocoes.xyz')).toBe(true);
    expect(isImpersonatedDomain('nubank.com.br')).toBe(false);
  });

  it('detecta homoglifos cirílicos', () => {
    expect(findHomoglyphs('nub\u0430nk.com')).toHaveLength(1);
  });
});

describe('heurísticas de texto', () => {
  it('detecta chave PIX com CPF', () => {
    const s = analyzeTextSignals('Regularize via pix 123.456.789-09');
    expect(s.some((x) => x.signal === 'PIX_KEY')).toBe(true);
  });

  it('detecta urgência', () => {
    expect(analyzeTextSignals('conta sera bloqueada hoje').some((x) => x.signal === 'URGENCY')).toBe(true);
  });

  it('banco + urgência = impersonação', () => {
    const s = analyzeTextSignals('Nubank: sua conta sera bloqueada. Atualize seu cadastro.');
    expect(s.some((x) => x.signal === 'BANK_IMPERSONATION')).toBe(true);
  });

  it('OTP de remetente legítimo é reconhecido', () => {
    expect(isLegitOtpSender('WhatsApp')).toBe(true);
    expect(isLegitOtpSender('5511xxxx')).toBe(false);
  });
});

describe('smsEngine — pipeline completo', () => {
  it('mensagem legítima → SAFE', () => {
    const r = analyzeSms({ sender: 'Itau', body: 'Compra aprovada de R$ 45,00 no cartao final 1234.' });
    expect(r.verdict).toBe('SAFE');
    expect(r.signals).toContain('NO_SIGNAL');
  });

  it('OTP legítimo (WhatsApp) → SAFE com sinal de mitigação', () => {
    const r = analyzeSms({ sender: 'WhatsApp', body: 'Seu codigo de verificacao: 123-456' });
    expect(r.verdict).toBe('SAFE');
    expect(r.signals).toContain('OTP_LEGIT_SENDER');
  });

  it('falso banco com domínio falso → SCAM', () => {
    const r = analyzeSms({
      sender: 'Nubank',
      body: 'Atualize seu cadastro em http://nubank-seguranca.xyz hoje, conta sera bloqueada.',
    });
    expect(r.verdict).toBe('SCAM');
    expect(r.score).toBeGreaterThanOrEqual(SMS_THRESHOLDS.SCAM_AT);
    expect(r.explanation.length).toBeGreaterThan(0);
  });

  it('IP direto = evidência forte que empurra para SCAM', () => {
    const r = analyzeSms({ sender: null, body: 'Premio liberado http://193.22.11.4/x pague a taxa' });
    expect(r.verdict).toBe('SCAM');
    expect(r.signals).toContain('IP_URL');
  });

  it('score é saturado em 0–100', () => {
    const r = analyzeSms({
      body: 'pix 123.456.789-09 urgente senha bit.ly/x http://1.2.3.4/y nubank-xyz.tk codigo de verificacao',
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('gera bodyHash determinístico e sem enviar texto (privacidade)', () => {
    const a = analyzeSms({ body: 'mensagem qualquer' });
    const b = analyzeSms({ body: 'mensagem qualquer' });
    expect(a.bodyHash).toBe(b.bodyHash);
    expect(a.bodyHash).toHaveLength(64);
  });
});

describe('corpus anonimizado (data/sms-corpus)', () => {
  it('cobre os 7 tipos exigidos pela missão', () => {
    const types = new Set(corpus.cases.map((c) => c.type));
    for (const required of [
      'spam',
      'telemarketing',
      'golpe',
      'mensagem_legitima',
      'banco_legitimo',
      'entrega_legitima',
      'otp_legitimo',
    ]) {
      expect(types).toContain(required);
    }
  });

  it.each(corpus.cases.map((c) => [c.id, c]))('%s bate com expectativa', (_id, c) => {
    const r = analyzeSms({ sender: c.sender, body: c.body });
    expect(r.verdict).toBe(c.expect_verdict);
  });
});
