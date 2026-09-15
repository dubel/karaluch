import { KID_MODE, SHOW_FPS } from '../game/config'
import { onLangChange, setLangSwitchVisible, t } from '../i18n'

export type MissionStats = {
  kills: number
  wavesCleared: number
  heldHours: number
}

export class Hud {
  private readonly overlay: HTMLElement
  private readonly status: HTMLElement
  private readonly playBtn: HTMLButtonElement
  private readonly hpPlayer: HTMLElement
  private readonly kills: HTMLElement
  private readonly reload: HTMLElement
  private readonly pitchPip: HTMLElement
  private readonly atmos: HTMLElement
  private readonly help: HTMLElement
  private readonly stats: HTMLElement
  private readonly tag: HTMLElement
  private readonly notice: HTMLElement
  private readonly gunLabel: HTMLElement
  private readonly arty: HTMLElement
  private readonly artyVeil: HTMLElement
  private readonly rosterCount: HTMLElement
  private readonly stukaAlert: HTMLElement
  private readonly fps: HTMLElement
  private noticeHandle = 0
  private fpsText = ''
  private mode: 'load' | 'ready' | 'defeat' = 'load'
  private lastReport: MissionStats | null = null
  private repairing = false
  private loadPct = 0

  constructor() {
    this.overlay = this.el('#overlay')
    this.status = this.el('#overlay-status')
    this.playBtn = this.el('#play-btn') as HTMLButtonElement
    this.hpPlayer = this.el('#hp-player')
    this.kills = this.el('#kills')
    this.reload = this.el('#reload-fill')
    this.pitchPip = this.el('#pitch-pip')
    this.atmos = this.el('#atmos')
    this.help = this.el('#overlay-help')
    this.stats = this.el('#overlay-stats')
    this.tag = this.el('#overlay-tag')
    this.notice = this.el('#notice')
    this.gunLabel = this.el('#gun-label')
    this.arty = this.el('#arty')
    this.artyVeil = this.el('#arty-veil')
    this.rosterCount = this.el('#roster-count')
    this.stukaAlert = this.el('#stuka-alert')
    this.fps = this.el('#fps')
    this.fps.hidden = !SHOW_FPS
    this.applyLocale()
    onLangChange(() => this.applyLocale())
  }

  onPlay(handler: () => void): void {
    const run = (): void => {
      if (this.playBtn.disabled) return
      handler()
    }
    this.playBtn.addEventListener('pointerup', run)
    this.overlay.addEventListener('pointerup', (event) => {
      if (event.target === this.playBtn) return
      if (event.target instanceof Element && event.target.closest('#lang-switch')) return
      run()
    })
  }

  setLoadProgress(percent: number): void {
    this.mode = 'load'
    this.loadPct = Math.round(percent)
    this.setStatus(t().overlay.loadingModels(this.loadPct))
  }

  readyToPlay(): void {
    this.mode = 'ready'
    this.lastReport = null
    const s = t()
    this.tag.textContent = KID_MODE ? s.overlay.tagKid : s.overlay.tag
    this.setStatus(s.overlay.clickToAim)
    this.help.hidden = false
    this.stats.hidden = true
    this.stats.replaceChildren()
    this.playBtn.disabled = false
    this.playBtn.textContent = s.overlay.enterArena
    this.showOverlay()
  }

  setStatus(text: string): void {
    this.status.textContent = text
  }

  showOverlay(): void {
    this.overlay.classList.remove('hidden')
    setLangSwitchVisible(true)
  }

  hideOverlay(): void {
    this.overlay.classList.add('hidden')
    setLangSwitchVisible(false)
  }

  setAtmosphere(text: string): void {
    this.atmos.textContent = text
  }

