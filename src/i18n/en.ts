import type { Strings } from './types'

export const en: Strings = {
  meta: {
    title: 'Cockroach — tank arena',
    htmlLang: 'en',
    brand: 'COCKROACH',
  },
  lang: {
    group: 'Language',
    pl: 'Polski',
    en: 'English',
  },
  boot: {
    label: 'Loading',
    loading: (pct) => `Loading… ${pct}%`,
    failed: (msg) => `Failed to load. ${msg}`,
    missingCanvas: 'Missing canvas #game',
  },
  intro: {
    crawl: `It is 19 September 1939. The German Third Reich's brutal invasion of Poland rages on. Only two days ago the heroic Polish Army took a mortal blow from behind — from the east, the armies of the Soviet Union crossed the border.

Despite a hopeless situation, the Poles have not laid down their arms. Yesterday, in a woodland clash near Pociecha, a Polish tankette did the impossible, destroying a German armour column. In the burning husk of a Panzer IV died the German prince Viktor IV von Ratibor.

The secret of that success is the low, nimble TKS tankette, armed with a lethal 20 mm cannon. The Wehrmacht scornfully calls these vehicles "cockroaches". Polish tankers took the nickname with pride — and mean to prove how painful their bite can be.

You take command of a machine in the platoon of Cadet Corporal Edmund Orlik. The German armoured force is now counter-attacking the village of Sieraków, trying to cut off Polish units falling back toward Warsaw.

Your task: cover the allies' retreat for as long as you can. You will not defeat them all — but every wrecked machine is another minute of life for those marching to Warsaw.

Good luck, soldier!`,
    skip: 'Press any key to skip',
  },
  overlay: {
    tag: 'Covering the retreat · Sieraków 1939',
    tagKid: 'Covering the retreat · kids mode',
    clickToAim: 'Click to aim',
    enterArena: 'Enter the arena',
    waitModels: 'Waiting for models',
    loadingModels: (pct) => `Loading models… ${pct}%`,
    loadFailed: (msg) => `Failed to load models. ${msg}`,
  },
  help: {
    drive: 'hull drive',
    mouseYaw: 'left/right — hull turn',
    elevate: 'or up/down — gun elevation',
    fire: 'fire',
    arty: 'artillery strike (3× on day one, then less often)',
    artyKid: ' artillery strike (every 2 hours of game time)',
    markers: 'ally and enemy markers',
    workshop: 'green wrench — workshop: repair 2%/s, no firing',
    restart: 'restart mission',
  },
  keys: {
    mouse: 'Mouse',
    lmb: 'LMB',
    space: 'Space',
  },
  hud: {
    tks: 'TKS',
    kills: 'Destroyed',
    gun: 'Gun',
    repairing: 'Repairing — no fire',
    arty: 'Artillery',
    roster: 'TKS on the field',
    stuka: 'Stuka raid incoming!',
  },
  weather: {
    clear: 'clear',
    clouds: 'cloudy',
    overcast: 'overcast',
    rain: 'rain',
    storm: 'storm',
    fog: 'fog',
    rainFog: 'rain and fog',
    stormFog: 'storm and fog',
  },
  flash: {
    markersOn: 'Markers on',
    markersOff: 'Markers off',
    noArtyTargets: 'No artillery targets',
    artyIncoming: 'Artillery strike!',
    artyReady: 'Artillery ready',
    allyJoins: 'A cockroach from Orlik’s platoon joins the cover!',
  },
  defeat: {
    tag: 'The retreat did not hold',
    status: 'TKS destroyed. Such was the sad fate of Poles in 1939.',
    kills: 'Enemy machines destroyed',
    held: 'Retreat covered',
    waves: 'Waves held',
    restart: 'Restart mission',
  },
  held: formatHeldEn,
}

function formatHeldEn(gameHours: number): string {
  const total = Math.max(0, gameHours)
  const days = Math.floor(total / 24)
  const hours = Math.floor(total % 24)
  const minutes = Math.floor((total * 60) % 60)
  const parts: string[] = []
  if (days > 0) parts.push(countEn(days, 'day', 'days'))
  if (hours > 0) parts.push(countEn(hours, 'hour', 'hours'))
  if (parts.length === 0) {
    if (minutes <= 0) return 'less than a minute'
    parts.push(countEn(minutes, 'minute', 'minutes'))
  }
  if (parts.length === 1) return parts[0]
  return `${parts[0]} and ${parts[1]}`
}

function countEn(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
