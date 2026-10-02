'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import BrandMark from '@/components/brand/BrandMark';
import { useAuth } from '@/hooks/useAuth';

const metrics = [
  { label: 'Vista unificada', value: 'Proyectos, tareas y tiempo en el mismo flujo' },
  { label: 'Contexto operativo', value: 'Prioridades, bloqueos y carga visibles por equipo' },
  { label: 'Escala multiusuario', value: 'Listo para organizaciones, permisos e ingresos recurrentes' },
];

const featureColumns = [
  {
    eyebrow: 'Operativa diaria',
    title: 'Gestiona ejecucion sin saltar entre herramientas.',
    description:
      'Tino centraliza backlog, avance y tiempos registrados para que cada proyecto tenga una lectura util y accionable.',
    items: ['Proyectos y tareas con estado claro', 'Timer vinculado al trabajo real', 'Resumen ejecutivo para decidir rapido'],
  },
  {
    eyebrow: 'Trabajo en equipo',
    title: 'Organiza usuarios, proyectos y permisos con criterio B2B.',
    description:
      'La estructura ya contempla organizaciones y acceso por contexto, para que la experiencia escale sin parecer un MVP improvisado.',
    items: ['Acceso por usuario autenticado', 'Separacion entre publico y privado', 'Base lista para equipos y responsables'],
  },
  {
    eyebrow: 'Visibilidad',
    title: 'Convierte actividad en senales operativas.',
    description:
      'No se trata solo de cargar tiempo. Se trata de entender que avanza, que se frena y donde intervenir antes de perder foco.',
    items: ['Dashboard con lectura de riesgo', 'Seguimiento de bloqueos y vencimientos', 'Tiempo trabajado con contexto de proyecto'],
  },
];

