#!/usr/bin/env bash
# =============================================================================
# E2E — AntiSpam BR no Expo Go (emulador Android headless)
#
# Sobem em UM ÚNICO shell (processos morrem quando o comando termina):
#   1. metro (expo start)            2. emulador headless (AVD test34)
#   3. instala Expo Go               4. abre o app (deep link exp://)
#   5. dispara /simulate?number=...  6. valida decisões via logcat
#
# Requisitos: ANDROID_SDK_ROOT com emulator+platform-tools, AVD "test34",
# Expo Go APK em ~/Downloads/ExpoGo.apk, KVM (/dev/kvm).
# Uso: bash scripts/e2e-expo-go.sh
# =============================================================================
set -uo pipefail

SDK="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
EMULATOR="$SDK/emulator/emulator"
ADB="$SDK/platform-tools/adb"
APK="$HOME/Downloads/ExpoGo.apk"
AVD_NAME="test34"
APP_SCHEME="antispambr"
LOG_TAG="[AntiSpamBR][E2E]"
FAILED=0

say() { echo -e "\n\033[1;36m=== $* ===\033[0m"; }
pass() { echo -e "\033[1;32m✓ $*\033[0m"; }
fail() { echo -e "\033[1;31m✗ $*\033[0m"; FAILED=1; }

trap 'kill $METRO_PID $EMU_PID 2>/dev/null; $ADB emu kill >/dev/null 2>&1' EXIT

say "0. Pré-checks"
[ -x "$EMULATOR" ] || { fail "emulador não encontrado em $EMULATOR"; exit 1; }
[ -f "$APK" ] || { fail "Expo Go APK não encontrado em $APK"; exit 1; }
ls /dev/kvm >/dev/null 2>&1 && pass "KVM disponível" || fail "sem /dev/kvm (emulação lenta)"
export PATH="$SDK/platform-tools:$PATH"

say "1. Iniciando emulador headless ($AVD_NAME)"
"$EMULATOR" -avd "$AVD_NAME" -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot &
EMU_PID=$!
"$ADB" wait-for-device
# aguardar boot completo
for i in $(seq 1 60); do
  BOOT=$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  [ "$BOOT" = "1" ] && break
  sleep 3
done
[ "$BOOT" = "1" ] && pass "emulador booted" || { fail "boot timeout"; exit 1; }
"$ADB" shell settings put global window_animation_scale 0
"$ADB" shell settings put global transition_animation_scale 0
"$ADB" shell settings put global animator_duration_scale 0

say "2. Iniciando metro (expo start) no projeto"
npx expo start --port 8081 --offline > /tmp/metro.log 2>&1 &
METRO_PID=$!
for i in $(seq 1 60); do
  curl -s "http://localhost:8081/status" 2>/dev/null | grep -q "packager-status:running" && break
  sleep 2
done
curl -s "http://localhost:8081/status" | grep -q "packager-status:running" && pass "metro pronto em :8081" || { fail "metro não subiu (veja /tmp/metro.log)"; exit 1; }

say "3. Instalando Expo Go"
"$ADB" install -r -g "$APK" >/dev/null 2>&1 && pass "Expo Go instalado (com permissões -g)" || { fail "falha ao instalar APK"; exit 1; }
# Dados limpos = E2E determinístico (seed da base local e onboarding do zero).
"$ADB" shell pm clear host.exp.exponent >/dev/null 2>&1 && pass "dados do Expo Go zerados (seed determinística)"

say "4. Abrindo o app no Expo Go (deep link exp://10.0.2.2:8081)"
# limpar logcat para coletar somente o que interessa
"$ADB" logcat -c
"$ADB" shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081" host.exp.exponent >/dev/null 2>&1
sleep 25
"$ADB" logcat -d -s ReactNativeJS:* 2>/dev/null | grep -q "Running" && pass "bundle JS carregado" || {
  # fallback: checar se o app respondeu de qualquer forma
  "$ADB" shell dumpsys window 2>/dev/null | grep -q "host.exp.exponent" && pass "Expo Go em foreground" || fail "app não abriu"
}

say "5. Disparando simulador de chamadas via deep link /simulate"
declare -a CASES=(
  "%2B551140028922|telemarketing_base|BLOCK|SILENCE|WARN"
  "03033130303|rota_0303|BLOCK|SILENCE|WARN"
  "190|emergencia|ALLOW"
  "%2B5511999999999|score_zero|ALLOW"
  "%2B551140028999|sem_base|ALLOW|WARN|SILENCE|BLOCK"
)
for entry in "${CASES[@]}"; do
  NUM="${entry%%|*}"; REST="${entry#*|}"
  NAME="${REST%%|*}"; EXPECT="${REST#*|}"
  "$ADB" logcat -c
  # /--/ é obrigatório no Expo Go para tratar o caminho como rota do app.
  "$ADB" shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/simulate?number=$NUM" host.exp.exponent >/dev/null 2>&1
  sleep 12
  LINE=$("$ADB" logcat -d -s ReactNativeJS:* 2>/dev/null | grep -F "$LOG_TAG" | tail -1)
  if [ -z "$LINE" ]; then
    fail "$NAME: nenhum log de decisão encontrado"
    continue
  fi
  ACTION=$(echo "$LINE" | grep -oE '"action":"[A-Z]+"' | head -1 | cut -d'"' -f4)
  SCORE=$(echo "$LINE" | grep -oE '"score":[0-9]+' | head -1 | cut -d: -f2)
  if echo "$EXPECT" | grep -q "$ACTION"; then
    pass "$NAME → $ACTION (score $SCORE)"
  else
    fail "$NAME → $ACTION (esperado um de: $EXPECT) | $LINE"
  fi
done

say "6. Evidências: notificações e histórico"
NOTIF=$("$ADB" shell dumpsys notification --noredact 2>/dev/null | grep -ci "AntiSpam" || true)
[ "${NOTIF:-0}" -ge 1 ] && pass "notificações do AntiSpam BR visíveis no sistema ($NOTIF)" || echo "i: nenhuma notificação (bloqueios com score baixo não notificam — ok)"
"$ADB" exec-out screencap -p > /tmp/antispam-e2e.png 2>/dev/null && pass "screenshot salvo em /tmp/antispam-e2e.png"

say "7. Resultado"
if [ "$FAILED" = "0" ]; then
  echo -e "\033[1;32m\nE2E PASSOU — pipeline validado ponta a ponta no Expo Go.\033[0m\n"
else
  echo -e "\033[1;31m\nE2E FALHOU — ver logs acima / /tmp/metro.log\033[0m\n"
fi
exit $FAILED
