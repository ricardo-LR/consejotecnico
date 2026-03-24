'use client';

import { useEffect, useState } from 'react';
import { isLoggedIn } from '@/lib/auth';
import Link from 'next/link';

interface RequireAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RequireAuth({ children, fallback }: RequireAuthProps) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setLoading(false);
  }, []);

  if (loading) return <div className="py-8 text-center text-gray-400">Cargando...</div>;

  if (!loggedIn) {
    return (
      <>
        {fallback ?? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-gray-700 mb-4">Debes iniciar sesión para continuar</p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/auth/login"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/auth/register"
                className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}
