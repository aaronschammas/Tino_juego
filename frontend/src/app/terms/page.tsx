import Link from 'next/link';

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-12 px-6 sm:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="mb-10">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
            ← Volver al inicio
          </Link>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">Términos y Condiciones</h1>
        
        <div className="space-y-6 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Aceptación de los Términos</h2>
            <p>Al acceder y utilizar Tino, aceptas estar sujeto a estos Términos y Condiciones. Si no estás de acuerdo con alguna parte de los términos, no podrás acceder a la plataforma ni utilizar nuestros servicios.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Uso de la Plataforma</h2>
            <p>Tino es una herramienta de gestión de proyectos y seguimiento de tiempo. Te comprometes a utilizar la plataforma solo con fines legales y de acuerdo con estos términos. Eres responsable de toda la actividad que ocurra bajo tu cuenta.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Cuentas y Suscripciones</h2>
            <p>Para utilizar Tino debes registrarte y crear una cuenta. Al elegir un plan de pago, aceptas pagar las tarifas aplicables. Tino se reserva el derecho de modificar los precios con previo aviso.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Propiedad Intelectual</h2>
            <p>La plataforma Tino, incluyendo su código, diseño, textos, gráficos y logotipo, es propiedad exclusiva de sus creadores y está protegida por las leyes de propiedad intelectual correspondientes. No se permite la reproducción total o parcial sin autorización expresa.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Limitación de Responsabilidad</h2>
            <p>Tino se proporciona "tal cual" y "según disponibilidad". No garantizamos que el servicio será ininterrumpido o libre de errores. En ningún caso seremos responsables por daños indirectos, incidentales o consecuentes derivados del uso de la plataforma.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
