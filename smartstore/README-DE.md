# BüroVersum RPG – Einbindung in Smartstore (Page Builder / Custom Code)

Das Spiel lässt sich auf **zwei Wegen** in eine Smartstore-Seite einbinden.
Beide Varianten kommen mit fertigen Snippets daher, die du 1:1 in den
Page-Builder kopieren kannst.

> **URL anpassen:** Die Snippets zeigen auf die ausgelieferte Website
> `https://kenk-jadev.github.io/BVersum-Gamecode/`. Betreibst du das Spiel auf
> einer eigenen Domain, ersetze die URL in den Snippets entsprechend.

---

## Variante A – iframe (empfohlen)

**Datei:** [`snippet-iframe.html`](snippet-iframe.html)

Das Spiel läuft in einem eigenen iframe und ist damit **komplett vom Shop
isoliert** (eigene CSS-Variablen, eigener localStorage-Speicher, keine
Konflikte mit Theme, jQuery oder anderen Widgets). Das ist die robusteste
Lösung und funktioniert auch, wenn der Custom-Code-Block Scripts nur
eingeschränkt ausführt.

### Schritte

1. Seite im Smartstore-Backend öffnen (z. B. **Content → Seiten / Topics**)
   oder eine neue CMS-Seite anlegen.
2. Den **Page Builder** öffnen und ein Widget für eigenen Code hinzufügen
   („HTML“, „Custom Code“ o. Ä. – je nach Smartstore-Version).
3. Den Inhalt von `snippet-iframe.html` vollständig einfügen.
4. Speichern, Vorschau prüfen, veröffentlichen.

### Hinweise

- `aspect-ratio: 16/10` + `min-height: 560px` sorgt dafür, dass das Spiel auf
  Desktop und Handy gleich gut skaliert. Werte im Snippet frei anpassbar.
- `?autoopen=1` an die iframe-URL hängen, wenn direkt das Spiel starten soll
  (ohne die Promo-Karte): `…/embed.html?autoopen=1`
- Der Shop braucht **keine** CSP-Änderung, da nur eine Verbindung zur
  Spiel-Domain aufgebaut wird. Steht im Shop dennoch eine strenge
  `frame-src`-CSP, `https://kenk-jadev.github.io` dort erlauben.

---

## Variante B – Spielcode direkt im Custom-Code-Block

**Datei:** [`generated/direct-embed.html`](generated/direct-embed.html) *(wird vom Build erzeugt)*

Hier liegt der komplette Spielcode in der Shop-Seite (so wie im ursprünglichen
Aufbau). Das Build-Skript hat diese Variante für den Einsatz im Shop
vorbereitet:

- ✅ **CSS-Variablen isoliert:** Alle `--primary`, `--gold`, … sind zu
  `--bv-primary`, `--bv-gold`, … umbenannt und können das Shop-Theme nicht
  überschreiben.
- ✅ **DSGVO:** Fonts und Twemoji-Emojis werden von der Spiel-Website geladen,
  es gibt keine Anfragen an Google oder jsDelivr.
- ✅ **Mixed Content behoben:** Das Flyer-Bild lädt über https, bei Fehlschlag
  wird es ausgeblendet.
- ✅ **Robustes Startverhalten:** Initialisiert auch dann korrekt, wenn der
  Code-Block erst nach `DOMContentLoaded` in die Seite kommt.

### Schritte

1. `generated/direct-embed.html` erzeugen: im Repo `python tools/build.py`
   ausführen (Datei liegt dann unter `smartstore/generated/`).
2. Den **gesamten** Inhalt in den Custom-Code-Block der Smartstore-Seite
   einfügen.
3. Speichern und Vorschau prüfen.

### Warnungen

- Die Datei ist ca. **2,5 MB** – manche Admin-Editoren werden bei so großen
  Blöcken träge oder begrenzen die Eingabe. Wenn das Backend streikt,
  Variante A oder C nutzen.
- Einzelne Regeln des Spiels betreffen weiterhin `body` (z. B.
  `body.rpg-active { overflow: hidden }`) – das ist gewollt und nur aktiv,
  während das Spiel offen ist.
- `document.addEventListener`-Handler des Spiels laufen während des Spieltexts
  im Capture-Modus und können Tastatur-Eingaben abfangen – auch hier nur
  relevant, während das Overlay offen ist.

---

## Variante C – Loader (schlanker Custom Code, Spiel im Shop-DOM)

**Datei:** [`snippet-loader.html`](snippet-loader.html)

Ein kleiner Code-Block (unter 2 KB), der den Spielcode beim Laden von
`…/game-fragment.html` nachlädt und injiziert. Vorteil gegenüber Variante B:
Der Page-Builder-Block bleibt klein und wartbar. Nachteil gegenüber Variante A:
Styles und Scripts laufen im Shop-DOM (mit den oben genannten, abgeschirmten
Einschränkungen).

1. `snippet-loader.html` in den Custom-Code-Block einfügen.
2. Sicherstellen, dass `https://kenk-jadev.github.io/BVersum-Gamecode/game-fragment.html`
   öffentlich erreichbar ist (Standardfall).
3. Vorschau prüfen. Fehler landen mit Präfix `[BüroVersum]` in der Browser-
   Konsole; zusätzlich wird ein Link-Fallback angezeigt.

---

## FAQ / Troubleshooting

**Das Spiel erscheint nicht.**
Zuerst die Vorschau der Seite prüfen. Bei Variante A: iframe-URL im Browser
direkt öffnen (`…/embed.html`). Blockiert ein Ad-Blocker oder die Shop-CSP die
Einbettung, in der Konsole nach `Refused`-Meldungen suchen.

**Die Emojis sehen unterschiedlich aus.**
Das Spiel ersetzt Emojis durch Twemoji-SVGs (konsistente Darstellung unter
Windows). Dafür lädt es Dateien von der Spiel-Website – kein Drittanbieter.

**Speicherstände.**
Der Spielstand liegt im `localStorage` der jeweiligen Origin. Bei Variante A
ist das die Spiel-URL (Spielstand bleibt über alle eingebetteten Seiten
identisch). Bei B/C ist es die Shop-Domain.

**Countdown / „Exklusiv bis 31.03.2026“.**
Das Datum ist im Spielcode hinterlegt (Text + Countdown-Ziel) und bereits
abgelaufen – die Anzeige zeigt dann 00 an. Text und Ziel-Datum können bei Bedarf
im Quellcode (Widget-Bereich ganz oben) angepasst werden.

**Tastatur im Shop reagiert nicht mehr.**
Nur möglich, während das Spiel-Overlay offen ist (das Overlay fängt Tasten ab).
Overlay über das ✕ oben rechts schließen.
