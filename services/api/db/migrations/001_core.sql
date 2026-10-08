-- AntiSpam BR — modelo do M2 (docs/ARCHITECTURE.md §Backend, ADR 0006).
-- Privacidade: nenhum IP bruto, nenhum token bruto, nenhum dado de agenda.

CREATE TABLE categories (
  code     smallint PRIMARY KEY,
  id       text NOT NULL UNIQUE,
  severity numeric(3, 2) NOT NULL CHECK (severity BETWEEN 0 AND 1),
  abuse    boolean NOT NULL
);

INSERT INTO categories (code, id, severity, abuse) VALUES
  (0, 'OTHER', 0.70, true), (1, 'TELEMARKETING', 0.80, true), (2, 'ROBOCALL', 0.85, true),
  (3, 'SILENT_CALL', 0.80, true), (4, 'COLLECTION', 0.75, true), (5, 'BANK_SCAM', 1.00, true),
  (6, 'PIX_SCAM', 1.00, true), (7, 'PHISHING', 1.00, true), (8, 'DELIVERY_SCAM', 1.00, true),
  (9, 'FAKE_SUPPORT', 1.00, true), (10, 'LOAN', 0.85, true), (11, 'SURVEY', 0.60, true),
  (12, 'SPOOFING', 0.95, true), (13, 'LEGITIMATE', 0.00, false);

CREATE TABLE sources (
  id          text PRIMARY KEY,
  description text NOT NULL,
  trust       numeric(3, 2) NOT NULL CHECK (trust BETWEEN 0 AND 1)
);

INSERT INTO sources (id, description, trust) VALUES
  ('USER_REPORT', 'Denúncia de dispositivo registrado', 1.00),
  ('USER_VOTE', 'Confirmação/contestação de denúncia existente', 1.00),
  ('MODERATION', 'Decisão de moderador', 1.00);

-- Prefixos com regra própria (0303 telemarketing, utilidade pública…). never_block vence tudo.
CREATE TABLE prefixes (
  prefix      text PRIMARY KEY CHECK (prefix ~ '^\+\d{2,14}$'),
  kind        text NOT NULL,
  never_block boolean NOT NULL DEFAULT false,
  description text NOT NULL
);

INSERT INTO prefixes (prefix, kind, never_block, description) VALUES
  ('+55303', 'TELEMARKETING', false, '0303: prefixo obrigatório de telemarketing ativo (Anatel)');

