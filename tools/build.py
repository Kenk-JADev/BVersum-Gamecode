#!/usr/bin/env python3
"""
BüroVersum – Build-Skript
=========================

Erzeugt aus der Quell-Datei ``Gamecode-Bueroversum-7.5 (16).html`` alle
Deploy-Artefakte. Die Quell-Datei bleibt unverändert – sämtliche Anpassungen
laufen als nachvollziehbare Text-Patches auf den erzeugten Kopien.

Ausgabe
-------
public/                          Statische Website (GitHub Pages)
  index.html                        Landing-Seite (Widget + Spiel)
  embed.html                        schlanke Seite für iframe-Einbettung
  game-fragment.html                reines Spiel-Fragment (Smartstore „Custom Code“)
  assets/fonts/…                    selbst gehostete Fonts (DSGVO-freundlich)
  assets/vendor/twemoji.min.js      Twemoji-Bibliothek (selbst gehostet)
  assets/vendor/twemoji/svg/…       Twemoji-SVGs (selbst gehostet)

smartstore/generated/
  direct-embed.html                 Kopie von game-fragment.html zum direkten
                                    Einfügen in den Smartstore-Page-Builder

Aufruf:  python tools/build.py
"""

from __future__ import annotations

import datetime
import re
import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Gamecode-Bueroversum-7.5 (16).html"
VENDOR = ROOT / "tools" / "vendor"
PUBLIC = ROOT / "public"
GENERATED = ROOT / "smartstore" / "generated"

# Öffentliche URL der ausgelieferten Website – wird für absolute Pfade im
# Smartstore-Fragment und in den Einbettungs-Snippets benutzt.
SITE_BASE_URL = "https://kenk-jadev.github.io/BVersum-Gamecode/"

NPM = "https://registry.npmjs.org"
TWEMOJI_API_TARBALL = f"{NPM}/@twemoji/api/-/api-17.0.3.tgz"
TWEMOJI_ASSETS_TARBALL = "https://codeload.github.com/jdecked/twemoji/tar.gz/refs/tags/v17.0.3"
VT323_TARBALL = f"{NPM}/@fontsource/vt323/-/vt323-5.3.0.tgz"
PS2P_TARBALL = f"{NPM}/@fontsource/press-start-2p/-/press-start-2p-5.3.0.tgz"

FONT_UNICODE_LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,"
    "U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,"
    "U+2215,U+FEFF,U+FFFD"
)
FONT_UNICODE_LATIN_EXT = (
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,"
    "U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,"
    "U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
)


def log(msg: str) -> None:
    print(f"[build] {msg}", flush=True)


# ---------------------------------------------------------------------------
# Vendor-Assets (Fonts + Twemoji) besorgen – im CI-Lauf frisch, lokal gecacht
# ---------------------------------------------------------------------------

def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    log(f"lade {url}")
    urllib.request.urlretrieve(url, dest)  # noqa: S310 – feste, interne URLs


def _extract_tgz(tgz: Path, dest: Path) -> None:
    import tarfile

    with tarfile.open(tgz, "r:gz") as tf:
        tf.extractall(dest)


