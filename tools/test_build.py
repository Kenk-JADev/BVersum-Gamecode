#!/usr/bin/env python3
"""
Regressionstests für den BüroVersum-Build
========================================

Keine Fremd-Abhängigkeiten (außer optional Node.js für den JS-Syntaxcheck).
Aufruf::

    python tools/build.py            # Artefakte erzeugen
    python tools/test_build.py       # Artefakte prüfen

Fehlt ``public/``, ruft das Testskript den Build selbst auf. Im CI läuft
zuerst der Build-Schritt, danach dieses Skript.
"""

from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
PUBLIC = ROOT / "public"
SNIPPETS = ROOT / "smartstore"
SOURCE = ROOT / "Gamecode-Bueroversum-7.5 (16).html"

sys.path.insert(0, str(TOOLS))
import build  # noqa: E402 – absichtlich nach dem sys.path-Patch


VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
}


class TagBalanceParser(HTMLParser):
    """Prüft, ob der HTML-Baum vollständig geschlossen ist.

    HTMLParser behandelt <script>/<style> als CDATA, d. h. JS-Template-Strings
    mit HTML-Schnipseln verfälschen das Ergebnis nicht.
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, int]] = []
        self.errors: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID_TAGS:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in VOID_TAGS:
            return
        if not self.stack:
            self.errors.append(f"Zeile {self.getpos()[0]}: </{tag}> ohne Start")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                skipped = [t for t, _ in self.stack[i + 1:]]
                if len(skipped) <= 3 and all(t in {"p", "li", "tr", "td", "option"} for t in skipped):
                    self.stack = self.stack[:i]
                    return
                self.errors.append(
                    f"Zeile {self.getpos()[0]}: </{tag}> lässt {skipped} offen "
                    f"(ab Zeile {self.stack[i][1]})"
                )
                self.stack = self.stack[:i]
                return
        self.errors.append(f"Zeile {self.getpos()[0]}: </{tag}> ohne passenden Start")


def inline_scripts(html: str) -> list[str]:
    return re.findall(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", html, re.S | re.I)


def node_available() -> bool:
    return shutil.which("node") is not None


@unittest.skipUnless(node_available(), "Node.js fehlt – JS-Syntaxcheck übersprungen")
class JavaScriptSyntax(unittest.TestCase):
    def check_scripts(self, html: str, label: str, min_scripts: int = 10) -> None:
        scripts = inline_scripts(html)
        self.assertGreaterEqual(len(scripts), min_scripts, f"{label}: zu wenige Inline-Scripts gefunden")
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            for i, code in enumerate(scripts):
                f = tmp / f"{i}.js"
                f.write_text(code, encoding="utf-8")
                r = subprocess.run(
                    ["node", "--check", str(f)], capture_output=True, text=True,
                )
                self.assertEqual(
                    r.returncode, 0,
                    f"{label}: Inline-Script #{i} hat einen Syntaxfehler:\n{r.stderr[:800]}",
                )

    def test_spiel_scripts_parsen(self) -> None:
        self.check_scripts((PUBLIC / "game-fragment.html").read_text(encoding="utf-8"), "game-fragment.html")

    def test_loader_script_parst(self) -> None:
        loader = (SNIPPETS / "snippet-loader.html").read_text(encoding="utf-8")
        self.check_scripts(loader, "snippet-loader.html", min_scripts=1)


class BuildOutputs(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        required = [
            PUBLIC / "index.html",
            PUBLIC / "embed.html",
            PUBLIC / "game-fragment.html",
            SNIPPETS / "generated" / "direct-embed.html",
            SNIPPETS / "snippet-loader.html",
        ]
        if not all(p.is_file() for p in required):
            subprocess.run([sys.executable, str(TOOLS / "build.py")], check=True, capture_output=True)
        cls.web = (PUBLIC / "index.html").read_text(encoding="utf-8")
        cls.embed = (PUBLIC / "embed.html").read_text(encoding="utf-8")
        cls.fragment = (PUBLIC / "game-fragment.html").read_text(encoding="utf-8")
        cls.direct = (SNIPPETS / "generated" / "direct-embed.html").read_text(encoding="utf-8")
        cls.loader = (SNIPPETS / "snippet-loader.html").read_text(encoding="utf-8")
        cls.source = SOURCE.read_text(encoding="utf-8")

    def test_keine_externen_cdns(self) -> None:
        for name, html in (("index", self.web), ("embed", self.embed), ("fragment", self.fragment)):
            for bad in ("cdn.jsdelivr.net", "fonts.googleapis.com", "http://webshops.zuef.de"):
                self.assertNotIn(bad, html, f"{name} lädt noch {bad}")

    def test_twemoji_ohne_cors_zwang(self) -> None:
        # Klassische <script>-Tags brauchen keinen CORS-Header. Ein stehen
        # gebliebenes crossorigin="anonymous" blockiert fremde Hosts.
        for name, html in (("index", self.web), ("embed", self.embed), ("fragment", self.fragment)):
            self.assertRegex(html, r'<script src="[^"]*assets/vendor/twemoji\.min\.js"></script>')
            self.assertNotIn("twemoji.min.js\" crossorigin", html, f"{name}: crossorigin entfernen")

    def test_dom_struktur_ausgeglichen(self) -> None:
        # Die Quelle lässt #zuef-main-wrapper + #rpg-overlay offen. Ohne Patch
        # verschwindet in der Direkt-Einbettung der Rest der Shop-Seite im
        # display:none-Overlay.
        p = TagBalanceParser()
        p.feed(self.source)
        self.assertEqual(len(p.stack), 2, "Quelle: Erwartung (2 offene Container) hat sich geändert")
        for name, html in (("index", self.web), ("embed", self.embed), ("fragment", self.fragment)):
            q = TagBalanceParser()
            q.feed(html)
            self.assertEqual(q.errors, [], f"{name}: HTML-Fehler: {q.errors[:5]}")
            self.assertEqual(q.stack, [], f"{name}: offene Tags: {q.stack[:5]}")

    def test_flyer_fallback_vorhanden(self) -> None:
        for name, html in (("index", self.web), ("embed", self.embed), ("fragment", self.fragment)):
            self.assertIn("zuef-fallback", html, f"{name}: Flyer-Fallback fehlt")
            self.assertIn("setTimeout(function () { if (!settled) flyerFail(); }, 5000);", html)

    def test_assets_vollstaendig(self) -> None:
        assets = PUBLIC / "assets"
        for rel in (
            "fonts/fonts.css", "fonts/vt323-latin-400-normal.woff2",
            "fonts/press-start-2p-latin-400-normal.woff2",
            "vendor/twemoji.min.js", "favicon.svg",
        ):
            self.assertTrue((assets / rel).is_file(), f"Asset fehlt: assets/{rel}")
        svgs = list((assets / "vendor" / "twemoji" / "svg").glob("*.svg"))
        self.assertGreater(len(svgs), 1000, "Twemoji-SVGs unvollständig")
        self.assertEqual(self.direct, self.fragment, "generated/direct-embed.html ist nicht synchron")


class LateInjection(unittest.TestCase):
    """Variante C injiziert das Fragment erst NACH DOMContentLoaded."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.source = SOURCE.read_text(encoding="utf-8")
        cls.fragment = (PUBLIC / "game-fragment.html").read_text(encoding="utf-8")
        cls.loader = (SNIPPETS / "snippet-loader.html").read_text(encoding="utf-8")

    def test_alle_module_haben_late_fallback(self) -> None:
        regs = list(re.finditer(r"document\.addEventListener\(\s*['\"]DOMContentLoaded['\"]", self.source))
        self.assertGreater(len(regs), 15)
        without_fallback = []
        for idx, m in enumerate(regs):
            if idx == 0:  # Haupt-Init wird vom Build-Patch ersetzt
                continue
            before = self.source[max(0, m.start() - 200):m.start()]
            after = self.source[m.start():m.start() + 400]
            guarded = re.search(
                r"if\s*\(\s*document\.readyState\s*===\s*['\"]loading['\"]\s*\)\s*(?:\{\s*)?$",
                before,
            ) is not None
            if not guarded or "else" not in after:
                without_fallback.append(self.source.count("\n", 0, m.start()) + 1)
        self.assertEqual(without_fallback, [], f"DOMContentLoaded ohne Fallback in Zeilen {without_fallback}")

    def test_haupt_init_startet_synchron(self) -> None:
        # setTimeout(__bvMainInit, 0) würde die Engine erst NACH allen anderen
        # Modulen starten, die im Nachlade-Fall sofort loslaufen.
        self.assertIn("else { __bvMainInit(); }", self.fragment)
        self.assertNotIn("setTimeout(__bvMainInit", self.fragment)
        self.assertIn("if (window.__bvMainInitDone) return;", self.fragment)

    def test_loader_fuehrt_scripts_sequenziell_aus(self) -> None:
        for marker in ("s.onload = proceed;", "setTimeout(proceed, 4000);",
                       "s.onerror = function ()", "if (!old.src) proceed();"):
            self.assertIn(marker, self.loader, f"Loader: {marker!r} fehlt")
        self.assertNotIn("s.crossOrigin", self.loader)
        self.assertIn("window._bvLoaderDone = false;", self.loader)


