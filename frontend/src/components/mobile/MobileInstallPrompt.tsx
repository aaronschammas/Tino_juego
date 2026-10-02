'use client';

import { Download, Share, X } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

export default function MobileInstallPrompt() {
  const { canInstall, showIosHelp, install, dismiss } = usePwaInstall();

  if (!canInstall && !showIosHelp) return null;

  return (
    <aside className="mobile-install" aria-labelledby="mobile-install-title">
      <button className="mobile-icon-button mobile-install-close" onClick={dismiss} aria-label="Cerrar sugerencia de instalacion">
        <X aria-hidden="true" size={18} />
      </button>
      <div className="mobile-install-icon" aria-hidden="true">
        {canInstall ? <Download size={22} /> : <Share size={22} />}
      </div>
      <div>
        <h2 id="mobile-install-title" className="font-semibold text-[var(--color-text)]">
          Instalar Tino
        </h2>
        {canInstall ? (
          <>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Accede a este espacio desde el icono de tu telefono.</p>
            <button className="mobile-primary-button mt-3" onClick={install}>Instalar aplicacion</button>
          </>
        ) : (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-[var(--color-text-muted)]">
            <li>Abre el menu Compartir.</li>
            <li>Elige “Agregar a inicio”.</li>
            <li>Activa “Abrir como app” si esta disponible.</li>
          </ol>
        )}
      </div>
    </aside>
  );
}
