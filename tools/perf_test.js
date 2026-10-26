#!/usr/bin/env node
/**
 * BüroVersum – Map-Engine Laufzeit/Performance-Test (jsdom)
 * ========================================================
 *
 * Prüft nicht nur Text, sondern misst das Verhalten beim echten Map-Load:
 *
 *   - genau EIN ME.render() pro Map-Ladevorgang (früher: zwei)
 *   - Raster-Guard überspringt Same-Map-Reloads ohne SVG-Rebuild
 *   - Minimap zeichnet statische Tiles nur einmal (Offscreen-Cache)
 *   - Diagnose-API window.BVMapPerf ist vorhanden
 *
 * Voraussetzung:
 *
 *     npm install --prefix /tmp/bv-smoke jsdom@26
 *     NODE_PATH=/tmp/bv-smoke/node_modules node tools/perf_test.js
 *
 * Optional: `node tools/perf_test.js <pfad-zu-public>`.
 */

"use strict";

const fs = require("fs");
const path = require("path");
let jsdom;
try {
    jsdom = require("jsdom");
} catch (e) {
    console.error("FEHLER: jsdom fehlt. Bitte zuerst installieren (siehe Dateikopf).");
    process.exit(2);
}
const { JSDOM, ResourceLoader, VirtualConsole } = jsdom;

const PUBLIC = path.resolve(process.argv[2] || path.join(__dirname, "..", "public"));
const indexPath = path.join(PUBLIC, "index.html");
if (!fs.existsSync(indexPath)) {
    console.error("FEHLER: " + indexPath + " fehlt – zuerst `python tools/build.py` ausführen.");
    process.exit(2);
}
const html = fs.readFileSync(indexPath, "utf8");

class LocalLoader extends ResourceLoader {
    fetch(url) {
        try {
            const u = new URL(url);
            if (u.hostname === "bv.test") {
                const f = path.join(PUBLIC, decodeURIComponent(u.pathname));
                if (fs.existsSync(f) && fs.statSync(f).isFile()) return Promise.resolve(fs.readFileSync(f));
            }
        } catch (e) { /* ungültige URL */ }
        return Promise.resolve(Buffer.from(""));
    }
}

const errors = [];
const checks = [];
function check(name, ok, detail) {
    checks.push({ name, ok: !!ok, detail: detail === undefined ? "" : String(detail) });
}

const vc = new VirtualConsole();
vc.on("jsdomError", e => {
    if (e.type === "css parsing") return; // bekannte jsdom-Limitierung
    errors.push(String(e.stack || e.message).split("\n").slice(0, 2).join(" | "));
});
vc.on("error", (...a) => errors.push("console.error: " + a.map(String).join(" ").slice(0, 200)));
["warn", "info", "log"].forEach(k => vc.on(k, () => {}));

const noop = () => {};
const canvasStats = new WeakMap();

/** Canvas-Stub mit Zähler für fillRect/drawImage (pro Canvas-Element). */
function countingContext(canvas) {
    let st = canvasStats.get(canvas);
    if (!st) { st = { fillRect: 0, drawImage: 0 }; canvasStats.set(canvas, st); }
    return new Proxy({}, {
        get(t, k) {
            if (k in t) return t[k];
            if (k === "fillRect") return () => { st.fillRect++; };
            if (k === "drawImage") return () => { st.drawImage++; };
            if (k === "measureText") return () => ({ width: 10 });
            if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
            if (["createLinearGradient", "createRadialGradient", "createPattern"].includes(k)) {
                return () => ({ addColorStop: noop });
            }
            return typeof k === "string" ? noop : undefined;
        },
        set(t, k, v) { t[k] = v; return true; }
    });
}

const dom = new JSDOM(html, {
    url: "http://bv.test/index.html",
    runScripts: "dangerously",
    resources: new LocalLoader(),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
        w.HTMLCanvasElement.prototype.getContext = function () { return countingContext(this); };
        w.matchMedia = () => ({
            matches: false, media: "", onchange: null,
            addListener: noop, removeListener: noop,
            addEventListener: noop, removeEventListener: noop, dispatchEvent: () => false
        });
        w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
        w.Audio = class { play() { return Promise.resolve(); } pause() {} };
        w.scrollTo = noop;
        w.addEventListener("error", e => errors.push("error: " + (e.message || e.type)));
        // Minimaler Spielstand, damit window.loadGame() eine echte Map lädt.
        w.localStorage.setItem("bueroversum_save", JSON.stringify({
            currentMapId: "buero",
            player: { name: "PerfTest", hp: 100, maxHp: 100, gold: 0, inventory: [], cutscenes: {} },
            playerPos: { x: 5, y: 5 }
        }));
    }
});

const w = dom.window;
let renderCalls = 0;

