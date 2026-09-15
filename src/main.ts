import './style.css'
import { Game } from './game/Game'
import { Hud } from './ui/hud'
import { bootFailed, preloadIntroAssets } from './ui/boot'
import { playIntro } from './ui/intro'
import { initLang, mountLangSwitch, t } from './i18n'

initLang()
mountLangSwitch()

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) {
  throw new Error(t().boot.missingCanvas)
}

const hud = new Hud()

preloadIntroAssets()
  .then((assets) => playIntro(assets))
  .then(() => {
    const game = new Game(canvas, hud)
    return game.start()
  })
  .catch((error: unknown) => {
    console.error(error)
    const message = error instanceof Error ? error.message : String(error)
    bootFailed(t().boot.failed(message))
    hud.setStatus(t().overlay.loadFailed(message))
  })
