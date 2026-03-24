'use client';

import { useEffect, useState } from 'react';
import PlanCard from '@/components/PlanCard';
import { isLoggedIn } from '@/lib/auth';
import Link from 'next/link';

export default function PricingPage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Planes y Precios</h1>
          <p className="text-xl text-gray-600">Elige el plan que mejor se adapte a tus necesidades</p>
        </div>

        {loggedIn && (
          <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-green-700">
              ✅ Ya tienes sesión iniciada. Puedes suscribirte a un plan.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          <PlanCard planId="gratuito" />
          <PlanCard planId="grado" />
          <PlanCard planId="pro" featured />
        </div>

        {!loggedIn && (
          <div className="mt-12 text-center">
            <p className="text-gray-600 mb-4">¿No tienes cuenta? Crea una para comenzar</p>
            <Link
              href="/auth/register"
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
            >
              Crear cuenta gratis
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
