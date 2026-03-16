#!/bin/bash
# Cineflow Full Integration Test
# Run after every deploy

BASE="https://aitendencijos-platform-urbietis23s-projects.vercel.app"
PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "ok" ]; then
    echo "  ✅ $name"
    PASS=$((PASS+1))
  else
    echo "  ❌ $name — $result"
    FAIL=$((FAIL+1))
  fi
}

echo "═══ CINEFLOW INTEGRATION TEST ═══"
echo ""

# ── API ENDPOINTS ──
echo "📡 API Endpoints:"

# whisper-key
R=$(curl -s "$BASE/api/whisper-key")
if echo "$R" | grep -q '"k"'; then check "GET /api/whisper-key" "ok"
else check "GET /api/whisper-key" "missing key: $R"; fi

# music
R=$(curl -s "$BASE/api/music")
if echo "$R" | grep -q '"tracks"'; then check "GET /api/music" "ok"
else check "GET /api/music" "no tracks: $R"; fi

# broll search
R=$(curl -s -X POST "$BASE/api/broll" -H "Content-Type: application/json" -d '{"query":"nature","perPage":2}')
if echo "$R" | grep -q '"clips"'; then check "POST /api/broll" "ok"
else check "POST /api/broll" "no clips: $(echo $R | head -c 200)"; fi

# analyze
R=$(curl -s -X POST "$BASE/api/analyze" -H "Content-Type: application/json" -d '{"transcript":"Sveiki, šiandien kalbėsime apie verslą.","duration":60}')
if echo "$R" | grep -q "broll\|zoom\|music\|Suggestion\|error"; then check "POST /api/analyze" "ok (response received)"
else check "POST /api/analyze" "unexpected: $(echo $R | head -c 200)"; fi

# smart-features: hooks
R=$(curl -s -X POST "$BASE/api/smart-features" -H "Content-Type: application/json" -d '{"transcript":"Sveiki visi, šiandien papasakosiu kaip uždirbti pinigų internetu.","feature":"hooks"}')
if echo "$R" | grep -q '"hooks"'; then check "POST /api/smart-features (hooks)" "ok"
else check "POST /api/smart-features (hooks)" "$(echo $R | head -c 200)"; fi

# smart-features: chapters
R=$(curl -s -X POST "$BASE/api/smart-features" -H "Content-Type: application/json" -d '{"transcript":"Pirma tema yra marketingas. Antra tema yra pardavimai. Trečia tema yra klientų aptarnavimas.","feature":"chapters"}')
if echo "$R" | grep -q '"chapters"'; then check "POST /api/smart-features (chapters)" "ok"
else check "POST /api/smart-features (chapters)" "$(echo $R | head -c 200)"; fi

# smart-features: virality
R=$(curl -s -X POST "$BASE/api/smart-features" -H "Content-Type: application/json" -d '{"transcript":"Ar žinojai kad 90% verslininkų daro šią klaidą?","feature":"virality"}')
if echo "$R" | grep -q '"score"'; then check "POST /api/smart-features (virality)" "ok"
else check "POST /api/smart-features (virality)" "$(echo $R | head -c 200)"; fi

# smart-features: seo
R=$(curl -s -X POST "$BASE/api/smart-features" -H "Content-Type: application/json" -d '{"transcript":"Šiandien kalbėsime apie socialinių tinklų marketingą.","feature":"seo"}')
if echo "$R" | grep -q '"title"'; then check "POST /api/smart-features (seo)" "ok"
else check "POST /api/smart-features (seo)" "$(echo $R | head -c 200)"; fi

# smart-features: translate
R=$(curl -s -X POST "$BASE/api/smart-features" -H "Content-Type: application/json" -d '{"transcript":"Sveiki visi","feature":"translate","targetLang":"en","subtitles":[{"text":"Sveiki visi"}]}')
if echo "$R" | grep -q '"translation"'; then check "POST /api/smart-features (translate)" "ok"
else check "POST /api/smart-features (translate)" "$(echo $R | head -c 200)"; fi

# smart-features: highlight
R=$(curl -s -X POST "$BASE/api/smart-features" -H "Content-Type: application/json" -d '{"transcript":"Pradžia. Tada svarbus momentas. Ir pabaiga.","feature":"highlight","duration":30}')
if echo "$R" | grep -q '"clips"'; then check "POST /api/smart-features (highlight)" "ok"
else check "POST /api/smart-features (highlight)" "$(echo $R | head -c 200)"; fi

# smart-features: thumbnail
R=$(curl -s -X POST "$BASE/api/smart-features" -H "Content-Type: application/json" -d '{"transcript":"Kaip uždirbti pinigų internetu per 30 dienų","feature":"thumbnail"}')
if echo "$R" | grep -q '"suggestions"'; then check "POST /api/smart-features (thumbnail)" "ok"
else check "POST /api/smart-features (thumbnail)" "$(echo $R | head -c 200)"; fi

# broll-generate (may take long, just check it responds)
R=$(curl -s --max-time 10 -X POST "$BASE/api/broll-generate" -H "Content-Type: application/json" -d '{"prompt":"business meeting in modern office","model":"kling"}')
if echo "$R" | grep -q "requestId\|error\|video"; then check "POST /api/broll-generate" "ok (endpoint responds)"
else check "POST /api/broll-generate" "$(echo $R | head -c 200)"; fi

# ── PAGE LOADS ──
echo ""
echo "🌐 Page Loads:"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard")
if [ "$R" = "200" ]; then check "Dashboard page" "ok"
else check "Dashboard page" "HTTP $R"; fi

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/")
if [ "$R" = "200" ]; then check "Landing page" "ok"
else check "Landing page" "HTTP $R"; fi

# ── SUMMARY ──
echo ""
echo "═══════════════════════════════"
echo "  ✅ Passed: $PASS"
echo "  ❌ Failed: $FAIL"
echo "═══════════════════════════════"

if [ $FAIL -gt 0 ]; then exit 1; fi
