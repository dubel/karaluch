export type Lang = 'pl' | 'en'

export type Strings = {
  meta: {
    title: string
    htmlLang: string
    brand: string
  }
  lang: {
    group: string
    pl: string
    en: string
  }
  boot: {
    label: string
    loading: (pct: number) => string
    failed: (msg: string) => string
    missingCanvas: string
  }
  intro: {
    crawl: string
    skip: string
  }
  overlay: {
    tag: string
    tagKid: string
    clickToAim: string
    enterArena: string
    waitModels: string
    loadingModels: (pct: number) => string
    loadFailed: (msg: string) => string
  }
  help: {
    drive: string
    mouseYaw: string
    elevate: string
    fire: string
    arty: string
    artyKid: string
    markers: string
    workshop: string
    restart: string
  }
  keys: {
    mouse: string
    lmb: string
    space: string
  }
  hud: {
    tks: string
    kills: string
    gun: string
    repairing: string
    arty: string
    roster: string
    stuka: string
  }
  weather: {
    clear: string
    clouds: string
    overcast: string
    rain: string
    storm: string
    fog: string
    rainFog: string
    stormFog: string
  }
  flash: {
    markersOn: string
    markersOff: string
    noArtyTargets: string
    artyIncoming: string
    artyReady: string
    allyJoins: string
  }
  defeat: {
    tag: string
    status: string
    kills: string
    held: string
    waves: string
    restart: string
  }
  held: (gameHours: number) => string
}