def ensure_vendor() -> None:
    """Stellt sicher, dass tools/vendor/ vollständig ist (Download bei Bedarf)."""
    import tempfile

    twemoji_js = VENDOR / "twemoji.min.js"
    twemoji_svg = VENDOR / "twemoji-svg"
    fonts = VENDOR / "fonts"
    needed_fonts = [
        "vt323-latin-400-normal.woff2",
        "vt323-latin-ext-400-normal.woff2",
        "press-start-2p-latin-400-normal.woff2",
        "press-start-2p-latin-ext-400-normal.woff2",
    ]
    have = (
        twemoji_js.is_file()
        and twemoji_svg.is_dir()
        and any(twemoji_svg.glob("*.svg"))
        and all((fonts / f).is_file() for f in needed_fonts)
    )
    if have:
        log("Vendor-Cache vorhanden (tools/vendor)")
        return

    log("Vendor-Cache unvollständig – lade Assets neu")
    VENDOR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)

        # Twemoji-Library (global `twemoji`, wie vom Spiel genutzt)
        tgz = td_path / "twemoji-api.tgz"
        _download(TWEMOJI_API_TARBALL, tgz)
        ex = td_path / "api"
        _extract_tgz(tgz, ex)
        shutil.copyfile(ex / "package" / "dist" / "twemoji.min.js", twemoji_js)

        # Twemoji-SVGs (v17 – passend zur Library)
        tgz = td_path / "twemoji-svg.tgz"
        _download(TWEMOJI_ASSETS_TARBALL, tgz)
        ex = td_path / "svg"
        _extract_tgz(tgz, ex)
        if twemoji_svg.exists():
            shutil.rmtree(twemoji_svg)
        shutil.copytree(ex / "twemoji-17.0.3" / "assets" / "svg", twemoji_svg)

        # Fonts (SIL OFL, via @fontsource)
        for url, pkg in ((VT323_TARBALL, "vt323"), (PS2P_TARBALL, "ps2p")):
            tgz = td_path / f"{pkg}.tgz"
            _download(url, tgz)
            ex = td_path / pkg
            _extract_tgz(tgz, ex)
            fonts.mkdir(parents=True, exist_ok=True)
            for f in (ex / "package" / "files").glob("*-latin*-400-normal.woff2"):
                shutil.copyfile(f, fonts / f.name)

    log(f"Vendor fertig: {len(list(twemoji_svg.glob('*.svg')))} Twemoji-SVGs, "
        f"{len(list(fonts.glob('*.woff2')))} Fonts")


# ---------------------------------------------------------------------------
# Patches auf der Spiel-Datei
# ---------------------------------------------------------------------------

def _fonts_css(asset_prefix: str) -> str:
    a = asset_prefix

    def face(family: str, file: str, urange: str) -> str:
        return (
            "@font-face{"
            f"font-family:'{family}';"
            "font-style:normal;font-weight:400;font-display:swap;"
            f"src:url('{a}assets/fonts/{file}') format('woff2');"
            f"unicode-range:{urange};"
            "}"
        )

    return "\n".join([
        "/* Selbst gehostete Fonts (DSGVO: keine Anfragen an Google) */",
        face("VT323", "vt323-latin-400-normal.woff2", FONT_UNICODE_LATIN),
        face("VT323", "vt323-latin-ext-400-normal.woff2", FONT_UNICODE_LATIN_EXT),
        face("Press Start 2P", "press-start-2p-latin-400-normal.woff2", FONT_UNICODE_LATIN),
        face("Press Start 2P", "press-start-2p-latin-ext-400-normal.woff2", FONT_UNICODE_LATIN_EXT),
    ])