// 1) Initialisierung abwarten, dann ME.render instrumentieren und Map laden.
setTimeout(() => {
    const ME = w.MapEngineV6;
    check("MapEngineV6 initialisiert", !!ME && typeof ME.render === "function");
    check("loadGame verfügbar", typeof w.loadGame === "function");
    if (!ME || typeof w.loadGame !== "function") return finish();

    const originalRender = ME.render;
    ME.render = function (map) {
        renderCalls++;
        return originalRender.call(this, map);
    };
    try { w.loadGame(); } catch (e) { errors.push("loadGame: " + e.message); }
}, 1300);

// 2) Nach den Transition-Timeouts (550 ms + 500 ms) auswerten.
setTimeout(() => {
    const ME = w.MapEngineV6;
    const perf = w.BVMapPerf || {};
    const d = w.document;

    check("Map tatsächlich geladen", w.currentMapId === "buero", "currentMapId=" + w.currentMapId);
    check("GENAU EIN Render pro Map-Load", renderCalls === 1, "gemessen: " + renderCalls);
    check("Diagnose-API BVMapPerf vorhanden", perf.renderCalls === 1, JSON.stringify(perf));
    check("SVG-Map gerendert", ME && ME.svg && ME.svg.querySelectorAll("*").length > 1000,
        ME && ME.svg ? ME.svg.querySelectorAll("*").length + " Knoten" : "kein SVG");

    // 3) Raster-onload simulieren (jsdom lädt data:-URLs nicht selbst) und
    //    einen Same-Map-Reload auslösen -> Guard muss ihn überspringen.
    const img = d.getElementById("map-engine-v6-raster-img");
    const cam = d.getElementById("rpg-camera");
    check("Rasterbild erzeugt", !!img && !!img.getAttribute("src"));
    if (img && typeof img.onload === "function" && cam) {
        img.onload();   // setzt .map-engine-rasterized und leert die Live-SVG
        const before = perf.skipped || 0;
        const beforeCalls = perf.renderCalls || 0;
        const map = w.currentMap;
        try { ME.render(map); } catch (e) { errors.push("ME.render(reload): " + e.message); }
        check("Raster-Guard überspringt Same-Map-Reload", (perf.skipped || 0) === before + 1,
            "skipped " + before + " -> " + (perf.skipped || 0));
        check("Skip verursacht KEINEN SVG-Rebuild",
            ME.svg && ME.svg.querySelectorAll("*").length === 0,
            ME.svg ? ME.svg.querySelectorAll("*").length + " Knoten" : "kein SVG");
        check("Skip zählt als Render-Aufruf", (perf.renderCalls || 0) === beforeCalls + 1);
    } else {
        check("Raster-Guard testbar", false, "img.onload fehlt");
    }

    // 4) Minimap: statische Kacheln dürfen nur EINMAL gezeichnet werden.
    const mini = d.getElementById("minimap-canvas");
    check("Minimap-Canvas vorhanden", !!mini);
    if (mini && typeof w.toggleMinimap === "function") {
        mini.getContext("2d"); // Element im WeakMap registrieren (Zähler anlegen)
        const st = canvasStats.get(mini);
        const startRects = st.fillRect;
        const startDraws = st.drawImage;
        try {
            w.toggleMinimap();  // an  -> updateMinimap() #1 (Statik aufbauen)
            w.toggleMinimap();  // aus -> kein Update
            w.toggleMinimap();  // an  -> updateMinimap() #2 (nur Cache blitten)
        } catch (e) { errors.push("toggleMinimap: " + e.message); }
        check("Minimap-Statik genau 1x aufgebaut", perf.minimapStatic === 1,
            "minimapStatic=" + perf.minimapStatic);
        check("Minimap-Frames gezählt", (perf.minimapFrames || 0) >= 2,
            "minimapFrames=" + perf.minimapFrames);
        check("Hintergrund per drawImage geblittet", st.drawImage >= startDraws + 2,
            "drawImage +" + (st.drawImage - startDraws));
        check("Keine 770 Tile-Rects pro Frame", (st.fillRect - startRects) < 100,
            "fillRect +" + (st.fillRect - startRects));
    }

    check("Keine Fehler aus den Perf-Patches",
        !errors.some(e => /BVMapPerf|__bvMiniBg|mmBg|bvHasShadow|ME\.render\(reload\)/i.test(e)),
        errors.filter(e => /BVMapPerf|__bvMiniBg|mmBg|bvHasShadow/i.test(e)).slice(0, 2).join(" | "));

    finish();
}, 2600);

function finish() {
    const failed = checks.filter(c => !c.ok);
    for (const c of checks) {
        console.log((c.ok ? "  ok  " : " FAIL ") + c.name + (c.detail ? "  [" + c.detail + "]" : ""));
    }
    console.log(`\n${checks.length - failed.length}/${checks.length} Map-Engine-Checks bestanden`);
    if (errors.length) {
        console.log("Hinweis: " + errors.length + " jsdom-/Stub-bedingte Meldung(en), z. B.: " +
            errors.slice(0, 2).join(" | ").slice(0, 200));
    }
    dom.window.close();
    process.exit(failed.length ? 1 : 0);
}
