// ============================================
// MoneyTrack — PWA Bootstrap
// ============================================

(function () {
    // ---- Register Service Worker ----
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('/service-worker.js')
                .then((reg) => {
                    console.log('[PWA] Service worker registered:', reg.scope);

                    // Check for updates
                    reg.addEventListener('updatefound', () => {
                        const newWorker = reg.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                showUpdateBanner();
                            }
                        });
                    });
                })
                .catch((err) => console.warn('[PWA] SW registration failed:', err));
        });
    }

    // ---- Install Prompt ----
    let deferredPrompt = null;
    const INSTALL_DISMISSED_KEY = 'pwa_install_dismissed';

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Don't show if user already dismissed
        if (!sessionStorage.getItem(INSTALL_DISMISSED_KEY)) {
            setTimeout(showInstallBanner, 2500);
        }
    });

    function showInstallBanner() {
        if (document.getElementById('pwa-install-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.innerHTML = `
            <div class="pwa-banner-content">
                <span class="pwa-banner-icon">📲</span>
                <div class="pwa-banner-text">
                    <strong>Install MoneyTrack</strong>
                    <span>Add to your home screen for a native app experience</span>
                </div>
            </div>
            <div class="pwa-banner-actions">
                <button id="pwa-install-btn" class="pwa-install-btn">Install</button>
                <button id="pwa-dismiss-btn" class="pwa-dismiss-btn">✕</button>
            </div>
        `;
        document.body.appendChild(banner);

        // Small delay so CSS transition plays
        requestAnimationFrame(() => banner.classList.add('visible'));

        document.getElementById('pwa-install-btn').addEventListener('click', async () => {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            banner.remove();
            if (outcome === 'dismissed') {
                sessionStorage.setItem(INSTALL_DISMISSED_KEY, '1');
            }
        });

        document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
            banner.classList.remove('visible');
            setTimeout(() => banner.remove(), 300);
            sessionStorage.setItem(INSTALL_DISMISSED_KEY, '1');
        });
    }

    function showUpdateBanner() {
        const banner = document.createElement('div');
        banner.className = 'pwa-update-banner';
        banner.innerHTML = `
            <span>🔄 A new version is available.</span>
            <button onclick="window.location.reload()">Update</button>
        `;
        document.body.appendChild(banner);
    }

    // ---- Standalone mode detection ----
    const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;

    if (isStandalone) {
        document.documentElement.classList.add('pwa-standalone');
    }
})();
