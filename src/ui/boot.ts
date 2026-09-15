import { Cache, type Object3D } from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { BOT_RIG, PLAYER_RIG } from '../game/config'
import { t, onLangChange } from '../i18n'

Cache.enabled = true

export type IntroAssets = {
  tks: Object3D
  pz: Object3D
}

export async function preloadIntroAssets(): Promise<IntroAssets> {
  const loader = new GLTFLoader()
  const loaded = [0, 0]
  const totals = [0, 0]
  const [tks, pz] = await Promise.all([
    loadGltf(loader, PLAYER_RIG.url, (done, total) => {
      loaded[0] = done
      totals[0] = total
      paintProgress(loaded, totals)
    }),
    loadGltf(loader, BOT_RIG.url, (done, total) => {
      loaded[1] = done
      totals[1] = total
      paintProgress(loaded, totals)
    }),
  ])
  paintPercent(1)
  return { tks: tks.scene, pz: pz.scene }
}

export function dismissBoot(): void {
  const boot = document.getElementById('boot')
  document.body.classList.remove('boot-open')
  if (!boot) return
  boot.classList.add('boot-out')
  window.setTimeout(() => boot.remove(), 320)
}

export function bootFailed(message: string): void {
  const status = document.getElementById('boot-status')
  if (status) status.textContent = message
}

function loadGltf(
  loader: GLTFLoader,
  url: string,
  onBytes: (loaded: number, total: number) => void,
): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      resolve,
      (event) => {
        if (event.lengthComputable) onBytes(event.loaded, event.total)
      },
      reject,
    )
  })
}

function paintProgress(loaded: number[], totals: number[]): void {
  const total = totals[0] + totals[1]
  if (total <= 0) return
  paintPercent((loaded[0] + loaded[1]) / total)
}

function paintPercent(p: number): void {
  const fill = document.getElementById('boot-fill')
  const status = document.getElementById('boot-status')
  const pct = Math.round(Math.max(0, Math.min(1, p)) * 100)
  if (fill) fill.style.width = `${pct}%`
  if (status) status.textContent = t().boot.loading(pct)
}

onLangChange(() => {
  const fill = document.getElementById('boot-fill')
  if (!fill) return
  const pct = Math.round(Number.parseFloat(fill.style.width) || 0)
  paintPercent(pct / 100)
})
