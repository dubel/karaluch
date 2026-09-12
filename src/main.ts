import './style.css'
import { Game } from './game/Game'
import { Hud } from './ui/hud'

const canvas = document.querySelector<HTMLCanvasElement>('#game')
if (!canvas) {
  throw new Error('Brak canvas #game')
}

const hud = new Hud()
const game = new Game(canvas, hud)

game.start().catch((error: unknown) => {
  console.error(error)
  hud.setStatus('Nie udało się załadować modeli.')
})
