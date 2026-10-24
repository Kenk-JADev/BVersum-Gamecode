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

    # 5b) A11y: Promo-Karte (öffnet das Spiel) per Tab/Enter erreichbar machen.
    html = replace(
        html,
        '<div class="zuef-premium-card" id="zuef-secret-trigger">',
        '<div class="zuef-premium-card" id="zuef-secret-trigger" role="button" tabindex="0" '
        'aria-label="BüroVersum starten">',
        1,
    )

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
        /* ============================================================
           Landing-Page (nur Website-Variante).
           Alle eigenen Variablen sind mit --bvx- gepräfixt, alle Klassen
           mit bvx- – das Spiel nutzt --primary/--gold und .bv-* für sich.
           Wichtig: keine transform/filter/backdrop-filter auf Vorfahren des
           Spiel-Overlays (position:fixed braucht den Viewport als Bezug).
           ============================================================ */
        :root { color-scheme: dark; }
        html, body { margin: 0; padding: 0; }
        html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
        body.bvx-shell {
            --bvx-bg: #060913;
            --bvx-accent: #4a9fff;
            --bvx-accent-2: #7c5ce0;
            --bvx-text: #e8eefc;
            --bvx-muted: #9db0d6;
            --bvx-line: rgba(120, 170, 255, .16);
            --bvx-card: rgba(255, 255, 255, .035);
            --bvx-font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            --bvx-font-pixel: 'Press Start 2P', monospace;
            --bvx-font-mono: 'VT323', 'Courier New', monospace;
            margin: 0;
            min-height: 100vh;
            background:
                radial-gradient(1200px 700px at 50% -12%, #16204a 0%, rgba(22, 32, 74, 0) 62%),
                radial-gradient(900px 620px at 108% 4%, rgba(124, 92, 224, .18), rgba(124, 92, 224, 0) 62%),
                var(--bvx-bg);
            background-attachment: fixed, fixed, scroll;
            color: var(--bvx-text);
            font-family: var(--bvx-font-sans);
            font-size: 17px;
            line-height: 1.65;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
        }
        body.bvx-shell img { max-width: 100%; }
        body.bvx-shell a { color: #8fc0ff; }
        body.bvx-shell a:focus-visible,
        body.bvx-shell button:focus-visible,
        body.bvx-shell summary:focus-visible {
            outline: 2px solid #8cc6ff;
            outline-offset: 3px;
            border-radius: 8px;
        }

        /* Skip-Link (Tastatur) */
        .bvx-skip {
            position: absolute; left: -9999px; top: 0;
            z-index: 200; padding: 10px 16px; border-radius: 10px;
            background: #0b1226; color: #fff !important; text-decoration: none;
            font-family: var(--bvx-font-mono); font-size: 18px;
            border: 1px solid rgba(120, 170, 255, .4);
        }
        .bvx-skip:focus { left: 16px; top: 16px; }

        /* ---------------------------------------------------------- Topbar */
        .bvx-topbar {
            position: sticky; top: 0; z-index: 60;
            display: flex; align-items: center; gap: 16px;
            padding: 11px clamp(16px, 4vw, 40px);
            background: rgba(6, 9, 19, .8);
            -webkit-backdrop-filter: blur(14px);
            backdrop-filter: blur(14px);
            border-bottom: 1px solid var(--bvx-line);
        }
        .bvx-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
        .bvx-brand img { width: 36px; height: 36px; border-radius: 11px; display: block; box-shadow: 0 8px 22px rgba(30, 70, 160, .45); }
        .bvx-brand-text { display: flex; flex-direction: column; line-height: 1.15; }
        .bvx-brand-name { font-family: var(--bvx-font-pixel); font-size: 12px; letter-spacing: .06em; color: #fff; }
        .bvx-brand-sub { font-family: var(--bvx-font-mono); font-size: 15px; color: var(--bvx-muted); letter-spacing: .04em; }
        .bvx-spacer { flex: 1 1 auto; }
        .bvx-nav { display: flex; align-items: center; gap: 2px; }
        .bvx-nav a {
            font-family: var(--bvx-font-mono); font-size: 19px; letter-spacing: .07em;
            text-transform: uppercase; color: var(--bvx-muted); text-decoration: none;
            padding: 7px 12px; border-radius: 9px;
            transition: color .18s ease, background .18s ease;
        }
        .bvx-nav a:hover { color: #fff; background: rgba(74, 159, 255, .12); }
        @media (max-width: 900px) { .bvx-nav { display: none; } }
        @media (max-width: 420px) { .bvx-brand-sub { display: none; } }

        /* ---------------------------------------------------------- Buttons */
        .bvx-btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 10px;
            font-family: var(--bvx-font-mono); font-size: 21px; letter-spacing: .06em;
            padding: 11px 22px; border-radius: 12px;
            border: 1px solid transparent; cursor: pointer; text-decoration: none;
            transition: transform .15s ease, box-shadow .2s ease, background .2s ease, border-color .2s ease;
        }
        .bvx-btn-primary {
            background: linear-gradient(135deg, #4a9fff, #3d7ee0 55%, #7c5ce0);
            color: #fff !important; font-weight: 600;
            box-shadow: 0 12px 30px rgba(74, 159, 255, .35);
        }
        .bvx-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 18px 42px rgba(74, 159, 255, .45); }
        .bvx-btn-primary:active { transform: translateY(0); }
        .bvx-btn-ghost {
            background: rgba(255, 255, 255, .04); border-color: var(--bvx-line); color: var(--bvx-text) !important;
        }
        .bvx-btn-ghost:hover { background: rgba(74, 159, 255, .12); border-color: rgba(120, 170, 255, .42); }
        .bvx-btn-small { font-size: 18px; padding: 8px 16px; border-radius: 10px; }

        /* ------------------------------------------------------------ Seiten */
        .bvx-page {
            width: 100%; max-width: 1180px; margin: 0 auto;
            padding: 0 clamp(16px, 4vw, 40px) 48px;
            box-sizing: border-box;
        }
        .bvx-hero {
            display: grid;
            grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr);
            gap: clamp(28px, 5vw, 64px);
            align-items: center;
            padding: clamp(30px, 6vw, 68px) 0 16px;
        }
        .bvx-eyebrow {
            display: inline-flex; align-items: center; gap: 10px;
            font-family: var(--bvx-font-mono); font-size: 16px; letter-spacing: .13em;
            text-transform: uppercase; color: #a9c4f5;
            background: rgba(74, 159, 255, .09);
            border: 1px solid rgba(120, 170, 255, .26);
            padding: 6px 14px; border-radius: 999px;
        }
        .bvx-dot {
            width: 8px; height: 8px; border-radius: 50%; background: #00cc66;
            animation: bvxPulse 2s ease-in-out infinite;
        }
        @keyframes bvxPulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(0, 204, 102, .6); }
            50% { box-shadow: 0 0 0 6px rgba(0, 204, 102, 0); }
        }
        .bvx-hero h1 {
            font-family: var(--bvx-font-pixel);
            font-size: clamp(25px, 4.4vw, 44px);
            line-height: 1.2; letter-spacing: .015em;
            margin: 20px 0 0; color: #fff;
            text-shadow: 0 0 44px rgba(74, 159, 255, .42);
        }
        .bvx-hero h1 .bvx-h1-sub {
            display: block; margin-top: 16px;
            font-family: var(--bvx-font-mono);
            font-size: clamp(20px, 2.6vw, 27px);
            letter-spacing: .18em; text-transform: uppercase;
            color: #8fc0ff; text-shadow: none;
        }
        .bvx-lead {
            margin: 20px 0 0; max-width: 54ch;
            color: var(--bvx-muted); font-size: clamp(16.5px, 1.5vw, 18.5px);
        }
        .bvx-chips { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; margin: 22px 0 0; }
        .bvx-chips li {
            font-family: var(--bvx-font-mono); font-size: 17px; letter-spacing: .05em;
            color: #b8cbec; background: rgba(255, 255, 255, .04);
            border: 1px solid var(--bvx-line); border-radius: 999px; padding: 4px 13px;
        }
        .bvx-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 26px 0 0; }
        .bvx-note { margin: 16px 0 0; font-size: 15px; color: #7e8fb8; }
        .bvx-note a { color: #8fc0ff; }

        .bvx-hero-visual {
            position: relative;
            display: flex; justify-content: center; align-items: center;
            padding: clamp(12px, 2.2vw, 22px);
            border-radius: 22px;
            background: linear-gradient(160deg, rgba(28, 44, 92, .72), rgba(9, 13, 30, .88) 72%);
            border: 1px solid var(--bvx-line);
            box-shadow: 0 30px 80px rgba(3, 6, 16, .6), inset 0 1px 0 rgba(255, 255, 255, .05);
        }

        /* --- Spiel-Widget (Promo-Karte + Countdown) auf dunklem Grund --- */
        body.bvx-shell #zuef-main-wrapper { width: 100%; padding: 0; }
        body.bvx-shell .zuef-centered-col { max-width: 420px; }
        body.bvx-shell .zuef-card-body {
            background: rgba(8, 12, 28, .92);
            border: 1px solid rgba(120, 170, 255, .22);
            box-shadow: 0 18px 48px rgba(0, 0, 0, .45);
        }
        body.bvx-shell .zuef-main-title {
            color: #eaf1ff; font-family: var(--bvx-font-mono);
            font-size: 1.32rem; font-weight: 400; letter-spacing: .05em;
        }
        body.bvx-shell .zuef-accent-date { color: #8fc0ff; border-bottom-color: rgba(143, 192, 255, .55); }
        body.bvx-shell .zuef-countdown-row {
            background: rgba(10, 16, 36, .92);
            border-color: rgba(120, 170, 255, .18);
            gap: 10px; padding: 12px 18px;
        }
        body.bvx-shell .zuef-num { color: #fff; font-family: var(--bvx-font-mono); }
        body.bvx-shell .zuef-label { color: #8fa6d8; }
        body.bvx-shell .zuef-divider-line { background: rgba(120, 170, 255, .16); }
        body.bvx-shell #zuef-secret-trigger:focus-visible {
            outline: 2px solid #8cc6ff; outline-offset: 6px; border-radius: 18px;
        }

        /* --------------------------------------------------------- Sektionen */
        .bvx-section { padding: clamp(44px, 7vw, 84px) 0 0; scroll-margin-top: 84px; }
        .bvx-section-head { max-width: 720px; }
        .bvx-kicker {
            font-family: var(--bvx-font-mono); font-size: 16px; letter-spacing: .18em;
            text-transform: uppercase; color: #7fa8ee; margin: 0 0 10px;
        }
        .bvx-section h2 {
            font-family: var(--bvx-font-pixel);
            font-size: clamp(16px, 2.3vw, 23px);
            line-height: 1.5; letter-spacing: .03em; margin: 0 0 12px; color: #fff;
        }
        .bvx-section-lead { margin: 0; color: var(--bvx-muted); font-size: 17.5px; max-width: 62ch; }

        .bvx-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(258px, 1fr)); gap: 16px; margin-top: 30px; }
        .bvx-card {
            background: var(--bvx-card); border: 1px solid var(--bvx-line);
            border-radius: 16px; padding: 22px;
            transition: transform .2s ease, border-color .2s ease, background .2s ease;
        }
        .bvx-card:hover { transform: translateY(-3px); border-color: rgba(120, 170, 255, .4); background: rgba(74, 159, 255, .07); }
        .bvx-card-icon {
            width: 46px; height: 46px; border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 24px; line-height: 1; margin-bottom: 14px;
            background: linear-gradient(150deg, rgba(74, 159, 255, .22), rgba(124, 92, 224, .18));
            border: 1px solid rgba(120, 170, 255, .25);
        }
        .bvx-card h3 {
            margin: 0 0 8px; font-family: var(--bvx-font-mono); font-weight: 400;
            font-size: 20px; letter-spacing: .04em; color: #fff;
        }
        .bvx-card p { margin: 0; color: var(--bvx-muted); font-size: 16px; line-height: 1.62; }

        .bvx-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-top: 30px; }
        .bvx-step {
            padding: 24px 22px 22px; border-radius: 16px;
            border: 1px solid var(--bvx-line);
            background: linear-gradient(160deg, rgba(20, 32, 66, .72), rgba(10, 14, 32, .55));
        }
        .bvx-step-num { font-family: var(--bvx-font-pixel); font-size: 12px; color: #ffd86b; letter-spacing: .1em; }
        .bvx-step h3 { margin: 14px 0 8px; font-size: 18.5px; font-family: var(--bvx-font-mono); font-weight: 400; letter-spacing: .03em; color: #fff; }
        .bvx-step p { margin: 0; color: var(--bvx-muted); font-size: 16px; }

        .bvx-faq { margin-top: 28px; display: grid; gap: 10px; max-width: 820px; }
        .bvx-faq details {
            border: 1px solid var(--bvx-line); border-radius: 14px;
            background: rgba(255, 255, 255, .03); padding: 15px 20px;
            transition: border-color .2s ease, background .2s ease;
        }
        .bvx-faq details:hover { border-color: rgba(120, 170, 255, .32); }
        .bvx-faq details[open] { background: rgba(74, 159, 255, .06); border-color: rgba(120, 170, 255, .34); }
        .bvx-faq summary {
            cursor: pointer; list-style: none;
            display: flex; align-items: center; justify-content: space-between; gap: 14px;
            font-family: var(--bvx-font-mono); font-size: 20px; letter-spacing: .03em; color: #eaf1ff;
        }
        .bvx-faq summary::-webkit-details-marker { display: none; }
        .bvx-faq summary::after { content: '+'; font-family: var(--bvx-font-sans); font-size: 22px; color: #7fa8ee; }
        .bvx-faq details[open] summary::after { content: '–'; }
        .bvx-faq p { margin: 12px 0 0; color: var(--bvx-muted); font-size: 16.5px; }
        .bvx-faq code {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 14px; background: rgba(255, 255, 255, .07);
            padding: 1px 6px; border-radius: 5px; color: #cfe0ff;
        }

        .bvx-cta-band {
            margin-top: clamp(48px, 7vw, 88px);
            padding: clamp(28px, 5vw, 46px);
            border-radius: 22px; text-align: center;
            background:
                radial-gradient(640px 260px at 50% 0%, rgba(124, 92, 224, .38), rgba(124, 92, 224, 0) 72%),
                linear-gradient(160deg, rgba(28, 44, 92, .92), rgba(9, 13, 30, .92));
            border: 1px solid rgba(120, 170, 255, .22);
        }
        .bvx-cta-band h2 {
            font-family: var(--bvx-font-pixel); font-size: clamp(16px, 2.4vw, 24px);
            line-height: 1.5; letter-spacing: .03em; margin: 0 0 10px; color: #fff;
        }
        .bvx-cta-band p { margin: 0 auto 22px; max-width: 56ch; color: var(--bvx-muted); }

        .bvx-footer {
            border-top: 1px solid var(--bvx-line);
            margin-top: 56px;
            padding: 26px clamp(16px, 4vw, 40px) 40px;
            text-align: center; color: #7e8fb8; font-size: 15px;
        }
        .bvx-footer-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 20px; margin: 0 0 12px; padding: 0; list-style: none; }
        .bvx-footer a { color: #8fc0ff; text-decoration: none; }
        .bvx-footer a:hover { text-decoration: underline; }
        .bvx-footer p { margin: 4px 0; }

        @media (max-width: 980px) {
            .bvx-hero { grid-template-columns: minmax(0, 1fr); gap: 30px; padding-top: 28px; }
            .bvx-hero-visual { justify-self: center; width: 100%; max-width: 520px; }
            .bvx-lead { max-width: none; }
        }
        @media (max-width: 560px) {
            body.bvx-shell { font-size: 16px; }
            .bvx-btn { font-size: 19px; padding: 10px 18px; }
            .bvx-actions .bvx-btn { flex: 1 1 auto; }
            body.bvx-shell .zuef-countdown-row { padding: 10px 12px; gap: 6px; }
            body.bvx-shell .zuef-time-block { min-width: 38px; }
            .bvx-faq summary { font-size: 18px; }
        }
        @media (prefers-reduced-motion: reduce) {
            html { scroll-behavior: auto; }
            .bvx-card:hover, .bvx-btn-primary:hover { transform: none; }
            .bvx-dot { animation: none; }
        }
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

PLAY_SCRIPT = """
        // „Jetzt spielen“-Buttons: nutzen die vorhandene Spiel-Logik und
        // funktionieren auch, wenn das Spiel noch initialisiert.
        (function () {
            function startGame(e) {
                if (e) e.preventDefault();
                if (typeof window.openRPG === 'function') { window.openRPG(); return; }
                var trigger = document.getElementById('zuef-secret-trigger');
                if (trigger) trigger.click();
                else window.location.href = 'embed.html?autoopen=1';
            }
            document.querySelectorAll('[data-bvx-play]').forEach(function (el) {
                el.addEventListener('click', startGame);
            });
            // Promo-Karte: Enter/Leertaste lösen ebenfalls den Klick aus
            var card = document.getElementById('zuef-secret-trigger');
            if (card) {
                card.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                        e.preventDefault();
                        card.click();
                    }
                });
            }
            // ?autoopen=1 oder ?play=1 öffnet das Spiel direkt
            try {
                var q = new URLSearchParams(location.search);
                if (q.get('autoopen') !== '1' && q.get('play') !== '1') return;
            } catch (err) { return; }
            var tries = 0;
            var t = setInterval(function () {
                if (typeof window.openRPG === 'function') {
                    clearInterval(t);
                    if (!document.querySelector('#rpg-overlay.open')) window.openRPG();
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

# ---------------------------------------------------------------------------
# Landing-Page
# ---------------------------------------------------------------------------

INDEX_TEMPLATE = """<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>BüroVersum – Das Büro-RPG im Browser spielen</title>
    <meta name="description" content="BüroVersum ist ein RPG aus dem Büroalltag: isometrische Bürowelt, Kämpfe, Quests, Shop und ein voller Computer-Desktop. Kostenlos im Browser spielen – ohne Download, ohne Konto.">
    <meta name="author" content="BüroVersum GmbH">
    <meta name="theme-color" content="#060913">
    <link rel="canonical" href="{base}">

    <!-- Social / Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="BüroVersum">
    <meta property="og:locale" content="de_DE">
    <meta property="og:title" content="BüroVersum – Das Büro-RPG im Browser">
    <meta property="og:description" content="Akten, Kaffee und Überstunden: Spiele das Büro-RPG direkt im Browser – kostenlos, ohne Download, ohne Konto.">
    <meta property="og:url" content="{base}">
    <meta property="og:image" content="{base}assets/og-image.png">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="BüroVersum – Pixel-Bürogebäude auf dunkelblauem Hintergrund">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="BüroVersum – Das Büro-RPG im Browser">
    <meta name="twitter:description" content="Akten, Kaffee und Überstunden: Spiele das Büro-RPG direkt im Browser – kostenlos, ohne Download.">
    <meta name="twitter:image" content="{base}assets/og-image.png">

    <!-- Icons & PWA -->
    <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="assets/icon-192.png" type="image/png" sizes="192x192">
    <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
    <link rel="manifest" href="manifest.webmanifest">

    <!-- Schriften: selbst gehostet (keine Anfragen an Google) -->
    <link rel="preload" href="assets/fonts/press-start-2p-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="assets/fonts/vt323-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="assets/fonts/fonts.css">
    <style>{shell_style}</style>

    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "VideoGame",
      "name": "BüroVersum",
      "url": "{base}",
      "image": "{base}assets/og-image.png",
      "description": "Browser-RPG aus dem Büroalltag mit isometrischer Bürowelt, Kämpfen, Quests, Shop und Computer-Desktop.",
      "genre": ["RPG", "Indie"],
      "gamePlatform": "Web browser",
      "operatingSystem": "Beliebiger Browser",
      "applicationCategory": "Game",
      "inLanguage": "de",
      "isAccessibleForFree": true,
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EUR" },
      "author": { "@type": "Organization", "name": "BüroVersum GmbH" },
      "publisher": { "@type": "Organization", "name": "BüroVersum GmbH" }
    }
    </script>
</head>
<body class="bvx-shell">
    <a class="bvx-skip" href="#spiel">Direkt zum Spiel</a>

    <header class="bvx-topbar">
        <a class="bvx-brand" href="./" aria-label="BüroVersum – Startseite">
            <img src="assets/icon-192.png" width="36" height="36" alt="" decoding="async">
            <span class="bvx-brand-text">
                <span class="bvx-brand-name">BÜROVERSUM</span>
                <span class="bvx-brand-sub">Büro-RPG im Browser</span>
            </span>
        </a>
        <div class="bvx-spacer"></div>
        <nav class="bvx-nav" aria-label="Hauptnavigation">
            <a href="#spiel">Spiel</a>
            <a href="#features">Features</a>
            <a href="#anleitung">Anleitung</a>
            <a href="#fragen">Fragen</a>
        </nav>
        <button type="button" class="bvx-btn bvx-btn-primary bvx-btn-small" data-bvx-play>▶ Spielen</button>
    </header>

    <main class="bvx-page">
        <section class="bvx-hero" id="spiel">
            <div class="bvx-hero-copy">
                <span class="bvx-eyebrow"><span class="bvx-dot" aria-hidden="true"></span> Live · Version 7.10.11</span>
                <h1>BÜROVERSUM<span class="bvx-h1-sub">Das Büro-RPG im Browser</span></h1>
                <p class="bvx-lead">
                    Vom ersten Arbeitstag bis zur Gehaltsverhandlung: Erkunde das Bürogebäude,
                    sprich mit deinen Kolleginnen und Kollegen, kämpfe dich durch den
                    Alltagswahnsinn und baue dir deine Karriere auf – direkt im Browser.
                </p>
                <ul class="bvx-chips">
                    <li>Kein Download</li>
                    <li>Kein Konto</li>
                    <li>Spielstand im Browser</li>
                    <li>Maus, Tastatur &amp; Touch</li>
                </ul>
                <div class="bvx-actions">
                    <button type="button" class="bvx-btn bvx-btn-primary" data-bvx-play>▶ Jetzt spielen</button>
                    <a class="bvx-btn bvx-btn-ghost" href="embed.html?autoopen=1" target="_blank" rel="noopener">Im neuen Tab öffnen</a>
                </div>
                <p class="bvx-note">
                    Läuft direkt auf dieser Seite – ohne Installation. Der Spielstand bleibt auf deinem Gerät.
                    <a href="#anleitung">So funktioniert's</a>
                </p>
            </div>

            <div class="bvx-hero-visual">
                <!-- Ab hier: Spiel (Promo-Karte + komplettes Overlay) -->
{game_fragment}
            </div>
        </section>

        <section class="bvx-section" id="features">
            <div class="bvx-section-head">
                <p class="bvx-kicker">Was dich erwartet</p>
                <h2>Ein Arbeitstag wie im echten Büro – nur als Spiel</h2>
                <p class="bvx-section-lead">
                    BüroVersum verbindet eine isometrische Bürowelt mit Rollenspiel-Mechaniken:
                    Quests, Kämpfe, Ausrüstung und ein Computer auf dem Schreibtisch, der
                    tatsächlich funktioniert.
                </p>
            </div>
            <div class="bvx-grid">
                <article class="bvx-card">
                    <div class="bvx-card-icon" aria-hidden="true">🗺️</div>
                    <h3>Isometrische Bürowelt</h3>
                    <p>Flure, Büros und Serverraum als isometrische Karte – mit Türen, Truhen und Kolleginnen und Kollegen, die sich bewegen.</p>
                </article>
                <article class="bvx-card">
                    <div class="bvx-card-icon" aria-hidden="true">⚔️</div>
                    <h3>Kampfsystem</h3>
                    <p>Kämpfe mit Skills und Items, Levelaufstiege und eigene Boss-Kämpfe mit eigener HUD-Anzeige.</p>
                </article>
                <article class="bvx-card">
                    <div class="bvx-card-icon" aria-hidden="true">💼</div>
                    <h3>Vier Abteilungen</h3>
                    <p>Einkauf, Verkauf, Zentrale oder Verwaltung: Deine Abteilung bestimmt, wie dein Arbeitstag beginnt.</p>
                </article>
                <article class="bvx-card">
                    <div class="bvx-card-icon" aria-hidden="true">🖥️</div>
                    <h3>BüroVersum OS</h3>
                    <p>Der Computer auf dem Schreibtisch ist ein eigenes Betriebssystem: E-Mail-App mit Ordnern, Dateien, Notepad und Einstellungen.</p>
                </article>
                <article class="bvx-card">
                    <div class="bvx-card-icon" aria-hidden="true">🛒</div>
                    <h3>Shop &amp; Skill-Shop</h3>
                    <p>Neue Fähigkeiten, Ausrüstung und Items – dein verdientes Gehalt entscheidet, was sich lohnt.</p>
                </article>
                <article class="bvx-card">
                    <div class="bvx-card-icon" aria-hidden="true">🏅</div>
                    <h3>Erfolge &amp; Spielstand</h3>
                    <p>Erfolge mit Einblendung, gespeicherter Fortschritt und Einstellungen bis hin zum Performance-Modus für schwache Rechner.</p>
                </article>
            </div>
        </section>

        <section class="bvx-section" id="anleitung">
            <div class="bvx-section-head">
                <p class="bvx-kicker">In drei Schritten</p>
                <h2>So startest du deinen ersten Arbeitstag</h2>
            </div>
            <div class="bvx-steps">
                <article class="bvx-step">
                    <span class="bvx-step-num">01</span>
                    <h3>Spiel öffnen</h3>
                    <p>Klicke oben auf „Jetzt spielen“ oder auf die Promo-Karte. Das Spiel öffnet sich im Vollbild über dieser Seite.</p>
                </article>
                <article class="bvx-step">
                    <span class="bvx-step-num">02</span>
                    <h3>Charakter erstellen</h3>
                    <p>Name, Abteilung und Aussehen wählen, Vertrag unterschreiben – fertig ist die erste Stelle.</p>
                </article>
                <article class="bvx-step">
                    <span class="bvx-step-num">03</span>
                    <h3>Loslegen</h3>
                    <p>Mit WASD oder den Pfeiltasten durchs Büro laufen und mit <code>E</code> interagieren. Auf dem Handy übernimmt die Touch-Steuerung.</p>
                </article>
            </div>
        </section>

        <section class="bvx-section" id="fragen">
            <div class="bvx-section-head">
                <p class="bvx-kicker">Gut zu wissen</p>
                <h2>Häufige Fragen</h2>
            </div>
            <div class="bvx-faq">
                <details>
                    <summary>Kostet das Spiel etwas?</summary>
                    <p>Nein. BüroVersum läuft komplett im Browser – ohne Installation, ohne Konto und ohne Bezahlung.</p>
                </details>
                <details>
                    <summary>Wo wird mein Spielstand gespeichert?</summary>
                    <p>Auf deinem Gerät, im <code>localStorage</code> des Browsers. Wird der Browser-Speicher geleert, ist auch der Spielstand weg. Bei einer Einbettung per iframe gilt der Speicher der Spiel-Domain – der Stand bleibt also über alle eingebetteten Seiten hinweg erhalten.</p>
                </details>
                <details>
                    <summary>Funktioniert das Spiel auf dem Handy?</summary>
                    <p>Ja. Auf schmalen Bildschirmen und Touch-Geräten füllt das Spiel den ganzen Bildschirm und blendet eine Touch-Steuerung ein.</p>
                </details>
                <details>
                    <summary>Werden Daten an Drittanbieter gesendet?</summary>
                    <p>Nein. Schriften und Emoji-Grafiken werden von dieser Website selbst ausgeliefert; es gibt weder Analyse-Tools noch externe CDNs.</p>
                </details>
                <details>
                    <summary>Kann ich das Spiel auf meiner eigenen Website einbetten?</summary>
                    <p>Ja. Dafür gibt es drei fertige Varianten – iframe, Loader-Schnipsel oder den kompletten Spielcode. Anleitung und Snippets liegen im Repository unter <code>smartstore/</code>.</p>
                </details>
            </div>
        </section>

        <section class="bvx-cta-band">
            <h2>Bereit für den ersten Arbeitstag?</h2>
            <p>Ein Klick – und du stehst im Büro. Kein Download, keine Anmeldung, kein Warten.</p>
            <button type="button" class="bvx-btn bvx-btn-primary" data-bvx-play>▶ Jetzt spielen</button>
        </section>
    </main>

    <footer class="bvx-footer">
        <ul class="bvx-footer-links">
            <li><a href="embed.html" target="_blank" rel="noopener">Einbettung</a></li>
            <li><a href="https://github.com/Kenk-JADev/BVersum-Gamecode" target="_blank" rel="noopener">Quellcode</a></li>
            <li><a href="https://github.com/jdecked/twemoji" target="_blank" rel="noopener">Twemoji</a></li>
            <li><a href="https://fonts.google.com/specimen/VT323" target="_blank" rel="noopener">VT323</a></li>
            <li><a href="https://fonts.google.com/specimen/Press+Start+2P" target="_blank" rel="noopener">Press Start 2P</a></li>
        </ul>
        <p>© 2026 BüroVersum GmbH · Entwickelt von Justin</p>
        <p>Selbst gehostete Schriften &amp; Emoji-Grafiken · kein Tracking</p>
    </footer>

    <script>{play_script}</script>
</body>
</html>
"""


def build_index(fragment: str) -> str:
    html = INDEX_TEMPLATE
    html = html.replace("{base}", SITE_BASE_URL)
    html = html.replace("{shell_style}", SHELL_STYLE)
    html = html.replace("{play_script}", PLAY_SCRIPT)
    html = html.replace("{game_fragment}", fragment)
    return html


def build_embed(fragment: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>BüroVersum RPG</title>
    <meta name="description" content="BüroVersum RPG – das Büro-RPG im Browser.">
    <meta name="robots" content="noindex">
    <meta name="theme-color" content="#0a0a1a">
    <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
    <link rel="stylesheet" href="assets/fonts/fonts.css">
    <style>{EMBED_HEAD_STYLE}</style>
</head>
<body>
{fragment}
    <script>{AUTOOPEN_SCRIPT}</script>
</body>
</html>
"""


NOT_FOUND_TEMPLATE = """<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Seite nicht gefunden – BüroVersum</title>
    <meta name="robots" content="noindex">
    <meta name="theme-color" content="#060913">
    <link rel="icon" href="{base}assets/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="{base}assets/fonts/fonts.css">
    <style>
        html, body { margin: 0; padding: 0; }
        body {
            min-height: 100vh; display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 6px;
            text-align: center; padding: 24px; box-sizing: border-box;
            background: radial-gradient(900px 500px at 50% -10%, #16204a, #060913 65%);
            color: #e8eefc; font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        }
        .art { width: 180px; height: 180px; display: block; margin-bottom: 6px; }
        .code { font-family: 'Press Start 2P', monospace; font-size: 14px; letter-spacing: .3em; color: #7fa8ee; margin: 18px 0 6px; }
        h1 { font-family: 'Press Start 2P', monospace; font-size: clamp(16px, 3vw, 22px); line-height: 1.5; margin: 0 0 10px; }
        p { color: #9db0d6; margin: 0 0 24px; max-width: 46ch; }
        a.btn {
            font-family: 'VT323', monospace; font-size: 21px; letter-spacing: .06em;
            padding: 11px 24px; border-radius: 12px; text-decoration: none; color: #fff;
            background: linear-gradient(135deg, #4a9fff, #3d7ee0 55%, #7c5ce0);
            box-shadow: 0 12px 30px rgba(74, 159, 255, .35);
        }
        a.btn:hover { filter: brightness(1.08); }
    </style>
</head>
<body>
    <img class="art" src="{base}assets/hero-building.png" alt="" width="180" height="180" decoding="async">
    <div class="code">404</div>
    <h1>Akte nicht gefunden</h1>
    <p>Diese Seite liegt nicht in unserem Aktenschrank. Vielleicht wurde sie verschoben – oder sie war nie da.</p>
    <a class="btn" href="{base}">Zurück zum Büro</a>
</body>
</html>
"""

MANIFEST = """{
  "name": "BüroVersum – Das Büro-RPG im Browser",
  "short_name": "BüroVersum",
  "description": "Browser-RPG aus dem Büroalltag: isometrische Bürowelt, Kämpfe, Quests und ein voller Computer-Desktop.",
  "lang": "de",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#060913",
  "theme_color": "#060913",
  "icons": [
    { "src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
"""


def build_fonts_css() -> str:
    return _fonts_css("") + "\n"


def write_meta_files(lastmod: str) -> None:
    (PUBLIC / "robots.txt").write_text(
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /embed.html\n"
        "Disallow: /game-fragment.html\n"
        "\n"
        f"Sitemap: {SITE_BASE_URL}sitemap.xml\n",
        encoding="utf-8",
    )
    (PUBLIC / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        "  <url>\n"
        f"    <loc>{SITE_BASE_URL}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        "    <changefreq>weekly</changefreq>\n"
        "    <priority>1.0</priority>\n"
        "  </url>\n"
        "</urlset>\n",
        encoding="utf-8",
    )
    (PUBLIC / "manifest.webmanifest").write_text(MANIFEST, encoding="utf-8")
    (PUBLIC / "404.html").write_text(NOT_FOUND_TEMPLATE.replace("{base}", SITE_BASE_URL), encoding="utf-8")
    # GitHub Pages: keine Jekyll-Verarbeitung nötig
    (PUBLIC / ".nojekyll").write_text("", encoding="utf-8")
    log("Meta-Dateien geschrieben (robots.txt, sitemap.xml, manifest, 404.html, .nojekyll)")


def copy_brand_assets() -> None:
    """OG-Bild und App-Icons aus assets-src/ (erzeugt von tools/make-brand.py)."""
    assets_dir = PUBLIC / "assets"
    wanted = {
        "og-image.png": "og-image.png",
        "icon-192.png": "icon-192.png",
        "icon-512.png": "icon-512.png",
        "apple-touch-icon.png": "apple-touch-icon.png",
        "hero-building.png": "hero-building.png",
    }
    missing = []
    for src_name, dest_name in wanted.items():
        src = ROOT / "assets-src" / src_name
        if src.is_file():
            shutil.copyfile(src, assets_dir / dest_name)
        else:
            missing.append(src_name)
    if missing:
        log(f"Warnung: Brand-Assets fehlen ({', '.join(missing)}) – "
            "`python tools/make-brand.py` erzeugt sie neu")
    else:
        log("Brand-Assets kopiert (OG-Bild, Icons)")


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
    copy_brand_assets()

    (PUBLIC / "index.html").write_text(build_index(web_fragment), encoding="utf-8")
    (PUBLIC / "embed.html").write_text(build_embed(web_fragment), encoding="utf-8")
    (PUBLIC / "game-fragment.html").write_text(direct_fragment, encoding="utf-8")

    GENERATED.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(PUBLIC / "game-fragment.html", GENERATED / "direct-embed.html")

    write_snippets()

    stamp = datetime.datetime.now(
        datetime.timezone(datetime.timedelta(hours=2))
    ).date().isoformat()
    write_meta_files(stamp)

    # --- Sanity-Checks: keine externen CDN-/Mixed-Content-Reste ---
    for name in ("index.html", "embed.html", "game-fragment.html"):
        out = (PUBLIC / name).read_text(encoding="utf-8")
        for bad in ("cdn.jsdelivr.net", "fonts.googleapis.com", "http://webshops.zuef.de"):
            if bad in out:
                raise SystemExit(f"FEHLER: {name} enthält noch {bad!r}")
        if "zuef-fallback" not in out:
            raise SystemExit(f"FEHLER: {name} enthält den Flyer-Fallback nicht")

    # Landing-Page: Pflicht-Bausteine für SEO/Social vorhanden?
    index_html = (PUBLIC / "index.html").read_text(encoding="utf-8")
    for needle in ("og:image", "twitter:card", "application/ld+json",
                   "manifest.webmanifest", 'data-bvx-play', "assets/og-image.png"):
        if needle not in index_html:
            raise SystemExit(f"FEHLER: index.html enthält {needle!r} nicht")
    for icon in ("icon-192.png", "icon-512.png", "apple-touch-icon.png", "og-image.png"):
        if not (assets / icon).is_file():
            raise SystemExit(f"FEHLER: Brand-Asset fehlt: assets/{icon}")

    log("Fertig:")
    for p in sorted(PUBLIC.rglob("*")):
        if p.is_file():
            log(f"  public/{p.relative_to(PUBLIC)}  ({p.stat().st_size:,} B)".replace(",", "."))
    log(f"  smartstore/generated/direct-embed.html  "
        f"({(GENERATED / 'direct-embed.html').stat().st_size:,} B)".replace(",", "."))


if __name__ == "__main__":
    sys.exit(main())
