'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BeforeInstallPromptEvent, NavigatorWithStandalone } from '@/types/pwa';

const DISMISSED_KEY = 'tino:pwa-install-dismissed';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as NavigatorWithStandalone).standalone)
  );
}

function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(DISMISSED_KEY) === 'true',
  );

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, 'true');
    setDismissed(true);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return {
    canInstall: Boolean(deferredPrompt) && !standalone && !dismissed,
    showIosHelp: isIosDevice() && !standalone && !dismissed,
    standalone,
    install,
    dismiss,
  };
}
