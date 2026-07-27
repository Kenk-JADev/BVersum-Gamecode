/**
 * BüroVersum RPG - Embed Script
 * 
 * Einfache Einbindung auf jeder Website:
 * 
 * <script src="https://DEIN-USERNAME.github.io/BVersum-Gamecode/embed.js"></script>
 * <div id="bueroversum-game"></div>
 */

(function() {
    'use strict';
    
    const BUREAU_VERSUM_VERSION = '7.10.10';
    
    function createBuroVersumEmbed(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('[BüroVersum] Container nicht gefunden:', containerId);
            return;
        }
        
        // Standard-Optionen
        const config = {
            width: options.width || '100%',
            height: options.height || '720px',
            borderRadius: options.borderRadius || '16px',
            boxShadow: options.boxShadow || '0 15px 50px rgba(0,0,0,0.25)',
            baseUrl: options.baseUrl || 'https://DEIN-USERNAME.github.io/BVersum-Gamecode/',
            showControls: options.showControls !== false
        };
        
        // Container stylen
        container.style.position = 'relative';
        container.style.width = config.width;
        container.style.height = config.height;
        container.style.borderRadius = config.borderRadius;
        container.style.overflow = 'hidden';
        container.style.boxShadow = config.boxShadow;
        container.style.background = '#0a0a1a';
        
        // iframe erstellen
        const iframe = document.createElement('iframe');
        iframe.src = config.baseUrl + 'index.html';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.style.display = 'block';
        iframe.allow = 'fullscreen';
        iframe.title = 'BüroVersum RPG';
        
        container.appendChild(iframe);
        
        // Optional: Controls
        if (config.showControls) {
            const controls = document.createElement('div');
            controls.style.cssText = `
                position: absolute; bottom: 12px; right: 12px; z-index: 10;
                background: rgba(0,0,0,0.7); border-radius: 8px; padding: 4px 8px;
                font-family: 'VT323', monospace; font-size: 13px; color: #fff;
            `;
            controls.innerHTML = `
                <button onclick="window.open('${config.baseUrl}', '_blank')" 
                        style="background:none;border:none;color:#fff;cursor:pointer;font-size:13px;">
                    🔗 Vollbild öffnen
                </button>
            `;
            container.appendChild(controls);
        }
        
        console.log(`[BüroVersum] Embed v${BUREAU_VERSUM_VERSION} erfolgreich geladen in #${containerId}`);
        
        return iframe;
    }
    
    // Globale API
    window.BuroVersum = {
        embed: createBuroVersumEmbed,
        version: BUREAU_VERSUM_VERSION
    };
    
    // Auto-Init: Wenn ein Element mit ID "bueroversum-game" existiert
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('bueroversum-game')) {
                window.BuroVersum.embed('bueroversum-game');
            }
        });
    } else {
        if (document.getElementById('bueroversum-game')) {
            window.BuroVersum.embed('bueroversum-game');
        }
    }
    
})();