#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
mkdir -p tests/proof

run_case() {
  local name="$1"
  local fixture="tests/fixtures/$name.mp4"

  echo "===== E2E $name ====="
  RESP=$(curl -fsS -X POST "$BASE_URL/api/projects/upload"     -F "captionStyle=neon"     -F "rightsAccepted=true"     -F "file=@$fixture;type=video/mp4")

  PROJECT_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["projectId"])' <<< "$RESP")
  echo "[$name] projectId=$PROJECT_ID"

  for i in $(seq 1 240); do
    JSON=$(curl -fsS "$BASE_URL/api/projects/$PROJECT_ID")
    STATUS=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])' <<< "$JSON")
    STAGE=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["stage"])' <<< "$JSON")
    PROGRESS=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["progress"])' <<< "$JSON")
    echo "[$name] status=$STATUS stage=$STAGE progress=$PROGRESS"

    if [[ "$STATUS" == "COMPLETED" ]]; then
      CLIP_URL=$(python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["clips"][0]["downloadUrl"])' <<< "$JSON")
      curl -fsS "$BASE_URL$CLIP_URL" -o "tests/proof/$name-clip.mp4"
      ffprobe -v error -show_entries stream=width,height,codec_name -show_entries format=duration -of json "tests/proof/$name-clip.mp4" > "tests/proof/$name-ffprobe.json"
      echo "$JSON" > "tests/proof/$name-project.json"
      echo "[$name] OK"
      return
    fi

    if [[ "$STATUS" == "FAILED" ]]; then
      echo "$JSON" > "tests/proof/$name-project.json"
      echo "[$name] FAILED"
      cat "tests/proof/$name-project.json"
      exit 1
    fi
    sleep 5
  done

  echo "[$name] TIMEOUT"
  exit 1
}

run_case podcast
run_case aula
run_case vlog

echo "===== PROVAS ====="
ls -lh tests/proof
