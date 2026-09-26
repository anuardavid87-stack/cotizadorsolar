import React, { createContext, useContext, useState, useEffect } from 'react';

const PWAContext = createContext({
  isInstallable: false,
  isInstalled: false,
  isOnline: true,
  isIOS: false,
  installApp: async () => {},
  showIOSPrompt: false,
  setShowIOSPrompt: () => {}
});

export function PWAProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // 1. Detect if already installed / standalone
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
    }

    // 2. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice && !isStandalone);

    // 3. Online / Offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 4. Listen for PWA beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Prevent standard browser mini-infobar
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('[PWA] beforeinstallprompt captured, ready for install.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Detect when successfully installed
    const handleAppInstalled = () => {
      console.log('[PWA] App successfully installed to home screen!');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 6. Register Service Worker in production or supported localhost
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered with scope:', registration.scope);

            // Check for updates
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New version available! Reloading or notification can be triggered.');
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Trigger installation
  const installApp = async () => {
    if (isIOS) {
      setShowIOSPrompt(true);
      return;
    }

    if (!deferredPrompt) {
      console.warn('[PWA] No deferredPrompt available to install.');
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] User response to install prompt:', outcome);

      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
    } catch (err) {
      console.error('[PWA] Error during installation prompt:', err);
    } finally {
      setDeferredPrompt(null);
    }
  };

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isOnline,
        isIOS,
        installApp,
        showIOSPrompt,
        setShowIOSPrompt
      }}
    >
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
}
