'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    router.push('/');
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-blue-600">CONSEJOTECNICO</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Inicio
            </Link>
            <Link href="/catalog" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
              Catálogo
            </Link>
            {user && (
              <Link href="/dashboard" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                Dashboard
              </Link>
            )}
          </div>

          {/* Auth section */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 font-medium"
                  aria-expanded={userMenuOpen}
                  aria-haspopup="true"
                >
                  <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span>{user.name}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                    <Link href="/dashboard" className="block px-4 py-2 text-gray-700 hover:bg-gray-50">
                      Mi Dashboard
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-50"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/login" className="text-gray-700 hover:text-blue-600 font-medium transition-colors">
                  Iniciar sesión
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Abrir menú de navegación"
            aria-expanded={menuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 flex flex-col gap-4">
          <Link href="/" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>
            Inicio
          </Link>
          <Link href="/catalog" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>
            Catálogo
          </Link>
          {user && (
            <Link href="/dashboard" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>
              Dashboard
            </Link>
          )}
          <div className="pt-4 border-t border-gray-200 flex flex-col gap-3">
            {user ? (
              <button
                onClick={() => { handleLogout(); setMenuOpen(false); }}
                className="text-left text-red-600 font-medium"
              >
                Cerrar sesión
              </button>
            ) : (
              <>
                <Link href="/auth/login" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>
                  Iniciar sesión
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-center hover:bg-blue-700 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
