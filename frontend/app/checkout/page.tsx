'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn, getUser, getAuthToken } from '@/lib/auth';
import { PLANS } from '@/config/plans';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const planId = searchParams.get('plan') || 'grado';

  const [loggedIn, setLoggedIn]               = useState(false);
  const [user, setUser]                       = useState<{ email: string; nombre?: string; plan_type?: string } | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');
  const [selectedPlan, setSelectedPlan]       = useState('');
  const [selectedSuboption, setSelectedSuboption] = useState('');
  const [processing, setProcessing]           = useState(false);

  useEffect(() => {
    console.log('[CHECKOUT] ════════════════════════════════════════');
    console.log('[CHECKOUT] Iniciando checkout...');
    console.log('[CHECKOUT] ════════════════════════════════════════');
    console.log('[CHECKOUT] Plan seleccionado:', planId);

    // VERIFICACIÓN CRÍTICA: Revisar sesión
    const token    = localStorage.getItem('token');
    const userStr  = localStorage.getItem('user');
    const planType = localStorage.getItem('plan_type');

    console.log('[CHECKOUT] localStorage.token:', token   ? '✅ SI' : '❌ NO');
    console.log('[CHECKOUT] localStorage.user:', userStr  ? '✅ SI' : '❌ NO');
    console.log('[CHECKOUT] localStorage.plan_type:', planType ? `✅ ${planType}` : '❌ NO');

    const logged = isLoggedIn();
    console.log('[CHECKOUT] isLoggedIn():', logged ? '✅ SI' : '❌ NO');

    if (!logged) {
      console.log('[CHECKOUT] ❌ No hay sesión - Redirigiendo a login');
      setError('Debes iniciar sesión para comprar');
      setLoading(false);
      setTimeout(() => {
        router.push(`/auth/login?redirect=/checkout?plan=${planId}`);
      }, 2000);
      return;
    }

    const userData = getUser();
    console.log('[CHECKOUT] ✅ Usuario encontrado:', userData?.email);
    console.log('[CHECKOUT] Usuario data completo:', userData);

    setLoggedIn(true);
    setUser(userData as { email: string; nombre?: string; plan_type?: string });
    setSelectedPlan(planId);
    setLoading(false);
  }, [planId, router]);

  const handleProceedToPayment = async () => {
    try {
      console.log('[CHECKOUT] ════════════════════════════════════════');
      console.log('[CHECKOUT] 💳 Iniciando pago...');
      console.log('[CHECKOUT] ════════════════════════════════════════');

      setProcessing(true);

      const email    = user?.email ?? '';
      const planType = localStorage.getItem('plan_type') || 'gratuito';
      const token    = getAuthToken();
      const plan     = PLANS[selectedPlan.toUpperCase() as keyof typeof PLANS];

      console.log('[CHECKOUT] 📊 Datos para Mercado Pago:');
      console.log('[CHECKOUT]   - Email:', email);
      console.log('[CHECKOUT]   - Plan Type (actual):', planType);
      console.log('[CHECKOUT]   - Plan ID:', selectedPlan);
      console.log('[CHECKOUT]   - Plan Name:', plan.name);
      console.log('[CHECKOUT]   - Plan Price:', plan.price);
      console.log('[CHECKOUT]   - Period:', plan.period);
      console.log('[CHECKOUT]   - Suboption:', selectedSuboption || 'N/A');
      console.log('[CHECKOUT]   - Token:', token?.substring(0, 30) + '...');

      if (!email) throw new Error('Email del usuario no encontrado');

      const body: Record<string, string> = {
        email,
        planeacion_id: 'subscription',
        plan_type:     selectedPlan,
      };
      if (selectedSuboption) body.suboption = selectedSuboption;

      console.log('[CHECKOUT] 📦 Body a enviar:', body);
      console.log('[CHECKOUT] 📤 Enviando a backend:', `${API_URL}/purchase`);

      const response = await fetch(`${API_URL}/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      console.log('[CHECKOUT] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[CHECKOUT] ❌ Error:', errorData);
        throw new Error(errorData.error || 'Error creando preferencia');
      }

      const data = await response.json();
      console.log('[CHECKOUT] ✅ Preferencia creada:', data);

      // Backend siempre elige la URL correcta (sandbox o prod) en init_point
      const mpUrl = data.init_point || data.checkout_url;
      console.log('[CHECKOUT] is_sandbox:', data.is_sandbox);
      if (mpUrl) {
        console.log('[CHECKOUT] 🔗 Redirigiendo a Mercado Pago:', mpUrl);
        window.location.href = mpUrl;
      } else {
        throw new Error('No se recibió URL de pago de MercadoPago');
      }
    } catch (err) {
      console.error('[CHECKOUT] ❌ Error:', err);
      setError(`Error al procesar el pago: ${err instanceof Error ? err.message : 'desconocido'}`);
      setProcessing(false);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!loggedIn || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-bold text-lg mb-4">⚠️ No autenticado</p>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500 mb-6">Redirigiendo a login en 2 segundos...</p>
          <Link
            href={`/auth/login?redirect=/checkout?plan=${planId}`}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Ir a Login Ahora
          </Link>
        </div>
      </div>
    );
  }

  const plan = PLANS[selectedPlan.toUpperCase() as keyof typeof PLANS] ?? PLANS['GRADO'];
  const priceDisplay = plan.price === 0 ? 'Gratis' : `$${plan.price.toLocaleString('es-MX')}`;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/maestro/dashboard" className="text-blue-600 hover:text-blue-700 mb-6 inline-block text-sm">
            ← Volver al Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Checkout</h1>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-8 text-sm">
            {error}
          </div>
        )}

        {/* User Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Usuario Autenticado</h3>
              <p className="text-gray-600 mt-1 text-sm">Email: {user.email}</p>
              <p className="text-gray-600 text-sm">Nombre: {user.nombre || 'Sin nombre'}</p>
            </div>
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold shrink-0">
              ✅ Sesión activa
            </span>
          </div>
        </div>

        {/* Plan Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Resumen del Plan</h2>

          <div className="border-b border-gray-200 pb-4 mb-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <p className="text-gray-600 mt-1 text-sm">{plan.description}</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-3xl font-bold text-gray-900">{priceDisplay}</p>
                <p className="text-gray-600 text-sm">/ {plan.period}</p>
              </div>
            </div>

            <ul className="space-y-2">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-600 shrink-0">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Suboptions for Pro */}
          {plan.suboptions && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-3 text-sm">Elige tu versión:</h4>
              <div className="space-y-2">
                {plan.suboptions.map((option) => (
                  <label
                    key={option.id}
                    className={`flex items-start p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedSuboption === option.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="suboption"
                      value={option.id}
                      checked={selectedSuboption === option.id}
                      onChange={(e) => setSelectedSuboption(e.target.value)}
                      className="mt-0.5 mr-3 accent-blue-600"
                    />
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{option.name}</p>
                      <p className="text-xs text-gray-600">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Total */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-gray-700">Subtotal</span>
              <span className="font-semibold text-gray-900">{priceDisplay}</span>
            </div>
            <div className="flex justify-between items-center border-t border-gray-200 pt-2">
              <span className="font-bold text-gray-900 text-sm">Total ({plan.period})</span>
              <span className="text-2xl font-bold text-gray-900">{priceDisplay}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Método de Pago</h2>
          <div className="flex items-center p-4 border border-blue-300 bg-blue-50 rounded-lg">
            <div className="w-12 h-8 bg-blue-600 rounded mr-4 flex items-center justify-center text-white text-sm font-bold shrink-0">
              MP
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Mercado Pago</p>
              <p className="text-xs text-gray-600">Tarjeta de crédito, débito o transferencia · Sandbox habilitado</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link
            href="/maestro/dashboard"
            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 text-center text-sm"
          >
            Cancelar
          </Link>
          <button
            onClick={handleProceedToPayment}
            disabled={processing || (!!plan.suboptions && !selectedSuboption)}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {processing
              ? '⏳ Procesando...'
              : plan.suboptions && !selectedSuboption
              ? 'Elige tu versión primero'
              : '💳 Proceder al Pago'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          Al continuar, aceptas nuestros términos de servicio y política de privacidad.
        </p>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
