# 🏢 BüroVersum – Gamecode

**BüroVersum RPG** (Ultimate Edition v7.10.11) – ein Browser-RPG aus dem
Büroalltag, komplett in einer HTML-Datei: Widget-Promo-Karte mit Countdown,
Splash-Screen, isometrische Karte, Kampfsystem, Shop, Computer-Desktop,
Cutscenes, Battle-Editor und mehr.

Dieses Repo macht das Spiel **online spielbar** und **in Smartstore
einbettbar**.

---

## 🚀 Das Spiel online (GitHub Pages)

Die Website wird automatisch per GitHub Actions gebaut und auf
**GitHub Pages** veröffentlicht:

> **https://kenk-jadev.github.io/BVersum-Gamecode/**

| URL | Inhalt |
|---|---|
| `/` | Landing-Seite mit Promo-Karte + Spiel |
| `/embed.html` | schlanke Seite für iframes (`?autoopen=1` öffnet das Spiel direkt) |
| `/game-fragment.html` | reines Spiel-Fragment (für Custom-Code-Einbettung) |

**Deployment:** Jeder Push auf `main` oder einen `arena/*`-Zweig löst
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) aus:
`tools/build.py` erzeugt `public/`, das zu GitHub Pages ausgeliefert wird.
Manuell geht es auch mit *Actions → Deploy BüroVersum to GitHub Pages → Run workflow*.

**Eigene Domain:** Statt GitHub Pages kann `public/` auch auf jeden anderen
statischen Host (Netlify, Vercel, nginx, IIS, Smartstore-Medien-Server …).
Die Basis-URL in `tools/build.py` (`SITE_BASE_URL`) und in den Snippets
entsprechend anpassen.

---

## 🛒 Einbindung in Smartstore (Page Builder / Custom Code)

Fertige, kopierfertige Snippets liegen unter [`smartstore/`](smartstore/):

- **Variante A (empfohlen):** [`smartstore/snippet-iframe.html`](smartstore/snippet-iframe.html) –
  responsiver iframe im Custom-Code-Block, 100 % isoliert vom Shop.
- **Variante B:** [`smartstore/generated/direct-embed.html`](smartstore/generated/direct-embed.html) –
  kompletter Spielcode direkt im Page Builder (CSS-Variablen shop-sicher
  isoliert, DSGVO-konform, Mixed-Content-frei).
- **Variante C:** [`smartstore/snippet-loader.html`](smartstore/snippet-loader.html) –
  winziger Loader-Block, der den Spielcode zur Laufzeit nachlädt.

Schritt-für-Schritt-Anleitung inkl. Troubleshooting:
**[`smartstore/README-DE.md`](smartstore/README-DE.md)**

---

## 🛠️ Entwicklung / Build

```
BVersum-Gamecode/
├── Gamecode-Bueroversum-7.5 (16).html   # QUELLE – die Spiel-Datei (unverändert!)
├── tools/build.py                       # erzeugt public/ + smartstore/generated/
├── tools/test_build.py                  # Regressionstests (keine Deps, optional Node)
├── tools/smoke_test.js                  # Laufzeit-Test mit jsdom (optional)
├── tools/perf_test.js                   # Map-Engine Perf-Test mit jsdom
├── smartstore/                          # Smartstore-Snippets + Anleitung
├── public/                              # Build-Ausgabe (GitHub Pages, gitignored)
└── .github/workflows/deploy.yml         # Test + Build + Deploy-Pipeline
```

Build und Tests lokal ausführen (Python 3.9+, für den JS-Syntaxcheck Node.js):

```bash
python tools/build.py
python tools/test_build.py
```

Die Tests prüfen u. a. ausgeglichene DOM-Struktur, gültiges JavaScript in
allen Inline-Scripts, DSGVO-konforme Assets, isolierte CSS-Variablen,
spätes Initialisieren (Loader-Variante) und den Build-Stempel. Sie laufen vor
jedem Deployment automatisch in der GitHub Action – ein fehlgeschlagener Test
verhindert das Veröffentlichen.

Zusätzlich bootet der **Laufzeit-Smoke-Test** die gebaute Seite in jsdom
(Scripts, Twemoji, Initialisierung, Klick auf die Promo-Karte) und meldet
JS-Fehler. `perf_test.js` lädt eine echte Map und prüft die Render-Zähler.
Lokal ausführen:

```bash
npm install --prefix /tmp/bv-smoke jsdom@26
NODE_PATH=/tmp/bv-smoke/node_modules node tools/smoke_test.js
NODE_PATH=/tmp/bv-smoke/node_modules node tools/perf_test.js
```

---

## 🗺️ Map-Engine: Performance

Der Build patcht die Engine an neun exakt geprüften Stellen (Quelldatei bleibt
unangetastet). Gemessen mit jsdom beim Laden von `buero` (35 × 22 = 770 Tiles):

| Maßnahme | Vorher | Nachher |
|---|---|---|
| `ME.render()` pro Map-Ladevorgang | **2×** (62 ms + 200 ms) | **1×** (70 ms) |
| Minimap: `fillRect` über 2 Updates | 1574 | 34 (+ 2 `drawImage`) |
| Cutscene-Poller im Hintergrund | 3 Intervalle, ~6 Aufrufe/s – auch bei geschlossenem Spiel | 1 Intervall, 0 Aufrufe bei geschlossenem Spiel |

Konkret:

