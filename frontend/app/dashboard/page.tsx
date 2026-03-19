'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface Purchase {
  id: string;
  title: string;
  date: string;
  amount: number;
  downloadUrl: string;
}

const MOCK_PURCHASES: Purchase[] = [
  { id: '1', title: 'Planeación de Matemáticas – Unidad 1', date: '2026-03-10', amount: 79, downloadUrl: '#' },
  { id: '2', title: 'Planeación de Español – Comprensión lectora', date: '2026-02-28', amount: 49, downloadUrl: '#' },
  { id: '3', title: 'Planeación de Ciencias – El sistema solar', date: '2026-02-15', amount: 0, downloadUrl: '#' },
];

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [purchases] = useState<Purchase[]>(MOCK_PURCHASES);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  function handleLogout() {
    logout();
    router.push('/');
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24" aria-label="Cargando">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const subscriptionLabel = user.subscription ?? 'Básico (Gratis)';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">¡Hola, {user.name}!</h1>
          <p className="text-gray-500 text-sm mt-1">{user.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="self-start sm:self-auto flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500 mb-1">Plan actual</p>
          <p className="text-lg font-bold text-blue-600">{subscriptionLabel}</p>
          <Link href="/#pricing" className="text-xs text-blue-500 hover:underline mt-1 inline-block">
            Actualizar plan
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500 mb-1">Compras totales</p>
          <p className="text-lg font-bold text-gray-900">{purchases.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <p className="text-sm text-gray-500 mb-1">Total gastado</p>
          <p className="text-lg font-bold text-gray-900">
            ${purchases.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Downloads / Purchases */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Mis compras y descargas</h2>
          <Link href="/catalog" className="text-sm text-blue-600 font-medium hover:underline">
            Ver catálogo
          </Link>
        </div>

        {purchases.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="font-medium">Aún no tienes compras</p>
            <Link href="/catalog" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
              Explorar catálogo
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{purchase.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(purchase.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {' · '}
                    {purchase.amount === 0 ? 'Gratis' : `$${purchase.amount.toFixed(2)}`}
                  </p>
                </div>
                <a
                  href={purchase.downloadUrl}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 shrink-0"
                  aria-label={`Descargar ${purchase.title}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Profile settings link */}
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900 text-sm">Configuración de cuenta</p>
          <p className="text-xs text-gray-400 mt-0.5">Actualiza tu perfil y contraseña</p>
        </div>
        <Link
          href="/dashboard/profile"
          className="text-sm text-blue-600 font-medium hover:underline flex items-center gap-1"
        >
          Editar perfil
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