class VersionsUndCSS(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = SOURCE.read_text(encoding="utf-8")
        cls.fragment = (PUBLIC / "game-fragment.html").read_text(encoding="utf-8")
        cls.direct = (SNIPPETS / "generated" / "direct-embed.html").read_text(encoding="utf-8")
        cls.web = (PUBLIC / "index.html").read_text(encoding="utf-8")

    def test_build_stempel_ist_inhaltsbasiert(self) -> None:
        expected = hashlib.sha256(self.source.encode("utf-8")).hexdigest()[:8]
        stamps = set()
        for name, html in (("index", self.web), ("fragment", self.fragment), ("direct", self.direct)):
            m = re.search(r'BV_BUILD = "(\d{4}-\d{2}-\d{2}-[0-9a-f]{8})"', html)
            self.assertIsNotNone(m, f"{name}: BV_BUILD fehlt oder falsches Format")
            stamps.add(m.group(1))
            self.assertIn(f"Build {m.group(1)}", html, f"{name}: Boot-Screen zeigt alten Stempel")
        self.assertEqual(len(stamps), 1, "unterschiedliche Build-Stempel in den Artefakten")
        self.assertTrue(stamps.pop().endswith(expected), "Hash passt nicht zur Quelldatei")

    def test_root_css_variablen_im_shop_isoliert(self) -> None:
        # Alle auf :root definierten Custom Properties müssen in der
        # Smartstore-Variante umbenannt sein – sonst überschreibt das Spiel
        # Theme-Variablen des Shops.
        roots = re.findall(r":root\s*\{([^{}]*)\}", self.source, re.S)
        self.assertTrue(roots, "keine :root-Blöcke gefunden")
        names = set()
        for block in roots:
            names.update(re.findall(r"--([A-Za-z][\w-]*)\s*:", block))
        self.assertTrue(names)
        for name in names:
            self.assertNotRegex(
                self.direct, r"--" + re.escape(name) + r"(?![\w-])",
                f":root-Variable --{name} ist im Shop-Fragment nicht isoliert",
            )
            self.assertIn(f"--bv-{name}", self.direct, f"--bv-{name} fehlt im Shop-Fragment")
        # Die normale Website behält die ursprünglichen Namen.
        self.assertIn("--primary:", self.web)


class MapEnginePerformance(unittest.TestCase):
    """Statische Absicherung der Map-Engine-Patches (Laufzeittest: perf_test.js)."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.fragment = (PUBLIC / "game-fragment.html").read_text(encoding="utf-8")

    def test_kein_doppelter_map_render(self) -> None:
        self.assertNotIn("BV3D.resizeToMap=(map)=>ME.render(map);", self.fragment)
        self.assertIn("ME.bounds(map); return true;", self.fragment)
        self.assertIn("BV3D.renderMap=(map)=>ME.render(map);", self.fragment)

    def test_raster_guard_und_diagnose_api(self) -> None:
        for marker in ("window.BVMapPerf", "bvPerf.skipped++", "map-engine-rasterized",
                       "this.bounds(map);\n                bvPerf.skipped++;"):
            self.assertIn(marker, self.fragment, f"Marker fehlt: {marker}")

    def test_minimap_statik_cache(self) -> None:
        self.assertNotIn("miniCanvas.width = mapCols * scale;", self.fragment)
        for marker in ("__bvMiniBg", "mmPerf.minimapStatic++",
                       "mctx.drawImage(mmBg.canvas, 0, 0);"):
            self.assertIn(marker, self.fragment, f"Marker fehlt: {marker}")
        # width/height nur noch bei Änderung setzen -> keine Bitmap-Reallocation pro Frame
        self.assertIn("if (miniCanvas.width !== mw) miniCanvas.width = mw;", self.fragment)

    def test_occluder_observer_guard(self) -> None:
        self.assertIn("el.style.getPropertyValue('--occ-z') !== z", self.fragment)

    def test_shadow_lookup_optimiert(self) -> None:
        self.assertIn("const bvHasShadow =", self.fragment)

    def test_hintergrund_poller_gedrosselt(self) -> None:
        self.assertNotIn("setInterval(maybePatrickWelcome, 350);", self.fragment)
        self.assertNotIn("setInterval(maybePausenraumIntro, 450);", self.fragment)
        self.assertNotIn("setInterval(recoverParticles, 1800);", self.fragment)
        self.assertNotIn("setInterval(() => { wrapSettings(); syncParticleVisibility(); }, 1200);",
                         self.fragment)
        self.assertGreaterEqual(
            self.fragment.count("if (!document.body.classList.contains('rpg-active')) return;"),
            3,
            "Mindestens 3 Poller müssen auf 'Spiel offen' geprüft werden",
        )

    def test_optimierungen_stehen_in_der_quelldatei(self) -> None:
        """Die Original-HTML muss die Patches selbst enthalten (nicht nur der Build)."""
        source = SOURCE.read_text(encoding="utf-8")
        self.assertIn(build.MAP_PERF_MARKER, source, "Quelldatei ist nicht gepatcht")
        for marker in build.MAP_PERF_MARKERS:
            self.assertIn(marker, source, f"Quelldatei: Marker fehlt: {marker}")
        self.assertGreaterEqual(
            source.count("if (!document.body.classList.contains('rpg-active')) return;"),
            3,
        )
        # Zeilenenden dürfen beim Patch nicht umgestellt worden sein.
        raw = SOURCE.read_bytes()
        self.assertEqual(raw.count(b"\n"), raw.count(b"\r\n"), "Quelle muss durchgängig CRLF bleiben")

    def test_build_bleibt_idempotent_und_kann_alte_quelle_patchen(self) -> None:
        """Fallback: eine unveränderte Quelle wird weiterhin automatisch gepatcht.

        Die Anker werden per AST aus build.py gelesen, damit der Test nicht
        kopierte Literale pflegen muss, die bei einer Quelländerung veralten.
        """
        import ast
        tree = ast.parse((TOOLS / "build.py").read_text(encoding="utf-8"))
        fn = next(n for n in tree.body
                  if isinstance(n, ast.FunctionDef) and n.name == "patch_map_performance")
        anchors = []
        for node in ast.walk(fn):
            if (isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
                    and node.func.id == "swap" and len(node.args) >= 3):
                old = node.args[1]
                if isinstance(old, ast.Constant) and isinstance(old.value, str):
                    anchors.append(old.value)
        self.assertEqual(len(anchors), 8, "Erwartet: 8 exakt geprüfte Patch-Anker")

        unpatched = "\n".join(anchors)
        patched = build.patch_map_performance(unpatched)
        self.assertIn(build.MAP_PERF_MARKER, patched)
        for marker in build.MAP_PERF_MARKERS:
            self.assertIn(marker, patched, f"Fallback: Marker fehlt: {marker}")
        # Zweiter Durchlauf darf nichts doppelt anwenden.
        self.assertEqual(build.patch_map_performance(patched), patched)

        with self.assertRaises(SystemExit):
            build.patch_map_performance("defekte Quelle ohne Anker")


if __name__ == "__main__":
    unittest.main(verbosity=2)
