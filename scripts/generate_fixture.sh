#!/usr/bin/env bash
set -euo pipefail
mkdir -p tests/fixtures
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/text.txt" <<'EOF'
Hoje eu quero mostrar uma ideia simples sobre produtividade e criação de conteúdo.
Muitas pessoas tentam fazer tudo ao mesmo tempo e acabam sem terminar nada.
O melhor caminho é escolher uma tarefa importante, eliminar distrações e trabalhar nela até concluir.
Quando você grava um vídeo longo, existe muito conteúdo útil escondido em pequenos momentos.
Uma boa edição encontra esses trechos, começa com uma frase forte, mantém o contexto e termina com uma conclusão completa.
Assim, um único vídeo pode se transformar em vários conteúdos curtos para diferentes redes sociais.
O segredo não é cortar por cortar.
O segredo é preservar a mensagem, melhorar o ritmo e entregar valor rapidamente para quem está assistindo.
Essa é a ideia principal que queremos testar neste vídeo de exemplo.
EOF

espeak -v pt-br -s 145 -f "$TMP/text.txt" -w "$TMP/speech.wav"
DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/speech.wav")

ffmpeg -y   -f lavfi -i testsrc2=size=320x180:rate=24   -i "$TMP/speech.wav"   -t "$DURATION"   -c:v libx264 -preset veryfast -crf 32 -pix_fmt yuv420p   -c:a aac -b:a 64k -shortest   tests/fixtures/sample.mp4

echo "Criado tests/fixtures/sample.mp4"
