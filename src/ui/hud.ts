export type MissionStats = {
  kills: number
  wavesCleared: number
  held: string
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
  private noticeHandle = 0

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
  }

  onPlay(handler: () => void): void {
    const run = (): void => {
      if (this.playBtn.disabled) return
      handler()
    }
    this.playBtn.addEventListener('pointerup', run)
    this.overlay.addEventListener('pointerup', (event) => {
      if (event.target === this.playBtn) return
      run()
    })
  }

  setLoadProgress(percent: number): void {
    this.setStatus(`Ładowanie modeli… ${Math.round(percent)}%`)
  }

  readyToPlay(): void {
    this.tag.textContent = 'Osłona odwrotu · Sieraków 1939'
    this.setStatus('Kliknij, aby celować')
    this.help.hidden = false
    this.stats.hidden = true
    this.stats.replaceChildren()
    this.playBtn.disabled = false
    this.playBtn.textContent = 'Wjedź na arenę'
    this.showOverlay()
  }

  setStatus(text: string): void {
    this.status.textContent = text
  }

  showOverlay(): void {
    this.overlay.classList.remove('hidden')
  }

  hideOverlay(): void {
    this.overlay.classList.add('hidden')
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
  ): void {
    this.hpPlayer.style.width = `${(playerHp / playerMax) * 100}%`
    this.hpPlayer.classList.toggle('repairing', repairing)
    this.kills.textContent = String(kills)
    this.reload.style.width = `${repairing ? 0 : Math.max(0, Math.min(1, reload)) * 100}%`
    this.gunLabel.textContent = repairing ? 'Naprawa — bez ognia' : 'Działo'
    const span = Math.max(pitchMax, Math.abs(pitchMin), 0.01)
    const y = (-gunPitch / span) * 42
    this.pitchPip.style.transform = `translate(-50%, calc(-50% + ${y}px))`
    this.arty.classList.toggle('ready', artyCharge >= 1)
    this.artyVeil.style.transform = `scaleY(${1 - Math.max(0, Math.min(1, artyCharge))})`
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

  showDefeat(report: MissionStats): void {
    this.tag.textContent = 'Odwrotu nie utrzymano'
    this.setStatus('TKS zniszczony. Taki był smutny los Polaków w 1939.')
    this.help.hidden = true
    this.stats.hidden = false
    this.stats.replaceChildren(
      row('Zniszczone maszyny wroga', String(report.kills)),
      row('Osłona odwrotu', report.held),
      row('Oparte fale', String(report.wavesCleared)),
    )
    this.playBtn.disabled = false
    this.playBtn.textContent = 'Restart misji'
    this.showOverlay()
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
  const total = Math.max(0, gameHours)
  const days = Math.floor(total / 24)
  const hours = Math.floor(total % 24)
  const minutes = Math.floor((total * 60) % 60)
  const parts: string[] = []
  if (days > 0) parts.push(polishCount(days, 'dzień', 'dni', 'dni'))
  if (hours > 0) parts.push(polishCount(hours, 'godzinę', 'godziny', 'godzin'))
  if (parts.length === 0) {
    if (minutes <= 0) return 'mniej niż minutę'
    parts.push(polishCount(minutes, 'minutę', 'minuty', 'minut'))
  }
  if (parts.length === 1) return parts[0]
  return `${parts[0]} i ${parts[1]}`
}

function polishCount(n: number, one: string, few: string, many: string): string {
  const word = n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many
  return `${n} ${word}`
}
