#!/usr/bin/env bash
set -euo pipefail

mkdir -p tests/fixtures
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

make_video() {
  local name="$1"
  local voice="$2"
  local rate="$3"
  local text="$4"
  local bg="$5"

  printf '%s\n' "$text" > "$TMP/$name.txt"
  espeak -v "$voice" -s "$rate" -f "$TMP/$name.txt" -w "$TMP/$name.wav"
  local duration
  duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/$name.wav")

  ffmpeg -y     -f lavfi -i "color=c=$bg:size=640x360:rate=24"     -vf "drawtext=text='$name':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=(h-text_h)/2"     -i "$TMP/$name.wav"     -t "$duration"     -c:v libx264 -preset veryfast -crf 30 -pix_fmt yuv420p     -c:a aac -b:a 64k -shortest     "tests/fixtures/$name.mp4"
}

make_video "podcast" "pt-br" "145" "Hoje eu quero falar sobre um erro comum de quem tenta crescer criando conteúdo. Muita gente pensa que precisa publicar todos os dias, mas esquece que a mensagem precisa ser clara. O segredo não é postar mais. O segredo é entender qual parte da conversa prende atenção e qual parte entrega uma resposta. Quando você encontra um trecho que começa com uma dúvida real, desenvolve uma ideia e termina com uma conclusão, você tem um bom clipe. Outra coisa importante é evitar introduções longas. Comece perto do ponto principal. Isso melhora o ritmo e ajuda quem está assistindo a decidir rapidamente se vale a pena continuar. No fim, consistência importa, mas clareza e contexto importam ainda mais." "#18202b"

make_video "aula" "pt-br" "142" "Vamos entender uma ideia simples sobre análise de dados. Imagine que uma empresa vende todos os dias e precisa acompanhar o resultado por vendedor. Primeiro você organiza os dados. Depois verifica se existem duplicidades, valores ausentes ou datas incorretas. Em seguida cria indicadores que respondem perguntas específicas. Qual vendedor vendeu mais, qual produto caiu e qual região melhorou. Um erro muito comum é criar um painel bonito antes de validar a base. Isso pode gerar decisões erradas. A melhor prática é conferir a fonte, testar as regras de negócio e só depois construir a visualização. Assim o dashboard deixa de ser apenas uma tela e passa a apoiar decisões reais." "#1d2b1f"

make_video "vlog" "pt-br" "150" "Hoje eu resolvi testar uma mudança simples na minha rotina. Em vez de começar o dia olhando mensagem e rede social, eu escolhi uma tarefa importante e fiquei nela até terminar. No começo parece pouco, mas a diferença foi grande. Eu percebi que o problema não era falta de tempo. Era troca constante de atenção. Quando você muda de tarefa toda hora, perde alguns minutos para recuperar o contexto. Minha dica é escolher uma prioridade clara, deixar notificações de lado por um período e medir o que realmente conseguiu concluir. Não precisa ser perfeito. O objetivo é reduzir distrações e terminar algo importante antes de abrir espaço para o restante do dia." "#2b1d24"

echo "Fixtures criadas:"
ls -lh tests/fixtures/*.mp4