def patch_fragment(html: str, asset_prefix: str, rename_css_vars: bool, flyer_src_expr: str) -> str:
    """Alle Build-Patches. ``asset_prefix`` ist 'assets/' relativ oder eine
    absolute URL – je nachdem, wo die Datei später liegt. ``flyer_src_expr`` ist
    ein JavaScript-Ausdruck für die Bild-URL (lokal gebundelt oder Remote)."""

    def replace(text: str, old: str, new: str, expected: int) -> str:
        n = text.count(old)
        if n != expected:
            raise SystemExit(f"FEHLER: Patch-Anker {old[:60]!r} erwartet {expected}x, gefunden {n}x")
        return text.replace(old, new)

    # 1) Robustes Bootstrapping: läuft auch, wenn das Fragment per JavaScript
    #    nachgeladen wird (DOMContentLoaded ist dann u. U. schon vorbei).
    #    Schützt zusätzlich vor Doppel-Initialisierung.
    html = replace(
        html,
        'document.addEventListener("DOMContentLoaded", function () {',
        "function __bvMainInit() { if (window.__bvMainInitDone) return; window.__bvMainInitDone = true;",
        1,
    )
    close_old = re.compile(
        r'console\.log\("🖥️ Tipp: Interagiere mit dem Computer \(🖥️\) im Büro!"\);\r?\n'
        r"\r?\n            \}\);\r?\n        \}\)\(\);"
    )
    close_new = (
        'console.log("🖥️ Tipp: Interagiere mit dem Computer (🖥️) im Büro!");\n'
        "\n            }\n"
        "            if (document.readyState === 'loading') { "
        "document.addEventListener('DOMContentLoaded', __bvMainInit); } "
        "else { setTimeout(__bvMainInit, 0); }\n"
        "        })();"
    )
    html, n = close_old.subn(close_new, html, count=1)
    if n != 1:
        raise SystemExit("FEHLER: Ende des Init-Blocks nicht gefunden (Bootstrap-Patch)")

    # 1b) Build-Stempel: macht die laufende Version in Console und Boot-Screen
    #     sichtbar – so erkennt man sofort, ob Shop und Website gleichen Stand haben.
    stamp = datetime.datetime.now(
        datetime.timezone(datetime.timedelta(hours=2))  # Europe/Berlin (MEZ/MESZ)
    ).date().isoformat()
    html = replace(
        html,
        "window._bueroversum_init = true;",
        f'window._bueroversum_init = true; window.BV_BUILD = "{stamp}"; '
        f'console.log("[BüroVersum] Build {stamp}");',
        1,
    )
    html = replace(
        html,
        "Version 7.10.11 &bull; &copy; 2026",
        f"Version 7.10.11 &bull; Build {stamp} &bull; &copy; 2026",
        1,
    )

    # 2) Twemoji-Library selbst hosten statt CDN
    html = replace(
        html,
        'src="https://cdn.jsdelivr.net/npm/@twemoji/api@latest/dist/twemoji.min.js"',
        f'src="{asset_prefix}assets/vendor/twemoji.min.js"',
        1,
    )

    # 3) Twemoji-SVGs selbst hosten statt CDN
    html = replace(
        html,
        "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/",
        f"{asset_prefix}assets/vendor/twemoji/",
        4,
    )

    # 4) Google-Fonts-@import ersetzen (DSGVO + offline-fähig)
    html = replace(
        html,
        "@import url('https://fonts.googleapis.com/css2?family=VT323&family=Press+Start+2P&display=swap');",
        _fonts_css(asset_prefix),
        1,
    )

    # 5) Flyer-Bild robust laden: kein Mixed Content, kein endloses Warten auf
    #    nicht erreichbare Hosts, gestalteter Fallback-Platzhalter statt Lücke.
    flyer_block = re.compile(
        r'const imgHost = document\.getElementById\("zuef-image-host"\);\s*'
        r"if \(imgHost && !imgHost\.hasChildNodes\(\)\) \{\s*"
        r'const img = document\.createElement\("img"\);\s*'
        r'img\.src = "http://webshops\.zuef\.de/[^"]*";\s*'
        r'img\.alt = "Flyer";\s*'
        r'img\.className = "zuef-promo-img";\s*'
        r"imgHost\.appendChild\(img\);\s*"
        r"\}",
    )
    fallback_html = (
        '<div class="zuef-fallback" '
        'style="width:100%;aspect-ratio:4/5;border-radius:12px;'
        "background:linear-gradient(155deg,#22336b,#101533 55%,#2a1a4e);"
        "border:1px solid rgba(140,170,255,.25);display:flex;flex-direction:column;"
        "align-items:center;justify-content:center;gap:12px;padding:20px;"
        "box-sizing:border-box;text-align:center;font-family:VT323,monospace;"
        'color:#cfe0ff;cursor:pointer">'
        '<div style="font-size:clamp(40px,8vw,64px);line-height:1">🏢</div>'
        '<div style="font-size:clamp(22px,4.5vw,32px);letter-spacing:.14em;color:#fff">BÜROVERSUM</div>'
        '<div style="width:56px;height:2px;background:linear-gradient(90deg,transparent,#4a9fff,transparent)"></div>'
        '<div style="font-size:clamp(16px,3.2vw,21px);opacity:.85">Klick hier und starte das Spiel</div>'
        "</div>"
    )
    flyer_lines = [
        'const imgHost = document.getElementById("zuef-image-host");',
        "                    if (imgHost && !imgHost.hasChildNodes()) {",
        "                        // Robustes Flyer-Laden (Build-Patch): lokales Bundling bevorzugt,",
        "                        // sonst Remote-Quelle protokoll-passend (kein Mixed Content).",
        "                        // Bei Fehler oder nach 5 s Timeout erscheint ein gestalteter Fallback.",
        '                        var FALLBACK_HTML = "'
        + fallback_html.replace('"', '\\"')
        + '";',
        '                        var img = document.createElement("img");',
        "                        var settled = false;",
        "                        function flyerFail() {",
        "                            if (settled) return;",
        "                            settled = true;",
        "                            if (img.parentNode) img.parentNode.removeChild(img);",
        "                            imgHost.innerHTML = FALLBACK_HTML;",
        "                        }",
        '                        img.alt = "Flyer";',
        '                        img.className = "zuef-promo-img";',
        "                        img.onload = function () { settled = true; };",
        "                        img.onerror = flyerFail;",
        "                        setTimeout(function () { if (!settled) flyerFail(); }, 5000);",
        f"                        img.src = {flyer_src_expr};",
        "                        imgHost.appendChild(img);",
        "                    }",
    ]
    flyer_new = "\n".join(flyer_lines)
    html, n = flyer_block.subn(lambda _m: flyer_new, html, count=1)
    if n != 1:
        raise SystemExit("FEHLER: Flyer-Block nicht gefunden (Flyer-Patch)")

    # 6) Optional: CSS-Variablen mit bv- Präfix versehen, damit das Fragment
    #    im Shop-DOM keine Theme-Variablen (--primary, --gold …) überschreibt.
    if rename_css_vars:
        css_vars = [
            "primary-dark", "primary-light", "primary",
            "hp-color", "mp-color",
            "bg-dark", "bg-medium", "bg-light",
            "game-width", "game-height",
            "tile-size",
            "viewport-width", "viewport-height",
            "accent-color",
            "cam-x-windows", "cam-y-windows", "cam-x", "cam-y",
            "tt-accent2", "tt-accent3", "tt-accent",
            "gold", "success", "danger",
        ]
        total = 0
        for name in css_vars:
            pat = re.compile(r"--" + re.escape(name) + r"(?![-\w])")
            html, n = pat.subn(f"--bv-{name}", html)
            total += n
        log(f"CSS-Variablen umbenannt: {total} Vorkommen, {len(css_vars)} Namen")

    return html


