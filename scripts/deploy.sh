#!/usr/bin/env bash
#
# scripts/deploy.sh — Deploy do AntiSpam BR via EAS Build
#
# Uso:
#   ./scripts/deploy.sh preview            # APK interno p/ testes (Android)
#   ./scripts/deploy.sh android            # build de produção Android (AAB) + auto-submit
#   ./scripts/deploy.sh ios                # build de produção iOS + auto-submit
#   ./scripts/deploy.sh all                # produção Android + iOS
#   ./scripts/deploy.sh update "mensagem"  # OTA update (JS only, branch production)
#   ./scripts/deploy.sh submit-android     # envia AAB p/ Play Console (track internal)
#   ./scripts/deploy.sh submit-ios         # envia build p/ App Store Connect
#   ./scripts/deploy.sh ci                 # dispara produção sem esperar (p/ CI)
#
# Opções:
#   --skip-checks    pula typecheck e testes
#   --no-wait        não espera o build terminar (apenas dispara)
#
# Variáveis de ambiente:
#   DRY_RUN=1        mostra os comandos sem executar nada (não roda checks)
#
# Pré-requisitos (uma vez):
#   1. npx eas-cli login
#   2. npx eas-cli build:configure   (gera projectId no app.json + credenciais)
#   3. submit: preencher credenciais no eas.json

set -euo pipefail

cd "$(dirname "$0")/.."

SKIP_CHECKS=false
NO_WAIT=false
COMMAND=""
DRY_RUN="${DRY_RUN:-false}"
[[ "$DRY_RUN" == "1" ]] && DRY_RUN="true"
EXTRA_ARGS=()

# ---------- parse args ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-checks) SKIP_CHECKS=true; shift ;;
    --no-wait)     NO_WAIT=true; shift ;;
    -h|--help)
      grep '^#' "$0" | tail -n +2 | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      if [[ -z "$COMMAND" ]]; then
        COMMAND="$1"
      else
        EXTRA_ARGS+=("$1")
      fi
      shift
      ;;
  esac
done

if [[ -z "$COMMAND" ]]; then
  echo "❌ Uso: ./scripts/deploy.sh <preview|android|ios|all|update|submit-android|submit-ios|ci>"
  exit 1
fi

VALID_COMMANDS=(preview android ios all update submit-android submit-ios ci)
if [[ ! " ${VALID_COMMANDS[*]} " =~ " $COMMAND " ]]; then
  echo "❌ Comando desconhecido: $COMMAND"
  echo "   Válidos: ${VALID_COMMANDS[*]}"
  exit 1
fi

run() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

# ---------- ambiente ----------
# eas-cli: preferir binário global (evita download a cada chamada via bunx/npx)
if command -v eas >/dev/null 2>&1; then
  EAS_BIN="eas"
elif command -v bunx >/dev/null 2>&1; then
  EAS_BIN="bunx eas-cli"
else
  EAS_BIN="npx eas-cli"
fi

# runner p/ ferramentas locais do projeto (tsc, jest)
if command -v bunx >/dev/null 2>&1; then
  RUNNER="bunx"
else
  RUNNER="npx"
fi

echo "==> eas-cli: $EAS_BIN"

# ---------- gates (auth + projeto) ----------
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] pulando whoami e projectId"
else
  if ! $EAS_BIN whoami >/dev/null 2>&1; then
    echo "❌ Não autenticado no EAS. Rode: npx eas-cli login"
    exit 1
  fi

  PROJECT_ID="$(node -e "try{console.log(require('./app.json').expo.extra?.eas?.projectId||'')}catch(e){console.log('')}")"
  if [[ -z "$PROJECT_ID" ]]; then
    echo "❌ app.json não tem projectId. Rode: npx eas-cli build:configure"
    exit 1
  fi
  echo "✅ projectId: $PROJECT_ID"
fi

# ---------- checks (typecheck + testes) ----------
if [[ "$SKIP_CHECKS" == "true" ]]; then
  echo "⚠️  --skip-checks: pulando typecheck e testes"
elif [[ "$DRY_RUN" == "true" ]]; then
  echo "[dry-run] $RUNNER tsc --noEmit"
  echo "[dry-run] $RUNNER jest --ci --silent"
else
  echo "==> Typecheck..."
  $RUNNER tsc --noEmit

  echo "==> Testes (jest)..."
  $RUNNER jest --ci --silent
  echo "✅ Checks OK"
fi

# ---------- comandos ----------
WAIT_FLAG=()
if [[ "$NO_WAIT" == "true" ]]; then
  WAIT_FLAG=(--no-wait)
fi

case "$COMMAND" in
  preview)
    echo "==> Build preview (APK Android interno)..."
    run $EAS_BIN build --platform android --profile preview --non-interactive "${WAIT_FLAG[@]:-}"
    ;;
  android)
    echo "==> Build produção Android (AAB) + auto-submit..."
    run $EAS_BIN build --platform android --profile production --non-interactive --auto-submit "${WAIT_FLAG[@]:-}"
    ;;
  ios)
    echo "==> Build produção iOS + auto-submit..."
    run $EAS_BIN build --platform ios --profile production --non-interactive --auto-submit "${WAIT_FLAG[@]:-}"
    ;;
  all)
    echo "==> Build produção Android + iOS..."
    run $EAS_BIN build --platform all --profile production --non-interactive "${WAIT_FLAG[@]:-}"
    ;;
  update)
    echo "==> OTA Update (EAS Update)..."
    MSG=""
    if [[ -n "${EXTRA_ARGS[*]:-}" ]]; then
      MSG="${EXTRA_ARGS[*]}"
    fi
    if [[ -z "$MSG" ]]; then
      MSG="deploy $(date +%Y-%m-%d-%H%M)"
    fi
    run $EAS_BIN update --branch production --message "$MSG"
    ;;
  submit-android)
    echo "==> Submit Android (Play Console, track internal)..."
    run $EAS_BIN submit --platform android --latest --non-interactive
    ;;
  submit-ios)
    echo "==> Submit iOS (App Store Connect)..."
    run $EAS_BIN submit --platform ios --latest --non-interactive
    ;;
  ci)
    echo "==> Disparando builds produção (CI mode, sem esperar)..."
    run $EAS_BIN build --platform all --profile production --non-interactive --no-wait
    ;;
esac

if [[ "$DRY_RUN" == "true" ]]; then
  echo "✅ Dry-run de '$COMMAND' OK (nada foi executado)."
else
  echo "✅ Deploy '$COMMAND' concluído."
fi
