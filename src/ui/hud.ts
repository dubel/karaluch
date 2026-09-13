export class Hud {
  private readonly overlay: HTMLElement
  private readonly status: HTMLElement
  private readonly playBtn: HTMLButtonElement
  private readonly hpPlayer: HTMLElement
  private readonly hpBot: HTMLElement
  private readonly reload: HTMLElement
  private readonly pitchPip: HTMLElement
  private readonly atmos: HTMLElement

  constructor() {
    this.overlay = this.el('#overlay')
    this.status = this.el('#overlay-status')
    this.playBtn = this.el('#play-btn') as HTMLButtonElement
    this.hpPlayer = this.el('#hp-player')
    this.hpBot = this.el('#hp-bot')
    this.reload = this.el('#reload-fill')
    this.pitchPip = this.el('#pitch-pip')
    this.atmos = this.el('#atmos')
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
    this.setStatus('Kliknij, aby celować')
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
    botHp: number,
    botMax: number,
    reload: number,
    gunPitch: number,
    pitchMin: number,
    pitchMax: number,
  ): void {
    this.hpPlayer.style.width = `${(playerHp / playerMax) * 100}%`
    this.hpBot.style.width = `${(botHp / botMax) * 100}%`
    this.reload.style.width = `${Math.max(0, Math.min(1, reload)) * 100}%`
    const span = Math.max(pitchMax, Math.abs(pitchMin), 0.01)
    const y = (-gunPitch / span) * 42
    this.pitchPip.style.transform = `translate(-50%, calc(-50% + ${y}px))`
  }

  roundOver(won: boolean): void {
    this.setStatus(won ? 'Wygrana — R restart' : 'Porażka — R restart')
    this.playBtn.disabled = false
    this.playBtn.textContent = 'Restart'
    this.showOverlay()
  }

  private el(selector: string): HTMLElement {
    const node = document.querySelector<HTMLElement>(selector)
    if (!node) throw new Error(`Brak elementu ${selector}`)
    return node
  }
}
