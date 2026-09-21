# DS Clips

Plataforma de edição inteligente de vídeos curtos, criada do zero com identidade própria.

## Frontend atual

- React + Vite + TypeScript
- Interface responsiva
- Upload local de vídeo com preview
- Fluxo visual de processamento por IA
- Mock de cortes encontrados
- Editor visual com waveform
- Estilos de legenda
- Smart Focus / Clean Cuts
- Momentum Score
- UI própria chamada **Direction Room**

## Rodar localmente

```bash
npm install
npm run dev
```

## Próximas etapas

1. Conectar Supabase Auth e Database
2. Criar projetos reais por usuário
3. Upload real de vídeo
4. Worker de processamento com FFmpeg
5. Transcrição e detecção de melhores momentos
6. Renderização e exportação dos cortes

> O processamento pesado de vídeo ficará separado do frontend e do Supabase.