- **Kein Doppel-Render mehr:** `actuallyLoadMap()` rief über
  `BV3D.resizeToMap()` *und* `drawMap()` dieselbe `ME.render()` auf. Der zweite
  Lauf parste den gecachten SVG-String (133 KB / 1396 Knoten) nur, um ihn
  sofort vom Raster-Cache wieder zu leeren. `resizeToMap` setzt jetzt nur
  Bounds/Geometrie.
- **Raster-Guard:** Bei Rückkehr auf dieselbe Map (Kampf, Respawn, Spielstand)
  wird das vorhandene Rasterbild wiederverwendet statt die Live-SVG neu zu
  parsen. Fällt das Bild-Laden aus, greift automatisch der alte SVG-Pfad.
- **Minimap-Offscreen-Cache:** Statische Kacheln werden einmal pro Map in ein
  Offscreen-Canvas gezeichnet (Cache-Schlüssel = Identität von `currentMap`).
  Pro 150-ms-Update bleiben nur NPCs/Kisten/Spieler plus ein `drawImage`.
  `canvas.width/height` wird nur noch bei Größenänderung gesetzt.
- **Kleinere Hotspots:** Occluder-Observer schreibt `--occ-z` nur bei
  Änderung; der 2.5D-Schatten wird per `firstElementChild` statt per
  `querySelector` im gesamten Teilbaum gesucht; Partikel- und
  Settings-Poller laufen nur bei geöffnetem Overlay.

**Diagnose im Browser:** `window.BVMapPerf` liefert live
`{ renderCalls, skipped, minimapStatic, minimapFrames }`. Ideal nach einem
Map-Wechsel: `renderCalls` steigt um 1, `skipped` bleibt 0; bei Rückkehr auf
dieselbe Map steigt `skipped`. `minimapStatic` sollte deutlich seltener
steigen als `minimapFrames`.

Bewusst **nicht** geändert: Die NPC-Bewegung animiert weiterhin `left`/`top`
statt `transform`. Ein `transform` auf den Gameplay-Layern erzeugt neue
Stacking-Contexts und würde die Occlusion-/Z-Index-Logik (Wände vor Figuren)
zerstören – das ist im Code bewusst so dokumentiert.

**Weitere Kandidaten (noch offen, mit Absicht nicht blind gepatcht):**
`spawnOccluders()` erzeugt pro Wand-/Schreibtisch-Tile ein eigenes `<div>` mit
Inline-SVG; ein gemeinsames SVG wäre weniger DOM. Das Rasterbild nutzt
`img.decoding = 'sync'` (synchrones Decoding großer Data-URLs). Die drei
Cache-Keys bauen per `map.flat().join('')` große Strings; ein numerischer
Rolling-Hash wäre günstiger. Und einige weitere Dauer-Intervalle
(Quest-Log 1200 ms, Achievements 2000 ms) könnten ebenfalls auf
`rpg-active` gated werden. All das braucht einen visuellen Browsertest, bevor
es in den Build geht.

Das Skript lädt bei Bedarf automatisch die Vendor-Assets (Twemoji-Emojis +
Fonts VT323 / Press Start 2P) nach `tools/vendor/` und schreibt alle Artefakte
nach `public/` bzw. `smartstore/generated/`. Zum lokalen Testen:

```bash
python -m http.server 8080 --directory public
```

**Flyer-Bild lokal bündeln:** Legt man die Promo-Grafik als
`assets-src/flyer.jpg` ab, liefert die Website sie selbst aus (schnell, immer
erreichbar). Ohne Datei wird die Remote-Quelle `webshops.zuef.de` genutzt –
protokoll-passend, mit 5-Sekunden-Timeout und einem gestalteten
„Klick hier und starte das Spiel"-Fallback, falls das Bild nicht erreichbar ist.

### Was der Build anpasst (Quell-Datei bleibt unangetastet)

| Patch | Warum |
|---|---|
| Fonts & Twemoji selbst gehostet (ohne `crossorigin`-Zwang) | DSGVO (keine Anfragen an Google/jsDelivr), offline-fähig, funktioniert auch auf Hosts ohne CORS-Header |
| Flyer-Bild robust (protokoll-passend, 5-s-Timeout, Fallback-Platzhalter) | kein Mixed Content, keine leeren Lücken bei Host-Ausfall |
| Robustes Bootstrapping (`__bvMainInit`, bei Nachladen synchron) | funktioniert auch bei später Injektion, kein Doppel-Start, Engine startet vor allen Modulen |
| Fehlende `</div>`-Abschlüsse ergänzt | Rest der Shop-Seite landet nicht mehr im unsichtbaren `#rpg-overlay` |
| CSS-Variablen `--bv-*` (Smartstore-Variante) | Shop-Theme wird nicht überschrieben |
| Loader führt Scripts strikt sequenziell aus | Twemoji ist geladen, bevor die Spiel-Scripts starten; 4-s-Notfall-Timeout |
| Build-Stempel = Datum + SHA-256-Hash der Quelle | Shop und Website lassen sich wirklich auf denselben Code-Stand prüfen |
| Map-Engine-Patches (9 Anker) | ein Render pro Map-Ladevorgang, Raster-/Minimap-Caches, Hintergrund-Poller nur bei offenem Spiel – siehe Abschnitt „Map-Engine: Performance" |

---

## 📦 Lizenzen / Credits

- Spielcode: © 2026 BüroVersum GmbH – Entwickelt von Justin
- Emoji-Grafiken: [Twemoji](https://github.com/jdecked/twemoji) v17 (Graphics CC-BY 4.0)
- Fonts: [VT323](https://fonts.google.com/specimen/VT323) & [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (SIL Open Font License)
