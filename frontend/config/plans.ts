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
  requiereGrado?: boolean;
  suboptions?: SubOption[];
}

export const GRADOS = [
  { id: 'preescolar',  label: 'Preescolar'  },
  { id: '1_primaria',  label: '1° Primaria' },
  { id: '2_primaria',  label: '2° Primaria' },
  { id: '3_primaria',  label: '3° Primaria' },
  { id: '4_primaria',  label: '4° Primaria' },
  { id: '5_primaria',  label: '5° Primaria' },
  { id: '6_primaria',  label: '6° Primaria' },
];

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
    requiereGrado: true,
    features: [
      'Todos los documentos de tu grado',
      'Sin límite de descargas',
      'Por 365 días',
    ],
    buttonText: 'Suscribirse',
    href: '/checkout?plan=grado',
  },

  PRO_MAESTRO: {
    id: 'pro_maestro',
    name: 'Pro Maestro',
    price: 999,
    currency: 'MXN',
    period: 'año',
    description: 'Acceso a TODO el contenido de TODOS los grados',
    badge: 'Más popular',
    features: [
      'Todos los documentos, todos los grados',
      'Sin límite de descargas',
      'Diario de clase',
      'Por 365 días',
    ],
    buttonText: 'Suscribirse',
    href: '/checkout?plan=pro_maestro',
  },

  PRO_DIRECTIVO: {
    id: 'pro_directivo',
    name: 'Pro Directivo',
    price: 999,
    currency: 'MXN',
    period: 'año',
    description: 'Acceso completo incluyendo recursos CTE para directivos',
    features: [
      'Todo lo de Pro Maestro',
      'Recursos CTE completos',
      'Documentos administrativos',
      'Por 365 días',
    ],
    buttonText: 'Suscribirse',
    href: '/checkout?plan=pro_directivo',
  },

  // Alias de compatibilidad hacia atrás
  PRO: {
    id: 'pro',
    name: 'Pro Maestro',
    price: 999,
    currency: 'MXN',
    period: 'año',
    description: 'Acceso a TODO el contenido de TODOS los grados',
    features: ['Todos los documentos, todos los grados', 'Sin límite de descargas'],
    buttonText: 'Suscribirse',
    href: '/checkout?plan=pro_maestro',
  },
};

export type PlanId = 'gratuito' | 'grado' | 'pro_maestro' | 'pro_directivo' | 'pro';

export function getPlan(id: string): Plan {
  const key = id.toUpperCase().replace('-', '_');
  return PLANS[key] ?? PLANS.GRATUITO;
}

/** Planes que tienen acceso a recursos/planeaciones (cualquier grado) */
export const planTieneAccesoRecursos = (planType: string): boolean =>
  ['grado', 'pro_maestro', 'pro_directivo', 'pro'].includes(planType);

/** Solo Pro Directivo tiene acceso a CTE */
export const planTieneAccesoCTE = (planType: string): boolean =>
  planType === 'pro_directivo';
