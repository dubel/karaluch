const ENGINE_OGG = new URL('../../assets/sfx/engine_loop.ogg', import.meta.url).href
const ENGINE_AAC = new URL('../../assets/sfx/engine_loop.m4a', import.meta.url).href
const CANNON_OGG = new URL('../../assets/sfx/cannon_fire.ogg', import.meta.url).href
const CANNON_AAC = new URL('../../assets/sfx/cannon_fire.m4a', import.meta.url).href
const EXPLODE_URL = new URL('../../assets/sfx/mechanical_explosion.wav', import.meta.url).href
const RAIN_OGG = new URL('../../assets/sfx/rain_loop.ogg', import.meta.url).href
const RAIN_AAC = new URL('../../assets/sfx/rain_loop.m4a', import.meta.url).href
const THUNDER_NEAR_OGG = new URL('../../assets/sfx/thunder_near.ogg', import.meta.url).href
const THUNDER_NEAR_AAC = new URL('../../assets/sfx/thunder_near.m4a', import.meta.url).href
const THUNDER_FAR_OGG = new URL('../../assets/sfx/thunder_far.ogg', import.meta.url).href
const THUNDER_FAR_AAC = new URL('../../assets/sfx/thunder_far.m4a', import.meta.url).href
const BIRD_OGG = new URL('../../assets/sfx/bird_robin.ogg', import.meta.url).href
const BIRD_AAC = new URL('../../assets/sfx/bird_robin.m4a', import.meta.url).href
/** Jericho-Trompete: Alexander / OrangeFreeSounds, CC BY 4.0. */
const STUKA_SIREN_URL = new URL('../../assets/sfx/stuka_siren.mp3', import.meta.url).href

const SILENT_WAV =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'

function preferAac(): boolean {
  const probe = document.createElement('audio')
  return probe.canPlayType('audio/ogg; codecs="vorbis"') !== 'probably'
}

function pick(ogg: string, aac: string): string {
  return preferAac() ? aac : ogg
}

function makeAudioContext(): AudioContext {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  return new Ctor()
}

function kickHtmlAudio(): void {
  const el = new Audio()
  el.src = SILENT_WAV
  el.preload = 'auto'
  el.volume = 0.01
  void el.play().catch(() => undefined)
}