CREATE TABLE organizations (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  cnpj        text UNIQUE CHECK (cnpj ~ '^\d{14}$'),
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE phone_numbers (
  e164            text PRIMARY KEY CHECK (e164 ~ '^\+\d{8,15}$'),
  -- COLLATE "C": índice btree atende LIKE 'abcde%' (consulta k-anônima por prefixo de hash)
  sha256          text COLLATE "C" NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  kind            text NOT NULL,
  ddd             text,
  shard           text NOT NULL,
  organization_id bigint REFERENCES organizations (id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- "UserReputation": reputação é do dispositivo pseudônimo, não de pessoa.
CREATE TABLE devices (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_sha256      bytea NOT NULL UNIQUE,
  network_hash      text NOT NULL,
  agreements        integer NOT NULL DEFAULT 0,
  disagreements     integer NOT NULL DEFAULT 0,
  quarantined_at    timestamptz,
  quarantine_reason text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pow_challenges_used (
  challenge_sha256 bytea PRIMARY KEY,
  used_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id         bigint GENERATED ALWAYS AS IDENTITY,
  e164       text NOT NULL,
  device_id  bigint NOT NULL,
  category   text NOT NULL,
  source     text NOT NULL,
  -- texto livre: só a moderação lê; some junto com a partição (retenção de 14 meses)
  comment    text CHECK (char_length(comment) <= 280),
  parent_id  bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE INDEX reports_e164_created_idx ON reports (e164, created_at);
CREATE INDEX reports_device_created_idx ON reports (device_id, created_at);
CREATE INDEX reports_id_idx ON reports (id);

CREATE FUNCTION ensure_report_partitions(months_ahead integer) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  m date := (date_trunc('month', now()) - interval '1 month')::date;
  name text;
BEGIN
  FOR i IN 0..months_ahead + 1 LOOP
    name := format('reports_y%sm%s', to_char(m, 'YYYY'), to_char(m, 'MM'));
    IF to_regclass(name) IS NULL THEN
      EXECUTE format('CREATE TABLE %I PARTITION OF reports FOR VALUES FROM (%L) TO (%L)',
                     name, m, (m + interval '1 month')::date);
    END IF;
    m := (m + interval '1 month')::date;
  END LOOP;
END $$;

SELECT ensure_report_partitions(3);

-- Retenção: denúncias (e seus comentários) mais antigas que keep_months saem inteiras.
CREATE FUNCTION drop_old_report_partitions(keep_months integer) RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  cutoff text := format('reports_y%s', to_char(date_trunc('month', now()) - make_interval(months => keep_months), 'YYYY"m"MM'));
  part record;
  dropped integer := 0;
BEGIN
  FOR part IN
    SELECT c.relname FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.relname = 'reports' AND p.relnamespace = current_schema()::regnamespace AND c.relname < cutoff
  LOOP
    EXECUTE format('DROP TABLE %I', part.relname);
    dropped := dropped + 1;
  END LOOP;
  RETURN dropped;
END $$;

CREATE TABLE report_nonces (
  device_id  bigint NOT NULL,
  nonce      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, nonce)
);
CREATE INDEX report_nonces_created_idx ON report_nonces (created_at);

CREATE TABLE contests (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  e164       text NOT NULL REFERENCES phone_numbers (e164),
  device_id  bigint NOT NULL REFERENCES devices (id),
  status     text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  -- peso do autor na abertura (reporterWeight); só contestação qualificada suspende publicação
  weight     real NOT NULL CHECK (weight BETWEEN 0 AND 1),
  comment    text CHECK (char_length(comment) <= 280),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE UNIQUE INDEX contests_one_pending_per_device ON contests (e164, device_id) WHERE status = 'PENDING';
CREATE INDEX contests_pending_idx ON contests (weight DESC, created_at) WHERE status = 'PENDING';

-- Append-only: toda decisão humana fica auditável.
CREATE TABLE moderation_decisions (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  subject_type text NOT NULL CHECK (subject_type IN ('CONTEST', 'DEVICE', 'NUMBER')),
  subject_id   text NOT NULL,
  decision     text NOT NULL,
  reason       text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  moderator    text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reputations (
  e164               text PRIMARY KEY REFERENCES phone_numbers (e164),
  score              smallint NOT NULL CHECK (score BETWEEN 0 AND 100),
  label              text NOT NULL,
  category           text,
  weighted_reporters real NOT NULL,
  contest_weight     real NOT NULL,
  distinct_reporters integer NOT NULL,
  insufficient       boolean NOT NULL,
  burst_quarantine   boolean NOT NULL,
  disputed           boolean NOT NULL,
  verified_org       boolean NOT NULL,
  publishable        boolean NOT NULL,
  blocked_by         text[] NOT NULL,
  factors            jsonb NOT NULL,
  first_report_at    timestamptz,
  last_report_at     timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reputations_publishable_idx ON reputations (e164) WHERE publishable;
CREATE INDEX reputations_score_idx ON reputations (score) WHERE score >= 20;
CREATE INDEX reputations_updated_idx ON reputations (updated_at);

CREATE TABLE campaigns (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pattern    text NOT NULL UNIQUE,
  category   text NOT NULL,
  numbers    integer NOT NULL,
  first_seen timestamptz NOT NULL,
  last_seen  timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dataset_versions (
  version      bigint PRIMARY KEY,
  created_at   timestamptz NOT NULL,
  expires_at   timestamptz NOT NULL,
  key_id       text NOT NULL,
  record_count integer NOT NULL,
  manifest     bytea NOT NULL,
  signature    text NOT NULL
);

CREATE TABLE dataset_files (
  version bigint NOT NULL REFERENCES dataset_versions (version),
  path    text NOT NULL,
  sha256  text NOT NULL,
  bytes   bytea NOT NULL,
  PRIMARY KEY (version, path)
);

-- Estatísticas da frota recalculadas na manutenção (ex.: p99 de ações diárias por dispositivo).
CREATE TABLE fleet_stats (
  key        text PRIMARY KEY,
  value      double precision NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNLOGGED TABLE rate_counters (
  key          text NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer NOT NULL,
  PRIMARY KEY (key, window_start)
);
