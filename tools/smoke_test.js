#!/usr/bin/env node
/**
 * BüroVersum – Laufzeit-Smoke-Test (jsdom)
 * =======================================
 *
 * Die Python-Tests prüfen den gebauten *Text*. Dieser Test führt die
 * gebaute Seite tatsächlich aus: Scripts, DOMContentLoaded, Twemoji,
 * Initialisierung und das Öffnen des Spiels.
 *
 * Voraussetzung (nur für diesen Test, nicht für den Build):
 *
 *     npm install --prefix /tmp/bv-smoke jsdom@26
 *     NODE_PATH=/tmp/bv-smoke/node_modules node tools/smoke_test.js
 *
 * Optional: `node tools/smoke_test.js <pfad-zu-public>`.
 *
 * jsdom nutzt einen sehr alten CSS-Parser (rrweb-cssom) und meldet bei
 * modernem CSS "Could not parse CSS stylesheet". Das ist eine bekannte
 * jsdom-Einschränkung – die CSS-Syntax selbst wird von tools/test_build.py
 * bzw. einem echten Browser geprüft. Alle ANDEREN Fehler sind fatal.
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

/** Liefert lokale Assets aus public/; externe Requests werden blockiert. */
class LocalLoader extends ResourceLoader {
    fetch(url) {
        try {
            const u = new URL(url);
            if (u.hostname === "bv.test") {
                const file = path.join(PUBLIC, decodeURIComponent(u.pathname));
                if (fs.existsSync(file) && fs.statSync(file).isFile()) {
                    return Promise.resolve(fs.readFileSync(file));
                }
            }
        } catch (e) { /* ungültige URL -> leere Antwort */ }
        return Promise.resolve(Buffer.from(""));
    }
}

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => {
    if (e.type === "css parsing") return; // bekannte jsdom-Limitierung
    errors.push("jsdomError: " + String(e.stack || e.message).split("\n").slice(0, 3).join(" | "));
});
vc.on("error", (...args) => errors.push("console.error: " + args.map(String).join(" ").slice(0, 300)));
vc.on("warn", () => {});
vc.on("info", () => {});
vc.on("log", () => {});

/** Minimaler 2D-Context, damit Canvas-Code nicht an jsdom scheitert. */
const noop = () => {};
function stubContext() {
    return new Proxy({}, {
        get(target, key) {
            if (key in target) return target[key];
            if (key === "measureText") return () => ({ width: 10 });
            if (key === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
            if (["createLinearGradient", "createRadialGradient", "createPattern"].includes(key)) {
                return () => ({ addColorStop: noop });
            }
            if (key === "getLineDash") return () => [];
            return typeof key === "string" ? noop : undefined;
        },
        set(target, key, value) { target[key] = value; return true; }
    });
}

const dom = new JSDOM(html, {
    url: "http://bv.test/index.html",
    runScripts: "dangerously",
    resources: new LocalLoader(),
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
        window.HTMLCanvasElement.prototype.getContext = stubContext;
        window.matchMedia = () => ({
            matches: false, media: "", onchange: null,
            addListener: noop, removeListener: noop,
            addEventListener: noop, removeEventListener: noop,
            dispatchEvent: () => false
        });
        window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
        window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
        window.Audio = class { play() { return Promise.resolve(); } pause() {} };
        window.scrollTo = noop;
        window.onerror = (msg, src, line, col) => {
            errors.push("window.onerror: " + msg + " @" + line + ":" + col);
            return true;
        };
        window.addEventListener("error", e => errors.push("error-event: " + (e.message || e.type)));
        window.addEventListener("unhandledrejection", e => errors.push("rejection: " + e.reason));
    }
});

const w = dom.window;
const checks = [];
function check(name, condition, detail) {
    checks.push({ name, ok: !!condition, detail: detail || "" });
}

// Nach dem Parsen: alles initialisiert, DOM sauber geschlossen.
setTimeout(() => {
    const d = w.document;
    const overlay = d.getElementById("rpg-overlay");
    const wrapper = d.getElementById("zuef-main-wrapper");
    const footer = d.querySelector(".bv-shell-footer");

    check("Twemoji geladen", typeof w.twemoji !== "undefined");
    check("Build-Stempel gesetzt", /^\d{4}-\d{2}-\d{2}-[0-9a-f]{8}$/.test(w.BV_BUILD || ""), w.BV_BUILD || "fehlt");
    check("openRPG verfügbar", typeof w.openRPG === "function");
    check("Overlay + Wrapper vorhanden", !!overlay && !!wrapper);
    check("Overlay korrekt geschachtelt", overlay && wrapper && overlay.parentNode === wrapper);
    check("Wrapper außerhalb von main geschlossen",
        !!wrapper && wrapper.parentNode === d.querySelector("main.bv-shell-main"));
    check("Footer NICHT im unsichtbaren Overlay",
        !!footer && !!overlay && !overlay.contains(footer));

    // Promo-Karte anklicken -> Spiel muss öffnen.
    const card = d.getElementById("zuef-secret-trigger");
    try {
        if (card) card.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    } catch (e) {
        errors.push("Klick auf Promo-Karte: " + e.message);
    }
}, 1200);

// Etwas später: Opening-Animation (50 ms Timeout) muss durchgelaufen sein.
setTimeout(() => {
    const d = w.document;
    const overlay = d.getElementById("rpg-overlay");
    check("Spiel öffnet (Overlay .open)",
        !!overlay && overlay.classList.contains("open"), overlay ? overlay.className : "kein Overlay");
    check("body.rpg-active gesetzt", d.body.classList.contains("rpg-active"));
    check("keine Laufzeitfehler", errors.length === 0, errors.slice(0, 5).join(" || "));

    const failed = checks.filter(c => !c.ok);
    for (const c of checks) {
        console.log((c.ok ? "  ok  " : " FAIL ") + c.name + (c.detail ? "  [" + c.detail + "]" : ""));
    }
    console.log(`\n${checks.length - failed.length}/${checks.length} Checks bestanden` +
        (failed.length ? ` – ${failed.length} fehlgeschlagen` : " – Spiel bootet sauber"));
    dom.window.close();
    process.exit(failed.length ? 1 : 0);
}, 2600);
