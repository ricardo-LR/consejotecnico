'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getUser, getAuthToken, isLoggedIn } from '@/lib/auth';
import { GRADOS } from '@/config/plans';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';
const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_KEY ?? 'TEST-c9279164-9470-4b2c-bd4c-d1ec1f3198cd';

const PLANES: Record<string, { nombre: string; precio: number }> = {
  grado:         { nombre: 'Plan Por Grado - ConsejotecnicoCMS',      precio: 499 },
  pro_maestro:   { nombre: 'Plan Pro Maestro - ConsejotecnicoCMS',    precio: 999 },
  pro_directivo: { nombre: 'Plan Pro Directivo - ConsejotecnicoCMS',  precio: 999 },
  pro:           { nombre: 'Plan Pro Maestro - ConsejotecnicoCMS',    precio: 999 },
};

declare global {
  interface Window { MercadoPago: any }
}

function CheckoutContent() {
  const params  = useSearchParams();
  const planId  = params.get('plan') || 'grado';
  const plan    = PLANES[planId] ?? PLANES.grado;
  const brickRef = useRef<any>(null);

  const [status, setStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage]   = useState('');
  const [gradoSeleccionado, setGradoSeleccionado] = useState('');
  const [paso, setPaso]         = useState<'seleccionar_grado' | 'pago'>(
    planId === 'grado' ? 'seleccionar_grado' : 'pago'
  );

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.href = `/auth/login?redirect=/checkout?plan=${planId}`;
      return;
    }
    if (paso === 'pago') {
      const u = getUser();
      loadMPScript(u);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  function loadMPScript(u: any) {
    if (document.querySelector('script[src*="mercadopago"]')) {
      initBrick(u);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.onload = () => initBrick(u);
    script.onerror = () => setMessage('Error cargando Mercado Pago SDK');
    document.body.appendChild(script);
  }

  async function initBrick(u: any) {
    try {
      setStatus('loading');

      const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'es-MX' });
      const bricksBuilder = mp.bricks();

      if (brickRef.current) {
        await brickRef.current.unmount().catch(() => {});
        brickRef.current = null;
      }

      brickRef.current = await bricksBuilder.create(
        'payment',
        'payment-brick-container',
        {
          initialization: {
            amount: plan.precio,
            payer: {
              firstName: u?.nombre || '',
              email: '',
            },
          },
          customization: {
            paymentMethods: {
              creditCard: 'all',
              debitCard: 'all',
              mercadoPago: 'all',
              ticket: 'all',
              bankTransfer: 'all',
              atm: 'all',
              maxInstallments: 1,
            },
            visual: {
              style: {
                theme: 'default',
                customVariables: {
                  formBackgroundColor: '#ffffff',
                  baseColor: '#2563eb',
                },
              },
            },
          },
          callbacks: {
            onReady: () => {
              console.log('[CHECKOUT] Payment Brick listo');
              setStatus('idle');
            },

            onSubmit: async ({ selectedPaymentMethod, formData }: any) => {
              console.log('[CHECKOUT] Método:', selectedPaymentMethod);
              console.log('[CHECKOUT] FormData:', JSON.stringify(formData));
              setStatus('loading');
              setMessage('');

              try {
                const authToken = getAuthToken();
                const currentUser = getUser();

                const body: any = {
                  plan_type:      planId,
                  grado:          gradoSeleccionado || undefined,
                  email:          currentUser?.email || '',
                  payment_method: selectedPaymentMethod,
                  ...formData,
                };

                // Para tarjeta: asegurar campos correctos
                if (formData.token) {
                  body.token               = formData.token;
                  body.transaction_amount  = plan.precio;
                  body.installments        = formData.installments || 1;
                  body.payment_method_id   = formData.payment_method_id;
                  body.issuer_id           = formData.issuer_id;
                  body.payer               = {
                    email:          formData.payer?.email || '',
                    identification: formData.payer?.identification || {
                      type: 'RFC', number: 'XAXX010101000',
                    },
                  };
                }

                console.log('[CHECKOUT] Enviando:', JSON.stringify(body));

                const res = await fetch(`${API}/purchase`, {
                  method: 'POST',
                  headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${authToken}`,
                  },
                  body: JSON.stringify(body),
                });

                const data = await res.json();
                console.log('[CHECKOUT] Respuesta:', data);

                if (data.status === 'approved') {
                  try {
                    const meRes = await fetch(`${API}/auth/me`, {
                      headers: { Authorization: `Bearer ${authToken}` },
                    });
                    if (meRes.ok) {
                      const meData = await meRes.json();
                      if (meData.plan_type) localStorage.setItem('plan_type', meData.plan_type);
                      if (meData.email)     localStorage.setItem('email', meData.email);
                    }
                  } catch { /* non-critical */ }

                  setStatus('success');
                  setTimeout(() => { window.location.href = '/checkout/success'; }, 1500);

                } else if (data.status === 'in_process' || data.status === 'pending') {
                  window.location.href = '/checkout/pending';

                } else {
                  setStatus('error');
                  setMessage(
                    data.message || data.error ||
                    `Pago no completado: ${data.status_detail || data.status}`
                  );
                }
              } catch (err: any) {
                setStatus('error');
                setMessage(err.message || 'Error de conexión');
              }
            },

            onError: (error: any) => {
              console.error('[CHECKOUT] Brick error:', error);
              if (error?.cause?.length) {
                const msgs = error.cause.map((c: any) => c.message).join(', ');
                setMessage(msgs);
              }
            },
          },
        }
      );
    } catch (err: any) {
      console.error('[CHECKOUT] Error iniciando brick:', err);
      setStatus('error');
      setMessage('Error iniciando formulario de pago');
    }
  }

  // ── Selector de grado (solo para plan=grado) ────────────────────────────
  if (paso === 'seleccionar_grado') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-xl mx-auto">
          <a href="/dashboard" className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block">
            ← Volver al Dashboard
          </a>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Plan Por Grado</h1>
          <p className="text-gray-500 mb-6 text-sm">Selecciona el grado del que eres maestro</p>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-3">¿De qué grado eres maestro?</p>
            <div className="grid grid-cols-2 gap-3">
              {GRADOS.map((grado) => (
                <button
                  key={grado.id}
                  onClick={() => setGradoSeleccionado(grado.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    gradoSeleccionado === grado.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-800'
                  }`}
                >
                  <span className="font-medium text-sm">{grado.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => { if (gradoSeleccionado) setPaso('pago'); }}
              disabled={!gradoSeleccionado}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
            >
              {gradoSeleccionado ? 'Continuar al pago →' : 'Selecciona un grado'}
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-center">
            <p className="text-sm text-gray-600">Plan Por Grado</p>
            <p className="text-xl font-bold text-blue-600">$499 <span className="text-sm font-normal text-gray-500">MXN/año</span></p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-sm">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-green-700 mb-2">¡Pago aprobado!</h1>
          <p className="text-gray-500">Tu plan está activo. Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">

        <div className="mb-6">
          <a href="/dashboard" className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block">
            ← Volver al Dashboard
          </a>
          <h1 className="text-2xl font-bold text-gray-800">Completar pago</h1>
        </div>

        {/* Plan summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-gray-800">{plan.nombre}</p>
              <p className="text-sm text-gray-500">Acceso por 365 días</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">
                ${plan.precio}
                <span className="text-sm font-normal text-gray-500"> MXN</span>
              </p>
              <p className="text-xs text-gray-400">por año</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {message && status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-700 text-sm">❌ {message}</p>
            <button
              onClick={() => { setMessage(''); setStatus('idle'); }}
              className="text-red-600 text-xs underline mt-1"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Brick loading skeleton */}
        {status === 'loading' && !message && (
          <div className="bg-white rounded-xl shadow-sm border p-8 mb-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Cargando opciones de pago...</p>
          </div>
        )}

        {/* Payment Brick container */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div id="payment-brick-container" />
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          🔒 Pago seguro procesado por Mercado Pago
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
