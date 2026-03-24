'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPlan, type PlanId } from '@/config/plans';
import { isLoggedIn } from '@/lib/auth';

interface PlanCardProps {
  planId: PlanId;
  featured?: boolean;
}

export default function PlanCard({ planId, featured = false }: PlanCardProps) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [mounted, setMounted] = useState(false);
  const plan = getPlan(planId);

  useEffect(() => {
    setMounted(true);
    setLoggedIn(isLoggedIn());
  }, []);

  if (!mounted) return null;

  const priceDisplay =
    plan.price === 0 ? 'Gratis' : `$${plan.price.toLocaleString('es-MX')}`;
  const periodDisplay = plan.price === 0 ? '' : ` / ${plan.period}`;

  return (
    <div
      className={`rounded-lg shadow-lg p-8 transition relative ${
        featured
          ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white scale-105'
          : 'bg-white text-gray-900 hover:shadow-xl'
      }`}
    >
      {featured && plan.badge && (
        <div className="absolute top-0 right-0 -translate-y-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full font-bold text-sm">
          {plan.badge}
        </div>
      )}

      <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
      <p className={`text-sm mb-4 ${featured ? 'text-blue-100' : 'text-gray-600'}`}>
        {plan.description}
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

      <Link
        href={loggedIn && plan.id !== 'gratuito' ? plan.href : plan.href}
        className={`block text-center py-3 px-6 rounded-lg font-semibold transition ${
          featured
            ? 'bg-white text-blue-600 hover:bg-blue-50'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {plan.id === 'gratuito' && loggedIn ? 'Ver catálogo' : plan.buttonText}
      </Link>

      {'suboptions' in plan && plan.suboptions && (
        <div className={`mt-6 pt-6 border-t ${featured ? 'border-blue-400' : 'border-gray-200'}`}>
          <p className={`text-sm font-semibold mb-3 ${featured ? 'text-blue-100' : 'text-gray-600'}`}>
            Elige tu versión:
          </p>
          <div className="space-y-2">
            {plan.suboptions.map((option) => (
              <div
                key={option.id}
                className={`w-full py-2 px-3 rounded text-sm ${
                  featured ? 'bg-blue-500' : 'bg-gray-100'
                }`}
              >
                <strong>{option.name}</strong>
                <div className={`text-xs ${featured ? 'text-blue-100' : 'text-gray-600'}`}>
                  {option.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
