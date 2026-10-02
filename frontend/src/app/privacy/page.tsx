import Link from 'next/link';

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans py-12 px-6 sm:px-8">
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="mb-10">
          <Link href="/" className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors">
            ← Volver al inicio
          </Link>
        </div>
        
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-8">Políticas de Privacidad</h1>
        
        <div className="space-y-6 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Recopilación de Información</h2>
            <p>Recopilamos la información que nos proporcionas directamente, como tu nombre, dirección de correo electrónico, y datos de facturación al registrarte en Tino. También podemos recopilar automáticamente cierta información sobre tu uso de la plataforma mediante cookies y tecnologías similares.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Uso de la Información</h2>
            <p>Utilizamos la información recopilada para proveer, mantener y mejorar nuestros servicios, procesar transacciones, enviarte avisos técnicos y mensajes de soporte, y comunicarnos contigo sobre productos, servicios y ofertas que puedan interesarte.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. Compartir Información</h2>
            <p>No vendemos ni alquilamos tu información personal a terceros. Podemos compartir información con proveedores de servicios de terceros que necesitan acceder a ella para realizar trabajos en nuestro nombre (como procesamiento de pagos o alojamiento en la nube), sujetos a estrictos acuerdos de confidencialidad.</p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Tus Derechos</h2>
            <p>Tienes derecho a acceder, corregir, actualizar o solicitar la eliminación de tu información personal en cualquier momento. Para ejercer estos derechos, por favor contáctanos a través de nuestro correo de soporte o canales oficiales.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