const benefits = [
  'Una entrada publica seria para presentar el producto a nuevos usuarios.',
  'Un acceso simple y profesional para equipos que ya trabajan dentro de Tino.',
  'Una narrativa comercial alineada con el valor real del producto.',
];

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const handlePrimaryAction = () => {
    router.push(user ? '/dashboard' : '/login');
  };

  return (
    <main className="relative overflow-hidden">
      <section className="relative border-b border-[var(--color-border-soft)]">
        <div className="absolute inset-0 app-grid opacity-40" />
        <div className="absolute left-[-8rem] top-[-7rem] h-72 w-72 rounded-full bg-[rgba(21,101,140,0.12)] blur-3xl" />
        <div className="absolute right-[-6rem] top-[4rem] h-80 w-80 rounded-full bg-[rgba(15,118,110,0.12)] blur-3xl" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1240px] flex-col px-5 pb-20 pt-6 sm:px-8 lg:px-10">
          <header className="flex items-center justify-between gap-4">
            <BrandMark />
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="hidden text-sm font-medium text-[var(--color-ink-600)] transition-colors hover:text-[var(--color-ink-900)] sm:inline-flex"
              >
                Ingresar
              </Link>
              <Button size="sm" onClick={handlePrimaryAction} disabled={isLoading}>
                {user ? 'Ir al dashboard' : 'Entrar al producto'}
              </Button>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[minmax(0,1.1fr)_460px] lg:py-20">
            <div className="space-y-8">
              <div className="inline-flex rounded-full border border-[rgba(17,24,39,0.08)] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary-700)] shadow-[var(--shadow-card)]">
                SaaS de operacion para equipos con proyectos vivos
              </div>

              <div className="space-y-5">
                <h1 className="max-w-4xl text-[clamp(3rem,7vw,5.8rem)] font-semibold leading-[0.93] tracking-[-0.06em] text-[var(--color-ink-900)]">
                  Trabajo, tiempo y visibilidad en una sola capa de gestion.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-[var(--color-ink-600)] sm:text-xl">
                  Tino ayuda a equipos a coordinar proyectos, registrar tiempo y leer la operacion sin perder contexto.
                  Menos friccion para ejecutar. Mas claridad para decidir.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" onClick={handlePrimaryAction} disabled={isLoading}>
                  {user ? 'Abrir espacio de trabajo' : 'Ir a login'}
                </Button>
                <Link
                  href="#features"
                  className="inline-flex h-12 items-center justify-center rounded-[16px] border border-[var(--color-border-soft)] bg-[var(--color-ink-050)] px-6 text-sm font-medium text-[var(--color-ink-900)] transition-colors hover:border-[rgba(21,101,140,0.18)] hover:bg-[var(--color-primary-050)] sm:min-w-[180px]"
                >
                  Ver capacidades
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {metrics.map((metric) => (
                  <Card key={metric.label} className="bg-white/82 backdrop-blur-sm" padding="md">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-500)]">
                      {metric.label}
                    </p>
                    <p className="mt-3 text-base font-semibold leading-6 text-[var(--color-ink-900)]">
                      {metric.value}
                    </p>
                  </Card>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-x-8 top-8 h-36 rounded-full bg-[rgba(194,65,12,0.14)] blur-3xl" />
              <Card className="relative overflow-hidden border-[rgba(17,24,39,0.08)] bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(15,23,42,0.92))] p-0 text-white shadow-[0_32px_80px_rgba(15,23,42,0.24)]">
                <div className="border-b border-white/10 px-6 py-5">
                  <BrandMark tone="light" href="/login" />
                </div>
                <div className="space-y-6 px-6 py-7">
                  <div className="rounded-[22px] border border-white/10 bg-white/6 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-white/56">Resumen operativo</p>
                        <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em]">Todo lo que el equipo necesita ver primero</h2>
                      </div>
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                        En linea
                      </span>
                    </div>
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] bg-white/6 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-white/50">Horas registradas</p>
                        <p className="mt-2 text-3xl font-semibold">148h</p>
                        <p className="mt-1 text-sm text-white/64">Tiempo asociado a proyectos activos</p>
                      </div>
                      <div className="rounded-[18px] bg-white/6 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-white/50">Bloqueos detectados</p>
                        <p className="mt-2 text-3xl font-semibold">03</p>
                        <p className="mt-1 text-sm text-white/64">Senales para intervenir a tiempo</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      'Dashboard para leer foco, riesgo y carga del equipo.',
                      'Timer por proyecto conectado al trabajo real.',
                      'Permisos y acceso listos para organizaciones.',
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary-700)]">
              Propuesta de valor
            </p>
            <h2 className="text-[clamp(2rem,4vw,3.4rem)] font-semibold leading-[0.96] tracking-[-0.05em] text-[var(--color-ink-900)]">
              Una plataforma para operar mejor, no para sumar ruido.
            </h2>
            <p className="text-base leading-7 text-[var(--color-ink-600)]">
              Tino presenta una cara comercial clara hacia afuera y mantiene una experiencia enfocada hacia adentro.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {featureColumns.map((feature) => (
              <Card key={feature.title} hoverable className="h-full">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-secondary-600)]">
                  {feature.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-ink-900)]">
                  {feature.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-[var(--color-ink-600)]">
                  {feature.description}
                </p>
                <div className="mt-6 space-y-3">
                  {feature.items.map((item) => (
                    <div key={item} className="rounded-[18px] bg-[var(--color-ink-050)] px-4 py-3 text-sm text-[var(--color-ink-700)]">
                      {item}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--color-border-soft)] bg-white/70">
        <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:px-10">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-700)]">
              Beneficios
            </p>
            <h2 className="text-[clamp(2rem,4vw,3.1rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-[var(--color-ink-900)]">
              Disenado para vender mejor y operar con menos friccion.
            </h2>
          </div>
          <div className="grid gap-4">
            {benefits.map((benefit, index) => (
              <Card key={benefit} className="flex items-start gap-4 bg-[rgba(255,255,255,0.9)]">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-050)] text-sm font-semibold text-[var(--color-primary-700)]">
                  0{index + 1}
                </span>
                <p className="pt-1 text-base leading-7 text-[var(--color-ink-700)]">{benefit}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 lg:px-10">
        <Card className="overflow-hidden border-[rgba(17,24,39,0.08)] bg-[linear-gradient(135deg,#0f172a,#155e75)] text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">
                Entrada al producto
              </p>
              <h2 className="text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[0.96] tracking-[-0.05em]">
                Presenta Tino con una narrativa seria y lleva a cada usuario directo a su espacio.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-white/72">
                La landing introduce el valor. El login ordena el acceso. La app privada sigue enfocada en ejecucion.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="bg-white text-[var(--color-ink-900)] hover:bg-[var(--color-ink-100)]"
                onClick={handlePrimaryAction}
                disabled={isLoading}
              >
                {user ? 'Volver al dashboard' : 'Ingresar a Tino'}
              </Button>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-[16px] border border-white/20 px-5 py-3 text-sm font-medium text-white/86 transition-colors hover:bg-white/8"
              >
                Abrir pantalla de acceso
              </Link>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
