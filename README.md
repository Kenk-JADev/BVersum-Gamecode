# 🏢 BüroVersum RPG - Ultimate Edition v7.10.10

Ein vollständiges Browser-RPG mit Office-Thema, Kampf-System, Quests, Achievements und integriertem Fake-OS.

## 🚀 Schnellstart

Öffne einfach `index.html` im Browser oder hoste das Projekt auf **GitHub Pages**.

---

## 📦 Einbinden auf anderen Websites (Embed Code)

Du kannst **BüroVersum** ganz einfach auf jeder Website einbinden.

### 1. Empfohlene Methode: GitHub Pages + iframe (empfohlen)

1. Lade das Projekt auf GitHub hoch
2. Aktiviere **GitHub Pages** unter `Settings → Pages → Source: GitHub Actions` oder `main` Branch
3. Deine Live-URL sieht dann so aus:  
   `https://deinusername.github.io/BVersum-Gamecode/`

### 2. Embed-Code (kopierfertig)

Füge folgenden HTML-Code auf deiner Website ein:

```html
<!-- BüroVersum RPG Embed -->
<iframe 
    src="https://DEIN-USERNAME.github.io/BVersum-Gamecode/"
    width="100%" 
    height="720"
    style="border: none; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2);"
    allowfullscreen
    title="BüroVersum - Das ultimative Büro-RPG">
</iframe>
```

### 3. Alternative: Lokale Einbindung (ohne GitHub Pages)

```html
<!-- Lokale Einbindung -->
<iframe 
    src="./BVersum-Gamecode/index.html"
    width="100%" 
    height="720"
    style="border: none; border-radius: 16px;"
    allowfullscreen>
</iframe>
```

### 4. Responsive Embed (empfohlen für mobile Websites)

```html
<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.15);">
    <iframe 
        src="https://DEIN-USERNAME.github.io/BVersum-Gamecode/"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
        allowfullscreen
        title="BüroVersum RPG">
    </iframe>
</div>
```

---

## 🛠️ Projektstruktur

```
BVersum-Gamecode/
├── index.html          # Hauptspiel (HTML-Skelett)
├── css/
│   └── main.css        # Alle Styles & Animationen
├── js/
│   ├── game.js         # Kern-Logik (Kampf, Maps, Inventar)
│   └── patches.js      # Hotfixes, Achievements, Cutscenes
├── assets/             # Bilder & Sounds (optional)
└── README.md
```

---

## ✨ Features

- Komplettes RPG mit Level-System
- 12 verschiedene Maps
- Echtzeit-Kampfsystem mit Skills & Items
- Fake-Büro-OS (E-Mail, Browser, Notepad)
- Achievement-System
- Level-Up-Choices
- Easter-Egg-Event
- Battle-Editor
- Mobile Touch-Controls
- Dark Mode + Performance-Optionen

---

## 📜 Lizenz

© 2026 BüroVersum GmbH – Entwickelt von Justin

---

## 🔗 Live-Demo

Sobald du das Projekt auf GitHub hochlädst und Pages aktivierst, ist es unter deiner GitHub Pages URL erreichbar.

---

**Tipp:** Für beste Performance auf fremden Websites empfehlen wir GitHub Pages + den responsiven iframe-Code oben.