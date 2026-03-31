'use client';

import { useEffect, useState } from 'react';
import { isLoggedIn } from '@/lib/auth';
import { PLANS } from '@/config/plans';

export default function CatalogoPage() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(isLoggedIn());
  }, []);

  const planes = Object.values(PLANS);

  const handleSuscribirse = (planId: string) => {
    if (!loggedIn) {
      window.location.href = `/auth/login?redirect=/checkout?plan=${planId}`;
      return;
    }
    window.location.href = `/checkout?plan=${planId}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Planes y Precios</h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Recursos educativos alineados a la NEM 2022 para maestros y directivos
            de escuelas mexicanas
          </p>
        </div>

        {/* Grid de planes */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
          {planes.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-sm border-2 p-6 flex flex-col ${
                plan.popular
                  ? 'border-blue-500 shadow-blue-100 shadow-lg'
                  : plan.id === 'pro_directivo'
                  ? 'border-purple-400 shadow-purple-50 shadow-md'
                  : 'border-gray-100'
              }`}
            >
              {/* Badge popular */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-4 py-1 rounded-full">
                    ⭐ Más popular
                  </span>
                </div>
              )}

              {/* Badge directivo */}
              {plan.id === 'pro_directivo' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className="bg-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                    🏫 Para Directivos
                  </span>
                </div>
              )}

              {/* Tipo */}
              {plan.tipo && (
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full w-fit mb-3 ${
                    plan.tipo === 'directivo'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {plan.tipo === 'directivo' ? '🏫 Directivos' : '👩‍🏫 Maestros'}
                </span>
              )}

              {/* Nombre y precio */}
              <h2 className="text-xl font-bold text-gray-800 mb-1">{plan.nombre}</h2>
              <div className="mb-3">
                {plan.precio === 0 ? (
                  <span className="text-3xl font-bold text-gray-800">$0</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-gray-800">${plan.precio}</span>
                    <span className="text-gray-400 text-sm">/{plan.periodo}</span>
                  </>
                )}
              </div>

              {/* Descripción */}
              <p className="text-gray-500 text-sm mb-4">{plan.descripcion}</p>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {plan.id === 'gratuito' ? (
                <a
                  href={loggedIn ? '/dashboard' : '/auth/register'}
                  className="w-full text-center bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 px-4 rounded-xl transition-colors block"
                >
                  {loggedIn ? 'Ir al Dashboard' : plan.cta}
                </a>
              ) : (
                <button
                  onClick={() => handleSuscribirse(plan.id)}
                  className={`w-full font-semibold py-3 px-4 rounded-xl transition-colors ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : plan.id === 'pro_directivo'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Comparativa */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-3xl mx-auto">
          <h3 className="font-bold text-gray-800 mb-4 text-center">¿Cuál plan necesito?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="font-semibold text-blue-800 mb-2">👩‍🏫 Soy Maestro</p>
              <ul className="text-blue-700 space-y-1">
                <li>• Enseño 1 grado → <strong>Plan Por Grado</strong></li>
                <li>• Varios grados → <strong>Plan Pro Maestro</strong></li>
              </ul>
            </div>
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="font-semibold text-purple-800 mb-2">🏫 Soy Directivo</p>
              <ul className="text-purple-700 space-y-1">
                <li>• Necesito recursos CTE</li>
                <li>• Gestión escolar → <strong>Plan Pro Directivo</strong></li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
