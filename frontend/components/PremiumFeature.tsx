'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isLoggedIn, getUser, getPlanType } from '@/lib/auth';

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
  const [mounted, setMounted]         = useState(false);
  const [loggedIn, setLoggedIn]       = useState(false);
  const [currentPlan, setCurrentPlan] = useState('gratuito');

  useEffect(() => {
    console.log('[PREMIUM] ════════════════════════════════════════');
    console.log('[PREMIUM] Feature:', feature);
    console.log('[PREMIUM] Required Plan:', requiredPlan);

    const token    = localStorage.getItem('token');
    const logged   = isLoggedIn();
    const userData = getUser();
    const planType = getPlanType();

    console.log('[PREMIUM] localStorage.token:', token    ? '✅ SI' : '❌ NO');
    console.log('[PREMIUM] isLoggedIn():', logged          ? '✅ TRUE' : '❌ FALSE');
    console.log('[PREMIUM] Usuario:', userData?.email      ?? 'null');
    console.log('[PREMIUM] Plan Actual:', planType         ?? 'gratuito');
    console.log('[PREMIUM] ════════════════════════════════════════');

    setMounted(true);
    setLoggedIn(logged);
    setCurrentPlan(planType ?? 'gratuito');
  }, [feature, requiredPlan]);

  if (!mounted) return null;

  // No está logueado
  if (!loggedIn) {
    console.log('[PREMIUM] ❌ NO LOGUEADO - mostrar login');
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-yellow-500 text-xl shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-yellow-800 text-sm mb-3">
              Debes iniciar sesión para acceder a {feature}
            </p>
            <div className="flex gap-2">
              <Link
                href="/auth/login"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700"
              >
                Iniciar Sesión
              </Link>
              <Link
                href="/auth/register"
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg font-semibold text-sm hover:bg-blue-50"
              >
                Registrarse
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Verifica si el plan tiene acceso
  const hasAccess =
    currentPlan === 'pro' ||
    (requiredPlan === 'grado' && (currentPlan === 'grado' || currentPlan === 'pro'));

  if (!hasAccess) {
    console.log('[PREMIUM] 🔒 PLAN INSUFICIENTE - mostrar upgrade. Actual:', currentPlan, 'Requerido:', requiredPlan);
    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <span className="text-blue-500 text-xl shrink-0">🔒</span>
          <div>
            <p className="font-semibold text-blue-900 text-sm mb-1">
              {feature} requiere Plan {requiredPlan === 'grado' ? 'Grado' : 'Pro'}
            </p>
            <p className="text-blue-700 text-sm mb-3">
              Tu plan actual es <strong>{currentPlan}</strong>.
              Necesitas el plan <strong>{requiredPlan}</strong> para acceder.
            </p>
            <div className="flex gap-2">
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

  console.log('[PREMIUM] ✅ ACCESO PERMITIDO - plan:', currentPlan);
  return <>{children}</>;
}
