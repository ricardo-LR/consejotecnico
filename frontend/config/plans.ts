/**
 * Configuración única de planes
 * SIEMPRE usar estas constantes, nunca hardcodear precios
 */

export interface SubOption {
  id: string;
  name: string;
  description: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  period: string;
  description: string;
  features: string[];
  buttonText: string;
  href: string;
  badge?: string;
  suboptions?: SubOption[];
}

export const PLANS: Record<string, Plan> = {
  GRATUITO: {
    id: 'gratuito',
    name: 'Gratuito',
    price: 0,
    currency: 'MXN',
    period: 'año',
    description: 'Crea tu cuenta gratis. Paga por cada documento que quieras descargar',
    features: [
      'Acceso al catálogo completo',
      'Compra documentos individuales ($0–$150)',
      'Paga solo lo que necesitas',
    ],
    buttonText: 'Crear cuenta gratis',
    href: '/auth/register',
  },

  GRADO: {
    id: 'grado',
    name: 'Por Grado',
    price: 499,
    currency: 'MXN',
    period: 'año',
    description: 'Acceso a TODO el contenido del grado que elijas',
    features: [
      'Todos los documentos de tu grado',
      'Sin límite de descargas',
      'Por 365 días',
    ],
    buttonText: 'Suscribirse',
    href: '/catalog?plan=grado',
  },

  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 999,
    currency: 'MXN',
    period: 'año',
    description: 'Acceso a TODO el contenido de TODOS los grados',
    badge: 'Más popular',
    features: [
      'Todos los documentos',
      'Todos los grados',
      'Sin límite de descargas',
      'Por 365 días',
    ],
    buttonText: 'Suscribirse',
    href: '/catalog?plan=pro',
    suboptions: [
      {
        id: 'pro-maestros',
        name: 'Para Maestros',
        description: 'Acceso completo para docentes',
      },
      {
        id: 'pro-directivos',
        name: 'Para Directivos',
        description: 'Acceso completo para directivos',
      },
    ],
  },
};

export type PlanId = 'gratuito' | 'grado' | 'pro';

export function getPlan(id: PlanId): Plan {
  const key = id.toUpperCase();
  return PLANS[key];
}
