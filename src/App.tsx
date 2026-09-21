import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { chooseSegments, fetchDirectVideo, renderSegments, type RenderedClip } from './lib/videoEngine'
import {
  ArrowRight,
  Captions,
  Check,
  ChevronDown,
  Clapperboard,
  Clock3,
  Download,
  Gauge,
  Languages,
  Layers3,
  Link2,
  Menu,
  Mic2,
  Monitor,
  Play,
  RotateCcw,
  Scissors,
  Settings2,
  Smartphone,
  Sparkles,
  Square,
  UploadCloud,
  WandSparkles,
  Zap,
} from 'lucide-react'

type Stage = 'idle' | 'processing' | 'ready'
type SourceMode = 'upload' | 'link'
type Aspect = '9:16' | '1:1' | '16:9'
type ClipLength = 'auto' | '15-30' | '30-60' | '60-90'
type ClipCount = 'auto' | '3' | '5' | '8'

const allClips = [
  { time: '00:18 — 00:46', title: 'A frase que prende nos 3 primeiros segundos', score: 96, duration: '28s' },
  { time: '01:12 — 01:51', title: 'O ponto de virada da história', score: 93, duration: '39s' },
  { time: '03:04 — 03:36', title: 'Resposta curta com alto potencial de retenção', score: 91, duration: '32s' },
  { time: '04:22 — 05:04', title: 'Opinião forte que gera comentário', score: 88, duration: '42s' },
  { time: '06:10 — 06:44', title: 'Insight direto com ritmo rápido', score: 86, duration: '34s' },
  { time: '08:02 — 08:31', title: 'Trecho com pergunta e resposta clara', score: 84, duration: '29s' },
  { time: '10:15 — 10:58', title: 'Momento emocional com boa conclusão', score: 82, duration: '43s' },
  { time: '12:08 — 12:40', title: 'Dica prática que funciona como tutorial', score: 80, duration: '32s' },
]

const waveform = Array.from({ length: 74 }, (_, i) => {
  const wave = Math.abs(Math.sin(i * 0.61) * 29 + Math.cos(i * 0.23) * 19)
  return Math.max(10, Math.min(58, wave + 12))
})

function BrandMark() {
  return (
    <div className="brandMark" aria-hidden="true">
      <span />
      <span />
    </div>
  )
}

function Toggle({
  value,
  onChange,
  title,
  description,
}: {
  value: boolean
  onChange: () => void
  title: string
  description: string
}) {
  return (
    <div className="toggleRow">
      <div><strong>{title}</strong><small>{description}</small></div>
      <button className={value ? 'toggle on' : 'toggle'} onClick={onChange}><span /></button>
    </div>
  )
}

