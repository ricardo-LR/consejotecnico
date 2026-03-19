'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

const PLANS = [
  { key: 'individual',  label: 'Planeación individual',  price: '$25–$100 MXN',  desc: 'Una sola planeación' },
  { key: 'pack_5',      label: 'Pack 5 planeaciones',    price: '$300 MXN',       desc: '5 planeaciones a tu elección' },
  { key: 'anual_grado', label: 'Plan anual por grado',   price: '$999 MXN',       desc: 'Acceso ilimitado a un grado, 365 días' },
  { key: 'anual_total', label: 'Plan anual completo',    price: '$1,499 MXN',     desc: 'Acceso ilimitado a todos los grados, 365 días' },
] as const;

type PlanKey = typeof PLANS[number]['key'];

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const planeacionId = searchParams.get('planeacion_id') ?? '';
  const [planType, setPlanType] = useState<PlanKey>(
    (searchParams.get('plan_type') as PlanKey) ?? 'individual'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!planeacionId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-gray-500 mb-4">Planeación no especificada.</p>
        <Link href="/catalog" className="text-blue-600 hover:underline font-medium">
          ← Volver al catálogo
        </Link>
      </div>
    );
  }

  async function handleCheckout() {
    if (!user) {
      router.push(
        `/auth/login?next=${encodeURIComponent(`/checkout?planeacion_id=${planeacionId}&plan_type=${planType}`)}`
      );
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          planeacion_id: planeacionId,
          plan_type: planType,
          completeness_score: 0.8,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar el pago');
      }
      // Redirect to MercadoPago checkout
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar el pago');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Finalizar compra</h1>
      <p className="text-gray-500 mb-8 text-sm">
        Selecciona tu plan y procede al pago seguro con MercadoPago.
      </p>

      {/* Plan selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Selecciona tu plan
        </h2>
        <div className="space-y-3">
          {PLANS.map(({ key, label, price, desc }) => (
            <label
              key={key}
              className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                planType === key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="plan_type"
                  value={key}
                  checked={planType === key}
                  onChange={() => setPlanType(key)}
                  className="accent-blue-600"
                />
                <div>
                  <p className="font-medium text-gray-900 text-sm">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
              <span className="text-sm font-semibold text-gray-800 shrink-0 ml-4">{price}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Login prompt */}
      {!user && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
          Debes{' '}
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/checkout?planeacion_id=${planeacionId}&plan_type=${planType}`)}`}
            className="font-semibold underline"
          >
            iniciar sesión
          </Link>{' '}
          para continuar con el pago.
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Procesando...' : user ? 'Pagar con MercadoPago' : 'Iniciar sesión para pagar'}
      </button>

      <p className="text-center text-xs text-gray-400 mt-3">
        Pago seguro procesado por MercadoPago · Modo Sandbox habilitado
      </p>

      <div className="mt-6 text-center">
        <Link href="/catalog" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
          ← Volver al catálogo
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-lg mx-auto px-4 py-20 text-center text-gray-400 text-sm">
          Cargando...
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
