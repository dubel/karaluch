# Karaluch

Arena czołgów w przeglądarce (TKS vs Pz.Kpfw. III) — wrzesień, południowa Polska.

Lokalnie: `npx vite --host 127.0.0.1 --port 5173` → [http://127.0.0.1:5173/karaluch/](http://127.0.0.1:5173/karaluch/)

Live: [https://dubel.dev/karaluch/](https://dubel.dev/karaluch/)

Runda startuje o **8:00**. Doba trwa ok. 8 minut prawdziwego czasu. Pogoda jest losowa (wrzesień 1939 — częściej pogodnie niż opady). Mgła i burze też wchodzą same.

## Parametry URL

Doklej query string do adresu gry. Bez `fixed` wartości z URL-a to tylko **punkt startowy** — dzień i pogoda dalej się zmieniają.

| Parametr | Wartości | Domyślnie |
| --- | --- | --- |
| `hour` | `0`–`24` (np. `8`, `18.5`, `22`) | `8` |
| `weather` | `clear`, `clouds`, `overcast`, `rain`, `storm` | losowo |
| `mist` | `true` / `false` (albo `1` / `0`) | losowe zapadanie mgły |
| `fixed` | `true` / `false` | `false` |
| `pauseday` | `true` / `1` | wyłączone |

`fixed=true` **zamraża tylko to, co podasz w URL-u**:

- `hour` + `fixed=true` — stoi pora dnia
- `weather` + `fixed=true` — stoi pogoda
- `mist` + `fixed=true` — stoi mgła (albo jej brak)

`pauseday=true` nadal zatrzymuje sam zegar, nawet bez `fixed`.

### Przykłady

Pogodny poranek, potem cykl toczy się sam:

```
?hour=8&weather=clear
```

Nocny deszcz, nic się nie zmienia:

```
?hour=22&weather=rain&fixed=true
```

Poranna mgła do screenów:

```
?hour=8&weather=clouds&mist=true&fixed=true
```

Burza na horyzoncie:

```
?hour=16&weather=storm&fixed=true
```

Lokalnie:

`http://127.0.0.1:5173/karaluch/?hour=8&weather=clear&fixed=true`
