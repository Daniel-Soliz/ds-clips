# DS Clips — Pipeline v1

A branch `pipeline-v1` contém a reconstrução funcional do DS Clips com Next.js, PostgreSQL/Prisma, Redis/BullMQ, worker real de mídia, FFmpeg, yt-dlp, faster-whisper, Claude e legendas ASS.

> A versão pública atual em GitHub Pages continua intacta na branch `main`. O pipeline novo fica isolado até o teste E2E passar.

## Credencial necessária

Copie `.env.example` para `.env` e preencha:

- `ANTHROPIC_API_KEY` — obrigatório para a escolha semântica dos melhores momentos. Crie em https://console.anthropic.com/settings/keys
- `ANTHROPIC_MODEL` — padrão do projeto: `claude-sonnet-5`.

Whisper é local via `faster-whisper`; não exige chave OpenAI.

## Subir tudo

```bash
cp .env.example .env
# edite .env e preencha ANTHROPIC_API_KEY
docker compose up --build
```

App: http://localhost:3000

Serviços:
- `web`: Next.js + API
- `worker`: BullMQ + FFmpeg + yt-dlp + Whisper + Claude + OpenCV + ASS
- `postgres`: metadados de projetos e clipes
- `redis`: fila e eventos em tempo real

## Pipeline principal

1. Upload com progresso via XHR ou URL via yt-dlp.
2. Validação de duração/tamanho.
3. Extração WAV 16 kHz com FFmpeg.
4. Transcrição real com faster-whisper e timestamp por palavra.
5. Transcrição dividida em blocos e enviada ao Claude.
6. Resposta JSON validada com Zod; até 3 tentativas se inválida.
7. Clipes de 20–90s sem sobreposição, ordenados por nota.
8. Corte H.264/AAC.
9. Reenquadramento 9:16 com OpenCV e suavização do centro do rosto.
10. Fallback de fundo desfocado quando o recorte por rosto não é adequado.
11. Legendas palavra por palavra com ASS karaoke.
12. Cinco estilos: `neon`, `clean`, `pop`, `cinema`, `minimal`.
13. MP4 final disponível para preview/download.
14. SSE reporta `downloading`, `transcribing`, `analyzing`, `rendering`, `completed` ou `failed`.
15. Falhas mostram motivo e endpoint de retry.

## Estrutura

```text
src/
  app/
    api/
      projects/upload
      projects/import
      projects/[id]
      projects/[id]/events
      projects/[id]/retry
      clips/[id]
      clips/[id]/file
    page.tsx
  lib/
    db.ts
    queue.ts
    redis.ts
    progress.ts
    schemas.ts
    storage.ts
worker/
  index.ts
  process.ts
scripts/
  transcribe.py
  reframe.py
  make_ass.py
  generate_fixture.sh
  e2e.sh
prisma/
  schema.prisma
tests/
  schemas.test.ts
docker-compose.yml
Dockerfile
```

## Teste unitário

```bash
docker compose run --rm web npm test
```

## Teste E2E

O teste E2E requer `ANTHROPIC_API_KEY` válida.

Gere o vídeo falado de aproximadamente 60 segundos:

```bash
./scripts/generate_fixture.sh
```

Com `docker compose up` em execução:

```bash
./scripts/e2e.sh
```

O teste:
- envia o MP4 real;
- aguarda o worker;
- imprime status/progresso;
- baixa o primeiro clipe;
- valida o MP4 com ffprobe;
- salva em `tests/fixtures/generated-clip.mp4`.

## Limitações desta fase

Ainda não inclui editor manual, remoção de silêncio, branding, B-roll, TTS, contas, Stripe, publicação social, equipes ou API pública. Esses itens pertencem às fases seguintes e não devem ser iniciados antes do pipeline principal passar no E2E.
