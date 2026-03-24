'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn, getUser, getAuthToken } from '@/lib/auth';

const GRADOS = [
  { id: 'preescolar', label: 'Preescolar' },
  { id: '1',         label: '1° Primaria' },
  { id: '2',         label: '2° Primaria' },
  { id: '3',         label: '3° Primaria' },
  { id: '4',         label: '4° Primaria' },
  { id: '5',         label: '5° Primaria' },
  { id: '6',         label: '6° Primaria' },
];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

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

  const subscriptionPlan = searchParams.get('plan') ?? '';
  const planeacionId     = searchParams.get('planeacion_id') ?? '';

  const defaultPlan: PlanKey = (searchParams.get('plan_type') as PlanKey) ?? 'individual';
  const [planType, setPlanType]       = useState<PlanKey>(defaultPlan);
  const [selectedGrado, setSelectedGrado] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [mounted, setMounted]         = useState(false);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [userEmail, setUserEmail]     = useState('');

  useEffect(() => {
    setMounted(true);
    const loggedIn = isLoggedIn();
    setUserLoggedIn(loggedIn);

    if (loggedIn) {
      const u = getUser();
      setUserEmail(u?.email ?? '');
    } else {
      // Redirect to login, preserving the intended destination
      const dest = subscriptionPlan
        ? `/checkout?plan=${subscriptionPlan}`
        : planeacionId
        ? `/checkout?planeacion_id=${planeacionId}&plan_type=${defaultPlan}`
        : '/checkout';
      router.push(`/auth/login?redirect=${encodeURIComponent(dest)}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center text-gray-400 text-sm">
        Cargando...
      </div>
    );
  }

  // ── Subscription mode ────────────────────────────────────────────────────
  if (subscriptionPlan && SUBSCRIPTION_INFO[subscriptionPlan]) {
    const info = SUBSCRIPTION_INFO[subscriptionPlan];
    const isGradoPlan = subscriptionPlan === 'grado';
    const canPay = userLoggedIn && (!isGradoPlan || !!selectedGrado);

    async function handleSubscription() {
      if (!userLoggedIn) {
        router.push(`/auth/login?redirect=${encodeURIComponent(`/checkout?plan=${subscriptionPlan}`)}`);
        return;
      }
      if (isGradoPlan && !selectedGrado) {
        setError('Por favor selecciona tu grado antes de continuar.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const token = getAuthToken();
        const body: Record<string, string> = {
          email:         userEmail,
          planeacion_id: 'subscription',
          plan_type:     subscriptionPlan,
        };
        if (isGradoPlan && selectedGrado) body.grado = selectedGrado;

        const res = await fetch(`${API_URL}/purchase`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
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
        {/* Session badge */}
        {userLoggedIn && (
          <div className="flex items-center gap-2 mb-6 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Sesión activa · {userEmail}
          </div>
        )}

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

        {/* Grade selector — only for Plan Grado */}
        {isGradoPlan && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Selecciona tu grado
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {GRADOS.map(({ id, label }) => (
                <label
                  key={id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedGrado === id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="grado"
                    value={id}
                    checked={selectedGrado === id}
                    onChange={() => setSelectedGrado(id)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-900">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        <button
          onClick={handleSubscription}
          disabled={loading || !canPay}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? 'Procesando...'
            : !userLoggedIn
            ? 'Iniciando sesión...'
            : isGradoPlan && !selectedGrado
            ? 'Selecciona tu grado para continuar'
            : 'Suscribirse con MercadoPago'}
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

  // ── Document mode ────────────────────────────────────────────────────────
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
    if (!userLoggedIn) {
      router.push(
        `/auth/login?redirect=${encodeURIComponent(`/checkout?planeacion_id=${planeacionId}&plan_type=${planType}`)}`
      );
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_URL}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email:              userEmail,
          planeacion_id:      planeacionId,
          plan_type:          planType,
          completeness_score: 0.8,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el pago');

      if (data.download_ready) {
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
      {/* Session badge */}
      {userLoggedIn && (
        <div className="flex items-center gap-2 mb-6 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Sesión activa · {userEmail}
        </div>
      )}

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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={loading || !userLoggedIn}
        className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Procesando...' : !userLoggedIn ? 'Iniciando sesión...' : 'Pagar con MercadoPago'}
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
