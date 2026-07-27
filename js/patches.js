(function () {
    function trackPress(e) {
        var btn = e.target.closest('.title-btn');
        if (!btn) return;
        var rect = btn.getBoundingClientRect();
        var x = ((e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || rect.left + rect.width / 2) - rect.left) / rect.width * 100;
        var y = ((e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || rect.top + rect.height / 2) - rect.top) / rect.height * 100;
        btn.style.setProperty('--press-x', x + '%');
        btn.style.setProperty('--press-y', y + '%');
    }
    document.addEventListener('mousedown', trackPress, { passive: true });
    document.addEventListener('touchstart', trackPress, { passive: true });
})();
</script>

<script>
/* ARENA TITLE BUTTON STATE MANAGER JS */
(function () {
    var originalConfirm = window.confirm;
    var managerInitialized = false;

    function initManager() {
        if (managerInitialized) return;
        managerInitialized = true;

        var titleScreen = document.getElementById('rpg-title-screen');
        var buttonsContainer = titleScreen ? titleScreen.querySelector('.title-buttons') : null;
        if (!buttonsContainer) return;

        // v7.10.6: Die finale Manager-CSS war vorhanden, aber ohne diese Klassen inaktiv.
        // Dadurch gewannen alte Hover/Touch-Patches. Jetzt steuert genau dieser Manager die Title-Buttons.
        titleScreen.classList.add('bv-title-controlled', 'bv-title-ready');

        var BUTTON_IDS = ['title-new-game', 'title-continue', 'title-battle-editor', 'title-delete-save'];
        var buttons = [];

        BUTTON_IDS.forEach(function (id) {
            var btn = document.getElementById(id);
            if (btn) {
                btn.type = 'button';
                btn.classList.add('bv-managed');
                buttons.push(btn);
            }
        });

        function cleanupOldStates(btn) {
            btn.classList.remove(
                'bv-touching', 'bv-released', 'bv-idle-lock',
                'bv-clicking', 'bv-click-confirm', 'bv-press',
                'bv-press-v2', 'bv-release-v2', 'bv-click-confirm-v2'
            );
            if (btn._bvReleaseTimer) { clearTimeout(btn._bvReleaseTimer); btn._bvReleaseTimer = null; }
            if (btn._bvClickTimer) { clearTimeout(btn._bvClickTimer); btn._bvClickTimer = null; }
        }

        function setState(btn, state) {
            btn.classList.remove('bv-state-idle', 'bv-state-hover', 'bv-state-press', 'bv-state-release', 'bv-state-click');
            btn.classList.add('bv-state-' + state);
        }

        function isDeleting(btn) {
            return btn.classList.contains('deleting') ||
                   btn.classList.contains('crumble') ||
                   btn.classList.contains('continue-deleting');
        }

        function getManagedButtonFromEvent(e) {
            var btn = e.target.closest ? e.target.closest('.title-btn') : null;
            if (!btn || !btn.classList.contains('bv-managed') || isDeleting(btn)) return null;
            return btn;
        }

        function spawnClickEffects(btn) {
            var rect = btn.getBoundingClientRect();
            var x = rect.width / 2;
            var y = rect.height / 2;

            // Ripple
            var ripple = document.createElement('span');
            ripple.className = 'bv-click-ripple-v2';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.style.width = '42px';
            ripple.style.height = '42px';
            btn.appendChild(ripple);

            // Shockwave
            var shock = document.createElement('span');
            shock.className = 'bv-click-shockwave-v2';
            shock.style.left = x + 'px';
            shock.style.top = y + 'px';
            shock.style.width = '42px';
            shock.style.height = '42px';
            btn.appendChild(shock);

            // Partikel
            var particleContainer = document.createElement('span');
            particleContainer.className = 'bv-click-particles-v2';
            btn.appendChild(particleContainer);

            for (var i = 0; i < 8; i++) {
                var angle = (i / 8) * Math.PI * 2 + Math.random() * 0.35;
                var distance = 28 + Math.random() * 22;
                var dx = Math.cos(angle) * distance;
                var dy = Math.sin(angle) * distance;
                var particle = document.createElement('span');
                particle.className = 'particle';
                particle.style.left = x + 'px';
                particle.style.top = y + 'px';
                particle.style.setProperty('--dx', dx + 'px');
                particle.style.setProperty('--dy', dy + 'px');
                particle.style.animationDelay = (Math.random() * 0.08) + 's';
                particleContainer.appendChild(particle);
            }

            setTimeout(function () {
                if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
                if (shock.parentNode) shock.parentNode.removeChild(shock);
                if (particleContainer.parentNode) particleContainer.parentNode.removeChild(particleContainer);
            }, 700);
        }

        function spawnContinueParticles() {
            var continueBtn = document.getElementById('title-continue');
            if (!continueBtn || continueBtn.style.display === 'none') return;

            var particles = ['0', '1', 'SAVE', 'KB', 'DATA', 'DEL', 'MEM', 'FILE'];
            var rect = continueBtn.getBoundingClientRect();
            var count = 18;

            for (var i = 0; i < count; i++) {
                var p = document.createElement('span');
                p.className = 'bv-continue-delete-particle';
                p.textContent = particles[Math.floor(Math.random() * particles.length)];

                var x = 8 + Math.random() * (rect.width - 16);
                var y = 6 + Math.random() * (rect.height - 12);
                var angle = Math.random() * Math.PI * 2;
                var distance = 32 + Math.random() * 55;
                var dx = Math.cos(angle) * distance;
                var dy = Math.sin(angle) * distance + 25;
                var rot = (Math.random() - 0.5) * 100;

                p.style.left = x + 'px';
                p.style.top = y + 'px';
                p.style.setProperty('--dx', dx + 'px');
                p.style.setProperty('--dy', dy + 'px');
                p.style.setProperty('--rot', rot + 'deg');
                p.style.animationDelay = (Math.random() * 0.15) + 's';

                continueBtn.appendChild(p);

                (function (particle) {
                    setTimeout(function () {
                        if (particle.parentNode) particle.parentNode.removeChild(particle);
                    }, 1050);
                })(p);
            }
        }

        function addScreenEffects() {
            if (!titleScreen) return;
            titleScreen.classList.add('bv-delete-shaking');
            titleScreen.classList.add('bv-delete-glitch');
            setTimeout(function () { titleScreen.classList.remove('bv-delete-shaking'); }, 520);
            setTimeout(function () { titleScreen.classList.remove('bv-delete-glitch'); }, 320);
        }

        function showDeleteModal(deleteBtn) {
            if (document.querySelector('.bv-delete-confirm-overlay')) return;
            var overlay = document.createElement('div');
            overlay.className = 'bv-delete-confirm-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.innerHTML =
                '<div class="bv-delete-confirm-modal">' +
                    '<h3>⚠️ Speicherdaten löschen?</h3>' +
                    '<p>Willst du wirklich alle Speicherdaten unwiderruflich löschen?<br>Dieser Fortschritt geht verloren!</p>' +
                    '<div class="bv-delete-confirm-actions">' +
                        '<button class="bv-delete-confirm-btn secondary">Abbrechen</button>' +
                        '<button class="bv-delete-confirm-btn danger">🗑️ Ja, löschen</button>' +
                    '</div>' +
                '</div>';

            document.body.appendChild(overlay);

            var dangerBtn = overlay.querySelector('.danger');
            if (dangerBtn) setTimeout(function () { dangerBtn.focus(); }, 50);

            var cancelBtn = overlay.querySelector('.secondary');

            function escHandler(e) {
                if (e.key === 'Escape') handleCancel();
            }

            function closeModal() {
                document.removeEventListener('keydown', escHandler, true);
                overlay.classList.add('bv-delete-confirm-closing');
                setTimeout(function () {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                }, 250);
            }

            function handleCancel() {
                closeModal();
            }

            function handleConfirm() {
                closeModal();
                deleteBtn._bvManagerDispatch = true;
                deleteBtn._bvDeleteConfirmed = true;
                deleteBtn._bvAllowOriginalClick = true;

                spawnContinueParticles();
                addScreenEffects();

                try {
                    window.confirm = function () { return true; };
                    deleteBtn.click();
                } finally {
                    window.confirm = originalConfirm;
                    deleteBtn._bvManagerDispatch = false;
                    deleteBtn._bvDeleteConfirmed = false;
                    deleteBtn._bvAllowOriginalClick = false;
                }

                setTimeout(function () {
                    cleanupOldStates(deleteBtn);
                    setState(deleteBtn, 'idle');
                }, 2000);
            }

            cancelBtn.addEventListener('click', handleCancel);
            dangerBtn.addEventListener('click', handleConfirm);
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) handleCancel();
            });
            document.addEventListener('keydown', escHandler, true);
        }

        // Pointer-States (pointerover/pointerout statt pointerenter/pointerleave — diese bubbeln nicht)
        buttonsContainer.addEventListener('pointerover', function (e) {
            var btn = getManagedButtonFromEvent(e);
            if (!btn) return;
            if (btn.classList.contains('bv-state-press') || btn.classList.contains('bv-state-click') || btn.classList.contains('bv-state-release') || btn._bvClickPending) return;
            cleanupOldStates(btn);
            setState(btn, 'hover');
        }, true);

        buttonsContainer.addEventListener('pointerdown', function (e) {
            var btn = getManagedButtonFromEvent(e);
            if (!btn) return;
            btn._bvClickPending = true;
            cleanupOldStates(btn);
            btn.classList.remove('bv-state-release');
            setState(btn, 'press');
        }, true);

        buttonsContainer.addEventListener('pointerup', function (e) {
            var btn = getManagedButtonFromEvent(e);
            if (!btn) return;
            // Click-State wird vom Click-Handler gesetzt
        }, true);

        buttonsContainer.addEventListener('pointerout', function (e) {
            var btn = getManagedButtonFromEvent(e);
            if (!btn) return;
            // Nur reagieren wenn wir den Button wirklich verlassen
            if (e.relatedTarget && btn.contains(e.relatedTarget)) return;
            if (btn._bvClickPending) {
                return;
            }
            if (btn.classList.contains('bv-state-press')) {
                cleanupOldStates(btn);
                setState(btn, 'release');
                setTimeout(function () {
                    cleanupOldStates(btn);
                    setState(btn, 'idle');
                }, 350);
            } else if (btn.classList.contains('bv-state-click')) {
            } else {
                cleanupOldStates(btn);
                setState(btn, 'idle');
            }
        }, true);

        // Click-Handler mit Delay / Delete-Modal
        buttonsContainer.addEventListener('click', function (e) {
            var btn = getManagedButtonFromEvent(e);
            if (!btn) return;
            if (btn._bvManagerDispatch) return;

            if (btn.id === 'title-delete-save') {
                e.preventDefault();
                e.stopImmediatePropagation();
                var continueBtn = document.getElementById('title-continue');
                var hasVisibleSave = continueBtn && continueBtn.style.display !== 'none' &&
                    (!window.getComputedStyle || getComputedStyle(continueBtn).display !== 'none');
                if (!hasVisibleSave || window.BVDeleteFxRunning) return;
                btn._bvClickPending = false;
                cleanupOldStates(btn);
                setState(btn, 'idle');
                showDeleteModal(btn);
                return;
            }

            e.preventDefault();
            e.stopImmediatePropagation();

            btn._bvClickPending = false;
            cleanupOldStates(btn);
            setState(btn, 'click');
            spawnClickEffects(btn);

            setTimeout(function () {
                btn._bvManagerDispatch = true;
                btn._bvAllowOriginalClick = true;
                btn.click();
                btn._bvAllowOriginalClick = false;
                btn._bvManagerDispatch = false;
                cleanupOldStates(btn);
                setState(btn, 'idle');
            }, 180);
        }, true);

        // Relayout-FLIP Observer
        function initRelayoutObserver() {
            var continueBtn = document.getElementById('title-continue');
            if (!continueBtn || continueBtn.dataset.bvManagerRelayout) return;
            continueBtn.dataset.bvManagerRelayout = '1';

            var firstRects = null;
            var relayoutDone = false;

            function getOtherButtons() {
                return titleScreen.querySelectorAll('.title-buttons .title-btn:not(.continue-deleting)');
            }

            var observer = new MutationObserver(function () {
                if (continueBtn.classList.contains('continue-deleting') && !firstRects) {
                    firstRects = [];
                    var btns = getOtherButtons();
                    btns.forEach(function (b) {
                        firstRects.push({ top: b.offsetTop, left: b.offsetLeft });
                    });
                    firstRects._buttons = btns;
                }
                if (continueBtn.style.display === 'none' && firstRects && !relayoutDone) {
                    relayoutDone = true;
                    requestAnimationFrame(function () {
                        var btns = firstRects._buttons;
                        btns.forEach(function (b, i) {
                            var dx = firstRects[i].left - b.offsetLeft;
                            var dy = firstRects[i].top - b.offsetTop;
                            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
                            b.classList.add('bv-state-relayout');
                            b.style.setProperty('transform', 'translate(' + dx + 'px, ' + dy + 'px) scale(0.98)', 'important');
                            requestAnimationFrame(function () {
                                b.style.setProperty('transform', '', 'important');
                            });
                        });
                        setTimeout(function () {
                            btns.forEach(function (b) {
                                b.classList.remove('bv-state-relayout');
                                b.style.removeProperty('transform');
                            });
                        }, 600);
                    });
                }
            });

            observer.observe(continueBtn, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        }

        initRelayoutObserver();
    }

    function waitForElements() {
        if (document.getElementById('rpg-title-screen') &&
            document.querySelector('#rpg-title-screen .title-buttons')) {
            initManager();
        } else {
            setTimeout(waitForElements, 100);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForElements, { once: true });
    } else {
        waitForElements();
    }
})();
</script>
<!-- 
=============================================================
  ARENA PATCH: SHOP & SKILL SHOP COMPLETE OVERHAUL v1.0
  Autor: Arena.ai Gamecoder
  Datum: 2026-06-18
  Beschreibung:
    - Komplett neues Shop-Design (Tab-System, Kategorien)
    - Neues SkillShop-Design mit Skill-Level-System
    - Neue Animationen: Einflug, Kauf-Burst, Item-Highlight
    - Neue Items: Rucksack, Armor, Boosts, Combo-Items
    - Neue Skills: Passiv-Stärkungen, Ultimate-Skills
    - Händler-Reaktionen & Dialogsystem
    - Hot-Deal / Tages-Angebot System
    - Verkaufen-Funktion (Items zurückverkaufen)
    - Filterkategorien für Items
    - Vollständig responsive
=============================================================
-->

<!-- ============================================================
     PATCH CSS: SHOP & SKILLSHOP OVERHAUL
     ============================================================ -->
<style>
/* ============================================================
   ARENA SHOP OVERHAUL - CSS
   ============================================================ */

/* ---- Screenfix ---- */
#rpg-shop-screen,
#rpg-skillshop-screen {
    justify-content: center !important;
    align-items: center !important;
    overflow: hidden !important;
}

/* ---- Neues Hintergrund-System ---- */
.bv-shop-bg {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
}

.bv-shop-bg-gradient {
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 60% 0%, #1a3a6e 0%, #0a0f1e 55%, #0d1a10 100%);
    transition: background 0.6s ease;
}

.bv-skillshop-bg .bv-shop-bg-gradient {
    background: radial-gradient(ellipse at 40% 0%, #2a1a5e 0%, #0a0f1e 55%, #0d0a1e 100%);
}

/* Animierte Schwebende Orbs */
.bv-shop-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    opacity: 0.18;
    pointer-events: none;
    animation: bvShopOrbFloat 8s ease-in-out infinite alternate;
}
.bv-shop-orb.o1 {
    width: 320px; height: 320px;
    background: radial-gradient(circle, #4a9fff 0%, transparent 70%);
    top: -80px; left: -60px;
    animation-duration: 9s;
}
.bv-shop-orb.o2 {
    width: 260px; height: 260px;
    background: radial-gradient(circle, #ffd700 0%, transparent 70%);
    bottom: -60px; right: -40px;
    animation-duration: 11s; animation-delay: -3s;
    opacity: 0.12;
}
.bv-shop-orb.o3 {
    width: 180px; height: 180px;
    background: radial-gradient(circle, #44ff88 0%, transparent 70%);
    top: 40%; left: 60%;
    animation-duration: 7s; animation-delay: -5s;
    opacity: 0.1;
}
.bv-skillshop-bg .bv-shop-orb.o1 {
    background: radial-gradient(circle, #a855f7 0%, transparent 70%);
}
.bv-skillshop-bg .bv-shop-orb.o2 {
    background: radial-gradient(circle, #ffd700 0%, transparent 70%);
}
.bv-skillshop-bg .bv-shop-orb.o3 {
    background: radial-gradient(circle, #f472b6 0%, transparent 70%);
}

@keyframes bvShopOrbFloat {
    0%   { transform: translate(0, 0) scale(1); }
    100% { transform: translate(20px, -30px) scale(1.12); }
}

/* Partikel-Grid */
.bv-shop-grid {
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(rgba(74,159,255,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(74,159,255,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
}

/* Floating Dust Partikel */
.bv-shop-dust {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.bv-shop-dust::before,
.bv-shop-dust::after {
    content: '';
    position: absolute;
    width: 3px; height: 3px;
    background: rgba(74,159,255,0.55);
    border-radius: 50%;
    box-shadow:
        80px 40px 0 rgba(74,159,255,0.4),
        200px 120px 0 rgba(255,215,0,0.35),
        320px 60px 0 rgba(74,159,255,0.3),
        60px 200px 0 rgba(68,255,136,0.3),
        420px 80px 0 rgba(74,159,255,0.4),
        140px 280px 0 rgba(255,215,0,0.25),
        500px 160px 0 rgba(74,159,255,0.3),
        240px 40px 0 rgba(255,215,0,0.3),
        360px 220px 0 rgba(68,255,136,0.25);
    animation: bvShopDustFloat 18s linear infinite;
}
.bv-shop-dust::after {
    animation-delay: -9s;
    box-shadow:
        120px 80px 0 rgba(255,215,0,0.3),
        280px 40px 0 rgba(74,159,255,0.35),
        450px 140px 0 rgba(68,255,136,0.3),
        30px 300px 0 rgba(74,159,255,0.25),
        380px 260px 0 rgba(255,215,0,0.3);
}
@keyframes bvShopDustFloat {
    0%   { transform: translateY(0); }
    100% { transform: translateY(-100%); }
}

/* ---- Shop Haupt-Container ---- */
.bv-shop-container {
    position: relative;
    z-index: 2;
    width: 96%;
    max-width: 740px;
    max-height: 620px;
    display: flex;
    flex-direction: column;
    background: linear-gradient(165deg, rgba(18,30,60,0.97) 0%, rgba(8,15,30,0.99) 100%);
    border: 1.5px solid rgba(74,159,255,0.35);
    border-radius: 24px;
    overflow: hidden;
    box-shadow:
        0 32px 80px rgba(0,0,0,0.75),
        0 0 0 1px rgba(74,159,255,0.1),
        inset 0 1px 0 rgba(255,255,255,0.07),
        0 0 80px rgba(74,159,255,0.08);
    animation: bvShopContainerIn 0.55s cubic-bezier(0.22, 1.2, 0.36, 1) both;
}

.bv-skillshop-container {
    border-color: rgba(168,85,247,0.35);
    box-shadow:
        0 32px 80px rgba(0,0,0,0.75),
        0 0 0 1px rgba(168,85,247,0.1),
        inset 0 1px 0 rgba(255,255,255,0.07),
        0 0 80px rgba(168,85,247,0.08);
}

@keyframes bvShopContainerIn {
    0%   { opacity: 0; transform: scale(0.88) translateY(32px); filter: blur(8px); }
    60%  { opacity: 1; filter: blur(0); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* ---- Shop Top-Header ---- */
.bv-shop-top-header {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0 20px;
    min-height: 64px;
    background: linear-gradient(90deg, rgba(74,159,255,0.12) 0%, rgba(74,159,255,0.04) 100%);
    border-bottom: 1px solid rgba(74,159,255,0.18);
    position: relative;
    flex-shrink: 0;
}

.bv-skillshop-container .bv-shop-top-header {
    background: linear-gradient(90deg, rgba(168,85,247,0.14) 0%, rgba(168,85,247,0.04) 100%);
    border-bottom-color: rgba(168,85,247,0.2);
}

/* Händler-Avatar */
.bv-keeper-avatar-wrap {
    position: relative;
    flex-shrink: 0;
    margin-right: 14px;
}

.bv-keeper-avatar {
    width: 52px; height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(74,159,255,0.2), rgba(20,60,120,0.6));
    border: 2px solid rgba(74,159,255,0.5);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.9rem;
    box-shadow: 0 0 20px rgba(74,159,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1);
    animation: bvKeeperBob 3s ease-in-out infinite;
    position: relative;
    z-index: 1;
}

.bv-skillshop-container .bv-keeper-avatar {
    background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(60,20,120,0.6));
    border-color: rgba(168,85,247,0.5);
    box-shadow: 0 0 20px rgba(168,85,247,0.25), inset 0 1px 0 rgba(255,255,255,0.1);
}

.bv-keeper-status-dot {
    position: absolute;
    bottom: 3px; right: 3px;
    width: 11px; height: 11px;
    background: #44ff88;
    border-radius: 50%;
    border: 2px solid #0a0f1e;
    animation: bvStatusPulse 2s infinite;
    z-index: 2;
}

@keyframes bvKeeperBob {
    0%, 100% { transform: translateY(0) rotate(-1deg); }
    50%       { transform: translateY(-5px) rotate(1deg); }
}
@keyframes bvStatusPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(68,255,136,0.7); }
    50%       { box-shadow: 0 0 0 5px rgba(68,255,136,0); }
}

/* Dialog-Bereich */
.bv-keeper-dialog-wrap {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.bv-keeper-name {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.72rem;
    color: #ffd700;
    text-shadow: 0 0 12px rgba(255,215,0,0.5);
    letter-spacing: 0.5px;
}

.bv-skillshop-container .bv-keeper-name {
    color: #d8b4fe;
    text-shadow: 0 0 12px rgba(216,180,254,0.5);
}

.bv-keeper-speech-bubble {
    background: rgba(0,0,0,0.35);
    border: 1px solid rgba(74,159,255,0.2);
    border-radius: 0 10px 10px 10px;
    padding: 6px 12px;
    font-size: 0.85rem;
    color: #c8deff;
    font-style: italic;
    max-width: 320px;
    position: relative;
    transition: all 0.35s ease;
}
.bv-skillshop-container .bv-keeper-speech-bubble {
    border-color: rgba(168,85,247,0.25);
    color: #e9d5ff;
}
.bv-keeper-speech-bubble::before {
    content: '';
    position: absolute;
    top: -7px; left: 12px;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-bottom: 7px solid rgba(74,159,255,0.2);
}
.bv-skillshop-container .bv-keeper-speech-bubble::before {
    border-bottom-color: rgba(168,85,247,0.25);
}

.bv-keeper-speech-bubble.bv-speech-anim {
    animation: bvSpeechBubbleJump 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes bvSpeechBubbleJump {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.04) translateY(-2px); }
    100% { transform: scale(1); }
}

/* Gold-Anzeige rechts */
.bv-shop-gold-panel {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
    flex-shrink: 0;
    margin-left: 16px;
}

.bv-shop-gold-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, rgba(255,215,0,0.14), rgba(180,130,0,0.1));
    border: 1.5px solid rgba(255,215,0,0.4);
    border-radius: 12px;
    padding: 6px 14px 6px 10px;
    box-shadow: 0 0 16px rgba(255,215,0,0.1), inset 0 1px 0 rgba(255,255,255,0.07);
}
.bv-shop-gold-icon {
    font-size: 1.35rem;
    filter: drop-shadow(0 0 6px rgba(255,215,0,0.6));
}
.bv-shop-gold-amount {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.95rem;
    color: #ffd700;
    text-shadow: 0 0 10px rgba(255,215,0,0.5);
    transition: all 0.3s ease;
}
.bv-shop-gold-label {
    font-size: 0.65rem;
    color: rgba(255,215,0,0.5);
    text-align: right;
    letter-spacing: 0.5px;
}

/* Gold-Animation beim Kaufen */
.bv-gold-drop {
    animation: bvGoldDrop 0.4s ease both;
}
@keyframes bvGoldDrop {
    0%   { transform: scale(1.35); color: #fff; text-shadow: 0 0 18px #ffd700; }
    100% { transform: scale(1); }
}

/* ---- Tab-Leiste (Item Shop) ---- */
.bv-shop-tabs {
    display: flex;
    gap: 4px;
    padding: 10px 20px 0;
    background: rgba(0,0,0,0.2);
    flex-shrink: 0;
    overflow-x: auto;
    scrollbar-width: none;
}
.bv-shop-tabs::-webkit-scrollbar { display: none; }

.bv-shop-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 10px 10px 0 0;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(74,159,255,0.12);
    border-bottom: none;
    color: rgba(180,200,255,0.6);
    font-family: 'VT323', monospace;
    font-size: 1.05rem;
    cursor: pointer;
    transition: all 0.25s ease;
    white-space: nowrap;
    flex-shrink: 0;
    position: relative;
    user-select: none;
}
.bv-shop-tab:hover {
    background: rgba(74,159,255,0.12);
    color: rgba(180,210,255,0.9);
}
.bv-shop-tab.bv-tab-active {
    background: rgba(74,159,255,0.18);
    border-color: rgba(74,159,255,0.45);
    color: #fff;
    box-shadow: 0 0 14px rgba(74,159,255,0.15);
}
.bv-shop-tab.bv-tab-active::after {
    content: '';
    position: absolute;
    bottom: -1px; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, rgba(74,159,255,0.8), rgba(74,159,255,0.3));
    border-radius: 2px 2px 0 0;
}
.bv-shop-tab-icon {
    font-size: 1.1rem;
}
.bv-shop-tab-count {
    background: rgba(74,159,255,0.25);
    border-radius: 8px;
    padding: 1px 6px;
    font-size: 0.75rem;
    color: #8ec5ff;
    border: 1px solid rgba(74,159,255,0.3);
}

/* ---- Tab-Content-Bereich ---- */
.bv-shop-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: rgba(0,0,0,0.15);
    border-top: 1px solid rgba(74,159,255,0.12);
}

/* Tages-Angebot Banner */
.bv-daily-deal-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 18px;
    background: linear-gradient(90deg, rgba(255,160,0,0.15), rgba(255,100,0,0.08), transparent);
    border-bottom: 1px solid rgba(255,160,0,0.2);
    flex-shrink: 0;
    animation: bvDailyBannerPulse 3s ease-in-out infinite;
}
@keyframes bvDailyBannerPulse {
    0%, 100% { border-bottom-color: rgba(255,160,0,0.2); }
    50%       { border-bottom-color: rgba(255,160,0,0.4); }
}
.bv-daily-deal-icon {
    font-size: 1.4rem;
    animation: bvDailyIconSpin 4s linear infinite;
}
@keyframes bvDailyIconSpin {
    0%   { transform: rotate(0deg) scale(1); }
    50%  { transform: rotate(15deg) scale(1.15); }
    100% { transform: rotate(0deg) scale(1); }
}
.bv-daily-deal-text {
    flex: 1;
}
.bv-daily-deal-title {
    font-size: 0.72rem;
    font-family: 'Press Start 2P', monospace;
    color: #ffb347;
    text-shadow: 0 0 10px rgba(255,179,71,0.5);
}
.bv-daily-deal-desc {
    font-size: 0.82rem;
    color: rgba(255,200,120,0.8);
    margin-top: 2px;
}
.bv-daily-deal-badge {
    background: linear-gradient(135deg, #ff7b00, #ff4500);
    color: #fff;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.65rem;
    padding: 5px 10px;
    border-radius: 8px;
    box-shadow: 0 0 12px rgba(255,100,0,0.4);
    animation: bvDealBadgeGlow 2s ease-in-out infinite alternate;
    flex-shrink: 0;
}
@keyframes bvDealBadgeGlow {
    from { box-shadow: 0 0 8px rgba(255,100,0,0.3); }
    to   { box-shadow: 0 0 20px rgba(255,100,0,0.7); }
}

/* Item-Grid */
.bv-shop-items-grid {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px 16px 8px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-content: start;
    scrollbar-width: thin;
    scrollbar-color: rgba(74,159,255,0.3) transparent;
    max-height: 350px;
}
.bv-shop-items-grid::-webkit-scrollbar { width: 4px; }
.bv-shop-items-grid::-webkit-scrollbar-thumb {
    background: rgba(74,159,255,0.3);
    border-radius: 4px;
}

/* Einzelnes Item-Card */
.bv-shop-item-card {
    display: flex;
    flex-direction: column;
    gap: 0;
    background: linear-gradient(165deg, rgba(30,50,90,0.6) 0%, rgba(10,18,40,0.8) 100%);
    border: 1px solid rgba(74,159,255,0.16);
    border-radius: 14px;
    padding: 14px 14px 12px;
    cursor: pointer;
    position: relative;
    overflow: visible;
    min-height: 160px;
    transition: border-color 0.25s, box-shadow 0.25s, transform 0.22s cubic-bezier(0.22,1,0.36,1);
    animation: bvItemCardIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}
.bv-shop-item-card:nth-child(1)  { animation-delay: 0.00s; }
.bv-shop-item-card:nth-child(2)  { animation-delay: 0.04s; }
.bv-shop-item-card:nth-child(3)  { animation-delay: 0.08s; }
.bv-shop-item-card:nth-child(4)  { animation-delay: 0.12s; }
.bv-shop-item-card:nth-child(5)  { animation-delay: 0.16s; }
.bv-shop-item-card:nth-child(6)  { animation-delay: 0.20s; }
.bv-shop-item-card:nth-child(7)  { animation-delay: 0.24s; }
.bv-shop-item-card:nth-child(8)  { animation-delay: 0.28s; }
.bv-shop-item-card:nth-child(9)  { animation-delay: 0.32s; }
.bv-shop-item-card:nth-child(10) { animation-delay: 0.36s; }

@keyframes bvItemCardIn {
    0%   { opacity: 0; transform: translateY(14px) scale(0.95); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
}

.bv-shop-item-card:hover:not(.bv-card-cant-afford) {
    border-color: rgba(74,159,255,0.55);
    box-shadow: 0 6px 24px rgba(74,159,255,0.18), 0 0 0 1px rgba(74,159,255,0.2);
    transform: translateY(-3px) scale(1.015);
}
.bv-shop-item-card:active:not(.bv-card-cant-afford) {
    transform: translateY(1px) scale(0.985);
}

/* Shine-Sweep auf Item-Card */
.bv-shop-item-card::before {
    content: '';
    position: absolute;
    top: 0; left: -80%;
    width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
    transform: skewX(-20deg);
    transition: none;
    pointer-events: none;
}
.bv-shop-item-card:hover::before {
    animation: bvCardShine 0.55s ease forwards;
}
@keyframes bvCardShine {
    0%   { left: -80%; }
    100% { left: 160%; }
}

/* Rarity-Leiste oben */
.bv-item-rarity-bar {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    border-radius: 14px 14px 0 0;
    background: linear-gradient(90deg, #4a9fff, #00cfff);
}
.bv-item-rarity-bar.rare   { background: linear-gradient(90deg, #a855f7, #ec4899); }
.bv-item-rarity-bar.epic   { background: linear-gradient(90deg, #f59e0b, #ef4444); }
.bv-item-rarity-bar.common { background: linear-gradient(90deg, #6b7280, #9ca3af); }
.bv-item-rarity-bar.deal   { background: linear-gradient(90deg, #f97316, #ef4444); animation: bvRarityDeal 1.5s linear infinite; }
@keyframes bvRarityDeal {
    0%   { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
}

/* Icon-Bereich */
.bv-item-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    margin-top: 4px;
}

.bv-item-icon {
    font-size: 2.2rem;
    line-height: 1;
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
    display: block;
}
.bv-shop-item-card:hover .bv-item-icon {
    transform: scale(1.22) rotate(-5deg);
}

.bv-item-tag {
    font-size: 0.6rem;
    font-family: 'Press Start 2P', monospace;
    padding: 3px 7px;
    border-radius: 6px;
    letter-spacing: 0.3px;
    line-height: 1.4;
}
.bv-item-tag.heal   { background: rgba(68,255,136,0.18); color: #44ff88; border: 1px solid rgba(68,255,136,0.35); }
.bv-item-tag.atk    { background: rgba(239,68,68,0.18);  color: #f87171; border: 1px solid rgba(239,68,68,0.35); }
.bv-item-tag.def    { background: rgba(74,159,255,0.18); color: #7dd3fc; border: 1px solid rgba(74,159,255,0.35); }
.bv-item-tag.mp     { background: rgba(168,85,247,0.18); color: #c084fc; border: 1px solid rgba(168,85,247,0.35); }
.bv-item-tag.hp     { background: rgba(255,100,100,0.18);color: #fca5a5; border: 1px solid rgba(255,100,100,0.35); }
.bv-item-tag.combo  { background: rgba(251,191,36,0.18); color: #fcd34d; border: 1px solid rgba(251,191,36,0.35); }
.bv-item-tag.deal   { background: rgba(249,115,22,0.25); color: #fb923c; border: 1px solid rgba(249,115,22,0.45); animation: bvTagPulse 1.5s ease-in-out infinite alternate; }
@keyframes bvTagPulse {
    from { box-shadow: none; }
    to   { box-shadow: 0 0 8px rgba(249,115,22,0.6); }
}

/* Item Name & Desc */
.bv-item-name {
    font-size: 1.05rem;
    color: #e8f0ff;
    font-weight: 600;
    letter-spacing: 0.3px;
    line-height: 1.2;
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.bv-item-desc {
    font-size: 0.78rem;
    color: rgba(180,200,240,0.65);
    line-height: 1.4;
    margin-bottom: 10px;
    overflow: hidden;
    max-height: 2.8em;
}

/* Stat-Badges */
.bv-item-stats {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin-bottom: 10px;
}
.bv-stat-badge {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.75rem;
    padding: 3px 8px;
    border-radius: 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(220,235,255,0.85);
    white-space: nowrap;
}
.bv-stat-badge.bv-stat-hp   { background: rgba(239,68,68,0.12);  border-color: rgba(239,68,68,0.25);  color: #fca5a5; }
.bv-stat-badge.bv-stat-mp   { background: rgba(168,85,247,0.12); border-color: rgba(168,85,247,0.25); color: #c084fc; }
.bv-stat-badge.bv-stat-atk  { background: rgba(239,68,68,0.12);  border-color: rgba(239,68,68,0.25);  color: #f87171; }
.bv-stat-badge.bv-stat-def  { background: rgba(74,159,255,0.12); border-color: rgba(74,159,255,0.25); color: #7dd3fc; }

/* Preis-Reihe */
.bv-item-buy-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: auto;
}

.bv-item-price {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.85rem;
    color: #ffd700;
    text-shadow: 0 0 8px rgba(255,215,0,0.45);
}
.bv-item-price .bv-price-old {
    font-size: 0.65rem;
    color: rgba(255,100,100,0.7);
    text-decoration: line-through;
    text-shadow: none;
}
.bv-item-price .bv-price-deal {
    color: #fb923c;
    text-shadow: 0 0 8px rgba(249,115,22,0.5);
}

.bv-buy-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px 14px;
    background: linear-gradient(135deg, rgba(74,159,255,0.3), rgba(37,99,200,0.4));
    border: 1px solid rgba(74,159,255,0.5);
    border-radius: 10px;
    color: #b8d8ff;
    font-family: 'VT323', monospace;
    font-size: 1.05rem;
    cursor: pointer;
    transition: all 0.22s ease;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
}
.bv-buy-btn:hover {
    background: linear-gradient(135deg, rgba(74,159,255,0.5), rgba(37,99,200,0.6));
    border-color: rgba(74,159,255,0.8);
    color: #fff;
    box-shadow: 0 0 14px rgba(74,159,255,0.35);
    transform: translateY(-1px);
}
.bv-buy-btn:active {
    transform: translateY(1px);
}

/* Can't afford State */
.bv-card-cant-afford {
    opacity: 0.5;
    cursor: not-allowed !important;
}
.bv-card-cant-afford .bv-buy-btn {
    background: rgba(80,80,80,0.2);
    border-color: rgba(150,150,150,0.2);
    color: rgba(150,150,150,0.5);
    cursor: not-allowed;
    pointer-events: none;
}
.bv-card-cant-afford .bv-item-price { color: #f87171; text-shadow: none; }

/* Owned / Sold State */

/* Kauf-Burst Animation */
.bv-shop-item-card.bv-purchase-burst {
    animation: bvPurchaseBurst 0.6s cubic-bezier(0.22,1,0.36,1) both !important;
}
@keyframes bvPurchaseBurst {
    0%   { transform: scale(1); box-shadow: 0 0 0 0 rgba(68,255,136,0.6); }
    25%  { transform: scale(1.06); box-shadow: 0 0 0 12px rgba(68,255,136,0.3); }
    55%  { transform: scale(0.98); box-shadow: 0 0 0 20px rgba(68,255,136,0); }
    100% { transform: scale(1); box-shadow: none; }
}

/* Cant-afford Shake */
.bv-shop-item-card.bv-cant-afford-shake {
    animation: bvCantAffordShake 0.4s ease both !important;
}
@keyframes bvCantAffordShake {
    0%, 100% { transform: translateX(0); }
    20%       { transform: translateX(-6px); }
    40%       { transform: translateX(5px); }
    60%       { transform: translateX(-4px); }
    80%       { transform: translateX(3px); }
}

/* Kauf-Partikel */

/* Floating +Stat Text */

/* ---- Verkaufen-Tab ---- */
.bv-sell-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 40px 20px;
    color: rgba(150,170,220,0.5);
    font-size: 0.9rem;
    text-align: center;
}
.bv-sell-empty-icon { font-size: 3rem; opacity: 0.4; }

.bv-sell-item-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: rgba(30,50,90,0.5);
    border: 1px solid rgba(74,159,255,0.14);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.22s ease;
    animation: bvItemCardIn 0.4s ease both;
    position: relative;
    overflow: hidden;
}
.bv-sell-item-card:hover {
    background: rgba(239,68,68,0.12);
    border-color: rgba(239,68,68,0.35);
    transform: translateX(4px);
}
.bv-sell-item-icon { font-size: 1.8rem; flex-shrink: 0; }
.bv-sell-item-info { flex: 1; min-width: 0; }
.bv-sell-item-name { font-size: 1rem; color: #e8f0ff; display: block; }
.bv-sell-item-count { font-size: 0.75rem; color: rgba(150,180,240,0.6); }
.bv-sell-price {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.8rem;
    color: #f87171;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 4px;
}

/* ---- Shop Footer ---- */
.bv-shop-footer {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    background: rgba(0,0,0,0.25);
    border-top: 1px solid rgba(74,159,255,0.12);
    flex-shrink: 0;
}

.bv-shop-close-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 20px;
    background: linear-gradient(135deg, rgba(80,80,80,0.3), rgba(40,40,40,0.5));
    border: 1.5px solid rgba(150,150,150,0.25);
    border-radius: 12px;
    color: rgba(200,210,230,0.8);
    font-family: 'VT323', monospace;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 0.22s ease;
    position: relative;
    overflow: hidden;
}
.bv-shop-close-btn:hover {
    background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(180,20,20,0.3));
    border-color: rgba(239,68,68,0.4);
    color: #fca5a5;
    transform: translateY(-2px);
}
.bv-shop-close-btn:active { transform: translateY(0); }

.bv-shop-hint {
    font-size: 0.72rem;
    color: rgba(120,140,180,0.5);
    text-align: right;
    line-height: 1.4;
    flex-shrink: 0;
    max-width: 130px;
}

/* ---- Skill Shop spezifisch ---- */
.bv-skill-items-grid {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    scrollbar-width: thin;
    scrollbar-color: rgba(168,85,247,0.3) transparent;
    max-height: 380px;
}
.bv-skill-items-grid::-webkit-scrollbar { width: 4px; }
.bv-skill-items-grid::-webkit-scrollbar-thumb {
    background: rgba(168,85,247,0.3);
    border-radius: 4px;
}

.bv-skill-card {
    display: flex;
    align-items: center;
    gap: 14px;
    background: linear-gradient(135deg, rgba(25,10,55,0.7) 0%, rgba(10,5,30,0.85) 100%);
    border: 1px solid rgba(168,85,247,0.2);
    border-radius: 16px;
    padding: 16px 18px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: all 0.28s cubic-bezier(0.22,1,0.36,1);
    animation: bvSkillCardIn 0.5s cubic-bezier(0.22,1,0.36,1) both;
    user-select: none;
}
.bv-skill-card:nth-child(1) { animation-delay: 0.00s; }
.bv-skill-card:nth-child(2) { animation-delay: 0.06s; }
.bv-skill-card:nth-child(3) { animation-delay: 0.12s; }
.bv-skill-card:nth-child(4) { animation-delay: 0.18s; }
.bv-skill-card:nth-child(5) { animation-delay: 0.24s; }
.bv-skill-card:nth-child(6) { animation-delay: 0.30s; }
.bv-skill-card:nth-child(7) { animation-delay: 0.36s; }
.bv-skill-card:nth-child(8) { animation-delay: 0.42s; }

@keyframes bvSkillCardIn {
    0%   { opacity: 0; transform: translateX(-18px); }
    100% { opacity: 1; transform: translateX(0); }
}

.bv-skill-card:hover:not(.bv-skill-owned):not(.bv-skill-cant-afford) {
    border-color: rgba(168,85,247,0.6);
    box-shadow: 0 6px 28px rgba(168,85,247,0.2), 0 0 0 1px rgba(168,85,247,0.25);
    transform: translateX(6px);
    background: linear-gradient(135deg, rgba(35,15,75,0.8) 0%, rgba(15,8,40,0.9) 100%);
}

/* Skill-Aura/Glow links */
.bv-skill-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, #a855f7, #ec4899);
    border-radius: 16px 0 0 16px;
    transition: width 0.3s ease, box-shadow 0.3s ease;
}
.bv-skill-card:hover:not(.bv-skill-owned):not(.bv-skill-cant-afford)::before {
    width: 5px;
    box-shadow: 2px 0 16px rgba(168,85,247,0.5);
}

/* Skill Icon */
.bv-skill-icon-wrap {
    flex-shrink: 0;
    width: 54px; height: 54px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(168,85,247,0.2), rgba(60,20,120,0.4));
    border: 1.5px solid rgba(168,85,247,0.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 1.8rem;
    box-shadow: 0 0 16px rgba(168,85,247,0.15), inset 0 1px 0 rgba(255,255,255,0.08);
    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease;
    position: relative;
}
.bv-skill-card:hover .bv-skill-icon-wrap {
    transform: scale(1.12) rotate(-3deg);
    box-shadow: 0 0 28px rgba(168,85,247,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
}

/* Skill Info */
.bv-skill-info {
    flex: 1;
    min-width: 0;
}
.bv-skill-name {
    font-size: 1.08rem;
    color: #e8d5ff;
    font-weight: 600;
    margin-bottom: 3px;
}
.bv-skill-desc {
    font-size: 0.8rem;
    color: rgba(200,180,240,0.65);
    margin-bottom: 8px;
    line-height: 1.4;
}

/* Skill Stat Leiste */
.bv-skill-stat-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}
.bv-skill-stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.78rem;
    padding: 3px 9px;
    border-radius: 8px;
    white-space: nowrap;
}
.bv-skill-stat.dmg  { background: rgba(239,68,68,0.15);  border: 1px solid rgba(239,68,68,0.3);  color: #f87171; }
.bv-skill-stat.mp   { background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.3); color: #c084fc; }
.bv-skill-stat.heal { background: rgba(68,255,136,0.12); border: 1px solid rgba(68,255,136,0.3); color: #44ff88; }
.bv-skill-stat.type { background: rgba(74,159,255,0.12); border: 1px solid rgba(74,159,255,0.3); color: #7dd3fc; }
.bv-skill-stat.ult  { background: rgba(251,191,36,0.15); border: 1px solid rgba(251,191,36,0.3); color: #fcd34d; animation: bvUltPulse 2s infinite; }
@keyframes bvUltPulse {
    0%, 100% { box-shadow: none; }
    50%       { box-shadow: 0 0 8px rgba(251,191,36,0.4); }
}

/* Skill-Preis & Unlock-Button */
.bv-skill-buy-area {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    flex-shrink: 0;
}
.bv-skill-price {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.8rem;
    color: #ffd700;
    text-shadow: 0 0 8px rgba(255,215,0,0.4);
    white-space: nowrap;
}
.bv-unlock-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: linear-gradient(135deg, rgba(168,85,247,0.3), rgba(80,20,160,0.5));
    border: 1.5px solid rgba(168,85,247,0.5);
    border-radius: 10px;
    color: #d8b4fe;
    font-family: 'VT323', monospace;
    font-size: 1.05rem;
    cursor: pointer;
    transition: all 0.22s ease;
    white-space: nowrap;
}
.bv-unlock-btn:hover {
    background: linear-gradient(135deg, rgba(168,85,247,0.5), rgba(100,30,200,0.65));
    border-color: rgba(168,85,247,0.9);
    color: #fff;
    box-shadow: 0 0 18px rgba(168,85,247,0.45);
    transform: scale(1.04);
}
.bv-unlock-btn:active { transform: scale(0.97); }

/* Owned State */
.bv-skill-owned {
    opacity: 0.6;
    cursor: default !important;
}
.bv-skill-owned .bv-unlock-btn {
    background: rgba(68,255,136,0.12);
    border-color: rgba(68,255,136,0.3);
    color: #44ff88;
    cursor: default;
    pointer-events: none;
}
.bv-skill-owned .bv-skill-price { color: #44ff88; text-shadow: 0 0 8px rgba(68,255,136,0.4); }
.bv-skill-owned .bv-skill-card::before { background: linear-gradient(180deg, #44ff88, #00cc66); }

/* Can't afford */
.bv-skill-cant-afford { opacity: 0.45; cursor: not-allowed !important; }
.bv-skill-cant-afford .bv-unlock-btn {
    background: rgba(80,80,80,0.15);
    border-color: rgba(100,100,100,0.2);
    color: rgba(150,150,150,0.5);
    pointer-events: none;
}
.bv-skill-cant-afford .bv-skill-price { color: #f87171; text-shadow: none; }

/* Skill Unlock Burst */
.bv-skill-card.bv-skill-unlock-burst {
    animation: bvSkillUnlockBurst 0.7s cubic-bezier(0.22,1,0.36,1) both !important;
}
@keyframes bvSkillUnlockBurst {
    0%   { transform: translateX(0) scale(1); box-shadow: 0 0 0 0 rgba(168,85,247,0.8); }
    25%  { transform: translateX(8px) scale(1.04); box-shadow: 0 0 0 14px rgba(168,85,247,0.3); }
    55%  { transform: translateX(-3px) scale(0.99); box-shadow: 0 0 0 24px rgba(168,85,247,0); }
    100% { transform: translateX(0) scale(1); box-shadow: none; }
}

/* Skill Cant-Afford Shake */
.bv-skill-card.bv-skill-shake {
    animation: bvCantAffordShake 0.4s ease both !important;
}

/* ---- Toast-Notification (Shop-intern) ---- */
.bv-shop-toast {
    position: absolute;
    top: 70px;
    left: 50%;
    transform: translateX(-50%) translateY(-16px);
    background: rgba(10,20,40,0.95);
    border: 1px solid rgba(74,159,255,0.4);
    border-radius: 12px;
    padding: 9px 18px;
    color: #c8e0ff;
    font-size: 0.9rem;
    z-index: 50;
    pointer-events: none;
    opacity: 0;
    animation: bvShopToastIn 2.8s cubic-bezier(0.22,1,0.36,1) both;
    white-space: nowrap;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.bv-shop-toast.success { border-color: rgba(68,255,136,0.5); color: #44ff88; background: rgba(5,20,12,0.96); }
.bv-shop-toast.error   { border-color: rgba(239,68,68,0.5);  color: #f87171; background: rgba(25,5,5,0.96); }
.bv-shop-toast.gold    { border-color: rgba(255,215,0,0.5);  color: #ffd700; background: rgba(25,20,5,0.96); }

/* ---- Responsive ---- */
@media (max-width: 600px) {
    .bv-shop-items-grid { grid-template-columns: 1fr !important; }
    .bv-shop-container, .bv-skillshop-container { max-width: 99% !important; border-radius: 16px; }
    .bv-keeper-speech-bubble { max-width: 180px; font-size: 0.75rem; }
    .bv-shop-top-header { padding: 0 12px; min-height: 52px; }
    .bv-skill-card { flex-wrap: wrap; gap: 10px; }
    .bv-skill-buy-area { flex-direction: row; align-items: center; width: 100%; justify-content: space-between; }
}

/* Game-Window ist 900x680px - Shop passt sich an */
#rpg-game-window .bv-shop-container,
#rpg-game-window .bv-skillshop-container {
    max-height: 620px !important;
    max-width: 860px !important;
    width: 95% !important;
}
</style>

<!-- ============================================================
     PATCH JS: SHOP & SKILLSHOP OVERHAUL
     ============================================================ -->
<script>
/* ARENA PATCH JS: SHOP & SKILLSHOP COMPLETE OVERHAUL */
(function () {
'use strict';

/* ============================================================
   NEUE ITEM-DATEN (erweitert + Tages-Deal System)
   ============================================================ */
var BV_SHOP_ITEMS = [
    /* --- Kategorie: Heilung --- */
    { id: 'kaffee',       name: 'Kaffee',           icon: '☕', category: 'heal', rarity: 'common',
      desc: 'Ein frischer Bürokaffee. Heilt Wunden der Seele.',
      stats: [{ label: '❤️ HP', value: '+40', cls: 'bv-stat-hp' }],
      tag: 'heal', tagLabel: 'HEAL',
      price: 25, basePrice: 25, heal: 40 },

    { id: 'energy',       name: 'Energy Drink',      icon: '⚡', category: 'heal', rarity: 'uncommon',
      desc: 'Explosiver Energieschub. Wirkt sofort.',
      stats: [{ label: '❤️ HP', value: '+100', cls: 'bv-stat-hp' }],
      tag: 'heal', tagLabel: 'HEAL',
      price: 60, basePrice: 60, heal: 100 },

    { id: 'donut',        name: 'Büro-Donut',         icon: '🍩', category: 'heal', rarity: 'common',
      desc: 'Süßer Snack aus der Kantine.',
      stats: [{ label: '❤️ HP', value: '+30', cls: 'bv-stat-hp' }, { label: '☕ MP', value: '+3', cls: 'bv-stat-mp' }],
      tag: 'combo', tagLabel: 'COMBO',
      price: 35, basePrice: 35, heal: 30, mpHeal: 3 },

    { id: 'sandwich',     name: 'Sandwich',            icon: '🥪', category: 'heal', rarity: 'common',
      desc: 'Hausgemacht. Gibt ordentlich HP zurück.',
      stats: [{ label: '❤️ HP', value: '+60', cls: 'bv-stat-hp' }],
      tag: 'heal', tagLabel: 'HEAL',
      price: 45, basePrice: 45, heal: 60 },

    { id: 'vitamins',     name: 'Vitamintabletten',    icon: '💊', category: 'heal', rarity: 'uncommon',
      desc: 'Der Arzt sagt: täglich nehmen!',
      stats: [{ label: '❤️ HP', value: '+150', cls: 'bv-stat-hp' }],
      tag: 'heal', tagLabel: 'HEAL',
      price: 100, basePrice: 100, heal: 150 },

    { id: 'superKaffee',  name: 'Super-Espresso',      icon: '☕', category: 'heal', rarity: 'rare',
      desc: 'Dreifacher Schuss. Stellt alles wieder her.',
      stats: [{ label: '❤️ HP', value: 'VOLL', cls: 'bv-stat-hp' }, { label: '☕ MP', value: 'VOLL', cls: 'bv-stat-mp' }],
      tag: 'combo', tagLabel: 'ULTRA',
      price: 200, basePrice: 200, heal: 9999, mpHeal: 99 },

    { id: 'canteen_lunch',name: 'Kantinenessen',        icon: '🍽️', category: 'heal', rarity: 'common',
      desc: 'Warmes Mittagessen. Heilt langsam aber sicher.',
      stats: [{ label: '❤️ HP', value: '+80', cls: 'bv-stat-hp' }, { label: '☕ MP', value: '+5', cls: 'bv-stat-mp' }],
      tag: 'combo', tagLabel: 'COMBO',
      price: 55, basePrice: 55, heal: 80, mpHeal: 5 },

    { id: 'energy_bar',  name: 'Müsliriegel',          icon: '🍫', category: 'heal', rarity: 'common',
      desc: 'Schnelle Energie für den Nachmittagstief.',
      stats: [{ label: '❤️ HP', value: '+50', cls: 'bv-stat-hp' }],
      tag: 'heal', tagLabel: 'HEAL',
      price: 38, basePrice: 38, heal: 50 },

    /* --- Kategorie: Stärke --- */
    { id: 'kuli',         name: 'Kugelschreiber+',     icon: '🖊️', category: 'boost', rarity: 'uncommon',
      desc: 'Präzisionsstift. Steigert Angriffskraft.',
      stats: [{ label: '⚔️ ATK', value: '+5', cls: 'bv-stat-atk' }],
      tag: 'atk', tagLabel: 'ATK',
      price: 100, basePrice: 100, atkBoost: 5 },

    { id: 'krawatte',     name: 'Power-Krawatte',       icon: '👔', category: 'boost', rarity: 'uncommon',
      desc: 'Eleganz als Schutzschild. +Verteidigung.',
      stats: [{ label: '🛡️ DEF', value: '+3', cls: 'bv-stat-def' }],
      tag: 'def', tagLabel: 'DEF',
      price: 120, basePrice: 120, defBoost: 3 },

    { id: 'thermos',      name: 'Thermoskanne',          icon: '🫖', category: 'boost', rarity: 'uncommon',
      desc: 'Hält die Energie warm. Erhöht Max-MP.',
      stats: [{ label: '☕ Max-MP', value: '+5', cls: 'bv-stat-mp' }],
      tag: 'mp', tagLabel: 'MP',
      price: 80, basePrice: 80, mpBoost: 5 },

    { id: 'aktenkoffer',  name: 'Aktenkoffer',           icon: '💼', category: 'boost', rarity: 'rare',
      desc: 'Professionelle Ausrüstung. Erhöht Max-HP.',
      stats: [{ label: '❤️ Max-HP', value: '+25', cls: 'bv-stat-hp' }],
      tag: 'hp', tagLabel: 'HP',
      price: 150, basePrice: 150, hpBoost: 25 },

    { id: 'ergostuhl',    name: 'Ergonomie-Stuhl',       icon: '🪑', category: 'boost', rarity: 'rare',
      desc: 'Gesunder Rücken = mehr Ausdauer. Max-HP++',
      stats: [{ label: '❤️ Max-HP', value: '+40', cls: 'bv-stat-hp' }, { label: '🛡️ DEF', value: '+2', cls: 'bv-stat-def' }],
      tag: 'combo', tagLabel: 'COMBO',
      price: 220, basePrice: 220, hpBoost: 40, defBoost: 2 },

    { id: 'laptop',       name: 'Business-Laptop',       icon: '💻', category: 'boost', rarity: 'rare',
      desc: 'Analyse-Tools steigern Angriff & MP.',
      stats: [{ label: '⚔️ ATK', value: '+8', cls: 'bv-stat-atk' }, { label: '☕ Max-MP', value: '+8', cls: 'bv-stat-mp' }],
      tag: 'combo', tagLabel: 'COMBO',
      price: 280, basePrice: 280, atkBoost: 8, mpBoost: 8 },

    { id: 'smartphone',   name: 'Business-Phone',        icon: '📱', category: 'boost', rarity: 'uncommon',
      desc: 'Immer erreichbar. +ATK durch Effizienz.',
      stats: [{ label: '⚔️ ATK', value: '+3', cls: 'bv-stat-atk' }],
      tag: 'atk', tagLabel: 'ATK',
      price: 90, basePrice: 90, atkBoost: 3 },

    { id: 'headset',      name: 'Pro-Headset',           icon: '🎧', category: 'boost', rarity: 'uncommon',
      desc: 'Konzentrations-Boost. +DEF & +MP.',
      stats: [{ label: '🛡️ DEF', value: '+2', cls: 'bv-stat-def' }, { label: '☕ Max-MP', value: '+3', cls: 'bv-stat-mp' }],
      tag: 'combo', tagLabel: 'COMBO',
      price: 130, basePrice: 130, defBoost: 2, mpBoost: 3 },

    { id: 'bosssuit',     name: 'Chef-Anzug',             icon: '🤵', category: 'boost', rarity: 'epic',
      desc: 'Der ultimative Business-Look. Alle Stats steigen.',
      stats: [
          { label: '⚔️ ATK', value: '+12', cls: 'bv-stat-atk' },
          { label: '🛡️ DEF', value: '+6', cls: 'bv-stat-def' },
          { label: '❤️ Max-HP', value: '+50', cls: 'bv-stat-hp' }
      ],
      tag: 'combo', tagLabel: 'EPIC',
      price: 500, basePrice: 500, atkBoost: 12, defBoost: 6, hpBoost: 50 },
];

/* ============================================================
   NEUE SKILL-DATEN (erweitert, Kategorien, Level-Info)
   ============================================================ */
var BV_SKILL_ITEMS = [
    /* --- Angriff --- */
    { id: 'tacker',    name: 'Tacker-Angriff',       icon: '📎',
      desc: 'Schneller Tacker-Stich. Zuverlässiger Basisangriff.',
      stats: [{ label: '💥 DMG', value: '×2.0', cls: 'dmg' }, { label: '☕ MP', value: '4', cls: 'mp' }],
      typeLabel: 'ANGRIFF', category: 'attack',
      price: 100, dmgMult: 2.0, mpCost: 4 },

    { id: 'kaffee',    name: 'Kaffee-Wurf',           icon: '☕',
      desc: 'Heißer Kaffee direkt ins Gesicht des Gegners.',
      stats: [{ label: '💥 DMG', value: '×2.5', cls: 'dmg' }, { label: '☕ MP', value: '6', cls: 'mp' }],
      typeLabel: 'ANGRIFF', category: 'attack',
      price: 150, dmgMult: 2.5, mpCost: 6 },

    { id: 'papier',    name: 'Papier-Papiertiger',    icon: '📄',
      desc: 'Papierflugzeug mit Highspeed. Überraschender Treffer.',
      stats: [{ label: '💥 DMG', value: '×2.2', cls: 'dmg' }, { label: '☕ MP', value: '5', cls: 'mp' }],
      typeLabel: 'ANGRIFF', category: 'attack',
      price: 120, dmgMult: 2.2, mpCost: 5 },

    { id: 'fax',       name: 'Fax-Blitz',             icon: '📠',
      desc: 'Veraltete Technologie als Waffe. Chaos pur.',
      stats: [{ label: '💥 DMG', value: '×2.8', cls: 'dmg' }, { label: '☕ MP', value: '7', cls: 'mp' }],
      typeLabel: 'ANGRIFF', category: 'attack',
      price: 180, dmgMult: 2.8, mpCost: 7 },

    { id: 'printer',   name: 'Drucker-Crash',          icon: '🖨️',
      desc: 'Wirft einen ganzen Drucker. Massenschaden.',
      stats: [{ label: '💥 DMG', value: '×3.2', cls: 'dmg' }, { label: '☕ MP', value: '9', cls: 'mp' }],
      typeLabel: 'ANGRIFF', category: 'attack',
      price: 220, dmgMult: 3.2, mpCost: 9 },

    { id: 'meeting',   name: 'Meeting einberufen',    icon: '📊',
      desc: 'Der Horror jedes Mitarbeiters. Extrem effektiv.',
      stats: [{ label: '💥 DMG', value: '×3.0', cls: 'dmg' }, { label: '☕ MP', value: '8', cls: 'mp' }],
      typeLabel: 'ANGRIFF', category: 'attack',
      price: 200, dmgMult: 3.0, mpCost: 8 },

    /* --- Spezial --- */
    { id: 'email_bomb', name: 'E-Mail-Flut',          icon: '📧',
      desc: 'Sendet 1000 E-Mails auf einmal. Server-Überlastung.',
      stats: [{ label: '💥 DMG', value: '×2.7', cls: 'dmg' }, { label: '☕ MP', value: '7', cls: 'mp' }, { label: '🔥', value: 'DOT', cls: 'type' }],
      typeLabel: 'SPEZIAL', category: 'special',
      price: 190, dmgMult: 2.7, mpCost: 7 },

    { id: 'ueberstunden', name: 'Überstunden',           icon: '⏰',
      desc: 'Arbeitet in die Nacht. Regeneriert MP über Zeit.',
      stats: [{ label: '☕ MP', value: '+15', cls: 'mp' }, { label: '🌀', value: 'REGEN', cls: 'type' }],
      typeLabel: 'SUPPORT', category: 'support',
      price: 160, mpHeal: 15, mpCost: 0, dmgMult: 0 },

    { id: 'powerpoint', name: 'PowerPoint-Präsi',      icon: '📑',
      desc: '47 Folien. Der Gegner schläft ein. Betäubt.',
      stats: [{ label: '💥 DMG', value: '×1.8', cls: 'dmg' }, { label: '😴', value: 'STUN', cls: 'type' }, { label: '☕ MP', value: '6', cls: 'mp' }],
      typeLabel: 'SPEZIAL', category: 'special',
      price: 175, dmgMult: 1.8, mpCost: 6 },

    /* --- Ultimate --- */
    { id: 'termination', name: 'Kündigung aussprechen', icon: '📋',
      desc: '⚠️ Ultimate. Massiver Schaden + Moral-Debuff.',
      stats: [{ label: '💥 DMG', value: '×4.5', cls: 'dmg' }, { label: '☕ MP', value: '15', cls: 'mp' }, { label: '⭐', value: 'ULT', cls: 'ult' }],
      typeLabel: 'ULTIMATE', category: 'ultimate',
      price: 450, dmgMult: 4.5, mpCost: 15 },

    { id: 'board_meeting', name: 'Vorstandssitzung',   icon: '🏛️',
      desc: '⚠️ Ultimate. Ruft alle Chefs auf einmal. Maximaler Schaden.',
      stats: [{ label: '💥 DMG', value: '×5.0', cls: 'dmg' }, { label: '☕ MP', value: '18', cls: 'mp' }, { label: '⭐', value: 'ULT', cls: 'ult' }],
      typeLabel: 'ULTIMATE', category: 'ultimate',
      price: 600, dmgMult: 5.0, mpCost: 18 },
];

/* ============================================================
   TAGES-ANGEBOT GENERATOR
   ============================================================ */
function getDailyDeal() {
    // Pseudo-Random basierend auf Tagesdatum
    var today = new Date();
    var seed = today.getFullYear() * 10000 + (today.getMonth()+1) * 100 + today.getDate();
    var idx = seed % BV_SHOP_ITEMS.length;
    var item = BV_SHOP_ITEMS[idx];
    var discountPercent = [20, 25, 30, 35][seed % 4];
    return {
        item: item,
        discount: discountPercent,
        dealPrice: Math.max(5, Math.floor(item.basePrice * (1 - discountPercent / 100)))
    };
}

/* ============================================================
   HÄNDLER-DIALOGE
   ============================================================ */
var KEEPER_DIALOGS = {
    shop: {
        welcome:  ['"Was darf es sein?"', '"Alles für den Büroalltag!"', '"Heute ein Schnäppchen?"', '"Schau dich ruhig um!"'],
        buy:      function(name) { return '"' + name + ' – exzellente Wahl!"'; },
        cantBuy:  ['"Leider nicht genug Gold..."', '"Das liegt außerhalb deines Budgets."', '"Spar noch etwas mehr!"'],
        sell:     function(name) { return '"Danke für " + name + "!"'; },
        bye:      ['"Tschüss! Komm bald wieder!"', '"Alles Gute!"', '"Auf Wiedersehen!"']
    },
    skillshop: {
        welcome:  ['"Welche Fähigkeit willst du lernen?"', '"Wissen ist Macht!"', '"Heute neue Skills im Angebot!"', '"Bilde dich weiter!"'],
        buy:      function(name) { return '"' + name + ' erlernt! Viel Erfolg!"'; },
        cantBuy:  ['"Du brauchst mehr Gold für diesen Skill."', '"Diese Fähigkeit ist noch zu teuer."', '"Arbeite hart, dann kannst du dir das leisten!"'],
        bye:      ['"Bis zum nächsten Training!"', '"Üben, üben, üben!"', '"Du wirst ein echter Profi!"']
    }
};

function getRandomDialog(arr) {
    return Array.isArray(arr) ? arr[Math.floor(Math.random() * arr.length)] : arr;
}

/* ============================================================
   SKILL-UNLOCK BUGFIX HELPERS
   ============================================================ */
function normalizeSkillUnlocks(player) {
    if (!player) return [];
    if (!Array.isArray(player.unlockedSkills)) player.unlockedSkills = [];

    var alias = {
        // alte fehlerhafte ID aus vorherigem Shop-Patch
        overtime: 'ueberstunden'
    };

    var seen = Object.create(null);
    player.unlockedSkills = player.unlockedSkills
        .map(function(id) { return alias[id] || id; })
        .filter(function(id) {
            if (!id || seen[id]) return false;
            seen[id] = true;
            return true;
        });

    return player.unlockedSkills;
}

function getUnlockedShopSkillCount(player) {
    var unlocked = normalizeSkillUnlocks(player);
    var shopSkillIds = BV_SKILL_ITEMS.map(function(skill) { return skill.id; });
    return unlocked.filter(function(id) { return shopSkillIds.indexOf(id) !== -1; }).length;
}

function updateSkillUnlockStats(player) {
    player = player || ((typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : window.player);
    var root = document.querySelector('#bv-skillshop-main .bv-daily-deal-banner');
    if (!root) return;

    var count = getUnlockedShopSkillCount(player);
    var desc = root.querySelector('.bv-daily-deal-desc');
    var badge = root.querySelector('.bv-daily-deal-badge');

    if (desc) desc.textContent = count + ' von ' + BV_SKILL_ITEMS.length + ' Skills freigeschaltet';
    if (badge) badge.textContent = Math.round(count / Math.max(1, BV_SKILL_ITEMS.length) * 100) + '%';
}

function refreshRpgHudAndMenu() {
    if (typeof window.updateHUD === 'function') window.updateHUD();
    if (typeof window.updateMenuStats === 'function') window.updateMenuStats();
}

/* ============================================================
   HILFSFUNKTIONEN
   ============================================================ */
function setKeeperSpeech(containerId, text) {
    var bubble = document.querySelector('#' + containerId + ' .bv-keeper-speech-bubble');
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.remove('bv-speech-anim');
    void bubble.offsetWidth;
    bubble.classList.add('bv-speech-anim');
}

function setGoldDisplay(containerId, amount) {
    // Alle Gold-Displays im Container aktualisieren (shop + skillshop) mit Countdown-Animation
    ['bv-shop-main', 'bv-skillshop-main'].forEach(function(cid) {
        var el = document.querySelector('#' + cid + ' .bv-shop-gold-amount');
        if (!el) return;
        var current = parseInt(el.textContent) || 0;
        var target = parseInt(amount) || 0;
        if (current === target) return;
        // Animate gold change
        var duration = Math.min(400, Math.abs(target - current) * 8);
        var startTime = performance.now();
        el.classList.add('bv-gold-counting');
        function tickGold(now) {
            var t = Math.min((now - startTime) / duration, 1);
            // Ease-out for snappy feel
            var eased = 1 - Math.pow(1 - t, 3);
            var val = Math.round(current + (target - current) * eased);
            el.textContent = val;
            if (t < 1) {
                requestAnimationFrame(tickGold);
            } else {
                el.textContent = target;
                el.classList.remove('bv-gold-counting');
                el.classList.remove('bv-gold-drop');
                void el.offsetWidth;
                el.classList.add('bv-gold-drop');
            }
        }
        requestAnimationFrame(tickGold);
    });
}

function showShopToast(containerId, message, type) {
    // entferne alte
    var old = document.querySelector('#' + containerId + ' .bv-shop-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'bv-shop-toast ' + (type || '');
    t.textContent = message;
    var container = document.getElementById(containerId);
    if (!container) return;
    container.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
}

function getShopFxLayer(cardEl) {
    // SkillShop: FX-Layer gehört in die scrollende Skill-Liste, damit Partikel beim Scrollen mitwandern.
    var skillGrid = cardEl?.closest?.('.bv-skill-items-grid');
    if (skillGrid) {
        skillGrid.classList.add('bv-skill-fx-host-v773');
        var skillLayer = Array.from(skillGrid.children).find(function(el) {
            return el.classList && el.classList.contains('bv-shop-fx-layer-v772');
        });
        if (!skillLayer) {
            skillLayer = document.createElement('div');
            skillLayer.className = 'bv-shop-fx-layer-v772 bv-skill-scroll-fx-layer-v773';
            skillGrid.appendChild(skillLayer);
        }
        // Layer muss so hoch sein wie der Scroll-Content, sonst liegen Partikel bei Scrollpositionen falsch.
        skillLayer.style.height = Math.max(skillGrid.scrollHeight, skillGrid.clientHeight) + 'px';
        skillLayer.style.width = Math.max(skillGrid.scrollWidth, skillGrid.clientWidth) + 'px';
        return skillLayer;
    }

    // Item-Shop: FX bleibt im Shop-Fenster, da die Itemkarten nicht in derselben Weise scrollen müssen.
    var root = cardEl?.closest?.('.bv-shop-container, .bv-skillshop-container') ||
               document.getElementById('bv-shop-main') ||
               document.getElementById('bv-skillshop-main');
    if (!root) return null;
    var layer = root.querySelector(':scope > .bv-shop-fx-layer-v772');
    if (!layer) {
        layer = document.createElement('div');
        layer.className = 'bv-shop-fx-layer-v772';
        root.appendChild(layer);
    }
    return layer;
}

function getCardCenterInFxLayer(cardEl, layer) {
    var isSkillLayer = layer && layer.classList.contains('bv-skill-scroll-fx-layer-v773');
    // Skill-FX sollen genau beim Button/Status "Freigeschaltet/Erlernt" entstehen, nicht mitten in der Karte.
    var anchor = isSkillLayer
        ? (cardEl.querySelector('.bv-unlock-btn') || cardEl.querySelector('.bv-skill-buy-area') || cardEl)
        : (cardEl.querySelector('.bv-buy-btn') || cardEl);

    var anchorRect = anchor.getBoundingClientRect();
    var layerRect = layer.getBoundingClientRect();
    return {
        x: anchorRect.left - layerRect.left + anchorRect.width / 2,
        y: anchorRect.top - layerRect.top + anchorRect.height / 2,
        width: anchorRect.width,
        height: anchorRect.height,
        isSkillLayer: isSkillLayer
    };
}

function appendFxBatched(layer, total, batchSize, createFn) {
    var index = 0;
    function batch() {
        if (!layer || !layer.parentNode) return;
        var frag = document.createDocumentFragment();
        var end = Math.min(total, index + batchSize);
        for (; index < end; index++) {
            frag.appendChild(createFn(index, total));
        }
        layer.appendChild(frag);
        if (index < total) requestAnimationFrame(batch);
    }
    requestAnimationFrame(batch);
}

function removeFxAfter(el, ms) {
    setTimeout(function () { if (el && el.parentNode) el.remove(); }, ms);
}

function spawnPurchaseParticles(cardEl) {
    if (!cardEl) return;
    var layer = getShopFxLayer(cardEl);
    if (!layer) return;

    var isSkill = !!cardEl.closest('.bv-skillshop-container');
    var center = getCardCenterInFxLayer(cardEl, layer);
    var emojis = isSkill
        ? ['✦', '✧', '◆', '◇', '📚', '🔓']
        : ['✨', '⭐', '💰', '✔️', '💎', '🌟'];
    var colors = isSkill
        ? ['#d8b4fe', '#a855f7', '#ffffff', '#44ff88']
        : ['#ffd700', '#44ff88', '#4a9fff', '#ffffff'];
    var count = isSkill ? 18 : 16;

    // Sofort sichtbarer Kern-FX: nur wenige Elemente, damit der Start nicht ruckelt.
    var core = document.createDocumentFragment();
    var orb = document.createElement('span');
    orb.className = 'bv-purchase-orb-v772' + (isSkill ? ' skill' : ' item');
    orb.style.left = center.x + 'px';
    orb.style.top = center.y + 'px';
    core.appendChild(orb);
    removeFxAfter(orb, isSkill ? 980 : 760);

    for (var l = 0; l < 2; l++) {
        var slash = document.createElement('span');
        slash.className = 'bv-purchase-sparkline-v772' + (isSkill ? ' skill' : ' item');
        slash.style.left = center.x + 'px';
        slash.style.top = center.y + 'px';
        slash.style.setProperty('--rot', (l === 0 ? '-18deg' : '22deg'));
        slash.style.animationDelay = (l * 0.05) + 's';
        core.appendChild(slash);
        removeFxAfter(slash, 780);
    }
    layer.appendChild(core);

    // Partikel in kleinen Batches über mehrere Frames erzeugen -> kein Start-Lag.
    appendFxBatched(layer, count, 6, function (i, total) {
        var p = document.createElement('span');
        p.className = 'bv-purchase-particle-v772' + (isSkill ? ' skill' : ' item');
        p.textContent = emojis[Math.floor(Math.random() * emojis.length)];

        var angle = (Math.PI * 2 * i / total) + (Math.random() * 0.5 - 0.25);
        var dist = (isSkill ? 58 : 45) + Math.random() * (isSkill ? 112 : 90);
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist - (isSkill ? 14 : 8);
        var startX = center.x + (Math.random() - 0.5) * Math.min(56, center.width * 0.5);
        var startY = center.y + (Math.random() - 0.5) * Math.min(34, center.height * 0.42);

        p.style.left = startX + 'px';
        p.style.top = startY + 'px';
        p.style.setProperty('--dx', dx.toFixed(1) + 'px');
        p.style.setProperty('--dy', dy.toFixed(1) + 'px');
        p.style.setProperty('--rot', ((Math.random() - 0.5) * 620).toFixed(1) + 'deg');
        p.style.setProperty('--c', colors[Math.floor(Math.random() * colors.length)]);
        p.style.setProperty('--s', (isSkill ? (11 + Math.random() * 11) : (10 + Math.random() * 10)).toFixed(1) + 'px');
        p.style.setProperty('--dur', (isSkill ? (1.15 + Math.random() * 0.42) : (0.82 + Math.random() * 0.32)).toFixed(2) + 's');
        p.style.animationDelay = (Math.random() * 0.08).toFixed(2) + 's';
        removeFxAfter(p, isSkill ? 1850 : 1350);
        return p;
    });
}

function spawnSkillUnlockRunes(cardEl) {
    if (!cardEl) return;
    var layer = getShopFxLayer(cardEl);
    if (!layer) return;
    var center = getCardCenterInFxLayer(cardEl, layer);

    // Nur zwei Ringe sofort, der Rest wird gebatched.
    var rings = document.createDocumentFragment();
    for (var ringIndex = 0; ringIndex < 2; ringIndex++) {
        var ring = document.createElement('span');
        ring.className = 'bv-skill-magic-ring-v772 r' + ringIndex;
        ring.style.left = center.x + 'px';
        ring.style.top = center.y + 'px';
        ring.style.animationDelay = (ringIndex * 0.1) + 's';
        rings.appendChild(ring);
        removeFxAfter(ring, 1350 + ringIndex * 120);
    }
    layer.appendChild(rings);

    var runes = ['✦', '✧', '✶', '◆', '◇', '✹'];
    var count = 20;
    appendFxBatched(layer, count, 5, function (i, total) {
        var r = document.createElement('span');
        r.className = 'bv-skill-rune-particle-v772';
        r.textContent = runes[i % runes.length];
        var angle = (Math.PI * 2 * i / total) + Math.random() * 0.32;
        var dist = 58 + Math.random() * 118;
        r.style.left = center.x + 'px';
        r.style.top = center.y + 'px';
        r.style.setProperty('--rx', (Math.cos(angle) * dist).toFixed(1) + 'px');
        r.style.setProperty('--ry', (Math.sin(angle) * dist - 14).toFixed(1) + 'px');
        r.style.setProperty('--rot', ((Math.random() - 0.5) * 620).toFixed(1) + 'deg');
        r.style.setProperty('--c', ['#d8b4fe', '#a855f7', '#44ff88', '#ffffff'][Math.floor(Math.random() * 4)]);
        r.style.animationDelay = (Math.random() * 0.12).toFixed(2) + 's';
        removeFxAfter(r, 2200);
        return r;
    });
}

function spawnFloatStat(cardEl, text, cls) {
    if (!cardEl) return;
    var layer = getShopFxLayer(cardEl);
    if (!layer) return;
    var center = getCardCenterInFxLayer(cardEl, layer);
    var fs = document.createElement('div');
    fs.className = 'bv-float-stat-v772 ' + (cls || '');
    fs.textContent = text;
    fs.style.left = center.x + 'px';
    fs.style.top = (center.y - Math.min(36, center.height * 0.45)) + 'px';
    layer.appendChild(fs);
    setTimeout(function() { if (fs.parentNode) fs.parentNode.remove(); }, 1900);
}

/* ============================================================
   PATCHED: openShop()
   ============================================================ */
var _origOpenShop = window.openShop;
window.openShop = function() {
    // BUGFIX: Wenn die originale Closure-Funktion existiert, sie benutzen.
    // Sie setzt das echte lokale gameState und ruft showScreen korrekt auf.
    if (typeof _origOpenShop === 'function') {
        return _origOpenShop.apply(this, arguments);
    }
    if (typeof window.setBvGameState === 'function') window.setBvGameState('SHOP');
    else if (window.gameState !== undefined) window.gameState = 'SHOP';
    var gameWin = document.getElementById('rpg-game-window');
    if (gameWin) gameWin.classList.remove('effect-particles', 'effect-dim', 'effect-windows');

    // Screen zuerst anzeigen, dann UI bauen
    if (typeof window.showScreen === 'function') window.showScreen('rpg-shop-screen');
    renderNewShopUI();
};

/* ============================================================
   PATCHED: renderShopItems() — wird intern nicht mehr direkt aufgerufen,
   aber trotzdem überschreiben für compat
   ============================================================ */
window.renderShopItems = function() { renderNewShopUI(); };

/* ============================================================
   NEUES SHOP UI BAUEN
   ============================================================ */
function renderNewShopUI() {
    var screen = document.getElementById('rpg-shop-screen');
    if (!screen) return;
    screen.innerHTML = '';

    var player = (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : window.player;
    if (!player) { screen.innerHTML = '<div style="color:#f87171;padding:20px;text-align:center;">Fehler: Spieler nicht gefunden</div>'; return; }
    var playerGold = (player.gold !== undefined) ? player.gold : 0;
    var inventory = player.inventory || [];
    var dailyDeal = getDailyDeal();

    // --- Hintergrund ---
    var bg = document.createElement('div');
    bg.className = 'bv-shop-bg';
    bg.innerHTML = '<div class="bv-shop-bg-gradient"></div>' +
        '<div class="bv-shop-grid"></div>' +
        '<div class="bv-shop-dust"></div>' +
        '<div class="bv-shop-orb o1"></div>' +
        '<div class="bv-shop-orb o2"></div>' +
        '<div class="bv-shop-orb o3"></div>';
    screen.appendChild(bg);

    // --- Container ---
    var container = document.createElement('div');
    container.className = 'bv-shop-container';
    container.id = 'bv-shop-main';
    screen.appendChild(container);

    // --- Top Header ---
    var header = document.createElement('div');
    header.className = 'bv-shop-top-header';
    header.innerHTML =
        '<div class="bv-keeper-avatar-wrap">' +
            '<div class="bv-keeper-avatar">🛒</div>' +
            '<div class="bv-keeper-status-dot"></div>' +
        '</div>' +
        '<div class="bv-keeper-dialog-wrap">' +
            '<div class="bv-keeper-name">Händler Hans</div>' +
            '<div class="bv-keeper-speech-bubble">' + getRandomDialog(KEEPER_DIALOGS.shop.welcome) + '</div>' +
        '</div>' +
        '<div class="bv-shop-gold-panel">' +
            '<div class="bv-shop-gold-badge">' +
                '<span class="bv-shop-gold-icon">💰</span>' +
                '<span class="bv-shop-gold-amount">' + playerGold + '</span>' +
            '</div>' +
            '<div class="bv-shop-gold-label">GOLD</div>' +
        '</div>';
    container.appendChild(header);

    // --- Tab-Leiste ---
    var healCount = BV_SHOP_ITEMS.filter(function(i) { return i.category === 'heal'; }).length;
    var boostCount = BV_SHOP_ITEMS.filter(function(i) { return i.category === 'boost'; }).length;
    var sellCount = inventory.length;

    var tabs = document.createElement('div');
    tabs.className = 'bv-shop-tabs';
    tabs.innerHTML =
        '<div class="bv-shop-tab bv-tab-active" data-bv-tab="all"><span class="bv-shop-tab-icon">🏪</span>Alle<span class="bv-shop-tab-count">' + BV_SHOP_ITEMS.length + '</span></div>' +
        '<div class="bv-shop-tab" data-bv-tab="heal"><span class="bv-shop-tab-icon">❤️</span>Heilung<span class="bv-shop-tab-count">' + healCount + '</span></div>' +
        '<div class="bv-shop-tab" data-bv-tab="boost"><span class="bv-shop-tab-icon">⚡</span>Boosts<span class="bv-shop-tab-count">' + boostCount + '</span></div>' +
        '<div class="bv-shop-tab" data-bv-tab="sell"><span class="bv-shop-tab-icon">💸</span>Verkaufen<span class="bv-shop-tab-count">' + sellCount + '</span></div>';
    container.appendChild(tabs);

    // --- Body ---
    var body = document.createElement('div');
    body.className = 'bv-shop-body';
    container.appendChild(body);

    // --- Tages-Deal Banner (nur bei "all" Tab) ---
    var dealBanner = document.createElement('div');
    dealBanner.className = 'bv-daily-deal-banner';
    dealBanner.id = 'bv-deal-banner';
    dealBanner.innerHTML =
        '<div class="bv-daily-deal-icon">🔥</div>' +
        '<div class="bv-daily-deal-text">' +
            '<div class="bv-daily-deal-title">TAGES-ANGEBOT</div>' +
            '<div class="bv-daily-deal-desc">' + dailyDeal.item.name + ' — heute ' + dailyDeal.discount + '% günstiger!</div>' +
        '</div>' +
        '<div class="bv-daily-deal-badge">-' + dailyDeal.discount + '%</div>';
    body.appendChild(dealBanner);

    // --- Item-Grid ---
    var grid = document.createElement('div');
    grid.className = 'bv-shop-items-grid';
    grid.id = 'bv-shop-item-grid';
    body.appendChild(grid);

    // --- Footer ---
    var footer = document.createElement('div');
    footer.className = 'bv-shop-footer';
    footer.innerHTML =
        '<button class="bv-shop-close-btn" id="bv-shop-close-btn">🚪 Verlassen</button>' +
        '<div class="bv-shop-hint">Klick auf ein Item<br>um es zu kaufen</div>';
    container.appendChild(footer);

    // --- Render Items (initial: alle) ---
    renderShopGrid(grid, 'all', dailyDeal, player);

    // --- Tab Events (with crossfade) ---
    tabs.querySelectorAll('.bv-shop-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            tabs.querySelectorAll('.bv-shop-tab').forEach(function(t) { t.classList.remove('bv-tab-active'); });
            tab.classList.add('bv-tab-active');
            var category = tab.getAttribute('data-bv-tab');
            // Deal-Banner nur bei "all"
            dealBanner.style.display = (category === 'all') ? '' : 'none';
            // Crossfade: fade out, swap content, fade in
            grid.classList.add('bv-grid-fading');
            grid.classList.remove('bv-grid-ready');
            setTimeout(function() {
                if (category === 'sell') {
                    renderSellGrid(grid, player);
                } else {
                    renderShopGrid(grid, category, dailyDeal, player);
                }
                // Force reflow before adding ready class
                void grid.offsetWidth;
                grid.classList.remove('bv-grid-fading');
                grid.classList.add('bv-grid-ready');
            }, 160);
        });
    });

    // --- Close Button ---
    document.getElementById('bv-shop-close-btn').addEventListener('click', function() {
        if (typeof window.closeShop === 'function') window.closeShop();
    });

    // parseEmojis wird nicht aufgerufen - twemoji interferiert mit Card-Layout
}

/* ============================================================
   SHOP GRID RENDERN (Kauf-Items)
   ============================================================ */
function renderShopGrid(grid, category, dailyDeal, player) {
    grid.innerHTML = '';
    // BUGFIX: Der Verkaufen-Tab setzt gridTemplateColumns auf 1fr; normale Shop-Tabs müssen wieder ins 2-Spalten-Grid zurück.
    if (grid && grid.style) grid.style.removeProperty('grid-template-columns');
    var playerGold = (player && player.gold) ? player.gold : 0;

    var items = BV_SHOP_ITEMS.filter(function(item) {
        return category === 'all' || item.category === category;
    });

    // Tages-Deal-Item zuerst (nur bei "all")
    if (category === 'all') {
        items = items.filter(function(i) { return i.id !== dailyDeal.item.id; });
        items.unshift(Object.assign({}, dailyDeal.item, {
            price: dailyDeal.dealPrice,
            isDeal: true,
            rarity: 'deal',
            tag: 'deal',
            tagLabel: '-' + dailyDeal.discount + '%'
        }));
    }

    items.forEach(function(item) {
        var canAfford = playerGold >= item.price;
        var card = document.createElement('div');
        card.className = 'bv-shop-item-card' +
            (canAfford ? '' : ' bv-card-cant-afford');

        var rarityClass = item.rarity || 'common';
        var tagHtml = item.tag ?
            '<span class="bv-item-tag ' + item.tag + '">' + (item.tagLabel || item.tag.toUpperCase()) + '</span>' : '';

        var statsHtml = (item.stats || []).map(function(s) {
            return '<span class="bv-stat-badge ' + (s.cls || '') + '">' + s.label + ' <strong>' + s.value + '</strong></span>';
        }).join('');

        var priceHtml = item.isDeal ?
            '<span class="bv-item-price"><span class="bv-price-old">' + item.basePrice + 'G</span> <span class="bv-price-deal">' + item.price + 'G</span></span>' :
            '<span class="bv-item-price">💰 ' + item.price + 'G</span>';

        card.innerHTML =
            '<div class="bv-item-rarity-bar ' + rarityClass + '"></div>' +
            '<div class="bv-item-icon-wrap">' +
                '<span class="bv-item-icon">' + item.icon + '</span>' +
                tagHtml +
            '</div>' +
            '<div class="bv-item-name">' + item.name + '</div>' +
            '<div class="bv-item-desc">' + item.desc + '</div>' +
            '<div class="bv-item-stats">' + statsHtml + '</div>' +
            '<div class="bv-item-buy-row">' +
                priceHtml +
                '<button class="bv-buy-btn">Kaufen →</button>' +
            '</div>';

        if (canAfford) {
            card.addEventListener('click', function(e) {
                handleBuyItem(item, card, player);
            });
        } else {
            card.querySelector('.bv-buy-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                card.classList.remove('bv-cant-afford-shake');
                void card.offsetWidth;
                card.classList.add('bv-cant-afford-shake');
                setKeeperSpeech('bv-shop-main', getRandomDialog(KEEPER_DIALOGS.shop.cantBuy));
                showShopToast('bv-shop-main', '❌ Nicht genug Gold!', 'error');
                setTimeout(function() { card.classList.remove('bv-cant-afford-shake'); }, 450);
            });
        }

        grid.appendChild(card);
    });

    if (false && typeof window.parseEmojis === 'function') window.parseEmojis(grid);
}

/* ============================================================
   VERKAUFEN-GRID RENDERN
   ============================================================ */
function renderSellGrid(grid, player) {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = '1fr';
    var inventory = (player && player.inventory) ? player.inventory : [];

    if (inventory.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'bv-sell-empty';
        empty.innerHTML = '<div class="bv-sell-empty-icon">📭</div><div>Dein Inventar ist leer.<br>Kaufe erst Items!</div>';
        grid.appendChild(empty);
        return;
    }

    inventory.forEach(function(invItem, idx) {
        var sellPrice = Math.max(1, Math.floor((invItem.price || 20) * 0.45));
        var card = document.createElement('div');
        card.className = 'bv-sell-item-card';
        card.innerHTML =
            '<span class="bv-sell-item-icon">' + (invItem.name.split(' ')[0] || '📦') + '</span>' +
            '<div class="bv-sell-item-info">' +
                '<span class="bv-sell-item-name">' + invItem.name + '</span>' +
                '<span class="bv-sell-item-count">Anzahl: ' + (invItem.count || 1) + '</span>' +
            '</div>' +
            '<span class="bv-sell-price">💰 +' + sellPrice + 'G</span>';

        card.addEventListener('click', function() {
            handleSellItem(invItem, idx, sellPrice, player, card, grid);
        });

        grid.appendChild(card);
    });

    if (false && typeof window.parseEmojis === 'function') window.parseEmojis(grid);
}

/* ============================================================
   KAUF-LOGIK + MENGEN-AUSWAHL
   ============================================================ */
function getBuyStatText(item, qty) {
    qty = Math.max(1, qty || 1);
    var parts = [];
    if (item.heal) parts.push(qty + 'x Item');
    if (item.atkBoost) parts.push('+' + (item.atkBoost * qty) + ' ATK');
    if (item.defBoost) parts.push('+' + (item.defBoost * qty) + ' DEF');
    if (item.hpBoost) parts.push('+' + (item.hpBoost * qty) + ' MAX-HP');
    if (item.mpBoost) parts.push('+' + (item.mpBoost * qty) + ' MAX-MP');
    return parts.join(' • ');
}

function openBuyQuantityModal(item, cardEl, player) {
    var maxQty = Math.max(1, Math.min(99, Math.floor((player.gold || 0) / Math.max(1, item.price || 1))));
    var qty = 1;

    var overlay = document.createElement('div');
    overlay.className = 'bv-qty-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
        '<div class="bv-qty-modal">' +
            '<div class="bv-qty-glass-shine"></div>' +
            '<div class="bv-qty-header">' +
                '<div class="bv-qty-item-icon">' + item.icon + '</div>' +
                '<div class="bv-qty-title-wrap">' +
                    '<div class="bv-qty-kicker">EINKAUF</div>' +
                    '<h3>Wie viele willst du kaufen?</h3>' +
                    '<p>' + item.name + '</p>' +
                '</div>' +
                '<button class="bv-qty-x" aria-label="Schließen">✕</button>' +
            '</div>' +
            '<div class="bv-qty-body">' +
                '<div class="bv-qty-preview-card">' +
                    '<span class="bv-qty-preview-icon">' + item.icon + '</span>' +
                    '<div>' +
                        '<strong>' + item.name + '</strong>' +
                        '<small>' + (item.desc || 'BüroVersum Item') + '</small>' +
                    '</div>' +
                '</div>' +
                '<div class="bv-qty-controls">' +
                    '<button class="bv-qty-step" data-step="-1">−</button>' +
                    '<div class="bv-qty-number-wrap">' +
                        '<span class="bv-qty-number">1</span>' +
                        '<small>Max. ' + maxQty + '</small>' +
                    '</div>' +
                    '<button class="bv-qty-step" data-step="1">+</button>' +
                '</div>' +
                '<input class="bv-qty-range" type="range" min="1" max="' + maxQty + '" value="1">' +
                '<div class="bv-qty-quick">' +
                    '<button data-q="1">1x</button>' +
                    '<button data-q="5">5x</button>' +
                    '<button data-q="10">10x</button>' +
                    '<button data-q="max">MAX</button>' +
                '</div>' +
                '<div class="bv-qty-total-card">' +
                    '<span>Gesamtpreis</span>' +
                    '<strong class="bv-qty-total">💰 ' + item.price + 'G</strong>' +
                '</div>' +
                '<div class="bv-qty-effect" aria-live="polite">' + getBuyStatText(item, 1) + '</div>' +
            '</div>' +
            '<div class="bv-qty-actions">' +
                '<button class="bv-qty-cancel">Abbrechen</button>' +
                '<button class="bv-qty-confirm">✨ Kaufen</button>' +
            '</div>' +
        '</div>';

    document.body.appendChild(overlay);

    var modal = overlay.querySelector('.bv-qty-modal');
    var numberEl = overlay.querySelector('.bv-qty-number');
    var totalEl = overlay.querySelector('.bv-qty-total');
    var effectEl = overlay.querySelector('.bv-qty-effect');
    var rangeEl = overlay.querySelector('.bv-qty-range');
    var confirmBtn = overlay.querySelector('.bv-qty-confirm');

    function setQty(nextQty) {
        qty = Math.max(1, Math.min(maxQty, parseInt(nextQty, 10) || 1));
        numberEl.textContent = qty;
        rangeEl.value = qty;
        totalEl.textContent = '💰 ' + (item.price * qty) + 'G';
        effectEl.textContent = getBuyStatText(item, qty) || (qty + 'x kaufen');
        modal.classList.remove('bv-qty-bump');
        void modal.offsetWidth;
        modal.classList.add('bv-qty-bump');
    }

    function closeModal() {
        document.removeEventListener('keydown', escHandler);
        overlay.classList.add('bv-qty-closing');
        setTimeout(function () {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 240);
    }

    overlay.querySelectorAll('.bv-qty-step').forEach(function(btn) {
        btn.addEventListener('click', function() {
            setQty(qty + parseInt(btn.getAttribute('data-step'), 10));
        });
    });

    overlay.querySelectorAll('.bv-qty-quick button').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var q = btn.getAttribute('data-q');
            setQty(q === 'max' ? maxQty : q);
        });
    });

    rangeEl.addEventListener('input', function() { setQty(rangeEl.value); });
    overlay.querySelector('.bv-qty-x').addEventListener('click', closeModal);
    overlay.querySelector('.bv-qty-cancel').addEventListener('click', closeModal);

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) closeModal();
    });

    function escHandler(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    }
    document.addEventListener('keydown', escHandler);

    confirmBtn.addEventListener('click', function() {
        confirmBtn.disabled = true;
        confirmBtn.classList.add('bv-qty-confirmed');
        modal.classList.add('bv-qty-purchase');
        setTimeout(function() {
            closeModal();
            setTimeout(function() {
                commitBuyItemQuantity(item, cardEl, player, qty);
            }, 280);
        }, 260);
    });

    setTimeout(function() { confirmBtn.focus(); }, 80);
}

function commitBuyItemQuantity(item, cardEl, player, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    var totalPrice = item.price * qty;

    if ((player.gold || 0) < totalPrice) {
        cardEl.classList.remove('bv-cant-afford-shake');
        void cardEl.offsetWidth;
        cardEl.classList.add('bv-cant-afford-shake');
        setKeeperSpeech('bv-shop-main', getRandomDialog(KEEPER_DIALOGS.shop.cantBuy));
        showShopToast('bv-shop-main', '❌ Nicht genug Gold!', 'error');
        return;
    }

    player.gold -= totalPrice;
    setGoldDisplay('bv-shop-main', player.gold);
    setKeeperSpeech('bv-shop-main', '"' + qty + 'x ' + item.name + ' – sehr gute Wahl!"');

    // Partikel-Burst
    cardEl.classList.remove('bv-purchase-burst');
    requestAnimationFrame(function(){ cardEl.classList.add('bv-purchase-burst'); });
    spawnPurchaseParticles(cardEl);
    setTimeout(function() { cardEl.classList.remove('bv-purchase-burst'); }, 900);

    // Floating Stat
    var statText = getBuyStatText(item, qty);
    if (statText) spawnFloatStat(cardEl, statText, '');

    showShopToast('bv-shop-main', '✅ ' + qty + 'x ' + item.name + ' gekauft!', 'success');

    // Item-Effekte
    if (item.heal) {
        var existing = player.inventory ? player.inventory.find(function(i) { return i.id === item.id; }) : null;
        if (!player.inventory) player.inventory = [];
        if (existing) existing.count = (existing.count || 0) + qty;
        else player.inventory.push({
            id: item.id,
            name: item.icon + ' ' + item.name,
            heal: item.heal,
            mpHeal: item.mpHeal || 0,
            count: qty,
            price: item.basePrice || item.price
        });
    }
    if (item.atkBoost) { player.atk = (player.atk || 0) + item.atkBoost * qty; }
    if (item.defBoost) { player.def = (player.def || 0) + item.defBoost * qty; }
    if (item.hpBoost)  {
        player.maxHp = (player.maxHp || 100) + item.hpBoost * qty;
        player.hp = Math.min((player.hp || 100) + item.hpBoost * qty, player.maxHp);
    }
    if (item.mpBoost)  {
        player.maxMp = (player.maxMp || 10) + item.mpBoost * qty;
        player.mp = Math.min((player.mp || 10) + item.mpBoost * qty, player.maxMp);
    }

    refreshRpgHudAndMenu();

    // Debounced Refresh: Bei mehreren Käufen in Folge nicht mitten in aktive Partikel rendern.
    var grid = document.getElementById('bv-shop-item-grid');
    if (grid) {
        clearTimeout(grid._bvShopRenderTimer);
        grid._bvShopRenderTimer = setTimeout(function() {
            var activeTab = document.querySelector('#bv-shop-main .bv-tab-active');
            if (grid && activeTab) {
                var cat = activeTab.getAttribute('data-bv-tab');
                var dd = getDailyDeal();
                if (cat !== 'sell') {
                    renderShopGrid(grid, cat, dd, player);
                    // Nach Kauf kein erneutes Start-Pop-In der Itemkarten.
                    grid.querySelectorAll('.bv-shop-item-card').forEach(function(card) {
                        card.classList.add('bv-no-entry-card');
                    });
                }
            }
        }, 1850);
    }
}

function handleBuyItem(item, cardEl, _playerIgnored) {
    var player = (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : window.player;
    if (!player) return;
    if (player.gold < item.price) {
        cardEl.classList.remove('bv-cant-afford-shake');
        void cardEl.offsetWidth;
        cardEl.classList.add('bv-cant-afford-shake');
        setKeeperSpeech('bv-shop-main', getRandomDialog(KEEPER_DIALOGS.shop.cantBuy));
        showShopToast('bv-shop-main', '❌ Nicht genug Gold!', 'error');
        return;
    }

    openBuyQuantityModal(item, cardEl, player);
}

/* ============================================================
   VERKAUF-LOGIK
   ============================================================ */
function handleSellItem(invItem, idx, sellPrice, _playerIgnored, cardEl, grid) {
    var player = (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : window.player;
    if (!player || !player.inventory) return;

    player.gold = (player.gold || 0) + sellPrice;
    setGoldDisplay('bv-shop-main', player.gold);
    setKeeperSpeech('bv-shop-main', '"Danke für ' + invItem.name + '!"');
    showShopToast('bv-shop-main', '💰 +' + sellPrice + 'G erhalten!', 'gold');
    spawnFloatStat(cardEl, '+' + sellPrice + 'G', 'stat-gold');

    // Item entfernen oder Anzahl reduzieren
    if (invItem.count > 1) {
        invItem.count--;
    } else {
        player.inventory.splice(player.inventory.indexOf(invItem), 1);
    }

    refreshRpgHudAndMenu();

    // Karte wegfaden
    cardEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    cardEl.style.opacity = '0';
    cardEl.style.transform = 'translateX(20px)';
    setTimeout(function() {
        renderSellGrid(grid, player);
        // Tab-Count updaten
        var sellTab = document.querySelector('#bv-shop-main .bv-shop-tab[data-bv-tab="sell"] .bv-shop-tab-count');
        if (sellTab) sellTab.textContent = player.inventory.length;
    }, 320);
}

/* ============================================================
   PATCHED: openSkillShop()
   ============================================================ */
var _origOpenSkillShop = window.openSkillShop;
window.openSkillShop = function() {
    // BUGFIX: Originale Closure-Funktion bevorzugen, damit echtes gameState/showScreen korrekt laufen.
    if (typeof _origOpenSkillShop === 'function') {
        return _origOpenSkillShop.apply(this, arguments);
    }
    if (typeof window.setBvGameState === 'function') window.setBvGameState('SKILLSHOP');
    else if (window.gameState !== undefined) window.gameState = 'SKILLSHOP';
    var gameWin = document.getElementById('rpg-game-window');
    if (gameWin) gameWin.classList.remove('effect-particles', 'effect-dim', 'effect-windows');

    // Screen zuerst anzeigen, dann UI bauen
    if (typeof window.showScreen === 'function') window.showScreen('rpg-skillshop-screen');
    renderNewSkillShopUI();
};

window.renderSkillShopItems = function() { renderNewSkillShopUI(); };

/* ============================================================
   NEUES SKILLSHOP UI BAUEN
   ============================================================ */
function renderNewSkillShopUI() {
    var screen = document.getElementById('rpg-skillshop-screen');
    if (!screen) return;
    screen.innerHTML = '';

    var player = (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : window.player;
    if (!player) { screen.innerHTML = '<div style="color:#f87171;padding:20px;text-align:center;">Fehler: Spieler nicht gefunden</div>'; return; }
    var playerGold = (player.gold !== undefined) ? player.gold : 0;
    if (!player.unlockedSkills) player.unlockedSkills = [];
    normalizeSkillUnlocks(player);

    // --- Hintergrund ---
    var bg = document.createElement('div');
    bg.className = 'bv-shop-bg bv-skillshop-bg';
    bg.innerHTML = '<div class="bv-shop-bg-gradient"></div>' +
        '<div class="bv-shop-grid"></div>' +
        '<div class="bv-shop-dust"></div>' +
        '<div class="bv-shop-orb o1"></div>' +
        '<div class="bv-shop-orb o2"></div>' +
        '<div class="bv-shop-orb o3"></div>';
    screen.appendChild(bg);

    // --- Container ---
    var container = document.createElement('div');
    container.className = 'bv-shop-container bv-skillshop-container';
    container.id = 'bv-skillshop-main';
    screen.appendChild(container);

    // --- Top Header ---
    var header = document.createElement('div');
    header.className = 'bv-shop-top-header';
    header.innerHTML =
        '<div class="bv-keeper-avatar-wrap">' +
            '<div class="bv-keeper-avatar">📚</div>' +
            '<div class="bv-keeper-status-dot"></div>' +
        '</div>' +
        '<div class="bv-keeper-dialog-wrap">' +
            '<div class="bv-keeper-name">Meister Markus</div>' +
            '<div class="bv-keeper-speech-bubble">' + getRandomDialog(KEEPER_DIALOGS.skillshop.welcome) + '</div>' +
        '</div>' +
        '<div class="bv-shop-gold-panel">' +
            '<div class="bv-shop-gold-badge">' +
                '<span class="bv-shop-gold-icon">💰</span>' +
                '<span class="bv-shop-gold-amount">' + playerGold + '</span>' +
            '</div>' +
            '<div class="bv-shop-gold-label">GOLD</div>' +
        '</div>';
    container.appendChild(header);

    // --- Tab-Leiste (Skills nach Kategorie) ---
    var cats = [
        { key: 'all',     icon: '📖', label: 'Alle' },
        { key: 'attack',  icon: '⚔️', label: 'Angriff' },
        { key: 'special', icon: '🔮', label: 'Spezial' },
        { key: 'support', icon: '💚', label: 'Support' },
        { key: 'ultimate',icon: '⭐', label: 'Ultimate' },
    ];
    var tabs = document.createElement('div');
    tabs.className = 'bv-shop-tabs';
    cats.forEach(function(c, i) {
        var count = c.key === 'all' ? BV_SKILL_ITEMS.length :
            BV_SKILL_ITEMS.filter(function(s) { return s.category === c.key; }).length;
        var tab = document.createElement('div');
        tab.className = 'bv-shop-tab' + (i === 0 ? ' bv-tab-active' : '');
        tab.setAttribute('data-bv-skill-tab', c.key);
        tab.innerHTML = '<span class="bv-shop-tab-icon">' + c.icon + '</span>' + c.label +
            '<span class="bv-shop-tab-count">' + count + '</span>';
        tabs.appendChild(tab);
    });
    container.appendChild(tabs);

    // --- Body ---
    var body = document.createElement('div');
    body.className = 'bv-shop-body';
    container.appendChild(body);

    // Unlocked Stats Bar
    var unlockedCount = getUnlockedShopSkillCount(player);
    var statsBar = document.createElement('div');
    statsBar.className = 'bv-daily-deal-banner';
    statsBar.style.cssText = 'background:linear-gradient(90deg,rgba(168,85,247,0.14),transparent);border-bottom-color:rgba(168,85,247,0.2);';
    statsBar.innerHTML =
        '<div class="bv-daily-deal-icon">🧠</div>' +
        '<div class="bv-daily-deal-text">' +
            '<div class="bv-daily-deal-title" style="color:#d8b4fe">ERLERNTE SKILLS</div>' +
            '<div class="bv-daily-deal-desc" style="color:rgba(220,180,255,0.8)">' + unlockedCount + ' von ' + BV_SKILL_ITEMS.length + ' Skills freigeschaltet</div>' +
        '</div>' +
        '<div class="bv-daily-deal-badge" style="background:linear-gradient(135deg,#7c3aed,#a855f7)">' +
            Math.round(unlockedCount / BV_SKILL_ITEMS.length * 100) + '%' +
        '</div>';
    body.appendChild(statsBar);

    // --- Skill-Grid ---
    var skillGrid = document.createElement('div');
    skillGrid.className = 'bv-skill-items-grid';
    skillGrid.id = 'bv-skillshop-grid';
    body.appendChild(skillGrid);

    // --- Footer ---
    var footer = document.createElement('div');
    footer.className = 'bv-shop-footer';
    footer.innerHTML =
        '<button class="bv-shop-close-btn" id="bv-skillshop-close-btn" style="border-color:rgba(168,85,247,0.25);">🚪 Verlassen</button>' +
        '<div class="bv-shop-hint">Skills freischalten<br>für Kampf-Vorteile</div>';
    container.appendChild(footer);

    // Initial rendern
    renderSkillGrid(skillGrid, 'all', player);

    // Tab Events (with crossfade)
    tabs.querySelectorAll('.bv-shop-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            tabs.querySelectorAll('.bv-shop-tab').forEach(function(t) { t.classList.remove('bv-tab-active'); });
            tab.classList.add('bv-tab-active');
            // Crossfade: fade out, swap content, fade in
            skillGrid.classList.add('bv-grid-fading');
            skillGrid.classList.remove('bv-grid-ready');
            setTimeout(function() {
                renderSkillGrid(skillGrid, tab.getAttribute('data-bv-skill-tab'), player);
                void skillGrid.offsetWidth;
                skillGrid.classList.remove('bv-grid-fading');
                skillGrid.classList.add('bv-grid-ready');
            }, 160);
        });
    });

    // Close
    document.getElementById('bv-skillshop-close-btn').addEventListener('click', function() {
        if (typeof window.closeSkillShop === 'function') window.closeSkillShop();
    });

    if (false && typeof window.parseEmojis === 'function') window.parseEmojis(screen);
}

/* ============================================================
   SKILL-UPGRADE SYSTEM
   ============================================================ */
var BV_SKILL_MAX_LEVEL = 5;

function ensureSkillLevels(player) {
    if (!player) return {};
    if (!player.skillLevels || typeof player.skillLevels !== 'object') player.skillLevels = {};
    normalizeSkillUnlocks(player);
    (player.unlockedSkills || []).forEach(function(id) {
        if (!player.skillLevels[id]) player.skillLevels[id] = 1;
    });
    return player.skillLevels;
}

function getSkillLevel(player, skillId) {
    var levels = ensureSkillLevels(player);
    return Math.max(1, Math.min(BV_SKILL_MAX_LEVEL, parseInt(levels[skillId] || 1, 10)));
}

function getSkillUpgradeCost(skill, level) {
    var base = Math.max(50, Math.floor((skill.price || 100) * 0.55));
    return Math.floor(base * Math.pow(1.55, Math.max(0, level - 1)));
}

function getSkillUpgradeText(skill, level) {
    var next = Math.min(BV_SKILL_MAX_LEVEL, level + 1);
    if (level >= BV_SKILL_MAX_LEVEL) return 'Maximale Stufe erreicht';
    var dmg = skill.dmgMult ? ('DMG +' + Math.round(16 * level) + '%') : '';
    var heal = skill.healPercent ? ('Heal +' + (5 * level) + '%') : '';
    var buff = skill.category === 'support' || skill.id === 'ueberstunden' ? 'Buff stärker' : '';
    var parts = [dmg, heal, buff].filter(Boolean);
    return 'Upgrade auf Lv' + next + (parts.length ? ' • ' + parts.join(' • ') : '');
}

function markSkillCardUpgraded(cardEl) {
    if (!cardEl) return;
    cardEl.classList.remove('bv-skill-upgrade-burst');
    void cardEl.offsetWidth;
    cardEl.classList.add('bv-skill-upgrade-burst');
    spawnPurchaseParticles(cardEl);
    spawnSkillUnlockRunes(cardEl);
    // Add flash overlay for upgrade too
    var flashEl = document.createElement('div');
    flashEl.className = 'bv-skill-flash-overlay';
    cardEl.appendChild(flashEl);
    setTimeout(function() { if (flashEl.parentNode) flashEl.remove(); }, 600);
    setTimeout(function() { cardEl.classList.remove('bv-skill-upgrade-burst'); }, 1450);
}

/* ============================================================
   SKILL-GRID RENDERN
   ============================================================ */
function renderSkillGrid(grid, category, player) {
    grid.innerHTML = '';
    var playerGold = (player && player.gold) ? player.gold : 0;
    normalizeSkillUnlocks(player);
    ensureSkillLevels(player);
    var unlocked = (player && player.unlockedSkills) ? player.unlockedSkills : [];

    var skills = BV_SKILL_ITEMS.filter(function(s) {
        return category === 'all' || s.category === category;
    });

    skills.forEach(function(skill) {
        var isOwned = unlocked.includes(skill.id);
        var skillLevel = isOwned ? getSkillLevel(player, skill.id) : 0;
        var isMaxLevel = skillLevel >= BV_SKILL_MAX_LEVEL;
        var upgradeCost = isOwned && !isMaxLevel ? getSkillUpgradeCost(skill, skillLevel) : 0;
        var canAfford = playerGold >= (isOwned ? upgradeCost : skill.price);

        var card = document.createElement('div');
        card.className = 'bv-skill-card' +
            (isOwned ? ' bv-skill-owned' : (canAfford ? '' : ' bv-skill-cant-afford')) +
            (isOwned && !isMaxLevel ? ' bv-skill-upgradable' : '') +
            (isMaxLevel ? ' bv-skill-maxed' : '') +
            (isOwned && !canAfford && !isMaxLevel ? ' bv-skill-cant-afford' : '');

        var statsHtml = (skill.stats || []).map(function(s) {
            return '<span class="bv-skill-stat ' + (s.cls || '') + '">' + s.label + ' <strong>' + s.value + '</strong></span>';
        }).join('');
        if (isOwned) {
            statsHtml = '<span class="bv-skill-stat level">⭐ Lv <strong>' + skillLevel + '/' + BV_SKILL_MAX_LEVEL + '</strong></span>' + statsHtml;
            if (!isMaxLevel) statsHtml += '<span class="bv-skill-stat upgrade">⬆️ <strong>' + getSkillUpgradeText(skill, skillLevel) + '</strong></span>';
        }

        var typeBadge = '<span class="bv-item-tag ' + (skill.category || 'attack') + '" style="font-size:0.6rem;padding:3px 8px;">' + (skill.typeLabel || 'SKILL') + '</span>';

        var btnHtml = isOwned ?
            (isMaxLevel ? '<button class="bv-unlock-btn">🏆 MAX</button>' : '<button class="bv-unlock-btn upgrade">⬆️ Upgrade</button>') :
            '<button class="bv-unlock-btn">🔓 Freischalten</button>';

        var priceHtml = isOwned ?
            (isMaxLevel ? '<span class="bv-skill-price" style="color:#44ff88;">✓ Lv MAX</span>' : '<span class="bv-skill-price">💰 ' + upgradeCost + 'G</span>') :
            '<span class="bv-skill-price">💰 ' + skill.price + 'G</span>';

        card.innerHTML =
            '<div class="bv-skill-icon-wrap"><span>' + skill.icon + '</span></div>' +
            '<div class="bv-skill-info">' +
                '<div class="bv-skill-name">' + skill.name + ' ' + typeBadge + '</div>' +
                '<div class="bv-skill-desc">' + skill.desc + '</div>' +
                '<div class="bv-skill-stat-row">' + statsHtml + '</div>' +
            '</div>' +
            '<div class="bv-skill-buy-area">' +
                priceHtml +
                btnHtml +
            '</div>';

        if (!isOwned) {
            card.addEventListener('click', function() {
                handleBuySkill(skill, card, player, grid, category);
            });
        } else if (!isMaxLevel) {
            card.addEventListener('click', function() {
                handleUpgradeSkill(skill, card, player, grid, category);
            });
        }

        grid.appendChild(card);
    });

    if (false && typeof window.parseEmojis === 'function') window.parseEmojis(grid);
}

/* ============================================================
   SKILL-KAUF LOGIK
   ============================================================ */
function handleBuySkill(skill, cardEl, _playerIgnored, grid, category) {
    var player = (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : window.player;
    if (!player) return;
    if (!player.unlockedSkills) player.unlockedSkills = [];
    normalizeSkillUnlocks(player);

    if (player.unlockedSkills.includes(skill.id)) {
        setKeeperSpeech('bv-skillshop-main', '"Du kennst diesen Skill bereits!"');
        return;
    }

    if (player.gold < skill.price) {
        cardEl.classList.remove('bv-skill-shake');
        void cardEl.offsetWidth;
        cardEl.classList.add('bv-skill-shake');
        setKeeperSpeech('bv-skillshop-main', getRandomDialog(KEEPER_DIALOGS.skillshop.cantBuy));
        showShopToast('bv-skillshop-main', '❌ Nicht genug Gold!', 'error');
        setTimeout(function() { cardEl.classList.remove('bv-skill-shake'); }, 450);
        return;
    }

    player.gold -= skill.price;
    player.unlockedSkills.push(skill.id);
    normalizeSkillUnlocks(player);
    ensureSkillLevels(player);
    player.skillLevels[skill.id] = Math.max(1, player.skillLevels[skill.id] || 1);

    // BUGFIX: Das gekaufte Skill-Card wird sofort sichtbar als "Erlernt" markiert,
    // auch bevor das Grid nachanimiert neu gerendert wird.
    cardEl.classList.remove('bv-skill-cant-afford');
    cardEl.classList.add('bv-skill-owned');
    var priceEl = cardEl.querySelector('.bv-skill-price');
    var btnEl = cardEl.querySelector('.bv-unlock-btn');
    if (priceEl) priceEl.textContent = '✓ Gelernt';
    if (btnEl) btnEl.textContent = '✓ Erlernt';

    setGoldDisplay('bv-skillshop-main', player.gold);
    setKeeperSpeech('bv-skillshop-main', KEEPER_DIALOGS.skillshop.buy(skill.name));
    showShopToast('bv-skillshop-main', '🎉 ' + skill.name + ' erlernt!', 'success');

    // Burst Animation + Screen-Flash
    cardEl.classList.add('bv-skill-unlock-burst');
    spawnPurchaseParticles(cardEl);
    spawnSkillUnlockRunes(cardEl);
    // Add flash overlay
    var flashEl = document.createElement('div');
    flashEl.className = 'bv-skill-flash-overlay';
    cardEl.appendChild(flashEl);
    setTimeout(function() { if (flashEl.parentNode) flashEl.remove(); }, 600);
    setTimeout(function() { cardEl.classList.remove('bv-skill-unlock-burst'); }, 2050);

    refreshRpgHudAndMenu();

    // BUGFIX: Stats-Bar korrekt updaten. Der Badge liegt nicht im selben Parent wie der Titel,
    // darum hatte der alte querySelector einen Null-Fehler geworfen und das UI wurde nicht auf "Erlernt" gerendert.
    updateSkillUnlockStats(player);

    // BUGFIX: Debounced Refresh. Bei mehreren Skillkäufen in derselben Ansicht bleiben alte
    // Partikel im persistenten FX-Layer erhalten und das Grid rendert erst nach der letzten Aktion.
    if (grid) {
        clearTimeout(grid._bvSkillRenderTimer);
        grid._bvSkillRenderTimer = setTimeout(function() {
            renderSkillGrid(grid, category, player);
            grid.querySelectorAll('.bv-skill-card').forEach(function(card) {
                card.classList.add('bv-skill-no-entry-card');
            });
        }, 3000);
    }
}

/* ============================================================
   SKILL-UPGRADE LOGIK
   ============================================================ */
function handleUpgradeSkill(skill, cardEl, _playerIgnored, grid, category) {
    var player = (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : window.player;
    if (!player) return;
    ensureSkillLevels(player);
    normalizeSkillUnlocks(player);

    if (!player.unlockedSkills.includes(skill.id)) {
        handleBuySkill(skill, cardEl, player, grid, category);
        return;
    }

    var level = getSkillLevel(player, skill.id);
    if (level >= BV_SKILL_MAX_LEVEL) {
        setKeeperSpeech('bv-skillshop-main', '"Dieser Skill ist bereits gemeistert!"');
        showShopToast('bv-skillshop-main', '🏆 Skill ist bereits MAX!', 'success');
        return;
    }

    var cost = getSkillUpgradeCost(skill, level);
    if ((player.gold || 0) < cost) {
        cardEl.classList.remove('bv-skill-shake');
        void cardEl.offsetWidth;
        cardEl.classList.add('bv-skill-shake');
        setKeeperSpeech('bv-skillshop-main', '"Für dieses Upgrade brauchst du mehr Gold."');
        showShopToast('bv-skillshop-main', '❌ Nicht genug Gold für Upgrade!', 'error');
        setTimeout(function() { cardEl.classList.remove('bv-skill-shake'); }, 450);
        return;
    }

    player.gold -= cost;
    player.skillLevels[skill.id] = level + 1;
    setGoldDisplay('bv-skillshop-main', player.gold);
    setKeeperSpeech('bv-skillshop-main', '"' + skill.name + ' ist jetzt Lv' + (level + 1) + '!"');
    showShopToast('bv-skillshop-main', '⬆️ ' + skill.name + ' auf Lv' + (level + 1) + ' verbessert!', 'success');
    markSkillCardUpgraded(cardEl);
    refreshRpgHudAndMenu();

    if (grid) {
        clearTimeout(grid._bvSkillRenderTimer);
        grid._bvSkillRenderTimer = setTimeout(function() {
            renderSkillGrid(grid, category, player);
            grid.querySelectorAll('.bv-skill-card').forEach(function(card) {
                card.classList.add('bv-skill-no-entry-card');
            });
        }, 1500);
    }
}

/* ============================================================
   CLOSE SHOP / SKILLSHOP (Kompat-Layer bleibt)
   ============================================================ */
var _origCloseShop = window.closeShop;
window.closeShop = function() {
    // Exit-Animation: Container shrink/fade before closing
    var container = document.getElementById('bv-shop-main');
    if (container && !container.classList.contains('bv-exiting')) {
        container.classList.add('bv-exiting');
        setTimeout(function() {
            container.classList.remove('bv-exiting');
            if (typeof _origCloseShop === 'function') {
                _origCloseShop.apply(this, arguments);
            } else {
                var runtime = (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
                var ce = runtime.currentEnemy || window.currentEnemy;
                if (ce && ce.isEditorTest) {
                    if (typeof window.showScreen === 'function') window.showScreen('rpg-battle-editor-screen');
                } else {
                    if (typeof window.showScreen === 'function') window.showScreen('rpg-game-screen');
                }
                if (typeof window.setBvGameState === 'function') window.setBvGameState('MAP');
                else if (window.gameState !== undefined) window.gameState = 'MAP';
                var gameWin = document.getElementById('rpg-game-window');
                if (gameWin) {
                    gameWin.classList.remove('effect-particles', 'effect-dim', 'effect-windows');
                    var mid = runtime.currentMapId || window.currentMapId;
                    if (mid === 'flur') gameWin.classList.add('effect-particles');
                    else if (mid === 'boss_office') gameWin.classList.add('effect-dim');
                    else if (mid === 'buero' || mid === 'zentrale' || mid === 'kantine') gameWin.classList.add('effect-windows');
                }
            }
        }, 360);
        return;
    }
    if (typeof _origCloseShop === 'function') {
        return _origCloseShop.apply(this, arguments);
    }
    var runtime = (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
    var ce = runtime.currentEnemy || window.currentEnemy;
    if (ce && ce.isEditorTest) {
        if (typeof window.showScreen === 'function') window.showScreen('rpg-battle-editor-screen');
    } else {
        if (typeof window.showScreen === 'function') window.showScreen('rpg-game-screen');
    }
    if (typeof window.setBvGameState === 'function') window.setBvGameState('MAP');
    else if (window.gameState !== undefined) window.gameState = 'MAP';
    var gameWin = document.getElementById('rpg-game-window');
    if (gameWin) {
        gameWin.classList.remove('effect-particles', 'effect-dim', 'effect-windows');
        var mid = runtime.currentMapId || window.currentMapId;
        if (mid === 'flur') gameWin.classList.add('effect-particles');
        else if (mid === 'boss_office') gameWin.classList.add('effect-dim');
        else if (mid === 'buero' || mid === 'zentrale' || mid === 'kantine') gameWin.classList.add('effect-windows');
    }
};

var _origCloseSkillShop = window.closeSkillShop;
window.closeSkillShop = function() {
    // Exit-Animation: Container shrink/fade before closing
    var container = document.getElementById('bv-skillshop-main');
    if (container && !container.classList.contains('bv-exiting')) {
        container.classList.add('bv-exiting');
        setTimeout(function() {
            container.classList.remove('bv-exiting');
            if (typeof _origCloseSkillShop === 'function') {
                _origCloseSkillShop.apply(this, arguments);
            } else {
                var runtime = (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
                var ce = runtime.currentEnemy || window.currentEnemy;
                if (ce && ce.isEditorTest) {
                    if (typeof window.showScreen === 'function') window.showScreen('rpg-battle-editor-screen');
                } else {
                    if (typeof window.showScreen === 'function') window.showScreen('rpg-game-screen');
                }
                if (typeof window.setBvGameState === 'function') window.setBvGameState('MAP');
                else if (window.gameState !== undefined) window.gameState = 'MAP';
                var gameWin = document.getElementById('rpg-game-window');
                if (gameWin) {
                    gameWin.classList.remove('effect-particles', 'effect-dim', 'effect-windows');
                    var mid = runtime.currentMapId || window.currentMapId;
                    if (mid === 'flur') gameWin.classList.add('effect-particles');
                    else if (mid === 'boss_office') gameWin.classList.add('effect-dim');
                    else if (mid === 'buero' || mid === 'zentrale' || mid === 'kantine') gameWin.classList.add('effect-windows');
                }
            }
        }, 360);
        return;
    }
    if (typeof _origCloseSkillShop === 'function') {
        return _origCloseSkillShop.apply(this, arguments);
    }
    var runtime = (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
    var ce = runtime.currentEnemy || window.currentEnemy;
    if (ce && ce.isEditorTest) {
        if (typeof window.showScreen === 'function') window.showScreen('rpg-battle-editor-screen');
    } else {
        if (typeof window.showScreen === 'function') window.showScreen('rpg-game-screen');
    }
    if (typeof window.setBvGameState === 'function') window.setBvGameState('MAP');
    else if (window.gameState !== undefined) window.gameState = 'MAP';
    var gameWin = document.getElementById('rpg-game-window');
    if (gameWin) {
        gameWin.classList.remove('effect-particles', 'effect-dim', 'effect-windows');
        var mid = runtime.currentMapId || window.currentMapId;
        if (mid === 'flur') gameWin.classList.add('effect-particles');
        else if (mid === 'boss_office') gameWin.classList.add('effect-dim');
        else if (mid === 'buero' || mid === 'zentrale' || mid === 'kantine') gameWin.classList.add('effect-windows');
    }
};

/* ============================================================
   ITEM DATA SYNC (für Battle Editor und Browser-Shop)
   ============================================================ */
// Exportiere neue Item-Listen global für andere Systemteile
window.BV_SHOP_ITEMS = BV_SHOP_ITEMS;
window.BV_SKILL_ITEMS = BV_SKILL_ITEMS;

// Patch SHOP_ITEMS (alter Ref) mit neuem Inhalt
setTimeout(function() {
    try {
        if (window.SHOP_ITEMS) {
            window.SHOP_ITEMS.splice(0, window.SHOP_ITEMS.length);
            BV_SHOP_ITEMS.forEach(function(i) { window.SHOP_ITEMS.push(i); });
        }
        if (window.SKILL_ITEMS) {
            window.SKILL_ITEMS.splice(0, window.SKILL_ITEMS.length);
            BV_SKILL_ITEMS.forEach(function(i) { window.SKILL_ITEMS.push(i); });
        }
    } catch(e) {}
}, 200);

// Globale Exports damit alte lokale Funktionen drauf zugreifen können
window.renderNewShopUI = renderNewShopUI;
window.renderNewSkillShopUI = renderNewSkillShopUI;
window.getDailyDeal = getDailyDeal;

console.log('🏪 BüroVersum Shop Overhaul Patch v1.0 geladen!');
console.log('   → ' + BV_SHOP_ITEMS.length + ' Items | ' + BV_SKILL_ITEMS.length + ' Skills | Tages-Deal aktiv');

})();
</script>


<style>
/* ============================================================
   ARENA BUGFIX v7.5.1: SkillShop Height + Scroll-Fix
   - Skill-Fenster nutzt jetzt die verfügbare Game-Window-Höhe sauber aus
   - Skill-Liste scrollt im Body, Footer/Header bleiben sichtbar
   ============================================================ */
#rpg-skillshop-screen.active {
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    overflow: hidden !important;
}

#rpg-skillshop-screen .bv-skillshop-container {
    height: min(620px, calc(100% - 28px)) !important;
    max-height: calc(100% - 28px) !important;
    min-height: 0 !important;
}

#rpg-skillshop-screen .bv-shop-top-header,
#rpg-skillshop-screen .bv-shop-tabs,
#rpg-skillshop-screen .bv-shop-footer {
    flex: 0 0 auto !important;
}

#rpg-skillshop-screen .bv-shop-body {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow: hidden !important;
}

#rpg-skillshop-screen .bv-skill-items-grid {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow-y: auto !important;
}

#rpg-skillshop-screen .bv-skill-card.bv-skill-owned {
    opacity: 0.82 !important;
    border-color: rgba(68,255,136,0.38) !important;
    box-shadow: inset 0 0 0 1px rgba(68,255,136,0.12) !important;
}

@media (max-height: 620px) {
    #rpg-skillshop-screen .bv-skillshop-container {
        height: calc(100% - 14px) !important;
        max-height: calc(100% - 14px) !important;
        border-radius: 16px !important;
    }
    #rpg-skillshop-screen .bv-shop-top-header {
        min-height: 54px !important;
        padding: 0 14px !important;
    }
    #rpg-skillshop-screen .bv-shop-tabs {
        padding: 7px 14px 0 !important;
    }
    #rpg-skillshop-screen .bv-daily-deal-banner {
        padding: 7px 14px !important;
    }
    #rpg-skillshop-screen .bv-skill-items-grid {
        padding: 10px 12px !important;
        gap: 8px !important;
    }
    #rpg-skillshop-screen .bv-skill-card {
        padding: 11px 14px !important;
        gap: 10px !important;
    }
    #rpg-skillshop-screen .bv-skill-icon-wrap {
        width: 46px !important;
        height: 46px !important;
    }
    #rpg-skillshop-screen .bv-shop-footer {
        padding: 9px 14px !important;
    }
}
</style>

<style>
/* ============================================================
   ARENA BUGFIX v7.5.2: Skill Item Height + Battle Skill Scroll
   Problem:
   - Viele SkillShop-Skills wurden in der Flex-Liste zusammengedrückt.
   - Battle-Skill-Fenster hatte bei vielen Skills zu wenig Platz.
   Lösung:
   - Skill-Karten dürfen nicht mehr schrumpfen und bekommen eine feste Mindesthöhe.
   - Battle-Untermenüs bekommen Max-Höhe + internes Scrollen.
   ============================================================ */

/* ---------- SkillShop: Karten nicht zusammendrücken ---------- */
#rpg-skillshop-screen .bv-skill-items-grid {
    align-content: flex-start !important;
}

#rpg-skillshop-screen .bv-skill-card {
    flex: 0 0 auto !important;
    min-height: 82px !important;
    box-sizing: border-box !important;
    overflow: visible !important;
}

#rpg-skillshop-screen .bv-skill-icon-wrap,
#rpg-skillshop-screen .bv-skill-buy-area {
    flex: 0 0 auto !important;
}

#rpg-skillshop-screen .bv-skill-info {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    min-height: 48px !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
}

#rpg-skillshop-screen .bv-skill-name {
    display: block !important;
    min-height: 18px !important;
    line-height: 1.25 !important;
    white-space: normal !important;
}

#rpg-skillshop-screen .bv-skill-desc {
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
    line-height: 1.35 !important;
    min-height: 20px !important;
}

#rpg-skillshop-screen .bv-skill-stat-row {
    flex: 0 0 auto !important;
    margin-top: 2px !important;
}

/* Kompakter, aber nicht gequetscht bei niedriger Höhe */
@media (max-height: 620px) {
    #rpg-skillshop-screen .bv-skill-card {
        min-height: 74px !important;
    }

    #rpg-skillshop-screen .bv-skill-desc {
        -webkit-line-clamp: 1 !important;
    }
}

/* ---------- Battle: Skill-/Item-Fenster bekommt Scrollbereich ---------- */
#rpg-battle-screen .battle-submenu {
    width: min(520px, calc(100% - 36px)) !important;
    max-height: min(430px, calc(100% - 190px)) !important;
    padding: 12px !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
}

#rpg-battle-screen .battle-submenu.visible {
    display: flex !important;
    flex-direction: column !important;
}

#rpg-battle-screen .battle-submenu .submenu-header {
    flex: 0 0 auto !important;
    margin-bottom: 8px !important;
}

#battle-skill-list,
#battle-item-list {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    max-height: 310px !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding-right: 5px !important;
    scrollbar-width: thin !important;
    scrollbar-color: rgba(74,159,255,0.55) rgba(0,0,0,0.18) !important;
}

#battle-skill-list::-webkit-scrollbar,
#battle-item-list::-webkit-scrollbar {
    width: 6px !important;
}

#battle-skill-list::-webkit-scrollbar-thumb,
#battle-item-list::-webkit-scrollbar-thumb {
    background: rgba(74,159,255,0.55) !important;
    border-radius: 8px !important;
}

#rpg-battle-screen .skill-row,
#rpg-battle-screen .item-row {
    flex: 0 0 auto !important;
    min-height: 42px !important;
    box-sizing: border-box !important;
    margin-bottom: 6px !important;
    padding: 9px 10px !important;
}

#rpg-battle-screen .skill-icon,
#rpg-battle-screen .item-icon {
    flex: 0 0 26px !important;
    text-align: center !important;
}

#rpg-battle-screen .skill-name,
#rpg-battle-screen .item-name {
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
}

#rpg-battle-screen .skill-cost,
#rpg-battle-screen .item-count {
    flex: 0 0 auto !important;
    white-space: nowrap !important;
}

#rpg-battle-screen .submenu-back {
    flex: 0 0 auto !important;
    margin-top: 8px !important;
}

/* Kleine Displays: Fenster höher nutzbar, aber nicht über Battle-UI legen */
@media (max-height: 620px) {
    #rpg-battle-screen .battle-submenu {
        bottom: 128px !important;
        max-height: min(360px, calc(100% - 155px)) !important;
    }

    #battle-skill-list,
    #battle-item-list {
        max-height: 245px !important;
    }

    #rpg-battle-screen .skill-row,
    #rpg-battle-screen .item-row {
        min-height: 38px !important;
        padding: 7px 9px !important;
    }
}
</style>


<style>
/* ============================================================
   ARENA UPGRADE v7.5.3: Shop Quantity Modal + Glass Window Fix
   ============================================================ */
.bv-shop-container,
.bv-skillshop-container {
    position: relative !important;
    isolation: isolate !important;
    backdrop-filter: blur(18px) saturate(1.18) !important;
    -webkit-backdrop-filter: blur(18px) saturate(1.18) !important;
}

.bv-shop-container > *,
.bv-skillshop-container > * {
    position: relative !important;
    z-index: 2 !important;
}

.bv-shop-container::before,
.bv-skillshop-container::before {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    z-index: 1 !important;
    pointer-events: none !important;
    border-radius: inherit !important;
    background:
        linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 38%, rgba(74,159,255,0.05) 100%),
        radial-gradient(circle at 20% 0%, rgba(255,255,255,0.12), transparent 34%) !important;
    opacity: 0.72 !important;
}

.bv-shop-container::after,
.bv-skillshop-container::after {
    content: '' !important;
    position: absolute !important;
    top: -40% !important;
    left: -80% !important;
    width: 55% !important;
    height: 180% !important;
    z-index: 1 !important;
    pointer-events: none !important;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent) !important;
    transform: rotate(18deg) translateX(-20%) !important;
    animation: bvGlassWindowSweep 8s ease-in-out infinite !important;
}

@keyframes bvGlassWindowSweep {
    0%, 64% { left: -85%; opacity: 0; }
    70% { opacity: 0.8; }
    86% { left: 125%; opacity: 0.2; }
    100% { left: 125%; opacity: 0; }
}

/* ---------- Quantity Modal ---------- */
.bv-qty-overlay {
    position: fixed;
    inset: 0;
    z-index: 100070;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
    animation: bvQtyOverlayIn 0.22s ease both;
    font-family: 'VT323', monospace;
}

.bv-qty-overlay.bv-qty-closing {
    animation: bvQtyOverlayOut 0.22s ease forwards;
    pointer-events: none;
}

.bv-qty-modal {
    position: relative;
    width: min(92vw, 460px);
    overflow: hidden;
    border-radius: 22px;
    border: 1.5px solid rgba(74,159,255,0.45);
    background: linear-gradient(155deg, rgba(20,34,66,0.94), rgba(8,12,28,0.98));
    color: #e8f2ff;
    box-shadow:
        0 28px 80px rgba(0,0,0,0.78),
        0 0 0 1px rgba(255,255,255,0.08) inset,
        0 0 45px rgba(74,159,255,0.2);
    transform-origin: center;
    animation: bvQtyModalIn 0.38s cubic-bezier(0.22, 1.25, 0.36, 1) both;
}

.bv-qty-closing .bv-qty-modal {
    animation: bvQtyModalOut 0.22s ease forwards;
}

.bv-qty-glass-shine {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
        radial-gradient(circle at 15% 0%, rgba(255,255,255,0.16), transparent 34%),
        linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.08) 40%, transparent 58%);
    animation: bvQtyGlassDrift 4s ease-in-out infinite alternate;
}

.bv-qty-header,
.bv-qty-body,
.bv-qty-actions {
    position: relative;
    z-index: 2;
}

.bv-qty-header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 20px;
    border-bottom: 1px solid rgba(74,159,255,0.22);
    background: rgba(74,159,255,0.08);
}

.bv-qty-item-icon {
    width: 58px;
    height: 58px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    font-size: 2.2rem;
    background: rgba(74,159,255,0.16);
    border: 1px solid rgba(74,159,255,0.38);
    box-shadow: 0 0 22px rgba(74,159,255,0.2), inset 0 1px 0 rgba(255,255,255,0.13);
    animation: bvQtyIconFloat 2.2s ease-in-out infinite;
}

.bv-qty-title-wrap { flex: 1; min-width: 0; }
.bv-qty-kicker {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.58rem;
    letter-spacing: 1px;
    color: #8ec5ff;
    margin-bottom: 5px;
}
.bv-qty-title-wrap h3 {
    margin: 0;
    font-size: 1.4rem;
    color: #fff;
    text-shadow: 0 0 16px rgba(74,159,255,0.5);
}
.bv-qty-title-wrap p {
    margin: 2px 0 0;
    color: rgba(210,230,255,0.72);
    font-size: 1rem;
}
.bv-qty-x {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.06);
    color: #fca5a5;
    cursor: pointer;
    transition: transform .18s ease, background .18s ease;
}
.bv-qty-x:hover { transform: rotate(90deg) scale(1.08); background: rgba(239,68,68,0.18); }

.bv-qty-body { padding: 18px 22px 12px; }
.bv-qty-preview-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(0,0,0,0.24);
    border: 1px solid rgba(255,255,255,0.08);
    margin-bottom: 16px;
}
.bv-qty-preview-icon { font-size: 2rem; }
.bv-qty-preview-card strong { display:block; font-size: 1.12rem; color:#fff; }
.bv-qty-preview-card small { display:block; color:rgba(210,230,255,0.62); line-height:1.25; }

.bv-qty-controls {
    display: grid;
    grid-template-columns: 58px 1fr 58px;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
}
.bv-qty-step {
    height: 52px;
    border-radius: 16px;
    border: 1.5px solid rgba(74,159,255,0.45);
    background: linear-gradient(135deg, rgba(74,159,255,0.2), rgba(74,159,255,0.08));
    color: #d8ecff;
    font-size: 2rem;
    cursor: pointer;
    transition: transform .16s ease, box-shadow .16s ease, background .16s ease;
}
.bv-qty-step:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 0 18px rgba(74,159,255,0.25); }
.bv-qty-step:active { transform: translateY(1px) scale(0.96); }
.bv-qty-number-wrap {
    min-height: 66px;
    border-radius: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
}
.bv-qty-number {
    font-family: 'Press Start 2P', monospace;
    font-size: 1.7rem;
    color: #ffd700;
    text-shadow: 0 0 14px rgba(255,215,0,0.55);
}
.bv-qty-number-wrap small { color: rgba(210,230,255,0.45); margin-top: 5px; }
.bv-qty-range {
    width: 100%;
    accent-color: #4a9fff;
    margin-bottom: 12px;
}
.bv-qty-quick {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 14px;
}
.bv-qty-quick button {
    border: 1px solid rgba(74,159,255,0.25);
    background: rgba(74,159,255,0.08);
    color: #b8d8ff;
    border-radius: 10px;
    padding: 8px;
    cursor: pointer;
    transition: all .16s ease;
}
.bv-qty-quick button:hover { background: rgba(74,159,255,0.18); transform: translateY(-1px); }
.bv-qty-total-card,
.bv-qty-effect {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 13px;
    border-radius: 13px;
    background: rgba(0,0,0,0.25);
    border: 1px solid rgba(255,255,255,0.08);
    margin-bottom: 9px;
}
.bv-qty-total-card span { color: rgba(210,230,255,0.62); }
.bv-qty-total-card strong { color: #ffd700; font-family:'Press Start 2P', monospace; font-size: .82rem; }
.bv-qty-effect { color:#44ff88; justify-content:center; text-align:center; min-height: 20px; }

.bv-qty-actions {
    display: flex;
    gap: 10px;
    padding: 14px 20px 18px;
    border-top: 1px solid rgba(74,159,255,0.14);
}
.bv-qty-actions button {
    flex: 1;
    border-radius: 14px;
    padding: 12px 16px;
    font-family: 'VT323', monospace;
    font-size: 1.2rem;
    cursor: pointer;
    transition: all .18s ease;
}
.bv-qty-cancel {
    border: 1px solid rgba(255,255,255,0.16);
    background: rgba(255,255,255,0.06);
    color: rgba(230,235,245,0.75);
}
.bv-qty-confirm {
    border: 1px solid rgba(68,255,136,0.45);
    background: linear-gradient(135deg, rgba(68,255,136,0.24), rgba(22,163,74,0.2));
    color: #a7f3d0;
    box-shadow: 0 0 18px rgba(68,255,136,0.14);
}
.bv-qty-confirm:hover { transform: translateY(-2px); box-shadow: 0 0 28px rgba(68,255,136,0.28); }
.bv-qty-confirmed { filter: brightness(1.4); transform: scale(1.03); }
.bv-qty-bump .bv-qty-number { animation: bvQtyNumberPop .25s cubic-bezier(.22,1.4,.36,1); }
.bv-qty-purchase { animation: bvQtyPurchase .32s cubic-bezier(.22,1.5,.36,1) both; }

@keyframes bvQtyOverlayIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes bvQtyOverlayOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes bvQtyModalIn { from { opacity:0; transform: translateY(28px) scale(.9); filter: blur(8px); } to { opacity:1; transform: translateY(0) scale(1); filter: blur(0); } }
@keyframes bvQtyModalOut { from { opacity:1; transform: translateY(0) scale(1); } to { opacity:0; transform: translateY(20px) scale(.94); } }
@keyframes bvQtyGlassDrift { from { transform: translateX(-8px); } to { transform: translateX(12px); } }
@keyframes bvQtyIconFloat { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-5px) rotate(3deg); } }
@keyframes bvQtyNumberPop { 0% { transform: scale(.82); } 70% { transform: scale(1.18); } 100% { transform: scale(1); } }
@keyframes bvQtyPurchase { 0% { transform: scale(1); } 45% { transform: scale(1.04); box-shadow:0 0 45px rgba(68,255,136,.32); } 100% { transform: scale(1); } }

/* ============================================================
   ARENA UPGRADE v7.5.3: SkillShop Animation Rework
   ============================================================ */
#rpg-skillshop-screen .bv-skill-card {
    transform-origin: left center !important;
    animation: bvSkillCardProIn .46s cubic-bezier(.22,1.2,.36,1) both !important;
}

#rpg-skillshop-screen .bv-skill-card::after {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    pointer-events: none !important;
    border-radius: inherit !important;
    background:
        radial-gradient(circle at var(--mx, 20%) var(--my, 50%), rgba(168,85,247,0.22), transparent 34%),
        linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent) !important;
    opacity: 0 !important;
    transition: opacity .25s ease !important;
}

#rpg-skillshop-screen .bv-skill-card:hover::after {
    opacity: 1 !important;
    animation: bvSkillCardAura 1.4s ease-in-out infinite alternate !important;
}

#rpg-skillshop-screen .bv-skill-icon-wrap::after {
    content: '' !important;
    position: absolute !important;
    inset: -8px !important;
    border-radius: 18px !important;
    border: 1px solid rgba(216,180,254,0.22) !important;
    opacity: 0 !important;
    transform: rotate(0deg) scale(.8) !important;
    transition: opacity .25s ease, transform .25s ease !important;
}

#rpg-skillshop-screen .bv-skill-card:hover .bv-skill-icon-wrap::after,
#rpg-skillshop-screen .bv-skill-card.bv-skill-unlock-burst .bv-skill-icon-wrap::after {
    opacity: 1 !important;
    transform: rotate(45deg) scale(1) !important;
    animation: bvSkillIconRuneSpin 1.2s linear infinite !important;
}

#rpg-skillshop-screen .bv-skill-card.bv-skill-unlock-burst {
    animation: bvSkillUnlockPro .72s cubic-bezier(.22,1.35,.36,1) both !important;
}


@keyframes bvSkillCardProIn {
    from { opacity: 0; transform: translateX(-22px) scale(.96); filter: blur(4px); }
    to { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
}
@keyframes bvSkillCardAura {
    from { filter: brightness(1); }
    to { filter: brightness(1.1); }
}
@keyframes bvSkillIconRuneSpin {
    from { transform: rotate(0deg) scale(1); }
    to { transform: rotate(360deg) scale(1); }
}
@keyframes bvSkillUnlockPro {
    0% { transform: translateX(0) scale(1); box-shadow: 0 0 0 rgba(168,85,247,0); }
    30% { transform: translateX(10px) scale(1.04); box-shadow: 0 0 38px rgba(168,85,247,.45); }
    62% { transform: translateX(-4px) scale(.995); box-shadow: 0 0 26px rgba(68,255,136,.28); }
    100% { transform: translateX(0) scale(1); box-shadow: none; }
}

/* ============================================================
   SHOP UPGRADES v7.11: Exit-Animation, Tab-Crossfade,
   Gold-Countdown, Skill-Flash, Deal-Spotlight, Card-Hover
   ============================================================ */

/* 1. Exit-Animation (reverse entrance) */
.bv-shop-container.bv-exiting {
    animation: bvShopContainerOut 0.35s cubic-bezier(0.55, 0, 1, 0.45) forwards !important;
}
@keyframes bvShopContainerOut {
    0%   { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); }
    100% { opacity: 0; transform: scale(0.92) translateY(24px); filter: blur(6px); }
}

/* 2. Tab-Crossfade */
.bv-shop-items-grid.bv-grid-fading {
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.15s ease-in, transform 0.15s ease-in;
}
.bv-shop-items-grid.bv-grid-ready {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 0.25s ease-out 0.05s, transform 0.25s ease-out 0.05s;
}

/* 3. Gold-Countdown (pulse on change) */
.bv-shop-gold-amount.bv-gold-counting {
    color: #fbbf24 !important;
    text-shadow: 0 0 12px rgba(251,191,36,0.5);
}

/* 4. Skill-Unlock Screen-Flash */
.bv-skill-flash-overlay {
    position: absolute;
    inset: 0;
    border-radius: 14px;
    background: radial-gradient(circle, rgba(168,85,247,0.6), rgba(74,159,255,0.3), transparent 70%);
    opacity: 0;
    pointer-events: none;
    z-index: 10;
    animation: bvSkillFlashPop 0.5s ease-out forwards;
}
@keyframes bvSkillFlashPop {
    0%   { opacity: 0; transform: scale(0.5); }
    20%  { opacity: 1; transform: scale(1.05); }
    100% { opacity: 0; transform: scale(1.3); }
}

/* 5. Daily Deal Spotlight (scanning light) */
.bv-daily-deal-banner {
    position: relative;
    overflow: hidden;
}
.bv-daily-deal-banner::after {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 60%; height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,200,60,0.12), rgba(255,160,0,0.08), transparent);
    animation: bvDealSpotlight 3.5s ease-in-out infinite;
    pointer-events: none;
}
@keyframes bvDealSpotlight {
    0%   { left: -60%; }
    50%  { left: 100%; }
    100% { left: 100%; }
}

/* 6. Card-Hover Mikro-Interaktionen */
#rpg-shop-screen .bv-shop-item-card:hover .bv-item-icon {
    animation: bvCardIconWobble 0.4s ease-in-out;
}
@keyframes bvCardIconWobble {
    0%   { transform: scale(1.12) rotate(-6deg); }
    25%  { transform: scale(1.15) rotate(-2deg); }
    50%  { transform: scale(1.12) rotate(-8deg); }
    75%  { transform: scale(1.14) rotate(-4deg); }
    100% { transform: scale(1.12) rotate(-6deg); }
}

/* Preis-Badge pulse on hover */
.bv-item-price {
    transition: transform 0.2s, text-shadow 0.2s;
}
.bv-shop-item-card:hover .bv-item-price {
    transform: scale(1.05);
    text-shadow: 0 0 8px rgba(255,215,0,0.4);
}

/* Buy-Button glow-pulse on hover */
.bv-shop-item-card:hover .bv-buy-btn {
    animation: bvBuyBtnGlow 0.8s ease-in-out infinite alternate;
}
@keyframes bvBuyBtnGlow {
    0%   { box-shadow: 0 0 6px rgba(74,159,255,0.2); }
    100% { box-shadow: 0 0 16px rgba(74,159,255,0.45); }
}

/* Skill card hover: icon glow pulse */
#rpg-skillshop-screen .bv-skill-card:hover .bv-skill-icon-wrap {
    animation: bvSkillIconGlow 0.6s ease-in-out infinite alternate;
}
@keyframes bvSkillIconGlow {
    0%   { box-shadow: 0 0 8px rgba(168,85,247,0.2); }
    100% { box-shadow: 0 0 22px rgba(168,85,247,0.5); }
}
</style>


<style>
/* ============================================================
   ARENA BUGFIX v7.5.4: Shop Toast im Fenster + Shop Design Refresh
   ============================================================ */

/* Toast darf durch den allgemeinen Glass-Fix nicht auf position:relative fallen. */
.bv-shop-container > .bv-shop-toast,
.bv-skillshop-container > .bv-shop-toast,
.bv-shop-toast {
    position: absolute !important;
    top: 76px !important;
    left: 50% !important;
    right: auto !important;
    transform: translateX(-50%) translateY(-10px) scale(0.96);
    z-index: 90 !important;
    max-width: calc(100% - 44px) !important;
    min-width: min(360px, calc(100% - 44px)) !important;
    text-align: center !important;
    white-space: normal !important;
    pointer-events: none !important;
    backdrop-filter: blur(12px) saturate(1.25) !important;
    -webkit-backdrop-filter: blur(12px) saturate(1.25) !important;
}

.bv-shop-toast.success {
    background: linear-gradient(135deg, rgba(7, 34, 20, 0.96), rgba(10, 70, 42, 0.92)) !important;
    border-color: rgba(68,255,136,0.72) !important;
    box-shadow:
        0 10px 28px rgba(0,0,0,0.45),
        0 0 24px rgba(68,255,136,0.28),
        inset 0 1px 0 rgba(255,255,255,0.1) !important;
}

.bv-shop-toast.error {
    background: linear-gradient(135deg, rgba(45, 8, 8, 0.96), rgba(92, 18, 18, 0.92)) !important;
}

.bv-shop-toast.gold {
    background: linear-gradient(135deg, rgba(48, 36, 7, 0.96), rgba(85, 58, 8, 0.92)) !important;
}

/* Item-Shop visuell interessanter: neon-glass Produktkarten */
#rpg-shop-screen .bv-shop-body {
    background:
        radial-gradient(circle at 12% 12%, rgba(74,159,255,0.12), transparent 30%),
        radial-gradient(circle at 88% 18%, rgba(255,215,0,0.08), transparent 28%),
        rgba(0,0,0,0.16) !important;
}

#rpg-shop-screen .bv-shop-items-grid {
    gap: 14px !important;
    padding: 16px !important;
}

#rpg-shop-screen .bv-shop-item-card {
    min-height: 178px !important;
    border-radius: 20px !important;
    border: 1px solid rgba(74,159,255,0.24) !important;
    background:
        linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025) 28%, rgba(11,20,48,0.86) 100%),
        radial-gradient(circle at 18% 14%, rgba(74,159,255,0.22), transparent 32%) !important;
    box-shadow:
        0 12px 26px rgba(0,0,0,0.32),
        inset 0 1px 0 rgba(255,255,255,0.1),
        inset 0 0 30px rgba(74,159,255,0.045) !important;
    transform-origin: center !important;
}

#rpg-shop-screen .bv-shop-item-card::after {
    content: '' !important;
    position: absolute !important;
    inset: 0 !important;
    pointer-events: none !important;
    border-radius: inherit !important;
    background:
        linear-gradient(90deg, rgba(74,159,255,0.42) 0 4px, transparent 4px),
        radial-gradient(circle at 85% 20%, rgba(255,215,0,0.16), transparent 30%) !important;
    opacity: 0.72 !important;
    transition: opacity .25s ease, filter .25s ease !important;
}

#rpg-shop-screen .bv-shop-item-card:hover {
    transform: translateY(-5px) scale(1.018) !important;
    border-color: rgba(140,205,255,0.62) !important;
    box-shadow:
        0 18px 42px rgba(0,0,0,0.42),
        0 0 28px rgba(74,159,255,0.20),
        inset 0 1px 0 rgba(255,255,255,0.16) !important;
}

#rpg-shop-screen .bv-shop-item-card:hover::after {
    opacity: 1 !important;
    filter: brightness(1.25) !important;
}

#rpg-shop-screen .bv-item-icon-wrap {
    position: relative !important;
    z-index: 2 !important;
}

#rpg-shop-screen .bv-item-icon {
    width: 52px !important;
    height: 52px !important;
    display: inline-grid !important;
    place-items: center !important;
    border-radius: 17px !important;
    background: linear-gradient(135deg, rgba(74,159,255,0.18), rgba(255,255,255,0.06)) !important;
    border: 1px solid rgba(255,255,255,0.14) !important;
    box-shadow: 0 8px 22px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12) !important;
}

#rpg-shop-screen .bv-shop-item-card:hover .bv-item-icon {
    transform: scale(1.12) rotate(-6deg) !important;
    filter: drop-shadow(0 0 14px rgba(74,159,255,0.7)) !important;
}

#rpg-shop-screen .bv-item-name,
#rpg-shop-screen .bv-item-desc,
#rpg-shop-screen .bv-item-stats,
#rpg-shop-screen .bv-item-buy-row {
    position: relative !important;
    z-index: 2 !important;
}

#rpg-shop-screen .bv-buy-btn {
    border-radius: 999px !important;
    padding: 8px 15px !important;
    background: linear-gradient(135deg, rgba(68,255,136,0.18), rgba(74,159,255,0.22)) !important;
    border-color: rgba(68,255,136,0.32) !important;
    color: #d8ffeb !important;
}

#rpg-shop-screen .bv-buy-btn::after {
    content: '✨' !important;
    margin-left: 4px !important;
    opacity: .75 !important;
}

#rpg-shop-screen .bv-daily-deal-banner {
    background:
        linear-gradient(90deg, rgba(255,160,0,0.18), rgba(255,80,0,0.07), rgba(74,159,255,0.04)) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08) !important;
}

/* Hauptmenü Status: Titel mit Icon sauber darstellen */
#tab-status .menu-player-title {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    line-height: 1.25 !important;
    flex-wrap: wrap !important;
}
</style>


<style>
/* ============================================================
   ARENA POLISH v7.5.5: Längere, coolere Item-/Skill-Animationen
   + Status-Titel ohne Inline-Icons
   ============================================================ */

/* Status-Titel: kein Emoji/Icon im Text, Icon bleibt im Portrait */
#tab-status .menu-player-title {
    display: block !important;
    gap: 0 !important;
    letter-spacing: 0.4px !important;
}

/* Toast bleibt länger sichtbar und wirkt wie ein echtes Reward-Popup */
.bv-shop-toast {
    animation: bvShopToastIn 5.2s cubic-bezier(0.22,1,0.36,1) both !important;
    padding: 11px 22px !important;
    font-size: 1rem !important;
}

@keyframes bvShopToastIn {
    0%   { opacity: 0; transform: translateX(-50%) translateY(-16px) scale(0.9); filter: blur(6px); }
    10%  { opacity: 1; transform: translateX(-50%) translateY(0) scale(1.04); filter: blur(0); }
    17%  { transform: translateX(-50%) translateY(0) scale(1); }
    78%  { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0); }
    100% { opacity: 0; transform: translateX(-50%) translateY(-14px) scale(0.96); filter: blur(3px); }
}

/* Item-Kauf: längerer Holo-Burst statt kurzem Blinken */
.bv-shop-item-card.bv-purchase-burst {
    animation: bvPurchaseBurstLong 1.55s cubic-bezier(0.16, 1.25, 0.36, 1) both !important;
}

.bv-shop-item-card.bv-purchase-burst::before {
    animation: bvPurchaseHoloSweep 1.45s ease both !important;
    opacity: 1 !important;
}

.bv-shop-item-card.bv-purchase-burst::after {
    animation: bvPurchaseCardAura 1.55s ease both !important;
}

@keyframes bvPurchaseBurstLong {
    0%   { transform: scale(1); filter: brightness(1); box-shadow: 0 0 0 0 rgba(68,255,136,0); }
    18%  { transform: translateY(-4px) scale(1.055) rotate(-0.6deg); filter: brightness(1.28); box-shadow: 0 0 0 8px rgba(68,255,136,0.18), 0 0 34px rgba(68,255,136,0.38); }
    45%  { transform: translateY(-2px) scale(1.025) rotate(0.4deg); filter: brightness(1.14); box-shadow: 0 0 0 18px rgba(68,255,136,0.08), 0 0 28px rgba(74,159,255,0.28); }
    72%  { transform: translateY(0) scale(1.01); filter: brightness(1.08); box-shadow: 0 0 0 26px rgba(68,255,136,0); }
    100% { transform: scale(1); filter: brightness(1); box-shadow: none; }
}

@keyframes bvPurchaseHoloSweep {
    0%   { left: -90%; opacity: 0; }
    12%  { opacity: .9; }
    72%  { left: 145%; opacity: .35; }
    100% { left: 145%; opacity: 0; }
}

@keyframes bvPurchaseCardAura {
    0%   { opacity: .65; filter: brightness(1); }
    25%  { opacity: 1; filter: brightness(1.35) saturate(1.35); }
    100% { opacity: .72; filter: brightness(1); }
}

/* Partikel bleiben länger sichtbar und haben Trail-Gefühl */




/* Skill-Freischaltung: länger, magischer, deutlicher */
#rpg-skillshop-screen .bv-skill-card.bv-skill-unlock-burst {
    animation: bvSkillUnlockProLong 1.8s cubic-bezier(.16,1.35,.36,1) both !important;
}

#rpg-skillshop-screen .bv-skill-card.bv-skill-unlock-burst .bv-skill-icon-wrap {
    animation: bvSkillIconUnlockPulse 1.8s ease both !important;
}

#rpg-skillshop-screen .bv-skill-card.bv-skill-unlock-burst .bv-unlock-btn {
    animation: bvSkillButtonConfirmGlow 1.65s ease both !important;
}


@keyframes bvSkillUnlockProLong {
    0%   { transform: translateX(0) scale(1); filter: brightness(1); box-shadow: 0 0 0 rgba(168,85,247,0); }
    16%  { transform: translateX(12px) scale(1.045); filter: brightness(1.32); box-shadow: 0 0 42px rgba(168,85,247,.55), inset 0 0 26px rgba(216,180,254,.14); }
    38%  { transform: translateX(-5px) scale(1.018); filter: brightness(1.18); box-shadow: 0 0 34px rgba(68,255,136,.38), inset 0 0 20px rgba(68,255,136,.12); }
    66%  { transform: translateX(3px) scale(1.01); filter: brightness(1.1); box-shadow: 0 0 24px rgba(168,85,247,.28); }
    100% { transform: translateX(0) scale(1); filter: brightness(1); box-shadow: none; }
}

@keyframes bvSkillIconUnlockPulse {
    0%   { transform: scale(1) rotate(0deg); }
    20%  { transform: scale(1.22) rotate(-8deg); filter: drop-shadow(0 0 24px rgba(216,180,254,0.9)); }
    52%  { transform: scale(1.12) rotate(6deg); filter: drop-shadow(0 0 20px rgba(68,255,136,0.75)); }
    100% { transform: scale(1) rotate(0deg); }
}

@keyframes bvSkillButtonConfirmGlow {
    0%   { box-shadow: none; }
    18%  { box-shadow: 0 0 22px rgba(68,255,136,.55); filter: brightness(1.35); }
    72%  { box-shadow: 0 0 16px rgba(68,255,136,.28); }
    100% { box-shadow: none; filter: brightness(1); }
}


/* Karten-Hover etwas ruhiger/hochwertiger */
#rpg-shop-screen .bv-shop-item-card,
#rpg-skillshop-screen .bv-skill-card {
    transition: transform .32s cubic-bezier(.16,1,.36,1), box-shadow .32s ease, border-color .32s ease, filter .32s ease !important;
}
</style>


<style>
/* ============================================================
   ARENA BUGFIX v7.5.6: Particle-Reset, Quit Center, Menu Blocking,
   Changelog/Credits Header Height Polish
   ============================================================ */

/* ---- Ingame Quit Modal sauber zentrieren ---- */
#quit-modal.quit-modal {
    position: absolute !important;
    inset: 0 !important;
    display: none;
    align-items: center !important;
    justify-content: center !important;
    padding: 18px !important;
    box-sizing: border-box !important;
    z-index: 2000 !important;
}

#quit-modal.quit-modal[style*="flex"],
#quit-modal.quit-modal.opening,
#quit-modal.quit-modal.closing {
    display: flex !important;
}

#quit-modal .quit-content {
    position: relative !important;
    top: auto !important;
    left: auto !important;
    margin: auto !important;
    width: min(380px, calc(100% - 28px)) !important;
    max-width: 100% !important;
    transform: none !important;
    transform-origin: center center !important;
    border-radius: 18px !important;
    padding: 24px 24px 22px !important;
    background: linear-gradient(145deg, rgba(15,34,66,0.96), rgba(8,16,34,0.98)) !important;
    box-shadow:
        0 24px 70px rgba(0,0,0,0.72),
        0 0 0 1px rgba(74,159,255,0.18),
        inset 0 1px 0 rgba(255,255,255,0.10) !important;
}

#quit-modal.opening .quit-content {
    animation: bvQuitCenteredIn .34s cubic-bezier(.16,1.25,.36,1) both !important;
}

#quit-modal.closing .quit-content {
    animation: bvQuitCenteredOut .22s ease-in both !important;
}

@keyframes bvQuitCenteredIn {
    from { opacity: 0; transform: translateY(18px) scale(.92); filter: blur(5px); }
    to   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}

@keyframes bvQuitCenteredOut {
    to { opacity: 0; transform: translateY(14px) scale(.94); filter: blur(4px); }
}

/* ---- Menü-Buttons während Schließen/Animation blockieren ---- */
#rpg-menu-screen.menu-closing,
#rpg-menu-screen.menu-animating,
#rpg-menu-screen.menu-switching,
#rpg-menu-screen.menu-opening {
    pointer-events: none !important;
}

#rpg-menu-screen.menu-closing .menu-window,
#rpg-menu-screen.menu-closing .menu-window *,
#rpg-menu-screen.menu-animating .menu-window,
#rpg-menu-screen.menu-animating .menu-window * {
    pointer-events: none !important;
}

#rpg-menu-screen.active:not(.menu-closing):not(.menu-animating):not(.menu-switching):not(.menu-opening) {
    pointer-events: all !important;
}

/* ---- Changelog/Credits: Höhe, Header, Titel-Farbe ohne weiß/blau-Gradient ---- */
#changelog-modal.changelog-modal,
#credits-modal.credits-modal {
    align-items: center !important;
    justify-content: center !important;
    padding: 18px !important;
    box-sizing: border-box !important;
}

#changelog-modal .changelog-content,
#credits-modal .credits-content {
    top: auto !important;
    margin: 0 !important;
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    min-height: 0 !important;
    max-height: calc(100vh - 36px) !important;
    border-radius: 20px !important;
}

#changelog-modal .changelog-content {
    width: min(720px, 94vw) !important;
    height: min(720px, calc(100vh - 36px)) !important;
    max-width: min(720px, 94vw) !important;
}

#credits-modal .credits-content {
    width: min(600px, 94vw) !important;
    height: min(660px, calc(100vh - 36px)) !important;
    max-width: min(600px, 94vw) !important;
}

#changelog-modal .changelog-header,
#credits-modal .credits-header {
    flex: 0 0 auto !important;
    min-height: 62px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 16px !important;
    padding: 16px 24px !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    background: rgba(5, 12, 28, 0.62) !important;
    border-bottom: 1px solid rgba(74,159,255,0.22) !important;
    overflow: visible !important;
}

#credits-modal .credits-header {
    border-bottom-color: rgba(255,215,0,0.24) !important;
}

#changelog-modal .changelog-header h2,
#credits-modal .credits-header h2,
#credits-modal .credits-content h2 {
    display: block !important;
    margin: 0 !important;
    line-height: 1.2 !important;
    white-space: nowrap !important;
    overflow: visible !important;
    background: none !important;
    -webkit-background-clip: initial !important;
    background-clip: initial !important;
    -webkit-text-fill-color: currentColor !important;
    text-shadow: none !important;
    filter: none !important;
}

#changelog-modal .changelog-header h2 {
    color: #4a9fff !important;
}

#credits-modal .credits-header h2,
#credits-modal .credits-content h2 {
    color: #ffd700 !important;
}

#changelog-modal .changelog-body,
#credits-modal .credits-body {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding: 18px 24px 24px !important;
    box-sizing: border-box !important;
}

#changelog-modal .changelog-close,
#credits-modal .credits-close {
    flex: 0 0 auto !important;
    position: relative !important;
    z-index: 4 !important;
}

@media (max-height: 620px) {
    #changelog-modal.changelog-modal,
    #credits-modal.credits-modal {
        padding: 8px !important;
    }
    #changelog-modal .changelog-content,
    #credits-modal .credits-content {
        height: calc(100vh - 16px) !important;
        max-height: calc(100vh - 16px) !important;
    }
    #changelog-modal .changelog-header,
    #credits-modal .credits-header {
        min-height: 50px !important;
        padding: 10px 16px !important;
    }
    #changelog-modal .changelog-header h2,
    #credits-modal .credits-header h2 {
        font-size: 1.25rem !important;
    }
    #changelog-modal .changelog-body,
    #credits-modal .credits-body {
        padding: 12px 16px 16px !important;
    }
}
</style>


<style>
/* ============================================================
   ARENA UPDATE v7.6.2: NPC Gerüchte/Witze/Streit + Text-FX Polish
   ============================================================ */
.rpg-npc .npc-social-bubble {
    bottom: 36px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    min-width: 132px !important;
    max-width: 220px !important;
    padding: 9px 11px 10px !important;
    border-radius: 16px 16px 16px 5px !important;
    background:
        radial-gradient(circle at 16% 0%, rgba(140,205,255,.22), transparent 42%),
        linear-gradient(145deg, rgba(7,18,42,.98), rgba(17,45,88,.98)) !important;
    border: 1px solid rgba(148,216,255,.64) !important;
    box-shadow: 0 12px 30px rgba(0,0,0,.52), 0 0 26px rgba(74,159,255,.28), inset 0 1px 0 rgba(255,255,255,.12) !important;
}
.rpg-npc .npc-social-bubble.npc-bubble-mean {
    background: radial-gradient(circle at 18% 0%, rgba(255,120,120,.24), transparent 42%), linear-gradient(145deg, rgba(48,10,18,.98), rgba(88,22,30,.98)) !important;
    border-color: rgba(255,120,120,.7) !important;
    box-shadow: 0 12px 30px rgba(0,0,0,.54), 0 0 26px rgba(255,80,80,.32) !important;
}
.rpg-npc .npc-social-bubble.npc-bubble-argument {
    background: radial-gradient(circle at 18% 0%, rgba(255,210,90,.24), transparent 42%), linear-gradient(145deg, rgba(48,30,6,.98), rgba(88,48,12,.98)) !important;
    border-color: rgba(255,204,92,.72) !important;
    box-shadow: 0 12px 30px rgba(0,0,0,.54), 0 0 28px rgba(255,184,70,.34) !important;
}
.rpg-npc .npc-social-bubble.bubble-pop {
    animation: npcSocialBubblePopV762 .24s cubic-bezier(.16,1.32,.36,1) both, npcSocialBubbleIdleV762 1.05s ease-in-out .24s infinite alternate !important;
}
.rpg-npc .npc-bubble-mood {
    position:absolute; top:-12px; left:-9px; width:23px; height:23px; border-radius:50%; display:grid; place-items:center;
    background:rgba(8,18,40,.96); border:1px solid rgba(148,216,255,.55); font-size:13px;
    box-shadow:0 4px 12px rgba(0,0,0,.38); animation:npcBubbleMoodPulseV762 .78s ease-in-out infinite alternate;
}
.rpg-npc .npc-bubble-speaker {
    display:block !important; margin-bottom:3px !important; padding-bottom:2px !important; color:#8fd3ff !important;
    font-size:.7rem !important; line-height:1 !important; opacity:.96 !important; white-space:nowrap !important; overflow:hidden !important; text-overflow:ellipsis !important;
    border-bottom:1px solid rgba(140,205,255,.2) !important;
}
.rpg-npc .npc-social-bubble.npc-bubble-mean .npc-bubble-speaker { color:#ffb4b4 !important; border-bottom-color:rgba(255,160,160,.24) !important; }
.rpg-npc .npc-social-bubble.npc-bubble-argument .npc-bubble-speaker { color:#ffd166 !important; border-bottom-color:rgba(255,209,102,.24) !important; }
.rpg-npc .npc-bubble-text { display:block !important; color:#f4fbff !important; font-size:.85rem !important; line-height:1.13 !important; animation:npcBubbleTextInV762 .18s ease-out both !important; }
.rpg-npc .npc-bubble-keyword { color:#ffd166; text-shadow:0 0 8px rgba(255,209,102,.48); animation:npcKeywordGlowV762 .9s ease-in-out infinite alternate; }
.rpg-npc.npc-social-listening::before {
    content:'…' !important; position:absolute !important; left:50% !important; bottom:36px !important; transform:translateX(-50%) !important;
    min-width:28px !important; height:19px !important; line-height:15px !important; text-align:center !important; border-radius:999px !important;
    background:rgba(8,18,40,.88) !important; border:1px solid rgba(140,205,255,.34) !important; color:#c8ecff !important; font-size:1rem !important; z-index:70 !important;
    animation:npcListeningPulseV762 .68s ease-in-out infinite alternate !important;
}
.rpg-npc.npc-social-speaking { animation:npcSpeakerBobV762 .68s ease-in-out infinite alternate !important; }
.rpg-npc.npc-mean-taunting { animation:npcMeanTauntV762 .34s ease-in-out 2 !important; }
.rpg-npc.npc-shoved { animation:npcShovedV762 .42s cubic-bezier(.2,1.4,.3,1) both !important; }
.rpg-npc.npc-social-approaching::after { content:'💭' !important; position:absolute !important; top:-13px !important; right:-10px !important; font-size:13px !important; animation:npcSocialThinkV762 .6s ease-in-out infinite alternate !important; }
@keyframes npcSocialBubblePopV762 { from{opacity:0; transform:translateX(-50%) translateY(8px) scale(.78); filter:blur(3px)} to{opacity:1; transform:translateX(-50%) translateY(0) scale(1); filter:blur(0)} }
@keyframes npcSocialBubbleIdleV762 { from{transform:translateX(-50%) translateY(0) scale(1)} to{transform:translateX(-50%) translateY(-2px) scale(1.012)} }
@keyframes npcBubbleTextInV762 { from{opacity:0; transform:translateY(3px)} to{opacity:1; transform:translateY(0)} }
@keyframes npcBubbleMoodPulseV762 { from{transform:scale(.96); filter:brightness(.95)} to{transform:scale(1.09); filter:brightness(1.2)} }
@keyframes npcKeywordGlowV762 { from{filter:brightness(1)} to{filter:brightness(1.25)} }
@keyframes npcListeningPulseV762 { from{opacity:.48; transform:translateX(-50%) translateY(0) scale(.94)} to{opacity:1; transform:translateX(-50%) translateY(-3px) scale(1.08)} }
@keyframes npcSpeakerBobV762 { from{transform:translateY(0); filter:drop-shadow(0 0 8px rgba(74,159,255,.22)) drop-shadow(2px 2px 2px rgba(0,0,0,.5))} to{transform:translateY(-1px); filter:drop-shadow(0 0 15px rgba(74,159,255,.5)) drop-shadow(2px 2px 2px rgba(0,0,0,.5))} }
@keyframes npcSocialThinkV762 { from{transform:translateY(0) scale(.92); opacity:.62} to{transform:translateY(-4px) scale(1.12); opacity:1} }
@keyframes npcMeanTauntV762 { 0%,100%{transform:translateX(0)} 35%{transform:translateX(-3px) rotate(-3deg)} 70%{transform:translateX(3px) rotate(3deg)} }
@keyframes npcShovedV762 { 0%{filter:brightness(1.7) drop-shadow(0 0 12px rgba(255,120,120,.7))} 100%{filter:drop-shadow(2px 2px 2px rgba(0,0,0,.5))} }
</style>

<style>
/* ============================================================
   ARENA UPDATE v7.6.3: Premium Victory Stars
   - echte 3-Star-Reveal Animation
   - Stern-Ringe, Shine, Burst-Partikel
   - GPU-freundlich, kein Canvas/Loop nötig
   ============================================================ */
#victory-screen.visible .victory-stars.pro-star-victory {
    position: relative !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: clamp(10px, 2vw, 18px) !important;
    min-height: 78px !important;
    margin: 0 0 6px !important;
    font-size: 0 !important;
    letter-spacing: 0 !important;
    filter: none !important;
    isolation: isolate !important;
    perspective: 700px !important;
}

#victory-screen.visible .victory-stars.pro-star-victory::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 260px;
    height: 86px;
    transform: translate(-50%, -50%) scale(.72);
    border-radius: 999px;
    background:
        radial-gradient(ellipse at center, rgba(255,215,0,.34), transparent 62%),
        linear-gradient(90deg, transparent, rgba(255,255,255,.18), transparent);
    opacity: 0;
    z-index: -2;
    filter: blur(1px);
}

#victory-screen.visible .victory-stars.pro-star-victory.stars-playing::before {
    animation: bvVictoryStarAura 2.2s cubic-bezier(.16,1,.3,1) .1s both;
}

#victory-screen.visible .victory-stars.pro-star-victory::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 350px;
    height: 2px;
    transform: translate(-50%, -50%) scaleX(0);
    background: linear-gradient(90deg, transparent, rgba(255,250,190,.9), transparent);
    opacity: 0;
    z-index: -1;
    box-shadow: 0 0 24px rgba(255,215,0,.65);
}

#victory-screen.visible .victory-stars.pro-star-victory.stars-playing::after {
    animation: bvVictoryStarLine 1.15s cubic-bezier(.16,1,.3,1) .36s both;
}

#victory-screen.visible .victory-stars .v-star {
    position: relative;
    display: inline-grid;
    place-items: center;
    width: clamp(58px, 8vw, 86px);
    height: clamp(58px, 8vw, 86px);
    font-size: clamp(2.3rem, 6vw, 4.25rem);
    line-height: 1;
    color: #ffd700;
    text-shadow:
        0 2px 0 #8a4d00,
        0 0 14px rgba(255,215,0,.85),
        0 0 34px rgba(255,170,0,.5);
    transform-style: preserve-3d;
    opacity: 0;
    will-change: transform, opacity, filter;
}

#victory-screen.visible .victory-stars .v-star::before {
    content: '';
    position: absolute;
    inset: 2px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,.22), rgba(255,215,0,.13) 38%, transparent 68%);
    opacity: 0;
    transform: scale(.38);
    z-index: -1;
}

#victory-screen.visible .victory-stars .v-star::after {
    content: '';
    position: absolute;
    left: 8%;
    top: 12%;
    width: 84%;
    height: 28%;
    border-radius: 50%;
    background: linear-gradient(110deg, transparent 0 22%, rgba(255,255,255,.9) 45%, transparent 70% 100%);
    opacity: 0;
    transform: rotate(-18deg) translateX(-24px);
    mix-blend-mode: screen;
    pointer-events: none;
}

#victory-screen.visible .victory-stars.stars-playing .v-star {
    animation:
        bvVictoryStarDrop 1.05s cubic-bezier(.16,1.45,.36,1) both,
        bvVictoryStarIdle 2.4s ease-in-out 1.35s infinite;
}

#victory-screen.visible .victory-stars.stars-playing .v-star::before {
    animation: bvVictoryStarRing 1.35s cubic-bezier(.16,1,.36,1) both;
}

#victory-screen.visible .victory-stars.stars-playing .v-star::after {
    animation: bvVictoryStarShine .95s ease-out both;
}

#victory-screen.visible .victory-stars .v-star:nth-child(1) {
    animation-delay: .05s, 1.35s !important;
    transform-origin: 60% 75%;
}
#victory-screen.visible .victory-stars .v-star:nth-child(2) {
    width: clamp(70px, 9vw, 102px);
    height: clamp(70px, 9vw, 102px);
    font-size: clamp(2.85rem, 7vw, 5.1rem);
    color: #fff3a6;
    text-shadow:
        0 2px 0 #9c5c00,
        0 0 18px rgba(255,240,150,.95),
        0 0 46px rgba(255,196,0,.74);
    animation-delay: .22s, 1.48s !important;
    transform-origin: center bottom;
}
#victory-screen.visible .victory-stars .v-star:nth-child(3) {
    animation-delay: .39s, 1.6s !important;
    transform-origin: 40% 75%;
}

#victory-screen.visible .victory-stars.stars-playing .v-star:nth-child(1)::before { animation-delay: .08s; }
#victory-screen.visible .victory-stars.stars-playing .v-star:nth-child(2)::before { animation-delay: .25s; }
#victory-screen.visible .victory-stars.stars-playing .v-star:nth-child(3)::before { animation-delay: .42s; }
#victory-screen.visible .victory-stars.stars-playing .v-star:nth-child(1)::after { animation-delay: .42s; }
#victory-screen.visible .victory-stars.stars-playing .v-star:nth-child(2)::after { animation-delay: .57s; }
#victory-screen.visible .victory-stars.stars-playing .v-star:nth-child(3)::after { animation-delay: .72s; }

.bv-victory-star-fx {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 4;
}

.bv-victory-star-particle {
    position: absolute;
    left: 50%;
    top: 24%;
    color: var(--c, #ffd700);
    font-size: var(--s, 16px);
    text-shadow: 0 0 10px currentColor, 0 0 22px rgba(255,215,0,.5);
    opacity: 0;
    transform: translate(-50%, -50%) scale(.45) rotate(0deg);
    animation: bvVictoryStarParticle var(--d, 1.45s) cubic-bezier(.16,1,.36,1) forwards;
    animation-delay: var(--delay, 0s);
    will-change: transform, opacity;
}

.bv-victory-star-ring {
    position: absolute;
    left: 50%;
    top: 24%;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    border: 2px solid rgba(255,215,0,.72);
    box-shadow: 0 0 28px rgba(255,215,0,.55), inset 0 0 18px rgba(255,215,0,.18);
    transform: translate(-50%, -50%) scale(.25);
    opacity: 0;
    animation: bvVictoryStarShockwave 1.45s cubic-bezier(.16,1,.36,1) forwards;
}

.bv-victory-star-ring.r2 {
    width: 118px;
    height: 118px;
    border-color: rgba(255,255,255,.48);
    animation-delay: .18s;
}

@keyframes bvVictoryStarAura {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(.45); filter: blur(8px); }
    34% { opacity: .95; transform: translate(-50%, -50%) scale(1.06); filter: blur(0); }
    100% { opacity: .55; transform: translate(-50%, -50%) scale(1); }
}

@keyframes bvVictoryStarLine {
    0% { opacity: 0; transform: translate(-50%, -50%) scaleX(0); }
    35% { opacity: 1; transform: translate(-50%, -50%) scaleX(1.06); }
    100% { opacity: 0; transform: translate(-50%, -50%) scaleX(1.22); }
}

@keyframes bvVictoryStarDrop {
    0% { opacity: 0; transform: translateY(-90px) rotateX(70deg) rotateZ(-18deg) scale(.35); filter: brightness(2.2) blur(5px); }
    45% { opacity: 1; transform: translateY(8px) rotateX(-10deg) rotateZ(7deg) scale(1.22); filter: brightness(1.45) blur(0); }
    68% { transform: translateY(-5px) rotateX(4deg) rotateZ(-3deg) scale(.96); }
    100% { opacity: 1; transform: translateY(0) rotateX(0) rotateZ(0) scale(1); filter: brightness(1); }
}

@keyframes bvVictoryStarRing {
    0% { opacity: 0; transform: scale(.35); }
    24% { opacity: .95; }
    100% { opacity: 0; transform: scale(1.8); }
}

@keyframes bvVictoryStarShine {
    0% { opacity: 0; transform: rotate(-18deg) translateX(-34px); }
    36% { opacity: .92; }
    100% { opacity: 0; transform: rotate(-18deg) translateX(42px); }
}

@keyframes bvVictoryStarIdle {
    0%, 100% { transform: translateY(0) rotateZ(0) scale(1); filter: brightness(1); }
    50% { transform: translateY(-5px) rotateZ(2deg) scale(1.035); filter: brightness(1.12); }
}

@keyframes bvVictoryStarParticle {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(.35) rotate(0deg); }
    13% { opacity: 1; transform: translate(-50%, -50%) translate(calc(var(--x) * .16), calc(var(--y) * .16)) scale(1.15) rotate(45deg); }
    68% { opacity: .95; transform: translate(-50%, -50%) translate(calc(var(--x) * .78), calc(var(--y) * .78)) scale(.9) rotate(calc(var(--r) * .72)); }
    100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--x), var(--y)) scale(.28) rotate(var(--r)); }
}

@keyframes bvVictoryStarShockwave {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(.2); }
    20% { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(4.4); }
}

@media (max-height: 560px) {
    #victory-screen.visible .victory-stars.pro-star-victory {
        min-height: 58px !important;
        gap: 8px !important;
    }
    #victory-screen.visible .victory-stars .v-star {
        width: 48px !important;
        height: 48px !important;
        font-size: 2.25rem !important;
    }
    #victory-screen.visible .victory-stars .v-star:nth-child(2) {
        width: 58px !important;
        height: 58px !important;
        font-size: 2.85rem !important;
    }
}
</style>

<script>
/* ARENA UPDATE v7.6.3: Premium Victory Stars JS */
(function () {
    function buildVictoryStars() {
        var screen = document.getElementById('victory-screen');
        var stars = screen ? screen.querySelector('.victory-stars') : null;
        if (!screen || !stars) return;

        if (stars.dataset.bvProStars !== '1') {
            stars.dataset.bvProStars = '1';
            stars.classList.add('pro-star-victory');
            stars.innerHTML = '<span class="v-star">★</span><span class="v-star">★</span><span class="v-star">★</span>';
        }

        stars.classList.remove('stars-playing');
        void stars.offsetWidth;
        stars.classList.add('stars-playing');

        spawnVictoryStarFX(screen);
    }

    function spawnVictoryStarFX(screen) {
        screen.querySelectorAll('.bv-victory-star-fx').forEach(function (el) { el.remove(); });

        var fx = document.createElement('div');
        fx.className = 'bv-victory-star-fx';
        screen.appendChild(fx);

        var ring1 = document.createElement('span');
        ring1.className = 'bv-victory-star-ring';
        var ring2 = document.createElement('span');
        ring2.className = 'bv-victory-star-ring r2';
        fx.appendChild(ring1);
        fx.appendChild(ring2);

        var chars = ['✦', '✧', '★', '✹', '✶', '✨'];
        var colors = ['#ffd700', '#fff3a6', '#ffb703', '#ffffff', '#ff8c00'];
        var count = 28; // PERF: weniger Star-Burst-Partikel gegen Victory-FPS-Drop
        for (var i = 0; i < count; i++) {
            var p = document.createElement('span');
            p.className = 'bv-victory-star-particle';
            p.textContent = chars[Math.floor(Math.random() * chars.length)];
            var angle = (Math.PI * 2 * i / count) + (Math.random() * 0.55 - 0.275);
            var dist = 70 + Math.random() * 210;
            var x = Math.cos(angle) * dist;
            var y = Math.sin(angle) * dist - (20 + Math.random() * 40);
            p.style.setProperty('--x', x.toFixed(1) + 'px');
            p.style.setProperty('--y', y.toFixed(1) + 'px');
            p.style.setProperty('--r', ((Math.random() - 0.5) * 720).toFixed(1) + 'deg');
            p.style.setProperty('--s', (10 + Math.random() * 19).toFixed(1) + 'px');
            p.style.setProperty('--d', (1.05 + Math.random() * 0.9).toFixed(2) + 's');
            p.style.setProperty('--delay', (Math.random() * 0.28).toFixed(2) + 's');
            p.style.setProperty('--c', colors[Math.floor(Math.random() * colors.length)]);
            fx.appendChild(p);
        }

        setTimeout(function () {
            if (fx.parentNode) fx.parentNode.removeChild(fx);
        }, 2700);
    }

    function initVictoryStarObserver() {
        var screen = document.getElementById('victory-screen');
        if (!screen || screen.dataset.bvVictoryStarObserver === '1') return;
        screen.dataset.bvVictoryStarObserver = '1';

        var obs = new MutationObserver(function () {
            if (screen.classList.contains('visible')) {
                setTimeout(buildVictoryStars, 0);
            } else {
                screen.querySelectorAll('.bv-victory-star-fx').forEach(function (el) { el.remove(); });
            }
        });
        obs.observe(screen, { attributes: true, attributeFilter: ['class'] });

        if (screen.classList.contains('visible')) buildVictoryStars();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVictoryStarObserver, { once: true });
    } else {
        initVictoryStarObserver();
    }
})();
</script>

<style>
/* ============================================================
   ARENA UPDATE v7.6.4: Victory Atmosphere ersetzt victory-css-sparkles
   - alte Emoji-Sparkles aus
   - dunkler Hintergrund mit Fade-In
   - goldene Ember/Smoke-Effekte ähnlich Niederlage, aber Victory-Style
   ============================================================ */
#victory-screen.visible {
    overflow: hidden !important;
}

#victory-screen.visible .victory-bg {
    z-index: 0 !important;
}

#victory-screen.visible .victory-content {
    z-index: 3 !important;
}

#victory-screen.visible .bv-victory-star-fx {
    z-index: 4 !important;
}

.bv-victory-dark-fade {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    background:
        radial-gradient(circle at 50% 34%, rgba(255,200,40,.12) 0%, transparent 28%),
        radial-gradient(circle at 50% 62%, rgba(0,0,0,.18) 0%, transparent 36%),
        linear-gradient(180deg, rgba(0,0,0,.52) 0%, rgba(0,0,0,.36) 42%, rgba(0,0,0,.70) 100%);
    opacity: 0;
    animation: bvVictoryDarkFadeIn 1.15s ease-out forwards;
}

.bv-victory-dark-fade::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
        linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,.16) 50%),
        radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,.58) 100%);
    background-size: 100% 7px, 100% 100%;
    opacity: 0;
    animation: bvVictoryScanFadeIn 1.3s ease-out .25s forwards;
}

@keyframes bvVictoryDarkFadeIn {
    0%   { opacity: 0; filter: brightness(1.35); }
    100% { opacity: 1; filter: brightness(1); }
}

@keyframes bvVictoryScanFadeIn {
    from { opacity: 0; }
    to   { opacity: .62; }
}

/* Alte victory-css-sparkles werden komplett ersetzt */
#victory-screen .victory-css-sparkles {
    position: absolute !important;
    inset: 0 !important;
    pointer-events: none !important;
    overflow: hidden !important;
    z-index: 2 !important;
}

#victory-screen .victory-css-sparkles .v-css-sparkle {
    display: none !important;
    animation: none !important;
}

.bv-victory-ember,
.bv-victory-ash,
.bv-victory-smoke {
    position: absolute;
    pointer-events: none;
    will-change: transform, opacity, filter;
}

.bv-victory-ember {
    left: var(--x, 50%);
    top: 108%;
    width: var(--sz, 7px);
    height: var(--sz, 7px);
    border-radius: var(--round, 50%);
    background: var(--c, #ffd700);
    opacity: 0;
    filter:
        blur(var(--blur, .4px))
        drop-shadow(0 0 8px var(--c, #ffd700))
        drop-shadow(0 0 18px rgba(255,180,0,.45));
    animation: bvVictoryEmberRise var(--dur, 4.2s) linear infinite;
    animation-delay: var(--delay, 0s);
}

.bv-victory-ash {
    left: var(--x, 50%);
    top: 106%;
    color: var(--c, rgba(255,220,120,.75));
    font-size: var(--fs, 13px);
    opacity: 0;
    text-shadow: 0 0 10px rgba(255,215,0,.55);
    animation: bvVictoryAshDrift var(--dur, 5.2s) ease-in-out infinite;
    animation-delay: var(--delay, 0s);
}

.bv-victory-smoke {
    left: var(--x, 50%);
    bottom: -18%;
    width: var(--w, 160px);
    height: var(--h, 90px);
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(255,200,80,.12), rgba(120,80,20,.08) 38%, transparent 72%);
    opacity: 0;
    filter: blur(var(--b, 18px));
    transform: translateX(-50%) scale(.72);
    animation: bvVictorySmokeRise var(--dur, 7s) ease-in-out infinite;
    animation-delay: var(--delay, 0s);
}

@keyframes bvVictoryEmberRise {
    0% {
        opacity: 0;
        transform: translate3d(0, 0, 0) scale(.65) rotate(0deg);
    }
    9% {
        opacity: var(--op, .75);
    }
    54% {
        opacity: calc(var(--op, .75) * .85);
        transform: translate3d(calc(var(--dx, 0px) * .55), -48vh, 0) scale(1) rotate(calc(var(--rot, 180deg) * .55));
    }
    100% {
        opacity: 0;
        transform: translate3d(var(--dx, 0px), -112vh, 0) scale(.28) rotate(var(--rot, 360deg));
    }
}

@keyframes bvVictoryAshDrift {
    0% {
        opacity: 0;
        transform: translate3d(0, 0, 0) scale(.72) rotate(0deg);
    }
    12% {
        opacity: var(--op, .62);
    }
    58% {
        opacity: calc(var(--op, .62) * .8);
        transform: translate3d(calc(var(--dx, 0px) * .65), -46vh, 0) scale(1.05) rotate(calc(var(--rot, 220deg) * .62));
    }
    100% {
        opacity: 0;
        transform: translate3d(var(--dx, 0px), -104vh, 0) scale(.35) rotate(var(--rot, 420deg));
    }
}

@keyframes bvVictorySmokeRise {
    0% {
        opacity: 0;
        transform: translateX(-50%) translateY(0) scale(.65);
    }
    18% {
        opacity: var(--op, .34);
    }
    70% {
        opacity: calc(var(--op, .34) * .65);
    }
    100% {
        opacity: 0;
        transform: translateX(calc(-50% + var(--dx, 0px))) translateY(-70vh) scale(1.55);
    }
}

@media (prefers-reduced-motion: reduce) {
    .bv-victory-ember,
    .bv-victory-ash,
    .bv-victory-smoke {
        animation-duration: 8s !important;
        opacity: .25 !important;
    }
}
</style>

<script>
/* ARENA UPDATE v7.6.4: Victory Atmosphere FX ersetzt victory-css-sparkles */
(function () {
    function rand(min, max) { return min + Math.random() * (max - min); }
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    function clearVictoryAtmosphere(screen) {
        if (!screen) return;
        screen.querySelectorAll('.bv-victory-dark-fade').forEach(function (el) { el.remove(); });
        var wrap = screen.querySelector('.victory-css-sparkles');
        if (wrap) wrap.innerHTML = '';
    }

    function buildVictoryAtmosphere() {
        var screen = document.getElementById('victory-screen');
        if (!screen || !screen.classList.contains('visible')) return;

        // Dunkel-Overlay mit Fade-In
        screen.querySelectorAll('.bv-victory-dark-fade').forEach(function (el) { el.remove(); });
        var dark = document.createElement('div');
        dark.className = 'bv-victory-dark-fade';
        screen.insertBefore(dark, screen.firstChild ? screen.firstChild.nextSibling : null);

        // Alte Sparkles ersetzen
        var wrap = screen.querySelector('.victory-css-sparkles');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'victory-css-sparkles';
            screen.appendChild(wrap);
        }
        wrap.innerHTML = '';
        wrap.classList.add('bv-atmosphere-active');

        var emberColors = ['#ffd700', '#ffb703', '#ff8c00', '#fff0a8', '#facc15'];
        for (var i = 0; i < 22; i++) { // PERF: weniger aufsteigende Embers
            var ember = document.createElement('span');
            ember.className = 'bv-victory-ember';
            ember.style.setProperty('--x', rand(2, 98).toFixed(2) + '%');
            ember.style.setProperty('--dx', rand(-90, 90).toFixed(1) + 'px');
            ember.style.setProperty('--rot', rand(-460, 460).toFixed(1) + 'deg');
            ember.style.setProperty('--sz', rand(3, 10).toFixed(1) + 'px');
            ember.style.setProperty('--dur', rand(3.6, 6.2).toFixed(2) + 's');
            ember.style.setProperty('--delay', rand(0, 2.4).toFixed(2) + 's');
            ember.style.setProperty('--op', rand(0.38, 0.86).toFixed(2));
            ember.style.setProperty('--blur', '0px'); // PERF: blur auf vielen Partikeln ist teuer
            ember.style.setProperty('--round', Math.random() < 0.25 ? '2px' : '50%');
            ember.style.setProperty('--c', pick(emberColors));
            wrap.appendChild(ember);
        }

        var ashChars = ['✦', '✧', '•', '∙', '✶'];
        for (var j = 0; j < 8; j++) { // PERF: weniger Ash-Partikel
            var ash = document.createElement('span');
            ash.className = 'bv-victory-ash';
            ash.textContent = pick(ashChars);
            ash.style.setProperty('--x', rand(4, 96).toFixed(2) + '%');
            ash.style.setProperty('--dx', rand(-120, 120).toFixed(1) + 'px');
            ash.style.setProperty('--rot', rand(-520, 520).toFixed(1) + 'deg');
            ash.style.setProperty('--fs', rand(9, 20).toFixed(1) + 'px');
            ash.style.setProperty('--dur', rand(4.2, 6.8).toFixed(2) + 's');
            ash.style.setProperty('--delay', rand(0, 2.8).toFixed(2) + 's');
            ash.style.setProperty('--op', rand(0.28, 0.72).toFixed(2));
            ash.style.setProperty('--c', Math.random() < 0.35 ? 'rgba(255,255,255,.72)' : 'rgba(255,220,120,.78)');
            wrap.appendChild(ash);
        }

        for (var k = 0; k < 3; k++) { // PERF: weniger Smoke-Layer
            var smoke = document.createElement('span');
            smoke.className = 'bv-victory-smoke';
            smoke.style.setProperty('--x', rand(5, 95).toFixed(2) + '%');
            smoke.style.setProperty('--dx', rand(-90, 90).toFixed(1) + 'px');
            smoke.style.setProperty('--w', rand(100, 260).toFixed(1) + 'px');
            smoke.style.setProperty('--h', rand(56, 130).toFixed(1) + 'px');
            smoke.style.setProperty('--b', rand(8, 14).toFixed(1) + 'px'); // PERF: weniger Blur
            smoke.style.setProperty('--dur', rand(5.6, 9.2).toFixed(2) + 's');
            smoke.style.setProperty('--delay', rand(0, 3.2).toFixed(2) + 's');
            smoke.style.setProperty('--op', rand(0.12, 0.33).toFixed(2));
            wrap.appendChild(smoke);
        }
    }

    function initVictoryAtmosphereObserver() {
        var screen = document.getElementById('victory-screen');
        if (!screen || screen.dataset.bvVictoryAtmosphereObserver === '1') return;
        screen.dataset.bvVictoryAtmosphereObserver = '1';

        var obs = new MutationObserver(function () {
            if (screen.classList.contains('visible')) {
                setTimeout(buildVictoryAtmosphere, 20);
            } else {
                clearVictoryAtmosphere(screen);
            }
        });
        obs.observe(screen, { attributes: true, attributeFilter: ['class'] });

        if (screen.classList.contains('visible')) buildVictoryAtmosphere();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVictoryAtmosphereObserver, { once: true });
    } else {
        initVictoryAtmosphereObserver();
    }
})();
</script>

<style>
/* ============================================================
   ARENA UPDATE v7.6.5: Fade-Out bei Sieg/Niederlage Buttons
   - Weiter / Aufstehen blendet Screen erst weich aus
   - danach wird originale Logik ausgeführt
   ============================================================ */
#victory-screen.bv-result-fade-out,
#defeat-screen.bv-result-fade-out {
    pointer-events: none !important;
    animation: bvResultScreenFadeOut .62s cubic-bezier(.45,0,.55,1) forwards !important;
}

#victory-screen.bv-result-fade-out .victory-content,
#defeat-screen.bv-result-fade-out .defeat-content {
    animation: bvResultContentFadeOut .52s cubic-bezier(.45,0,.55,1) forwards !important;
}

#victory-screen.bv-result-fade-out .victory-bg,
#defeat-screen.bv-result-fade-out .defeat-bg,
#victory-screen.bv-result-fade-out .bv-victory-dark-fade,
#victory-screen.bv-result-fade-out .victory-css-sparkles,
#victory-screen.bv-result-fade-out .bv-victory-star-fx,
#defeat-screen.bv-result-fade-out .defeat-embers-container {
    animation: bvResultFxFadeOut .58s ease forwards !important;
}

#victory-screen.bv-result-fade-out .victory-btn,
#defeat-screen.bv-result-fade-out .defeat-btn {
    pointer-events: none !important;
    filter: brightness(.7) !important;
    transform: scale(.96) !important;
}

@keyframes bvResultScreenFadeOut {
    0%   { opacity: 1; filter: brightness(1) saturate(1); }
    55%  { opacity: .72; filter: brightness(.82) saturate(.9); }
    100% { opacity: 0; filter: brightness(.45) saturate(.65) blur(3px); }
}

@keyframes bvResultContentFadeOut {
    0%   { opacity: 1; transform: translateY(0) scale(1); filter: blur(0) brightness(1); }
    100% { opacity: 0; transform: translateY(18px) scale(.94); filter: blur(4px) brightness(.75); }
}

@keyframes bvResultFxFadeOut {
    0%   { opacity: 1; }
    100% { opacity: 0; }
}
</style>

<script>
/* ARENA UPDATE v7.6.5: Result Screen Fade-Out Wrapper */
(function () {
    function wrapResultFadeOut() {
        if (window.__bvResultFadeOutWrapped) return;
        window.__bvResultFadeOutWrapped = true;

        var originalEndVictory = window.endVictory;
        var originalRespawnPlayer = window.respawnPlayer;
        var FADE_MS = 620;

        function runWithFade(screenId, originalFn, args, ctx) {
            var screen = document.getElementById(screenId);
            if (!screen || !screen.classList.contains('visible')) {
                if (typeof originalFn === 'function') return originalFn.apply(ctx || window, args || []);
                return;
            }

            if (screen.dataset.bvResultFading === '1') return;
            screen.dataset.bvResultFading = '1';
            screen.classList.remove('bv-result-fade-out');
            void screen.offsetWidth;
            screen.classList.add('bv-result-fade-out');

            setTimeout(function () {
                screen.classList.remove('bv-result-fade-out');
                delete screen.dataset.bvResultFading;
                if (typeof originalFn === 'function') originalFn.apply(ctx || window, args || []);
            }, FADE_MS);
        }

        window.endVictory = function () {
            return runWithFade('victory-screen', originalEndVictory, arguments, this);
        };

        window.respawnPlayer = function () {
            return runWithFade('defeat-screen', originalRespawnPlayer, arguments, this);
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapResultFadeOut, { once: true });
    } else {
        wrapResultFadeOut();
    }
})();
</script>

<style>
/* ============================================================
   ARENA UPDATE v7.6.6: Hauptmenü Scrollbar + Bad Toast + Item Click FX
   ============================================================ */

/* --- Designed scrolling für menu-body --- */
#rpg-menu-screen .menu-body {
    position: relative !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    scrollbar-width: thin !important;
    scrollbar-color: rgba(74,159,255,.72) rgba(4,12,26,.42) !important;
    scroll-behavior: smooth !important;
    background:
        radial-gradient(circle at 10% 0%, rgba(74,159,255,.08), transparent 28%),
        radial-gradient(circle at 92% 8%, rgba(168,85,247,.08), transparent 32%),
        linear-gradient(180deg, rgba(255,255,255,.025), rgba(0,0,0,.08)) !important;
    mask-image: linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%) !important;
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 18px), transparent 100%) !important;
}

#rpg-menu-screen.menu-map-mode .menu-body {
    mask-image: none !important;
    -webkit-mask-image: none !important;
}

#rpg-menu-screen .menu-body::-webkit-scrollbar {
    width: 11px !important;
}

#rpg-menu-screen .menu-body::-webkit-scrollbar-track {
    background:
        linear-gradient(180deg, rgba(4,12,26,.82), rgba(10,22,45,.58)) !important;
    border-radius: 999px !important;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.055) !important;
}

#rpg-menu-screen .menu-body::-webkit-scrollbar-thumb {
    border-radius: 999px !important;
    border: 2px solid rgba(4,12,26,.82) !important;
    background:
        linear-gradient(180deg, #8ed0ff, #4a9fff 44%, #a855f7 100%) !important;
    box-shadow:
        0 0 12px rgba(74,159,255,.48),
        inset 0 1px 0 rgba(255,255,255,.42) !important;
}

#rpg-menu-screen .menu-body::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #ffffff, #65b6ff 42%, #c084fc 100%) !important;
    box-shadow: 0 0 18px rgba(120,190,255,.72) !important;
}

/* Dezente Scroll-Hinweise am Fensterrand */
#rpg-menu-screen .menu-window::before,
#rpg-menu-screen .menu-window::after {
    content: '';
    position: absolute;
    left: 18px;
    right: 18px;
    height: 18px;
    pointer-events: none;
    z-index: 8;
    opacity: .72;
}

#rpg-menu-screen .menu-window::before {
    top: 58px;
    background: linear-gradient(180deg, rgba(74,159,255,.14), transparent);
}

#rpg-menu-screen .menu-window::after {
    bottom: 58px;
    background: linear-gradient(0deg, rgba(74,159,255,.14), transparent);
}

#rpg-menu-screen.menu-map-mode .menu-window::before,
#rpg-menu-screen.menu-map-mode .menu-window::after {
    display: none !important;
}

/* --- Menu Toast: allgemein hochwertiger --- */
#rpg-menu-screen .menu-toast {
    position: relative !important;
    overflow: hidden !important;
    min-height: 0 !important;
    padding: 11px 18px !important;
    border-bottom: 1px solid rgba(255,255,255,.1) !important;
    background:
        linear-gradient(135deg, rgba(12,24,48,.78), rgba(5,10,24,.72)) !important;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.07) !important;
    transform-origin: top center !important;
}

#rpg-menu-screen .menu-toast.show {
    display: block !important;
    animation: bvMenuToastInV766 .28s cubic-bezier(.16,1.25,.36,1) both !important;
}

#rpg-menu-screen .menu-toast.good.show {
    color: #93ffc2 !important;
    background:
        radial-gradient(circle at 12% 50%, rgba(68,255,136,.18), transparent 34%),
        linear-gradient(135deg, rgba(7,38,22,.92), rgba(7,20,16,.78)) !important;
    border-bottom-color: rgba(68,255,136,.24) !important;
}

#rpg-menu-screen .menu-toast.bad.show {
    color: #ffd2d2 !important;
    background:
        radial-gradient(circle at 10% 50%, rgba(255,75,75,.28), transparent 34%),
        linear-gradient(135deg, rgba(75,12,16,.96), rgba(25,6,10,.9)) !important;
    border-bottom-color: rgba(255,80,80,.42) !important;
    box-shadow:
        inset 0 1px 0 rgba(255,255,255,.08),
        0 0 22px rgba(255,60,60,.18) !important;
    animation: bvMenuToastBadInV766 .42s cubic-bezier(.16,1.25,.36,1) both, bvMenuToastBadPulseV766 1.2s ease-in-out .42s 2 !important;
}

#rpg-menu-screen .menu-toast.bad::before {
    content: '⚠️';
    display: inline-grid;
    place-items: center;
    width: 24px;
    height: 24px;
    margin-right: 8px;
    border-radius: 50%;
    color: #fff;
    background: rgba(255,70,70,.2);
    border: 1px solid rgba(255,120,120,.34);
    box-shadow: 0 0 12px rgba(255,70,70,.28);
    vertical-align: middle;
}

#rpg-menu-screen .menu-toast.bad::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 90px;
    left: -120px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent);
    transform: skewX(-18deg);
    animation: bvMenuToastBadSweepV766 1.1s ease-out .08s both;
    pointer-events: none;
}

@keyframes bvMenuToastInV766 {
    from { opacity: 0; transform: translateY(-10px) scaleY(.88); filter: blur(3px); }
    to   { opacity: 1; transform: translateY(0) scaleY(1); filter: blur(0); }
}

@keyframes bvMenuToastBadInV766 {
    0%   { opacity: 0; transform: translateY(-12px) scale(.96); filter: blur(4px); }
    58%  { opacity: 1; transform: translateY(0) scale(1.018); filter: blur(0); }
    100% { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes bvMenuToastBadPulseV766 {
    0%,100% { filter: brightness(1); }
    50% { filter: brightness(1.22); }
}

@keyframes bvMenuToastBadSweepV766 {
    to { left: calc(100% + 120px); }
}

/* --- Inventory Item: besseres Anklick-/Hover-Gefühl --- */
#rpg-menu-screen .menu-item {
    transform-origin: center !important;
    transition:
        transform .22s cubic-bezier(.16,1,.36,1),
        border-color .22s ease,
        background .22s ease,
        box-shadow .22s ease,
        filter .22s ease !important;
}

#rpg-menu-screen .menu-item:hover {
    transform: translateY(-3px) scale(1.012) !important;
    border-color: rgba(120,190,255,.62) !important;
    box-shadow:
        0 10px 24px rgba(0,0,0,.28),
        0 0 22px rgba(74,159,255,.16),
        inset 0 1px 0 rgba(255,255,255,.12) !important;
}

#rpg-menu-screen .menu-item.usable:hover {
    border-color: rgba(68,255,136,.58) !important;
    box-shadow:
        0 10px 24px rgba(0,0,0,.28),
        0 0 22px rgba(68,255,136,.18),
        inset 0 1px 0 rgba(255,255,255,.12) !important;
}

#rpg-menu-screen .menu-item.bv-menu-item-press {
    animation: bvMenuItemClickV766 .46s cubic-bezier(.16,1.25,.36,1) both !important;
}

#rpg-menu-screen .menu-item.bv-menu-item-press .menu-item-icon {
    animation: bvMenuItemIconPopV766 .46s cubic-bezier(.16,1.45,.36,1) both !important;
}

.menu-item-ripple-v766 {
    position: absolute;
    width: 28px;
    height: 28px;
    left: var(--x, 50%);
    top: var(--y, 50%);
    transform: translate(-50%, -50%) scale(.2);
    border-radius: 50%;
    pointer-events: none;
    z-index: 5;
    background: radial-gradient(circle, rgba(255,255,255,.38), rgba(74,159,255,.2) 42%, transparent 72%);
    animation: bvMenuItemRippleV766 .62s ease-out forwards;
}

.bv-menu-click-particle-v766 {
    position: absolute;
    z-index: 80;
    pointer-events: none;
    color: var(--c, #8ed0ff);
    font-size: var(--s, 14px);
    text-shadow: 0 0 10px currentColor;
    opacity: 0;
    animation: bvMenuClickParticleV766 .92s cubic-bezier(.16,1,.36,1) forwards;
}

@keyframes bvMenuItemClickV766 {
    0% { transform: translateY(-2px) scale(1.012); filter: brightness(1); }
    35% { transform: translateY(1px) scale(.975); filter: brightness(1.22); }
    72% { transform: translateY(-2px) scale(1.018); }
    100% { transform: translateY(0) scale(1); filter: brightness(1); }
}

@keyframes bvMenuItemIconPopV766 {
    0% { transform: scale(1) rotate(0deg); }
    45% { transform: scale(1.22) rotate(-8deg); filter: drop-shadow(0 0 12px rgba(255,255,255,.55)); }
    100% { transform: scale(1) rotate(0deg); }
}

@keyframes bvMenuItemRippleV766 {
    0% { opacity: .9; transform: translate(-50%, -50%) scale(.2); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(8.5); }
}

@keyframes bvMenuClickParticleV766 {
    0% { opacity: 0; transform: translate(0,0) scale(.5) rotate(0deg); }
    16% { opacity: 1; transform: translate(calc(var(--dx) * .18), calc(var(--dy) * .18)) scale(1.1) rotate(30deg); }
    100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.28) rotate(var(--rot)); }
}
</style>

<script>
/* ARENA UPDATE v7.6.6: Menu Toast/Item Click FX JS */
(function () {
    function rand(min, max) { return min + Math.random() * (max - min); }

    function spawnMenuBadToastFx() {
        var menu = document.querySelector('#rpg-menu-screen .menu-window');
        var toast = document.getElementById('menu-toast');
        if (!menu || !toast) return;
        var rect = toast.getBoundingClientRect();
        var hostRect = menu.getBoundingClientRect();
        var count = 14;
        for (var i = 0; i < count; i++) {
            var p = document.createElement('span');
            p.className = 'bv-menu-click-particle-v766';
            p.textContent = Math.random() < .5 ? '!' : '×';
            p.style.left = (rect.left - hostRect.left + rand(16, Math.max(24, rect.width - 16))) + 'px';
            p.style.top = (rect.top - hostRect.top + rect.height * .55) + 'px';
            p.style.setProperty('--dx', rand(-90, 90).toFixed(1) + 'px');
            p.style.setProperty('--dy', rand(-34, 42).toFixed(1) + 'px');
            p.style.setProperty('--rot', rand(-240, 240).toFixed(1) + 'deg');
            p.style.setProperty('--s', rand(10, 18).toFixed(1) + 'px');
            p.style.setProperty('--c', Math.random() < .5 ? '#ff7777' : '#ffd0d0');
            menu.appendChild(p);
            (function (el) { setTimeout(function () { if (el.parentNode) el.remove(); }, 980); })(p);
        }
    }

    function installToastObserver() {
        var toast = document.getElementById('menu-toast');
        if (!toast || toast.dataset.bvToastFx === '1') return;
        toast.dataset.bvToastFx = '1';
        var lastText = '';
        var obs = new MutationObserver(function () {
            if (false && toast.classList.contains('show') && toast.classList.contains('bad')) {
                var text = toast.textContent || '';
                if (text !== lastText || !toast.dataset.bvBadFxActive) {
                    lastText = text;
                    toast.dataset.bvBadFxActive = '1';
                    spawnMenuBadToastFx();
                    setTimeout(function () { delete toast.dataset.bvBadFxActive; }, 350);
                }
            }
        });
        obs.observe(toast, { attributes: true, childList: true, characterData: true, subtree: true });
    }

    function spawnItemClickFx(item, event) {
        if (!item || item.classList.contains('empty')) return;
        var menu = document.querySelector('#rpg-menu-screen .menu-window');
        if (!menu) return;
        var rect = item.getBoundingClientRect();
        var hostRect = menu.getBoundingClientRect();
        var x = event ? event.clientX - rect.left : rect.width / 2;
        var y = event ? event.clientY - rect.top : rect.height / 2;

        item.classList.remove('bv-menu-item-press');
        void item.offsetWidth;
        item.classList.add('bv-menu-item-press');
        setTimeout(function () { item.classList.remove('bv-menu-item-press'); }, 520);

        var ripple = document.createElement('span');
        ripple.className = 'menu-item-ripple-v766';
        ripple.style.setProperty('--x', x + 'px');
        ripple.style.setProperty('--y', y + 'px');
        item.appendChild(ripple);
        setTimeout(function () { if (ripple.parentNode) ripple.remove(); }, 680);

        var usable = item.classList.contains('usable');
        var boost = item.classList.contains('boost');
        var color = usable ? '#8cffc2' : (boost ? '#ffd54a' : '#8ed0ff');
        var chars = usable ? ['+', '✚', '✨', '❤'] : (boost ? ['⬆', '★', '⚡', '◆'] : ['✦', '•', '◇']);
        for (var i = 0; i < 12; i++) {
            var p = document.createElement('span');
            p.className = 'bv-menu-click-particle-v766';
            p.textContent = chars[Math.floor(Math.random() * chars.length)];
            p.style.left = (rect.left - hostRect.left + x) + 'px';
            p.style.top = (rect.top - hostRect.top + y) + 'px';
            var angle = (Math.PI * 2 * i / 12) + rand(-0.28, 0.28);
            var dist = rand(24, 68);
            p.style.setProperty('--dx', (Math.cos(angle) * dist).toFixed(1) + 'px');
            p.style.setProperty('--dy', (Math.sin(angle) * dist).toFixed(1) + 'px');
            p.style.setProperty('--rot', rand(-320, 320).toFixed(1) + 'deg');
            p.style.setProperty('--s', rand(10, 17).toFixed(1) + 'px');
            p.style.setProperty('--c', color);
            menu.appendChild(p);
            (function (el) { setTimeout(function () { if (el.parentNode) el.remove(); }, 980); })(p);
        }
    }

    function installItemClickFx() {
        var menuScreen = document.getElementById('rpg-menu-screen');
        if (!menuScreen || menuScreen.dataset.bvItemClickFx === '1') return;
        menuScreen.dataset.bvItemClickFx = '1';
        menuScreen.addEventListener('pointerdown', function (e) {
            if (menuScreen.classList.contains('menu-animating') || menuScreen.classList.contains('menu-closing')) return;
            var item = e.target.closest ? e.target.closest('.menu-item') : null;
            if (!item || !menuScreen.contains(item)) return;
            spawnItemClickFx(item, e);
        }, true);
    }

    function init() {
        installToastObserver();
        installItemClickFx();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
</script>


<style>
/* ============================================================
   ARENA HOTFIX v7.6.8: Menu-Title nur beim Öffnen animieren
   + Toast-Animation stabilisiert
   Problem: .menu-title animierte auch nach Kategorie-Switch, weil active/switching
   CSS-Selektoren die Animation neu gestartet haben.
   ============================================================ */

/* Standard: Titel steht stabil, keine dauernde/retriggerte Animation */
#rpg-menu-screen .menu-title,
#rpg-menu-screen.active:not(.menu-opening) .menu-title,
#rpg-menu-screen.menu-switching .menu-title,
#rpg-menu-screen.menu-animating:not(.menu-opening) .menu-title {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    transition: color .22s ease, text-shadow .22s ease !important;
}

/* Linie/Shine im Normalzustand aus, damit beim Tabwechsel nichts flackert */
#rpg-menu-screen .menu-title::before,
#rpg-menu-screen .menu-title::after,
#rpg-menu-screen.active:not(.menu-opening) .menu-title::before,
#rpg-menu-screen.active:not(.menu-opening) .menu-title::after,
#rpg-menu-screen.menu-switching .menu-title::before,
#rpg-menu-screen.menu-switching .menu-title::after {
    animation: none !important;
    opacity: 0 !important;
    transform: scaleX(0) !important;
}

/* Nur beim echten Öffnen des Hauptmenüs */
#rpg-menu-screen.menu-opening .menu-title {
    animation: bvMenuTitleOpenOnlyV768 .56s cubic-bezier(.16,1.18,.36,1) both !important;
}

#rpg-menu-screen.menu-opening .menu-title::before {
    animation: bvMenuTitleUnderlineOpenOnlyV768 .68s cubic-bezier(.16,1,.36,1) both !important;
}

#rpg-menu-screen.menu-opening .menu-title::after {
    animation: bvMenuTitleShineOpenOnlyV768 .72s ease-out .06s both !important;
}

#rpg-menu-screen.menu-closing .menu-title {
    animation: bvMenuTitleCloseOnlyV768 .2s ease-in both !important;
}

@keyframes bvMenuTitleOpenOnlyV768 {
    0%   { opacity: 0; transform: translateX(-18px) translateY(-3px) scale(.96); filter: blur(3px) brightness(.86); }
    62%  { opacity: 1; transform: translateX(3px) translateY(0) scale(1.012); filter: blur(0) brightness(1.08); }
    100% { opacity: 1; transform: translateX(0) translateY(0) scale(1); filter: brightness(1); }
}

@keyframes bvMenuTitleUnderlineOpenOnlyV768 {
    0%   { opacity: 0; transform: scaleX(0); }
    48%  { opacity: .9; transform: scaleX(1.02); }
    100% { opacity: .64; transform: scaleX(1); }
}

@keyframes bvMenuTitleShineOpenOnlyV768 {
    0%   { left: -80px; opacity: 0; transform: skewX(-18deg); }
    22%  { opacity: .75; }
    100% { left: calc(100% + 46px); opacity: 0; transform: skewX(-18deg); }
}

@keyframes bvMenuTitleCloseOnlyV768 {
    to { opacity: 0; transform: translateX(12px) scale(.97); filter: blur(2px) brightness(.8); }
}

/* Toast-Animation entschärft/stabilisiert: keine max-height/padding-Konflikte */
#rpg-menu-screen .menu-toast.show:not(.hiding) {
    display: block !important;
    animation: bvMenuToastStableInV768 .28s cubic-bezier(.16,1.12,.36,1) both !important;
}

#rpg-menu-screen .menu-toast.bad.show:not(.hiding) {
    animation: bvMenuToastBadStableInV768 .34s cubic-bezier(.16,1.15,.36,1) both !important;
}

#rpg-menu-screen .menu-toast.hiding {
    display: block !important;
    pointer-events: none !important;
    animation: bvMenuToastStableOutV768 .38s ease forwards !important;
}

#rpg-menu-screen .menu-toast.bad.hiding::after {
    animation: none !important;
    opacity: 0 !important;
}

@keyframes bvMenuToastStableInV768 {
    from { opacity: 0; transform: translateY(-7px); filter: blur(2px); }
    to   { opacity: 1; transform: translateY(0); filter: blur(0); }
}

@keyframes bvMenuToastBadStableInV768 {
    0%   { opacity: 0; transform: translateY(-8px); filter: blur(2px) brightness(.9); }
    65%  { opacity: 1; transform: translateY(0); filter: blur(0) brightness(1.08); }
    100% { opacity: 1; transform: translateY(0); filter: brightness(1); }
}

@keyframes bvMenuToastStableOutV768 {
    from { opacity: 1; transform: translateY(0); filter: blur(0); }
    to   { opacity: 0; transform: translateY(-7px); filter: blur(2px); }
}
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.6.9: menu-toast Stable Animation
   Problem: Toast war als Flex-Item im Header und verschob/teleportierte Layout.
   Lösung: absoluter Overlay-Toast unter dem Header, sauberer Enter/Exit-State.
   ============================================================ */
#rpg-menu-screen .menu-header {
    position: relative !important;
    overflow: visible !important;
}

#rpg-menu-screen #menu-toast.menu-toast {
    position: absolute !important;
    left: 50% !important;
    top: calc(100% + 8px) !important;
    width: min(520px, calc(100% - 34px)) !important;
    max-width: calc(100% - 34px) !important;
    box-sizing: border-box !important;
    z-index: 80 !important;

    display: block !important;
    visibility: hidden !important;
    pointer-events: none !important;
    overflow: hidden !important;

    padding: 10px 16px !important;
    border-radius: 14px !important;
    border: 1px solid rgba(140,205,255,.22) !important;
    background:
        radial-gradient(circle at 14px 50%, rgba(74,159,255,.18), transparent 42px),
        linear-gradient(135deg, rgba(10,22,46,.96), rgba(5,10,24,.94)) !important;
    box-shadow:
        0 14px 34px rgba(0,0,0,.42),
        0 0 22px rgba(74,159,255,.13),
        inset 0 1px 0 rgba(255,255,255,.10) !important;
    color: #dbeeff !important;
    text-align: center !important;
    font-size: 1.02rem !important;
    line-height: 1.15 !important;
    white-space: normal !important;

    opacity: 0 !important;
    transform: translate(-50%, -10px) scale(.98) !important;
    filter: blur(3px) brightness(.9) !important;
    transition: none !important;
    will-change: transform, opacity, filter !important;
}

#rpg-menu-screen #menu-toast.menu-toast.show {
    visibility: visible !important;
}

#rpg-menu-screen #menu-toast.menu-toast.show.toast-enter:not(.hiding) {
    animation: bvMenuToastStableEnterV769 .34s cubic-bezier(.16,1.14,.36,1) both !important;
}

#rpg-menu-screen #menu-toast.menu-toast.hiding {
    visibility: visible !important;
    animation: bvMenuToastStableExitV769 .42s cubic-bezier(.45,0,.55,1) forwards !important;
}

#rpg-menu-screen #menu-toast.menu-toast.good.show {
    color: #a8ffd0 !important;
    border-color: rgba(68,255,136,.34) !important;
    background:
        radial-gradient(circle at 14px 50%, rgba(68,255,136,.22), transparent 44px),
        linear-gradient(135deg, rgba(7,45,25,.96), rgba(5,18,15,.94)) !important;
    box-shadow:
        0 14px 34px rgba(0,0,0,.42),
        0 0 24px rgba(68,255,136,.16),
        inset 0 1px 0 rgba(255,255,255,.10) !important;
}

#rpg-menu-screen #menu-toast.menu-toast.bad.show {
    color: #ffe9e9 !important;
    border-color: rgba(255,120,120,.45) !important;
    background:
        radial-gradient(circle at 16px 50%, rgba(255,80,80,.28), transparent 48px),
        linear-gradient(135deg, rgba(82,18,26,.97), rgba(28,8,14,.95)) !important;
    box-shadow:
        0 14px 34px rgba(0,0,0,.46),
        0 0 24px rgba(255,72,72,.18),
        inset 0 1px 0 rgba(255,255,255,.10) !important;
}

/* Bad Icon stabil, aber nicht hektisch */
#rpg-menu-screen #menu-toast.menu-toast.bad::before {
    content: '✖' !important;
    display: inline-grid !important;
    place-items: center !important;
    width: 22px !important;
    height: 22px !important;
    margin-right: 9px !important;
    border-radius: 8px !important;
    color: #fff !important;
    background: linear-gradient(135deg, rgba(255,105,105,.55), rgba(145,22,35,.50)) !important;
    border: 1px solid rgba(255,160,160,.34) !important;
    box-shadow: 0 0 12px rgba(255,80,80,.26) !important;
    vertical-align: middle !important;
    transform: translateY(-1px) !important;
    animation: bvMenuToastBadIconStableV769 .42s cubic-bezier(.16,1.22,.36,1) both !important;
}

/* Progress-Bar nur bei BAD und kontrolliert */
#rpg-menu-screen #menu-toast.menu-toast.bad::after {
    content: '' !important;
    position: absolute !important;
    left: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 2px !important;
    background: linear-gradient(90deg, rgba(255,80,80,.95), rgba(255,190,120,.78), transparent) !important;
    transform-origin: left center !important;
    animation: bvMenuToastBadProgressV769 2.6s linear forwards !important;
    pointer-events: none !important;
}

#rpg-menu-screen #menu-toast.menu-toast.bad.hiding::after {
    animation-play-state: paused !important;
    opacity: 0 !important;
}

#rpg-menu-screen #menu-toast.menu-toast.good::before,
#rpg-menu-screen #menu-toast.menu-toast.good::after,
#rpg-menu-screen #menu-toast.menu-toast:not(.bad)::before,
#rpg-menu-screen #menu-toast.menu-toast:not(.bad)::after {
    content: none !important;
    animation: none !important;
}

@keyframes bvMenuToastStableEnterV769 {
    0%   { opacity: 0; transform: translate(-50%, -12px) scale(.975); filter: blur(4px) brightness(.88); }
    68%  { opacity: 1; transform: translate(-50%, 2px) scale(1.006); filter: blur(0) brightness(1.04); }
    100% { opacity: 1; transform: translate(-50%, 0) scale(1); filter: blur(0) brightness(1); }
}

@keyframes bvMenuToastStableExitV769 {
    0%   { opacity: 1; transform: translate(-50%, 0) scale(1); filter: blur(0) brightness(1); }
    100% { opacity: 0; transform: translate(-50%, -10px) scale(.985); filter: blur(3px) brightness(.82); }
}

@keyframes bvMenuToastBadIconStableV769 {
    0%   { opacity: 0; transform: translateY(-1px) scale(.72) rotate(-14deg); }
    70%  { opacity: 1; transform: translateY(-1px) scale(1.08) rotate(4deg); }
    100% { opacity: 1; transform: translateY(-1px) scale(1) rotate(0); }
}

@keyframes bvMenuToastBadProgressV769 {
    from { transform: scaleX(1); opacity: .9; }
    to   { transform: scaleX(0); opacity: .45; }
}
</style>

<style>
/* ============================================================
   ARENA HOTFIX v7.7.0: menu-toast wieder sichtbar
   Ursache: vorherige Base-Regel hatte opacity/transform/filter mit !important.
   Das blockiert Keyframe-Animationen. Jetzt steuern SHOW/HIDING den sichtbaren
   Zustand explizit mit !important + Transition.
   ============================================================ */
#rpg-menu-screen #menu-toast.menu-toast {
    display: block !important;
    visibility: hidden !important;
    opacity: 0 !important;
    transform: translate(-50%, -8px) scale(.985) !important;
    filter: blur(2px) brightness(.9) !important;
    transition:
        opacity .26s ease,
        transform .30s cubic-bezier(.16,1,.36,1),
        filter .26s ease,
        visibility 0s linear .30s !important;
    animation: none !important;
}

#rpg-menu-screen #menu-toast.menu-toast.show:not(.hiding),
#rpg-menu-screen #menu-toast.menu-toast.show.toast-enter:not(.hiding),
#rpg-menu-screen #menu-toast.menu-toast.bad.show:not(.hiding),
#rpg-menu-screen #menu-toast.menu-toast.good.show:not(.hiding) {
    visibility: visible !important;
    opacity: 1 !important;
    transform: translate(-50%, 0) scale(1) !important;
    filter: blur(0) brightness(1) !important;
    transition:
        opacity .26s ease,
        transform .30s cubic-bezier(.16,1,.36,1),
        filter .26s ease,
        visibility 0s !important;
    animation: none !important;
}

#rpg-menu-screen #menu-toast.menu-toast.hiding,
#rpg-menu-screen #menu-toast.menu-toast.show.hiding,
#rpg-menu-screen #menu-toast.menu-toast.bad.hiding,
#rpg-menu-screen #menu-toast.menu-toast.good.hiding {
    visibility: visible !important;
    opacity: 0 !important;
    transform: translate(-50%, -9px) scale(.985) !important;
    filter: blur(2px) brightness(.85) !important;
    transition:
        opacity .42s ease,
        transform .42s ease,
        filter .42s ease,
        visibility 0s linear .42s !important;
    animation: none !important;
}

/* Error-Progress-Bar bleibt sichtbar, aber ohne die Visibility zu blockieren */
#rpg-menu-screen #menu-toast.menu-toast.bad.show:not(.hiding)::after {
    animation: bvMenuToastBadProgressV770 2.6s linear forwards !important;
    opacity: .95 !important;
}

#rpg-menu-screen #menu-toast.menu-toast.bad.hiding::after {
    opacity: 0 !important;
    animation: none !important;
}

@keyframes bvMenuToastBadProgressV770 {
    from { transform: scaleX(1); opacity: .95; }
    to   { transform: scaleX(0); opacity: .45; }
}
</style>

<style>
/* ============================================================
   ARENA HOTFIX v7.7.1: Item-/SkillShop Toast ohne Blur
   Problem: bvShopToastIn hatte filter: blur(...) beim Ein-/Ausblenden.
   Dadurch wirkte "gekauft" beim Erscheinen kurz unscharf.
   Lösung: neue Toast-Animation nur mit Opacity/Transform, Text bleibt scharf.
   ============================================================ */
.bv-shop-container > .bv-shop-toast,
.bv-skillshop-container > .bv-shop-toast,
.bv-shop-toast {
    filter: none !important;
    animation: bvShopToastNoBlurV771 4.0s cubic-bezier(.16,1,.36,1) both !important;
    text-rendering: geometricPrecision !important;
    -webkit-font-smoothing: antialiased !important;
    backface-visibility: hidden !important;
    transform-origin: top center !important;
}

.bv-shop-toast.success {
    filter: none !important;
    text-shadow: 0 0 10px rgba(68,255,136,.25) !important;
}

.bv-shop-toast.error {
    filter: none !important;
    text-shadow: 0 0 10px rgba(248,113,113,.25) !important;
}

.bv-shop-toast.gold {
    filter: none !important;
    text-shadow: 0 0 10px rgba(255,215,0,.28) !important;
}

@keyframes bvShopToastNoBlurV771 {
    0% {
        opacity: 0;
        transform: translateX(-50%) translateY(-12px) scale(.96);
        filter: none;
    }
    10% {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1.018);
        filter: none;
    }
    18% {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
        filter: none;
    }
    82% {
        opacity: 1;
        transform: translateX(-50%) translateY(0) scale(1);
        filter: none;
    }
    100% {
        opacity: 0;
        transform: translateX(-50%) translateY(-8px) scale(.985);
        filter: none;
    }
}
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.7.2: SkillShop kein Re-Entry nach Kauf
   Problem: Nach Skill-Kauf wurde das Skill-Grid neu gerendert und alle Karten
   spielten erneut ihre Startanimation ab.
   Lösung: Nur der gekaufte Skill behält Unlock-FX; nach dem Refresh werden
   alle neuen Karten ohne Entrance-Animation angezeigt.
   ============================================================ */
#rpg-skillshop-screen .bv-skill-card.bv-skill-no-entry-card {
    animation: none !important;
    opacity: 1 !important;
    filter: none !important;
}

#rpg-skillshop-screen .bv-skill-card.bv-skill-no-entry-card::before,
#rpg-skillshop-screen .bv-skill-card.bv-skill-no-entry-card::after {
    animation-delay: 0s !important;
}

/* Falls ältere nth-child Delays greifen: neutralisieren für No-Reentry-Karten */
#rpg-skillshop-screen .bv-skill-card.bv-skill-no-entry-card:nth-child(n) {
    animation-delay: 0s !important;
}
</style>


<style>
/* ============================================================
   ARENA UPDATE v7.7.3: Better Persistent Shop/Skill Purchase FX
   - Partikel liegen in eigenem Overlay statt in Cards
   - verschwinden nicht mehr bei Grid-Refresh / Mehrfachkäufen
   - Items: schneller Gold/Reward-Burst
   - Skills: magische Rune-Ringe + stärkere Unlock-FX
   ============================================================ */
.bv-shop-container,
.bv-skillshop-container {
    overflow: hidden !important;
}

.bv-shop-fx-layer-v772 {
    position: absolute !important;
    inset: 0 !important;
    z-index: 75 !important;
    pointer-events: none !important;
    overflow: visible !important;
    contain: layout style !important;
}

.bv-purchase-orb-v772 {
    position: absolute;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(.35);
    opacity: 0;
    background: radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,215,0,.55) 28%, rgba(68,255,136,.18) 56%, transparent 72%);
    box-shadow: 0 0 24px rgba(255,215,0,.7), 0 0 52px rgba(68,255,136,.28);
    animation: bvPurchaseOrbV772 .78s cubic-bezier(.16,1,.36,1) forwards;
}

.bv-purchase-orb-v772.skill {
    background: radial-gradient(circle, rgba(255,255,255,.96) 0%, rgba(216,180,254,.68) 30%, rgba(168,85,247,.24) 58%, transparent 74%);
    box-shadow: 0 0 28px rgba(216,180,254,.8), 0 0 60px rgba(168,85,247,.36);
    animation-duration: 1.05s;
}

.bv-purchase-sparkline-v772 {
    position: absolute;
    width: 140px;
    height: 3px;
    border-radius: 999px;
    pointer-events: none;
    transform: translate(-50%, -50%) rotate(var(--rot, 0deg)) scaleX(0);
    opacity: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.95), rgba(255,215,0,.9), transparent);
    box-shadow: 0 0 18px rgba(255,215,0,.62);
    animation: bvPurchaseSparklineV772 .62s ease-out forwards;
}

.bv-purchase-sparkline-v772.skill {
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.95), rgba(216,180,254,.95), transparent);
    box-shadow: 0 0 20px rgba(168,85,247,.7);
}

.bv-purchase-particle-v772,
.bv-skill-rune-particle-v772 {
    position: absolute;
    pointer-events: none;
    z-index: 2;
    color: var(--c, #ffd700);
    font-size: var(--s, 14px);
    text-shadow: 0 0 10px currentColor, 0 0 22px rgba(255,255,255,.25);
    opacity: 0;
    will-change: transform, opacity, filter;
}

.bv-purchase-particle-v772.item {
    animation: bvPurchaseParticleItemV772 var(--dur, 1.08s) cubic-bezier(.12,.95,.22,1) forwards;
}

.bv-purchase-particle-v772.skill {
    animation: bvPurchaseParticleSkillV772 var(--dur, 1.55s) cubic-bezier(.14,1,.28,1) forwards;
}

.bv-skill-rune-particle-v772 {
    animation: bvSkillRuneParticleV772 2.05s cubic-bezier(.14,1,.28,1) forwards;
    filter: drop-shadow(0 0 10px currentColor);
}

.bv-skill-magic-ring-v772 {
    position: absolute;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(.25) rotate(0deg);
    opacity: 0;
    border: 2px solid rgba(216,180,254,.72);
    box-shadow: 0 0 24px rgba(168,85,247,.55), inset 0 0 18px rgba(216,180,254,.18);
    animation: bvSkillMagicRingV772 1.35s cubic-bezier(.16,1,.36,1) forwards;
}

.bv-skill-magic-ring-v772.r1 {
    width: 118px;
    height: 118px;
    border-color: rgba(68,255,136,.48);
}

.bv-skill-magic-ring-v772.r2 {
    width: 154px;
    height: 154px;
    border-style: dashed;
    border-color: rgba(255,255,255,.38);
}

.bv-float-stat-v772 {
    position: absolute;
    pointer-events: none;
    transform: translate(-50%, 0) scale(.82);
    opacity: 0;
    z-index: 3;
    font-family: 'Press Start 2P', monospace;
    font-size: .78rem;
    color: #44ff88;
    text-shadow: 0 0 10px rgba(68,255,136,.75), 0 0 20px rgba(68,255,136,.28);
    white-space: nowrap;
    animation: bvFloatStatOverlayV772 1.65s cubic-bezier(.16,1,.36,1) forwards;
}

.bv-float-stat-v772.stat-gold { color: #ffd700; text-shadow: 0 0 10px rgba(255,215,0,.75); }


@keyframes bvPurchaseSparklineV772 {
    0%   { opacity: 0; transform: translate(-50%, -50%) rotate(var(--rot, 0deg)) scaleX(0); }
    22%  { opacity: 1; }
    100% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--rot, 0deg)) scaleX(1.25); }
}

@keyframes bvSkillMagicRingV772 {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(.22) rotate(0deg); }
    18%  { opacity: .9; }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(2.2) rotate(180deg); }
}

@keyframes bvFloatStatOverlayV772 {
    0%   { opacity: 0; transform: translate(-50%, 8px) scale(.78); filter: blur(2px); }
    14%  { opacity: 1; transform: translate(-50%, -7px) scale(1.13); filter: blur(0); }
    72%  { opacity: 1; transform: translate(-50%, -28px) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -48px) scale(.9); filter: blur(2px); }
}
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.7.4: Skill-Partikel am Freigeschaltet-Button + Scroll-Follow
   ============================================================ */
#rpg-skillshop-screen .bv-skill-items-grid.bv-skill-fx-host-v773 {
    position: relative !important;
}

#rpg-skillshop-screen .bv-skill-items-grid > .bv-shop-fx-layer-v772.bv-skill-scroll-fx-layer-v773 {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    min-width: 100% !important;
    min-height: 100% !important;
    z-index: 60 !important;
    pointer-events: none !important;
    overflow: visible !important;
    transform: translateZ(0) !important;
}

/* Skill-Card bleibt darunter, FX-Layer darüber */
#rpg-skillshop-screen .bv-skill-card {
    position: relative !important;
    z-index: 1 !important;
}

#rpg-skillshop-screen .bv-skill-card.bv-skill-owned .bv-unlock-btn,
#rpg-skillshop-screen .bv-skill-card .bv-unlock-btn {
    position: relative !important;
    z-index: 2 !important;
}

/* Wenn Skill-FX vom Button ausgehen, etwas kompakter und fokussierter */
#rpg-skillshop-screen .bv-skill-scroll-fx-layer-v773 .bv-purchase-orb-v772.skill {
    width: 34px !important;
    height: 34px !important;
}

#rpg-skillshop-screen .bv-skill-scroll-fx-layer-v773 .bv-skill-magic-ring-v772 {
    width: 62px !important;
    height: 62px !important;
}

#rpg-skillshop-screen .bv-skill-scroll-fx-layer-v773 .bv-skill-magic-ring-v772.r1 {
    width: 92px !important;
    height: 92px !important;
}

#rpg-skillshop-screen .bv-skill-scroll-fx-layer-v773 .bv-skill-magic-ring-v772.r2 {
    width: 122px !important;
    height: 122px !important;
}
</style>


<style>
/* DEEP CLEAN: kompakte Dependencies für den finalen Title Button State Manager */
#rpg-title-screen .title-btn .bv-click-ripple-v2,
#rpg-title-screen .title-btn .bv-click-shockwave-v2,
#rpg-title-screen .title-btn .bv-click-particles-v2,
#rpg-title-screen .title-btn .bv-click-particles-v2 .particle {
    position: absolute;
    pointer-events: none;
    z-index: 3;
}
#rpg-title-screen .title-btn .bv-click-ripple-v2 {
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,255,255,.45), rgba(74,159,255,.18) 42%, transparent 72%);
    transform: translate(-50%, -50%) scale(.15);
    animation: bvClickRippleV2 .58s ease-out forwards;
}
#rpg-title-screen .title-btn .bv-click-shockwave-v2 {
    border-radius: 50%;
    border: 2px solid rgba(var(--btn-accent-2), .75);
    transform: translate(-50%, -50%) scale(.15);
    animation: bvClickShockwaveV2 .68s ease-out forwards;
}
#rpg-title-screen .title-btn .bv-click-particles-v2 { inset: 0; overflow: hidden; border-radius: inherit; }
#rpg-title-screen .title-btn .bv-click-particles-v2 .particle {
    width: 5px; height: 5px; border-radius: 50%;
    background: rgba(var(--btn-accent-2), .95);
    box-shadow: 0 0 10px rgba(var(--btn-accent-2), .85);
    animation: bvClickParticleV2 .54s cubic-bezier(.16,1,.36,1) forwards;
}
@keyframes bvTitleBtnClickV2 {
    0% { transform: translateY(4px) scale(.96); filter: brightness(.95); }
    45% { transform: translateY(-8px) scale(1.055); filter: brightness(1.22) saturate(1.25); }
    100% { transform: translateY(0) scale(1); filter: brightness(1); }
}
@keyframes bvTitleBtnReleaseV2 {
    0% { transform: translateY(5px) scale(.96); }
    55% { transform: translateY(-3px) scale(1.018); }
    100% { transform: translateY(0) scale(1); }
}
@keyframes bvTitleBtnIconClickV2 {
    0% { transform: scale(1) rotate(0deg); }
    48% { transform: scale(1.28) rotate(-12deg); }
    100% { transform: scale(1) rotate(0deg); }
}
@keyframes bvClickRippleV2 { to { opacity: 0; transform: translate(-50%, -50%) scale(5.2); } }
@keyframes bvClickShockwaveV2 { to { opacity: 0; transform: translate(-50%, -50%) scale(6.2); } }
@keyframes bvClickParticleV2 { to { opacity: 0; transform: translate(var(--dx,0), var(--dy,0)) scale(.35); } }
@media (prefers-reduced-motion: reduce) {
    #rpg-title-screen .title-btn .bv-click-ripple-v2,
    #rpg-title-screen .title-btn .bv-click-shockwave-v2,
    #rpg-title-screen .title-btn .bv-click-particles-v2 { display:none!important; }
}
</style>
<style>
/* ============================================================
   ARENA CONSOLIDATED CLEAN PATCH: entfernte Zwischen-Patches zusammengefasst
   - keine Item-Shop Re-Entry Animation nach Kauf
   - Changelog-Höhe final stabilisiert
   - finale NPC Bubble Styles kommen aus v7.6.2 Block
   ============================================================ */
#rpg-shop-screen .bv-shop-item-card.bv-no-entry-card {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
}

#changelog-modal.active {
    display: flex !important;
    overflow: hidden !important;
}

#changelog-modal.changelog-modal {
    align-items: center !important;
    justify-content: center !important;
    padding: 16px !important;
    box-sizing: border-box !important;
}

#changelog-modal .changelog-content {
    width: min(740px, 94vw) !important;
    height: min(70vh, calc(100vh - 32px)) !important;
    max-width: min(740px, 94vw) !important;
    max-height: calc(100vh - 32px) !important;
    min-height: 280px !important;
    margin: 0 !important;
    top: auto !important;
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
}

#changelog-modal .changelog-header {
    flex: 0 0 auto !important;
    min-height: 52px !important;
    padding: 11px 18px !important;
    margin: 0 !important;
    align-items: center !important;
}

#changelog-modal .changelog-body {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    padding: 12px 18px 18px !important;
}
</style>

<style>
/* ============================================================
   ARENA TOOL v7.7.5: FPS Counter / Lag Check
   Toggle: F2
   ============================================================ */
#bv-fps-counter {
    position: fixed;
    top: 14px;
    left: 14px;
    z-index: 100080;
    display: none;
    min-width: 124px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(74,159,255,.42);
    background: linear-gradient(145deg, rgba(5,12,28,.88), rgba(10,22,46,.78));
    box-shadow: 0 10px 28px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08);
    color: #dbeeff;
    font-family: 'VT323', monospace;
    font-size: 15px;
    line-height: 1.1;
    pointer-events: none;
    backdrop-filter: blur(8px) saturate(1.15);
    -webkit-backdrop-filter: blur(8px) saturate(1.15);
    opacity: .92;
}

#bv-fps-counter.visible {
    display: block;
    animation: bvFpsIn .22s ease-out both;
}

#bv-fps-counter .fps-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    white-space: nowrap;
}

#bv-fps-counter .fps-main {
    font-size: 20px;
    color: #44ff88;
    text-shadow: 0 0 10px rgba(68,255,136,.35);
    margin-bottom: 3px;
}

#bv-fps-counter.warn .fps-main {
    color: #ffd166;
    text-shadow: 0 0 10px rgba(255,209,102,.35);
}

#bv-fps-counter.bad .fps-main {
    color: #ff6b6b;
    text-shadow: 0 0 10px rgba(255,80,80,.38);
}

#bv-fps-counter .fps-label {
    opacity: .68;
}

#bv-fps-counter .fps-value {
    color: #fff;
}

#bv-fps-counter .fps-hint {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid rgba(255,255,255,.08);
    color: rgba(219,238,255,.58);
    font-size: 12px;
    text-align: center;
}

@keyframes bvFpsIn {
    from { opacity: 0; transform: translateY(-8px) scale(.96); }
    to   { opacity: .92; transform: translateY(0) scale(1); }
}
</style>

<script>
/* ARENA TOOL v7.7.5: FPS Counter / Lag Check */
(function () {
    var enabled = true;
    try {
        var saved = localStorage.getItem('bv_fps_counter_enabled');
        if (saved !== null) enabled = saved === '1';
    } catch (e) {}

    var el = null;
    var overlay = null;
    var lastFrame = performance.now();
    var lastUpdate = performance.now();
    var frames = 0;
    var fps = 0;
    var ms = 0;
    var minFps = Infinity;
    var maxMs = 0;
    var samples = [];

    function createCounter() {
        if (el) return el;
        el = document.createElement('div');
        el.id = 'bv-fps-counter';
        el.innerHTML =
            '<div class="fps-row fps-main"><span>FPS</span><span id="bv-fps-value">--</span></div>' +
            '<div class="fps-row"><span class="fps-label">Frame</span><span class="fps-value" id="bv-ms-value">-- ms</span></div>' +
            '<div class="fps-row"><span class="fps-label">Avg</span><span class="fps-value" id="bv-avg-value">--</span></div>' +
            '<div class="fps-row"><span class="fps-label">Min</span><span class="fps-value" id="bv-min-value">--</span></div>' +
            '<div class="fps-row"><span class="fps-label">Lag</span><span class="fps-value" id="bv-lag-value">0</span></div>' +
            '<div class="fps-hint">F2 Toggle</div>';
        document.body.appendChild(el);
        return el;
    }

    function isRpgVisible() {
        overlay = overlay || document.getElementById('rpg-overlay');
        return !!(overlay && (overlay.classList.contains('open') || overlay.classList.contains('opening')));
    }

    function setEnabled(value) {
        enabled = !!value;
        try { localStorage.setItem('bv_fps_counter_enabled', enabled ? '1' : '0'); } catch (e) {}
        updateVisibility();
    }

    function updateVisibility() {
        createCounter();
        if (enabled && isRpgVisible()) el.classList.add('visible');
        else el.classList.remove('visible');
    }

    function render() {
        if (!el) return;
        var avg = samples.length ? samples.reduce(function (a, b) { return a + b; }, 0) / samples.length : fps;
        el.classList.remove('warn', 'bad');
        if (fps < 30 || ms > 33) el.classList.add('bad');
        else if (fps < 50 || ms > 20) el.classList.add('warn');

        var fpsEl = document.getElementById('bv-fps-value');
        var msEl = document.getElementById('bv-ms-value');
        var avgEl = document.getElementById('bv-avg-value');
        var minEl = document.getElementById('bv-min-value');
        var lagEl = document.getElementById('bv-lag-value');

        if (fpsEl) fpsEl.textContent = String(Math.round(fps));
        if (msEl) msEl.textContent = ms.toFixed(1) + ' ms';
        if (avgEl) avgEl.textContent = Math.round(avg) + ' FPS';
        if (minEl) minEl.textContent = (minFps === Infinity ? '--' : Math.round(minFps)) + ' FPS';
        if (lagEl) lagEl.textContent = String(samples.filter(function (v) { return v < 45; }).length);
    }

    function tick(now) {
        var delta = now - lastFrame;
        lastFrame = now;
        ms = delta;
        maxMs = Math.max(maxMs, ms);
        frames++;

        if (now - lastUpdate >= 500) {
            fps = frames * 1000 / (now - lastUpdate);
            frames = 0;
            lastUpdate = now;
            if (isFinite(fps) && fps > 0) {
                minFps = Math.min(minFps, fps);
                samples.push(fps);
                if (samples.length > 40) samples.shift();
            }
            updateVisibility();
            if (enabled && el && el.classList.contains('visible')) render();
        }
        requestAnimationFrame(tick);
    }

    function init() {
        createCounter();
        updateVisibility();
        document.addEventListener('keydown', function (e) {
            if (e.key === 'F2') {
                e.preventDefault();
                setEnabled(!enabled);
            }
        });
        requestAnimationFrame(tick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
</script>


<style>
/* ============================================================
   ARENA PERF v7.7.6: Map Movement / Camera Optimization CSS
   ============================================================ */
#rpg-camera {
    will-change: transform !important;
    transform: translate3d(0,0,0);
    backface-visibility: hidden;
}
#rpg-player,
.rpg-npc,
.map-chest,
.map-easter-egg {
    will-change: left, top !important;
    contain: layout style !important;
}
#rpg-fx-particles {
    will-change: transform !important;
    pointer-events: none !important;
}
</style>

<style>
/* ============================================================
   ARENA PERF v7.7.8: MapEngine Raster Cache
   - Live-SVG-Map wird nach dem Rendern als einzelnes Bild gerastert
   - Türen/NPC/Kisten/Deko bleiben unverändert über DOM-Layer sichtbar
   - Keine Entfernung von Map-Details, nur weniger Browser-Renderlast
   ============================================================ */
#rpg-camera.map-engine-rasterized #map-engine-v6-raster-img {
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
    z-index: 0;
    image-rendering: auto;
    transform: translateZ(0);
    backface-visibility: hidden;
}

#rpg-camera.map-engine-rasterized #map-engine-v6-svg.bv-raster-hidden {
    display: none !important;
}

#rpg-camera.map-engine-rasterized #rpg-deco-layer,
#rpg-camera.map-engine-rasterized #rpg-chest-layer,
#rpg-camera.map-engine-rasterized #rpg-easter-egg-layer,
#rpg-camera.map-engine-rasterized #rpg-door-layer,
#rpg-camera.map-engine-rasterized #rpg-occlusion-layer,
#rpg-camera.map-engine-rasterized #rpg-npc-layer,
#rpg-camera.map-engine-rasterized #rpg-player {
    transform: translateZ(0);
    backface-visibility: hidden;
}
</style>

<script>
/* ARENA PERF v7.7.8: MapEngineV6 Raster Cache */
(function () {
    function mapKey(map) {
        var runtime = (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
        var id = runtime.currentMapId || 'map';
        var rows = map && map.length || 0;
        var cols = rows ? (map[0] && map[0].length || 0) : 0;
        var flat = [];
        try { flat = map.flat(); } catch (e) { flat = []; }
        return id + ':' + rows + 'x' + cols + ':' + flat.join('');
    }

    function installRasterPatch() {
        var ME = window.MapEngineV6;
        if (!ME || ME._bvRasterCachePatch) return false;
        ME._bvRasterCachePatch = true;

        var originalRender = ME.render.bind(ME);
        var rasterCache = new Map();
        var lastKey = '';

        ME.render = function patchedRasterRender(map) {
            // Wenn SVG existiert und vom letzten Raster versteckt wurde, für das Original kurz wieder bereitstellen.
            if (this.svg) {
                this.svg.classList.remove('bv-raster-hidden');
                this.svg.style.display = 'block';
            }

            var ok = originalRender(map);
            if (!ok || !this.svg || !map || !map.length) return ok;

            try {
                var svg = this.svg;
                var camera = document.getElementById('rpg-camera');
                if (!camera) return ok;

                var w = parseFloat(svg.getAttribute('width') || svg.style.width || '0') || 1;
                var h = parseFloat(svg.getAttribute('height') || svg.style.height || '0') || 1;
                var viewBox = svg.getAttribute('viewBox') || ('0 0 ' + w + ' ' + h);
                var key = mapKey(map);
                lastKey = key;

                var img = document.getElementById('map-engine-v6-raster-img');
                if (!img) {
                    img = document.createElement('img');
                    img.id = 'map-engine-v6-raster-img';
                    img.alt = '';
                    img.draggable = false;
                    img.decoding = 'sync';
                    if (svg.parentNode) svg.parentNode.insertBefore(img, svg.nextSibling);
                    else camera.insertBefore(img, camera.firstChild);
                }

                var src = rasterCache.get(key);
                if (!src) {
                    var svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="' + viewBox + '">' + svg.innerHTML + '</svg>';
                    src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);
                    rasterCache.set(key, src);
                    if (rasterCache.size > 5) {
                        var first = rasterCache.keys().next().value;
                        rasterCache.delete(first);
                    }
                }

                img.style.width = w + 'px';
                img.style.height = h + 'px';
                img.width = Math.max(1, Math.round(w));
                img.height = Math.max(1, Math.round(h));

                img.onload = function () {
                    // Nur verstecken, wenn inzwischen nicht schon eine andere Map geladen wurde.
                    if (lastKey === key && svg) {
                        svg.classList.add('bv-raster-hidden');
                        // DOM-Knoten der Live-SVG-Map entfernen, damit der Browser sie nicht weiter layoutet/paintet.
                        svg.innerHTML = '';
                        camera.classList.add('map-engine-rasterized');
                    }
                };
                img.onerror = function () {
                    // Fallback: Live-SVG sichtbar lassen, damit nie eine leere Map entsteht.
                    if (svg) {
                        svg.classList.remove('bv-raster-hidden');
                        svg.style.display = 'block';
                    }
                    camera.classList.remove('map-engine-rasterized');
                };

                if (img.src !== src) img.src = src;
                else img.onload();
            } catch (err) {
                console.warn('[BüroVersum] Map raster cache failed, SVG fallback active:', err);
                if (this.svg) {
                    this.svg.classList.remove('bv-raster-hidden');
                    this.svg.style.display = 'block';
                }
            }
            return ok;
        };

        console.log('🗺️ MapEngineV6 Raster Cache aktiv: Live-SVG wird als Bild gecached.');
        return true;
    }

    function waitForEngine() {
        if (installRasterPatch()) return;
        setTimeout(waitForEngine, 80);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForEngine, { once: true });
    } else {
        waitForEngine();
    }
})();
</script>

<style>
/* ============================================================
   ARENA HOTFIX v7.7.9: Raster Map Z-Index / Occlusion Fix
   Problem: Der Raster-Performance-Patch gab mehreren Layern transform:translateZ(0).
   Dadurch entstanden neue Stacking-Contexts und Occluder/Wände konnten NPC/Player
   nicht mehr korrekt überdecken.
   Lösung: Raster-Bild bleibt GPU-optimiert, aber Gameplay-Layer bleiben im gemeinsamen
   Z-Index-Kontext. Inline z-index der Entities/Occluder greift wieder.
   ============================================================ */
#rpg-camera.map-engine-rasterized #map-engine-v6-raster-img {
    z-index: 0 !important;
    transform: translateZ(0) !important;
}

/* Diese Layer dürfen KEINEN eigenen Stacking Context bekommen,
   sonst kann ein Occluder mit hohem z-index nicht über NPC/Player liegen. */
#rpg-camera.map-engine-rasterized #rpg-deco-layer,
#rpg-camera.map-engine-rasterized #rpg-chest-layer,
#rpg-camera.map-engine-rasterized #rpg-easter-egg-layer,
#rpg-camera.map-engine-rasterized #rpg-door-layer,
#rpg-camera.map-engine-rasterized #rpg-occlusion-layer,
#rpg-camera.map-engine-rasterized #rpg-npc-layer {
    transform: none !important;
    backface-visibility: visible !important;
    z-index: auto !important;
    contain: none !important;
    isolation: auto !important;
}

#rpg-camera.map-engine-rasterized #rpg-occlusion-layer {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    pointer-events: none !important;
    z-index: auto !important;
}

#rpg-camera.map-engine-rasterized .bv-occluder,
#rpg-camera.map-engine-rasterized .bv-occluder.bv-occluder-iso {
    position: absolute !important;
    pointer-events: none !important;
    z-index: var(--occ-z, auto);
    transform: none !important;
}

/* Player selbst darf weiterhin über inline z-index sortiert werden. */
#rpg-camera.map-engine-rasterized #rpg-player,
#rpg-camera.map-engine-rasterized .rpg-npc,
#rpg-camera.map-engine-rasterized .map-chest,
#rpg-camera.map-engine-rasterized .map-door,
#rpg-camera.map-engine-rasterized .map-easter-egg {
    position: absolute !important;
    z-index: auto;
}
</style>

<script>
/* ARENA HOTFIX v7.7.9: Occluder CSS var mirror for raster z-index debug safety */
(function () {
    function mirrorOccluderZIndex() {
        document.querySelectorAll('#rpg-occlusion-layer .bv-occluder').forEach(function (el) {
            if (el.style && el.style.zIndex) el.style.setProperty('--occ-z', el.style.zIndex);
        });
    }

    function installOccluderObserver() {
        var layer = document.getElementById('rpg-occlusion-layer');
        if (!layer || layer.dataset.bvRasterZFix === '1') return;
        layer.dataset.bvRasterZFix = '1';
        mirrorOccluderZIndex();
        var obs = new MutationObserver(mirrorOccluderZIndex);
        obs.observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', installOccluderObserver, { once: true });
    } else {
        installOccluderObserver();
    }
})();
</script>


<style>
/* ============================================================
   ARENA HOTFIX v7.7.10: NPC Social Bubble Layer / Z-Index / Position
   Problem: Bubble als Kind vom NPC wurde durch Wand-/Occlusion-Z-Index überdeckt
   und saß je nach 2.5D-Position falsch. Jetzt liegt sie in eigenem Map-Layer.
   ============================================================ */
#npc-social-bubble-layer {
    position: absolute !important;
    inset: 0 !important;
    pointer-events: none !important;
    z-index: 999999 !important;
    overflow: visible !important;
    transform: translateZ(0) !important;
}

/* Alte NPC-interne Bubble/Pseudo-Dots ausblenden, damit nichts doppelt erscheint */
.rpg-npc > .npc-social-bubble,
.rpg-npc.npc-social-listening::before {
    display: none !important;
    content: none !important;
}

.npc-social-map-bubble {
    position: absolute !important;
    transform: translate(-50%, -100%) !important;
    min-width: 132px !important;
    max-width: 220px !important;
    padding: 9px 11px 10px !important;
    border-radius: 16px 16px 16px 5px !important;
    background:
        radial-gradient(circle at 16% 0%, rgba(140,205,255,.22), transparent 42%),
        linear-gradient(145deg, rgba(7,18,42,.98), rgba(17,45,88,.98)) !important;
    border: 1px solid rgba(148,216,255,.64) !important;
    color: #f4fbff !important;
    box-shadow:
        0 14px 34px rgba(0,0,0,.58),
        0 0 28px rgba(74,159,255,.32),
        inset 0 1px 0 rgba(255,255,255,.12) !important;
    text-align: center !important;
    font-family: 'VT323', monospace !important;
    line-height: 1.13 !important;
    pointer-events: none !important;
    transform-origin: 50% 100% !important;
    opacity: 1 !important;
}

.npc-social-map-bubble::after {
    content: '';
    position: absolute;
    left: 18px;
    bottom: -6px;
    width: 10px;
    height: 10px;
    background: rgba(12,28,58,.98);
    border-right: 1px solid rgba(148,216,255,.45);
    border-bottom: 1px solid rgba(148,216,255,.45);
    transform: rotate(45deg);
}

.npc-social-map-bubble.npc-bubble-mean {
    background: radial-gradient(circle at 18% 0%, rgba(255,120,120,.24), transparent 42%), linear-gradient(145deg, rgba(48,10,18,.98), rgba(88,22,30,.98)) !important;
    border-color: rgba(255,120,120,.7) !important;
    box-shadow: 0 14px 34px rgba(0,0,0,.60), 0 0 30px rgba(255,80,80,.36) !important;
}

.npc-social-map-bubble.npc-bubble-mean::after {
    background: rgba(70,16,24,.98);
    border-color: rgba(255,120,120,.5);
}

.npc-social-map-bubble.npc-bubble-argument {
    background: radial-gradient(circle at 18% 0%, rgba(255,210,90,.24), transparent 42%), linear-gradient(145deg, rgba(48,30,6,.98), rgba(88,48,12,.98)) !important;
    border-color: rgba(255,204,92,.72) !important;
    box-shadow: 0 14px 34px rgba(0,0,0,.60), 0 0 30px rgba(255,184,70,.36) !important;
}

.npc-social-map-bubble.npc-bubble-argument::after {
    background: rgba(70,42,10,.98);
    border-color: rgba(255,204,92,.5);
}

.npc-social-map-bubble.bubble-pop,
.npc-social-map-listen.bubble-pop {
    animation: npcMapBubblePopV7710 .24s cubic-bezier(.16,1.32,.36,1) both, npcMapBubbleIdleV7710 1.05s ease-in-out .24s infinite alternate !important;
}

.npc-social-map-bubble .npc-bubble-mood {
    position:absolute;
    top:-12px;
    left:-9px;
    width:23px;
    height:23px;
    border-radius:50%;
    display:grid;
    place-items:center;
    background:rgba(8,18,40,.96);
    border:1px solid rgba(148,216,255,.55);
    font-size:13px;
    box-shadow:0 4px 12px rgba(0,0,0,.38);
    animation:npcBubbleMoodPulseV762 .78s ease-in-out infinite alternate;
}

.npc-social-map-bubble .npc-bubble-speaker {
    display:block !important;
    margin-bottom:3px !important;
    padding-bottom:2px !important;
    color:#8fd3ff !important;
    font-size:.7rem !important;
    line-height:1 !important;
    opacity:.96 !important;
    white-space:nowrap !important;
    overflow:hidden !important;
    text-overflow:ellipsis !important;
    border-bottom:1px solid rgba(140,205,255,.2) !important;
}

.npc-social-map-bubble.npc-bubble-mean .npc-bubble-speaker { color:#ffb4b4 !important; border-bottom-color:rgba(255,160,160,.24) !important; }
.npc-social-map-bubble.npc-bubble-argument .npc-bubble-speaker { color:#ffd166 !important; border-bottom-color:rgba(255,209,102,.24) !important; }
.npc-social-map-bubble .npc-bubble-text { display:block !important; color:#f4fbff !important; font-size:.85rem !important; line-height:1.13 !important; animation:npcBubbleTextInV762 .18s ease-out both !important; }
.npc-social-map-bubble .npc-bubble-keyword { color:#ffd166; text-shadow:0 0 8px rgba(255,209,102,.48); animation:npcKeywordGlowV762 .9s ease-in-out infinite alternate; }

.npc-social-map-listen {
    position: absolute !important;
    transform: translate(-50%, -100%) !important;
    min-width: 30px !important;
    height: 21px !important;
    line-height: 17px !important;
    text-align: center !important;
    border-radius: 999px !important;
    background: rgba(8,18,40,.9) !important;
    border: 1px solid rgba(140,205,255,.42) !important;
    color: #c8ecff !important;
    font-family: 'VT323', monospace !important;
    font-size: 1rem !important;
    box-shadow: 0 10px 22px rgba(0,0,0,.48), 0 0 16px rgba(74,159,255,.22) !important;
    pointer-events: none !important;
}

@keyframes npcMapBubblePopV7710 {
    from { opacity: 0; transform: translate(-50%, calc(-100% + 8px)) scale(.78); filter: blur(3px); }
    to   { opacity: 1; transform: translate(-50%, -100%) scale(1); filter: blur(0); }
}

@keyframes npcMapBubbleIdleV7710 {
    from { transform: translate(-50%, -100%) translateY(0) scale(1); }
    to   { transform: translate(-50%, -100%) translateY(-2px) scale(1.012); }
}
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.7.11: Stable Movement/Input Timing
   ============================================================ */
#rpg-player.walking {
    will-change: left, top, transform !important;
}
#rpg-player .sprite-body {
    backface-visibility: hidden;
}
</style>


<style>
/* ============================================================
   ARENA UPDATE v7.7.12: Map Player Idle Animation + Enemy Variety
   ============================================================ */
#rpg-player .sprite-body {
    --player-face: 1;
    transform-origin: 50% 100% !important;
}

#rpg-player.face-left .sprite-body { --player-face: -1; }
#rpg-player.face-right .sprite-body { --player-face: 1; }

/* Spieler steht: dezentes Atmen/Idle, damit die Map-Figur lebendiger wirkt */
#rpg-player:not(.walking) .sprite-body {
    animation: bvMapPlayerIdleBreathV7712 2.35s ease-in-out infinite !important;
}

#rpg-player:not(.walking) .sprite-shadow {
    animation: bvMapPlayerIdleShadowV7712 2.35s ease-in-out infinite !important;
}

/* Spieler läuft: Walking-Animation behält Richtung bei */
#rpg-player.walking .sprite-body {
    animation: bvMapPlayerWalkV7712 .18s ease-in-out infinite !important;
}

@keyframes bvMapPlayerIdleBreathV7712 {
    0%, 100% {
        transform: scaleX(var(--player-face)) translateY(0) scaleY(1);
        filter: drop-shadow(2px 2px 2px rgba(0,0,0,.5)) brightness(1);
    }
    45% {
        transform: scaleX(var(--player-face)) translateY(-1.5px) scaleY(1.035);
        filter: drop-shadow(2px 4px 3px rgba(0,0,0,.46)) brightness(1.04);
    }
    70% {
        transform: scaleX(var(--player-face)) translateY(.5px) scaleY(.99);
    }
}

@keyframes bvMapPlayerIdleShadowV7712 {
    0%, 100% { transform: scaleX(1); opacity: .72; filter: blur(2px); }
    45% { transform: scaleX(.86); opacity: .56; filter: blur(2.6px); }
}

@keyframes bvMapPlayerWalkV7712 {
    0%, 100% {
        transform: scaleX(var(--player-face)) translateY(0) rotate(0deg) scale(1);
    }
    50% {
        transform: scaleX(var(--player-face)) translateY(-4px) rotate(-1.5deg) scale(1.035);
    }
}
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.7.13: Victory Performance / Particle Cost
   Ursache: Victory hatte viele gleichzeitig animierte Up-Partikel + Blur/Drop-Shadow.
   Fix: weniger Partikel per JS + günstigere CSS-Filter, ohne Effekt komplett zu entfernen.
   ============================================================ */
#victory-screen .bv-victory-ember {
    filter: drop-shadow(0 0 6px rgba(255,200,40,.42)) !important;
    will-change: transform, opacity !important;
}

#victory-screen .bv-victory-ash {
    text-shadow: 0 0 6px rgba(255,215,0,.35) !important;
    will-change: transform, opacity !important;
}

#victory-screen .bv-victory-smoke {
    filter: blur(9px) !important;
    opacity: .55;
    will-change: transform, opacity !important;
}

#victory-screen .bv-victory-star-particle {
    text-shadow: 0 0 7px currentColor !important;
    will-change: transform, opacity !important;
}

#victory-screen .bv-victory-star-ring {
    box-shadow: 0 0 16px rgba(255,215,0,.38), inset 0 0 10px rgba(255,215,0,.12) !important;
}

/* Während die Ergebnis-FX laufen, keine teuren Hintergrund-Filter-Kaskaden */
#victory-screen.visible .victory-bg::after {
    opacity: .45 !important;
}

@media (max-width: 900px), (max-height: 650px) {
    #victory-screen .bv-victory-smoke { display: none !important; }
    #victory-screen .bv-victory-ash:nth-child(odd) { display: none !important; }
}
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.7.14: Item/Skill Shop Animation Start Performance
   - weniger DOM auf einmal
   - Partikel in Batches
   - billigere Filter/Text-Shadows
   - kein forced reflow beim Kauf-Burst
   ============================================================ */
.bv-shop-fx-layer-v772 {
    contain: layout style paint !important;
}

.bv-purchase-particle-v772,
.bv-skill-rune-particle-v772 {
    text-shadow: 0 0 7px currentColor !important;
    filter: none !important;
    will-change: transform, opacity !important;
    contain: layout style paint !important;
}

.bv-purchase-orb-v772 {
    box-shadow: 0 0 18px rgba(255,215,0,.46), 0 0 34px rgba(68,255,136,.16) !important;
}

.bv-purchase-orb-v772.skill {
    box-shadow: 0 0 20px rgba(216,180,254,.52), 0 0 38px rgba(168,85,247,.20) !important;
}

.bv-purchase-sparkline-v772 {
    box-shadow: 0 0 12px rgba(255,215,0,.38) !important;
}

.bv-purchase-sparkline-v772.skill {
    box-shadow: 0 0 13px rgba(168,85,247,.44) !important;
}

.bv-skill-rune-particle-v772 {
    filter: none !important;
}

.bv-skill-magic-ring-v772 {
    box-shadow: 0 0 16px rgba(168,85,247,.38), inset 0 0 10px rgba(216,180,254,.12) !important;
}

@keyframes bvPurchaseOrbV772 {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(.28); }
    24%  { opacity: .9; transform: translate(-50%, -50%) scale(1.12); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(2.25); }
}

@keyframes bvPurchaseParticleItemV772 {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(.45) rotate(0deg); }
    14%  { opacity: 1; transform: translate(-50%, -50%) translate(calc(var(--dx) * .14), calc(var(--dy) * .14)) scale(1.12) rotate(25deg); }
    72%  { opacity: .9; transform: translate(-50%, -50%) translate(calc(var(--dx) * .82), calc(var(--dy) * .82)) scale(.86) rotate(calc(var(--rot) * .72)); }
    100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(.25) rotate(var(--rot)); }
}

@keyframes bvPurchaseParticleSkillV772 {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(.42) rotate(0deg); }
    14%  { opacity: 1; transform: translate(-50%, -50%) translate(calc(var(--dx) * .12), calc(var(--dy) * .12)) scale(1.15) rotate(35deg); }
    60%  { opacity: .95; transform: translate(-50%, -50%) translate(calc(var(--dx) * .64), calc(var(--dy) * .64)) scale(.92) rotate(calc(var(--rot) * .58)); }
    100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(.22) rotate(var(--rot)); }
}

@keyframes bvSkillRuneParticleV772 {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(.44) rotate(0deg); }
    12%  { opacity: 1; transform: translate(-50%, -50%) translate(calc(var(--rx) * .12), calc(var(--ry) * .12)) scale(1.08) rotate(25deg); }
    58%  { opacity: .95; transform: translate(-50%, -50%) translate(calc(var(--rx) * .66), calc(var(--ry) * .66)) scale(.95) rotate(calc(var(--rot) * .62)); }
    100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--rx), var(--ry)) scale(.24) rotate(var(--rot)); }
}
</style>


<style>
/* ============================================================
   ARENA FEATURE v7.8.0: Questlog / Aufgaben-System
   ============================================================ */
#rpg-menu-screen .questlog-panel {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 14px;
}

#rpg-menu-screen .questlog-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
}

#rpg-menu-screen .quest-stat-card {
    padding: 10px 12px;
    border-radius: 14px;
    background: linear-gradient(145deg, rgba(255,255,255,.075), rgba(0,0,0,.18));
    border: 1px solid rgba(140,205,255,.16);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
    text-align: center;
}

#rpg-menu-screen .quest-stat-card b {
    display: block;
    font-size: 1.25rem;
    color: #fff;
    line-height: 1.1;
}

#rpg-menu-screen .quest-stat-card span {
    display: block;
    margin-top: 2px;
    font-size: .78rem;
    color: rgba(210,230,255,.65);
}

#rpg-menu-screen .questlog-list {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
}

#rpg-menu-screen .quest-card {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: 48px 1fr auto;
    gap: 10px;
    align-items: start;
    padding: 12px;
    border-radius: 16px;
    background:
        radial-gradient(circle at 8% 12%, rgba(74,159,255,.13), transparent 34%),
        linear-gradient(145deg, rgba(255,255,255,.07), rgba(0,0,0,.18));
    border: 1px solid rgba(255,255,255,.12);
    box-shadow: 0 8px 22px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.08);
    transition: transform .22s cubic-bezier(.16,1,.36,1), border-color .22s ease, box-shadow .22s ease;
}

#rpg-menu-screen .quest-card:hover {
    transform: translateY(-2px);
    border-color: rgba(142,197,255,.45);
    box-shadow: 0 12px 28px rgba(0,0,0,.30), 0 0 18px rgba(74,159,255,.14), inset 0 1px 0 rgba(255,255,255,.11);
}

#rpg-menu-screen .quest-card::before {
    content: '';
    position: absolute;
    inset: 0 auto 0 0;
    width: 4px;
    background: var(--quest-color, #4a9fff);
    box-shadow: 0 0 14px var(--quest-color, #4a9fff);
}

#rpg-menu-screen .quest-card.completed { --quest-color: #44ff88; opacity: .82; }
#rpg-menu-screen .quest-card.active { --quest-color: #4a9fff; }
#rpg-menu-screen .quest-card.ready { --quest-color: #ffd166; }
#rpg-menu-screen .quest-card.available { --quest-color: #a855f7; }
#rpg-menu-screen .quest-card.locked { --quest-color: #64748b; opacity: .62; }

#rpg-menu-screen .quest-icon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    font-size: 1.8rem;
    background: rgba(0,0,0,.24);
    border: 1px solid rgba(255,255,255,.10);
}

#rpg-menu-screen .quest-title {
    margin: 0;
    color: #fff;
    font-size: 1.08rem;
    line-height: 1.1;
}

#rpg-menu-screen .quest-giver {
    margin: 2px 0 6px;
    color: rgba(210,230,255,.62);
    font-size: .82rem;
}

#rpg-menu-screen .quest-desc {
    margin: 0 0 8px;
    color: rgba(230,240,255,.82);
    font-size: .9rem;
    line-height: 1.25;
}

#rpg-menu-screen .quest-objective {
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(255,255,255,.78);
    font-size: .86rem;
}

#rpg-menu-screen .quest-reward {
    margin-top: 6px;
    color: #ffd166;
    font-size: .82rem;
}

#rpg-menu-screen .quest-badge {
    justify-self: end;
    white-space: nowrap;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: .76rem;
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(0,0,0,.22);
    color: #fff;
}

#rpg-menu-screen .quest-card.completed .quest-badge { color: #44ff88; border-color: rgba(68,255,136,.35); background: rgba(68,255,136,.10); }
#rpg-menu-screen .quest-card.active .quest-badge { color: #8ec5ff; border-color: rgba(74,159,255,.36); background: rgba(74,159,255,.10); }
#rpg-menu-screen .quest-card.ready .quest-badge { color: #ffd166; border-color: rgba(255,209,102,.38); background: rgba(255,209,102,.10); }
#rpg-menu-screen .quest-card.available .quest-badge { color: #d8b4fe; border-color: rgba(168,85,247,.38); background: rgba(168,85,247,.10); }


@media (max-width: 680px) {
    #rpg-menu-screen .questlog-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    #rpg-menu-screen .quest-card { grid-template-columns: 42px 1fr; }
    #rpg-menu-screen .quest-badge { grid-column: 2; justify-self: start; }
}
</style>

<script>
/* ARENA FEATURE v7.8.0: Questlog / Aufgaben-System */
(function () {
    'use strict';

    function getRuntime() {
        return (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : { player: window.player || {} };
    }

    function getPlayer() {
        return (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : (window.player || {});
    }

    function getDefeatedSet() {
        const rt = getRuntime();
        return rt.defeatedEnemies || window.defeatedEnemies || new Set();
    }

    function hasDefeated(key) {
        const set = getDefeatedSet();
        return !!(set && typeof set.has === 'function' && set.has(key));
    }

    function hasItem(itemId, amount = 1) {
        const p = getPlayer();
        return !!(p.inventory || []).find(i => i.id === itemId && (i.count || 0) >= amount);
    }

    function removeItem(itemId, amount = 1) {
        const p = getPlayer();
        if (!p.inventory) return false;
        const it = p.inventory.find(i => i.id === itemId && (i.count || 0) >= amount);
        if (!it) return false;
        it.count -= amount;
        if (it.count <= 0) p.inventory = p.inventory.filter(i => i !== it);
        return true;
    }

    function addQuestReward(gold = 0, exp = 0) {
        const p = getPlayer();
        p.gold = (p.gold || 0) + gold;
        p.exp = (p.exp || 0) + exp;
        if (typeof window.updateHUD === 'function') window.updateHUD();
        if (typeof window.updateMenuStats === 'function') window.updateMenuStats();
    }

    function ensureQuestState() {
        const p = getPlayer();
        if (!p.questState) p.questState = {};
        return p.questState;
    }

    function questStatusLabel(status) {
        return {
            completed: '✅ Erledigt',
            ready: '⭐ Abgeben',
            active: '📍 Aktiv',
            available: '✨ Verfügbar',
            locked: '🔒 Gesperrt'
        }[status] || status;
    }

    const QUESTS = [
        {
            id: 'andreas_document', icon: '📄', title: 'Andreas\' geheimes Dokument', giver: 'Andreas • Hauptflur',
            desc: 'Andreas hat ein wichtiges Dokument verloren. Es kann an mehreren Stellen im Büro auftauchen.',
            reward: '+90 Gold • +30 EXP',
            status() {
                const qs = ensureQuestState();
                if (qs.andreasQuest === 'completed') return 'completed';
                if (qs.andreasQuest === 'active' && hasItem('geheimes_dokument', 1)) return 'ready';
                if (qs.andreasQuest === 'active') return 'active';
                return 'available';
            },
            objective(status) {
                if (status === 'available') return 'Sprich mit Andreas im Hauptflur.';
                if (status === 'ready') return 'Bringe das Dokument zu Andreas zurück.';
                if (status === 'completed') return 'Dokument wurde zurückgegeben.';
                return 'Suche im Büro nach dem Dokument. Geheimspots reagieren beim Betreten.';
            }
        },
        {
            id: 'easter_eggs', icon: '🥚', title: 'Oster-Event: Eierjagd', giver: 'Patrick • Einkauf',
            desc: 'Patrick bittet dich, versteckte Ostereier im BüroVersum zu finden.',
            reward: 'Oster-Flower-Power • Gold/EXP',
            status() {
                const qs = ensureQuestState();
                if (qs.easterEvent === 'completed') return 'completed';
                if (qs.easterEvent === 'active') return 'active';
                return 'available';
            },
            objective(status) {
                if (status === 'available') return 'Sprich mit Patrick im Einkauf.';
                if (status === 'completed') return 'Alle Eier gefunden und Belohnung erhalten.';
                return 'Finde alle Ostereier auf den Maps.';
            }
        },
        {
            id: 'archiv_motte', icon: '🗄️', title: 'Archiv retten', giver: 'Archiv-Anna • Archiv',
            desc: 'Im Archiv raschelt eine Akten-Motte zwischen den Regalen.', reward: '+120 Gold • +25 EXP',
            status() {
                const qs = ensureQuestState();
                if (qs.archivMotteReward) return 'completed';
                if (hasDefeated('archiv_18_6_spam')) return 'ready';
                return 'available';
            },
            objective(status) {
                if (status === 'completed') return 'Archiv ist ruhig.';
                if (status === 'ready') return 'Sprich mit Archiv-Anna für die Belohnung.';
                return 'Besiege die Akten-Motte im Archiv.';
            }
        },
        {
            id: 'dach_signal', icon: '📡', title: 'Störsignal auf dem Dach', giver: 'Hausmeister Uwe • Dachterrasse',
            desc: 'Ein Störsignal blockiert die Büro-Verbindung.', reward: '+150 Gold • +2 Max MP',
            status() {
                const qs = ensureQuestState();
                if (qs.dachSignalReward) return 'completed';
                if (hasDefeated('dach_7_6_update') || hasDefeated('dach_7_6_stoersignal')) return 'ready';
                return 'available';
            },
            objective(status) {
                if (status === 'completed') return 'Signal ist stabil.';
                if (status === 'ready') return 'Sprich mit Hausmeister Uwe für die Belohnung.';
                return 'Besiege das Störsignal auf der Dachterrasse.';
            }
        },
        {
            id: 'sebastiano_secret', icon: '🤌', title: 'Geheimer Händler', giver: 'Sebastiano • Geheimraum',
            desc: 'Ein geheimer Händler versteckt sich abseits der normalen Bürowelt.', reward: 'Einmaliges Geschenk • optionaler Boss',
            status() {
                const p = getPlayer();
                const st = p.secretRoomState || {};
                if (st.sebastianoDefeated) return 'completed';
                if (st.sebastianoGiftClaimed) return 'active';
                return 'available';
            },
            objective(status) {
                if (status === 'completed') return 'Sebastiano wurde besiegt.';
                if (status === 'active') return 'Du hast sein Geschenk erhalten. Vielleicht steckt mehr dahinter.';
                return 'Finde den geheimen Eingang hinter der Kaffeeecke.';
            }
        }
    ];

    function getQuestData() {
        return QUESTS.map(q => {
            const status = q.status();
            return { ...q, status, objectiveText: q.objective(status) };
        });
    }

    var _lastQuestRenderKey = '';
    function renderQuestLog() {
        const host = document.getElementById('questlog-content');
        if (!host) return;
        const quests = getQuestData();
        const renderKey = quests.map(q => q.id + ':' + q.status).join('|');
        if (renderKey === _lastQuestRenderKey) return;
        _lastQuestRenderKey = renderKey;
        const counts = quests.reduce((acc, q) => { acc[q.status] = (acc[q.status] || 0) + 1; return acc; }, {});
        host.innerHTML = `
            <div class="questlog-panel">
                <div class="questlog-summary">
                    <div class="quest-stat-card"><b>${counts.active || 0}</b><span>Aktiv</span></div>
                    <div class="quest-stat-card"><b>${counts.ready || 0}</b><span>Abgeben</span></div>
                    <div class="quest-stat-card"><b>${counts.completed || 0}</b><span>Erledigt</span></div>
                    <div class="quest-stat-card"><b>${quests.length}</b><span>Gesamt</span></div>
                </div>
                <div class="questlog-list">
                    ${quests.map(q => `
                        <div class="quest-card ${q.status}" data-quest-id="${q.id}">
                            <div class="quest-icon">${q.icon}</div>
                            <div class="quest-main">
                                <h4 class="quest-title">${q.title}</h4>
                                <div class="quest-giver">${q.giver}</div>
                                <p class="quest-desc">${q.desc}</p>
                                <div class="quest-objective"><span>🎯</span><span>${q.objectiveText}</span></div>
                                <div class="quest-reward">🎁 ${q.reward}</div>
                            </div>
                            <div class="quest-badge">${questStatusLabel(q.status)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        if (typeof window.parseEmojis === 'function') window.parseEmojis(host);
    }

    function ensureQuestTab() {
        var host = document.getElementById('questlog-content');
        if (host && !host.innerHTML.trim()) renderQuestLog();
    }

    window.renderQuestTab = renderQuestLog;

    // Fehlende Andreas-Quest-Funktion ergänzen.
    window.openAndreasChoice = function(npc) {
        const p = getPlayer();
        const qs = ensureQuestState();
        const speaker = npc?.name || 'Andreas';
        const portrait = npc?.sprite || '👨‍💼';
        if (typeof window.showChoice !== 'function') return;
        window.showChoice('Ich habe ein wichtiges Dokument verloren. Kannst du helfen?', [
            { label: qs.andreasQuest ? 'Quest prüfen' : 'Quest annehmen', value: 'check', hint: '📄' },
            { label: 'Hinweis', value: 'hint', hint: '💡' },
            { label: 'Später', value: 'later', hint: '✖' }
        ], speaker, portrait, (val) => {
            if (val === 'hint') {
                window.showMessage?.('Das Dokument liegt irgendwo im Büro. Schau bei Schreibtischen, Kopierer, Pflanzen und Whiteboard nach.', speaker, portrait);
                return;
            }
            if (val !== 'check') {
                window.showMessage?.('Alles klar. Aber ohne das Dokument wird mein Tag nicht besser...', speaker, portrait);
                return;
            }
            if (!qs.andreasQuest) {
                qs.andreasQuest = 'active';
                window.showMessage?.('Danke! Such bitte im Büro nach meinem geheimen Dokument. Ich war zuletzt am Flur unterwegs.', speaker, portrait);
                renderQuestLog();
                return;
            }
            if (qs.andreasQuest === 'completed') {
                window.showMessage?.('Danke nochmal! Das Dokument ist sicher zurück.', speaker, portrait);
                return;
            }
            if (hasItem('geheimes_dokument', 1)) {
                removeItem('geheimes_dokument', 1);
                qs.andreasQuest = 'completed';
                addQuestReward(90, 30);
                window.showMessage?.('Perfekt! Genau das war es. +90 Gold und +30 EXP!', speaker, portrait);
                renderQuestLog();
            } else {
                window.showMessage?.('Das Dokument fehlt noch. Es muss irgendwo im Büro liegen.', speaker, portrait);
            }
        });
    };

    function wrapOpenMenu() {
        const original = window.openMenu;
        if (typeof original !== 'function' || original._questWrapped) return;
        window.openMenu = function() {
            const result = original.apply(this, arguments);
            setTimeout(() => { ensureQuestTab(); renderQuestLog(); }, 30);
            return result;
        };
        window.openMenu._questWrapped = true;
    }

    window.BVQuestLog = { ensureQuestTab, render: renderQuestLog, quests: getQuestData };

    function initQuestLog() {
        ensureQuestTab();
        wrapOpenMenu();
        setInterval(() => {
            const tab = document.getElementById('tab-quests');
            if (tab && tab.classList.contains('active')) renderQuestLog();
        }, 1200);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initQuestLog, { once: true });
    } else {
        initQuestLog();
    }
})();
</script>


<style>
/* ============================================================
   ARENA FEATURE v7.8.1: Einstellungen-Menü
   ============================================================ */
#rpg-menu-screen .settings-panel {
    display: grid;
    gap: 12px;
    padding: 14px;
}

#rpg-menu-screen .settings-hero {
    display: grid;
    grid-template-columns: 54px 1fr;
    gap: 12px;
    align-items: center;
    padding: 14px;
    border-radius: 18px;
    background:
        radial-gradient(circle at 8% 0%, rgba(74,159,255,.16), transparent 38%),
        linear-gradient(145deg, rgba(255,255,255,.075), rgba(0,0,0,.18));
    border: 1px solid rgba(140,205,255,.18);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
}

#rpg-menu-screen .settings-hero-icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    display: grid;
    place-items: center;
    font-size: 2rem;
    background: rgba(0,0,0,.26);
    border: 1px solid rgba(255,255,255,.12);
    box-shadow: 0 0 18px rgba(74,159,255,.12);
}

#rpg-menu-screen .settings-hero h3 {
    margin: 0;
    color: #fff;
    font-size: 1.18rem;
}

#rpg-menu-screen .settings-hero p {
    margin: 3px 0 0;
    color: rgba(210,230,255,.68);
    font-size: .9rem;
}

#rpg-menu-screen .settings-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

#rpg-menu-screen .setting-card {
    position: relative;
    overflow: hidden;
    display: grid;
    gap: 8px;
    padding: 12px;
    border-radius: 16px;
    background: linear-gradient(145deg, rgba(255,255,255,.07), rgba(0,0,0,.18));
    border: 1px solid rgba(255,255,255,.12);
    box-shadow: 0 8px 22px rgba(0,0,0,.20), inset 0 1px 0 rgba(255,255,255,.08);
}

#rpg-menu-screen .setting-title {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #fff;
    font-size: 1rem;
}

#rpg-menu-screen .setting-desc {
    color: rgba(210,230,255,.64);
    font-size: .78rem;
    line-height: 1.22;
}

#rpg-menu-screen .setting-control {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
}

#rpg-menu-screen .setting-select,
#rpg-menu-screen .setting-button {
    width: 100%;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(140,205,255,.28);
    background: rgba(5,12,28,.78);
    color: #dbeeff;
    font-family: 'VT323', monospace;
    font-size: 1rem;
    outline: none;
}

#rpg-menu-screen .setting-button {
    cursor: pointer;
    background: linear-gradient(135deg, rgba(74,159,255,.24), rgba(168,85,247,.16));
    transition: transform .18s ease, filter .18s ease;
}

#rpg-menu-screen .setting-button:hover {
    transform: translateY(-2px);
    filter: brightness(1.15);
}

#rpg-menu-screen .setting-toggle {
    position: relative;
    width: 54px;
    height: 28px;
    flex: 0 0 auto;
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 999px;
    background: rgba(0,0,0,.35);
    cursor: pointer;
    transition: background .2s ease, border-color .2s ease;
}

#rpg-menu-screen .setting-toggle::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #cbd5e1;
    box-shadow: 0 3px 10px rgba(0,0,0,.35);
    transition: transform .22s cubic-bezier(.16,1,.36,1), background .2s ease;
}

#rpg-menu-screen .setting-toggle.on {
    background: rgba(68,255,136,.18);
    border-color: rgba(68,255,136,.45);
}

#rpg-menu-screen .setting-toggle.on::after {
    transform: translateX(26px);
    background: #44ff88;
}

#bv-fps-counter-settings {
    position: fixed;
    top: 14px;
    left: 14px;
    z-index: 100080;
    display: none;
    min-width: 124px;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid rgba(74,159,255,.42);
    background: linear-gradient(145deg, rgba(5,12,28,.88), rgba(10,22,46,.78));
    box-shadow: 0 10px 28px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.08);
    color: #dbeeff;
    font-family: 'VT323', monospace;
    font-size: 15px;
    line-height: 1.1;
    pointer-events: none;
    opacity: .92;
}

#bv-fps-counter-settings.visible { display: block; }
#bv-fps-counter-settings .fps-main { font-size: 20px; color: #44ff88; }
#bv-fps-counter-settings.warn .fps-main { color: #ffd166; }
#bv-fps-counter-settings.bad .fps-main { color: #ff6b6b; }
#bv-fps-counter-settings .fps-row { display:flex; justify-content:space-between; gap:12px; }

body.bv-settings-reduced-motion #rpg-title-screen .title-particles,
body.bv-settings-reduced-motion #rpg-title-screen .title-light-rays,
body.bv-settings-reduced-motion #rpg-title-screen .title-glow-orbs,
body.bv-settings-reduced-motion .battle-particles,
body.bv-settings-reduced-motion .battle-fog,
body.bv-settings-reduced-motion #rpg-fx-particles {
    display: none !important;
}

body.bv-settings-performance #rpg-fx-particles,
body.bv-settings-performance .battle-fog,
body.bv-settings-performance .battle-deco,
body.bv-settings-performance .title-particles,
body.bv-settings-performance .splash-bg-canvas {
    display: none !important;
}

body.bv-settings-performance .battle-bg-layer,
body.bv-settings-performance .title-bg-shapes,
body.bv-settings-performance .title-light-rays {
    animation: none !important;
    filter: none !important;
}

@media (max-width: 680px) {
    #rpg-menu-screen .settings-grid { grid-template-columns: 1fr; }
}
</style>

<script>
/* ARENA FEATURE v7.8.1: Einstellungen-Menü */
(function () {
    'use strict';

    const DEFAULTS = {
        performance: 'balanced',
        particles: true,
        reducedMotion: false,
        fps: false,
        textSpeed: 'normal'
    };

    let settings = loadSettings();
    window.BV_SETTINGS = settings;

    function loadSettings() {
        try {
            return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('bv_settings') || '{}'));
        } catch (e) {
            return Object.assign({}, DEFAULTS);
        }
    }

    function saveSettings() {
        try { localStorage.setItem('bv_settings', JSON.stringify(settings)); } catch (e) {}
        window.BV_SETTINGS = settings;
    }

    function applySettings() {
        document.body.classList.toggle('bv-settings-reduced-motion', !!settings.reducedMotion);
        document.body.classList.toggle('bv-settings-performance', settings.performance === 'performance');

        const gameWin = document.getElementById('rpg-game-window');
        if (gameWin) {
            const lowFx = !settings.particles || settings.performance === 'performance';
            gameWin.classList.toggle('map-low-quality', lowFx);
        }

        updateFPSVisibility();
        renderSettingsPanel();
    }

    function setSetting(key, value) {
        settings[key] = value;
        saveSettings();
        applySettings();
    }

    function ensureSettingsTab() {
        const tabs = document.querySelector('#rpg-menu-screen .menu-tabs');
        const body = document.querySelector('#rpg-menu-screen .menu-body');
        if (!tabs || !body || document.getElementById('tab-settings')) return;

        const btn = document.createElement('button');
        btn.className = 'menu-tab';
        btn.dataset.tab = 'settings';
        btn.innerHTML = '⚙️ Optionen';
        tabs.appendChild(btn);

        const content = document.createElement('div');
        content.className = 'menu-tab-content';
        content.id = 'tab-settings';
        content.innerHTML = '<div id="menu-settings-content"></div>';
        body.appendChild(content);

        btn.addEventListener('click', () => {
            const oldContent = document.querySelector('.menu-tab-content.active');
            const menuScreen = document.getElementById('rpg-menu-screen');
            document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.menu-tab-content').forEach(c => c.classList.remove('active', 'menu-window-switch-out', 'menu-window-switch-in'));
            btn.classList.add('active');
            content.classList.add('active', 'menu-window-switch-in');
            if (oldContent && oldContent !== content) oldContent.classList.add('menu-window-switch-out');
            if (menuScreen) {
                menuScreen.classList.remove('menu-status-mode','menu-inventory-mode','menu-team-mode','menu-map-mode','menu-quest-mode','menu-achievement-mode','menu-skills-mode');
                menuScreen.classList.add('menu-status-mode');
            }
            renderSettingsPanel();
        });
    }

    function toggleHtml(key, label, desc) {
        return `
            <div class="setting-card">
                <div class="setting-title">${label}</div>
                <div class="setting-desc">${desc}</div>
                <div class="setting-control"><span>${settings[key] ? 'An' : 'Aus'}</span><button class="setting-toggle ${settings[key] ? 'on' : ''}" data-setting-toggle="${key}" type="button"></button></div>
            </div>
        `;
    }

    function renderSettingsPanel() {
        const host = document.getElementById('menu-settings-content') || document.querySelector('#tab-settings #settings-content');
        if (!host) return;
        host.innerHTML = `
            <div class="settings-panel">
                <div class="settings-hero">
                    <div class="settings-hero-icon">⚙️</div>
                    <div>
                        <h3>Spiel-Einstellungen</h3>
                        <p>Performance, Partikel, FPS-Counter und Texttempo direkt im Spiel steuern.</p>
                    </div>
                </div>
                <div class="settings-grid">
                    <div class="setting-card">
                        <div class="setting-title">🚀 Performance-Profil</div>
                        <div class="setting-desc">Performance reduziert teure Hintergrundeffekte, ohne Gameplay zu entfernen.</div>
                        <select class="setting-select" data-setting-select="performance">
                            <option value="high" ${settings.performance === 'high' ? 'selected' : ''}>Hoch / Schön</option>
                            <option value="balanced" ${settings.performance === 'balanced' ? 'selected' : ''}>Ausgewogen</option>
                            <option value="performance" ${settings.performance === 'performance' ? 'selected' : ''}>Performance</option>
                        </select>
                    </div>
                    ${toggleHtml('particles', '✨ Partikel', 'Schaltet Map-/Hintergrundpartikel ein oder aus.')}
                    ${toggleHtml('reducedMotion', '🎞️ Reduzierte Hintergrundanimationen', 'Blendet nicht notwendige Ambient-Animationen aus.')}
                    ${toggleHtml('fps', '📊 FPS-Counter', 'Zeigt FPS und Framezeit oben links an.')}
                    <div class="setting-card">
                        <div class="setting-title">💬 Textgeschwindigkeit</div>
                        <div class="setting-desc">Bestimmt, wie lange Dialogtext wartet, bevor Enter weitergeht.</div>
                        <select class="setting-select" data-setting-select="textSpeed">
                            <option value="slow" ${settings.textSpeed === 'slow' ? 'selected' : ''}>Langsam</option>
                            <option value="normal" ${settings.textSpeed === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="fast" ${settings.textSpeed === 'fast' ? 'selected' : ''}>Schnell</option>
                            <option value="instant" ${settings.textSpeed === 'instant' ? 'selected' : ''}>Fast sofort</option>
                        </select>
                    </div>
                    <div class="setting-card">
                        <div class="setting-title">♻️ Zurücksetzen</div>
                        <div class="setting-desc">Setzt alle Optionen auf Standard zurück.</div>
                        <button class="setting-button" data-settings-reset type="button">Standard wiederherstellen</button>
                    </div>
                </div>
            </div>
        `;

        host.querySelectorAll('[data-setting-toggle]').forEach(btn => {
            btn.addEventListener('click', () => setSetting(btn.dataset.settingToggle, !settings[btn.dataset.settingToggle]));
        });
        host.querySelectorAll('[data-setting-select]').forEach(sel => {
            sel.addEventListener('change', () => setSetting(sel.dataset.settingSelect, sel.value));
        });
        host.querySelector('[data-settings-reset]')?.addEventListener('click', () => {
            settings = Object.assign({}, DEFAULTS);
            saveSettings();
            applySettings();
        });
        if (typeof window.parseEmojis === 'function') window.parseEmojis(host);
    }

    // FPS Counter
    let fpsEl = null, frames = 0, lastFrame = performance.now(), lastUpdate = performance.now(), fps = 0, ms = 0;
    function ensureFPSCounter() {
        if (fpsEl) return fpsEl;
        fpsEl = document.createElement('div');
        fpsEl.id = 'bv-fps-counter-settings';
        fpsEl.innerHTML = '<div class="fps-row fps-main"><span>FPS</span><span id="bv-set-fps">--</span></div><div class="fps-row"><span>Frame</span><span id="bv-set-ms">-- ms</span></div><div class="fps-row"><span>F2</span><span>Toggle</span></div>';
        document.body.appendChild(fpsEl);
        return fpsEl;
    }

    function rpgOpen() {
        const overlay = document.getElementById('rpg-overlay');
        return !!(overlay && (overlay.classList.contains('open') || overlay.classList.contains('opening')));
    }

    function updateFPSVisibility() {
        const el = ensureFPSCounter();
        el.classList.toggle('visible', !!settings.fps && rpgOpen());
    }

    function fpsTick(now) {
        ms = now - lastFrame;
        lastFrame = now;
        frames++;
        if (now - lastUpdate >= 500) {
            fps = frames * 1000 / (now - lastUpdate);
            frames = 0;
            lastUpdate = now;
            const el = ensureFPSCounter();
            el.classList.remove('warn','bad');
            if (fps < 30 || ms > 33) el.classList.add('bad');
            else if (fps < 50 || ms > 20) el.classList.add('warn');
            const f = document.getElementById('bv-set-fps');
            const m = document.getElementById('bv-set-ms');
            if (f) f.textContent = String(Math.round(fps));
            if (m) m.textContent = ms.toFixed(1) + ' ms';
            updateFPSVisibility();
        }
        requestAnimationFrame(fpsTick);
    }

    function wrapOpenMenu() {
        const original = window.openMenu;
        if (typeof original !== 'function' || original._settingsWrapped) return;
        window.openMenu = function() {
            const result = original.apply(this, arguments);
            setTimeout(() => { ensureSettingsTab(); renderSettingsPanel(); applySettings(); }, 40);
            return result;
        };
        window.openMenu._settingsWrapped = true;
    }

    document.addEventListener('keydown', e => {
        if (e.key === 'F2') {
            e.preventDefault();
            setSetting('fps', !settings.fps);
        }
    });

    window.BVSettings = { get: () => settings, set: setSetting, apply: applySettings, ensureTab: ensureSettingsTab };

    function initSettings() {
        ensureSettingsTab();
        renderSettingsPanel();
        applySettings();
        wrapOpenMenu();
        requestAnimationFrame(fpsTick);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSettings, { once: true });
    } else {
        initSettings();
    }
})();
</script>


<style>
/* ============================================================
   ARENA FEATURE v7.8.2: Tages-/Schicht-System
   ============================================================ */
#bv-shift-hud {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(140,205,255,.28);
    background: linear-gradient(145deg, rgba(10,22,46,.72), rgba(5,12,28,.62));
    color: #dbeeff;
    font-family: 'VT323', monospace;
    font-size: .95rem;
    box-shadow: 0 8px 20px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.08);
    pointer-events: auto;
}

#bv-shift-hud .shift-icon { font-size: 1.05rem; }
#bv-shift-hud .shift-text { white-space: nowrap; }
#bv-shift-hud .shift-mini-bar {
    width: 46px;
    height: 5px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(0,0,0,.32);
    border: 1px solid rgba(255,255,255,.08);
}
#bv-shift-hud .shift-mini-fill {
    height: 100%;
    width: var(--shift-progress, 0%);
    border-radius: inherit;
    background: linear-gradient(90deg, #4a9fff, #ffd166);
    box-shadow: 0 0 10px rgba(255,209,102,.35);
}

#bv-shift-overlay {
    position: absolute;
    inset: 0;
    z-index: 14;
    pointer-events: none;
    opacity: 0;
    transition: opacity .8s ease, background .8s ease;
    mix-blend-mode: soft-light;
}

#rpg-game-window.shift-morning #bv-shift-overlay {
    opacity: .20;
    background: linear-gradient(180deg, rgba(255,226,150,.30), rgba(74,159,255,.10));
}
#rpg-game-window.shift-midday #bv-shift-overlay {
    opacity: .16;
    background: radial-gradient(circle at 50% 10%, rgba(255,255,210,.45), rgba(255,220,120,.10) 42%, transparent 72%);
}
#rpg-game-window.shift-afternoon #bv-shift-overlay {
    opacity: .22;
    background: linear-gradient(180deg, rgba(255,170,80,.22), rgba(255,120,80,.12));
}
#rpg-game-window.shift-closing #bv-shift-overlay {
    opacity: .28;
    background: linear-gradient(180deg, rgba(80,70,180,.20), rgba(20,10,50,.32));
}

.bv-shift-toast {
    position: absolute;
    left: 50%;
    top: 82px;
    transform: translateX(-50%) translateY(-12px) scale(.96);
    z-index: 100090;
    pointer-events: none;
    padding: 10px 16px;
    border-radius: 14px;
    border: 1px solid rgba(140,205,255,.34);
    background: linear-gradient(145deg, rgba(5,12,28,.92), rgba(10,22,46,.88));
    color: #e8f2ff;
    font-family: 'VT323', monospace;
    font-size: 1.08rem;
    box-shadow: 0 14px 34px rgba(0,0,0,.42), 0 0 22px rgba(74,159,255,.16);
    opacity: 0;
    animation: bvShiftToastIn 2.25s cubic-bezier(.16,1,.36,1) forwards;
}

@keyframes bvShiftToastIn {
    0% { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(.96); filter: blur(3px); }
    12% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0); }
    78% { opacity: 1; }
    100% { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(.98); filter: blur(2px); }
}

#rpg-menu-screen .shift-panel {
    display: grid;
    gap: 12px;
    padding: 14px;
}

#rpg-menu-screen .shift-clock-card {
    display: grid;
    grid-template-columns: 62px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 14px;
    border-radius: 18px;
    background:
        radial-gradient(circle at 8% 0%, rgba(255,209,102,.16), transparent 38%),
        linear-gradient(145deg, rgba(255,255,255,.075), rgba(0,0,0,.18));
    border: 1px solid rgba(255,209,102,.18);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.08);
}

#rpg-menu-screen .shift-big-icon {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    font-size: 2.35rem;
    background: rgba(0,0,0,.24);
    border: 1px solid rgba(255,255,255,.12);
}

#rpg-menu-screen .shift-title {
    margin: 0;
    color: #fff;
    font-size: 1.2rem;
}

#rpg-menu-screen .shift-subtitle {
    margin-top: 3px;
    color: rgba(210,230,255,.68);
    font-size: .9rem;
}

#rpg-menu-screen .shift-day-pill {
    padding: 7px 11px;
    border-radius: 999px;
    color: #ffd166;
    background: rgba(255,209,102,.10);
    border: 1px solid rgba(255,209,102,.26);
    white-space: nowrap;
}

#rpg-menu-screen .shift-progress-card {
    padding: 12px;
    border-radius: 16px;
    background: rgba(0,0,0,.18);
    border: 1px solid rgba(255,255,255,.10);
}

#rpg-menu-screen .shift-progress-top {
    display: flex;
    justify-content: space-between;
    color: rgba(230,240,255,.82);
    font-size: .9rem;
    margin-bottom: 7px;
}

#rpg-menu-screen .shift-progress-bar {
    height: 12px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(0,0,0,.32);
    border: 1px solid rgba(255,255,255,.08);
}

#rpg-menu-screen .shift-progress-fill {
    height: 100%;
    width: var(--shift-progress, 0%);
    background: linear-gradient(90deg, #4a9fff, #a855f7, #ffd166);
    box-shadow: 0 0 14px rgba(255,209,102,.34);
    transition: width .45s cubic-bezier(.16,1,.36,1);
}

#rpg-menu-screen .shift-effect-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
}

#rpg-menu-screen .shift-effect-card {
    padding: 12px;
    border-radius: 16px;
    background: linear-gradient(145deg, rgba(255,255,255,.06), rgba(0,0,0,.18));
    border: 1px solid rgba(255,255,255,.11);
}

#rpg-menu-screen .shift-effect-title {
    color: #fff;
    font-size: 1rem;
    margin-bottom: 4px;
}

#rpg-menu-screen .shift-effect-desc {
    color: rgba(210,230,255,.68);
    font-size: .82rem;
    line-height: 1.25;
}

#rpg-menu-screen .shift-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

#rpg-menu-screen .shift-btn {
    flex: 1;
    min-width: 160px;
    padding: 10px 14px;
    border-radius: 14px;
    border: 1px solid rgba(140,205,255,.28);
    background: linear-gradient(135deg, rgba(74,159,255,.22), rgba(168,85,247,.16));
    color: #dbeeff;
    font-family: 'VT323', monospace;
    font-size: 1.05rem;
    cursor: pointer;
    transition: transform .18s ease, filter .18s ease;
}

#rpg-menu-screen .shift-btn:hover {
    transform: translateY(-2px);
    filter: brightness(1.15);
}

@media (max-width: 680px) {
    #rpg-menu-screen .shift-clock-card { grid-template-columns: 50px 1fr; }
    #rpg-menu-screen .shift-day-pill { grid-column: 2; justify-self: start; }
    #rpg-menu-screen .shift-effect-grid { grid-template-columns: 1fr; }
}
</style>

<script>
/* ARENA FEATURE v7.8.2: Tages-/Schicht-System */
(function () {
    'use strict';

    const PHASES = [
        { id: 'morning', cls: 'shift-morning', icon: '🌅', name: 'Morgen', time: '08:00', effect: 'Frischer Start', desc: 'Gute Zeit für Gespräche und neue Aufgaben.' },
        { id: 'midday', cls: 'shift-midday', icon: '☀️', name: 'Mittag', time: '12:00', effect: 'Pausenzeit', desc: 'Kantine und Kaffee wirken jetzt besonders passend.' },
        { id: 'afternoon', cls: 'shift-afternoon', icon: '🌇', name: 'Nachmittag', time: '15:00', effect: 'Produktivitätsdruck', desc: 'Gegner und Aufgaben fühlen sich aktiver an.' },
        { id: 'closing', cls: 'shift-closing', icon: '🌙', name: 'Feierabend', time: '18:00', effect: 'Ruhiger Abschluss', desc: 'Dunklere Stimmung, perfekt für Geheimnisse und Bosswege.' }
    ];

    const PHASE_DURATION = 120000; // 2 Minuten pro Phase: etwas schneller, aber nicht hektisch
    let interval = null;
    let quietSince = 0; // pausiert die Schichtzeit während Battle/Dialog/Cutscene

    function playerObj() {
        return (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : (window.player || {});
    }

    function ensureState() {
        const p = playerObj();
        if (!p.shiftState) p.shiftState = { day: 1, phaseIndex: 0, phaseStartedAt: Date.now(), totalPhaseAdvances: 0 };
        if (typeof p.shiftState.day !== 'number') p.shiftState.day = 1;
        if (typeof p.shiftState.phaseIndex !== 'number') p.shiftState.phaseIndex = 0;
        if (!p.shiftState.phaseStartedAt) p.shiftState.phaseStartedAt = Date.now();
        return p.shiftState;
    }

    function currentPhase() {
        const st = ensureState();
        return PHASES[st.phaseIndex % PHASES.length];
    }

    function progress() {
        const st = ensureState();
        return Math.max(0, Math.min(1, (Date.now() - st.phaseStartedAt) / PHASE_DURATION));
    }

    function phaseRemainingSeconds() {
        return Math.max(0, Math.ceil((PHASE_DURATION - (Date.now() - ensureState().phaseStartedAt)) / 1000));
    }

    function ensureHud() {
        const center = document.querySelector('#rpg-hud .hud-center');
        if (!center || document.getElementById('bv-shift-hud')) return;
        const el = document.createElement('div');
        el.id = 'bv-shift-hud';
        el.innerHTML = '<span class="shift-icon">🌅</span><span class="shift-text">Morgen</span><span class="shift-mini-bar"><span class="shift-mini-fill"></span></span>';
        center.appendChild(el);
    }

    function ensureOverlay() {
        const gw = document.getElementById('rpg-game-window');
        if (!gw || document.getElementById('bv-shift-overlay')) return;
        const overlay = document.createElement('div');
        overlay.id = 'bv-shift-overlay';
        gw.appendChild(overlay);
    }

    function showShiftToast(text) {
        const gw = document.getElementById('rpg-game-window');
        if (!gw) return;
        const old = gw.querySelector('.bv-shift-toast');
        if (old) old.remove();
        const toast = document.createElement('div');
        toast.className = 'bv-shift-toast';
        // Kein störendes "Nachmittag beginnt..."-Fenster während Battle, Dialogen oder Cutscenes.
        const rt = (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
        const blockedStates = ['BATTLE','BATTLE_INTRO','CUTSCENE','MESSAGE','CHOICE','TRANSITION'];
        if (blockedStates.includes(rt.gameState)) return;
        toast.textContent = text;
        gw.appendChild(toast);
        if (typeof window.parseEmojis === 'function') window.parseEmojis(toast);
        setTimeout(() => toast.remove(), 2300);
    }

    let _lastPhaseCls = '';
    function applyPhaseClasses() {
        const gw = document.getElementById('rpg-game-window');
        if (!gw) return;
        const cls = currentPhase().cls;
        if (cls === _lastPhaseCls) return;
        PHASES.forEach(p => gw.classList.remove(p.cls));
        gw.classList.add(cls);
        _lastPhaseCls = cls;
    }

    function updateUI() {
        ensureHud();
        ensureOverlay();
        applyPhaseClasses();
        const p = currentPhase();
        const pct = Math.round(progress() * 100);
        const hud = document.getElementById('bv-shift-hud');
        if (hud) {
            const iconEl = hud.querySelector('.shift-icon');
            if (iconEl && iconEl.dataset.phaseIcon !== p.icon) {
                iconEl.dataset.phaseIcon = p.icon;
                iconEl.textContent = p.icon;
                // Emoji nicht als simples System-Emoji lassen: vorhandenes Emoji/Twemoji-Script nutzen.
                if (typeof window.parseEmojis === 'function') window.parseEmojis(iconEl);
            }
            hud.querySelector('.shift-text').textContent = `${p.name} ${p.time}`;
            hud.style.setProperty('--shift-progress', pct + '%');
            const miniFill = hud.querySelector('.shift-mini-fill');
            if (miniFill) miniFill.style.width = pct + '%';
        }
        renderShiftPanel();
    }

    function advancePhase(manual = false) {
        const st = ensureState();
        st.phaseIndex = (st.phaseIndex + 1) % PHASES.length;
        st.phaseStartedAt = Date.now();
        st.totalPhaseAdvances = (st.totalPhaseAdvances || 0) + 1;
        if (st.phaseIndex === 0) st.day++;
        const p = currentPhase();
        updateUI();
        showShiftToast(`${p.icon} ${p.name} beginnt (${p.time})${manual ? ' • vorgespult' : ''}`);
    }

    function tick() {
        const rt = (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
        const activeStates = ['MAP', 'MENU', 'SHOP', 'SKILLSHOP'];
        const quietStates = ['BATTLE','BATTLE_INTRO','CUTSCENE','MESSAGE','CHOICE','TRANSITION'];
        if (quietStates.includes(rt.gameState)) {
            if (!quietSince) quietSince = Date.now();
            updateUI();
            return;
        }
        if (quietSince) {
            // Battle-/Cutscene-Zeit zählt nicht gegen die Schicht, damit kein Toast direkt in/aus Szenen platzt.
            ensureState().phaseStartedAt += Date.now() - quietSince;
            quietSince = 0;
        }
        if (!activeStates.includes(rt.gameState)) { updateUI(); return; }
        if (progress() >= 1) advancePhase(false);
        else updateUI();
    }

    function ensureShiftTab() {
        const tabs = document.querySelector('#rpg-menu-screen .menu-tabs');
        const body = document.querySelector('#rpg-menu-screen .menu-body');
        if (!tabs || !body || document.getElementById('tab-shift')) return;
        const btn = document.createElement('button');
        btn.className = 'menu-tab';
        btn.dataset.tab = 'shift';
        btn.innerHTML = '🕒 Schicht';
        tabs.appendChild(btn);
        if (typeof window.parseEmojis === 'function') window.parseEmojis(btn);
        const content = document.createElement('div');
        content.className = 'menu-tab-content';
        content.id = 'tab-shift';
        content.innerHTML = '<div id="shift-content"></div>';
        body.appendChild(content);
        btn.addEventListener('click', () => {
            const oldContent = document.querySelector('.menu-tab-content.active');
            const menuScreen = document.getElementById('rpg-menu-screen');
            document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.menu-tab-content').forEach(c => c.classList.remove('active', 'menu-window-switch-out', 'menu-window-switch-in'));
            btn.classList.add('active');
            content.classList.add('active', 'menu-window-switch-in');
            if (oldContent && oldContent !== content) oldContent.classList.add('menu-window-switch-out');
            if (menuScreen) {
                menuScreen.classList.remove('menu-status-mode','menu-inventory-mode','menu-team-mode','menu-map-mode','menu-quest-mode','menu-achievement-mode','menu-skills-mode');
                menuScreen.classList.add('menu-status-mode');
            }
            renderShiftPanel();
        });
    }

    var _lastShiftRenderKey = '';
    function renderShiftPanel() {
        const host = document.getElementById('shift-content');
        const tab = document.getElementById('tab-shift');
        const menuScreen = document.getElementById('rpg-menu-screen');
        if (!host || !tab || !tab.classList.contains('active') || !menuScreen || !menuScreen.classList.contains('active')) return;
        const st = ensureState();
        const p = currentPhase();
        const pct = Math.round(progress() * 100);
        const remain = phaseRemainingSeconds();
        const renderKey = st.day + ':' + st.phaseIndex + ':' + pct + ':' + remain;
        if (renderKey === _lastShiftRenderKey) return;
        _lastShiftRenderKey = renderKey;
        const next = PHASES[(st.phaseIndex + 1) % PHASES.length];
        host.innerHTML = `
            <div class="shift-panel">
                <div class="shift-clock-card">
                    <div class="shift-big-icon">${p.icon}</div>
                    <div>
                        <h3 class="shift-title">${p.name} • ${p.time}</h3>
                        <div class="shift-subtitle">Nächste Phase: ${next.icon} ${next.name} • in ca. ${remain}s</div>
                    </div>
                    <div class="shift-day-pill">Tag ${st.day}</div>
                </div>
                <div class="shift-progress-card">
                    <div class="shift-progress-top"><span>Schichtfortschritt</span><span>${pct}%</span></div>
                    <div class="shift-progress-bar"><div class="shift-progress-fill" style="--shift-progress:${pct}%;width:${pct}%"></div></div>
                </div>
                <div class="shift-effect-grid">
                    <div class="shift-effect-card"><div class="shift-effect-title">${p.icon} ${p.effect}</div><div class="shift-effect-desc">${p.desc}</div></div>
                    <div class="shift-effect-card"><div class="shift-effect-title">📋 System-Hinweis</div><div class="shift-effect-desc">Quests, NPC-Routinen und Cutscenes können später an diese Tagesphasen gebunden werden.</div></div>
                </div>
                <div class="shift-actions">
                    <button class="shift-btn" data-shift-next>⏩ Nächste Phase testen</button>
                    <button class="shift-btn" data-shift-reset>🌅 Neuer Tag</button>
                </div>
            </div>
        `;
        host.querySelector('[data-shift-next]')?.addEventListener('click', () => advancePhase(true));
        host.querySelector('[data-shift-reset]')?.addEventListener('click', () => {
            st.day++;
            st.phaseIndex = 0;
            st.phaseStartedAt = Date.now();
            updateUI();
            showShiftToast('🌅 Neuer Arbeitstag beginnt!');
        });
        if (typeof window.parseEmojis === 'function') window.parseEmojis(host);
    }

    function wrapOpenMenu() {
        const original = window.openMenu;
        if (typeof original !== 'function' || original._shiftWrapped) return;
        window.openMenu = function() {
            const result = original.apply(this, arguments);
            setTimeout(() => { ensureShiftTab(); renderShiftPanel(); updateUI(); }, 45);
            return result;
        };
        window.openMenu._shiftWrapped = true;
    }

    window.BVShiftSystem = { phases: PHASES, getState: ensureState, currentPhase, advance: () => advancePhase(true), updateUI };

    function initShiftSystem() {
        ensureState();
        ensureHud();
        ensureOverlay();
        ensureShiftTab();
        wrapOpenMenu();
        updateUI();
        if (interval) clearInterval(interval);
        interval = setInterval(tick, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShiftSystem, { once: true });
    } else {
        initShiftSystem();
    }
})();
</script>


<style>
/* ============================================================
   ARENA FEATURE v7.8.3: Skill-Upgrades
   ============================================================ */
.bv-skill-card.bv-skill-upgradable {
    cursor: pointer !important;
    border-color: rgba(255,209,102,.30) !important;
}

.bv-skill-card.bv-skill-upgradable:hover {
    border-color: rgba(255,209,102,.62) !important;
    box-shadow: 0 8px 30px rgba(255,209,102,.16), 0 0 0 1px rgba(255,209,102,.18) !important;
}

.bv-skill-card.bv-skill-maxed {
    border-color: rgba(68,255,136,.38) !important;
}

.bv-unlock-btn.upgrade {
    background: linear-gradient(135deg, rgba(255,209,102,.26), rgba(168,85,247,.22)) !important;
    border-color: rgba(255,209,102,.50) !important;
    color: #ffe8a3 !important;
}

.bv-skill-stat.level {
    background: rgba(255,209,102,.14) !important;
    border-color: rgba(255,209,102,.34) !important;
    color: #ffd166 !important;
}

.bv-skill-stat.upgrade {
    background: rgba(168,85,247,.14) !important;
    border-color: rgba(168,85,247,.30) !important;
    color: #d8b4fe !important;
}

.bv-skill-card.bv-skill-upgrade-burst {
    animation: bvSkillUpgradeBurstV783 1.35s cubic-bezier(.16,1.25,.36,1) both !important;
}

.skill-lv {
    display: inline-block;
    margin-left: 5px;
    padding: 1px 5px;
    border-radius: 999px;
    font-size: .68em;
    color: #ffd166;
    border: 1px solid rgba(255,209,102,.28);
    background: rgba(255,209,102,.10);
}

@keyframes bvSkillUpgradeBurstV783 {
    0% { transform: translateX(0) scale(1); filter: brightness(1); }
    24% { transform: translateX(8px) scale(1.035); filter: brightness(1.28); box-shadow: 0 0 34px rgba(255,209,102,.28); }
    58% { transform: translateX(-3px) scale(1.01); filter: brightness(1.12); }
    100% { transform: translateX(0) scale(1); filter: brightness(1); }
}
</style>




<style>
/* ============================================================
   ARENA HOTFIX v7.8.5: Quest/Schicht Tabs + Shift Toast + Cutscene Polish
   ============================================================ */
#rpg-menu-screen.menu-quest-mode .menu-window,
#rpg-menu-screen.menu-shift-mode .menu-window {
    width: min(760px, 94vw) !important;
    height: min(620px, 90vh) !important;
}

#rpg-menu-screen.menu-quest-mode .menu-body,
#rpg-menu-screen.menu-shift-mode .menu-body {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
}

/* Shift-Balken sichtbar robust */
#bv-shift-hud .shift-mini-fill,
#rpg-menu-screen .shift-progress-fill {
    display: block !important;
    min-width: 3px;
}

/* Feierabend/Morgen-Toast ohne Blur */
.bv-shift-toast {
    filter: none !important;
    animation: bvShiftToastNoBlurV785 2.8s cubic-bezier(.16,1,.36,1) forwards !important;
}
@keyframes bvShiftToastNoBlurV785 {
    0% { opacity: 0; transform: translateX(-50%) translateY(-12px) scale(.96); }
    12% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
    78% { opacity: 1; }
    100% { opacity: 0; transform: translateX(-50%) translateY(-10px) scale(.98); }
}

</style>



<style>
/* ============================================================
   ARENA UPDATE v7.8.7: echte Map-NPC-Cutscenes mit Tile-Bewegung
   ============================================================ */
#bv-real-cutscene-overlay {
    position: absolute;
    inset: 0;
    z-index: 100060;
    display: none;
    pointer-events: auto;
    background: rgba(0,0,0,0);
    font-family: 'VT323', monospace;
}
#bv-real-cutscene-overlay.active { display:block; animation: realCutFadeIn .25s ease-out both; }
#bv-real-cutscene-overlay.closing { animation: realCutFadeOut .22s ease-in forwards; }
.real-cut-bar { position:absolute; left:0; right:0; height:68px; background:rgba(0,0,0,.94); box-shadow:0 0 28px rgba(0,0,0,.7); pointer-events:none; }
.real-cut-bar.top { top:0; transform:translateY(-100%); animation:realCutBarTop .34s cubic-bezier(.16,1,.36,1) forwards; }
.real-cut-bar.bottom { bottom:0; transform:translateY(100%); animation:realCutBarBottom .34s cubic-bezier(.16,1,.36,1) forwards; }
.real-cut-dialog {
    position:absolute;
    left:50%; bottom:84px;
    width:min(760px, calc(100% - 42px));
    transform:translateX(-50%) translateY(16px);
    padding:14px 18px;
    border-radius:18px;
    background:linear-gradient(145deg, rgba(7,16,34,.97), rgba(11,30,58,.95));
    border:1px solid rgba(140,205,255,.38);
    box-shadow:0 18px 55px rgba(0,0,0,.66),0 0 24px rgba(74,159,255,.16),inset 0 1px 0 rgba(255,255,255,.10);
    color:#fff;
    pointer-events:auto;
    animation:realCutDialogIn .34s cubic-bezier(.16,1,.36,1) .1s both;
}
.real-cut-speaker { color:#8ec5ff; font-size:1.05rem; letter-spacing:.8px; margin-bottom:5px; }
.real-cut-text { font-size:1.26rem; line-height:1.25; min-height:42px; }
.real-cut-hint { margin-top:7px; text-align:right; color:rgba(210,230,255,.54); font-size:.82rem; }
.rpg-npc.real-cut-focus, #rpg-player.real-cut-focus { filter:drop-shadow(0 0 24px rgba(142,197,255,.9)) drop-shadow(0 8px 5px rgba(0,0,0,.32)) !important; }
.rpg-npc.real-cut-speaking { animation:realCutNpcTalk .55s ease-in-out infinite alternate !important; }
.rpg-npc.real-cut-walking, #rpg-player.real-cut-walking .sprite-body { animation:realCutNpcWalk .34s ease-in-out infinite alternate !important; }
@keyframes realCutFadeIn { from{opacity:0} to{opacity:1} }
@keyframes realCutFadeOut { from{opacity:1} to{opacity:0} }
@keyframes realCutBarTop { to{transform:translateY(0)} }
@keyframes realCutBarBottom { to{transform:translateY(0)} }
@keyframes realCutDialogIn { to{transform:translateX(-50%) translateY(0)} }
@keyframes realCutNpcTalk { from{transform:translateY(0) scale(1)} to{transform:translateY(-2px) scale(1.06)} }
@keyframes realCutNpcWalk { from{transform:translateY(0) rotate(-1deg)} to{transform:translateY(-4px) rotate(1deg)} }
#bv-real-cutscene-overlay {
    --cut-accent: #8ec5ff;
    --cut-accent-soft: rgba(142,197,255,.22);
    --cut-danger: #ff6b6b;
    --cut-good: #69f0ae;
    --cut-warn: #ffd166;
}
#bv-real-cutscene-overlay::before {
    content:'';
    position:absolute;
    inset:68px 0;
    pointer-events:none;
    background:
        radial-gradient(circle at var(--cut-focus-x,50%) var(--cut-focus-y,48%), var(--cut-accent-soft), transparent 34%),
        linear-gradient(120deg, rgba(255,255,255,.04), transparent 22%, rgba(255,255,255,.025) 60%, transparent);
    opacity:.95;
    animation: realCutSceneBreath 2.8s ease-in-out infinite alternate;
}
#bv-real-cutscene-overlay.mood-warn .real-cut-dialog { border-color:rgba(255,209,102,.55); box-shadow:0 18px 55px rgba(0,0,0,.66),0 0 28px rgba(255,209,102,.18),inset 0 1px 0 rgba(255,255,255,.10); }
#bv-real-cutscene-overlay.mood-danger .real-cut-dialog { border-color:rgba(255,107,107,.58); box-shadow:0 18px 55px rgba(0,0,0,.66),0 0 30px rgba(255,107,107,.20),inset 0 1px 0 rgba(255,255,255,.10); }
#bv-real-cutscene-overlay.mood-good .real-cut-dialog { border-color:rgba(105,240,174,.55); box-shadow:0 18px 55px rgba(0,0,0,.66),0 0 30px rgba(105,240,174,.18),inset 0 1px 0 rgba(255,255,255,.10); }
.real-cut-speaker { color:var(--cut-accent) !important; text-shadow:0 0 14px var(--cut-accent-soft); }
.real-cut-text { animation: realCutTextPop .22s ease-out both; }
.real-cut-dialog::after {
    content:'';
    position:absolute;
    left:14px; right:14px; top:0;
    height:1px;
    background:linear-gradient(90deg, transparent, var(--cut-accent), transparent);
    opacity:.72;
}
.real-cut-choices {
    display:none;
    grid-template-columns:1fr;
    gap:8px;
    margin-top:12px;
}
.real-cut-choices.visible { display:grid; animation:realCutChoiceBoxIn .2s ease-out both; }
.real-cut-choice {
    border:1px solid rgba(255,255,255,.14);
    background:linear-gradient(135deg, rgba(255,255,255,.075), rgba(255,255,255,.035));
    color:#ecf7ff;
    border-radius:13px;
    padding:9px 12px;
    font-family:'VT323', monospace;
    font-size:1.05rem;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    cursor:pointer;
    transform:translateX(0);
    transition:transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
}
.real-cut-choice:hover,
.real-cut-choice.selected {
    transform:translateX(6px) scale(1.01);
    border-color:var(--cut-accent);
    background:linear-gradient(135deg, var(--cut-accent-soft), rgba(255,255,255,.06));
    box-shadow:0 0 18px var(--cut-accent-soft);
}
.real-cut-choice.good { border-color:rgba(105,240,174,.34); }
.real-cut-choice.warn { border-color:rgba(255,209,102,.34); }
.real-cut-choice.danger { border-color:rgba(255,107,107,.34); }
.real-cut-choice .choice-hint { opacity:.72; font-size:.92rem; }
.real-cut-hint.choice-hint-active { color:rgba(255,255,255,.76); }
#bv-real-cutscene-overlay.fx-shake .real-cut-dialog { animation:realCutShake .32s ease-in-out both; }
#bv-real-cutscene-overlay.fx-pop .real-cut-dialog { animation:realCutDialogIn .34s cubic-bezier(.16,1,.36,1) .1s both, realCutPopGlow .5s ease-out .18s both; }
@keyframes realCutSceneBreath { from{opacity:.65; filter:saturate(1)} to{opacity:1; filter:saturate(1.28)} }
@keyframes realCutTextPop { from{opacity:0; transform:translateY(5px)} to{opacity:1; transform:translateY(0)} }
@keyframes realCutChoiceBoxIn { from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:translateY(0)} }
@keyframes realCutShake { 0%,100%{transform:translateX(-50%) translateY(0)} 25%{transform:translateX(calc(-50% - 5px)) translateY(0)} 55%{transform:translateX(calc(-50% + 5px)) translateY(0)} 78%{transform:translateX(calc(-50% - 2px)) translateY(0)} }
@keyframes realCutPopGlow { 0%{filter:brightness(1)} 45%{filter:brightness(1.35)} 100%{filter:brightness(1)} }
</style>

<script>
/* ARENA UPDATE v7.8.7: echte Map-NPC-Cutscenes mit Tile-Bewegung */
(function () {
    'use strict';
    // Signal an ältere Cutscene-Overlays: Dieses neuere System übernimmt die Map-Intros.
    window.BVRealCutscenesPlanned = true;
    let overlay = null, playing = false, steps = [], index = 0, previousState = 'MAP', lastMap = '';
    // Cutscene-Race-Fix: Bewegungen sind async. Mehrfaches ENTER/Klicken durfte vorher
    // mehrere renderStep()-Läufe überlappen lassen und konnte Text, Fokus oder State zerstören.
    let renderBusy = false, queuedNext = false, renderToken = 0, endTimer = null, textboxHideTimer = null;
    let textReady = false;
    let lastAdvanceInputAt = 0;
    let currentAccent = '#8ec5ff', accentAnimFrame = null;
    // Entscheidungs-/Style-System für Cutscenes.
    let choiceMode = false, choiceIndex = 0, currentChoices = [];
    const BLOCKED = new Set([1,2,3,8,9,10,11,12,14,15,17,19,20,6,7]);

    function rt() { return (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {}; }
    function pObj() { return (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : (window.player || {}); }
    function npcs() { return rt().npcs || []; }
    function map() { return rt().currentMap || []; }
    function npcIndex(name) { return npcs().findIndex(n => n && n.name === name); }
    function npcEl(i) { return document.querySelector(`#rpg-npc-layer .rpg-npc[data-index="${i}"]`); }
    function playerEl() { return document.getElementById('rpg-player'); }

    function ensureOverlay() {
        if (overlay) return overlay;
        const host = document.getElementById('rpg-game-window') || document.body;
        overlay = document.createElement('div');
        overlay.id = 'bv-real-cutscene-overlay';
        overlay.innerHTML = '<div class="real-cut-bar top"></div><div class="real-cut-bar bottom"></div><div class="real-cut-dialog"><div class="real-cut-portrait-frame"><div class="real-cut-portrait">🎬</div></div><div class="real-cut-content"><div class="real-cut-speaker"></div><div class="real-cut-text"></div><div class="real-cut-choices"></div><div class="real-cut-hint">Klick / ENTER zum Fortfahren</div></div></div>';
        host.appendChild(overlay);
        overlay.addEventListener('click', next);
        return overlay;
    }

    function project(x, y, kind = 'npc') {
        const ME = window.MapEngineV6;
        const cam = document.getElementById('rpg-camera');
        if (ME && cam && cam.classList.contains('map-engine-v6')) {
            const pt = ME.project(x + 0.5, y + 0.5, 0.04);
            return { left: pt.x - 16, top: pt.y - 32, z: 100 + Math.floor((x + y) * 100) + (kind === 'player' ? 70 : kind === 'enemy' ? 65 : 60) };
        }
        return { left: x * 32, top: y * 32, z: 15 };
    }

    function canStand(x, y, ignoreNames = []) {
        const m = map();
        if (!m.length || y < 0 || x < 0 || y >= m.length || x >= (m[0]?.length || 0)) return false;
        if (BLOCKED.has(m[y][x])) return false;
        const player = pObj();
        if (!ignoreNames.includes('player') && player.x === x && player.y === y) return false;
        return !npcs().some(n => n && !ignoreNames.includes(n.name) && n.x === x && n.y === y);
    }

    function neighbors(node) {
        return [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy]) => ({ x: node.x + dx, y: node.y + dy }));
    }

    function pathfind(start, goals, ignoreNames = []) {
        const goalSet = new Set(goals.map(g => g.x + ',' + g.y));
        const q = [start], seen = new Set([start.x + ',' + start.y]), parent = new Map();
        while (q.length) {
            const cur = q.shift();
            const ck = cur.x + ',' + cur.y;
            if (goalSet.has(ck)) {
                const path = [cur];
                let p = parent.get(ck);
                while (p) { path.unshift(p); p = parent.get(p.x + ',' + p.y); }
                return path.slice(1);
            }
            for (const nb of neighbors(cur)) {
                const key = nb.x + ',' + nb.y;
                if (seen.has(key)) continue;
                if (!canStand(nb.x, nb.y, ignoreNames) && !goalSet.has(key)) continue;
                seen.add(key); parent.set(key, cur); q.push(nb);
            }
        }
        return [];
    }

    function setEntityPos(entity, x, y, ms = 220) {
        if (entity === 'player') {
            const pl = pObj(); const el = playerEl();
            pl.x = x; pl.y = y;
            const pp = project(x, y, 'player');
            if (el) { el.classList.add('real-cut-walking'); el.style.transition = `left ${ms}ms linear, top ${ms}ms linear`; el.style.left = pp.left + 'px'; el.style.top = pp.top + 'px'; el.style.zIndex = pp.z; }
            setTimeout(() => el?.classList.remove('real-cut-walking'), ms + 40);
            return;
        }
        const i = npcIndex(entity); if (i < 0) return;
        const arr = npcs(); const npc = arr[i]; const el = npcEl(i); if (!npc || !el) return;
        npc.x = x; npc.y = y;
        const pp = project(x, y, npc.type === 'enemy' ? 'enemy' : 'npc');
        el.classList.add('real-cut-walking'); el.style.transition = `left ${ms}ms linear, top ${ms}ms linear`; el.style.left = pp.left + 'px'; el.style.top = pp.top + 'px'; el.style.zIndex = pp.z;
        setTimeout(() => el.classList.remove('real-cut-walking'), ms + 40);
    }

    async function moveEntity(entity, target, opts = {}) {
        const speed = opts.speed || 230;
        const ignore = [entity];
        const start = entity === 'player' ? { x: pObj().x, y: pObj().y } : (() => { const n = npcs()[npcIndex(entity)]; return n ? {x:n.x, y:n.y} : null; })();
        if (!start) return;
        let goals = [];
        if (target.near === 'player') {
            const pl = pObj(); goals = neighbors(pl).filter(g => canStand(g.x, g.y, ignore));
        } else if (target.nearNpc) {
            const n = npcs()[npcIndex(target.nearNpc)]; if (!n) return; goals = neighbors(n).filter(g => canStand(g.x, g.y, ignore));
        } else goals = [{ x: target.x, y: target.y }];
        if (!goals.length) return;
        let path = pathfind(start, goals, ignore);
        // Fallback: wenn kein kompletter Pfad gefunden wurde, wenigstens einen sicheren Schritt Richtung Ziel versuchen.
        if (!path.length && goals.length) {
            const goal = goals[0];
            const candidates = [
                { x: start.x + Math.sign(goal.x - start.x), y: start.y },
                { x: start.x, y: start.y + Math.sign(goal.y - start.y) },
                { x: start.x - Math.sign(goal.x - start.x), y: start.y },
                { x: start.x, y: start.y - Math.sign(goal.y - start.y) }
            ].filter(c => (c.x !== start.x || c.y !== start.y) && canStand(c.x, c.y, ignore));
            if (candidates.length) path = [candidates[0]];
        }
        for (const step of path) {
            setEntityPos(entity, step.x, step.y, speed);
            if (opts.cameraFollow !== false && window.BVCameraBridge?.focusEntity) window.BVCameraBridge.focusEntity(entity, false);
            await new Promise(r => setTimeout(r, speed + 35));
        }
    }

    function clearFocus() { document.querySelectorAll('.real-cut-focus,.real-cut-speaking,.real-cut-walking').forEach(el => el.classList.remove('real-cut-focus','real-cut-speaking','real-cut-walking')); }
    function focus(name) {
        clearFocus();
        if (name === 'player') { playerEl()?.classList.add('real-cut-focus'); return; }
        const el = npcEl(npcIndex(name)); if (el) el.classList.add('real-cut-focus','real-cut-speaking');
    }

    function resolvePortrait(step) {
        if (step && step.portrait) return step.portrait;
        if (step && step.speaker === 'System') return '📋';
        if (step && step.speaker) {
            const n = npcs()[npcIndex(step.speaker)];
            if (n && n.sprite) return n.sprite;
        }
        if (step && step.focus === 'player') return pObj().sprite || '🧑‍💼';
        return '🎬';
    }

    function clearCutsceneText() {
        if (!overlay) return;
        const speaker = overlay.querySelector('.real-cut-speaker');
        const text = overlay.querySelector('.real-cut-text');
        const portrait = overlay.querySelector('.real-cut-portrait');
        const choices = overlay.querySelector('.real-cut-choices');
        const hint = overlay.querySelector('.real-cut-hint');
        if (speaker) speaker.textContent = '';
        if (text) text.textContent = '';
        if (portrait) portrait.textContent = '';
        if (choices) { choices.classList.remove('visible'); choices.innerHTML = ''; }
        if (hint) { hint.textContent = ''; hint.classList.remove('choice-hint-active'); }
    }

    function setCutsceneTextboxVisible(visible, moving = false) {
        const ov = ensureOverlay();
        clearTimeout(textboxHideTimer);
        if (visible) {
            ov.classList.remove('textbox-hidden', 'textbox-moving', 'textbox-fading-out');
            // Reflow, damit die Öffnungsanimation bei jedem neuen Text wirklich neu startet.
            void ov.offsetWidth;
            ov.classList.add('textbox-visible');
            return;
        }
        if (ov.classList.contains('textbox-visible')) {
            // Sanft ausblenden: nicht sofort hidden setzen, sonst sieht man keinen Fade.
            ov.classList.remove('textbox-visible');
            ov.classList.add('textbox-fading-out');
            if (moving) ov.classList.add('textbox-moving');
            textboxHideTimer = setTimeout(() => {
                ov.classList.remove('textbox-fading-out', 'textbox-moving');
                ov.classList.add('textbox-hidden');
            }, 240);
        } else {
            ov.classList.remove('textbox-visible', 'textbox-fading-out');
            ov.classList.toggle('textbox-moving', !!moving);
            ov.classList.add('textbox-hidden');
        }
    }

    function normalizeHex(hex, fallback = '#8ec5ff') {
        const h = String(hex || '').trim();
        return /^#[0-9a-f]{6}$/i.test(h) ? h : fallback;
    }

    function lerp(a,b,t){ return Math.round(a + (b-a) * t); }
    function hexParts(hex) {
        const h = normalizeHex(hex).slice(1);
        return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
    }
    function mixHex(a, b, t) {
        const A = hexParts(a), B = hexParts(b);
        return '#' + [lerp(A[0],B[0],t), lerp(A[1],B[1],t), lerp(A[2],B[2],t)].map(v => v.toString(16).padStart(2,'0')).join('');
    }
    function animateAccent(to, softAlpha = .22) {
        const ov = ensureOverlay();
        const from = normalizeHex(currentAccent);
        const target = normalizeHex(to, from);
        cancelAnimationFrame(accentAnimFrame);
        const start = performance.now();
        const dur = 360;
        function frame(now) {
            const t = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - t, 3);
            const col = mixHex(from, target, eased);
            ov.style.setProperty('--cut-accent', col);
            ov.style.setProperty('--cut-accent-soft', hexToRgba(col, softAlpha));
            if (t < 1) accentAnimFrame = requestAnimationFrame(frame);
            else currentAccent = target;
        }
        accentAnimFrame = requestAnimationFrame(frame);
    }

    function applyStepStyle(step) {
        const ov = ensureOverlay();
        const accent = step.accent || (step.mood === 'danger' ? '#ff6b6b' : step.mood === 'warn' ? '#ffd166' : step.mood === 'good' ? '#69f0ae' : '#8ec5ff');
        animateAccent(accent, step.accentAlpha || .22);
        ov.style.setProperty('--cut-focus-x', step.focusX || step.cx || '50%');
        ov.style.setProperty('--cut-focus-y', step.focusY || step.cy || '48%');
        ov.classList.remove('mood-warn','mood-danger','mood-good','fx-shake','fx-pop','fx-flash','fx-zoom','fx-sparkle','fx-dim');
        const effect = step.effect || step.anim || ((!String(step.fx || '').includes('%')) ? step.fx : '');
        if (step.mood) ov.classList.add('mood-' + step.mood);
        if (effect) ov.classList.add('fx-' + effect);
        if (effect) setTimeout(() => ov.classList.remove('fx-' + effect), 420);
    }

    function hexToRgba(hex, alpha) {
        const h = String(hex || '').replace('#','');
        if (!/^[0-9a-f]{6}$/i.test(h)) return 'rgba(142,197,255,' + alpha + ')';
        const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function renderCutsceneRichText(text) {
        const esc = String(text || '').replace(/[&<>]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[ch]));
        return esc
            .replace(/\*\*(.+?)\*\*/g, '<span class="rich-bold">$1</span>')
            .replace(/\b(\+\d+\s?(?:Gold|EXP|HP|MP|Max HP|Max MP))\b/g, '<span class="rich-good">$1</span>')
            .replace(/(Achtung|Wichtig|Tipp|Hinweis|Quest|Aufgabe)/gi, '<span class="rich-warn">$1</span>')
            .replace(/(Fehler|verloren|besiegt|Gift|Schaden|Stress|Telefonterror)/gi, '<span class="rich-bad">$1</span>');
    }

    function renderChoices(step) {
        const ov = ensureOverlay();
        const box = ov.querySelector('.real-cut-choices');
        const hint = ov.querySelector('.real-cut-hint');
        currentChoices = Array.isArray(step.choices) ? step.choices : [];
        choiceMode = currentChoices.length > 0;
        choiceIndex = Math.max(0, Math.min(choiceIndex, currentChoices.length - 1));
        if (!box) return;
        if (!choiceMode) {
            box.classList.remove('visible');
            box.innerHTML = '';
            if (hint) { hint.textContent = 'Klick / ENTER zum Fortfahren'; hint.classList.remove('choice-hint-active'); }
            return;
        }
        if (hint) { hint.textContent = '↑/↓ wählen • ENTER bestätigen • Klick möglich'; hint.classList.add('choice-hint-active'); }
        box.innerHTML = currentChoices.map((c, i) => `<button type="button" class="real-cut-choice ${c.kind || c.color || ''} ${i === choiceIndex ? 'selected' : ''}" data-choice-index="${i}"><span>${c.label || ('Option ' + (i + 1))}</span><span class="choice-hint">${c.hint || (i === 0 ? 'ENTER' : '')}</span></button>`).join('');
        box.classList.add('visible');
        box.querySelectorAll('.real-cut-choice').forEach(btn => {
            btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); selectChoice(Number(btn.dataset.choiceIndex || 0)); });
            btn.addEventListener('mouseenter', () => { choiceIndex = Number(btn.dataset.choiceIndex || 0); updateChoiceSelection(); });
        });
    }

    function updateChoiceSelection() {
        ensureOverlay().querySelectorAll('.real-cut-choice').forEach((b, i) => b.classList.toggle('selected', i === choiceIndex));
    }

    function selectChoice(i = choiceIndex) {
        if (!choiceMode || !currentChoices.length) return;
        const choice = currentChoices[Math.max(0, Math.min(i, currentChoices.length - 1))];
        choiceMode = false;
        currentChoices = [];
        if (typeof choice.onSelect === 'function') { try { choice.onSelect(); } catch (e) { console.warn('[BV Cutscene] choice callback failed', e); } }
        if (choice.setFlag) {
            const pl = pObj(); pl.cutscenes = pl.cutscenes || {}; pl.cutscenes[choice.setFlag] = choice.value ?? true;
        }
        if (typeof choice.next === 'number') index = choice.next;
        else if (choice.nextId) {
            const ni = steps.findIndex(st => st && st.id === choice.nextId);
            index = ni >= 0 ? ni : index + 1;
        } else index++;
        renderStep();
    }

    function resolveCameraTarget(step) {
        if (!step) return null;
        if (step.cameraTarget && typeof step.cameraTarget.x === 'number') return { type:'tile', x: step.cameraTarget.x, y: step.cameraTarget.y, snap: !!step.cameraSnap };
        const mode = step.camera || step.cam || 'focus';
        if (mode === 'none') return null;
        if (mode === 'player') return { type:'entity', name:'player', snap: !!step.cameraSnap };
        if (mode === 'speaker') return { type:'entity', name: step.speaker, snap: !!step.cameraSnap };
        if (mode === 'boss') return { type:'entity', name:'Der Geschäftsführer', snap: !!step.cameraSnap };
        const name = step.focus || step.speaker || 'player';
        return { type:'entity', name, snap: !!step.cameraSnap };
    }

    function applyCutsceneCamera(step, snapOverride = null) {
        const bridge = window.BVCameraBridge;
        if (!bridge) return;
        const t = resolveCameraTarget(step);
        if (!t) return;
        const snap = snapOverride === null ? !!t.snap : !!snapOverride;
        if (t.type === 'tile' && typeof bridge.focusTile === 'function') bridge.focusTile(t.x, t.y, snap);
        if (t.type === 'entity' && typeof bridge.focusEntity === 'function') bridge.focusEntity(t.name, snap);
    }

    async function renderStep() {
        const myToken = ++renderToken;
        const step = steps[index];
        if (!step) { renderBusy = false; return end(); }
        renderBusy = true;
        textReady = false;
        try {
            // Kamera kann pro Cutscene-Step auf Spieler/Sprecher/Boss/Tile umstellen.
            applyCutsceneCamera(step, false);
            // Textbox erst zeigen, wenn der Text wirklich da ist. Während Bewegungen sanft ausblenden.
            setCutsceneTextboxVisible(false, !!step.move);
            if (step.move) {
                for (const m of step.move) {
                    if (!playing || myToken !== renderToken) return;
                    await moveEntity(m.entity, m.to, m);
                }
            }
            if (!playing || myToken !== renderToken) return;
            const ov = ensureOverlay();
            applyStepStyle(step);
            const portrait = ov.querySelector('.real-cut-portrait');
            const textEl = ov.querySelector('.real-cut-text');
            ov.querySelector('.real-cut-speaker').textContent = step.speaker || 'System';
            if (textEl) {
                textEl.classList.remove('text-preloaded', 'text-effect-running');
                textEl.innerHTML = renderCutsceneRichText(step.text || '');
                void textEl.offsetWidth;
                textEl.classList.add('text-preloaded', 'text-effect-running');
            }
            if (portrait) portrait.textContent = resolvePortrait(step);
            renderChoices(step);
            focus(step.focus || step.speaker);
            applyCutsceneCamera(step, false);
            // Cutscene nutzt dasselbe Emoji/Twemoji-Script wie normale Map-Textbox.
            if (typeof window.parseEmojis === 'function') {
                window.parseEmojis(portrait || ov);
                window.parseEmojis(textEl || ov);
                window.parseEmojis(ov.querySelector('.real-cut-choices') || ov);
            }
            setCutsceneTextboxVisible(true, false);
            textReady = true;
        } finally {
            if (myToken === renderToken) {
                renderBusy = false;
                // Eingaben während NPC-/Player-Bewegung werden absichtlich NICHT nachgeholt.
                // Sonst springt die Cutscene sofort weiter, bevor der neue Text lesbar ist.
                queuedNext = false;
            }
        }
    }

    function play(id, sceneSteps) {
        if (playing) return;
        clearTimeout(endTimer);
        renderBusy = false;
        queuedNext = false;
        textReady = false;
        choiceMode = false;
        choiceIndex = 0;
        currentChoices = [];
        renderToken++;
        const state = rt().gameState || 'MAP';
        previousState = ['TRANSITION','BATTLE_INTRO','MESSAGE','CHOICE','CUTSCENE'].includes(state) ? 'MAP' : state;
        steps = sceneSteps || []; index = 0; playing = true;
        const ov = ensureOverlay();
        ov.classList.remove('closing', 'textbox-visible', 'textbox-moving', 'textbox-fading-out', 'boss-cutscene');
        if (String(id || '').toLowerCase().includes('boss')) ov.classList.add('boss-cutscene');
        ov.classList.add('active', 'textbox-hidden');
        clearCutsceneText();
        if (typeof window.setBvGameState === 'function') window.setBvGameState('CUTSCENE');
        renderStep();
    }
    function startRealCutsceneBattle(step) {
        if (!step || !step.battle) return false;
        const target = typeof step.battle === 'string' ? step.battle : (step.battle.name || step.battle.enemy || step.battle.enemyId);
        let npc = null;
        if (typeof step.battle === 'object' && typeof step.battle.x === 'number') npc = npcs().find(n => n && n.x === step.battle.x && n.y === step.battle.y);
        if (!npc && target) npc = npcs().find(n => n && (n.name === target || n.enemyId === target));
        if (!npc || typeof window.BVStartBattle !== 'function') return false;
        const safeNpc = npc;
        end();
        setTimeout(() => window.BVStartBattle(safeNpc), 310);
        return true;
    }

    function next() {
        if (!playing) return;
        if (choiceMode) { selectChoice(choiceIndex); return; }
        // Wichtig: Klick/ENTER während Bewegungen nur blocken, nicht puffern.
        // Sobald Text sichtbar ist, darf weitergeklickt werden — auch wenn ein alter Busy-Flag hängt.
        if (renderBusy && !textReady) return;
        if (renderBusy && textReady) renderBusy = false;
        const step = steps[index];
        if (startRealCutsceneBattle(step)) return;
        if (step && step.nextId) {
            const ni = steps.findIndex(st => st && st.id === step.nextId);
            index = ni >= 0 ? ni : index + 1;
        } else index++;
        renderStep();
    }
    function end() {
        if (!playing) return;
        playing = false;
        queuedNext = false;
        renderBusy = false;
        textReady = false;
        choiceMode = false;
        currentChoices = [];
        renderToken++;
        clearFocus();
        if (!overlay) return;
        setCutsceneTextboxVisible(false, false);
        overlay.classList.add('closing');
        clearTimeout(endTimer);
        const safeState = ['TRANSITION','BATTLE_INTRO','MESSAGE','CHOICE','CUTSCENE'].includes(previousState) ? 'MAP' : (previousState || 'MAP');
        endTimer = setTimeout(() => {
            overlay.classList.remove('active','closing','textbox-visible','textbox-moving','textbox-fading-out','boss-cutscene');
            overlay.classList.add('textbox-hidden');
            clearCutsceneText();
            if (typeof window.setBvGameState === 'function') window.setBvGameState(safeState);
            // Nach Cutscene-Bewegungen Kamera immer wieder sauber auf Spieler setzen.
            if (window.BVCameraBridge && typeof window.BVCameraBridge.forcePlayer === 'function') {
                setTimeout(() => window.BVCameraBridge.forcePlayer(), 30);
                setTimeout(() => window.BVCameraBridge.forcePlayer(), 180);
            }
            window.dispatchEvent(new CustomEvent('bv-real-cutscene-ended', { detail: { state: safeState } }));
        }, 240);
    }

    function forceEndCutscene(reason = 'skip') {
        if (playing) { end(); return; }
        // Falls die Cutscene gerade nur reserviert/geplant ist, trotzdem aus dem CUTSCENE-State befreien.
        clearTimeout(endTimer);
        renderBusy = false; textReady = false; queuedNext = false; choiceMode = false; currentChoices = [];
        if (overlay) {
            overlay.classList.remove('active','closing','textbox-visible','textbox-moving','textbox-fading-out','boss-cutscene');
            overlay.classList.add('textbox-hidden');
            clearCutsceneText();
        }
        clearFocus();
        if (typeof window.setBvGameState === 'function') window.setBvGameState('MAP');
        if (window.BVCameraBridge?.forcePlayer) setTimeout(() => window.BVCameraBridge.forcePlayer(), 30);
    }
    window.BVForceEndCutscene = forceEndCutscene;

    function handleCutsceneKey(e) {
        const isEsc = e.key === 'Escape' || e.code === 'Escape' || e.key === 'Esc';
        if (isEsc && (playing || rt().gameState === 'CUTSCENE')) { e.preventDefault(); e.stopImmediatePropagation(); forceEndCutscene('esc'); return; }
        if (!playing) return;
        if (choiceMode && (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')) { e.preventDefault(); e.stopImmediatePropagation(); choiceIndex = (choiceIndex - 1 + currentChoices.length) % currentChoices.length; updateChoiceSelection(); return; }
        if (choiceMode && (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S')) { e.preventDefault(); e.stopImmediatePropagation(); choiceIndex = (choiceIndex + 1) % currentChoices.length; updateChoiceSelection(); return; }
        if (e.key === 'Enter' || e.code === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopImmediatePropagation();
            const now = performance.now();
            if (now - lastAdvanceInputAt < 170) return;
            lastAdvanceInputAt = now;
            next();
            return;
        }
    }
    // Capture-Phase: andere Game-Keyhandler dürfen ESC/ENTER während Cutscene nicht verschlucken.
    // Nur EIN Listener, damit ein Tastendruck nicht doppelt als Weiterklick zählt.
    document.addEventListener('keydown', handleCutsceneKey, true);

    document.addEventListener('click', e => {
        if (!playing || !overlay || !overlay.contains(e.target)) return;
        if (e.target.closest && e.target.closest('.real-cut-choice')) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const now = performance.now();
        if (now - lastAdvanceInputAt < 170) return;
        lastAdvanceInputAt = now;
        next();
    }, true);

    function maybePatrickWelcome() {
        const r = rt(); const pl = pObj();
        if (!pl || r.currentMapId !== 'buero' || r.gameState !== 'MAP') return;
        const trans = document.getElementById('map-transition');
        if (trans?.classList.contains('active')) return;
        pl.cutscenes = pl.cutscenes || {};
        if (!pl.cutscenes.pendingPatrickWelcome || pl.cutscenes.patrickWelcomeDone) return;
        const idx = npcIndex('Patrick'); if (idx < 0) return;
        pl.cutscenes.pendingPatrickWelcome = false; pl.cutscenes.patrickWelcomeDone = true;
        reserveCutsceneStart();
        const patrick = npcs()[idx]; const home = { x: patrick.x, y: patrick.y };
        setTimeout(() => {
            if (!canRunPendingCutscene('buero')) { releaseCutsceneStart(); return; }
            play('patrickWelcome', [
            { speaker: 'System', focus: 'player', mood:'good', accent:'#69f0ae', effect:'guide', text: 'Dein erster Tag beginnt. Du stehst im Büro, alles ist neu — aber nicht alleine.' },
            { speaker: 'Patrick', focus: 'Patrick', mood:'good', accent:'#69f0ae', effect:'sparkle', move: [{ entity: 'Patrick', to: { near: 'player' }, speed: 185 }], text: 'Hey, du musst ' + (pl.name || 'der neue Azubi') + ' sein. Schön, dass du da bist! Ich bin Patrick.' },
            { speaker: 'Patrick', focus: 'Patrick', text: 'Ich begleite dich am Anfang ein bisschen. Frag ruhig, wenn etwas unklar ist — jeder hat hier mal neu angefangen.', accent:'#8ec5ff' },
            { speaker: 'Patrick', focus: 'Patrick', mood:'warn', accent:'#ffd166', move: [{ entity: 'Patrick', to: { x: 7, y: 7 }, speed: 165 }, { entity: 'player', to: { nearNpc: 'Patrick' }, speed: 165 }], text: 'Komm kurz mit. Ich zeige dir den ersten sicheren Schritt durchs Büro.' },
            { speaker: 'Patrick', focus: 'player', accent:'#4a9fff', effect:'guide', text: 'Du musst nicht alles sofort können. Wichtig ist nur: in Ruhe umsehen, mit Kolleginnen und Kollegen sprechen und aufmerksam bleiben.' },
            { id:'patrick_choice', speaker: 'Patrick', focus: 'Patrick', mood:'warn', accent:'#ffd166', text: 'Wie möchtest du starten?', choices: [
                { label:'Steuerung kurz erklären', hint:'Sicher starten', kind:'good', nextId:'patrick_controls', setFlag:'patrickIntroChoice', value:'controls' },
                { label:'Ein paar motivierende Worte', hint:'Mut sammeln', kind:'warn', nextId:'patrick_motivation', setFlag:'patrickIntroChoice', value:'motivation' },
                { label:'Ich schaue mich direkt um', hint:'Loslegen', nextId:'patrick_task', setFlag:'patrickIntroChoice', value:'task' }
            ] },
            { id:'patrick_controls', nextId:'patrick_task', speaker: 'Patrick', focus: 'player', move: [{ entity: 'player', to: { nearNpc: 'Patrick' }, speed: 160 }], effect:'guide', text: 'Klar: Du bewegst dich mit **WASD** oder den **Pfeiltasten**. Mit **ENTER** sprichst du Leute an oder bestätigst Dialoge. Das Menü öffnest du mit **E**.', accent:'#4a9fff' },
            { id:'patrick_motivation', nextId:'patrick_task', speaker: 'Patrick', focus: 'Patrick', mood:'good', effect:'pop', text: 'Du packst das. Mach einen Schritt nach dem anderen — und wenn der Drucker komisch klingt, ist das hier leider normal.', accent:'#69f0ae' },
            { id:'patrick_task', speaker: 'Patrick', focus: 'player', mood:'warn', text: 'Deine erste Aufgabe ist einfach: Schau dich um, sprich mit den Leuten und finde heraus, wie das Büro tickt.', accent:'#8ec5ff' },
            { speaker: 'Patrick', focus: 'Patrick', mood:'good', text: 'Ich bin an meinem Platz, wenn du mich brauchst. Willkommen im Team!', accent:'#69f0ae' },
            { speaker: 'Patrick', focus: 'Patrick', move: [{ entity: 'Patrick', to: home, speed: 185 }], text: 'Bis gleich — und keine Sorge, du musst heute nicht alles perfekt machen.', accent:'#a855f7' }
            ]);
        }, 600);
    }

    function canStartMapCutscene(mapId) {
        const r = rt();
        const trans = document.getElementById('map-transition');
        return !playing && r.currentMapId === mapId && r.gameState === 'MAP' && !trans?.classList.contains('active');
    }
    function canRunPendingCutscene(mapId) {
        const r = rt();
        const trans = document.getElementById('map-transition');
        return !playing && r.currentMapId === mapId && (r.gameState === 'MAP' || r.gameState === 'CUTSCENE') && !trans?.classList.contains('active');
    }
    function reserveCutsceneStart() {
        // Movement-Bugfix: Sobald eine Map-Cutscene geplant ist, darf der Spieler nicht noch loslaufen.
        if (typeof window.setBvGameState === 'function') window.setBvGameState('CUTSCENE');
    }
    function releaseCutsceneStart() {
        const r = rt();
        if (!playing && r.gameState === 'CUTSCENE' && typeof window.setBvGameState === 'function') window.setBvGameState('MAP');
    }

    function maybePausenraumIntro() {
        const r = rt(); const pl = pObj();
        if (!pl) return;
        if (r.currentMapId !== 'pausenraum') { lastMap = r.currentMapId; return; }
        pl.cutscenes = pl.cutscenes || {};
        // Bugfix: altes Overlay nutzte pausenraumIntro. Das echte Map-Intro nutzt jetzt
        // ein eigenes Flag, damit alte Spielstände/alte Overlaytexte den Dialog nicht kaputt blocken.
        if (lastMap === 'pausenraum' || pl.cutscenes.pausenraumRealIntroDone || pl.cutscenes.pausenraumRealIntroPending) return;
        if (!canStartMapCutscene('pausenraum')) return;
        lastMap = 'pausenraum';
        pl.cutscenes.pausenraumRealIntroPending = true;
        reserveCutsceneStart();
        setTimeout(() => {
            if (!canRunPendingCutscene('pausenraum')) { pl.cutscenes.pausenraumRealIntroPending = false; releaseCutsceneStart(); return; }
            pl.cutscenes.pausenraumRealIntroPending = false;
            pl.cutscenes.pausenraumRealIntroDone = true;
            pl.cutscenes.pausenraumIntro = true;
            pl.cutscenes.pausenraumMapIntro = true;
            play('pausenraumRealIntro', [
                { speaker: 'System', portrait:'☕', focus: 'player', mood:'good', accent:'#69f0ae', text: 'Du betrittst den Pausenraum. Die Geräusche des Büros werden leiser — sogar die Mails flüstern nur noch.' },
                { speaker: 'Mira', portrait:'☕', focus: 'Mira', move: [{ entity: 'Mira', to: { x: 8, y: 10 }, speed: 190 }], text: 'Hey, willkommen. Ich komme kurz rüber — hier darf man tatsächlich durchatmen.' },
                { speaker: 'Ruhiger Ralf', portrait:'🧘', focus: 'Ruhiger Ralf', move: [{ entity: 'Ruhiger Ralf', to: { x: 10, y: 10 }, speed: 190 }], text: 'Regel eins: einatmen. Regel zwei: den Drucker nicht anschreien. Auch wenn er es verdient.' },
                { speaker: 'Snack-Sandra', portrait:'🍪', focus: 'Snack-Sandra', mood:'warn', accent:'#ffd166', text: 'Falls die Energie sinkt: Snacks links, Kaffee rechts, Ausreden überall.' },
                { speaker: 'Mira', portrait:'☕', focus: 'Mira', text: 'Mittags ist hier am meisten los. Später können hier Pausen-Buffs, kleine Quests und Tageszeit-Events starten.' },
                { speaker: 'System', portrait:'📋', focus: 'player', mood:'good', accent:'#69f0ae', effect:'pop', text: 'Neuer Ort entdeckt: **Pausenraum**. Kamera und Textbox werden nach der Cutscene sauber zurückgesetzt.' }
            ]);
        }, 650);
    }

    function maybeFlurIntro() {
        const pl = pObj(); if (!pl) return; pl.cutscenes = pl.cutscenes || {};
        if (pl.cutscenes.flurIntroDone || pl.cutscenes.flurIntroPending || !canStartMapCutscene('flur')) return;
        pl.cutscenes.flurIntroPending = true;
        reserveCutsceneStart();
        setTimeout(() => {
            if (!canRunPendingCutscene('flur')) { pl.cutscenes.flurIntroPending = false; releaseCutsceneStart(); return; }
            pl.cutscenes.flurIntroPending = false; pl.cutscenes.flurIntroDone = true;
            play('flurIntro', [
                { speaker:'System', portrait:'🚪', focus:'player', mood:'warn', accent:'#ffd166', effect:'zoom', text:'Der Hauptflur öffnet sich vor dir. Türen, Teppiche und verdächtig viele Geräusche aus allen Richtungen.' },
                { speaker:'System', portrait:'🗺️', focus:'player', text:'Tipp: Die markierten Wege führen zu Abteilungen. Manche Türen reagieren erst, wenn Quests oder Gegner erledigt sind.' },
                { speaker:'System', portrait:'⚠️', focus:'player', mood:'danger', accent:'#ff6b6b', effect:'shake', text:'Achtung: Im Flur patrouillieren Büro-Probleme. Nicht jede Begegnung ist Smalltalk.' }
            ]);
        }, 520);
    }

    function maybeKantineIntro() {
        const pl = pObj(); if (!pl) return; pl.cutscenes = pl.cutscenes || {};
        if (pl.cutscenes.kantineIntroDone || pl.cutscenes.kantineIntroPending || !canStartMapCutscene('kantine')) return;
        pl.cutscenes.kantineIntroPending = true;
        reserveCutsceneStart();
        setTimeout(() => {
            if (!canRunPendingCutscene('kantine')) { pl.cutscenes.kantineIntroPending = false; releaseCutsceneStart(); return; }
            pl.cutscenes.kantineIntroPending = false; pl.cutscenes.kantineIntroDone = true;
            play('kantineIntro', [
                { speaker:'System', portrait:'🍽️', focus:'player', mood:'good', accent:'#69f0ae', effect:'sparkle', text:'Die Kantine riecht nach Kaffee, Suppe und Entscheidungen, die man später bereut.' },
                { speaker:'Koch Werner', portrait:'👨‍🍳', focus:'Koch Werner', move:[{ entity:'Koch Werner', to:{ x:13, y:12 }, speed:185 }], text:'Mahlzeit! Keine Sorge, der Überraschungseintopf überrascht meistens nur beim zweiten Löffel.' },
                { speaker:'System', portrait:'📋', focus:'player', mood:'warn', accent:'#ffd166', text:'Kantinen-Gegner können nerven, aber hier findest du oft Items und kurze Verschnaufpausen.' }
            ]);
        }, 560);
    }

    function maybeBossOfficeIntro() {
        const pl = pObj(); if (!pl) return; pl.cutscenes = pl.cutscenes || {};
        if (pl.cutscenes.bossOfficeIntroDone || pl.cutscenes.bossOfficeIntroPending || !canStartMapCutscene('boss_office')) return;
        pl.cutscenes.bossOfficeIntroPending = true;
        reserveCutsceneStart();
        setTimeout(() => {
            if (!canRunPendingCutscene('boss_office')) { pl.cutscenes.bossOfficeIntroPending = false; releaseCutsceneStart(); return; }
            pl.cutscenes.bossOfficeIntroPending = false; pl.cutscenes.bossOfficeIntroDone = true;
            play('bossOfficeIntro', [
                { speaker:'System', portrait:'👔', focus:'player', camera:'player', cameraSnap:true, mood:'danger', accent:'#ff2d55', effect:'shake', text:'Die Tür zum Chefbüro fällt schwer ins Schloss. Die Luft klingt nach Überstunden.' },
                { speaker:'Der Geschäftsführer', portrait:'👔', focus:'Der Geschäftsführer', camera:'boss', mood:'danger', accent:'#ff003c', effect:'pop', text:'Ah. Der neue Azubi. Pünktlich genug, um in meinen Kalender eingetragen zu werden.' },
                { speaker:'Der Geschäftsführer', portrait:'👔', focus:'Der Geschäftsführer', camera:'boss', move:[{ entity:'Der Geschäftsführer', to:{ x:14, y:8 }, speed:170 }], mood:'danger', accent:'#ff2d55', effect:'shake', text:'Komm näher. Keine Sorge — meine Leistungsbeurteilungen sind nur meistens final.' },
                { speaker:'System', portrait:'⚠️', focus:'player', camera:'player', mood:'warn', accent:'#ffd166', effect:'pop', text:'Boss-Raum betreten: Bereite Items, MP und Skills vor. Der Kampf startet, wenn du den Geschäftsführer herausforderst.' },
                { speaker:'Der Geschäftsführer', portrait:'👔', focus:'Der Geschäftsführer', camera:'boss', mood:'danger', accent:'#ff003c', effect:'shake', text:'Wenn du bereit bist, kannst du mich direkt herausfordern — oder dich erst vorbereiten.', choices:[
                    { label:'Noch vorbereiten', hint:'Map erkunden', kind:'warn', nextId:'boss_prepare' },
                    { label:'Sofort herausfordern', hint:'Bosskampf', kind:'danger', nextId:'boss_fight' }
                ] },
                { id:'boss_prepare', speaker:'System', portrait:'📋', focus:'player', camera:'player', mood:'warn', accent:'#ffd166', text:'Du kannst Items prüfen, speichern oder den Raum erkunden. Sprich den Geschäftsführer an, wenn du bereit bist.' },
                { id:'boss_fight', speaker:'System', portrait:'⚔️', focus:'player', camera:'boss', mood:'danger', accent:'#ff003c', effect:'flash', text:'Bosskampf wird gestartet.', battle:'Der Geschäftsführer' }
            ]);
        }, 700);
    }

    const CUTSCENE_TILE_TRIGGERS = [
        { id:'buero_quiz_corner', map:'buero', x:8, y:5, once:true, steps: [
            { speaker:'System', portrait:'🧠', focus:'player', mood:'warn', accent:'#ffd166', effect:'sparkle', text:'Du spürst Quiz-Energie in der Luft. **Quiz-Kai** beobachtet diese Stelle sehr genau.' },
            { speaker:'System', portrait:'💡', focus:'player', text:'Solche X/Y-Felder können später Rätsel, Kämpfe oder Story-Cutscenes auslösen.' }
        ]},
        { id:'flur_boss_warning_tile', map:'flur', x:15, y:2, once:true, steps: [
            { speaker:'System', portrait:'🚪', focus:'player', mood:'danger', accent:'#ff6b6b', effect:'dim', text:'Vor dir liegt der Weg Richtung Chefbüro. Dein Kalender fühlt sich plötzlich schwerer an.' },
            { speaker:'System', portrait:'⚠️', focus:'player', mood:'warn', accent:'#ffd166', text:'Wenn du den Boss-Schlüssel hast, wartet dort eine eigene Map-Cutscene.' }
        ]}
    ];

    function playerNearInteractiveNPC() {
        const pl = pObj();
        return npcs().some(n => n && Math.abs((n.x || 0) - pl.x) + Math.abs((n.y || 0) - pl.y) <= 1 && ['talk','shop','skillshop','computer','quiz','enemy'].includes(n.type));
    }

    function maybeTileCutsceneTriggers() {
        const pl = pObj(); const r = rt();
        if (!pl || !canStartMapCutscene(r.currentMapId)) return;
        // Wenn man an einer Person/Gegner/Tür-Interaktion steht, niemals eine XY-Cutscene davor schieben.
        if (playerNearInteractiveNPC()) return;
        pl.cutscenes = pl.cutscenes || {};
        const trig = CUTSCENE_TILE_TRIGGERS.find(t => t.map === r.currentMapId && pl.x === t.x && pl.y === t.y && (!t.once || !pl.cutscenes['tile_' + t.id]));
        if (!trig) return;
        pl.cutscenes['tile_' + trig.id] = true;
        reserveCutsceneStart();
        setTimeout(() => {
            if (!canRunPendingCutscene(trig.map)) { releaseCutsceneStart(); return; }
            play('tile_' + trig.id, trig.steps);
        }, 120);
    }

    function maybeGeneralMapIntros() {
        maybeFlurIntro();
        maybeKantineIntro();
        maybeBossOfficeIntro();
        maybeTileCutsceneTriggers();
    }

    function initRealCutscenes() {
        setInterval(maybePatrickWelcome, 350);
        setInterval(maybePausenraumIntro, 450);
        setInterval(maybeGeneralMapIntros, 500);
        window.BVRealCutscenes = { play, next, end, isPlaying: () => playing, moveEntity };
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initRealCutscenes, { once:true }); else initRealCutscenes();
})();
</script>

<style>
/* ============================================================
   ARENA HOTFIX v7.8.8: Stabiles Hauptmenü-Tab-System
   - Ein einziger delegierter Tab-Wechsel für ALLE Kategorien
   - Tastatur-Navigation im Menü ohne versehentliche Spieler-Bewegung
   ============================================================ */
#rpg-menu-screen .menu-tab {
    position: relative;
    overflow: hidden;
    user-select: none;
}
#rpg-menu-screen .menu-tab::after {
    content: '';
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: 5px;
    height: 2px;
    border-radius: 99px;
    background: linear-gradient(90deg, transparent, rgba(142,197,255,.95), transparent);
    transform: scaleX(0);
    opacity: 0;
    transition: transform .18s ease, opacity .18s ease;
}
#rpg-menu-screen .menu-tab.active::after,
#rpg-menu-screen .menu-tab:focus-visible::after {
    transform: scaleX(1);
    opacity: 1;
}
#rpg-menu-screen .menu-tab:focus-visible {
    outline: 2px solid rgba(142,197,255,.75);
    outline-offset: 2px;
}
#rpg-menu-screen.menu-settings-mode .menu-window,
#rpg-menu-screen.menu-shift-mode .menu-window,
#rpg-menu-screen.menu-quest-mode .menu-window {
    width: min(820px, 96vw) !important;
    height: min(640px, 92vh) !important;
}
#rpg-menu-screen.menu-achievement-mode .menu-window,
#rpg-menu-screen.menu-skills-mode .menu-window {
    width: min(600px, 96vw) !important;
    height: min(520px, 520vh) !important;
}
.skill-stars {
    font-size: 0.8rem;
    color: #ffd700;
    letter-spacing: 1px;
    margin-top: 2px;
}
.menu-tab-content.bv-tab-switch-in { animation: bvStableMenuTabIn .22s cubic-bezier(.16,1,.36,1) both; }
@keyframes bvStableMenuTabIn { from { opacity:0; transform:translateY(8px) scale(.985); } to { opacity:1; transform:translateY(0) scale(1); } }
</style>

<script>
/* ARENA HOTFIX v7.8.8: Hauptmenü Kategorien + Bewegungsfix */
(function () {
    'use strict';
    const MODE_CLASSES = [
        'menu-status-mode','menu-inventory-mode','menu-team-mode','menu-map-mode',
        'menu-quest-mode','menu-settings-mode','menu-shift-mode','menu-skills-mode','menu-achievement-mode',
        'menu-opening','menu-closing','menu-switching'
    ];

    function runtime() {
        return (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
    }

    function playerObj() {
        return (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : (window.player || {});
    }

    function modeFor(tab) {
        if (tab === 'inventory') return 'menu-inventory-mode';
        if (tab === 'team') return 'menu-team-mode';
        if (tab === 'map') return 'menu-map-mode';
        if (tab === 'quests') return 'menu-quest-mode';
        if (tab === 'settings') return 'menu-settings-mode';
        if (tab === 'shift') return 'menu-shift-mode';
        if (tab === 'skills') return 'menu-skills-mode';
        if (tab === 'achievements') return 'menu-achievement-mode';
        return 'menu-status-mode';
    }

    function ensureDynamicTabs() {
        try { window.BVQuestLog?.ensureQuestTab?.(); } catch (e) {}
        try { window.BVSettings?.ensureTab?.(); } catch (e) {}
        try { if (!document.getElementById('tab-shift')) window.BVShiftSystem?.updateUI?.(); } catch (e) {}
    }

    function redrawMapTab() {
        const host = document.getElementById('world-map');
        if (!host) return;
        const rt = runtime();
        const map = rt.currentMap || window.currentMap || [];
        const mapId = rt.currentMapId || window.currentMapId || 'buero';
        const pl = playerObj();
        const npcs = rt.npcs || window.npcs || [];
        const chests = rt.currentChests || window.currentChests || [];
        // Bugfix v7.10.4: MAPS ist in der Hauptspiel-Closure lokal und hier nicht immer global verfügbar.
        // Deshalb feste Anzeigenamen als Fallback nutzen, damit nach Kategorie-Wechsel nicht z.B. 'flur' statt 'Hauptflur' steht.
        const BV_MAP_DISPLAY_NAMES = {
            buero: 'Hauptbüro - Einkauf',
            flur: 'Hauptflur',
            pausenraum: 'Pausenraum',
            zentrale: 'Zentrale - IT Hub',
            kantine: 'Kantine',
            lager: 'Lager',
            serverraum: 'Serverraum',
            konferenz: 'Konferenzraum',
            archiv: 'Archivraum',
            dach: 'Dachterrasse',
            boss_office: 'Chefbüro',
            secret_room: '??? Geheimraum'
        };
        const mapName = (window.MAPS && window.MAPS[mapId] && window.MAPS[mapId].name) || BV_MAP_DISPLAY_NAMES[mapId] || mapId || 'Unbekannt';
        if (mapId === 'secret_room') {
            host.innerHTML = '<div class="menu-current-map-wrap"><div class="menu-map-title"><span>🗺️ Aktueller Standort</span><span>??? Geheimraum</span></div><div class="menu-map-panel" style="min-height:180px;display:flex;align-items:center;justify-content:center;color:#ffb4b4;font-family:\'VT323\',monospace;font-size:1.4rem;text-align:center;">📡 Keine Kartendaten verfügbar.<br>Dieser Raum existiert offiziell nicht.</div></div>';
            window.parseEmojis?.(host);
            return;
        }
        host.innerHTML = '<div class="menu-current-map-wrap"><div class="menu-map-title"><span>🗺️ Aktueller Standort</span><span>' + mapName + '</span></div><div class="menu-map-panel"><canvas id="menu-current-map-canvas"></canvas><div class="menu-map-legend"><span>🟢 Du</span><span>🔵 NPC</span><span>🔴 Gegner</span><span>🟡 Tür</span><span>📦 Kiste</span></div></div></div>';
        const canvas = document.getElementById('menu-current-map-canvas');
        const ctx = canvas && canvas.getContext('2d');
        if (!ctx || !map.length) { window.parseEmojis?.(host); return; }
        const rows = map.length, cols = map[0]?.length || 1;
        const scale = Math.max(6, Math.min(18, Math.floor(Math.min(620 / cols, 340 / rows))));
        canvas.width = cols * scale; canvas.height = rows * scale;
        // Canvas-Bugfix: beim Tab-Wechsel explizit sichtbare CSS-Größe setzen.
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.maxHeight = '100%';
        canvas.style.objectFit = 'contain';
        canvas.style.imageRendering = 'pixelated';
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const tile = map[y]?.[x] ?? 0;
                let color = '#58708a';
                const td = window.TILES && window.TILES[tile];
                if (td?.block) color = '#203044';
                if (td?.name && String(td.name).toLowerCase().includes('door')) color = '#e9c949';
                else if ([4,5,13].includes(tile)) color = '#6d82a0';
                else if (tile === 3) color = '#2e7d51';
                ctx.fillStyle = color;
                ctx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
        ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
        for (let x = 0; x <= cols; x++) { ctx.beginPath(); ctx.moveTo(x*scale,0); ctx.lineTo(x*scale,rows*scale); ctx.stroke(); }
        for (let y = 0; y <= rows; y++) { ctx.beginPath(); ctx.moveTo(0,y*scale); ctx.lineTo(cols*scale,y*scale); ctx.stroke(); }
        chests.forEach(c => { if (c && !c.opened) { ctx.fillStyle = c.type === 'rare' ? '#d946ef' : '#f59e0b'; ctx.fillRect(c.x*scale+scale*.18, c.y*scale+scale*.18, scale*.64, scale*.64); } });
        npcs.forEach(n => { if (!n) return; ctx.fillStyle = n.type === 'enemy' ? '#ef4444' : (n.type === 'shop' || n.type === 'skillshop' ? '#facc15' : '#38bdf8'); ctx.beginPath(); ctx.arc(n.x*scale+scale/2, n.y*scale+scale/2, Math.max(2.5, scale*.36), 0, Math.PI*2); ctx.fill(); });
        if (typeof pl.x === 'number' && typeof pl.y === 'number') { ctx.fillStyle = '#22c55e'; ctx.beginPath(); ctx.arc(pl.x*scale+scale/2, pl.y*scale+scale/2, Math.max(3.5, scale*.45), 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
        window.parseEmojis?.(host);
    }

    function afterActivate(tab) {
        if (tab === 'status' || tab === 'inventory') window.updateMenuStats?.();
        if (tab === 'team') {
            // Team wird vom Original beim Öffnen aufgebaut; bei Bedarf Emojis neu parsen.
            const grid = document.getElementById('team-grid'); if (grid) window.parseEmojis?.(grid);
        }
        if (tab === 'map') redrawMapTab();
        if (tab === 'quests') window.BVQuestLog?.render?.();
        if (tab === 'settings') { window.BVSettings?.ensureTab?.(); window.BVSettings?.apply?.(); }
        if (tab === 'shift') window.BVShiftSystem?.updateUI?.();
    }

    function activateTab(tabName, focusButton = false) {
        ensureDynamicTabs();
        const screen = document.getElementById('rpg-menu-screen');
        const btn = document.querySelector('#rpg-menu-screen .menu-tab[data-tab="' + tabName + '"]');
        const content = document.getElementById('tab-' + tabName);
        if (!screen || !btn || !content) return false;
        // Bugfix v7.10.5: aktive Kategorie erneut anklicken darf nichts neu rendern/wechseln.
        if (btn.classList.contains('active') && content.classList.contains('active')) {
            if (focusButton) btn.focus({ preventScroll: true });
            return true;
        }
        document.querySelectorAll('#rpg-menu-screen .menu-tab').forEach(t => { t.classList.toggle('active', t === btn); t.setAttribute('aria-selected', t === btn ? 'true' : 'false'); t.tabIndex = t === btn ? 0 : -1; });
        document.querySelectorAll('#rpg-menu-screen .menu-tab-content').forEach(c => c.classList.remove('active','menu-window-switch-out','menu-window-switch-in','bv-tab-switch-in'));
        content.classList.add('active','bv-tab-switch-in');
        clearTimeout(content._bvTabAnim); content._bvTabAnim = setTimeout(() => content.classList.remove('bv-tab-switch-in'), 260);
        screen.classList.remove(...MODE_CLASSES);
        screen.classList.add(modeFor(tabName));
        afterActivate(tabName);
        if (focusButton) btn.focus({ preventScroll: true });
        return true;
    }

    function installStableMenuTabs() {
        const screen = document.getElementById('rpg-menu-screen');
        const tabs = document.querySelector('#rpg-menu-screen .menu-tabs');
        if (!screen || !tabs || tabs.dataset.bvStableTabs === '1') return;
        tabs.dataset.bvStableTabs = '1';
        tabs.setAttribute('role', 'tablist');
        document.querySelectorAll('#rpg-menu-screen .menu-tab').forEach(btn => { btn.setAttribute('role','tab'); btn.type = 'button'; });
        tabs.addEventListener('click', e => {
            const btn = e.target.closest('.menu-tab');
            if (!btn || !tabs.contains(btn)) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            if (btn.classList.contains('active')) return;
            activateTab(btn.dataset.tab || 'status', false);
        }, true);
        document.addEventListener('keydown', e => {
            const ms = document.getElementById('rpg-menu-screen');
            if (!ms || !ms.classList.contains('active')) return;
            const blockedMoveKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','W','A','S','D','PageUp','PageDown','Home','End',' '];
            const activeEl = document.activeElement;
            const typing = activeEl && /INPUT|TEXTAREA|SELECT/.test(activeEl.tagName);
            if (!typing && blockedMoveKeys.includes(e.key)) e.preventDefault();
            const list = Array.from(document.querySelectorAll('#rpg-menu-screen .menu-tab'));
            const current = list.findIndex(b => b.classList.contains('active'));
            if (!list.length || typing) return;
            let next = -1;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') next = (current + 1 + list.length) % list.length;
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') next = (current - 1 + list.length) % list.length;
            if (e.key === 'Home') next = 0;
            if (e.key === 'End') next = list.length - 1;
            if (next >= 0) { e.stopImmediatePropagation(); activateTab(list[next].dataset.tab || 'status', true); }
            if (e.key === 'Escape') { e.stopImmediatePropagation(); window.closeMenu?.(); }
        }, true);
    }

    const originalOpen = window.openMenu;
    if (typeof originalOpen === 'function' && !originalOpen._bvStableTabsWrapped) {
        window.openMenu = function () {
            const result = originalOpen.apply(this, arguments);
            setTimeout(() => {
                installStableMenuTabs();
                ensureDynamicTabs();
                const active = document.querySelector('#rpg-menu-screen .menu-tab.active')?.dataset.tab || 'status';
                activateTab(active, false);
            }, 45);
            return result;
        };
        window.openMenu._bvStableTabsWrapped = true;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installStableMenuTabs, { once:true });
    else installStableMenuTabs();
    window.BVStableMenuTabs = { activate: activateTab, redrawMap: redrawMapTab, install: installStableMenuTabs };
})();
</script>


<style>
/* ============================================================
   ARENA HOTFIX v7.9.0: Cutscene-Textbox näher an normaler Dialogbox
   ============================================================ */
#bv-real-cutscene-overlay .real-cut-dialog {
    left: 50% !important;
    bottom: 22px !important;
    width: min(820px, calc(100% - 28px)) !important;
    min-height: 132px;
    display: grid !important;
    grid-template-columns: 74px minmax(0, 1fr) !important;
    gap: 13px !important;
    padding: 16px 18px !important;
    border-radius: 22px !important;
    background:
        linear-gradient(145deg, rgba(10,22,44,.97), rgba(5,13,28,.985)) !important;
    border: 2px solid rgba(142,197,255,.40) !important;
    box-shadow:
        0 18px 55px rgba(0,0,0,.72),
        0 0 26px var(--cut-accent-soft),
        inset 0 1px 0 rgba(255,255,255,.12) !important;
    overflow: hidden;
}
#bv-real-cutscene-overlay .real-cut-dialog::before {
    content: '';
    position: absolute;
    inset: 0;
    width: 42%;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.075), transparent);
    transform: translateX(-125%);
    animation: realCutDialogSheenV790 4.2s ease-in-out .25s infinite;
}
#bv-real-cutscene-overlay .real-cut-portrait-frame {
    width: 66px;
    height: 66px;
    border-radius: 19px;
    display: grid;
    place-items: center;
    background:
        radial-gradient(circle at 35% 20%, rgba(255,255,255,.18), transparent 45%),
        linear-gradient(145deg, rgba(74,159,255,.18), rgba(0,0,0,.32));
    border: 1px solid rgba(255,255,255,.16);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 0 18px var(--cut-accent-soft);
    position: relative;
    z-index: 2;
}
#bv-real-cutscene-overlay .real-cut-portrait {
    font-size: 2.25rem;
    line-height: 1;
}
#bv-real-cutscene-overlay .real-cut-content {
    min-width: 0;
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
}
#bv-real-cutscene-overlay .real-cut-speaker {
    font-size: 1.03rem !important;
    margin-bottom: 5px !important;
    letter-spacing: .9px;
    text-transform: uppercase;
}
#bv-real-cutscene-overlay .real-cut-text {
    min-height: 48px !important;
    font-size: 1.28rem !important;
    line-height: 1.27 !important;
    color: #fff;
    padding-right: 78px;
    word-break: break-word;
}
#bv-real-cutscene-overlay .real-cut-hint {
    position: absolute;
    right: 4px;
    bottom: 0;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(255,255,255,.055);
    border: 1px solid rgba(255,255,255,.08);
    color: rgba(210,230,255,.60) !important;
}
#bv-real-cutscene-overlay .real-cut-choices.visible {
    margin-top: 10px;
    padding-right: 0;
}
@keyframes realCutDialogSheenV790 {
    0%,100% { transform: translateX(-135%); opacity: 0; }
    42% { opacity: .65; }
    62% { transform: translateX(260%); opacity: 0; }
}
@media (max-width: 620px) {
    #bv-real-cutscene-overlay .real-cut-dialog {
        grid-template-columns: 52px minmax(0, 1fr) !important;
        min-height: 126px;
        padding: 13px 14px !important;
        bottom: 12px !important;
    }
    #bv-real-cutscene-overlay .real-cut-portrait-frame { width: 48px; height: 48px; border-radius: 15px; }
    #bv-real-cutscene-overlay .real-cut-portrait { font-size: 1.75rem; }
    #bv-real-cutscene-overlay .real-cut-text { font-size: 1.12rem !important; padding-right: 0; }
    #bv-real-cutscene-overlay .real-cut-hint { position: static; align-self: flex-end; margin-top: 7px; }
}
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.9.1: Cutscene-Textbox Timing, Position & Animation
   - Textbox erscheint erst wenn Text da ist
   - blendet während NPC-/Player-Bewegung aus
   - sitzt cinematic korrekt über der unteren Letterbox-Bar
   ============================================================ */
#bv-real-cutscene-overlay .real-cut-dialog {
    bottom: 86px !important;
    opacity: 0;
    pointer-events: none;
    transform: translateX(-50%) translateY(20px) scale(.965) !important;
    filter: blur(3px) brightness(.88);
}
#bv-real-cutscene-overlay.textbox-visible .real-cut-dialog {
    opacity: 1 !important;
    pointer-events: auto;
    transform: translateX(-50%) translateY(0) scale(1) !important;
    filter: blur(0) brightness(1);
    animation: realCutTextboxAppearV791 .34s cubic-bezier(.16,1,.36,1) both !important;
}
#bv-real-cutscene-overlay.textbox-hidden .real-cut-dialog,
#bv-real-cutscene-overlay.textbox-moving .real-cut-dialog {
    opacity: 0 !important;
    pointer-events: none !important;
    animation: realCutTextboxHideV791 .20s ease-in both !important;
}
#bv-real-cutscene-overlay.textbox-moving .real-cut-dialog {
    transform: translateX(-50%) translateY(18px) scale(.975) !important;
}
#bv-real-cutscene-overlay.textbox-visible .real-cut-text {
    animation: realCutTextRevealV791 .24s ease-out both !important;
}
#bv-real-cutscene-overlay.textbox-visible .real-cut-portrait-frame {
    animation: realCutPortraitPopV791 .34s cubic-bezier(.16,1.2,.36,1) both;
}
#bv-real-cutscene-overlay.textbox-visible .real-cut-hint {
    animation: realCutHintBlinkV791 1.2s ease-in-out .45s infinite alternate;
}
@keyframes realCutTextboxAppearV791 {
    0% { opacity: 0; transform: translateX(-50%) translateY(24px) scale(.94); filter: blur(5px) brightness(.82); }
    62% { opacity: 1; transform: translateX(-50%) translateY(-3px) scale(1.012); filter: blur(0) brightness(1.08); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0) brightness(1); }
}
@keyframes realCutTextboxHideV791 {
    from { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0) brightness(1); }
    to { opacity: 0; transform: translateX(-50%) translateY(18px) scale(.975); filter: blur(3px) brightness(.88); }
}
@keyframes realCutTextRevealV791 {
    from { opacity: 0; transform: translateY(7px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes realCutPortraitPopV791 {
    from { opacity: 0; transform: scale(.78) rotate(-3deg); }
    70% { opacity: 1; transform: scale(1.06) rotate(1deg); }
    to { opacity: 1; transform: scale(1) rotate(0); }
}
@keyframes realCutHintBlinkV791 {
    from { opacity: .48; transform: translateY(0); }
    to { opacity: .88; transform: translateY(-1px); }
}
@media (max-width: 620px) {
    #bv-real-cutscene-overlay .real-cut-dialog { bottom: 76px !important; }
}
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.9.2: Cutscene-Fade + Map-Dialog Text/Emoji-Effekt
   ============================================================ */
#bv-real-cutscene-overlay.textbox-fading-out .real-cut-dialog {
    opacity: 1;
    pointer-events: none !important;
    animation: realCutTextboxFadeOutV792 .24s ease-in both !important;
}
#bv-real-cutscene-overlay.textbox-hidden .real-cut-dialog {
    opacity: 0 !important;
    pointer-events: none !important;
    animation: none !important;
}
#bv-real-cutscene-overlay.textbox-moving.textbox-fading-out .real-cut-dialog {
    animation: realCutTextboxMoveFadeOutV792 .24s ease-in both !important;
}
#bv-real-cutscene-overlay .real-cut-text .rich-bold {
    font-weight: 900;
    color: #fff;
    text-shadow: 0 0 10px rgba(255,255,255,.32);
}
#bv-real-cutscene-overlay .real-cut-text .rich-good { color:#8cffc2; font-weight:800; }
#bv-real-cutscene-overlay .real-cut-text .rich-warn { color:#ffd54a; font-weight:800; }
#bv-real-cutscene-overlay .real-cut-text .rich-bad { color:#ff9a9a; font-weight:800; }
#bv-real-cutscene-overlay .real-cut-text.text-preloaded {
    position: relative;
    animation: realCutDialogTextInV792 .26s ease-out both !important;
}
#bv-real-cutscene-overlay .real-cut-text.text-effect-running::after {
    content: '';
    position: absolute;
    left: 0;
    top: -2px;
    width: 38%;
    height: calc(100% + 4px);
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.14), transparent);
    transform: translateX(-120%);
    animation: realCutTextSheenV792 .55s ease-out .05s both;
}
#bv-real-cutscene-overlay .real-cut-portrait img.emoji,
#bv-real-cutscene-overlay .real-cut-text img.emoji,
#bv-real-cutscene-overlay .real-cut-choice img.emoji {
    width: 1.15em;
    height: 1.15em;
    vertical-align: -0.18em;
    display: inline-block;
}
#bv-real-cutscene-overlay .real-cut-portrait img.emoji {
    width: 1em;
    height: 1em;
}
@keyframes realCutTextboxFadeOutV792 {
    0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0) brightness(1); }
    100% { opacity: 0; transform: translateX(-50%) translateY(12px) scale(.982); filter: blur(3px) brightness(.86); }
}
@keyframes realCutTextboxMoveFadeOutV792 {
    0% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); filter: blur(0) brightness(1); }
    100% { opacity: 0; transform: translateX(-50%) translateY(18px) scale(.972); filter: blur(4px) brightness(.82); }
}
@keyframes realCutDialogTextInV792 {
    0% { opacity: 0; transform: translateY(7px); letter-spacing: .02em; filter: blur(2px); }
    100% { opacity: 1; transform: translateY(0); letter-spacing: 0; filter: blur(0); }
}
@keyframes realCutTextSheenV792 {
    0% { transform: translateX(-130%); opacity: 0; }
    35% { opacity: .8; }
    100% { transform: translateX(260%); opacity: 0; }
}
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.9.5: Boss-Cutscene Kamera + extreme Dialog-FX
   ============================================================ */
#bv-real-cutscene-overlay.boss-cutscene {
    --cut-accent: #ff003c;
    --cut-accent-soft: rgba(255,0,60,.30);
}
#bv-real-cutscene-overlay.boss-cutscene::after {
    content:'';
    position:absolute;
    inset:68px 0;
    pointer-events:none;
    background:
        radial-gradient(circle at 50% 38%, rgba(255,0,60,.20), transparent 34%),
        repeating-linear-gradient(0deg, rgba(255,255,255,.055) 0 1px, transparent 1px 5px),
        linear-gradient(90deg, rgba(255,0,60,.10), transparent 28%, rgba(255,210,90,.07) 58%, rgba(255,0,60,.12));
    mix-blend-mode: screen;
    opacity:.85;
    animation: bossCutsceneScreenGlitchV795 1.6s steps(2,end) infinite;
}
#bv-real-cutscene-overlay.boss-cutscene .real-cut-bar {
    background: linear-gradient(180deg, rgba(28,0,8,.98), rgba(0,0,0,.94));
    box-shadow: 0 0 34px rgba(255,0,60,.30), 0 0 55px rgba(0,0,0,.8);
}
#bv-real-cutscene-overlay.boss-cutscene.textbox-visible .real-cut-dialog {
    border-color: rgba(255,0,60,.72) !important;
    background:
        radial-gradient(circle at 8% 0%, rgba(255,0,60,.20), transparent 38%),
        linear-gradient(145deg, rgba(24,4,14,.985), rgba(5,8,18,.98)) !important;
    box-shadow:
        0 22px 70px rgba(0,0,0,.78),
        0 0 34px rgba(255,0,60,.34),
        0 0 70px rgba(255,80,0,.12),
        inset 0 1px 0 rgba(255,255,255,.14) !important;
    animation: realCutTextboxAppearV791 .34s cubic-bezier(.16,1,.36,1) both, bossDialogPulseV795 1.25s ease-in-out .35s infinite alternate !important;
}
#bv-real-cutscene-overlay.boss-cutscene .real-cut-speaker {
    color:#ffccd6 !important;
    text-shadow: 0 0 9px #ff003c, 2px 0 rgba(0,210,255,.35), -2px 0 rgba(255,210,0,.25) !important;
    animation: bossSpeakerGlitchV795 1.1s steps(2,end) infinite;
}
#bv-real-cutscene-overlay.boss-cutscene .real-cut-portrait-frame {
    border-color: rgba(255,0,60,.55);
    background: radial-gradient(circle, rgba(255,0,60,.26), rgba(0,0,0,.35));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 0 26px rgba(255,0,60,.34);
}
#bv-real-cutscene-overlay.boss-cutscene .real-cut-text {
    text-shadow: 0 0 12px rgba(255,0,60,.22);
}
#bv-real-cutscene-overlay.boss-cutscene.fx-shake .real-cut-dialog {
    animation: bossCutsceneHardShakeV795 .34s ease-in-out both, bossDialogPulseV795 1.25s ease-in-out .35s infinite alternate !important;
}
@keyframes bossCutsceneScreenGlitchV795 {
    0%,100% { transform: translate(0,0); opacity:.72; filter:hue-rotate(0deg); }
    18% { transform: translate(-2px,1px); opacity:.92; }
    21% { transform: translate(3px,-1px); opacity:.55; }
    47% { transform: translate(0,0); filter:hue-rotate(-8deg); }
    63% { transform: translate(2px,0); opacity:.86; }
}
@keyframes bossDialogPulseV795 {
    from { filter: brightness(1) saturate(1); }
    to { filter: brightness(1.13) saturate(1.22); }
}
@keyframes bossSpeakerGlitchV795 {
    0%,88%,100% { transform: translateX(0); }
    90% { transform: translateX(1px); }
    92% { transform: translateX(-1px); }
    94% { transform: translateX(2px); }
}
@keyframes bossCutsceneHardShakeV795 {
    0%,100% { transform: translateX(-50%) translateY(0) scale(1); }
    18% { transform: translateX(calc(-50% - 8px)) translateY(-1px) scale(1.01); }
    38% { transform: translateX(calc(-50% + 7px)) translateY(1px) scale(1.012); }
    58% { transform: translateX(calc(-50% - 4px)) translateY(0) scale(1.005); }
    78% { transform: translateX(calc(-50% + 3px)) translateY(-1px) scale(1.006); }
}
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.9.6: Smooth Farbwechsel + neue Cutscene-FX
   ============================================================ */
#bv-real-cutscene-overlay .real-cut-dialog,
#bv-real-cutscene-overlay .real-cut-portrait-frame,
#bv-real-cutscene-overlay .real-cut-speaker,
#bv-real-cutscene-overlay .real-cut-bar {
    transition: border-color .36s ease, box-shadow .36s ease, color .36s ease, background .36s ease, filter .28s ease;
}
#bv-real-cutscene-overlay.fx-flash::after {
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    background:rgba(255,255,255,.28);
    animation: cutFxFlashV796 .42s ease-out both;
    z-index:100;
}
#bv-real-cutscene-overlay.fx-zoom .real-cut-dialog { animation: cutFxZoomV796 .38s cubic-bezier(.16,1,.36,1) both !important; }
#bv-real-cutscene-overlay.fx-sparkle .real-cut-dialog::before {
    background:
        radial-gradient(circle, rgba(255,255,255,.70) 0 1px, transparent 2px),
        linear-gradient(90deg, transparent, rgba(255,255,255,.075), transparent) !important;
    background-size: 26px 26px, auto !important;
    animation: cutFxSparkleV796 .75s ease-out both, realCutDialogSheenV790 4.2s ease-in-out .8s infinite !important;
}
#bv-real-cutscene-overlay.fx-dim::before {
    opacity: 1 !important;
    background: radial-gradient(circle at var(--cut-focus-x,50%) var(--cut-focus-y,48%), transparent 0 22%, rgba(0,0,0,.42) 52%, rgba(0,0,0,.72) 100%) !important;
    animation: cutFxDimV796 .45s ease-out both !important;
}
@keyframes cutFxFlashV796 { from { opacity:1; } to { opacity:0; } }
@keyframes cutFxZoomV796 {
    0% { transform: translateX(-50%) translateY(8px) scale(.90); filter: blur(4px) brightness(1.35); }
    70% { transform: translateX(-50%) translateY(-2px) scale(1.025); filter: blur(0) brightness(1.08); }
    100% { transform: translateX(-50%) translateY(0) scale(1); filter: blur(0) brightness(1); }
}
@keyframes cutFxSparkleV796 {
    0% { opacity:0; transform:translateX(-40px); }
    30% { opacity:.9; }
    100% { opacity:0; transform:translateX(85px); }
}
@keyframes cutFxDimV796 { from { opacity:0; } to { opacity:1; } }
</style>


<style>
/* ============================================================
   ARENA HOTFIX v7.9.8: ENTER-Stuck-Fix + kreative Tutorial-FX
   ============================================================ */
#bv-real-cutscene-overlay.fx-guide .real-cut-dialog {
    border-color: rgba(74,159,255,.72) !important;
    box-shadow: 0 18px 55px rgba(0,0,0,.72), 0 0 30px rgba(74,159,255,.32), 0 0 70px rgba(105,240,174,.10), inset 0 1px 0 rgba(255,255,255,.14) !important;
}
#bv-real-cutscene-overlay.fx-guide .real-cut-dialog::before {
    background: linear-gradient(90deg, transparent, rgba(74,159,255,.18), transparent), repeating-linear-gradient(90deg, transparent 0 18px, rgba(105,240,174,.12) 18px 20px) !important;
    animation: guideScanV798 .72s ease-out both, realCutDialogSheenV790 4.2s ease-in-out .9s infinite !important;
}
#bv-real-cutscene-overlay.fx-guide .real-cut-hint {
    color: #dff7ff !important;
    border-color: rgba(74,159,255,.34) !important;
    background: rgba(74,159,255,.10) !important;
    box-shadow: 0 0 14px rgba(74,159,255,.18);
}
#bv-real-cutscene-overlay.fx-guide .real-cut-text .rich-bold { color:#9fe7ff; text-shadow:0 0 12px rgba(74,159,255,.55); }
@keyframes guideScanV798 { 0%{opacity:0;transform:translateX(-120%)} 35%{opacity:1} 100%{opacity:0;transform:translateX(230%)} }
</style>




<style>
/* ============================================================
   ARENA HOTFIX v7.10.1: Partikel in Titelmenü + Map wieder sichtbar
   Performance-Modus reduziert Partikel nur, versteckt sie aber nicht komplett.
   ============================================================ */
body.bv-settings-performance #rpg-fx-particles,
body.bv-settings-performance .title-particles,
body.bv-settings-performance .splash-bg-canvas,
body.bv-settings-performance .title-canvas-bg,
#rpg-game-window.map-low-quality #rpg-fx-particles {
    display: block !important;
    visibility: visible !important;
}
body.bv-settings-performance .title-particles { opacity: .72 !important; }
body.bv-settings-performance #rpg-fx-particles { opacity: .62 !important; }
body.bv-settings-performance .splash-bg-canvas { opacity: .72 !important; }
body.bv-settings-performance .title-canvas-bg { opacity: .72 !important; }
#rpg-title-screen .title-particles,
#rpg-splash .splash-bg-canvas,
#rpg-fx-particles {
    pointer-events: none !important;
}
</style>

<script>
/* ARENA HOTFIX v7.10.1: Particle Recovery */
(function(){
    'use strict';
    function settingsAllowParticles(){
        const s = window.BV_SETTINGS || {};
        return s.particles !== false && s.reducedMotion !== true;
    }
    function recoverTitleParticles(){
        if (!settingsAllowParticles()) return;
        const host = document.querySelector('#rpg-title-screen .title-particles');
        const screen = document.getElementById('rpg-title-screen');
        if (!host || !screen || !screen.classList.contains('active')) return;
        if (!host.querySelector('.title-fxp') && typeof window.BVSpawnTitleParticles === 'function') window.BVSpawnTitleParticles();
    }
    function recoverMapParticles(){
        if (!settingsAllowParticles()) return;
        const host = document.getElementById('rpg-fx-particles');
        const rt = (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
        if (!host || !rt.currentMapId) return;
        if (!host.querySelector('.fx-depth') && typeof window.BVSpawnMapParticles === 'function') window.BVSpawnMapParticles(rt.currentMapId);
    }
    function recoverParticles(){ recoverTitleParticles(); recoverMapParticles(); }
    window.BVRecoverParticles = recoverParticles;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(recoverParticles, 120), { once:true });
    else setTimeout(recoverParticles, 120);
    setInterval(recoverParticles, 1800);
})();
</script>

<style>
/* ============================================================
   ARENA HOTFIX v7.10.2: Title-Einstellungen + Hauptmenü-Button-Safety
   ============================================================ */
#rpg-title-screen .settings-title-btn {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    border: 1px solid rgba(142,197,255,.24);
    background: linear-gradient(145deg, rgba(74,159,255,.14), rgba(168,85,247,.10));
    color: #eaf6ff;
    display: inline-grid;
    place-items: center;
    position: relative;
    cursor: pointer;
    box-shadow: 0 10px 26px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.10);
    transition: transform .18s ease, filter .18s ease, border-color .18s ease;
}
#rpg-title-screen .settings-title-btn:hover {
    transform: translateY(-2px) scale(1.04) rotate(4deg);
    border-color: rgba(142,197,255,.52);
    filter: brightness(1.16);
}
#rpg-title-screen .settings-title-btn .settings-icon { font-size: 1.35rem; filter: drop-shadow(0 0 8px rgba(142,197,255,.35)); }
#title-settings-modal {
    position: absolute;
    inset: 0;
    z-index: 100300;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: rgba(2, 8, 18, .58);
    backdrop-filter: blur(10px) saturate(1.15);
}
#title-settings-modal.active { display: flex; animation: titleSettingsFadeInV7102 .22s ease-out both; }
#title-settings-modal.closing { animation: titleSettingsFadeOutV7102 .18s ease-in forwards; }
.title-settings-window {
    width: min(680px, 94vw);
    max-height: min(620px, 88vh);
    overflow: auto;
    border-radius: 24px;
    background:
        radial-gradient(circle at 8% 0%, rgba(74,159,255,.18), transparent 34%),
        linear-gradient(145deg, rgba(12,26,50,.97), rgba(5,12,28,.985));
    border: 1px solid rgba(142,197,255,.34);
    box-shadow: 0 28px 90px rgba(0,0,0,.62), 0 0 35px rgba(74,159,255,.16), inset 0 1px 0 rgba(255,255,255,.12);
    color: #eaf6ff;
    font-family: 'VT323', monospace;
    animation: titleSettingsWindowInV7102 .28s cubic-bezier(.16,1,.36,1) both;
}
.title-settings-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid rgba(255,255,255,.10);
    background: linear-gradient(90deg, rgba(74,159,255,.20), rgba(168,85,247,.12));
}
.title-settings-head h3 { margin: 0; font-size: 1.35rem; letter-spacing: .8px; color: #fff; }
.title-settings-close {
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.07);
    color: #fff;
    border-radius: 12px;
    width: 36px;
    height: 36px;
    cursor: pointer;
}
.title-settings-body { padding: 16px; display: grid; gap: 12px; }
.title-setting-card {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 13px 14px;
    border-radius: 18px;
    background: rgba(255,255,255,.065);
    border: 1px solid rgba(255,255,255,.10);
}
.title-setting-title { font-size: 1.08rem; color: #fff; margin-bottom: 2px; }
.title-setting-desc { font-size: .86rem; color: rgba(215,232,255,.68); line-height: 1.25; }
.title-settings-select {
    min-width: 150px;
    padding: 9px 10px;
    border-radius: 12px;
    border: 1px solid rgba(142,197,255,.28);
    background: rgba(5,12,28,.85);
    color: #eaf6ff;
    font-family: 'VT323', monospace;
    font-size: 1rem;
}
.title-settings-toggle {
    width: 58px;
    height: 30px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.10);
    position: relative;
    cursor: pointer;
    transition: background .18s ease, border-color .18s ease;
}
.title-settings-toggle::after {
    content: '';
    position: absolute;
    width: 22px;
    height: 22px;
    left: 4px;
    top: 3px;
    border-radius: 50%;
    background: #dbeeff;
    box-shadow: 0 2px 8px rgba(0,0,0,.35);
    transition: transform .18s ease;
}
.title-settings-toggle.on { background: linear-gradient(135deg, rgba(34,197,94,.60), rgba(74,159,255,.38)); border-color: rgba(105,240,174,.52); }
.title-settings-toggle.on::after { transform: translateX(27px); }
.title-settings-footer {
    display:flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 16px 16px;
    border-top: 1px solid rgba(255,255,255,.09);
}
.title-settings-action {
    padding: 9px 14px;
    border-radius: 13px;
    border: 1px solid rgba(142,197,255,.28);
    background: rgba(74,159,255,.14);
    color: #eaf6ff;
    font-family: 'VT323', monospace;
    font-size: 1.02rem;
    cursor: pointer;
}
@keyframes titleSettingsFadeInV7102 { from{opacity:0} to{opacity:1} }
@keyframes titleSettingsFadeOutV7102 { from{opacity:1} to{opacity:0} }
@keyframes titleSettingsWindowInV7102 { from{opacity:0; transform:translateY(18px) scale(.96); filter:blur(3px)} to{opacity:1; transform:translateY(0) scale(1); filter:blur(0)} }
@media (max-width: 620px) { .title-setting-card { grid-template-columns: 1fr; } .title-settings-select { width: 100%; } }
</style>

<script>
/* ARENA HOTFIX v7.10.2: Title Settings + Main Menu Button Audit */
(function(){
    'use strict';
    const DEFAULTS = { performance:'balanced', particles:true, reducedMotion:false, fps:false, textSpeed:'normal' };

    function readSettings(){
        try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('bv_settings') || '{}'), window.BV_SETTINGS || {}); }
        catch(e){ return Object.assign({}, DEFAULTS, window.BV_SETTINGS || {}); }
    }
    function writeSetting(key, value){
        if (window.BVSettings && typeof window.BVSettings.set === 'function') window.BVSettings.set(key, value);
        else {
            const s = readSettings(); s[key] = value;
            try { localStorage.setItem('bv_settings', JSON.stringify(s)); } catch(e) {}
            window.BV_SETTINGS = s;
            document.body.classList.toggle('bv-settings-reduced-motion', !!s.reducedMotion);
            document.body.classList.toggle('bv-settings-performance', s.performance === 'performance');
        }
        if (typeof window.BVRecoverParticles === 'function') setTimeout(window.BVRecoverParticles, 80);
    }
    function ensureTitleSettingsButton(){
        const footer = document.querySelector('#rpg-title-screen .title-footer-buttons');
        if (!footer || document.getElementById('title-settings')) return;
        const btn = document.createElement('button');
        btn.className = 'settings-title-btn';
        btn.id = 'title-settings';
        btn.type = 'button';
        btn.title = 'Einstellungen';
        btn.innerHTML = '<span class="settings-icon">⚙️</span><span class="credits-pulse"></span>';
        footer.appendChild(btn);
        btn.addEventListener('click', openTitleSettings);
        if (typeof window.parseEmojis === 'function') window.parseEmojis(btn);
    }
    function ensureTitleSettingsModal(){
        let modal = document.getElementById('title-settings-modal');
        if (modal) return modal;
        const host = document.getElementById('rpg-game-window') || document.body;
        modal = document.createElement('div');
        modal.id = 'title-settings-modal';
        modal.innerHTML = '<div class="title-settings-window" role="dialog" aria-modal="true" aria-label="Einstellungen"><div class="title-settings-head"><h3>⚙️ Einstellungen</h3><button class="title-settings-close" type="button">✕</button></div><div class="title-settings-body" id="title-settings-body"></div><div class="title-settings-footer"><button class="title-settings-action" type="button" data-title-settings-reset>Standard</button><button class="title-settings-action" type="button" data-title-settings-close>Fertig</button></div></div>';
        host.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) closeTitleSettings(); });
        modal.querySelector('.title-settings-close')?.addEventListener('click', closeTitleSettings);
        modal.querySelector('[data-title-settings-close]')?.addEventListener('click', closeTitleSettings);
        modal.querySelector('[data-title-settings-reset]')?.addEventListener('click', () => {
            Object.entries(DEFAULTS).forEach(([k,v]) => writeSetting(k,v));
            renderTitleSettings();
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('active')) closeTitleSettings(); }, true);
        return modal;
    }
    function toggleHtml(key, title, desc){
        const s = readSettings();
        return '<div class="title-setting-card"><div><div class="title-setting-title">'+title+'</div><div class="title-setting-desc">'+desc+'</div></div><button type="button" class="title-settings-toggle '+(s[key]?'on':'')+'" data-ts-toggle="'+key+'" aria-label="'+title+'"></button></div>';
    }
    function renderTitleSettings(){
        const body = document.getElementById('title-settings-body');
        if (!body) return;
        const s = readSettings();
        body.innerHTML =
            '<div class="title-setting-card"><div><div class="title-setting-title">Leistung</div><div class="title-setting-desc">Balanced zeigt volle Effekte, Performance reduziert nur die Menge.</div></div><select class="title-settings-select" data-ts-select="performance"><option value="balanced" '+(s.performance==='balanced'?'selected':'')+'>Balanced</option><option value="performance" '+(s.performance==='performance'?'selected':'')+'>Performance</option></select></div>'+
            toggleHtml('particles','Partikel','Titel- und Map-Partikel anzeigen.')+
            toggleHtml('reducedMotion','Reduzierte Bewegung','Animationen und Partikel stark reduzieren.')+
            toggleHtml('fps','FPS-Anzeige','Kleine Performance-Anzeige einblenden.')+
            '<div class="title-setting-card"><div><div class="title-setting-title">Texttempo</div><div class="title-setting-desc">Tempo für Dialog-/Textbox-Anzeige.</div></div><select class="title-settings-select" data-ts-select="textSpeed"><option value="slow" '+(s.textSpeed==='slow'?'selected':'')+'>Langsam</option><option value="normal" '+(s.textSpeed==='normal'?'selected':'')+'>Normal</option><option value="fast" '+(s.textSpeed==='fast'?'selected':'')+'>Schnell</option><option value="instant" '+(s.textSpeed==='instant'?'selected':'')+'>Fast sofort</option></select></div>';
        body.querySelectorAll('[data-ts-toggle]').forEach(btn => btn.addEventListener('click', () => { const key = btn.dataset.tsToggle; writeSetting(key, !readSettings()[key]); renderTitleSettings(); }));
        body.querySelectorAll('[data-ts-select]').forEach(sel => sel.addEventListener('change', () => writeSetting(sel.dataset.tsSelect, sel.value)));
        if (typeof window.parseEmojis === 'function') window.parseEmojis(body);
    }
    function openTitleSettings(){
        const modal = ensureTitleSettingsModal();
        renderTitleSettings();
        modal.classList.remove('closing');
        modal.classList.add('active');
        if (typeof window.parseEmojis === 'function') window.parseEmojis(modal);
    }
    function closeTitleSettings(){
        const modal = document.getElementById('title-settings-modal');
        if (!modal || !modal.classList.contains('active')) return;
        modal.classList.add('closing');
        setTimeout(() => modal.classList.remove('active','closing'), 190);
    }

    function bindMainMenuButtons(){
        const menu = document.getElementById('rpg-menu-screen');
        if (!menu || menu.dataset.bvButtonAudit === '1') return;
        menu.dataset.bvButtonAudit = '1';
        menu.querySelectorAll('button').forEach(b => { if (!b.type) b.type = 'button'; });
        const bind = (selector, fn) => {
            const el = menu.querySelector(selector);
            if (!el) return console.warn('[BV Button Audit] Button fehlt:', selector);
            el.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); if (typeof fn === 'function') fn(); }, true);
        };
        bind('.menu-btn.save', () => window.saveGame?.());
        bind('.menu-btn.load', () => window.loadGame?.());
        bind('.menu-footer .menu-btn:not(.save):not(.load):not(.danger)', () => window.closeMenu?.());
        bind('.menu-btn.danger', () => window.showQuitOptions?.());
        document.getElementById('quit-to-title')?.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); window.goToTitleFromMenu?.(); }, true);
        document.getElementById('quit-close-window')?.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); window.closeQuitOptions?.(); window.quitGame?.(); }, true);
        document.getElementById('quit-cancel')?.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); window.closeQuitOptions?.(); }, true);
        console.info('[BV Button Audit] Hauptmenü-Buttons geprüft/abgesichert.');
    }

    function init(){
        ensureTitleSettingsButton();
        ensureTitleSettingsModal();
        bindMainMenuButtons();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
    window.BVTitleSettings = { open: openTitleSettings, close: closeTitleSettings, render: renderTitleSettings };
    window.BVButtonAudit = { run: bindMainMenuButtons };
})();
</script>

<style>
/* ============================================================
   ARENA HOTFIX v7.10.3: Partikel-Aus wirklich aus + Title Settings wie Hauptmenü
   ============================================================ */
body.bv-settings-particles-off #rpg-fx-particles,
body.bv-settings-particles-off .title-particles,
body.bv-settings-particles-off .splash-bg-canvas,
body.bv-settings-particles-off .title-canvas-bg {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
}
#title-settings-modal .settings-panel { padding: 0; }
#title-settings-modal .settings-hero {
    display:flex; gap:12px; align-items:center;
    padding:14px;
    border-radius:18px;
    background:linear-gradient(135deg, rgba(74,159,255,.18), rgba(168,85,247,.12));
    border:1px solid rgba(142,197,255,.22);
}
#title-settings-modal .settings-hero-icon { font-size:2rem; }
#title-settings-modal .settings-hero h3 { margin:0; color:#fff; font-size:1.25rem; }
#title-settings-modal .settings-hero p { margin:3px 0 0; color:rgba(215,232,255,.70); font-size:.88rem; }
#title-settings-modal .settings-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:12px; }
#title-settings-modal .setting-card {
    padding:13px 14px;
    border-radius:18px;
    background:rgba(255,255,255,.065);
    border:1px solid rgba(255,255,255,.10);
}
#title-settings-modal .setting-title { font-size:1.08rem; color:#fff; margin-bottom:3px; }
#title-settings-modal .setting-desc { font-size:.84rem; color:rgba(215,232,255,.68); line-height:1.25; margin-bottom:9px; }
#title-settings-modal .setting-control { display:flex; justify-content:space-between; align-items:center; gap:10px; }
#title-settings-modal .setting-select,
#title-settings-modal .setting-button {
    width:100%; padding:9px 10px; border-radius:12px;
    border:1px solid rgba(142,197,255,.28);
    background:rgba(5,12,28,.85); color:#eaf6ff;
    font-family:'VT323', monospace; font-size:1rem;
}
#title-settings-modal .setting-button { cursor:pointer; background:rgba(74,159,255,.14); }
#title-settings-modal .setting-toggle {
    width:58px; height:30px; border-radius:999px; border:1px solid rgba(255,255,255,.16);
    background:rgba(255,255,255,.10); position:relative; cursor:pointer;
}
#title-settings-modal .setting-toggle::after {
    content:''; position:absolute; width:22px; height:22px; left:4px; top:3px; border-radius:50%;
    background:#dbeeff; box-shadow:0 2px 8px rgba(0,0,0,.35); transition:transform .18s ease;
}
#title-settings-modal .setting-toggle.on { background:linear-gradient(135deg, rgba(34,197,94,.60), rgba(74,159,255,.38)); border-color:rgba(105,240,174,.52); }
#title-settings-modal .setting-toggle.on::after { transform:translateX(27px); }
@media (max-width:680px){ #title-settings-modal .settings-grid{ grid-template-columns:1fr; } }
</style>

<script>
/* ARENA HOTFIX v7.10.3: Title Settings an Hauptmenü angleichen + Partikel-Aus Bugfix */
(function(){
    'use strict';
    const DEFAULTS = { performance:'balanced', particles:true, reducedMotion:false, fps:false, textSpeed:'normal' };
    function getSettings(){
        try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('bv_settings') || '{}'), window.BV_SETTINGS || {}); }
        catch(e){ return Object.assign({}, DEFAULTS, window.BV_SETTINGS || {}); }
    }
    function saveAll(s){
        try { localStorage.setItem('bv_settings', JSON.stringify(s)); } catch(e) {}
        window.BV_SETTINGS = s;
    }
    function syncParticleVisibility(){
        const s = getSettings();
        const off = s.particles === false || s.reducedMotion === true;
        document.body.classList.toggle('bv-settings-particles-off', off);
        if (off) {
            document.querySelector('#rpg-title-screen .title-particles')?.replaceChildren();
            document.querySelector('#rpg-fx-particles')?.replaceChildren();
            const splashCanvas = document.getElementById('splash-canvas');
            if (splashCanvas) splashCanvas.style.display = 'none';
            const titleCanvas = document.getElementById('title-canvas');
            if (titleCanvas) titleCanvas.style.display = 'none';
        } else {
            const splashCanvas = document.getElementById('splash-canvas');
            if (splashCanvas) splashCanvas.style.display = '';
            const titleCanvas = document.getElementById('title-canvas');
            if (titleCanvas) titleCanvas.style.display = '';
            if (typeof window.BVRecoverParticles === 'function') setTimeout(window.BVRecoverParticles, 60);
        }
    }
    function setSettingFixed(key, value){
        if (window.BVSettings && typeof window.BVSettings.set === 'function') window.BVSettings.set(key, value);
        else { const s = getSettings(); s[key] = value; saveAll(s); }
        syncParticleVisibility();
    }
    function toggleHtml(key, label, desc) {
        const s = getSettings();
        return '<div class="setting-card"><div class="setting-title">'+label+'</div><div class="setting-desc">'+desc+'</div><div class="setting-control"><span>'+(s[key] ? 'An' : 'Aus')+'</span><button class="setting-toggle '+(s[key] ? 'on' : '')+'" data-title-setting-toggle="'+key+'" type="button"></button></div></div>';
    }
    function renderTitleSettingsLikeMain(){
        const body = document.getElementById('title-settings-body');
        if (!body) return false;
        const s = getSettings();
        body.innerHTML = '<div class="settings-panel">'+
            '<div class="settings-hero"><div class="settings-hero-icon">⚙️</div><div><h3>Spiel-Einstellungen</h3><p>Die gleichen Optionen wie im Hauptmenü — direkt vor dem Start.</p></div></div>'+
            '<div class="settings-grid">'+
            '<div class="setting-card"><div class="setting-title">🚀 Performance-Profil</div><div class="setting-desc">Performance reduziert teure Hintergrundeffekte, ohne Partikel komplett zu entfernen.</div><select class="setting-select" data-title-setting-select="performance"><option value="high" '+(s.performance==='high'?'selected':'')+'>Hoch / Schön</option><option value="balanced" '+(s.performance==='balanced'?'selected':'')+'>Ausgewogen</option><option value="performance" '+(s.performance==='performance'?'selected':'')+'>Performance</option></select></div>'+
            toggleHtml('particles','✨ Partikel','Schaltet Titel-, Splash- und Map-Partikel wirklich ein oder aus.')+
            toggleHtml('reducedMotion','🎞️ Reduzierte Hintergrundanimationen','Blendet nicht notwendige Ambient-Animationen aus.')+
            toggleHtml('fps','📊 FPS-Counter','Zeigt FPS und Framezeit oben links an.')+
            '<div class="setting-card"><div class="setting-title">💬 Textgeschwindigkeit</div><div class="setting-desc">Bestimmt, wie lange Dialogtext wartet, bevor Enter weitergeht.</div><select class="setting-select" data-title-setting-select="textSpeed"><option value="slow" '+(s.textSpeed==='slow'?'selected':'')+'>Langsam</option><option value="normal" '+(s.textSpeed==='normal'?'selected':'')+'>Normal</option><option value="fast" '+(s.textSpeed==='fast'?'selected':'')+'>Schnell</option><option value="instant" '+(s.textSpeed==='instant'?'selected':'')+'>Fast sofort</option></select></div>'+
            '<div class="setting-card"><div class="setting-title">♻️ Zurücksetzen</div><div class="setting-desc">Setzt alle Optionen auf Standard zurück.</div><button class="setting-button" data-title-settings-reset-fixed type="button">Standard wiederherstellen</button></div>'+
            '</div></div>';
        body.querySelectorAll('[data-title-setting-toggle]').forEach(btn => btn.addEventListener('click', () => { const key = btn.dataset.titleSettingToggle; setSettingFixed(key, !getSettings()[key]); renderTitleSettingsLikeMain(); }));
        body.querySelectorAll('[data-title-setting-select]').forEach(sel => sel.addEventListener('change', () => { setSettingFixed(sel.dataset.titleSettingSelect, sel.value); renderTitleSettingsLikeMain(); }));
        body.querySelector('[data-title-settings-reset-fixed]')?.addEventListener('click', () => { Object.entries(DEFAULTS).forEach(([k,v]) => setSettingFixed(k,v)); renderTitleSettingsLikeMain(); });
        if (typeof window.parseEmojis === 'function') window.parseEmojis(body);
        return true;
    }
    function installOverride(){
        syncParticleVisibility();
        const btn = document.getElementById('title-settings');
        if (btn && btn.dataset.fixedOverride !== '1') {
            btn.dataset.fixedOverride = '1';
            btn.addEventListener('click', () => setTimeout(renderTitleSettingsLikeMain, 0), true);
        }
        const modal = document.getElementById('title-settings-modal');
        if (modal && modal.classList.contains('active')) renderTitleSettingsLikeMain();
    }
    // BVSettings.set wrappen, damit auch Hauptmenü-Änderungen Partikel sofort korrekt aus/an machen.
    function wrapSettings(){
        if (!window.BVSettings || window.BVSettings._particleFixed) return;
        const oldSet = window.BVSettings.set;
        if (typeof oldSet === 'function') {
            window.BVSettings.set = function(k,v){ const r = oldSet.apply(this, arguments); syncParticleVisibility(); return r; };
        }
        const oldApply = window.BVSettings.apply;
        if (typeof oldApply === 'function') {
            window.BVSettings.apply = function(){ const r = oldApply.apply(this, arguments); syncParticleVisibility(); return r; };
        }
        window.BVSettings._particleFixed = true;
    }
    window.BVSyncParticleVisibility = syncParticleVisibility;
    window.BVRenderTitleSettingsLikeMain = renderTitleSettingsLikeMain;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { wrapSettings(); installOverride(); }, { once:true });
    else { wrapSettings(); installOverride(); }
    setInterval(() => { wrapSettings(); syncParticleVisibility(); }, 1200);
})();
</script>


<script>
/* ARENA HOTFIX v7.10.4: Hauptmenü-Karte Anzeigenamen stabil */
(function(){
    'use strict';
    const NAMES = {
        buero: 'Hauptbüro - Einkauf', flur: 'Hauptflur', pausenraum: 'Pausenraum', kantine: 'Kantine',
        lager: 'Lager', serverraum: 'Serverraum', konferenz: 'Konferenzraum', zentrale: 'Zentrale - IT Hub',
        archiv: 'Archivraum', dach: 'Dachterrasse', boss_office: 'Chefbüro',
        secret_room: '??? Geheimraum'
    };
    function fixMapTitleName(){
        const rt = (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
        const id = rt.currentMapId || window.currentMapId;
        const name = (window.MAPS && window.MAPS[id] && window.MAPS[id].name) || NAMES[id];
        if (!name) return;
        const title = document.querySelector('#rpg-menu-screen #tab-map .menu-map-title');
        const spans = title ? title.querySelectorAll('span') : [];
        if (spans.length >= 2) spans[1].textContent = name;
    }
    const old = window.BVStableMenuTabs && window.BVStableMenuTabs.redrawMap;
    if (old && !old._nameFixed) {
        const wrapped = function(){ const r = old.apply(this, arguments); fixMapTitleName(); setTimeout(fixMapTitleName, 0); return r; };
        wrapped._nameFixed = true;
        window.BVStableMenuTabs.redrawMap = wrapped;
    }
    document.addEventListener('click', e => {
        if (e.target.closest && e.target.closest('#rpg-menu-screen .menu-tab[data-tab="map"]')) {
            setTimeout(fixMapTitleName, 20);
            setTimeout(fixMapTitleName, 160);
        }
    }, true);
    window.BVFixMenuMapTitleName = fixMapTitleName;
})();
</script>


<style>
/* ARENA HOTFIX v7.10.5: Hauptmenü-Karte Canvas stabil */
#rpg-menu-screen.menu-map-mode #menu-current-map-canvas {
    display: block !important;
    width: 100% !important;
    height: auto !important;
    max-height: 100% !important;
    object-fit: contain !important;
    image-rendering: pixelated;
}
</style>

<script>
/* ARENA HOTFIX v7.10.5: Menu Map Canvas + aktive Kategorie No-Op */
(function(){
    'use strict';
    const MAP_NAMES = {
        buero:'Hauptbüro - Einkauf', flur:'Hauptflur', pausenraum:'Pausenraum', zentrale:'Zentrale - IT Hub',
        kantine:'Kantine', lager:'Lager', serverraum:'Serverraum', konferenz:'Konferenzraum', archiv:'Archivraum',
        dach:'Dachterrasse', boss_office:'Chefbüro', secret_room:'??? Geheimraum'
    };
    function rt(){ return (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {}; }
    function correctMapCanvasAndTitle(){
        const r = rt();
        const id = r.currentMapId || window.currentMapId || 'buero';
        const title = document.querySelector('#rpg-menu-screen #tab-map .menu-map-title');
        const spans = title ? title.querySelectorAll('span') : [];
        const name = (window.MAPS && window.MAPS[id] && window.MAPS[id].name) || MAP_NAMES[id] || id;
        if (spans.length >= 2) spans[1].textContent = name;
        const canvas = document.getElementById('menu-current-map-canvas');
        if (canvas) {
            canvas.style.display = 'block';
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            canvas.style.maxHeight = '100%';
            canvas.style.objectFit = 'contain';
            canvas.style.imageRendering = 'pixelated';
            // Falls ein späterer Render ein 0x0-Canvas erzeugt hat: Karte neu zeichnen lassen.
            if ((!canvas.width || !canvas.height) && window.BVStableMenuTabs?.redrawMap) setTimeout(() => window.BVStableMenuTabs.redrawMap(), 0);
        }
    }
    // Aktive Kategorie anklicken: früh abbrechen, damit kein späterer Handler die Karte neu kaputt rendert.
    document.addEventListener('click', e => {
        const btn = e.target.closest && e.target.closest('#rpg-menu-screen .menu-tab');
        if (!btn) return;
        if (btn.classList.contains('active')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }
        if (btn.dataset.tab === 'map') {
            setTimeout(correctMapCanvasAndTitle, 40);
            setTimeout(correctMapCanvasAndTitle, 220);
        }
    }, true);
    window.BVFixMenuMapCanvas = correctMapCanvasAndTitle;
})();
</script>


<style>
/* ============================================================
   ARENA HOTFIX v7.10.8: Hauptmenü Guard / No-Glitch Safety
   - verhindert Doppelaktionen durch alte Inline-Handler
   - räumt hängende Menü-Modusklassen nach Öffnen/Schließen auf
   - blockiert WASD/Pfeile im Menü wirklich, ohne Settings-Eingaben zu stören
   ============================================================ */
#rpg-menu-screen:not(.active) {
    pointer-events: none !important;
}
#rpg-menu-screen.active .menu-tab[aria-selected="true"] {
    cursor: default;
}
#rpg-menu-screen.active .menu-tab-content:not(.active) {
    display: none !important;
}
</style>

<script>
/* ARENA HOTFIX v7.10.8: Hauptmenü Guard / No-Glitch Safety */
(function(){
    'use strict';
    const MODE_CLASSES = [
        'menu-status-mode','menu-inventory-mode','menu-team-mode','menu-map-mode',
        'menu-quest-mode','menu-settings-mode','menu-shift-mode','menu-skills-mode','menu-achievement-mode'
    ];
    const TRANSIENT_CLASSES = ['menu-opening','menu-closing','menu-switching','menu-animating'];
    const MOVE_KEYS = new Set(['w','a','s','d','W','A','S','D','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);

    function screen(){ return document.getElementById('rpg-menu-screen'); }
    function isActive(){ const s = screen(); return !!(s && s.classList.contains('active')); }
    function modeFor(tab){
        if (tab === 'inventory') return 'menu-inventory-mode';
        if (tab === 'team') return 'menu-team-mode';
        if (tab === 'map') return 'menu-map-mode';
        if (tab === 'quests') return 'menu-quest-mode';
        if (tab === 'settings') return 'menu-settings-mode';
        if (tab === 'shift') return 'menu-shift-mode';
        if (tab === 'skills') return 'menu-skills-mode';
        if (tab === 'achievements') return 'menu-achievement-mode';
        return 'menu-status-mode';
    }
    function typingTarget(el){
        return !!(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || '')));
    }
    function normalizeTabs(){
        const s = screen();
        if (!s) return;
        const tabs = Array.from(s.querySelectorAll('.menu-tab'));
        const contents = Array.from(s.querySelectorAll('.menu-tab-content'));
        tabs.forEach(btn => { btn.type = 'button'; btn.setAttribute('role','tab'); });
        const activeBtn = tabs.find(t => t.classList.contains('active')) || tabs[0];
        const activeTab = activeBtn?.dataset.tab || 'status';
        const activeContent = document.getElementById('tab-' + activeTab) || contents[0];
        tabs.forEach(t => {
            const on = t === activeBtn;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
            t.tabIndex = on ? 0 : -1;
        });
        contents.forEach(c => c.classList.toggle('active', c === activeContent));
        s.classList.remove(...MODE_CLASSES);
        if (s.classList.contains('active')) s.classList.add(modeFor(activeTab));
    }
    function cleanupClosedMenu(){
        const s = screen();
        if (!s || s.classList.contains('active')) return;
        s.classList.remove(...MODE_CLASSES, ...TRANSIENT_CLASSES, 'quit-active');
    }
    function normalizeMenuSoon(){
        setTimeout(normalizeTabs, 0);
        setTimeout(normalizeTabs, 80);
        setTimeout(cleanupClosedMenu, 280);
    }

    // Wrap open/close after all older menu patches. This is intentionally defensive.
    function wrapMenuFunctions(){
        if (typeof window.openMenu === 'function' && !window.openMenu._bvMainGuardWrapped) {
            const oldOpen = window.openMenu;
            window.openMenu = function(){
                const r = oldOpen.apply(this, arguments);
                normalizeMenuSoon();
                return r;
            };
            window.openMenu._bvMainGuardWrapped = true;
        }
        if (typeof window.closeMenu === 'function' && !window.closeMenu._bvMainGuardWrapped) {
            const oldClose = window.closeMenu;
            window.closeMenu = function(){
                const r = oldClose.apply(this, arguments);
                setTimeout(cleanupClosedMenu, arguments[0] ? 0 : 260);
                setTimeout(cleanupClosedMenu, 520);
                return r;
            };
            window.closeMenu._bvMainGuardWrapped = true;
        }
    }

    // Capture before the original bubble key handler can record movement keys.
    document.addEventListener('keydown', function(e){
        if (!isActive()) return;
        if (typingTarget(document.activeElement)) return;
        if (MOVE_KEYS.has(e.key)) {
            e.preventDefault();
            // A/D and ArrowLeft/Right are already handled by the stable tab navigator if needed.
            // Everything else must not reach the map movement handler.
            e.stopImmediatePropagation();
        }
    }, true);

    // If an active tab is clicked again, keep it a true no-op and avoid old delegated handlers.
    document.addEventListener('click', function(e){
        const btn = e.target.closest && e.target.closest('#rpg-menu-screen .menu-tab.active');
        if (!btn) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        btn.blur?.();
    }, true);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { wrapMenuFunctions(); normalizeTabs(); }, { once:true });
    } else {
        wrapMenuFunctions();
        normalizeTabs();
    }
    setTimeout(wrapMenuFunctions, 120);
    window.BVMainMenuGuard = { normalize: normalizeTabs, cleanup: cleanupClosedMenu, wrap: wrapMenuFunctions };
})();
</script>


<style>
/* ============================================================
   ARENA HOTFIX v7.10.9: menu-current-map-canvas robuster Render
   - nutzt echte TILES/MAPS Metadaten auch nach Tab-Wechsel
   - rendert nach Layout/Animation erneut, damit Canvas nicht halb/alt bleibt
   - verhindert kaputte Map-Darstellung bei Quests/Settings/Map-Wechseln
   ============================================================ */
#rpg-menu-screen.menu-map-mode #world-map,
#rpg-menu-screen.menu-map-mode .menu-current-map-wrap,
#rpg-menu-screen.menu-map-mode .menu-map-panel {
    min-width: 0 !important;
}
#rpg-menu-screen.menu-map-mode #menu-current-map-canvas {
    display: block !important;
    width: 100% !important;
    height: auto !important;
    max-width: 100% !important;
    max-height: calc(100% - 34px) !important;
    object-fit: contain !important;
    image-rendering: pixelated !important;
}
#rpg-menu-screen .menu-map-title span:last-child {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>

<script>
/* ARENA HOTFIX v7.10.9: Robust Menu Map Canvas Renderer */
(function(){
    'use strict';
    const MAP_NAMES = {
        buero:'Hauptbüro - Einkauf', flur:'Hauptflur', pausenraum:'Pausenraum', zentrale:'Zentrale - IT Hub',
        kantine:'Kantine', lager:'Lager', serverraum:'Serverraum', konferenz:'Konferenzraum', archiv:'Archivraum',
        dach:'Dachterrasse', boss_office:'Chefbüro', secret_room:'??? Geheimraum'
    };
    const TILE_FALLBACK = {
        0:{bg:'#8090a8', name:'floor'}, 1:{bg:'#2a3444', block:true, name:'wall'},
        2:{bg:'#5d4037', block:true, name:'desk'}, 3:{bg:'#2e7d32', block:true, name:'plant'},
        4:{bg:'#6a7a8a', name:'carpet'}, 5:{bg:'#8090a8', name:'rug'},
        6:{bg:'#4a7c59', name:'door_normal'}, 7:{bg:'#c9a227', name:'door_boss'},
        8:{bg:'#5c6bc0', block:true, name:'cabinet'}, 9:{bg:'#607d8b', block:true, name:'printer'},
        10:{bg:'#455a64', block:true, name:'shelf'}, 11:{bg:'#6d4c41', block:true, name:'chair'},
        12:{bg:'#78909c', block:true, name:'window'}, 13:{bg:'#90a4ae', name:'floor_light'},
        14:{bg:'#37474f', block:true, name:'server'}, 15:{bg:'#8d6e63', block:true, name:'couch'},
        16:{bg:'#546e7a', name:'floor_tile'}, 17:{bg:'#455a64', block:true, name:'pillar'},
        18:{bg:'#78909c', name:'floor_dark'}, 19:{bg:'#4db6ac', block:true, name:'water_cooler'},
        20:{bg:'#ff7043', block:true, name:'vending'}
    };
    let lastRenderSig = '';

    function rt(){
        try { return (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {}; }
        catch(e){ return {}; }
    }
    function data(){
        const r = rt();
        return {
            r,
            map: r.currentMap || window.currentMap || [],
            mapId: r.currentMapId || window.currentMapId || 'buero',
            player: r.player || window.player || {},
            npcs: r.npcs || window.npcs || [],
            chests: r.currentChests || window.currentChests || [],
            tiles: r.TILES || window.TILES || TILE_FALLBACK,
            maps: r.MAPS || window.MAPS || {}
        };
    }
    function tileMeta(tiles, id){ return (tiles && tiles[id]) || TILE_FALLBACK[id] || TILE_FALLBACK[0]; }
    function isDoorTile(meta, id){ return id === 6 || id === 7 || String(meta?.name || '').toLowerCase().includes('door'); }
    function mapName(d){ return (d.maps && d.maps[d.mapId] && d.maps[d.mapId].name) || MAP_NAMES[d.mapId] || d.mapId || 'Unbekannt'; }
    function host(){ return document.getElementById('world-map') || document.querySelector('#tab-map .world-map'); }
    function screenActiveMap(){
        const s = document.getElementById('rpg-menu-screen');
        return !!(s && s.classList.contains('active') && document.querySelector('#rpg-menu-screen .menu-tab[data-tab="map"]')?.classList.contains('active'));
    }
    function colorForTile(id, meta){
        if (isDoorTile(meta, id)) return '#e9c949';
        if (meta?.block) return '#203044';
        if (id === 3) return '#2e7d51';
        if ([4,5,13,16,18].includes(Number(id))) return '#6d82a0';
        return meta?.bg || '#58708a';
    }
    function setPixelRatioCanvas(canvas, cssW, cssH){
        const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
        canvas.width = Math.max(1, Math.round(cssW * dpr));
        canvas.height = Math.max(1, Math.round(cssH * dpr));
        // CSS füllt das Panel; width/height Attribute halten nur das Seitenverhältnis/Renderbuffer.
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return ctx;
    }

    function robustRedrawMapCanvas(force){
        const h = host();
        if (!h) return false;
        const d = data();
        if (d.mapId === 'secret_room') {
            h.innerHTML = '<div class="menu-current-map-wrap"><div class="menu-map-title"><span>🗺️ Aktueller Standort</span><span>??? Geheimraum</span></div><div class="menu-map-panel" style="min-height:180px;display:flex;align-items:center;justify-content:center;color:#ffb4b4;font-family:\'VT323\',monospace;font-size:1.4rem;text-align:center;">📡 Keine Kartendaten verfügbar.<br>Dieser Raum existiert offiziell nicht.</div></div>';
            window.parseEmojis?.(h);
            return true;
        }
        const map = Array.isArray(d.map) ? d.map : [];
        const rows = map.length;
        const cols = rows ? (map[0]?.length || 1) : 0;
        if (!rows || !cols) {
            h.innerHTML = '<div class="menu-current-map-wrap"><div class="menu-map-title"><span>🗺️ Aktueller Standort</span><span>' + mapName(d) + '</span></div><div class="menu-map-panel" style="min-height:160px;display:flex;align-items:center;justify-content:center;color:#ffd166;">Kartendaten werden geladen...</div></div>';
            window.parseEmojis?.(h);
            return false;
        }

        const sig = d.mapId + ':' + cols + 'x' + rows + ':' + (d.player.x ?? '?') + ',' + (d.player.y ?? '?') + ':' + d.npcs.length + ':' + d.chests.length;
        let canvas = document.getElementById('menu-current-map-canvas');
        if (!canvas || !h.contains(canvas)) {
            h.innerHTML = '<div class="menu-current-map-wrap"><div class="menu-map-title"><span>🗺️ Aktueller Standort</span><span>' + mapName(d) + '</span></div><div class="menu-map-panel"><canvas id="menu-current-map-canvas"></canvas><div class="menu-map-legend"><span>🟢 Du</span><span>🔵 NPC</span><span>🔴 Gegner</span><span>🟡 Tür</span><span>📦 Kiste</span></div></div></div>';
            canvas = document.getElementById('menu-current-map-canvas');
            window.parseEmojis?.(h);
            lastRenderSig = '';
        } else {
            const spans = h.querySelectorAll('.menu-map-title span');
            if (spans.length >= 2) spans[1].textContent = mapName(d);
        }
        if (!canvas) return false;
        const panel = canvas.closest('.menu-map-panel') || h;
        const panelW = Math.max(280, Math.floor(panel.clientWidth || h.clientWidth || 620));
        const availableH = Math.max(180, Math.floor((panel.clientHeight || 380) - 34));
        const scale = Math.max(5, Math.min(20, Math.floor(Math.min((panelW - 18) / cols, availableH / rows))));
        const cssW = cols * scale, cssH = rows * scale;

        // Auch bei gleicher Map neu zeichnen, wenn Canvas durch Tab-Wechsel eine falsche Größe bekam.
        const sizeSig = cssW + 'x' + cssH + ':' + canvas.width + 'x' + canvas.height;
        if (!force && lastRenderSig === sig + ':' + sizeSig) return true;
        lastRenderSig = sig + ':' + sizeSig;

        const ctx = setPixelRatioCanvas(canvas, cssW, cssH);
        ctx.clearRect(0, 0, cssW, cssH);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const id = map[y]?.[x] ?? 0;
                const meta = tileMeta(d.tiles, id);
                ctx.fillStyle = colorForTile(Number(id), meta);
                ctx.fillRect(x * scale, y * scale, scale, scale);
                if (isDoorTile(meta, Number(id))) {
                    ctx.fillStyle = 'rgba(255,255,255,.26)';
                    ctx.fillRect(x * scale + scale*.34, y * scale + scale*.18, Math.max(1, scale*.32), scale*.64);
                }
            }
        }
        ctx.strokeStyle = 'rgba(255,255,255,.075)'; ctx.lineWidth = 1;
        for (let x = 0; x <= cols; x++) { ctx.beginPath(); ctx.moveTo(x*scale+.5,0); ctx.lineTo(x*scale+.5,rows*scale); ctx.stroke(); }
        for (let y = 0; y <= rows; y++) { ctx.beginPath(); ctx.moveTo(0,y*scale+.5); ctx.lineTo(cols*scale,y*scale+.5); ctx.stroke(); }
        d.chests.forEach(c => {
            if (!c || c.opened) return;
            ctx.fillStyle = c.type === 'rare' ? '#d946ef' : '#f59e0b';
            ctx.fillRect(c.x*scale+scale*.18, c.y*scale+scale*.18, Math.max(2, scale*.64), Math.max(2, scale*.64));
        });
        d.npcs.forEach(n => {
            if (!n || typeof n.x !== 'number' || typeof n.y !== 'number') return;
            ctx.fillStyle = n.type === 'enemy' ? '#ef4444' : (n.type === 'shop' || n.type === 'skillshop' ? '#facc15' : '#38bdf8');
            ctx.beginPath(); ctx.arc(n.x*scale+scale/2, n.y*scale+scale/2, Math.max(2.5, scale*.36), 0, Math.PI*2); ctx.fill();
        });
        if (typeof d.player.x === 'number' && typeof d.player.y === 'number') {
            ctx.fillStyle = '#22c55e';
            ctx.beginPath(); ctx.arc(d.player.x*scale+scale/2, d.player.y*scale+scale/2, Math.max(3.5, scale*.45), 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        }
        canvas.dataset.mapId = d.mapId;
        canvas.dataset.rendered = String(Date.now());
        return true;
    }

    function scheduleMapRedraw(){
        if (!screenActiveMap()) return;
        lastRenderSig = '';
        requestAnimationFrame(() => robustRedrawMapCanvas(true));
        setTimeout(() => robustRedrawMapCanvas(true), 80);
        setTimeout(() => robustRedrawMapCanvas(true), 220);
        setTimeout(() => robustRedrawMapCanvas(true), 520);
    }
    function install(){
        if (window.BVStableMenuTabs && !window.BVStableMenuTabs._mapCanvasRobustV7109) {
            const oldRedraw = window.BVStableMenuTabs.redrawMap;
            window.BVStableMenuTabs.redrawMap = function(){
                // Original darf laufen, danach korrigieren wir mit echten Metadaten/Layout.
                try { if (typeof oldRedraw === 'function') oldRedraw.apply(this, arguments); } catch(e) { console.warn('[BV Map Canvas] old redraw failed:', e); }
                return robustRedrawMapCanvas(true);
            };
            window.BVStableMenuTabs._mapCanvasRobustV7109 = true;
        }
        if (typeof window.openMenu === 'function' && !window.openMenu._mapCanvasRobustV7109) {
            const oldOpen = window.openMenu;
            window.openMenu = function(){ const r = oldOpen.apply(this, arguments); setTimeout(scheduleMapRedraw, 120); return r; };
            window.openMenu._mapCanvasRobustV7109 = true;
        }
    }
    document.addEventListener('click', e => {
        const btn = e.target.closest && e.target.closest('#rpg-menu-screen .menu-tab[data-tab="map"]');
        if (btn) setTimeout(scheduleMapRedraw, 0);
    }, true);
    window.addEventListener('resize', () => setTimeout(scheduleMapRedraw, 80));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true }); else install();
    setTimeout(install, 150);
    window.BVRobustMenuMapCanvas = { redraw: robustRedrawMapCanvas, schedule: scheduleMapRedraw, install };
})();
</script>


<style>
/* ============================================================
   ARENA HOTFIX v7.10.10: Hauptmenü Tabs/Header Fix + Map Instant Redraw
   - menu-tabs bleiben stehen; nur aktiver Inhalt scrollt
   - title-settings-head bleibt stehen; nur Body scrollt
   - menu-current-map-canvas wird sofort robust neu gezeichnet, wenn Menü mit Karte öffnet
   ============================================================ */
#rpg-menu-screen .menu-window {
    overflow: hidden !important;
}
#rpg-menu-screen .menu-body {
    display: flex !important;
    flex-direction: column !important;
    min-height: 0 !important;
    overflow: hidden !important;
}
#rpg-menu-screen .menu-tabs {
    flex: 1 !important;
    position: relative !important;
    z-index: 30 !important;
    overflow-x: auto !important;
    scrollbar-width: none !important;
}
#rpg-menu-screen .menu-tabs::-webkit-scrollbar { display: none !important; }
#rpg-menu-screen .menu-tab-content {
    min-height: 0 !important;
    overflow: hidden !important;
}
#rpg-menu-screen .menu-tab-content.active {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
}
#rpg-menu-screen.menu-status-mode .menu-tab-content.active {
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
}
#rpg-menu-screen.menu-achievement-mode .menu-tab-content.active,
#rpg-menu-screen.menu-skills-mode .menu-tab-content.active {
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
}
#rpg-menu-screen.menu-map-mode .menu-tab-content.active,
#rpg-menu-screen.menu-map-mode #tab-map.menu-tab-content.active {
    overflow: hidden !important;
}
#rpg-menu-screen .menu-tab-content.active::-webkit-scrollbar { width: 8px; }
#rpg-menu-screen .menu-tab-content.active::-webkit-scrollbar-thumb {
    border-radius: 99px;
    background: rgba(142,197,255,.34);
}

#title-settings-modal .title-settings-window {
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
    min-height: 0 !important;
}
#title-settings-modal .title-settings-head {
    flex: 0 0 auto !important;
    position: sticky !important;
    top: 0 !important;
    z-index: 5 !important;
}
#title-settings-modal .title-settings-body {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
}
#title-settings-modal .title-settings-footer {
    flex: 0 0 auto !important;
}
</style>

<script>
/* ARENA HOTFIX v7.10.10: Map Tab Instant Redraw + Scroll Guards */
(function(){
    'use strict';
    function menu(){ return document.getElementById('rpg-menu-screen'); }
    function activeTab(){ return document.querySelector('#rpg-menu-screen .menu-tab.active')?.dataset.tab || 'status'; }
    function mapIsActive(){ const m = menu(); return !!(m && m.classList.contains('active') && activeTab() === 'map'); }
    function forceMapRedraw(){
        if (!mapIsActive()) return;
        try {
            window.BVRobustMenuMapCanvas?.redraw?.(true);
            window.BVRobustMenuMapCanvas?.schedule?.();
        } catch(e) {
            console.warn('[BV Menu Map] robust redraw failed:', e);
        }
    }
    function protectTabsScroll(){
        const head = document.querySelector('#title-settings-modal .title-settings-head');
        if (head) { head.scrollTop = 0; head.scrollLeft = 0; }
    }
    function wrapOpenMenu(){
        if (typeof window.openMenu !== 'function' || window.openMenu._bvMapInstantV71010) return;
        const oldOpen = window.openMenu;
        window.openMenu = function(){
            const r = oldOpen.apply(this, arguments);
            // Wichtig: Wenn das Menü bereits mit Kategorie "Karte" öffnet, war kurz der alte Renderer sichtbar.
            // Sofort nach originalem openMenu ersetzen, danach nochmal nach Layout/Animation.
            forceMapRedraw();
            requestAnimationFrame(forceMapRedraw);
            setTimeout(forceMapRedraw, 40);
            setTimeout(forceMapRedraw, 140);
            setTimeout(forceMapRedraw, 360);
            setTimeout(protectTabsScroll, 0);
            return r;
        };
        window.openMenu._bvMapInstantV71010 = true;
    }
    function observeWorldMap(){
        const host = document.getElementById('world-map');
        if (!host || host.dataset.bvMapObserverV71010 === '1') return;
        host.dataset.bvMapObserverV71010 = '1';
        let scheduled = false;
        const mo = new MutationObserver(() => {
            if (!mapIsActive() || scheduled) return;
            scheduled = true;
            queueMicrotask(() => {
                scheduled = false;
                forceMapRedraw();
            });
        });
        mo.observe(host, { childList:true, subtree:false });
    }
    document.addEventListener('click', e => {
        const tab = e.target.closest && e.target.closest('#rpg-menu-screen .menu-tab[data-tab="map"]');
        if (tab) {
            forceMapRedraw();
            requestAnimationFrame(forceMapRedraw);
            setTimeout(forceMapRedraw, 80);
            setTimeout(forceMapRedraw, 240);
        }
        protectTabsScroll();
    }, true);
    document.addEventListener('scroll', e => {
        if (e.target && e.target.matches?.('#title-settings-modal .title-settings-head')) {
            e.target.scrollTop = 0;
            e.target.scrollLeft = 0;
        }
    }, true);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { wrapOpenMenu(); observeWorldMap(); protectTabsScroll(); }, { once:true });
    else { wrapOpenMenu(); observeWorldMap(); protectTabsScroll(); }
    setTimeout(() => { wrapOpenMenu(); observeWorldMap(); }, 160);
    window.BVMenuMapTabsFix = { redraw: forceMapRedraw, protectScroll: protectTabsScroll, wrap: wrapOpenMenu };
})();
</script>

<style>
/* ============================================================
   BV FEATURE v1.0: Level-Up Choice Screen + Achievements
   ============================================================ */

/* ===== LEVEL-UP CHOICE OVERLAY ===== */
#levelup-choice-overlay {
    position: fixed; inset: 0;
    z-index: 9999999;
    display: flex;
    align-items: center; justify-content: center;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.55s cubic-bezier(.4,0,.2,1);
}
#levelup-choice-overlay.active {
    opacity: 1;
    pointer-events: auto;
}
#levelup-choice-overlay.closing {
    opacity: 0;
    pointer-events: none;
    transition-duration: 0.45s;
}

/* --- Background layer (dark) --- */
#levelup-choice-overlay .ov-bg {
    position: absolute; inset: 0;
    background: #080612;
    opacity: 0;
    transition: opacity 0.55s cubic-bezier(.4,0,.2,1);
}
#levelup-choice-overlay.active .ov-bg {
    opacity: 0.88;
}
#levelup-choice-overlay.closing .ov-bg {
    opacity: 0;
    transition-duration: 0.45s;
}

/* --- Floating orbs (movement background) --- */
#levelup-choice-overlay .ov-orbs {
    position: absolute; inset: -80px;
    opacity: 0;
    transition: opacity 0.7s cubic-bezier(.4,0,.2,1) 0.1s;
    pointer-events: none;
    overflow: hidden;
}
#levelup-choice-overlay.active .ov-orbs {
    opacity: 1;
}
#levelup-choice-overlay.closing .ov-orbs {
    opacity: 0;
    transition-duration: 0.4s;
    transition-delay: 0s;
}
#levelup-choice-overlay .ov-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(40px);
    opacity: 0.25;
    will-change: transform;
}

#levelup-choice-overlay .ov-orb:nth-child(1) {
    width: 220px; height: 220px;
    background: radial-gradient(circle, #ffd700, transparent 70%);
    top: 10%; left: 15%;
    animation: orbDrift1 7s ease-in-out infinite;
}
#levelup-choice-overlay .ov-orb:nth-child(2) {
    width: 180px; height: 180px;
    background: radial-gradient(circle, #ff6b35, transparent 70%);
    top: 60%; left: 70%;
    animation: orbDrift2 9s ease-in-out infinite;
}
#levelup-choice-overlay .ov-orb:nth-child(3) {
    width: 160px; height: 160px;
    background: radial-gradient(circle, #00e5ff, transparent 70%);
    top: 75%; left: 25%;
    animation: orbDrift3 8s ease-in-out infinite;
}
#levelup-choice-overlay .ov-orb:nth-child(4) {
    width: 140px; height: 140px;
    background: radial-gradient(circle, #e040fb, transparent 70%);
    top: 20%; left: 75%;
    animation: orbDrift4 10s ease-in-out infinite;
}
@keyframes orbDrift1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(40px, -30px) scale(1.1); }
    66% { transform: translate(-20px, 25px) scale(0.9); }
}
@keyframes orbDrift2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33% { transform: translate(-50px, 20px) scale(0.95); }
    66% { transform: translate(30px, -40px) scale(1.08); }
}
@keyframes orbDrift3 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(35px, 35px) scale(1.12); }
}
@keyframes orbDrift4 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    40% { transform: translate(-30px, -25px) scale(1.05); }
    80% { transform: translate(20px, 15px) scale(0.92); }
}

/* --- Moving grid lines --- */
#levelup-choice-overlay .ov-grid {
    position: absolute; inset: 0;
    background-image:
        linear-gradient(rgba(255,215,0,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,215,0,0.04) 1px, transparent 1px);
    background-size: 60px 60px;
    opacity: 0;
    transition: opacity 0.8s cubic-bezier(.4,0,.2,1) 0.2s;
    pointer-events: none;
    animation: gridScroll 6s linear infinite;
}
#levelup-choice-overlay.active .ov-grid {
    opacity: 1;
}
#levelup-choice-overlay.closing .ov-grid {
    opacity: 0;
    transition-duration: 0.35s;
    transition-delay: 0s;
}
@keyframes gridScroll {
    0% { transform: translate(0, 0); }
    100% { transform: translate(60px, 60px); }
}

/* --- Scanline sweep --- */
#levelup-choice-overlay .ov-scanline {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(255,215,0,0.15), transparent);
    opacity: 0;
    transition: opacity 0.6s ease 0.3s;
    pointer-events: none;
    animation: scanSweep 3.5s ease-in-out infinite;
}
#levelup-choice-overlay.active .ov-scanline {
    opacity: 1;
}
#levelup-choice-overlay.closing .ov-scanline {
    opacity: 0;
    transition-duration: 0.3s;
    transition-delay: 0s;
}
@keyframes scanSweep {
    0%   { top: -2px; opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { top: 100%; opacity: 0; }
}

/* --- Vignette --- */
#levelup-choice-overlay .ov-vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%);
    opacity: 0;
    transition: opacity 0.6s ease 0.15s;
    pointer-events: none;
}
#levelup-choice-overlay.active .ov-vignette {
    opacity: 1;
}
#levelup-choice-overlay.closing .ov-vignette {
    opacity: 0;
    transition-duration: 0.4s;
    transition-delay: 0s;
}

/* --- Content container --- */
.choice-container {
    position: relative;
    max-width: 560px; width: 90%;
    text-align: center;
    z-index: 2;
    transform: translateY(30px) scale(0.88);
    opacity: 0;
    filter: blur(6px);
    transition: transform 0.55s cubic-bezier(.16,1,.3,1) 0.05s,
                opacity 0.5s cubic-bezier(.4,0,.2,1) 0.05s,
                filter 0.5s cubic-bezier(.4,0,.2,1) 0.05s;
}
#levelup-choice-overlay.active .choice-container {
    transform: translateY(0) scale(1);
    opacity: 1;
    filter: blur(0px);
}
#levelup-choice-overlay.closing .choice-container {
    transform: translateY(-20px) scale(0.92);
    opacity: 0;
    filter: blur(4px);
    transition-duration: 0.35s;
    transition-delay: 0s;
}

/* Header */
.choice-title {
    font-family: 'VT323', monospace;
    font-size: 1.8rem;
    color: #ffd700;
    text-shadow: 0 0 25px rgba(255,215,0,0.5), 0 0 60px rgba(255,215,0,0.15);
    margin-bottom: 4px;
    letter-spacing: 3px;
}
.choice-subtitle {
    font-family: 'VT323', monospace;
    font-size: 0.9rem;
    color: rgba(255,255,255,0.45);
    margin-bottom: 18px;
    letter-spacing: 1px;
}

/* Card grid */
.choice-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
}

/* ===== CARDS ===== */
.choice-card {
    background: linear-gradient(160deg, rgba(20,20,45,0.92), rgba(8,8,25,0.95));
    border: 1px solid rgba(255,215,0,0.12);
    border-radius: 12px;
    padding: 14px 8px 12px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    opacity: 0;
    transform: translateY(30px) scale(0.9);
    user-select: none;
    transition: transform 0.35s cubic-bezier(.16,1,.3,1),
                border-color 0.3s ease,
                box-shadow 0.3s ease;
}
.choice-card.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
}
.choice-card:hover {
    transform: translateY(-5px) scale(1.05) !important;
    border-color: rgba(255,215,0,0.5) !important;
    box-shadow: 0 8px 30px rgba(255,215,0,0.12), 0 0 50px rgba(255,215,0,0.05) !important;
}
.choice-card:active {
    transform: scale(0.95) !important;
    transition-duration: 0.1s;
}
.choice-card.card-selected {
    border-color: #ffd700 !important;
    box-shadow: 0 0 35px rgba(255,215,0,0.35) !important;
    pointer-events: none;
}
.choice-card.card-disabled {
    pointer-events: none;
    opacity: 0.3;
    transform: scale(0.88) !important;
    filter: grayscale(0.6);
    transition: all 0.4s ease;
}

/* Card shine */
.choice-card .card-shine {
    position: absolute; top: -60%; left: -60%;
    width: 220%; height: 220%;
    background: radial-gradient(circle at 25% 15%, rgba(255,255,255,0.06), transparent 55%);
    pointer-events: none;
}

/* Card content */
.choice-card-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 3px;
    transition: transform 0.35s cubic-bezier(.16,1,.3,1);
    filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
}
.choice-card:hover .choice-card-icon {
    transform: scale(1.2) rotate(-8deg);
}
.choice-card-name {
    font-family: 'VT323', monospace;
    font-size: 1.05rem;
    color: #e0daff;
    margin-bottom: 1px;
}
.choice-card-bonus {
    font-family: 'VT323', monospace;
    font-size: 1.2rem;
    color: #ffd700;
    text-shadow: 0 0 12px rgba(255,215,0,0.3);
    margin-bottom: 2px;
}
.choice-card-desc {
    font-size: 0.65rem;
    color: rgba(255,255,255,0.35);
    line-height: 1.2;
}

/* Selection burst */
.choice-card.burst {
    animation: cardBurst 0.5s ease-out forwards;
    pointer-events: none;
}
@keyframes cardBurst {
    0%   { transform: scale(1.1); opacity: 1; }
    50%  { transform: scale(1.25); opacity: 0.85; }
    100% { transform: scale(1.6); opacity: 0; }
}

/* Floating bonus text */
.choice-float-bonus {
    position: fixed;
    font-family: 'VT323', monospace;
    font-size: 2rem;
    font-weight: bold;
    color: #ffd700;
    text-shadow: 0 0 25px rgba(255,215,0,0.7), 0 4px 12px rgba(0,0,0,0.5);
    pointer-events: none;
    z-index: 99999999;
    animation: floatBonusUp 1.1s cubic-bezier(.16,1,.3,1) forwards;
}
@keyframes floatBonusUp {
    0%   { opacity: 1; transform: translateY(0) scale(0.8); }
    30%  { opacity: 1; transform: translateY(-10px) scale(1.15); }
    100% { opacity: 0; transform: translateY(-80px) scale(1.05); }
}

/* Burst particles */
.choice-particle {
    position: fixed;
    pointer-events: none;
    z-index: 99999999;
    border-radius: 50%;
    animation: particleFly 0.65s cubic-bezier(.16,1,.3,1) forwards;
}
@keyframes particleFly {
    0%   { opacity: 1; transform: translate(0,0) scale(1); }
    100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0.15); }
}

/* ===== ACHIEVEMENTS ===== */

/* Achievement toast */
#achievement-toast {
    position: fixed;
    top: 20px; right: 20px;
    z-index: 99999999;
    display: none;
    align-items: center;
    gap: 12px;
    background: linear-gradient(145deg, rgba(25,25,60,0.95), rgba(10,10,35,0.95));
    border: 1px solid rgba(255,215,0,0.3);
    border-radius: 14px;
    padding: 12px 20px 12px 14px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 30px rgba(255,215,0,0.1);
    max-width: 360px;
    transform: translateX(120%);
    transition: transform 0.5s cubic-bezier(.16,1,.3,1);
}
#achievement-toast.visible {
    display: flex;
    transform: translateX(0);
}
#achievement-toast .ach-toast-icon {
    font-size: 2rem;
    animation: achToastIconBounce 0.6s ease-out 0.3s both;
}
@keyframes achToastIconBounce {
    0% { transform: scale(0) rotate(-20deg); }
    50% { transform: scale(1.3) rotate(5deg); }
    100% { transform: scale(1) rotate(0); }
}
#achievement-toast .ach-toast-body {
    flex: 1;
    min-width: 0;
}
#achievement-toast .ach-toast-label {
    font-size: 0.65rem;
    color: #ffd700;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-family: 'VT323', monospace;
}
#achievement-toast .ach-toast-title {
    font-size: 0.95rem;
    color: #fff;
    font-weight: bold;
    font-family: 'VT323', monospace;
}
#achievement-toast .ach-toast-desc {
    font-size: 0.7rem;
    color: rgba(255,255,255,0.5);
}
#achievement-toast .ach-toast-glow {
    position: absolute; inset: 0;
    border-radius: 14px;
    background: radial-gradient(circle at 30% 20%, rgba(255,215,0,0.08), transparent 70%);
    pointer-events: none;
}

/* Achievement unlock modal */
#achievement-unlock-modal {
    position: fixed; inset: 0; z-index: 99999999;
    display: none;
    align-items: center; justify-content: center;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(4px);
}
#achievement-unlock-modal.active {
    display: flex;
}
#achievement-unlock-modal .ach-modal-window {
    background: linear-gradient(160deg, rgba(20,20,50,0.98), rgba(8,8,25,0.98));
    border: 1px solid rgba(255,215,0,0.25);
    border-radius: 20px;
    padding: 30px;
    text-align: center;
    max-width: 380px;
    width: 90%;
    position: relative;
    overflow: hidden;
    animation: achModalEnter 0.4s cubic-bezier(.16,1,.3,1) both;
}
@keyframes achModalEnter {
    0% { opacity: 0; transform: scale(0.7) translateY(30px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
}
#achievement-unlock-modal .ach-modal-icon {
    font-size: 3.5rem;
    display: block;
    margin-bottom: 8px;
    animation: achModalIconPulse 1.5s ease-in-out infinite;
}
@keyframes achModalIconPulse {
    0%, 100% { transform: scale(1); filter: brightness(1); }
    50% { transform: scale(1.1); filter: brightness(1.3); }
}
#achievement-unlock-modal .ach-modal-label {
    font-family: 'VT323', monospace;
    font-size: 1rem;
    color: #ffd700;
    letter-spacing: 3px;
    text-shadow: 0 0 20px rgba(255,215,0,0.4);
}
#achievement-unlock-modal .ach-modal-title {
    font-family: 'VT323', monospace;
    font-size: 1.5rem;
    color: #fff;
    margin: 4px 0;
}
#achievement-unlock-modal .ach-modal-desc {
    font-size: 0.8rem;
    color: rgba(255,255,255,0.5);
    margin-bottom: 16px;
}
#achievement-unlock-modal .ach-modal-btn {
    background: linear-gradient(145deg, #ffd700, #f0a500);
    border: none;
    border-radius: 10px;
    padding: 8px 28px;
    font-family: 'VT323', monospace;
    font-size: 1.1rem;
    color: #1a1a2e;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}
#achievement-unlock-modal .ach-modal-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 4px 20px rgba(255,215,0,0.3);
}

/* Achievement menu tab content */
#tab-achievements {
    padding: 12px;
}
.ach-menu-header {
    font-family: 'VT323', monospace;
    font-size: 1.2rem;
    color: #ffd700;
    text-align: center;
    margin-bottom: 12px;
}
.ach-menu-stats {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-bottom: 14px;
}
.ach-menu-stat {
    background: rgba(255,255,255,0.05);
    border-radius: 8px;
    padding: 6px 14px;
    text-align: center;
}
.ach-menu-stat .ach-stat-num {
    font-family: 'VT323', monospace;
    font-size: 1.3rem;
    color: #ffd700;
    display: block;
}
.ach-menu-stat .ach-stat-label {
    font-size: 0.65rem;
    color: rgba(255,255,255,0.4);
}
.ach-menu-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.ach-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 10px;
    padding: 10px 12px;
    transition: background 0.2s ease;
}
.ach-menu-item.unlocked {
    border-color: rgba(255,215,0,0.2);
    background: rgba(255,215,0,0.04);
}
.ach-menu-item .ach-item-icon {
    font-size: 1.6rem;
    width: 36px;
    text-align: center;
    flex-shrink: 0;
}
.ach-menu-item.locked .ach-item-icon {
    filter: grayscale(1);
    opacity: 0.4;
}
.ach-menu-item .ach-item-info {
    flex: 1;
    min-width: 0;
}
.ach-menu-item .ach-item-title {
    font-family: 'VT323', monospace;
    font-size: 0.95rem;
    color: #e0daff;
}
.ach-menu-item.locked .ach-item-title {
    color: rgba(255,255,255,0.3);
}
.ach-menu-item .ach-item-desc {
    font-size: 0.7rem;
    color: rgba(255,255,255,0.35);
}
.ach-menu-item .ach-item-badge {
    font-size: 1.2rem;
    flex-shrink: 0;
}

/* Menu achievement mode - tab content sizing */
#rpg-menu-screen.menu-achievement-mode .menu-tab-content.active,
#rpg-menu-screen.menu-skills-mode .menu-tab-content.active {
    min-height: 0 !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
}
#rpg-menu-screen.menu-achievement-mode .menu-tab-content.active::-webkit-scrollbar,
#rpg-menu-screen.menu-skills-mode .menu-tab-content.active::-webkit-scrollbar { width: 8px; }

/* Achievement tab content needs to fill available space */
#tab-achievements {
    min-height: 0 !important;
    overflow-y: auto !important;
}
#tab-skills {
    min-height: 0 !important;
    overflow-y: auto !important;
}

/* Achievement toast slide animation */
#achievement-toast.visible {
    animation: achToastSlideIn 0.5s cubic-bezier(.16,1,.3,1) both;
}
@keyframes achToastSlideIn {
    0% { transform: translateX(120%); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
}
#achievement-toast.hiding {
    animation: achToastSlideOut 0.4s ease-in both;
}
@keyframes achToastSlideOut {
    0% { transform: translateX(0); opacity: 1; }
    100% { transform: translateX(120%); opacity: 0; }
}

/* Achievement modal entrance */
#achievement-unlock-modal.active .ach-modal-window {
    animation: achModalBounce 0.5s cubic-bezier(.16,1,.3,1) both;
}
@keyframes achModalBounce {
    0% { opacity: 0; transform: scale(0.7) translateY(30px); }
    60% { opacity: 1; transform: scale(1.05) translateY(-5px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
}
</style>

<script>
/* ============================================================
   BV FEATURE v1.0: Level-Up Choice + Achievement System
   ============================================================ */
(function () {
    'use strict';

    // ===== HELPERS =====
    function getPlayer() {
        return (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : (window.player || {});
    }
    function getSaveData() {
        return (typeof window.syncBvRuntime === 'function') ? window.syncBvRuntime() : {};
    }
    function getDefeated() {
        const rt = getSaveData();
        return rt.defeatedEnemies || window.defeatedEnemies || new Set();
    }

    // ===== LEVEL-UP CHOICE SYSTEM =====
    const LEVEL_CHOICES = [
        { id: 'atk', icon: '⚔️', name: 'Kämpfer', bonus: '+3 ATK', desc: 'Deine Angriffe werden stärker.',
          apply: function () { const p = getPlayer(); p.atk += 3; } },
        { id: 'def', icon: '🛡️', name: 'Panzer', bonus: '+2 DEF', desc: 'Kein Angriff hält dich auf.',
          apply: function () { const p = getPlayer(); p.def += 2; } },
        { id: 'hp', icon: '❤️', name: 'Riese', bonus: '+20 MaxHP', desc: 'Du steckst mehr ein.',
          apply: function () { const p = getPlayer(); p.maxHp += 20; p.hp += 20; } },
        { id: 'mp', icon: '☕', name: 'Koffein-Junkie', bonus: '+5 MaxMP', desc: 'Mehr Skills, mehr Power.',
          apply: function () { const p = getPlayer(); p.maxMp += 5; p.mp += 5; } }
    ];

    let _choiceActive = false;
    let _levelsRemaining = 0;
    let _currentLevelIndex = 0;
    let _currentOldLvl = 0;

    window._resetLevelUpChoice = function () {
        _choiceActive = false;
        var el = document.getElementById('levelup-choice-overlay');
        if (el) { el.classList.remove('active'); el.classList.remove('closing'); }
        setVictoryBtnDisabled(false);
    };

    window.isLevelUpChoiceActive = function () { return _choiceActive; };

    function setVictoryBtnDisabled(disabled) {
        var btn = document.querySelector('#victory-screen .victory-btn');
        if (btn) {
            if (disabled) {
                btn.classList.add('victory-btn-locked');
                btn.setAttribute('aria-disabled', 'true');
            } else {
                btn.classList.remove('victory-btn-locked');
                btn.removeAttribute('aria-disabled');
            }
        }
        var touch = document.getElementById('rpg-touch-controls');
        if (touch) touch.classList.toggle('input-blocked', disabled);
    }

    window.offerLevelUpChoice = function () {
        if (_choiceActive) return;
        const p = getPlayer();
        if (!p || !window._pendingLevelUpCount || window._pendingLevelUpCount <= 0) return;

        _levelsRemaining = window._pendingLevelUpCount;
        _currentLevelIndex = 0;
        _currentOldLvl = p.lvl - _levelsRemaining;
        _choiceActive = true;

        showNextLevelChoice();
    };

    function getOrCreateOverlay() {
        var el = document.getElementById('levelup-choice-overlay');
        if (!el) {
            el = document.createElement('div');
            el.id = 'levelup-choice-overlay';
            el.innerHTML =
                '<div class="ov-bg"></div>' +
                '<div class="ov-orbs">' +
                    '<div class="ov-orb"></div>' +
                    '<div class="ov-orb"></div>' +
                    '<div class="ov-orb"></div>' +
                    '<div class="ov-orb"></div>' +
                '</div>' +
                '<div class="ov-grid"></div>' +
                '<div class="ov-scanline"></div>' +
                '<div class="ov-vignette"></div>' +
                '<div class="choice-container">' +
                    '<div class="choice-title"></div>' +
                    '<div class="choice-subtitle"></div>' +
                    '<div class="choice-grid"></div>' +
                '</div>';
            document.body.appendChild(el);
        }
        return el;
    }

    function showNextLevelChoice() {
        const p = getPlayer();
        const levelNum = _currentOldLvl + _currentLevelIndex + 1;
        var overlay = getOrCreateOverlay();
        var container = overlay.querySelector('.choice-container');
        var titleEl = overlay.querySelector('.choice-title');
        var subEl = overlay.querySelector('.choice-subtitle');
        var grid = overlay.querySelector('.choice-grid');

        var isMulti = _levelsRemaining > 1;
        titleEl.textContent = isMulti ? '🎯 KARRIEREPFAD' : '🎯 KARRIEREPFAD';
        subEl.textContent = isMulti
            ? 'Level ' + levelNum + ' Bonus  (' + (_currentLevelIndex + 1) + '/' + _levelsRemaining + ')'
            : 'Level ' + levelNum + ' Bonus';

        // Clear and rebuild cards
        grid.innerHTML = '';
        LEVEL_CHOICES.forEach(function (ch) {
            var card = document.createElement('div');
            card.className = 'choice-card';
            card.dataset.id = ch.id;
            card.innerHTML =
                '<div class="card-shine"></div>' +
                '<span class="choice-card-icon">' + ch.icon + '</span>' +
                '<div class="choice-card-name">' + ch.name + '</div>' +
                '<div class="choice-card-bonus">' + ch.bonus + '</div>' +
                '<div class="choice-card-desc">' + ch.desc + '</div>';
            card.addEventListener('click', function () { selectChoice(ch.id, overlay); });
            grid.appendChild(card);
        });

        // Remove closing state, activate
        overlay.classList.remove('closing');
        overlay.classList.add('active');
        setVictoryBtnDisabled(true);

        // Stagger card entrance
        requestAnimationFrame(function () {
            var cards = grid.querySelectorAll('.choice-card');
            cards.forEach(function (c, i) {
                setTimeout(function () { c.classList.add('visible'); }, i * 90 + 80);
            });
        });
    }

    function selectChoice(id, overlay) {
        const ch = LEVEL_CHOICES.find(function (c) { return c.id === id; });
        if (!ch) return;

        var grid = overlay.querySelector('.choice-grid');
        var cards = grid.querySelectorAll('.choice-card');
        var selectedCard = null;
        cards.forEach(function (c) {
            if (c.dataset.id === id) { selectedCard = c; c.classList.add('burst', 'card-selected'); }
            else { c.classList.add('card-disabled'); }
        });

        // Particles at card center
        if (selectedCard) {
            var rect = selectedCard.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var colors = ['#ffd700', '#ff6b35', '#ff0080', '#00e5ff', '#76ff03', '#e040fb'];
            for (var i = 0; i < 16; i++) {
                var particle = document.createElement('div');
                particle.className = 'choice-particle';
                var angle = Math.random() * Math.PI * 2;
                var dist = 40 + Math.random() * 100;
                var size = 3 + Math.random() * 7;
                particle.style.cssText =
                    'left:' + cx + 'px;top:' + cy + 'px;width:' + size + 'px;height:' + size +
                    'px;background:' + colors[i % colors.length] +
                    ';--px:' + (Math.cos(angle) * dist) + 'px;--py:' + (Math.sin(angle) * dist) + 'px';
                document.body.appendChild(particle);
                setTimeout(function (el) { el.remove(); }, 700, particle);
            }

            // Floating bonus text
            var floatEl = document.createElement('div');
            floatEl.className = 'choice-float-bonus';
            floatEl.textContent = ch.bonus;
            floatEl.style.left = (cx - 40) + 'px';
            floatEl.style.top = (cy - 15) + 'px';
            document.body.appendChild(floatEl);
            setTimeout(function () { floatEl.remove(); }, 1200);
        }

        // Apply bonus
        ch.apply();
        window._pendingLevelUpCount--;
        _levelsRemaining--;
        _currentLevelIndex++;

        if (typeof window.updateHUD === 'function') window.updateHUD();
        if (typeof window.updateMenuStats === 'function') window.updateMenuStats();

        // Next level or finish
        setTimeout(function () {
            if (_levelsRemaining > 0) {
                // Fade out current, then fade in next
                overlay.classList.add('closing');
                setTimeout(function () {
                    overlay.classList.remove('active');
                    showNextLevelChoice();
                }, 350);
            } else {
                // All done – close overlay with fade-out
                overlay.classList.add('closing');
                setTimeout(function () {
                    overlay.classList.remove('active');
                    _choiceActive = false;
                    setVictoryBtnDisabled(false);
                    if (typeof window.checkAchievements === 'function') window.checkAchievements('levelup');
                }, 400);
            }
        }, 550);
    }

    // ===== ACHIEVEMENT SYSTEM =====
    var ACHIEVEMENTS = [
        { id: 'first_blood', icon: '⚔️', title: 'Erster Kampf', desc: 'Gewinne deinen ersten Kampf.',
          check: function (ctx, p, def) { return def.size >= 1; } },
        { id: 'coffee_addict', icon: '☕', title: 'Kaffee-Junkie', desc: 'Trinke 10 Kaffee im Inventar.',
          check: function (ctx, p) { return (p.achCoffeeUsed || 0) >= 10; } },
        { id: 'treasure_hunter', icon: '📦', title: 'Schatzsucher', desc: 'Öffne 10 Kisten.',
          check: function (ctx, p, def, chests) { return (chests || 0) >= 10; } },
        { id: 'level_5', icon: '⬆️', title: 'Level 5', desc: 'Erreiche Level 5.',
          check: function (ctx, p) { return p.lvl >= 5; } },
        { id: 'level_10', icon: '🌟', title: 'Level 10', desc: 'Erreiche Level 10.',
          check: function (ctx, p) { return p.lvl >= 10; } },
        { id: 'boss_slayer', icon: '👔', title: 'Chef-Bezwinger', desc: 'Besiege den Geschäftsführer.',
          check: function (ctx, p, def) { return def.has('boss_office_12_4_boss'); } },
        { id: 'easter_master', icon: '🥚', title: 'Oster-Fan', desc: 'Schließe die Eierjagd ab.',
          check: function (ctx, p) { return p.questState && p.questState.easterEvent === 'completed'; } },
        { id: 'archiv_hero', icon: '🗄️', title: 'Archiv-Retter', desc: 'Befreie das Archiv von der Motte.',
          check: function (ctx, p) { return p.questState && p.questState.archivMotteReward; } },
        { id: 'roof_hero', icon: '📡', title: 'Dach-Held', desc: 'Beseitige das Störsignal auf dem Dach.',
          check: function (ctx, p) { return p.questState && p.questState.dachSignalReward; } },
        { id: 'explorer', icon: '🗺️', title: 'Büro-Veteran', desc: 'Besuche alle 12 Map-Bereiche.',
          check: function (ctx, p, def, chests, visited) { return (visited || 0) >= 12; } },
        { id: 'rich', icon: '💰', title: 'Reich', desc: 'Sammle 1000 Gold.',
          check: function (ctx, p) { return p.gold >= 1000; } },
        { id: 'skill_collector', icon: '📎', title: 'Skill-Sammler', desc: 'Lerne alle 10 käuflichen Skills.',
          check: function (ctx, p) { return (p.unlockedSkills || []).length >= 10; } },
        { id: 'secret_finder', icon: '🤌', title: 'Geheimnis-Gelüftet', desc: 'Finde den Geheimraum.',
          check: function (ctx, p) { return p.secretRoomState && (p.secretRoomState.sebastianoDefeated || p.secretRoomState.sebastianoGiftClaimed); } },
        { id: 'complete_game', icon: '🏆', title: 'BüroVersum-Champion', desc: 'Schließe das Spiel ab.',
          check: function (ctx, p) { return p.questState && p.questState.sebastianoDefeated && p.questState.dachSignalReward && p.questState.archivMotteReward; } }
    ];

    // Persisted unlocked set
    var _unlocked = null;
    function getUnlocked() {
        if (_unlocked) return _unlocked;
        try {
            var raw = localStorage.getItem('bv_achievements');
            _unlocked = raw ? JSON.parse(raw) : {};
        } catch (e) { _unlocked = {}; }
        return _unlocked;
    }
    function saveUnlocked() {
        try { localStorage.setItem('bv_achievements', JSON.stringify(_unlocked)); } catch (e) {}
    }
    function resetAchievementCache() { _unlocked = null; }
    window.resetAchievementCache = resetAchievementCache;
    function isUnlocked(id) {
        return !!getUnlocked()[id];
    }
    function markUnlocked(id) {
        getUnlocked()[id] = true;
        saveUnlocked();
    }

    // Stats counters
    var _achChestsOpened = 0;
    var _achMapsVisited = new Set();

    // Show achievement unlock notification
    function showAchievementUnlock(ach) {
        // First: toast notification
        var toast = document.getElementById('achievement-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'achievement-toast';
            toast.innerHTML =
                '<div class="ach-toast-glow"></div>' +
                '<span class="ach-toast-icon">🏅</span>' +
                '<div class="ach-toast-body">' +
                '<div class="ach-toast-label">🎉 Erfolg freigeschaltet</div>' +
                '<div class="ach-toast-title"></div>' +
                '<div class="ach-toast-desc"></div>' +
                '</div>';
            document.body.appendChild(toast);
        }
        toast.querySelector('.ach-toast-icon').textContent = ach.icon;
        toast.querySelector('.ach-toast-title').textContent = ach.title;
        toast.querySelector('.ach-toast-desc').textContent = ach.desc;
        toast.classList.add('visible');

        // Track current map for context
        var currentMapName = '';
        try {
            var mapData = window.MAPS && window.MAPS[window.currentMapId];
            if (mapData) currentMapName = mapData.name || window.currentMapId;
        } catch(e) {}

        // Show modal after toast
        setTimeout(function () {
            toast.classList.remove('visible');

            var modal = document.getElementById('achievement-unlock-modal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'achievement-unlock-modal';
                modal.innerHTML =
                    '<div class="ach-modal-window">' +
                    '<span class="ach-modal-icon">🏅</span>' +
                    '<div class="ach-modal-label">🏆 ERFOLG FREIGESCHALTET</div>' +
                    '<div class="ach-modal-title"></div>' +
                    '<div class="ach-modal-desc"></div>' +
                    '<button class="ach-modal-btn">Weiter</button>' +
                    '</div>';
                modal.querySelector('.ach-modal-btn').addEventListener('click', function () {
                    modal.classList.remove('active');
                });
                document.body.appendChild(modal);
            }
            modal.querySelector('.ach-modal-icon').textContent = ach.icon;
            modal.querySelector('.ach-modal-title').textContent = ach.title;
            modal.querySelector('.ach-modal-desc').textContent = ach.desc + (currentMapName ? ' (' + currentMapName + ')' : '');
            modal.classList.add('active');
        }, 2500);
    }

    // Check & unlock achievements
    window.checkAchievements = function (context) {
        var p = getPlayer();
        var def = getDefeated();
        var newlyUnlocked = [];

        ACHIEVEMENTS.forEach(function (ach) {
            if (isUnlocked(ach.id)) return;
            try {
                if (ach.check(context, p, def, _achChestsOpened, _achMapsVisited.size)) {
                    markUnlocked(ach.id);
                    newlyUnlocked.push(ach);
                }
            } catch (e) {}
        });

        newlyUnlocked.forEach(function (ach) {
            showAchievementUnlock(ach);
        });
    };

    // Track map visits
    window._trackMapVisit = function (mapId) {
        if (mapId) _achMapsVisited.add(mapId);
    };

    // Track chest opens
    window._trackChestOpen = function () {
        _achChestsOpened++;
    };

    // ===== ACHIEVEMENTS MENU TAB =====
    function renderAchievementTab() {
        var host = document.getElementById('achievement-content');
        if (!host) {
            // Fallback: Tab-Inhalt fehlt, erneut injizieren
            ensureAchievementTab();
            host = document.getElementById('achievement-content');
            if (!host) return;
        }

        var all = ACHIEVEMENTS;
        var unlockedCount = all.filter(function (a) { return isUnlocked(a.id); }).length;

        host.innerHTML =
            '<div class="ach-menu-header">🏆 ERFOLGE</div>' +
            '<div class="ach-menu-stats">' +
            '<div class="ach-menu-stat"><span class="ach-stat-num">' + unlockedCount + '/' + all.length + '</span><span class="ach-stat-label">Freigeschaltet</span></div>' +
            '<div class="ach-menu-stat"><span class="ach-stat-num">' + Math.round(unlockedCount / all.length * 100) + '%</span><span class="ach-stat-label">Fortschritt</span></div>' +
            '</div>' +
            '<div class="ach-menu-grid">' +
            all.map(function (a) {
                var unlocked = isUnlocked(a.id);
                return '<div class="ach-menu-item ' + (unlocked ? 'unlocked' : 'locked') + '">' +
                    '<span class="ach-item-icon">' + (unlocked ? a.icon : '🔒') + '</span>' +
                    '<div class="ach-item-info">' +
                    '<div class="ach-item-title">' + (unlocked ? a.title : '???') + '</div>' +
                    '<div class="ach-item-desc">' + (unlocked ? a.desc : 'Noch nicht freigeschaltet') + '</div>' +
                    '</div>' +
                    '<span class="ach-item-badge">' + (unlocked ? '✅' : '') + '</span>' +
                    '</div>';
            }).join('') +
            '</div>';

        if (typeof window.parseEmojis === 'function') window.parseEmojis(host);
    }

    function ensureAchievementTab() {
        var host = document.getElementById('achievement-content');
        if (host && !host.innerHTML.trim()) window.renderAchievementTab();
    }
    window.renderAchievementTab = renderAchievementTab;

    // ===== INTEGRATION HOOKS =====

    // Robust polling: tracks coffee usage, chest opens, map visits
    var _lastMapId = '';
    var _lastCoffeeCount = -1;

    function getCoffeeCount() {
        try {
            var p = getPlayer();
            if (!p || !p.inventory) return -1;
            var coffee = p.inventory.find(function (i) { return i.id === 'kaffee' || (i.name && i.name.indexOf('Kaffee') !== -1); });
            return coffee ? coffee.count : 0;
        } catch (e) { return -1; }
    }

    setInterval(function () {
        // Track map visits
        var curId = '';
        try { curId = window.currentMapId; } catch (e) {}
        if (curId && curId !== _lastMapId) {
            _lastMapId = curId;
            if (typeof window._trackMapVisit === 'function') window._trackMapVisit(curId);
        }

        // Track coffee usage via inventory diff
        var curCoffee = getCoffeeCount();
        if (_lastCoffeeCount >= 0 && curCoffee >= 0 && curCoffee < _lastCoffeeCount) {
            try {
                var p = getPlayer();
                p.achCoffeeUsed = (p.achCoffeeUsed || 0) + (_lastCoffeeCount - curCoffee);
            } catch (e) {}
        }
        _lastCoffeeCount = curCoffee;

        // Periodically check all achievements
        if (typeof window.checkAchievements === 'function' && !_choiceActive) {
            window.checkAchievements('poll');
        }
    }, 2000);

    // 1. endVictory wrapper (scope-safe: window.endVictory exists in main scope)
    var _origEndVictory = window.endVictory;
    if (typeof _origEndVictory === 'function') {
        window.endVictory = function () {
            var result = _origEndVictory.apply(this, arguments);
            setTimeout(function () {
                if (typeof window.checkAchievements === 'function') window.checkAchievements('battle');
            }, 200);
            return result;
        };
    }

    // 2. loadGame wrapper
    var _origLoadGame = window.loadGame;
    if (typeof _origLoadGame === 'function') {
        window.loadGame = function () {
            var result = _origLoadGame.apply(this, arguments);
            _lastCoffeeCount = getCoffeeCount();
            setTimeout(function () {
                if (typeof window.checkAchievements === 'function') window.checkAchievements('load');
            }, 300);
            return result;
        };
    }

    // 3. openMenu wrapper - inject achievement tab
    var _origOpenMenu = window.openMenu;
    if (typeof _origOpenMenu === 'function') {
        window.openMenu = function () {
            var result = _origOpenMenu.apply(this, arguments);
            setTimeout(ensureAchievementTab, 50);
            return result;
        };
    } else {
        // openMenu not yet defined - poll until it appears
        var _menuPollCount = 0;
        var _menuPoll = setInterval(function () {
            if (typeof window.openMenu === 'function' && window.openMenu !== _origOpenMenu) {
                clearInterval(_menuPoll);
                _origOpenMenu = window.openMenu;
                window.openMenu = function () {
                    var result = _origOpenMenu.apply(this, arguments);
                    setTimeout(ensureAchievementTab, 50);
                    return result;
                };
            }
            if (++_menuPollCount > 100) clearInterval(_menuPoll);
        }, 200);
    }

    // Also inject on DOM ready + periodically
    function install() {
        ensureAchievementTab();
        _lastCoffeeCount = getCoffeeCount();
        setTimeout(function () {
            if (typeof window.checkAchievements === 'function') window.checkAchievements('load');
            try { if (window.currentMapId) window._trackMapVisit(window.currentMapId); } catch (e) {}
        }, 500);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
    else install();
    // Periodic retry for tab injection (since menu might not be available yet)
    var _retryCount = 0;
    var _retryTimer = setInterval(function () {
        _retryCount++;
        if (_retryCount > 20) { clearInterval(_retryTimer); return; }
        ensureAchievementTab();
    }, 500);

    // Expose API
    window.BVAchievements = {
        list: ACHIEVEMENTS,
        isUnlocked: isUnlocked,
        getUnlocked: getUnlocked,
        renderTab: renderAchievementTab,
        check: window.checkAchievements
    };

})();

</script>

<script>
/* Skills-Tab im Hauptmenü */
(function () {
    'use strict';

    var SKILL_DATA = [
        { id: "tacker", name: "Tacker-Angriff", icon: "📎", cost: 4, desc: "Schneller Angriff mit dem Tacker." },
        { id: "kaffee", name: "Kaffee-Wurf", icon: "☕", cost: 6, desc: "Heißer Kaffee verursacht Verbrennungen." },
        { id: "meeting", name: "Meeting einberufen", icon: "📊", cost: 8, desc: "Langweiliger Angriff, der alle beschäftigt." },
        { id: "papier", name: "Papier-Papiertiger", icon: "📄", cost: 5, desc: "Papierschnipsel verursachen Staub." },
        { id: "fax", name: "Fax-Blitz", icon: "📠", cost: 7, desc: "Das Faxgerät feuert einen Strahl." },
        { id: "printer", name: "Drucker-Crash", icon: "🖨️", cost: 9, desc: "Der Drucker blockiert — katastrophal." },
        { id: "email_bomb", name: "E-Mail-Flut", icon: "📧", cost: 7, desc: "Hunderte Mails überfluten den Gegner." },
        { id: "powerpoint", name: "PowerPoint-Präsi", icon: "📑", cost: 6, desc: "Eine endlose Präsentation." },
        { id: "termination", name: "Kündigung aussprechen", icon: "📋", cost: 15, desc: "Der ultimative Büroskill." },
        { id: "board_meeting", name: "Vorstandssitzung", icon: "🏛️", cost: 18, desc: "Massiver Schaden durch Bürokratie." },
        { id: "ueberstunden", name: "Überstunden-Boost", icon: "💪", cost: 12, desc: "Mehr Kraft durch Überstunden." },
        { id: "oster_power", name: "Oster-Flower-Power", icon: "🌸", cost: 10, desc: "Geheimes Oster-Skill.", special: "easter" }
    ];

    function getPlayer() {
        return (typeof window.getBvPlayer === 'function') ? window.getBvPlayer() : (window.player || {});
    }

    function ensureSkillsTab() {
        var host = document.getElementById('skills-content');
        if (host && !host.innerHTML.trim()) window.renderSkillsTab();
    }

    window.renderSkillsTab = function () {
        var host = document.getElementById('skills-content');
        if (!host) {
            ensureSkillsTab();
            host = document.getElementById('skills-content');
            if (!host) return;
        }
        var p = getPlayer();
        var unlocked = p.unlockedSkills || ["tacker", "kaffee", "meeting"];
        var skillLevels = p.skillLevels || {};
        var total = SKILL_DATA.length;
        var count = SKILL_DATA.filter(function (s) { return unlocked.indexOf(s.id) !== -1; }).length;

        var html =
            '<div class="ach-menu-header">📎 SKILLS</div>' +
            '<div class="ach-menu-stats">' +
                '<div class="ach-menu-stat"><span class="ach-stat-num">' + count + '/' + total + '</span><span class="ach-stat-label">Freigeschaltet</span></div>' +
                '<div class="ach-menu-stat"><span class="ach-stat-num">' + Math.round(count / total * 100) + '%</span><span class="ach-stat-label">Fortschritt</span></div>' +
            '</div>' +
            '<div class="ach-menu-grid">';

        SKILL_DATA.forEach(function (sk) {
            var has = unlocked.indexOf(sk.id) !== -1;
            var lv = has ? Math.max(1, Math.min(5, skillLevels[sk.id] || 1)) : 0;
            var stars = '';
            for (var i = 0; i < 5; i++) stars += i < lv ? '★' : '☆';
            html +=
                '<div class="ach-menu-item ' + (has ? 'unlocked' : 'locked') + '">' +
                    '<span class="ach-item-icon">' + (has ? sk.icon : '🔒') + '</span>' +
                    '<div class="ach-item-info">' +
                        '<div class="ach-item-title">' + (has ? sk.name : '???') + '</div>' +
                        '<div class="ach-item-desc">' + (has ? sk.desc : 'Noch nicht freigeschaltet') + '</div>' +
                        (has ? '<div class="skill-stars">' + stars + '</div>' : '') +
                    '</div>' +
                    '<span class="ach-item-badge">' + (has ? '✅' : '') + '</span>' +
                '</div>';
        });

        html += '</div>';
        host.innerHTML = html;
        if (typeof window.parseEmojis === 'function') window.parseEmojis(host);
    }

    // Inject in openMenu wrapper
    var _origOpenMenu2 = window.openMenu;
    if (typeof _origOpenMenu2 === 'function') {
        window.openMenu = function () {
            var result = _origOpenMenu2.apply(this, arguments);
            setTimeout(ensureSkillsTab, 50);
            return result;
        };
    } else {
        var _poll2 = setInterval(function () {
            if (typeof window.openMenu === 'function' && window.openMenu !== _origOpenMenu2) {
                clearInterval(_poll2);
                _origOpenMenu2 = window.openMenu;
                window.openMenu = function () {
                    var result = _origOpenMenu2.apply(this, arguments);
                    setTimeout(ensureSkillsTab, 50);
                    return result;
                };
            }
        }, 200);
    }

    function installSkills() { ensureSkillsTab(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installSkills, { once: true });
    else installSkills();

    var _skRetry = 0;
    var _skTimer = setInterval(function () {
        _skRetry++;
        if (_skRetry > 20) { clearInterval(_skTimer); return; }
        ensureSkillsTab();
    }, 500);
})();