'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

const PLAN_OPTIONS = [
  {
    key: 'individual',
    label: 'Comprar documento individual',
    price: '$0–$150 MXN',
    desc: 'Solo este documento',
  },
  {
    key: 'grado',
    label: 'Plan Grado',
    price: '$499/año',
    desc: 'Todos los documentos de tu grado por 365 días',
  },
  {
    key: 'pro',
    label: 'Plan Pro',
    price: '$999/año',
    desc: 'Todos los documentos de todos los grados por 365 días',
  },
] as const;

type PlanKey = typeof PLAN_OPTIONS[number]['key'];

const SUBSCRIPTION_INFO: Record<string, { name: string; price: string; features: string[] }> = {
  grado: {
    name: 'Plan Grado',
    price: '$499 MXN/año',
    features: [
      'Todos los documentos de tu grado',
      'Sin límite de descargas',
      'Acceso por 365 días',
    ],
  },
  pro: {
    name: 'Plan Pro',
    price: '$999 MXN/año',
    features: [
      'Todos los documentos de todos los grados',
      'Sin límite de descargas',
      'Acceso por 365 días',
    ],
  },
};

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  // Two modes:
  // 1. Subscription: ?plan=grado|pro  (from landing page)
  // 2. Document:     ?planeacion_id=xxx  (from catalog card)
  const subscriptionPlan = searchParams.get('plan') ?? '';          // grado | pro
  const planeacionId      = searchParams.get('planeacion_id') ?? '';

  const defaultPlan: PlanKey = (searchParams.get('plan_type') as PlanKey) ?? 'individual';
  const [planType, setPlanType] = useState<PlanKey>(defaultPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  // ── Subscription mode (no specific document) ────────────────────────────
  if (subscriptionPlan && SUBSCRIPTION_INFO[subscriptionPlan]) {
    const info = SUBSCRIPTION_INFO[subscriptionPlan];

    async function handleSubscription() {
      if (!user) {
        router.push(
          `/auth/register?next=${encodeURIComponent(`/checkout?plan=${subscriptionPlan}`)}`
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
            email:         user.email,
            planeacion_id: 'subscription',
            plan_type:     subscriptionPlan,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al procesar el pago');
        window.location.href = data.checkout_url;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al procesar el pago');
        setLoading(false);
      }
    }

    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{info.name}</h1>
        <p className="text-3xl font-bold text-blue-600 mb-6">{info.price}</p>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <ul className="space-y-3">
            {info.features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-gray-700 text-sm">
                <svg className="w-5 h-5 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {!user && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
            Debes{' '}
            <Link
              href={`/auth/register?next=${encodeURIComponent(`/checkout?plan=${subscriptionPlan}`)}`}
              className="font-semibold underline"
            >
              crear una cuenta
            </Link>{' '}
            para continuar.
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <button
          onClick={handleSubscription}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Procesando...' : user ? 'Suscribirse con MercadoPago' : 'Crear cuenta para suscribirse'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-3">
          Pago seguro procesado por MercadoPago · Modo Sandbox habilitado
        </p>
        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
            ← Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // ── Document mode (specific planeacion) ─────────────────────────────────
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
        `/auth/register?next=${encodeURIComponent(`/checkout?planeacion_id=${planeacionId}&plan_type=${planType}`)}`
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
          email:            user.email,
          planeacion_id:    planeacionId,
          plan_type:        planType,
          completeness_score: 0.8,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el pago');

      if (data.download_ready) {
        // Free document — go straight to catalog/dashboard
        router.push(`/dashboard?downloaded=${planeacionId}`);
        return;
      }
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
          {PLAN_OPTIONS.map(({ key, label, price, desc }) => (
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

      {!user && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
          Debes{' '}
          <Link
            href={`/auth/register?next=${encodeURIComponent(`/checkout?planeacion_id=${planeacionId}&plan_type=${planType}`)}`}
            className="font-semibold underline"
          >
            crear una cuenta
          </Link>{' '}
          para continuar con el pago.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Procesando...' : user ? 'Pagar con MercadoPago' : 'Crear cuenta para pagar'}
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
