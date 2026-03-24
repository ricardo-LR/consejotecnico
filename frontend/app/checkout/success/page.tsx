'use client';

import { useEffect } from 'react';

export default function CheckoutSuccess() {
  useEffect(() => {
    // Actualizar plan_type en localStorage si llega query param
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    if (plan) {
      localStorage.setItem('plan_type', plan);
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const u = JSON.parse(user);
          u.plan_type = plan;
          localStorage.setItem('user', JSON.stringify(u));
        } catch {}
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center px-4">
      <div className="text-center p-8 max-w-md">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-3xl font-bold text-green-700 mb-4">
          ¡Pago Exitoso!
        </h1>
        <p className="text-gray-600 mb-8">
          Tu plan se ha activado correctamente.
          Ya puedes acceder a todos los recursos premium.
        </p>
        <a
          href="/maestro/dashboard"
          className="inline-block px-8 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
        >
          Ir a Mi Dashboard →
        </a>
      </div>
    </div>
  );
}
