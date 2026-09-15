import type { Strings } from './types'

export const pl: Strings = {
  meta: {
    title: 'Karaluch — arena czołgów',
    htmlLang: 'pl',
    brand: 'KARALUCH',
  },
  lang: {
    group: 'Język',
    pl: 'Polski',
    en: 'English',
  },
  boot: {
    label: 'Ładowanie',
    loading: (pct) => `Ładowanie… ${pct}%`,
    failed: (msg) => `Nie udało się załadować. ${msg}`,
    missingCanvas: 'Brak canvas #game',
  },
  intro: {
    crawl: `Jest 19 września 1939 roku. Trwa brutalna agresja niemieckiej III Rzeszy na Rzeczpospolitą. Zaledwie dwa dni temu bohaterska armia polska otrzymała śmiertelny cios w plecy — od wschodu granice przekroczyły wojska Związku Sowieckiego.

Mimo beznadziejnej sytuacji, Polacy nie składają broni. Wczoraj w leśnej potyczce pod Pociechą polska tankietka dokonała niemożliwego, niszcząc niemiecką kolumnę pancerną. W płonącym Panzer IV zginął niemiecki książę Wiktor IV von Ratibor.

Tajemnicą tego sukcesu jest niska, zwrotna tankietka TKS, uzbrojona w zabójcze działko kalibru 20 mm. Wehrmacht pogardliwie nazywa te pojazdy „karaluchami”. Polscy czołgiści przyjęli ten przydomek z dumą — i zamierzają udowodnić, jak bolesne potrafi być ich ukąszenie.

Obejmujesz dowodzenie nad maszyną w plutonie kaprala podchorążego Edmunda Orlika. Niemiecka machina pancerna rusza właśnie do kontrataku na wieś Sieraków, próbując odciąć drogę odwrotu polskim oddziałom zmierzającym do Warszawy.

Twój cel: jak najdłużej osłaniać odwrót sojuszników. Nie pokonasz ich wszystkich — ale każda zniszczona maszyna to minuta życia dla tych, którzy idą do Warszawy.

Powodzenia, żołnierzu!`,
    skip: 'Wciśnij dowolny klawisz by pominąć',
  },
  overlay: {
    tag: 'Osłona odwrotu · Sieraków 1939',
    tagKid: 'Osłona odwrotu · tryb dla dzieci',
    clickToAim: 'Kliknij, aby celować',
    enterArena: 'Wjedź na arenę',
    waitModels: 'Czekaj na modele',
    loadingModels: (pct) => `Ładowanie modeli… ${pct}%`,
    loadFailed: (msg) => `Nie udało się załadować modeli. ${msg}`,
  },
  help: {
    drive: 'jazda kadłubem',
    mouseYaw: 'lewo/prawo — obrót kadłuba',
    elevate: 'lub góra/dół — elewacja lufy',
    fire: 'ogień',
    arty: 'nalot artyleryjski (3× pierwszego dnia, potem rzadziej)',
    artyKid: ' nalot artyleryjski (co 2 godziny czasu gry)',
    markers: 'znaczniki sojuszników i wrogów',
    workshop: 'zielony klucz — warsztat: naprawa 2%/s, bez ognia',
    restart: 'restart misji',
  },
  keys: {
    mouse: 'Mysz',
    lmb: 'LPM',
    space: 'Spacja',
  },
  hud: {
    tks: 'TKS',
    kills: 'Zniszczone',
    gun: 'Działo',
    repairing: 'Naprawa — bez ognia',
    arty: 'Artyleria',
    roster: 'TKS na polu bitwy',
    stuka: 'Uwaga nalot Stuka!',
  },
  weather: {
    clear: 'bezchmurnie',
    clouds: 'zachmurzenie',
    overcast: 'pochmurno',
    rain: 'deszcz',
    storm: 'burza',
    fog: 'mgła',
    rainFog: 'deszcz i mgła',
    stormFog: 'burza i mgła',
  },
  flash: {
    markersOn: 'Znaczniki włączone',
    markersOff: 'Znaczniki wyłączone',
    noArtyTargets: 'Brak celów dla nalotu',
    artyIncoming: 'Nalot artyleryjski!',
    artyReady: 'Artyleria gotowa',
    allyJoins: 'Karaluch z plutonu Orlika dołącza do osłony!',
  },
  defeat: {
    tag: 'Odwrotu nie utrzymano',
    status: 'TKS zniszczony. Taki był smutny los Polaków w 1939.',
    kills: 'Zniszczone maszyny wroga',
    held: 'Osłona odwrotu',
    waves: 'Oparte fale',
    restart: 'Restart misji',
  },
  held: formatHeldPl,
}

function formatHeldPl(gameHours: number): string {
  const total = Math.max(0, gameHours)
  const days = Math.floor(total / 24)
  const hours = Math.floor(total % 24)
  const minutes = Math.floor((total * 60) % 60)
  const parts: string[] = []
  if (days > 0) parts.push(countPl(days, 'dzień', 'dni', 'dni'))
  if (hours > 0) parts.push(countPl(hours, 'godzinę', 'godziny', 'godzin'))
  if (parts.length === 0) {
    if (minutes <= 0) return 'mniej niż minutę'
    parts.push(countPl(minutes, 'minutę', 'minuty', 'minut'))
  }
  if (parts.length === 1) return parts[0]
  return `${parts[0]} i ${parts[1]}`
}

function countPl(n: number, one: string, few: string, many: string): string {
  const word = n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many
  return `${n} ${word}`
}
