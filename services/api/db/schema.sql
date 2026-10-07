-- COMMUNITY DB — AntiSpam BR (M8)
-- PRIVACIDADE: número cru NUNCA é armazenado — apenas SHA-256 (number_hash).
-- LGPD: sem dados pessoais além do hash e metadados de denúncia.

CREATE TABLE IF NOT EXISTS phone_numbers (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number_hash  CHAR(64) NOT NULL UNIQUE,           -- sha256 hex do E.164 normalizado
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  -- PK inclui a coluna de partição (regra do Postgres para tabelas particionadas)
  id             BIGINT GENERATED ALWAYS AS IDENTITY,
  number_hash    CHAR(64) NOT NULL REFERENCES phone_numbers(number_hash),
  category       TEXT NOT NULL CHECK (category IN (
    'TELEMARKETING','ROBOCALL','SILENT_CALL','COLLECTION','BANK_SCAM',
    'PIX_SCAM','PHISHING','DELIVERY_SCAM','FAKE_SUPPORT','LOAN',
    'SURVEY','SPOOFING','LEGITIMATE','OTHER')),
  reported_at    TIMESTAMPTZ NOT NULL,
  country        CHAR(2) NOT NULL DEFAULT 'BR',
  confidence     REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  source         TEXT NOT NULL CHECK (source IN (
    'USER_REPORT','USER_CONFIRMATION','USER_CONTEST','LOCAL_PATTERN','PARTNER_FEED')),
  reporter_hash  TEXT NOT NULL,                    -- hash rotativo do denunciante (não é ID fixo)
  optional_comment TEXT,                           -- só após moderação; sem PII
  weight         REAL NOT NULL DEFAULT 1.0,        -- peso anti-abuse do reporter
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, reported_at)
) PARTITION BY RANGE (reported_at);

-- Partições mensais (rotina de manutenção cria futuras)
CREATE TABLE IF NOT EXISTS reports_2026_10 PARTITION OF reports
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE INDEX IF NOT EXISTS idx_reports_number_time ON reports (number_hash, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports (reporter_hash, reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_category_time ON reports (category, reported_at DESC);

CREATE TABLE IF NOT EXISTS user_reputations (
  reporter_hash TEXT PRIMARY KEY,
  total_reports  INTEGER NOT NULL DEFAULT 0,
  confirmed      INTEGER NOT NULL DEFAULT 0,
  contested      INTEGER NOT NULL DEFAULT 0,
  quarantined    BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prefix_hash CHAR(64) NOT NULL,          -- hash do prefixo (não do número completo)
  category    TEXT NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL,
  peak_at     TIMESTAMPTZ,
  report_count INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns (active, started_at DESC);

CREATE TABLE IF NOT EXISTS moderation_decisions (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- FK composta: tabela particionada não permite referência a id isolado
  report_id       BIGINT NOT NULL,
  report_at       TIMESTAMPTZ NOT NULL,
  decision        TEXT NOT NULL CHECK (decision IN ('APPROVED','REJECTED','QUARANTINE_REPORTER')),
  reason          TEXT,
  decided_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (report_id, report_at) REFERENCES reports(id, reported_at)
);

CREATE TABLE IF NOT EXISTS dataset_versions (
  version      TEXT PRIMARY KEY,
  manifest     JSONB NOT NULL,             -- manifest assinado completo
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  record_count BIGINT NOT NULL
);

-- View materializada: reputação agregada (refresh periódico; leitura O(1))
CREATE MATERIALIZED VIEW IF NOT EXISTS reputation_mv AS
SELECT
  number_hash,
  COUNT(*) AS total_reports,
  COUNT(DISTINCT reporter_hash) AS distinct_reporters,
  SUM(CASE WHEN category = 'LEGITIMATE' THEN 1 ELSE 0 END) AS contests,
  MAX(reported_at) AS last_report_at,
  SUM(weight * exp(-ln(2) * EXTRACT(EPOCH FROM (now() - reported_at)) / 1209600)) AS decayed_volume
FROM reports
GROUP BY number_hash;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reputation_mv_hash ON reputation_mv (number_hash);
