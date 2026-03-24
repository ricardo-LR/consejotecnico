'use client';

import { useEffect, useState } from 'react';
import { isLoggedIn } from '@/lib/auth';
import Link from 'next/link';

interface RequireAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RequireAuth({ children, fallback }: RequireAuthProps) {
  const [loggedIn, setLoggedIn]   = useState(false);
  const [loading, setLoading]     = useState(true);
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    console.log('[REQUIRE_AUTH] ════════════════════════════════════════');

    const token    = localStorage.getItem('token');
    const userStr  = localStorage.getItem('user');
    const plan     = localStorage.getItem('plan_type');
    const logged   = isLoggedIn();

    console.log('[REQUIRE_AUTH] localStorage.token:', token   ? `✅ ${token.substring(0, 30)}...` : '❌ NULL');
    console.log('[REQUIRE_AUTH] localStorage.user:', userStr  ? '✅ SI' : '❌ NULL');
    console.log('[REQUIRE_AUTH] localStorage.plan_type:', plan ? `✅ ${plan}` : '❌ NULL');
    console.log('[REQUIRE_AUTH] isLoggedIn():', logged ? '✅ TRUE' : '❌ FALSE');
    console.log('[REQUIRE_AUTH] ════════════════════════════════════════');

    setDebugInfo(
      `token: ${token ? 'SI' : 'NO'} | user: ${userStr ? 'SI' : 'NO'} | plan: ${plan ?? 'NO'} | isLoggedIn: ${logged}`
    );
    setLoggedIn(logged);
    setLoading(false);
  }, []);

  if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Verificando autenticación...</div>;

  if (!loggedIn) {
    return (
      <>
        {fallback ?? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-gray-700 mb-1 font-semibold">⚠️ No autenticado</p>
            <p className="text-xs text-gray-500 mb-4 font-mono">{debugInfo}</p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/auth/login"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 text-sm"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/auth/register"
                className="px-6 py-2 border border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 text-sm"
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
