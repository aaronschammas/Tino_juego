'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return <HomePageContent />;
}

function HomePageContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Si ya está logueado, ir al dashboard de forma nativa
    if (!isLoading && user) {
      router.replace('/dashboard');
      return;
    }

    // No realizamos limpieza agresiva de localStorage aquí para evitar bucles de redirección
    // y pérdida de estado durante la hidratación.
  }, [user, isLoading]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="flex flex-wrap items-center justify-between px-6 sm:px-8 py-6 max-w-7xl mx-auto gap-4">
        <div className="flex items-center">
          <img 
            src="/LogoPrincipalLetras.png" 
            alt="Tino Logo" 
            className="h-10 md:h-12 w-auto object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:gap-8 text-sm font-medium w-full sm:w-auto justify-center sm:justify-end mt-2 sm:mt-0 sm:pr-[76px]">
          <Link href="/login" className="text-blue-600 hover:text-blue-700">Empezar</Link>
          <Link href="#nosotros" className="text-slate-900 hover:text-slate-700">Acerca de nosotros</Link>
          <Link href="#contacto" className="text-slate-900 hover:text-slate-700">Contacto</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 sm:px-8 pt-8 sm:pt-12 pb-16 sm:pb-24 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 items-center">
        <div className="space-y-[37px] max-w-xl text-center lg:text-left mx-auto lg:mx-0">
          <p className="text-xs tracking-widest text-slate-500 uppercase">TU OPERACIÓN, CLARA</p>
          <br></br>
          <h1 className="text-4xl md:text-5xl font-bold leading-[1.15] md:leading-[1.1] tracking-tight">
            Visibilidad total de tu equipo en un solo lugar
          </h1>
          <br></br>
          <p className="text-slate-600 text-base md:text-lg leading-relaxed">
            Gestiona proyectos, asigna tareas, registra tiempo real y accede al dashboard operativo. Todo lo que necesitas saber sobre dónde se va el tiempo de tu negocio.
          </p>
          <br></br>
          <div>
            <Link href="/login" className="inline-block bg-[#0033ff] text-white !text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
              Empezá ahora
            </Link>
          </div>
        </div>
        <div className="relative">
          {/* Decorative background shape */}
          <div className="absolute top-0 right-0 w-[120%] h-[120%] bg-[#e5e7f0] rounded-full -z-10 translate-x-1/4 -translate-y-1/4"></div>
          <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl relative z-10 bg-slate-200">
            <Image src="/images/cowork.jpg" alt="Equipo trabajando" fill priority className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 sm:px-8 py-16 sm:py-20 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#0b0f24] text-white p-8 rounded-2xl relative overflow-hidden flex flex-col min-h-[300px] cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all">
             <div className="w-12 h-12 bg-slate-300 rounded-full mb-8"></div>
             <h3 className="text-xl font-bold mb-4">Claridad Instantánea</h3>
             <p className="text-slate-300 text-sm leading-relaxed mb-8 flex-grow">
               Visualizá qué está haciendo cada persona y cuánto tiempo lleva cada tarea en tiempo real.
             </p>
          </div>
          
          <div className="bg-[#d5d8e6] text-[#0b0f24] p-8 rounded-2xl flex flex-col min-h-[300px] cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all">
             <div className="w-12 h-12 bg-[#0b0f24] rounded-full mb-8"></div>
             <h3 className="text-xl font-bold mb-4">Foco donde importa</h3>
             <p className="text-slate-600 text-sm leading-relaxed mb-8 flex-grow">
               Detectá cuellos de botella y tareas que consumen más tiempo del esperado para optimizar la rentabilidad.
             </p>
          </div>

          <div className="bg-[#d5d8e6] text-[#0b0f24] p-8 rounded-2xl flex flex-col min-h-[300px] cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all">
             <div className="w-12 h-12 bg-[#0b0f24] rounded-full mb-8"></div>
             <h3 className="text-xl font-bold mb-4">Menos fricción</h3>
             <p className="text-slate-600 text-sm leading-relaxed mb-8 flex-grow">
               Eliminá planillas manuales y reportes complejos. Obtené datos reales para tomar decisiones más rápidas.
             </p>
          </div>
        </div>
      </section>

      {/* How it works Section */}
      <section className="bg-[#0b0f24] text-white py-16 sm:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 items-center relative z-10">
          <div className="relative">
            {/* Decorative background shape */}
            <div className="absolute top-1/2 left-0 w-[120%] aspect-square bg-[#9b9fb8] rounded-full -z-10 -translate-x-1/2 -translate-y-1/2"></div>
            <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-slate-200 relative">
               <Image src="/images/help.jpg" alt="Persona trabajando" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            </div>
          </div>
          <div className="space-y-6 sm:space-y-8 text-center lg:text-left mx-auto lg:mx-0 max-w-xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Claridad Instantánea</h2>
            <br></br>
            <p className="text-slate-300 text-lg md:text-xl max-w-md mx-auto lg:mx-0">
              Abrí Tino y entendé en qué se va el tiempo de tu equipo:
            </p>
            <br></br>
            <ul className="space-y-6">
              <li className="flex items-start gap-4 text-slate-300">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#9b9fb8] text-white flex items-center justify-center font-bold">1</span>
                <span>Visualizá tareas y tiempos en tiempo real</span>
              </li>
              <li className="flex items-start gap-4 text-slate-300">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#9b9fb8] text-white flex items-center justify-center font-bold">2</span>
                <span>Detectá en qué se está trabajando sin esperar reportes</span>
              </li>
              <li className="flex items-start gap-4 text-slate-300">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#9b9fb8] text-white flex items-center justify-center font-bold">3</span>
                <span>Tomá decisiones más rápidas con información clara</span>
              </li>
            </ul>
            <div className="pt-4">
              <Link href="/login" className="inline-block bg-[#9b9fb8] text-white !text-white px-8 py-3 rounded-lg font-medium hover:bg-opacity-80 transition-colors">
                Empezá ahora
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="nosotros" className="py-16 sm:py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 items-center relative z-10">
          <div className="space-y-6 text-center lg:text-left mx-auto lg:mx-0 max-w-xl">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Sobre Nosotros</h2>
            <br></br>
            <p className="text-slate-600 text-base md:text-lg leading-relaxed max-w-lg mx-auto lg:mx-0">
              En Tino creemos que gestionar tu negocio debería ser simple. Creamos una herramienta pensada para freelancers y pymes que necesitan organizar su trabajo sin complicaciones.
              Nuestro objetivo es ayudarte a tener control, ahorrar tiempo y enfocarte en lo que realmente importa: hacer crecer tu proyecto.
            </p>
            <br></br>
            <div className="pt-4">
              <Link href="/login" className="inline-block bg-[#0033ff] text-white !text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                Empezá ahora
              </Link>
            </div>
          </div>
          <div className="relative">
            {/* Decorative background shape */}
            <div className="absolute top-1/2 right-0 w-[120%] aspect-square bg-[#0033ff] rounded-full -z-10 translate-x-1/4 -translate-y-1/2"></div>
            <div className="rounded-3xl overflow-hidden shadow-2xl bg-slate-200 border-8 border-slate-800 relative aspect-video">
               <Image src="/images/notebook.jpg" alt="Dashboard" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contacto" className="bg-[#0033ff] text-white py-6">
        <div className="max-w-7xl mx-auto px-6 sm:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-4 items-center text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start">
              <img 
                src="/LogoPrincipalBlancoLetras.png" 
                alt="Tino Logo" 
                className="h-8 md:h-10 w-auto object-contain"
              />
            </div>
            
            <div>
              <p className="font-medium mb-1">Contacto</p>
              <a href="tel:+543513745250" className="text-white/80 hover:text-white block">+54 351 3745250</a>
            </div>
            
            <div>
              <p className="font-medium mb-1">Mail</p>
              <a href="mailto:leonardotomas.mendezrodriguez@gmail.com" className="text-white/80 hover:text-white block">leonardotomas.mendezrodriguez@gmail.com</a>
            </div>
          </div>
          
          <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-6 text-center">
            <div className="flex items-center gap-4 justify-center">
              <a href="https://facebook.com/tino" target="_blank" rel="noopener noreferrer" className="w-10 h-10 border border-white rounded flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </a>
              <a href="#" className="w-10 h-10 border border-white rounded flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a href="https://instagram.com/tino" target="_blank" rel="noopener noreferrer" className="w-10 h-10 border border-white rounded flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm text-white/80">
              <Link href="/security" className="hover:text-white">Seguridad</Link>
              <Link href="/privacy" className="hover:text-white">Privacidad</Link>
              <Link href="/terms" className="hover:text-white">Términos</Link>
              <a href="#" className="hover:text-white">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