# ---------------------------------------------------------------------------
# HTML-Schalen
# ---------------------------------------------------------------------------

SHELL_STYLE = """
        html, body { margin: 0; padding: 0; }
        body.bv-shell {
            background: radial-gradient(1200px 600px at 50% -10%, #16204a 0%, #0a0a1a 55%);
            color: #dfe7ff;
            font-family: 'VT323', 'Courier New', monospace;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .bv-shell-header { text-align: center; padding: 42px 20px 8px; }
        .bv-shell-logo {
            width: 72px; height: 72px; margin: 0 auto 14px;
            border-radius: 20px; background: linear-gradient(145deg, #1a2a4a, #12122a);
            border: 1px solid rgba(140, 170, 255, .25);
            display: flex; align-items: center; justify-content: center;
            font-size: 38px; box-shadow: 0 12px 40px rgba(30, 60, 160, .35);
        }
        .bv-shell-header h1 {
            margin: 0; letter-spacing: .12em;
            font-family: 'Press Start 2P', monospace; font-size: clamp(18px, 4vw, 30px);
            color: #fff; text-shadow: 0 0 24px rgba(74, 159, 255, .55);
        }
        .bv-shell-tagline { margin: 14px 0 0; font-size: 21px; color: #9db4e8; }
        .bv-shell-main { width: 100%; display: flex; justify-content: center; padding: 10px 12px 30px; }
        .bv-shell-footer {
            margin-top: auto; padding: 18px 20px 26px; text-align: center;
            font-size: 16px; color: #6d7ba6;
        }
        .bv-shell-footer a { color: #8cf; text-decoration: none; }
        .bv-shell-footer a:hover { text-decoration: underline; }
"""

