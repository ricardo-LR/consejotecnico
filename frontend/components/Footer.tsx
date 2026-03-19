import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <span className="text-xl font-bold text-white">CONSEJOTECNICO</span>
            <p className="mt-3 text-sm text-gray-400 leading-relaxed">
              Planeaciones educativas de calidad para docentes comprometidos con la excelencia académica.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Navegación</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">Inicio</Link>
              </li>
              <li>
                <Link href="/catalog" className="hover:text-white transition-colors">Catálogo</Link>
              </li>
              <li>
                <Link href="/auth/login" className="hover:text-white transition-colors">Iniciar sesión</Link>
              </li>
              <li>
                <Link href="/auth/register" className="hover:text-white transition-colors">Registrarse</Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">Soporte</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="mailto:soporte@consejotecnico.com" className="hover:text-white transition-colors">
                  soporte@consejotecnico.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-gray-800 text-sm text-gray-500 text-center">
          &copy; {new Date().getFullYear()} CONSEJOTECNICO. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
}