  update(
    playerHp: number,
    playerMax: number,
    kills: number,
    reload: number,
    gunPitch: number,
    pitchMin: number,
    pitchMax: number,
    repairing = false,
    artyCharge = 1,
    tksInField = 1,
  ): void {
    this.hpPlayer.style.width = `${(playerHp / playerMax) * 100}%`
    this.hpPlayer.classList.toggle('repairing', repairing)
    this.kills.textContent = String(kills)
    this.reload.style.width = `${repairing ? 0 : Math.max(0, Math.min(1, reload)) * 100}%`
    this.repairing = repairing
    this.gunLabel.textContent = repairing ? t().hud.repairing : t().hud.gun
    const span = Math.max(pitchMax, Math.abs(pitchMin), 0.01)
    const y = (-gunPitch / span) * 42
    this.pitchPip.style.transform = `translate(-50%, calc(-50% + ${y}px))`
    this.arty.classList.toggle('ready', artyCharge >= 1)
    this.artyVeil.style.transform = `scaleY(${1 - Math.max(0, Math.min(1, artyCharge))})`
    this.rosterCount.textContent = String(tksInField)
  }

  flash(text: string): void {
    this.notice.textContent = text
    this.notice.hidden = false
    this.notice.classList.add('show')
    window.clearTimeout(this.noticeHandle)
    this.noticeHandle = window.setTimeout(() => {
      this.notice.classList.remove('show')
      this.notice.hidden = true
    }, 4200)
  }

  setStukaAlert(on: boolean): void {
    this.stukaAlert.classList.toggle('on', on)
  }

  setFps(fps: number): void {
    if (this.fps.hidden) return
    const text = `${fps} FPS`
    if (text === this.fpsText) return
    this.fpsText = text
    this.fps.textContent = text
  }

  showDefeat(report: MissionStats): void {
    this.mode = 'defeat'
    this.lastReport = report
    const s = t()
    this.tag.textContent = s.defeat.tag
    this.setStatus(s.defeat.status)
    this.help.hidden = true
    this.stats.hidden = false
    this.stats.replaceChildren(
      row(s.defeat.kills, String(report.kills)),
      row(s.defeat.held, s.held(report.heldHours)),
      row(s.defeat.waves, String(report.wavesCleared)),
    )
    this.playBtn.disabled = false
    this.playBtn.textContent = s.defeat.restart
    this.showOverlay()
  }

  private applyLocale(): void {
    const s = t()
    this.gunLabel.textContent = this.repairing ? s.hud.repairing : s.hud.gun
    this.renderArtyHelp()
    if (this.mode === 'defeat' && this.lastReport) {
      this.paintDefeat(this.lastReport)
      return
    }
    this.tag.textContent = KID_MODE ? s.overlay.tagKid : s.overlay.tag
    if (this.mode === 'ready') {
      this.setStatus(s.overlay.clickToAim)
      this.playBtn.textContent = s.overlay.enterArena
      return
    }
    this.setStatus(s.overlay.loadingModels(this.loadPct))
    this.playBtn.textContent = s.overlay.waitModels
  }

  private paintDefeat(report: MissionStats): void {
    const s = t()
    this.tag.textContent = s.defeat.tag
    this.setStatus(s.defeat.status)
    this.stats.replaceChildren(
      row(s.defeat.kills, String(report.kills)),
      row(s.defeat.held, s.held(report.heldHours)),
      row(s.defeat.waves, String(report.wavesCleared)),
    )
    this.playBtn.textContent = s.defeat.restart
  }

  private renderArtyHelp(): void {
    const artyHelp = this.el('#help-arty')
    const s = t()
    if (KID_MODE) {
      artyHelp.replaceChildren()
      const key = document.createElement('kbd')
      key.textContent = 'Q'
      artyHelp.append(key, s.help.artyKid)
      return
    }
    const label = artyHelp.querySelector('[data-i18n="help.arty"]')
    if (label) label.textContent = s.help.arty
  }

  private el(selector: string): HTMLElement {
    const node = document.querySelector<HTMLElement>(selector)
    if (!node) throw new Error(`Brak elementu ${selector}`)
    return node
  }
}

function row(label: string, value: string): HTMLElement {
  const item = document.createElement('div')
  item.className = 'stat-row'
  const k = document.createElement('span')
  k.textContent = label
  const v = document.createElement('strong')
  v.textContent = value
  item.append(k, v)
  return item
}

export function formatHeldTime(gameHours: number): string {
  return t().held(gameHours)
}
