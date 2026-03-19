import Link from 'next/link';

const features = [
  {
    icon: (
      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    title: 'Planeaciones de calidad',
    description: 'Cientos de planeaciones elaboradas por expertos, organizadas por grado y asignatura.',
  },
  {
    icon: (
      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
    title: 'Descarga inmediata',
    description: 'Compra y descarga al instante. Sin esperas, sin trámites. Listo para usar en el aula.',
  },
  {
    icon: (
      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Alineadas al currículo',
    description: 'Todas las planeaciones están alineadas al plan de estudios oficial vigente.',
  },
];

const tiers = [
  { name: 'Básico', price: 0, features: ['5 planeaciones gratuitas', 'Acceso al catálogo', 'Soporte por email'], cta: 'Empezar gratis', href: '/auth/register', highlight: false },
  { name: 'Starter', price: 99, features: ['20 descargas/mes', 'Todas las asignaturas', 'Soporte prioritario'], cta: 'Suscribirse', href: '/auth/register', highlight: false },
  { name: 'Pro', price: 199, features: ['Descargas ilimitadas', 'Acceso anticipado', 'Soporte 24/7'], cta: 'Suscribirse', href: '/auth/register', highlight: true },
  { name: 'Escuela', price: 499, features: ['Hasta 10 docentes', 'Dashboard de escuela', 'Facturación'], cta: 'Contactar', href: '/auth/register', highlight: false },
  { name: 'Distrito', price: 999, features: ['Docentes ilimitados', 'Gestión centralizada', 'SLA garantizado'], cta: 'Contactar', href: '/auth/register', highlight: false },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            Planeaciones educativas<br className="hidden sm:block" /> para docentes modernos
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-10">
            Ahorra tiempo y mejora tus clases con planeaciones profesionales listas para usar. Organizadas por grado y asignatura.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/catalog"
              className="bg-white text-blue-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-colors"
            >
              Ver catálogo
            </Link>
            <Link
              href="/auth/register"
              className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 transition-colors"
            >
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">¿Por qué CONSEJOTECNICO?</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Todo lo que necesitas para planear tus clases de manera eficiente y profesional.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                <div className="flex justify-center mb-4">{f.icon}</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Planes y precios</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Elige el plan que mejor se adapte a tus necesidades.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-6 border flex flex-col ${
                  tier.highlight
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xl scale-105'
                    : 'bg-white text-gray-900 border-gray-200'
                }`}
              >
                {tier.highlight && (
                  <span className="text-xs font-semibold bg-white/20 text-white px-2 py-1 rounded-full self-start mb-3">
                    Más popular
                  </span>
                )}
                <h3 className={`text-lg font-bold mb-1 ${tier.highlight ? 'text-white' : 'text-gray-900'}`}>
                  {tier.name}
                </h3>
                <p className={`text-3xl font-bold mb-5 ${tier.highlight ? 'text-white' : 'text-gray-900'}`}>
                  {tier.price === 0 ? 'Gratis' : `$${tier.price}`}
                  {tier.price > 0 && <span className="text-sm font-normal opacity-70">/mes</span>}
                </p>
                <ul className="space-y-2 flex-1 mb-6">
                  {tier.features.map((feat) => (
                    <li key={feat} className={`text-sm flex items-center gap-2 ${tier.highlight ? 'text-blue-100' : 'text-gray-600'}`}>
                      <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`w-full text-center py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                    tier.highlight
                      ? 'bg-white text-blue-600 hover:bg-blue-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 bg-gray-900 text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Comienza hoy mismo</h2>
          <p className="text-gray-400 text-lg mb-8">
            Únete a miles de docentes que ya usan CONSEJOTECNICO para planear sus clases.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-blue-600 text-white px-10 py-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </section>
    </>
  );
}
