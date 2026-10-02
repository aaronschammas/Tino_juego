import Image from 'next/image';
import Link from 'next/link';

/** Inicio de la feria: un solo cartel para empezar a jugar. */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[#1e3a5f] px-6 text-center text-white">
      <Image
        src="/LogoPrincipalBlancoLetras.png"
        alt="Tino"
        width={1971}
        height={638}
        priority
        className="h-auto w-48 md:w-64"
      />

      <div className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
          Apagá el incendio con Tino
        </h1>
        <p className="mx-auto max-w-xl text-lg font-medium text-blue-100 md:text-xl">
          Tu empresa está en llamas. Usá Tino de verdad y apagá cada fuego.
        </p>
      </div>

      <Link
        href="/feria"
        className="rounded-2xl bg-orange-500 px-12 py-6 text-2xl font-extrabold uppercase tracking-wide text-white shadow-[0_8px_0_#9a3412] transition-transform hover:-translate-y-1 hover:bg-orange-400 active:translate-y-1 active:shadow-[0_4px_0_#9a3412] md:text-3xl"
      >
        Empezar a jugar
      </Link>
    </main>
  );
}
