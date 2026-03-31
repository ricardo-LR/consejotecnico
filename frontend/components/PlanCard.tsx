'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPlan, type PlanId } from '@/config/plans';
import { isLoggedIn } from '@/lib/auth';

interface PlanCardProps {
  planId: PlanId;
  featured?: boolean;
}

export default function PlanCard({ planId, featured = false }: PlanCardProps) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const plan = getPlan(planId);

  useEffect(() => {
    setMounted(true);
    setLoggedIn(isLoggedIn());
  }, []);

  if (!mounted) return null;

  function handlePlanClick() {
    if (plan.id === 'gratuito') {
      router.push(loggedIn ? '/catalog' : '/auth/register');
      return;
    }
    if (loggedIn) {
      router.push(`/checkout?plan=${plan.id}`);
    } else {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/checkout?plan=${plan.id}`)}`);
    }
  }

  const priceDisplay =
    plan.precio === 0 ? 'Gratis' : `$${plan.precio.toLocaleString('es-MX')}`;
  const periodDisplay = plan.precio === 0 ? '' : ` / ${plan.periodo}`;

  return (
    <div
      className={`rounded-lg shadow-lg p-8 transition relative ${
        featured
          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white scale-105'
          : 'bg-white text-gray-900 hover:shadow-xl'
      }`}
    >
      {featured && plan.popular && (
        <div className="absolute top-0 right-0 -translate-y-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full font-bold text-sm">
          Más popular
        </div>
      )}

      <h3 className="text-2xl font-bold mb-2">{plan.nombre}</h3>
      <p className={`text-sm mb-4 ${featured ? 'text-blue-100' : 'text-gray-600'}`}>
        {plan.descripcion}
      </p>

      <div className="mb-6">
        <span className={`text-4xl font-bold ${featured ? 'text-white' : 'text-gray-900'}`}>
          {priceDisplay}
        </span>
        <span className={featured ? 'text-blue-100' : 'text-gray-600'}>
          {periodDisplay}
        </span>
      </div>

      <ul className="mb-8 space-y-2">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <span>✓</span>
            <span className={featured ? 'text-blue-50' : 'text-gray-700'}>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={handlePlanClick}
        className={`w-full text-center py-3 px-6 rounded-lg font-semibold transition ${
          featured
            ? 'bg-white text-blue-600 hover:bg-blue-50'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {plan.id === 'gratuito' && loggedIn ? 'Ver catálogo' : plan.cta}
      </button>

    </div>
  );
}
