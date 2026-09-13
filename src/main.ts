import './style.css'
import { Game } from './game/Game'
import { Hud } from './ui/hud'
import { playIntro } from './ui/intro'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) {
  throw new Error('Brak canvas #game')
}

const hud = new Hud()

playIntro()
  .catch((error: unknown) => {
    console.error(error)
  })
  .then(() => {
    const game = new Game(canvas, hud)
    return game.start()
  })
  .catch((error: unknown) => {
    console.error(error)
    const message = error instanceof Error ? error.message : String(error)
    hud.setStatus(`Nie udało się załadować modeli. ${message}`)
  })
