'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isLoggedIn, getUser, getPlanType, logout } from '@/lib/auth';

const PLAN_BADGE: Record<string, { label: string; color: string }> = {
  gratuito: { label: 'Gratuito',  color: 'bg-gray-100 text-gray-600' },
  grado:    { label: 'Por Grado', color: 'bg-blue-100 text-blue-700' },
  pro:      { label: 'Pro',       color: 'bg-purple-100 text-purple-700' },
};

export default function Navbar() {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [planType, setPlanType] = useState('gratuito');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const logged = isLoggedIn();
    setLoggedIn(logged);
    if (logged) {
      const user = getUser();
      setUserName(user?.nombre || user?.email || 'USER');
      setPlanType(getPlanType() || 'gratuito');
    }
  }, []);

  const handleLogout = () => {
    console.log('[NAVBAR] Cerrando sesión');
    logout();
    setShowMenu(false);
    setLoggedIn(false);
    router.push('/auth/login');
  };

  const initial = userName ? userName[0].toUpperCase() : 'U';
  const displayName = userName ? userName.split('@')[0].toUpperCase() : 'USER';

  if (!mounted) return null;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 hover:opacity-80">
            <div className="w-8 h-8 bg-blue-600 rounded text-white flex items-center justify-center font-bold text-sm">
              CT
            </div>
            <span className="font-bold text-gray-900">CONSEJOTECNICO</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-600 hover:text-gray-900">Inicio</Link>
            <Link href="/catalog" className="text-gray-600 hover:text-gray-900">Catálogo</Link>
          </div>

          {/* Auth section */}
          <div className="hidden md:flex items-center space-x-4">
            {loggedIn ? (
              <>
                <Link
                  href="/maestro/dashboard"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                >
                  Mi Workspace
                </Link>

                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="px-4 py-2 border border-gray-300 rounded-lg flex items-center space-x-2 hover:bg-gray-50 transition"
                  >
                    <span className="w-6 h-6 bg-blue-600 text-white rounded text-xs flex items-center justify-center font-bold">
                      {initial}
                    </span>
                    <span className="text-sm">{displayName}</span>
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                      <div className="px-4 py-2 border-b">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(PLAN_BADGE[planType] ?? PLAN_BADGE.gratuito).color}`}>
                          {(PLAN_BADGE[planType] ?? PLAN_BADGE.gratuito).label}
                        </span>
                      </div>
                      <Link
                        href="/dashboard"
                        onClick={() => setShowMenu(false)}
                        className="block px-4 py-2 hover:bg-gray-50 border-b text-sm text-gray-700"
                      >
                        📊 Mi Dashboard
                      </Link>
                      <Link
                        href="/maestro/dashboard"
                        onClick={() => setShowMenu(false)}
                        className="block px-4 py-2 hover:bg-gray-50 border-b text-sm text-gray-700"
                      >
                        👥 Mi Workspace
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 font-semibold text-sm"
                      >
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-4 py-2 text-blue-600 font-semibold hover:text-blue-700"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/auth/register"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
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
            aria-label="Abrir menú"
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
          <Link href="/" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Inicio</Link>
          <Link href="/catalog" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Catálogo</Link>
          {loggedIn ? (
            <>
              <Link href="/maestro/dashboard" className="text-blue-600 font-semibold" onClick={() => setMenuOpen(false)}>Mi Workspace</Link>
              <Link href="/dashboard" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Mi Dashboard</Link>
              <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="text-left text-red-600 font-medium">
                Cerrar sesión
              </button>
            </>
          ) : (
            <div className="pt-4 border-t border-gray-200 flex flex-col gap-3">
              <Link href="/auth/login" className="text-gray-700 hover:text-blue-600 font-medium" onClick={() => setMenuOpen(false)}>Iniciar sesión</Link>
              <Link href="/auth/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-center hover:bg-blue-700" onClick={() => setMenuOpen(false)}>Registrarse</Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
