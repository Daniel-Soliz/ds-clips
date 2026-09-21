#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
FIXTURE="${FIXTURE:-tests/fixtures/sample.mp4}"

if [[ ! -f "$FIXTURE" ]]; then
  echo "Fixture ausente: $FIXTURE"
  echo "Use scripts/generate_fixture.sh para criar o vídeo de teste."
  exit 1
fi

echo "[e2e] enviando vídeo real..."
RESP=$(curl -fsS -X POST "$BASE_URL/api/projects/upload"   -F "captionStyle=neon"   -F "file=@$FIXTURE;type=video/mp4")

PROJECT_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["projectId"])' <<< "$RESP")
echo "[e2e] projectId=$PROJECT_ID"

for i in $(seq 1 180); do
  JSON=$(curl -fsS "$BASE_URL/api/projects/$PROJECT_ID")
  STATUS=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<< "$JSON")
  STAGE=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["stage"])' <<< "$JSON")
  PROGRESS=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["progress"])' <<< "$JSON")
  echo "[e2e] status=$STATUS stage=$STAGE progress=$PROGRESS"

  if [[ "$STATUS" == "COMPLETED" ]]; then
    CLIP_URL=$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["clips"][0]["downloadUrl"])' <<< "$JSON")
    curl -fsS "$BASE_URL$CLIP_URL" -o tests/fixtures/generated-clip.mp4
    ffprobe -v error -show_entries format=duration -of default=nw=1 tests/fixtures/generated-clip.mp4
    echo "[e2e] OK: tests/fixtures/generated-clip.mp4"
    exit 0
  fi

  if [[ "$STATUS" == "FAILED" ]]; then
    echo "$JSON"
    exit 1
  fi
  sleep 5
done

echo "[e2e] timeout"
exit 1