async function decodeBuffer(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  const copy = data.slice(0)
  try {
    return await ctx.decodeAudioData(copy)
  } catch {
    const again = data.slice(0)
    return await new Promise((resolve, reject) => {
      const ok = ctx.decodeAudioData(again, resolve, reject)
      if (ok && typeof (ok as Promise<AudioBuffer>).then === 'function') {
        void (ok as Promise<AudioBuffer>).then(resolve, reject)
      }
    })
  }
}

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
  private unlocking: Promise<void> | null = null
  private stukaOn = false
  private stukaEngineSrc: AudioBufferSourceNode | null = null
  private stukaEngineGain: GainNode | null = null

  async load(): Promise<void> {
    const jobs = [
      ['engine', pick(ENGINE_OGG, ENGINE_AAC)],
      ['cannon', pick(CANNON_OGG, CANNON_AAC)],
      ['explode', EXPLODE_URL],
      ['rain', pick(RAIN_OGG, RAIN_AAC)],
      ['thunderNear', pick(THUNDER_NEAR_OGG, THUNDER_NEAR_AAC)],
      ['thunderFar', pick(THUNDER_FAR_OGG, THUNDER_FAR_AAC)],
      ['bird', pick(BIRD_OGG, BIRD_AAC)],
    ] as const
    await Promise.all(
      jobs.map(async ([name, url]) => {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`SFX ${name}: ${res.status}`)
        this.raw.set(name, await res.arrayBuffer())
      }),
    )
    try {
      const res = await fetch(STUKA_SIREN_URL)
      if (res.ok) this.raw.set('stukaSiren', await res.arrayBuffer())
    } catch {
      /* synth fallback in unlock */
    }
  }

  prime(): void {
    kickHtmlAudio()
    if (!this.ctx) {
      const ctx = makeAudioContext()
      this.ctx = ctx
      this.master = ctx.createGain()
      this.master.gain.value = 0.7
      this.master.connect(ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  async unlock(): Promise<void> {
    this.prime()
    if (this.ready) {
      await this.ctx?.resume()
      return
    }
    if (this.unlocking) {
      await this.unlocking
      return
    }
    this.unlocking = this.finishUnlock()
    try {
      await this.unlocking
    } finally {
      this.unlocking = null
    }
  }

  private async finishUnlock(): Promise<void> {
    const ctx = this.ctx
    if (!ctx) return
    await ctx.resume()
    if (!this.decoded.has('hit')) this.decoded.set('hit', makeHitBuffer(ctx))
    if (!this.decoded.has('whistle')) this.decoded.set('whistle', makeWhistleBuffer(ctx))
    if (!this.decoded.has('stukaEngine')) this.decoded.set('stukaEngine', makeStukaEngineBuffer(ctx))
    await Promise.all(
      [...this.raw].map(async ([name, buf]) => {
        if (this.decoded.has(name)) return
        try {
          this.decoded.set(name, await decodeBuffer(ctx, buf))
        } catch {
          /* iOS: skip a bad file instead of killing all audio */
        }
      }),
    )
    if (!this.decoded.has('stukaSiren')) this.decoded.set('stukaSiren', makeJerichoBuffer(ctx))
    if (!this.engineSrc) this.startEngine()
    if (!this.rainGain) this.startWeatherPads()
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

  incomingBarrage(): void {
    if (this.ctx && !this.decoded.has('whistle')) this.decoded.set('whistle', makeWhistleBuffer(this.ctx))
    this.play('whistle', 0.58, 0.92, 0)
    this.play('whistle', 0.5, 1.08, 0.2)
    this.play('whistle', 0.46, 0.84, 0.42)
    this.play('whistle', 0.4, 1.14, 0.68)
    this.play('whistle', 0.34, 0.9, 0.95)
  }

  artilleryBurst(): void {
    this.play('explode', 0.62, 0.78 + Math.random() * 0.18)
  }

  bombBurst(): void {
    this.play('explode', 0.92, 0.68 + Math.random() * 0.18)
  }

  startStukaRaid(): void {
    this.prime()
    if (this.ctx && !this.decoded.has('stukaSiren')) {
      this.decoded.set('stukaSiren', makeJerichoBuffer(this.ctx))
    }
    if (this.ctx && !this.decoded.has('stukaEngine')) {
      this.decoded.set('stukaEngine', makeStukaEngineBuffer(this.ctx))
    }
    this.play('stukaSiren', 0.66, 1)
    this.startStukaEngine()
  }

  stopStukaRaid(): void {
    if (!this.stukaOn) return
    this.stukaOn = false
    const ctx = this.ctx
    const gain = this.stukaEngineGain
    const src = this.stukaEngineSrc
    this.stukaEngineGain = null
    this.stukaEngineSrc = null
    if (!ctx || !gain) return
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.2)
    window.setTimeout(() => {
      try {
        src?.stop()
      } catch {
        /* already stopped */
      }
    }, 700)
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

  private startStukaEngine(): void {
    const ctx = this.ctx
    const buf = this.decoded.get('stukaEngine')
    if (!ctx || !this.master || !buf) return
    if (this.stukaEngineSrc) this.stopStukaRaid()
    this.stukaOn = true
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1400
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start()
    gain.gain.setTargetAtTime(0.34, ctx.currentTime, 0.25)
    this.stukaEngineSrc = src
    this.stukaEngineGain = gain
  }

  private startWeatherPads(): void {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const rainBuf = this.decoded.get('rain') ?? makeRainBuffer(ctx)
    this.rainGain = loopPad(ctx, this.master, rainBuf, 0, 1, 7200)
    this.windGain = loopPad(ctx, this.master, makeWindBuffer(ctx), 0, 0.92, 760)
  }

  private play(name: string, volume: number, rate: number, delay = 0): void {
    const ctx = this.ctx
    const buf = this.decoded.get(name)
    if (!ctx || !this.master || !buf) return
    if (ctx.state === 'suspended') void ctx.resume()
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = rate
    const gain = ctx.createGain()
    gain.gain.value = volume
    src.connect(gain)
    gain.connect(this.master)
    src.start(ctx.currentTime + delay)
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

function makeWhistleBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const dur = 1.42
  const n = Math.floor(sr * dur)
  const buf = ctx.createBuffer(1, n, sr)
  const data = buf.getChannelData(0)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const u = i / n
    const freq = 1720 * (1 - u) ** 0.72 + 240
    phase += (2 * Math.PI * freq) / sr
    const env = Math.min(1, i / (sr * 0.08)) * (1 - u) ** 0.42
    const hiss = (Math.random() * 2 - 1) * 0.1
    data[i] = (Math.sin(phase) * 0.72 + hiss) * env
  }
  return buf
}

function makeJerichoBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const dur = 9.5
  const n = Math.floor(sr * dur)
  const buf = ctx.createBuffer(1, n, sr)
  const data = buf.getChannelData(0)
  let p1 = 0
  let p2 = 0
  let p3 = 0
  for (let i = 0; i < n; i++) {
    const u = i / n
    const dive = u < 0.72 ? u / 0.72 : 1
    const freq = 1680 - 1180 * dive ** 0.85 + 90 * Math.sin(u * 9)
    p1 += (2 * Math.PI * freq) / sr
    p2 += (2 * Math.PI * freq * 1.49) / sr
    p3 += (2 * Math.PI * freq * 0.51) / sr
    const attack = Math.min(1, i / (sr * 0.35))
    const release = u > 0.82 ? (1 - u) / 0.18 : 1
    const env = attack * release
    const tone = Math.sin(p1) * 0.55 + Math.sin(p2) * 0.22 + Math.sin(p3) * 0.18
    data[i] = tone * env
  }
  return buf
}

function makeStukaEngineBuffer(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate
  const n = sr * 2
  const buf = ctx.createBuffer(1, n, sr)
  const data = buf.getChannelData(0)
  let brown = 0
  for (let i = 0; i < n; i++) {
    const t = i / sr
    brown = clampAudio(brown + (Math.random() * 2 - 1) * 0.028, -0.5, 0.5)
    const prop = Math.sin(2 * Math.PI * 31 * t) * 0.35 + Math.sin(2 * Math.PI * 62 * t) * 0.12
    const hum = Math.sin(2 * Math.PI * 88 * t) * 0.22 + Math.sin(2 * Math.PI * 176 * t) * 0.08
    data[i] = brown * 0.55 + prop * (0.45 + brown * 0.2) + hum
  }
  return buf
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
