'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn, getUser, getAuthToken } from '@/lib/auth';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';
const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_KEY ?? 'TEST-c9279164-9470-4b2c-bd4c-d1ec1f3198cd';

const PLANES: Record<string, { nombre: string; precio: number }> = {
  grado: { nombre: 'Plan Por Grado - ConsejotecnicoCMS', precio: 499 },
  pro:   { nombre: 'Plan Pro - ConsejotecnicoCMS',       precio: 999 },
};

declare global {
  interface Window { MercadoPago: any }
}

function CheckoutContent() {
  const params  = useSearchParams();
  const planId  = params.get('plan') || 'grado';
  const plan    = PLANES[planId] ?? PLANES.grado;

  const [status, setStatus]   = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [mpReady, setMpReady] = useState(false);
  const userRef               = useRef<{ email: string; nombre?: string } | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.href = `/auth/login?redirect=/checkout?plan=${planId}`;
      return;
    }
    userRef.current = getUser() as { email: string; nombre?: string } | null;

    const script  = document.createElement('script');
    script.src    = 'https://sdk.mercadopago.com/js/v2';
    script.onload = initMP;
    document.body.appendChild(script);

    return () => {
      try { document.body.removeChild(script); } catch {}
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initMP() {
    const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: 'es-MX' });

    const cardForm = mp.cardForm({
      amount: String(plan.precio),
      iframe: true,
      form: {
        id:                   'form-checkout',
        cardNumber:           { id: 'form-checkout__cardNumber',           placeholder: 'Número de tarjeta' },
        expirationDate:       { id: 'form-checkout__expirationDate',       placeholder: 'MM/YY' },
        securityCode:         { id: 'form-checkout__securityCode',         placeholder: 'CVV' },
        cardholderName:       { id: 'form-checkout__cardholderName',       placeholder: 'Titular (ej: APRO)' },
        issuer:               { id: 'form-checkout__issuer',               placeholder: 'Banco emisor' },
        installments:         { id: 'form-checkout__installments',         placeholder: 'Cuotas' },
        identificationType:   { id: 'form-checkout__identificationType' },
        identificationNumber: { id: 'form-checkout__identificationNumber', placeholder: 'RFC / CURP' },
        cardholderEmail:      { id: 'form-checkout__cardholderEmail',      placeholder: 'Email del titular' },
      },
      callbacks: {
        onFormMounted: (err: any) => {
          if (err) { console.error('[MP] Form mount error:', err); return; }
          setMpReady(true);
        },

        onSubmit: async (event: any) => {
          event.preventDefault();
          setStatus('loading');
          setMessage('');

          try {
            const {
              token,
              paymentMethodId:      payment_method_id,
              issuerId:             issuer_id,
              installments,
              cardholderEmail,
              identificationNumber,
              identificationType,
            } = cardForm.getCardFormData();

            // email del usuario logueado → para DynamoDB (quién compra el plan)
            const accountEmail = userRef.current?.email || '';
            // cardholderEmail → para Mercado Pago (dueño de la tarjeta)
            // MP rechaza emails de cuentas reales de MP en sandbox;
            // el usuario debe ingresar cualquier email no-MP.

            const body = {
              token,
              payment_method_id,
              issuer_id,
              transaction_amount:  plan.precio,
              installments:        Number(installments),
              description:         plan.nombre,
              plan_type:           planId,
              email:               accountEmail,
              payer: {
                email:          cardholderEmail,
                identification: {
                  type:   identificationType   || 'RFC',
                  number: identificationNumber || 'XAXX010101000',
                },
              },
            };

            console.log('[CHECKOUT] Enviando:', JSON.stringify(body));

            const res  = await fetch(`${API}/purchase`, {
              method:  'POST',
              headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${getAuthToken()}`,
              },
              body: JSON.stringify(body),
            });

            const data = await res.json();
            console.log('[CHECKOUT] Respuesta:', data);

            if (data.status === 'approved') {
              setStatus('success');
              setTimeout(() => { window.location.href = '/checkout/success'; }, 1500);
            } else if (data.status === 'in_process' || data.status === 'pending') {
              window.location.href = '/checkout/pending';
            } else {
              setStatus('error');
              setMessage(data.message || data.error || `Pago rechazado: ${data.status_detail}`);
            }
          } catch (err: any) {
            setStatus('error');
            setMessage(err.message || 'Error de conexión');
          }
        },

        onError: (errs: any) => {
          console.error('[MP] Validation errors:', errs);
        },
      },
    });
  }

  // ── Aprobado ─────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center p-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-green-700">¡Pago aprobado!</h1>
          <p className="text-gray-500 mt-2">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  // ── Formulario ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">

        {/* Header */}
        <div className="mb-2">
          <Link href="/maestro/dashboard" className="text-blue-500 text-sm hover:underline">
            ← Volver al Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">Completar pago</h1>
        </div>

        {/* Resumen del plan */}
        <div className="bg-blue-50 rounded-lg p-4 mb-5">
          <p className="font-semibold text-blue-800">{plan.nombre}</p>
          <p className="text-3xl font-bold text-blue-900">
            ${plan.precio}{' '}
            <span className="text-sm font-normal text-blue-700">MXN / año</span>
          </p>
        </div>

        {/* Mensaje de error */}
        {message && (
          <div className={`rounded-lg p-3 mb-4 text-sm border ${
            status === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            {message}
          </div>
        )}

        {/* Formulario MP */}
        <form id="form-checkout" className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Número de tarjeta
            </label>
            <div id="form-checkout__cardNumber"
              className="border border-gray-300 rounded-lg p-3 h-12 bg-white" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento</label>
              <div id="form-checkout__expirationDate"
                className="border border-gray-300 rounded-lg p-3 h-12 bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
              <div id="form-checkout__securityCode"
                className="border border-gray-300 rounded-lg p-3 h-12 bg-white" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del titular
            </label>
            <input
              type="text"
              id="form-checkout__cardholderName"
              placeholder="Como aparece en la tarjeta (ej: APRO)"
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Banco emisor</label>
            <select id="form-checkout__issuer"
              className="w-full border border-gray-300 rounded-lg p-3 text-gray-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cuotas</label>
            <select id="form-checkout__installments"
              className="w-full border border-gray-300 rounded-lg p-3" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo ID</label>
              <select id="form-checkout__identificationType"
                className="w-full border border-gray-300 rounded-lg p-3" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número ID</label>
              <input
                type="text"
                id="form-checkout__identificationNumber"
                placeholder="RFC / CURP"
                className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email del titular de la tarjeta
            </label>
            <input
              type="email"
              id="form-checkout__cardholderEmail"
              placeholder="correo@ejemplo.com"
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <button
            type="submit"
            id="form-checkout__submit"
            disabled={!mpReady || status === 'loading'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                       text-white font-bold py-4 rounded-xl transition-colors text-lg"
          >
            {status === 'loading'
              ? '⏳ Procesando...'
              : !mpReady
              ? '⏳ Cargando formulario...'
              : `💳 Pagar $${plan.precio} MXN`}
          </button>
        </form>

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
