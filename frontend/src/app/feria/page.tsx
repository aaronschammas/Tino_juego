import Link from 'next/link';

export const metadata = { title: 'Apagá el incendio' };

/** Pantalla de juego: Tino real a la izquierda y el juego a la derecha (base de la fase 2). */
export default function FeriaPage() {
  return (
    <main className="flex h-screen flex-col bg-[#1e3a5f]">
      <header className="flex items-center justify-between px-4 py-2 text-white">
        <span className="text-lg font-extrabold">Apagá el incendio con Tino</span>
        <Link href="/" className="text-sm font-bold text-blue-100 hover:text-white">
          Volver al inicio
        </Link>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 px-2 pb-2">
        <iframe
          src="/dashboard"
          title="Tino"
          className="h-full w-full rounded-xl border-0 bg-white"
        />
        <iframe
          src="/juego/index.html"
          title="Juego"
          className="h-full w-full rounded-xl border-0 bg-[#1a1c2c]"
        />
      </div>
    </main>
  );
}