export default function App() {
  const [stage, setStage] = useState<Stage>('idle')
  const [sourceMode, setSourceMode] = useState<SourceMode>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [urlReady, setUrlReady] = useState(false)
  const [urlError, setUrlError] = useState('')
  const [progress, setProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('Preparando...')
  const [processingError, setProcessingError] = useState('')
  const [generatedClips, setGeneratedClips] = useState<RenderedClip[]>([])

  const [aspect, setAspect] = useState<Aspect>('9:16')
  const [clipLength, setClipLength] = useState<ClipLength>('auto')
  const [clipCount, setClipCount] = useState<ClipCount>('auto')
  const [language, setLanguage] = useState('pt-BR')
  const [quality, setQuality] = useState('1080p')
  const [captionStyle, setCaptionStyle] = useState('Punch')
  const [smartFocus, setSmartFocus] = useState(true)
  const [silenceCut, setSilenceCut] = useState(true)
  const [autoZoom, setAutoZoom] = useState(true)
  const [autoEmoji, setAutoEmoji] = useState(false)
  const [activeClip, setActiveClip] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])

  const desiredCount = clipCount === 'auto' ? 5 : Number(clipCount)
  const clips = generatedClips.length ? generatedClips : allClips.slice(0, desiredCount)
  const sourceReady = Boolean(file || urlReady)

  function validateUrl() {
    try {
      const parsed = new URL(videoUrl.trim())
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid')
      setUrlError('')
      setUrlReady(true)
      setFile(null)
    } catch {
      setUrlReady(false)
      setUrlError('Cole um link válido de vídeo.')
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0]
    if (nextFile) {
      setFile(nextFile)
      setUrlReady(false)
      setVideoUrl('')
      setUrlError('')
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const nextFile = event.dataTransfer.files?.[0]
    if (nextFile?.type.startsWith('video/')) {
      setFile(nextFile)
      setUrlReady(false)
      setVideoUrl('')
      setUrlError('')
    }
  }

  async function startProcessing() {
    if (!sourceReady) {
      if (sourceMode === 'link') validateUrl()
      else inputRef.current?.click()
      return
    }

    setProcessingError('')
    setGeneratedClips([])
    setStage('processing')
    setProgress(4)
    setProcessingStatus('Preparando o vídeo...')

    try {
      let sourceFile = file
      if (!sourceFile && urlReady) {
        setProcessingStatus('Importando vídeo pelo link...')
        sourceFile = await fetchDirectVideo(videoUrl.trim())
      }
      if (!sourceFile) throw new Error('Nenhum vídeo disponível para processar.')

      setProgress(12)
      setProcessingStatus('Analisando ritmo e picos de energia...')
      const segments = await chooseSegments(sourceFile, desiredCount, clipLength)

      setProgress(24)
      setProcessingStatus('Carregando o motor de edição...')
      const output = await renderSegments(
        sourceFile,
        segments,
        aspect,
        quality as '720p' | '1080p' | '4K',
        (renderProgress, status) => {
          setProgress(24 + Math.round(renderProgress * 0.76))
          setProcessingStatus(status)
        },
      )

      setGeneratedClips(output)
      setActiveClip(0)
      setProgress(100)
      setProcessingStatus('Cortes prontos')
      window.setTimeout(() => setStage('ready'), 300)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível gerar os cortes.'
      setProcessingError(message)
      setStage('idle')
      setProgress(0)
      if (sourceMode === 'link') {
        setUrlError(
          message.includes('diretamente')
            ? 'Por enquanto, links precisam apontar direto para um arquivo MP4/WebM. YouTube, TikTok e Instagram exigem o backend que vamos conectar na próxima etapa.'
            : message
        )
      }
    }
  }

  function resetProject() {
    generatedClips.forEach(clip => URL.revokeObjectURL(clip.url))
    setGeneratedClips([])
    setStage('idle')
    setProgress(0)
    setProcessingStatus('Preparando...')
    setProcessingError('')
    setFile(null)
    setVideoUrl('')
    setUrlReady(false)
    setUrlError('')
    setActiveClip(0)
  }

  function downloadClip(index: number) {
    const clip = generatedClips[index]
    if (!clip) return
    const a = document.createElement('a')
    a.href = clip.url
    a.download = clip.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  function downloadAllClips() {
    generatedClips.forEach((_, index) => {
      window.setTimeout(() => downloadClip(index), index * 350)
    })
  }

  function formatTime(seconds: number) {
    const value = Math.max(0, Math.floor(seconds))
    const min = Math.floor(value / 60)
    const sec = value % 60
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const aspectClass = aspect.replace(':', 'x')

  return (
    <main className="appShell">
      <div className="ambient ambientA" />
      <div className="ambient ambientB" />

      <header className="topbar">
        <a className="brand" href="#top" aria-label="DS Clips início">
          <BrandMark />
          <span>DS Clips</span>
          <small>AI STUDIO</small>
        </a>
        <nav className="desktopNav">
          <a href="#studio">Studio</a>
          <a href="#workflow">Como funciona</a>
          <a href="#features">Recursos</a>
        </nav>
        <div className="headerActions">
          <button className="ghostButton">Entrar</button>
          <button className="primaryButton compact" onClick={() => document.querySelector('#studio')?.scrollIntoView({ behavior: 'smooth' })}>
            Criar projeto <ArrowRight size={15} />
          </button>
          <button className="menuButton" aria-label="Abrir menu"><Menu size={20} /></button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><Sparkles size={14} /> VIDEO INTELLIGENCE, REIMAGINED</div>
        <h1>
          Um editor que não espera<br />
          <span>sua próxima ideia.</span>
        </h1>
        <p className="heroText">
          Envie um vídeo ou cole um link. Configure o formato uma vez e deixe o Director organizar os cortes,
          legendas, foco e ritmo automaticamente.
        </p>
        <div className="heroActions">
          <button className="primaryButton heroButton" onClick={() => document.querySelector('#studio')?.scrollIntoView({ behavior: 'smooth' })}>
            <WandSparkles size={18} /> Criar cortes agora
          </button>
          <button className="textButton" onClick={() => document.querySelector('#workflow')?.scrollIntoView({ behavior: 'smooth' })}>
            <span className="playDot"><Play size={12} fill="currentColor" /></span>
            Ver como funciona
          </button>
        </div>
        <div className="trustLine">
          <span><Check size={14} /> link ou upload</span>
          <span><Check size={14} /> 9:16, 1:1 e 16:9</span>
          <span><Check size={14} /> legendas automáticas</span>
        </div>
      </section>

      <section className="studioFrame" id="studio">
        <div className="studioTop">
          <div>
            <span className="statusDot" />
            <strong>Direction Room</strong>
            <small>
              {stage === 'ready'
                ? `${clips.length} cortes encontrados`
                : stage === 'processing'
                  ? 'processando projeto'
                  : sourceReady
                    ? 'fonte pronta'
                    : 'novo projeto'}
            </small>
          </div>
          <div className="studioTopRight">
            <span>Auto-save</span>
            <button className="formatMini"><span>{aspect}</span><ChevronDown size={14} /></button>
            {stage !== 'idle' && <button onClick={resetProject}><RotateCcw size={14} /> Novo</button>}
            <button className="exportButton" disabled={stage !== 'ready' || !generatedClips.length} onClick={() => downloadClip(activeClip)}><Download size={15} /> Exportar</button>
          </div>
        </div>

        <div className="studioGrid">
          <aside className="toolRail">
            {[
              { Icon: WandSparkles, label: 'Magic' },
              { Icon: Scissors, label: 'Cortes' },
              { Icon: Captions, label: 'Legendas' },
              { Icon: Layers3, label: 'Brand' },
            ].map(({ Icon, label }, index) => (
              <button className={index === 0 ? 'active' : ''} key={label}>
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </aside>

          <div className="canvasArea">
            <AnimatePresence mode="wait">
              {stage === 'idle' && (
                <motion.div
                  className="projectBuilder"
                  key="idle"
                  initial={{ opacity: 0, scale: .985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="builderHeader">
                    <div>
                      <small>PASSO 01</small>
                      <h2>Escolha a fonte do vídeo</h2>
                      <p>Envie um arquivo ou importe por link.</p>
                    </div>
                    <div className="sourceTabs">
                      <button className={sourceMode === 'upload' ? 'active' : ''} onClick={() => setSourceMode('upload')}>
                        <UploadCloud size={15} /> Upload
                      </button>
                      <button className={sourceMode === 'link' ? 'active' : ''} onClick={() => setSourceMode('link')}>
                        <Link2 size={15} /> Link
                      </button>
                    </div>
                  </div>

                  {sourceMode === 'upload' ? (
                    <div
                      className={file ? 'dropZone selectedSource' : 'dropZone'}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={onDrop}
                      onClick={() => inputRef.current?.click()}
                    >
                      <input ref={inputRef} type="file" accept="video/*" onChange={onFileChange} hidden />
                      <div className="uploadOrb">{file ? <Check size={28} /> : <UploadCloud size={28} />}</div>
                      <h3>{file ? file.name : 'Solte seu vídeo aqui'}</h3>
                      <p>{file ? 'Arquivo pronto para configurar' : 'ou clique para escolher MP4, MOV ou WEBM'}</p>
                    </div>
                  ) : (
                    <div className={urlReady ? 'linkImport selectedSource' : 'linkImport'}>
                      <div className="uploadOrb">{urlReady ? <Check size={28} /> : <Link2 size={28} />}</div>
                      <h3>{urlReady ? 'Link pronto' : 'Cole o link do vídeo'}</h3>
                      <p>YouTube, TikTok, Instagram ou link direto</p>
                      <div className="linkField">
                        <Link2 size={17} />
                        <input
                          value={videoUrl}
                          onChange={(e) => { setVideoUrl(e.target.value); setUrlReady(false); setUrlError('') }}
                          onKeyDown={(e) => { if (e.key === 'Enter') validateUrl() }}
                          placeholder="https://..."
                          inputMode="url"
                        />
                        <button onClick={validateUrl}>{urlReady ? 'Pronto' : 'Usar link'} <ArrowRight size={15} /></button>
                      </div>
                      {urlError && <small className="urlError">{urlError}</small>}
                    </div>
                  )}

                  <div className="builderDivider" />

                  <div className="builderHeader builderSecond">
                    <div>
                      <small>PASSO 02</small>
                      <h2>Defina o resultado</h2>
                      <p>Você controla o formato. A IA cuida do trabalho repetitivo.</p>
                    </div>
                    <Settings2 size={20} />
                  </div>

                  <div className="configGrid">
                    <section className="configCard configWide">
                      <label>Formato de saída</label>
                      <div className="formatChooser">
                        <button className={aspect === '9:16' ? 'active' : ''} onClick={() => setAspect('9:16')}>
                          <Smartphone size={19} /><strong>9:16</strong><small>TikTok · Reels · Shorts</small>
                        </button>
                        <button className={aspect === '1:1' ? 'active' : ''} onClick={() => setAspect('1:1')}>
                          <Square size={18} /><strong>1:1</strong><small>Feed · Ads</small>
                        </button>
                        <button className={aspect === '16:9' ? 'active' : ''} onClick={() => setAspect('16:9')}>
                          <Monitor size={19} /><strong>16:9</strong><small>YouTube · X · LinkedIn</small>
                        </button>
                      </div>
                    </section>

                    <section className="configCard">
                      <label>Duração dos cortes</label>
                      <div className="segmented">
                        {[
                          ['auto', 'Auto'],
                          ['15-30', '15–30s'],
                          ['30-60', '30–60s'],
                          ['60-90', '60–90s'],
                        ].map(([value, label]) => (
                          <button key={value} className={clipLength === value ? 'active' : ''} onClick={() => setClipLength(value as ClipLength)}>{label}</button>
                        ))}
                      </div>
                    </section>

                    <section className="configCard">
                      <label>Quantidade</label>
                      <div className="segmented compactSegments">
                        {[
                          ['auto', 'Auto'],
                          ['3', '3'],
                          ['5', '5'],
                          ['8', '8'],
                        ].map(([value, label]) => (
                          <button key={value} className={clipCount === value ? 'active' : ''} onClick={() => setClipCount(value as ClipCount)}>{label}</button>
                        ))}
                      </div>
                    </section>

                    <section className="configCard">
                      <label><Languages size={13} /> Idioma</label>
                      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="auto">Detectar automaticamente</option>
                        <option value="en">English</option>
                        <option value="es">Español</option>
                      </select>
                    </section>

                    <section className="configCard">
                      <label>Qualidade</label>
                      <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                        <option value="1080p">Full HD · 1080p</option>
                        <option value="720p">HD · 720p</option>
                        <option value="4K">4K · 2160p</option>
                      </select>
                    </section>
                  </div>

                  <div className="automationBar">
                    <div className="automationCopy">
                      <span className="automationIcon"><Sparkles size={17} /></span>
                      <div><strong>Director Automático</strong><small>Transcrição, cortes, reenquadramento e legendas.</small></div>
                    </div>
                    <button className="generateButton" onClick={startProcessing}>
                      <WandSparkles size={17} /> {sourceReady ? 'Gerar meus cortes' : 'Escolher vídeo'} <ArrowRight size={15} />
                    </button>
                  </div>
                  {processingError && (
                    <div className="processingErrorBox">
                      <strong>Não foi possível processar o vídeo</strong>
                      <span>{processingError}</span>
                    </div>
                  )}
                </motion.div>
              )}

              {stage === 'processing' && (
                <motion.div className="processingPanel" key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <div className="processingMeta">
                    <span>{aspect}</span><span>{clipLength === 'auto' ? 'duração automática' : `${clipLength}s`}</span><span>{quality}</span>
                  </div>
                  <div className="scanPreview">
                    <div className="scanLine" />
                    <Clapperboard size={38} />
                    <span>{file?.name || videoUrl || 'Vídeo por link'}</span>
                  </div>
                  <div className="processingCopy">
                    <div className="aiPulse"><Sparkles size={16} /></div>
                    <div>
                      <small>DS DIRECTOR está analisando</small>
                      <h2>{processingStatus}</h2>
                    </div>
                    <strong>{progress}%</strong>
                  </div>
                  <div className="progressTrack"><motion.span animate={{ width: `${progress}%` }} /></div>
                  <div className="processSteps">
                    <span className={progress > 10 ? 'done' : ''}>Importação</span>
                    <span className={progress > 30 ? 'done' : ''}>Transcrição</span>
                    <span className={progress > 54 ? 'done' : ''}>Contexto</span>
                    <span className={progress > 72 ? 'done' : ''}>Momentos</span>
                    <span className={progress > 88 ? 'done' : ''}>Render</span>
                  </div>
                </motion.div>
              )}

              {stage === 'ready' && (
                <motion.div className="editorCanvas" key="ready" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <div className={`previewFrame aspect-${aspectClass}`}>
                    <div className="videoSurface">
                      {(generatedClips[activeClip]?.url || fileUrl) ? <video src={generatedClips[activeClip]?.url || fileUrl} muted loop autoPlay playsInline controls /> : null}
                      <div className="previewShade" />
                      <div className={`captionPreview style${captionStyle}`}>
                        O conteúdo bom<br /><b>começa antes</b> do play.
                      </div>
                      <div className="speakerTag">DS SMART FOCUS</div>
                      {!generatedClips[activeClip]?.url && !fileUrl && <div className="linkVideoPlaceholder"><Play size={26} fill="currentColor" /><small>preview do corte</small></div>}
                    </div>
                  </div>
                  <div className="timelinePanel">
                    <div className="editorSummary">
                      <div><small>Formato</small><strong>{aspect}</strong></div>
                      <div><small>Duração</small><strong>{generatedClips[activeClip] ? `${Math.round(generatedClips[activeClip].duration)}s` : clips[activeClip]?.duration}</strong></div>
                      <div><small>Qualidade</small><strong>{quality}</strong></div>
                    </div>
                    <div className="timelineHeader">
                      <span><Play size={13} fill="currentColor" /> {generatedClips[activeClip] ? formatTime(generatedClips[activeClip].start) : '00:18'}</span>
                      <small>{generatedClips[activeClip] ? formatTime(generatedClips[activeClip].start + generatedClips[activeClip].duration) : '00:46'}</small>
                    </div>
                    <div className="waveform">
                      {waveform.map((height, index) => (
                        <i key={index} style={{ height }} className={index > 20 && index < 54 ? 'selected' : ''} />
                      ))}
                      <div className="playhead" />
                    </div>
                    <div className="captionTrack">
                      <span style={{ width: '23%' }}>o conteúdo bom</span>
                      <span style={{ width: '31%' }}>começa antes</span>
                      <span style={{ width: '24%' }}>do play</span>
                    </div>
                    <div className="editorActions">
                      <button><Captions size={14} /> Editar legenda</button>
                      <button><Scissors size={14} /> Ajustar corte</button>
                      <button className="strong" onClick={() => downloadClip(activeClip)} disabled={!generatedClips.length}><Download size={14} /> Exportar este clip</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <aside className="directorPanel">
            <div className="panelTitle">
              <div><Sparkles size={16} /> <strong>AI Director</strong></div>
              <span className="liveBadge">AUTO</span>
            </div>

            <div className="directorCard">
              <small>Objetivo do corte</small>
              <button className="selectButton">Alta retenção <ChevronDown size={14} /></button>
            </div>

            <Toggle value={smartFocus} onChange={() => setSmartFocus(!smartFocus)} title="Smart Focus" description="Mantém o rosto em quadro" />
            <Toggle value={silenceCut} onChange={() => setSilenceCut(!silenceCut)} title="Clean Cuts" description="Remove pausas e silêncios" />
            <Toggle value={autoZoom} onChange={() => setAutoZoom(!autoZoom)} title="Auto Zoom" description="Cria dinâmica nos destaques" />
            <Toggle value={autoEmoji} onChange={() => setAutoEmoji(!autoEmoji)} title="Smart Emoji" description="Emojis em momentos relevantes" />

            <div className="captionStyles">
              <small>Estilo de legenda</small>
              <div>
                {['Punch', 'Clean', 'Kinetic'].map(style => (
                  <button key={style} className={captionStyle === style ? 'selected' : ''} onClick={() => setCaptionStyle(style)}>
                    {style === 'Punch' ? 'Aa!' : style === 'Clean' ? 'Aa' : 'A↗'}
                    <small>{style}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="directorSummary">
              <span><Smartphone size={13} /> {aspect}</span>
              <span><Clock3 size={13} /> {clipLength === 'auto' ? 'Auto' : `${clipLength}s`}</span>
              <span><Languages size={13} /> {language === 'pt-BR' ? 'PT-BR' : language.toUpperCase()}</span>
            </div>

            {stage === 'ready' && (
              <motion.div className="insightCard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Gauge size={18} />
                <div><strong>{clips[activeClip]?.score ?? 96}</strong><small>Momentum Score</small></div>
                <p>Gancho forte + mudança de ritmo logo no início do trecho.</p>
              </motion.div>
            )}
          </aside>
        </div>

        {stage === 'ready' && (
          <motion.div className="clipShelf" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="shelfHeader">
              <div><Sparkles size={16} /><strong>Momentos encontrados</strong><span>{clips.length}</span></div>
              <div className="shelfActions">
                <button onClick={resetProject}><RotateCcw size={14} /> Novo projeto</button>
                <button className="exportAll" onClick={downloadAllClips} disabled={!generatedClips.length}><Download size={14} /> Exportar todos</button>
              </div>
            </div>
            <div className="clipCards">
              {clips.map((clip, index) => (
                <button className={activeClip === index ? 'clipCard active' : 'clipCard'} key={clip.title} onClick={() => setActiveClip(index)}>
                  <div className="clipThumb">
                    <span className="score"><Zap size={11} fill="currentColor" /> {clip.score}</span>
                    <span className="clipPlay"><Play size={14} fill="currentColor" /></span>
                    <small>{typeof clip.duration === 'number' ? `${Math.round(clip.duration)}s` : clip.duration}</small>
                  </div>
                  <div className="clipInfo">
                    <small>{'start' in clip ? `${formatTime(clip.start)} — ${formatTime(clip.start + clip.duration)}` : clip.time}</small>
                    <strong>{clip.title}</strong>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </section>

      <section className="manifesto" id="workflow">
        <div className="manifestoLabel">FLUXO AUTOMÁTICO</div>
        <h2>Você escolhe o resultado.<br />O Director monta o caminho.</h2>
        <p>
          A experiência foi desenhada para reduzir decisões repetitivas: fonte, formato, duração e quantidade
          ficam sob seu controle; o restante entra em automação.
        </p>
        <div className="principles">
          <article><span>01</span><h3>Importar</h3><p>Arquivo local ou link de vídeo em um único ponto de entrada.</p></article>
          <article><span>02</span><h3>Configurar</h3><p>Formato, duração, quantidade, idioma e qualidade antes de processar.</p></article>
          <article><span>03</span><h3>Gerar</h3><p>Transcrição, cortes, legendas e reenquadramento dentro do mesmo fluxo.</p></article>
        </div>
      </section>

      <section className="featureGrid" id="features">
        <article className="feature featureWide">
          <div className="featureIcon"><Captions /></div>
          <small>LIVE CAPTIONS</small>
          <h3>Legenda que participa<br />da história.</h3>
          <p>Escolha o estilo antes de gerar e refine depois, sem perder o ritmo do vídeo.</p>
          <div className="kineticDemo"><span>VOCÊ</span><span>ESCOLHE</span><span>O FORMATO.</span><b>DS FAZ O RESTO.</b></div>
        </article>
        <article className="feature">
          <div className="featureIcon"><Gauge /></div>
          <small>MOMENTUM SCORE</small>
          <h3>Não é só um número.<br />É contexto.</h3>
          <p>Cada corte mostra o motivo de ter sido selecionado para você decidir melhor.</p>
          <div className="meter"><span /><i>96</i></div>
        </article>
        <article className="feature">
          <div className="featureIcon"><Clock3 /></div>
          <small>MULTI FORMAT</small>
          <h3>Um vídeo.<br />Três formatos.</h3>
          <p>9:16 para vertical, 1:1 para feed e 16:9 para conteúdo horizontal.</p>
          <div className="formatStack"><span>9:16</span><span>1:1</span><span>16:9</span></div>
        </article>
      </section>

      <footer>
        <a className="brand" href="#top"><BrandMark /><span>DS Clips</span></a>
        <p>Da ideia longa ao corte certo.</p>
        <small>© 2026 DS Clips. Produto em desenvolvimento.</small>
      </footer>
    </main>
  )
}
