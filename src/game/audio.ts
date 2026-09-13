const ENGINE_URL = new URL('../../assets/sfx/engine_loop.ogg', import.meta.url).href
const CANNON_URL = new URL('../../assets/sfx/cannon_fire.ogg', import.meta.url).href
const EXPLODE_URL = new URL('../../assets/sfx/mechanical_explosion.wav', import.meta.url).href
const RAIN_URL = new URL('../../assets/sfx/rain_loop.ogg', import.meta.url).href
const THUNDER_NEAR_URL = new URL('../../assets/sfx/thunder_near.ogg', import.meta.url).href
const THUNDER_FAR_URL = new URL('../../assets/sfx/thunder_far.ogg', import.meta.url).href
const BIRD_URL = new URL('../../assets/sfx/bird_robin.ogg', import.meta.url).href

export class GameAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private engineSrc: AudioBufferSourceNode | null = null
  private engineGain: GainNode | null = null
  private engineFilter: BiquadFilterNode | null = null
  private readonly raw = new Map<string, ArrayBuffer>()
  private readonly decoded = new Map<string, AudioBuffer>()
  private engineVol = 0
  private rainGain: GainNode | null = null
  private windGain: GainNode | null = null
  private birdCd = 2
  private ready = false

  async load(): Promise<void> {
    const jobs = [
      ['engine', ENGINE_URL],
      ['cannon', CANNON_URL],
      ['explode', EXPLODE_URL],
      ['rain', RAIN_URL],
      ['thunderNear', THUNDER_NEAR_URL],
      ['thunderFar', THUNDER_FAR_URL],
      ['bird', BIRD_URL],
    ] as const
    await Promise.all(
      jobs.map(async ([name, url]) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`SFX ${name}: ${res.status}`)
        this.raw.set(name, await res.arrayBuffer())
      }),
    )
  }

  async unlock(): Promise<void> {
    if (this.ready) {
      await this.ctx?.resume()
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0.7
    this.master.connect(ctx.destination)
    this.decoded.set('hit', makeHitBuffer(ctx))
    for (const [name, buf] of this.raw) {
      this.decoded.set(name, await ctx.decodeAudioData(buf.slice(0)))
    }
    this.startEngine()
    this.startWeatherPads()
    this.ready = true
    await ctx.resume()
  }

  setMotion(amount: number): void {
    if (!this.ctx || !this.engineGain || !this.engineSrc) return
    const moving = Math.max(0, Math.min(1, amount))
    this.engineVol += (moving - this.engineVol) * 0.12
    this.engineGain.gain.setTargetAtTime(this.engineVol * 0.38, this.ctx.currentTime, 0.08)
    this.engineSrc.playbackRate.setTargetAtTime(0.82 + this.engineVol * 0.38, this.ctx.currentTime, 0.1)
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(420 + this.engineVol * 980, this.ctx.currentTime, 0.12)
    }
  }

  fire(): void {
    this.play('cannon', 0.72, 0.92 + Math.random() * 0.12)
  }

  hit(): void {
    this.play('hit', 0.55, 0.9 + Math.random() * 0.2)
  }

  explode(): void {
    this.play('explode', 0.85, 0.92 + Math.random() * 0.1)
  }

  stopEngine(): void {
    this.setMotion(0)
  }

  setWeather(rain: number, wind: number): void {
    if (!this.ctx || !this.rainGain || !this.windGain) return
    const t = this.ctx.currentTime
    this.rainGain.gain.setTargetAtTime(Math.max(0, rain) * 0.34, t, 0.4)
    this.windGain.gain.setTargetAtTime(Math.max(0, wind) * 0.07, t, 0.4)
  }

  thunder(event: { volume: number; far: boolean }): void {
    this.play(event.far ? 'thunderFar' : 'thunderNear', event.volume, 0.88 + Math.random() * 0.2)
  }

  tickAmbience(dt: number, hour: number, rain: number): void {
    if (!this.ready) return
    this.birdCd -= dt
    const morning = hour >= 5.4 && hour < 11.2
    if (!morning || rain > 0.38 || this.birdCd > 0) return
    if (Math.random() >= 1 - Math.exp(-dt * 0.22)) return
    this.play('bird', 0.14 + Math.random() * 0.16, 0.88 + Math.random() * 0.28)
    this.birdCd = 2.8 + Math.random() * 8.5
  }

  private startEngine(): void {
    const ctx = this.ctx
    const buf = this.decoded.get('engine')
    if (!ctx || !this.master || !buf) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start()
    this.engineSrc = src
    this.engineGain = gain
    this.engineFilter = filter
  }

  private startWeatherPads(): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const rainBuf = this.decoded.get('rain') ?? makeRainBuffer(ctx)
    this.rainGain = loopPad(ctx, this.master, rainBuf, 0, 1, 7200)
    this.windGain = loopPad(ctx, this.master, makeWindBuffer(ctx), 0, 0.92, 760)
  }

  private play(name: string, volume: number, rate: number): void {
    const ctx = this.ctx
    const buf = this.decoded.get(name)
    if (!ctx || !this.master || !buf) return
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = rate
    const gain = ctx.createGain()
    gain.gain.value = volume
    src.connect(gain)
    gain.connect(this.master)
    src.start()
  }
}

function loopPad(
  ctx: AudioContext,
  dest: GainNode,
  buf: AudioBuffer,
  volume: number,
  rate: number,
  cutoff: number,
): GainNode {
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.playbackRate.value = rate
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  const gain = ctx.createGain()
  gain.gain.value = volume
  src.connect(filter)
  filter.connect(gain)
  gain.connect(dest)
  src.start()
  return gain
}

function makeRainBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const n = sr * 2
  const buf = ctx.createBuffer(1, n, sr)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) {
    const hiss = Math.random() * 2 - 1
    const drip = Math.random() < 0.012 ? (Math.random() * 2 - 1) * 0.9 : 0
    data[i] = hiss * 0.22 + drip
  }
  return buf
}

function makeWindBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const n = sr * 3
  const buf = ctx.createBuffer(1, n, sr)
  const data = buf.getChannelData(0)
  let brown = 0
  for (let i = 0; i < n; i++) {
    brown = clampAudio(brown + (Math.random() * 2 - 1) * 0.02, -0.4, 0.4)
    data[i] = brown
  }
  return buf
}

function clampAudio(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n))
}

function makeHitBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const n = Math.floor(sr * 0.32)
  const buf = ctx.createBuffer(1, n, sr)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) {
    const t = i / sr
    const env = Math.exp(-t * 14)
    const clang =
      Math.sin(2 * Math.PI * 740 * t) * 0.45 +
      Math.sin(2 * Math.PI * 1180 * t) * 0.22 +
      Math.sin(2 * Math.PI * 1870 * t) * 0.12
    const grit = (Math.random() * 2 - 1) * Math.exp(-t * 22) * 0.35
    data[i] = (clang + grit) * env
  }
  return buf
}