EMBED_HEAD_STYLE = """
        html, body { margin: 0; padding: 0; background: #0a0a1a; overflow-x: hidden; }
"""

AUTOOPEN_SCRIPT = """
        // Optional: Spiel-Overlay direkt öffnen (?autoopen=1) – praktisch,
        // wenn die Einbettung gleich das Spiel und nicht die Promo-Karte zeigen soll.
        (function () {
            try {
                if (new URLSearchParams(location.search).get('autoopen') !== '1') return;
            } catch (e) { return; }
            var tries = 0;
            var t = setInterval(function () {
                if (typeof window.openRPG === 'function') {
                    clearInterval(t);
                    window.openRPG();
                } else if (++tries > 200) {
                    clearInterval(t);
                }
            }, 50);
        })();
"""

FAVICON = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0a0a1a"/>
  <rect x="2" y="2" width="60" height="60" rx="12" fill="none" stroke="#4a9fff" stroke-opacity=".5" stroke-width="2"/>
  <text x="32" y="43" font-size="32" text-anchor="middle">🏢</text>
</svg>
"""


def build_index(fragment: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>BüroVersum – Das Büro-RPG im Browser</title>
    <meta name="description" content="BüroVersum: Ein RPG aus dem Büroalltag. Direkt im Browser spielen – kein Download nötig.">
    <meta name="theme-color" content="#0a0a1a">
    <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="assets/fonts/fonts.css">
    <style>{SHELL_STYLE}</style>
</head>
<body class="bv-shell">
    <header class="bv-shell-header">
        <div class="bv-shell-logo">🏢</div>
        <h1>BÜROVERSUM</h1>
        <p class="bv-shell-tagline">Das Büro-RPG im Browser – klicke die Karte an und leg los.</p>
    </header>

    <main class="bv-shell-main">
{fragment}
    </main>

    <footer class="bv-shell-footer">
        <p>© 2026 BüroVersum GmbH · Entwickelt von Justin ·
            Emoji-Grafiken: <a href="https://github.com/jdecked/twemoji" rel="noopener" target="_blank">Twemoji</a> (CC-BY 4.0) ·
            Fonts: VT323 &amp; Press Start 2P (SIL OFL)</p>
    </footer>
</body>
</html>
"""


