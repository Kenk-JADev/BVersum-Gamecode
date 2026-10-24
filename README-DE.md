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
| `/` | Landing-Page mit Hero, Promo-Karte, Features, Anleitung, FAQ und dem Spiel selbst |
| `/embed.html` | schlanke Seite für iframes (`?autoopen=1` öffnet das Spiel direkt) |
| `/game-fragment.html` | reines Spiel-Fragment (für Custom-Code-Einbettung) |
| `/404.html` | gestaltete Fehlerseite (GitHub Pages nutzt sie automatisch) |
| `/manifest.webmanifest` | Web-App-Manifest (Icon, Name, Farbe – „Zum Startbildschirm“) |
| `/robots.txt`, `/sitemap.xml` | Crawler-Steuerung; `embed.html`/`game-fragment.html` sind ausgeschlossen |

Die Landing-Page bringt außerdem Open-Graph-/Twitter-Meta (Vorschaukarte beim
Teilen), JSON-LD (`VideoGame`), Preload der Schriften und `canonical`.
Alle eigenen CSS-Klassen dort sind mit `bvx-` gepräfixt und alle Variablen mit
`--bvx-`, damit sie nicht mit den `bv-*`-Klassen und `--bv-*`-Variablen des
Spiels kollidieren (das Spiel bleibt vollständig unverändert).

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
├── tools/make-brand.py                  # erzeugt OG-Bild + App-Icons (Pillow)
├── assets-src/                          # Brand-Assets (OG-Bild, Icons, Hero-Grafik)
├── smartstore/                          # Smartstore-Snippets + Anleitung
├── public/                              # Build-Ausgabe (GitHub Pages, gitignored)
└── .github/workflows/deploy.yml         # Build + Deploy-Pipeline
```

Build lokal ausführen (Python 3.9+):

```bash
python tools/build.py
```

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

**Brand-Assets (OG-Bild & Icons):** `assets-src/` enthält das Social-Preview-Bild
(1200 × 630) sowie die App-Icons (192/512 px, Apple-Touch-Icon) und die
Hero-Grafik. Sie sind eingecheckt – der Build kopiert sie nur nach `public/assets/`.
Neu erzeugen lassen sie sich jederzeit mit:

```bash
pip install pillow
python tools/make-brand.py
```

Der Build läuft auch ohne Pillow; fehlt ein Asset, gibt er nur eine Warnung aus.

### Was der Build anpasst (Quell-Datei bleibt unangetastet)

| Patch | Warum |
|---|---|
| Fonts & Twemoji selbst gehostet | DSGVO (keine Anfragen an Google/jsDelivr), offline-fähig |
| Flyer-Bild robust (protokoll-passend, 5-s-Timeout, Fallback-Platzhalter) | kein Mixed Content, keine leeren Lücken bei Host-Ausfall |
| Robustes Bootstrapping (`__bvMainInit`) | funktioniert auch bei später Injektion, kein Doppel-Start |
| CSS-Variablen `--bv-*` (Smartstore-Variante) | Shop-Theme wird nicht überschrieben |
| Promo-Karte mit `role="button"`, `tabindex`, `aria-label` | Spiel ist per Tab + Enter startbar |
| Eigene Landing-Klassen `bvx-*`, Variablen `--bvx-*` | keine Kollision mit Spiel-Klassen (u. a. `.bv-card`) |

---

## 📦 Lizenzen / Credits

- Spielcode: © 2026 BüroVersum GmbH – Entwickelt von Justin
- Emoji-Grafiken: [Twemoji](https://github.com/jdecked/twemoji) v17 (Graphics CC-BY 4.0)
- Fonts: [VT323](https://fonts.google.com/specimen/VT323) & [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (SIL Open Font License)
