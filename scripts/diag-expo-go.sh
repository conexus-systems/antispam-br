#!/usr/bin/env bash
# Diagnóstico E2E — evidências do que acontece dentro do Expo Go.
set -uo pipefail
SDK="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
EMULATOR="$SDK/emulator/emulator"; ADB="$SDK/platform-tools/adb"
trap 'kill $METRO_PID $EMU_PID 2>/dev/null; $ADB emu kill >/dev/null 2>&1' EXIT

"$EMULATOR" -avd test34 -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect -no-snapshot >/tmp/emu.log 2>&1 &
EMU_PID=$!
"$ADB" wait-for-device
for i in $(seq 1 60); do B=$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r'); [ "$B" = "1" ] && break; sleep 3; done
echo "boot: $B"
npx expo start --port 8081 --offline > /tmp/metro.log 2>&1 &
METRO_PID=$!
for i in $(seq 1 60); do curl -s http://localhost:8081/status 2>/dev/null | grep -q "packager-status:running" && break; sleep 2; done
echo "metro: $(curl -s http://localhost:8081/status)"

"$ADB" install -r -g "$HOME/Downloads/ExpoGo.apk" >/dev/null 2>&1
"$ADB" logcat -c
echo "--- abrindo raiz exp://10.0.2.2:8081 ---"
"$ADB" shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081" host.exp.exponent
sleep 35
echo "--- metro.log (últimas linhas) ---"
tail -6 /tmp/metro.log
echo "--- logcat ReactNativeJS ---"
"$ADB" logcat -d -s ReactNativeJS:* 2>/dev/null | tail -15
echo "--- logcat erros ---"
"$ADB" logcat -d 2>/dev/null | grep -iE "AndroidRuntime|FATAL|ExpoModulesHost|UnableToResolve|Unhandled" | tail -12

echo "--- abrindo ROTA com /--/ ---"
"$ADB" logcat -c
"$ADB" shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8081/--/simulate?number=%2B551140028922" host.exp.exponent
sleep 30
echo "--- metro.log depois da rota ---"
tail -4 /tmp/metro.log
echo "--- logcat ReactNativeJS (rota) ---"
"$ADB" logcat -d -s ReactNativeJS:* 2>/dev/null | tail -20