def build_embed(fragment: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>BüroVersum RPG</title>
    <meta name="theme-color" content="#0a0a1a">
    <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
    <style>{EMBED_HEAD_STYLE}</style>
</head>
<body>
{fragment}
    <script>{AUTOOPEN_SCRIPT}</script>
</body>
</html>
"""


def build_fonts_css() -> str:
    return _fonts_css("") + "\n"


# ---------------------------------------------------------------------------
# Smartstore-Snippets (klein, zum direkten Einfügen)
# ---------------------------------------------------------------------------

def write_snippets() -> None:
    snip = ROOT / "smartstore"
    snip.mkdir(parents=True, exist_ok=True)
    base = SITE_BASE_URL

    iframe = f"""<!-- ============================================================
     BüroVersum RPG – Smartstore Page Builder „Custom Code“
     Variante A: iframe-Einbettung (empfohlen)
     1:1-Kopie in den HTML-/Custom-Code-Block einfügen, URL ggf. anpassen.
     ============================================================ -->
<div style="position:relative;width:100%;max-width:960px;margin:0 auto;">
    <div style="position:relative;width:100%;aspect-ratio:16/10;min-height:560px;border-radius:16px;overflow:hidden;background:#0a0a1a;box-shadow:0 15px 50px rgba(0,0,0,.25);">
        <iframe
            src="{base}embed.html"
            title="BüroVersum RPG"
            style="position:absolute;inset:0;width:100%;height:100%;border:0;display:block;"
            allow="autoplay; fullscreen"
            allowfullscreen
            loading="lazy"></iframe>
    </div>
</div>
"""
    (snip / "snippet-iframe.html").write_text(iframe, encoding="utf-8")

    loader = f"""<!-- ============================================================
     BüroVersum RPG – Smartstore Page Builder „Custom Code“
     Variante C: Loader (Spiel-Code wird zur Laufzeit geladen)
     Das Spiel läuft direkt im Shop-DOM (kein iframe). Der Custom-Code-Block
     bleibt klein; nachgeladen wird {base}game-fragment.html

     WICHTIG: BASE muss auf die Spiel-Website zeigen (siehe unten).
     Der Loader prüft bei jedem Seitenaufruf auf einen neuen Stand
     (cache: no-cache) – Shop und Website sind damit immer synchron.
     ============================================================ -->
<div id="bueroversum-game"></div>
<script>
(function () {{
    // Basis-URL der Spiel-Website. Optional überschreibbar über
    // data-base am Host-Element: <div id="bueroversum-game" data-base="https://…/">
    var host = document.getElementById("bueroversum-game");
    if (!host) return;
    var BASE = host.getAttribute("data-base") || "{base}";
    if (window._bvLoaderDone) return;          // kein doppeltes Injizieren
    window._bvLoaderDone = true;

    fetch(BASE + "game-fragment.html", {{ cache: "no-cache" }})  // immer neu validieren
        .then(function (r) {{
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.text();
        }})
        .then(function (html) {{
            host.innerHTML = html;
            // <script>-Tags aus innerHTML werden nicht ausgeführt – deshalb
            // in derselben Reihenfolge neu anlegen und ausführen.
            Array.prototype.forEach.call(host.querySelectorAll("script"), function (old) {{
                var s = document.createElement("script");
                if (old.src) {{ s.src = old.src; if (old.crossOrigin) s.crossOrigin = old.crossOrigin; }}
                else {{ s.text = old.textContent; }}
                old.parentNode.replaceChild(s, old);
            }});
            // Build-Stempel zur Kontrolle ausgeben (Boot-Screen zeigt ihn ebenfalls an)
            setTimeout(function () {{
                console.info("[BüroVersum-Loader] Spiel geladen – Build: " + (window.BV_BUILD || "unbekannt"));
            }}, 300);
        }})
        .catch(function (e) {{
            console.error("[BüroVersum-Loader] Laden fehlgeschlagen:", e);
            host.innerHTML = '<p style="font-family:sans-serif;text-align:center;padding:24px">Das Spiel konnte nicht geladen werden. '
                + '<a href="' + BASE + 'embed.html" target="_blank" rel="noopener">Hier in neuem Tab öffnen</a></p>';
        }});
}})();
</script>
"""
    (snip / "snippet-loader.html").write_text(loader, encoding="utf-8")
    log("Smartstore-Snippets geschrieben (snippet-iframe.html, snippet-loader.html)")


# ---------------------------------------------------------------------------
# Hauptlauf
# ---------------------------------------------------------------------------

def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Quell-Datei fehlt: {SOURCE}")

    ensure_vendor()

    source_html = SOURCE.read_text(encoding="utf-8", errors="strict")
    log(f"Quelle: {SOURCE.name} ({len(source_html):,} Zeichen)".replace(",", "."))

    # Flyer-Bild: lokal gebundelt (assets-src/flyer.jpg) hat Vorrang vor der
    # Remote-Quelle webshops.zuef.de (die kann ausfallen oder gesperrt sein).
    local_flyer = ROOT / "assets-src" / "flyer.jpg"

    def flyer_expr(prefix: str) -> str:
        if local_flyer.is_file():
            return f'"{prefix}assets/flyer.jpg"'
        # Protokoll-passend: http-Seiten (z. B. Shop) laden http, alles andere https.
        return (
            '(location.protocol === "http:" ? "http:" : "https:")'
            ' + "//webshops.zuef.de/DE01BVG/media/72/pagebuilder/Fyler-M%c3%a4rz.jpg?size=512"'
        )

    # --- öffentliche Website (relativ, unveränderte CSS-Variablen) ---
    web_fragment = patch_fragment(
        source_html, asset_prefix="", rename_css_vars=False, flyer_src_expr=flyer_expr(""),
    )

    # --- Smartstore-Fragment (absolute Pfade, CSS-Variablen isoliert) ---
    direct_fragment = patch_fragment(
        source_html, asset_prefix=SITE_BASE_URL, rename_css_vars=True,
        flyer_src_expr=flyer_expr(SITE_BASE_URL),
    )

    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    assets = PUBLIC / "assets"
    (assets / "fonts").mkdir(parents=True)
    shutil.copytree(VENDOR / "twemoji-svg", assets / "vendor" / "twemoji" / "svg")
    shutil.copyfile(VENDOR / "twemoji.min.js", assets / "vendor" / "twemoji.min.js")
    for f in (VENDOR / "fonts").glob("*.woff2"):
        shutil.copyfile(f, assets / "fonts" / f.name)
    (assets / "fonts" / "fonts.css").write_text(build_fonts_css(), encoding="utf-8")
    (assets / "favicon.svg").write_text(FAVICON, encoding="utf-8")
    if local_flyer.is_file():
        shutil.copyfile(local_flyer, assets / "flyer.jpg")
        log("Flyer lokal gebunden: assets-src/flyer.jpg → assets/flyer.jpg")
    else:
        log("Kein assets-src/flyer.jpg – nutze Remote-Quelle webshops.zuef.de mit Fallback")

    (PUBLIC / "index.html").write_text(build_index(web_fragment), encoding="utf-8")
    (PUBLIC / "embed.html").write_text(build_embed(web_fragment), encoding="utf-8")
    (PUBLIC / "game-fragment.html").write_text(direct_fragment, encoding="utf-8")

    GENERATED.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(PUBLIC / "game-fragment.html", GENERATED / "direct-embed.html")

    write_snippets()

    # --- Sanity-Checks: keine externen CDN-/Mixed-Content-Reste ---
    for name in ("index.html", "embed.html", "game-fragment.html"):
        out = (PUBLIC / name).read_text(encoding="utf-8")
        for bad in ("cdn.jsdelivr.net", "fonts.googleapis.com", "http://webshops.zuef.de"):
            if bad in out:
                raise SystemExit(f"FEHLER: {name} enthält noch {bad!r}")
        if "zuef-fallback" not in out:
            raise SystemExit(f"FEHLER: {name} enthält den Flyer-Fallback nicht")

    log("Fertig:")
    for p in sorted(PUBLIC.rglob("*")):
        if p.is_file():
            log(f"  public/{p.relative_to(PUBLIC)}  ({p.stat().st_size:,} B)".replace(",", "."))
    log(f"  smartstore/generated/direct-embed.html  "
        f"({(GENERATED / 'direct-embed.html').stat().st_size:,} B)".replace(",", "."))


if __name__ == "__main__":
    sys.exit(main())
