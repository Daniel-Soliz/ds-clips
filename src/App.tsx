import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Captions,
  Check,
  ChevronDown,
  Clapperboard,
  Clock3,
  Download,
  Gauge,
  Layers3,
  Menu,
  Mic2,
  Play,
  Scissors,
  Sparkles,
  UploadCloud,
  WandSparkles,
  Zap,
} from 'lucide-react'

type Stage = 'idle' | 'processing' | 'ready'

const sampleClips = [
  { time: '00:18 — 00:46', title: 'A frase que prende nos 3 primeiros segundos', score: 96, duration: '28s' },
  { time: '01:12 — 01:51', title: 'O ponto de virada da história', score: 91, duration: '39s' },
  { time: '03:04 — 03:36', title: 'Resposta curta com alto potencial de retenção', score: 88, duration: '32s' },
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

export default function App() {
  const [stage, setStage] = useState<Stage>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [activeClip, setActiveClip] = useState(0)
  const [captionStyle, setCaptionStyle] = useState('Punch')
  const [smartFocus, setSmartFocus] = useState(true)
  const [silenceCut, setSilenceCut] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])

  function startProcessing(nextFile: File) {
    setFile(nextFile)
    setStage('processing')
    setProgress(8)
    let value = 8
    const timer = window.setInterval(() => {
      value += Math.ceil(Math.random() * 11)
      if (value >= 100) {
        window.clearInterval(timer)
        setProgress(100)
        window.setTimeout(() => setStage('ready'), 450)
      } else {
        setProgress(value)
      }
    }, 340)
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0]
    if (nextFile) startProcessing(nextFile)
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const nextFile = event.dataTransfer.files?.[0]
    if (nextFile?.type.startsWith('video/')) startProcessing(nextFile)
  }

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
          <button className="primaryButton compact">
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
          Jogue um vídeo longo. A IA encontra as melhores histórias, enquadra, legenda,
          limpa e entrega cortes com ritmo de conteúdo nativo.
        </p>
        <div className="heroActions">
          <button className="primaryButton heroButton" onClick={() => inputRef.current?.click()}>
            <UploadCloud size={18} /> Testar com um vídeo
          </button>
          <button className="textButton">
            <span className="playDot"><Play size={12} fill="currentColor" /></span>
            Ver experiência
          </button>
        </div>
        <div className="trustLine">
          <span><Check size={14} /> MP4, MOV, WEBM</span>
          <span><Check size={14} /> até 4K</span>
          <span><Check size={14} /> português nativo</span>
        </div>
      </section>

      <section className="studioFrame" id="studio">
        <div className="studioTop">
          <div>
            <span className="statusDot" />
            <strong>Direction Room</strong>
            <small>{stage === 'ready' ? '3 cortes encontrados' : 'novo projeto'}</small>
          </div>
          <div className="studioTopRight">
            <span>Auto-save</span>
            <button><ChevronDown size={15} /> 9:16</button>
            <button className="exportButton"><Download size={15} /> Exportar</button>
          </div>
        </div>

        <div className="studioGrid">
          <aside className="toolRail">
            {[
              [WandSparkles, 'Magic'],
              [Scissors, 'Cortes'],
              [Captions, 'Legendas'],
              [Layers3, 'Brand'],
            ].map(([Icon, label], index) => (
              <button className={index === 0 ? 'active' : ''} key={String(label)}>
                <Icon size={18} />
                <span>{String(label)}</span>
              </button>
            ))}
          </aside>

          <div className="canvasArea">
            <AnimatePresence mode="wait">
              {stage === 'idle' && (
                <motion.div
                  className="dropZone"
                  key="idle"
                  initial={{ opacity: 0, scale: .98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                >
                  <input ref={inputRef} type="file" accept="video/*" onChange={onFileChange} hidden />
                  <div className="uploadOrb"><UploadCloud size={28} /></div>
                  <h2>Solte seu vídeo aqui</h2>
                  <p>ou clique para escolher um arquivo</p>
                  <div className="dropDivider"><span /> <em>DS AI vai cuidar do resto</em> <span /></div>
                  <div className="autoChips">
                    <span><Scissors size={13} /> encontra cortes</span>
                    <span><Mic2 size={13} /> entende a fala</span>
                    <span><Captions size={13} /> cria legendas</span>
                  </div>
                </motion.div>
              )}

              {stage === 'processing' && (
                <motion.div
                  className="processingPanel"
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="scanPreview">
                    <div className="scanLine" />
                    <Clapperboard size={38} />
                    <span>{file?.name}</span>
                  </div>
                  <div className="processingCopy">
                    <div className="aiPulse"><Sparkles size={16} /></div>
                    <div>
                      <small>DS DIRECTOR está analisando</small>
                      <h2>{progress < 40 ? 'Mapeando a narrativa...' : progress < 75 ? 'Encontrando picos de atenção...' : 'Finalizando cortes...'}</h2>
                    </div>
                    <strong>{progress}%</strong>
                  </div>
                  <div className="progressTrack"><motion.span animate={{ width: `${progress}%` }} /></div>
                  <div className="processSteps">
                    <span className={progress > 15 ? 'done' : ''}>Transcrição</span>
                    <span className={progress > 42 ? 'done' : ''}>Contexto</span>
                    <span className={progress > 68 ? 'done' : ''}>Momentos-chave</span>
                    <span className={progress > 88 ? 'done' : ''}>Reframe</span>
                  </div>
                </motion.div>
              )}

              {stage === 'ready' && (
                <motion.div
                  className="editorCanvas"
                  key="ready"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="phonePreview">
                    <div className="videoSurface">
                      {fileUrl ? <video src={fileUrl} muted loop autoPlay playsInline /> : null}
                      <div className="previewShade" />
                      <div className={`captionPreview style${captionStyle}`}>
                        O conteúdo bom<br /><b>começa antes</b> do play.
                      </div>
                      <div className="speakerTag">DS SMART FOCUS</div>
                    </div>
                  </div>
                  <div className="timelinePanel">
                    <div className="timelineHeader">
                      <span><Play size={13} fill="currentColor" /> 00:18</span>
                      <small>00:46</small>
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <aside className="directorPanel">
            <div className="panelTitle">
              <div><Sparkles size={16} /> <strong>AI Director</strong></div>
              <span className="liveBadge">LIVE</span>
            </div>

            <div className="directorCard">
              <small>Objetivo do corte</small>
              <button className="selectButton">Alta retenção <ChevronDown size={14} /></button>
            </div>

            <div className="toggleRow">
              <div><strong>Smart Focus</strong><small>Rosto sempre em quadro</small></div>
              <button className={smartFocus ? 'toggle on' : 'toggle'} onClick={() => setSmartFocus(!smartFocus)}><span /></button>
            </div>
            <div className="toggleRow">
              <div><strong>Clean Cuts</strong><small>Remove pausas mortas</small></div>
              <button className={silenceCut ? 'toggle on' : 'toggle'} onClick={() => setSilenceCut(!silenceCut)}><span /></button>
            </div>

            <div className="captionStyles">
              <small>Estilo de legenda</small>
              <div>
                {['Punch', 'Clean', 'Kinetic'].map(style => (
                  <button
                    key={style}
                    className={captionStyle === style ? 'selected' : ''}
                    onClick={() => setCaptionStyle(style)}
                  >
                    {style === 'Punch' ? 'Aa!' : style === 'Clean' ? 'Aa' : 'A↗'}
                    <small>{style}</small>
                  </button>
                ))}
              </div>
            </div>

            {stage === 'ready' && (
              <motion.div className="insightCard" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Gauge size={18} />
                <div><strong>96</strong><small>Momentum Score</small></div>
                <p>Gancho forte + mudança de ritmo nos primeiros 2,4s.</p>
              </motion.div>
            )}
          </aside>
        </div>

        {stage === 'ready' && (
          <motion.div className="clipShelf" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <div className="shelfHeader">
              <div><Sparkles size={16} /><strong>Momentos encontrados</strong><span>3</span></div>
              <button>Ver todos <ArrowRight size={14} /></button>
            </div>
            <div className="clipCards">
              {sampleClips.map((clip, index) => (
                <button
                  className={activeClip === index ? 'clipCard active' : 'clipCard'}
                  key={clip.title}
                  onClick={() => setActiveClip(index)}
                >
                  <div className="clipThumb">
                    <span className="score"><Zap size={11} fill="currentColor" /> {clip.score}</span>
                    <span className="clipPlay"><Play size={14} fill="currentColor" /></span>
                    <small>{clip.duration}</small>
                  </div>
                  <div className="clipInfo">
                    <small>{clip.time}</small>
                    <strong>{clip.title}</strong>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </section>

      <section className="manifesto" id="workflow">
        <div className="manifestoLabel">NOSSA TESE</div>
        <h2>Editar vídeo não deveria parecer<br />trabalho de edição.</h2>
        <p>
          Por isso o DS Clips trabalha como um diretor: entende contexto, intenção e ritmo
          antes de encostar na timeline.
        </p>
        <div className="principles">
          <article><span>01</span><h3>Entender</h3><p>Transcreve e interpreta o que realmente importa no vídeo.</p></article>
          <article><span>02</span><h3>Dirigir</h3><p>Seleciona momentos, reposiciona enquadramento e cria ritmo.</p></article>
          <article><span>03</span><h3>Entregar</h3><p>Gera variações prontas para cada formato e plataforma.</p></article>
        </div>
      </section>

      <section className="featureGrid" id="features">
        <article className="feature featureWide">
          <div className="featureIcon"><Captions /></div>
          <small>LIVE CAPTIONS</small>
          <h3>Legenda que participa<br />da história.</h3>
          <p>Palavra, intenção e ritmo visual sincronizados com a fala.</p>
          <div className="kineticDemo"><span>VOCÊ</span><span>NÃO</span><span>PRECISA</span><b>EDITAR.</b></div>
        </article>
        <article className="feature">
          <div className="featureIcon"><Gauge /></div>
          <small>MOMENTUM SCORE</small>
          <h3>Não é “viral score”.<br />É explicação.</h3>
          <p>Entenda por que um trecho tem potencial de segurar atenção.</p>
          <div className="meter"><span /><i>96</i></div>
        </article>
        <article className="feature">
          <div className="featureIcon"><Clock3 /></div>
          <small>ONE SOURCE</small>
          <h3>Um vídeo.<br />Muitas narrativas.</h3>
          <p>Variações de gancho, duração e formato sem refazer o projeto.</p>
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
