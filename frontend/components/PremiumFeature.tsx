'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isLoggedIn, getPlanType } from '@/lib/auth';

interface PremiumFeatureProps {
  children: React.ReactNode;
  feature: string;
  requiredPlan?: 'grado' | 'pro';
}

export default function PremiumFeature({
  children,
  feature,
  requiredPlan = 'grado',
}: PremiumFeatureProps) {
  const [checked, setChecked]         = useState(false);
  const [loggedIn, setLoggedIn]       = useState(false);
  const [planType, setPlanType]       = useState('');

  useEffect(() => {
    console.log('[PREMIUM] ════════════════════════════════════════');
    console.log('[PREMIUM] Feature:', feature, '| Required:', requiredPlan);

    const token    = localStorage.getItem('token');
    const logged   = isLoggedIn();
    const plan     = getPlanType() || '';

    console.log('[PREMIUM] localStorage.token:', token  ? `✅ ${token.substring(0, 20)}...` : '❌ NULL');
    console.log('[PREMIUM] isLoggedIn():', logged        ? '✅ TRUE' : '❌ FALSE');
    console.log('[PREMIUM] getPlanType():', plan         || '(vacío → gratuito)');
    console.log('[PREMIUM] ════════════════════════════════════════');

    setLoggedIn(logged);
    setPlanType(plan);
    setChecked(true);
  }, []); // sin dependencias — solo se ejecuta una vez al montar

  // Esperar hidratación del cliente antes de renderizar
  if (!checked) return null;

  // ── No está logueado ────────────────────────────────────────────────────
  if (!loggedIn) {
    console.log('[PREMIUM] ❌ NO LOGUEADO');
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-yellow-500 text-xl shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-yellow-800 text-sm mb-1">
              Inicia sesión para acceder a {feature}
            </p>
            <p className="text-yellow-700 text-xs mb-3">
              O compra un plan para desbloquear esta función.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/auth/login?redirect=/checkout?plan=${requiredPlan}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700"
              >
                Iniciar Sesión
              </Link>
              <Link
                href={`/checkout?plan=${requiredPlan}`}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-semibold text-sm hover:bg-blue-50"
              >
                Ver Planes
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Logueado pero plan insuficiente ──────────────────────────────────────
  const hasAccess =
    planType === 'pro' ||
    (requiredPlan === 'grado' && (planType === 'grado' || planType === 'pro'));

  if (!hasAccess) {
    console.log('[PREMIUM] 🔒 PLAN INSUFICIENTE — actual:', planType || 'gratuito', '| requerido:', requiredPlan);
    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-blue-500 text-xl shrink-0">🔒</span>
          <div>
            <p className="font-semibold text-blue-900 text-sm mb-1">
              {feature} — Plan {requiredPlan === 'grado' ? 'Grado ($499/año)' : 'Pro ($999/año)'}
            </p>
            <p className="text-blue-700 text-sm mb-3">
              Tu plan actual es <strong>{planType || 'gratuito'}</strong>.
              Actualiza para desbloquear esta función.
            </p>
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/checkout?plan=${requiredPlan}`}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700"
              >
                💳 Comprar Plan
              </Link>
              <Link
                href="/pricing"
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-semibold text-sm hover:bg-blue-50"
              >
                Ver Planes
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  console.log('[PREMIUM] ✅ ACCESO PERMITIDO — plan:', planType);
  return <>{children}</>;
}
