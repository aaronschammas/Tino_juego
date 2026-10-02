import Link from 'next/link';

export default function SeguridadPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-12 px-6 sm:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="mb-10">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
            ← Volver al inicio
          </Link>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">Políticas de Seguridad</h1>
        
        <div className="space-y-6 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Introducción</h2>
            <p>En Tino, la seguridad de la información de tu equipo y proyectos es nuestra prioridad. Implementamos medidas técnicas, administrativas y físicas para proteger tus datos contra el acceso no autorizado, alteración o destrucción.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Protección de Datos</h2>
            <p>Toda la información transmitida entre tu navegador y nuestros servidores está encriptada utilizando protocolos de seguridad estándar de la industria (TLS/SSL). Los datos almacenados están resguardados en bases de datos con acceso restringido y monitorización constante.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Autenticación y Accesos</h2>
            <p>Ofrecemos autenticación segura mediante proveedores confiables como Google y sistemas de contraseñas robustas. Recomendamos a todos nuestros usuarios mantener la confidencialidad de sus credenciales y notificar inmediatamente cualquier sospecha de acceso no autorizado.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Infraestructura</h2>
            <p>Nuestra infraestructura se aloja en proveedores de nube líderes en la industria que cumplen con los más altos estándares de seguridad y certificaciones internacionales. Realizamos auditorías periódicas y mantenemos nuestros sistemas actualizados frente a vulnerabilidades conocidas.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
