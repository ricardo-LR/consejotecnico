/**
 * Configuración única de planes
 * SIEMPRE usar estas constantes, nunca hardcodear precios
 */

export interface PlanDef {
  id: string;
  nombre: string;
  precio: number;
  periodo?: string;
  descripcion: string;
  features: string[];
  cta: string;
  popular?: boolean;
  requiereGrado?: boolean;
  tipo?: 'maestro' | 'directivo';
}

export const GRADOS = [
  { id: 'preescolar', label: 'Preescolar'  },
  { id: '1_primaria', label: '1° Primaria' },
  { id: '2_primaria', label: '2° Primaria' },
  { id: '3_primaria', label: '3° Primaria' },
  { id: '4_primaria', label: '4° Primaria' },
  { id: '5_primaria', label: '5° Primaria' },
  { id: '6_primaria', label: '6° Primaria' },
];

export const PLANS: Record<string, PlanDef> = {
  gratuito: {
    id: 'gratuito',
    nombre: 'Gratuito',
    precio: 0,
    descripcion: 'Crea tu cuenta gratis. Paga por cada documento que quieras descargar',
    features: [
      'Acceso al catálogo completo',
      'Compra documentos individuales ($0–$150)',
      'Paga solo lo que necesites',
    ],
    cta: 'Crear cuenta gratis',
    popular: false,
  },
  grado: {
    id: 'grado',
    nombre: 'Por Grado',
    precio: 499,
    periodo: 'año',
    descripcion: 'Acceso a TODO el contenido del grado que elijas',
    features: [
      'Todos los documentos de tu grado',
      'Sin límite de descargas',
      'Por 365 días',
      'Planeaciones NEM 2022',
      'Material para clase',
    ],
    cta: 'Suscribirse',
    popular: false,
    requiereGrado: true,
    tipo: 'maestro',
  },
  pro_maestro: {
    id: 'pro_maestro',
    nombre: 'Pro Maestro',
    precio: 999,
    periodo: 'año',
    descripcion: 'Acceso a TODO el contenido de TODOS los grados',
    features: [
      'Todos los documentos',
      'Todos los grados (Preescolar + Primaria)',
      'Sin límite de descargas',
      'Por 365 días',
      'Evaluaciones avanzadas',
      'Diario de clase',
    ],
    cta: 'Suscribirse',
    popular: true,
    tipo: 'maestro',
  },
  pro_directivo: {
    id: 'pro_directivo',
    nombre: 'Pro Directivo',
    precio: 999,
    periodo: 'año',
    descripcion: 'Todo lo de Pro Maestro + recursos exclusivos para directivos',
    features: [
      'Todo lo incluido en Pro Maestro',
      'Recursos CTE completos',
      'Documentos administrativos',
      'Reportes para directivos',
      'Actas y minutas de CTE',
      'Gestión escolar NEM',
    ],
    cta: 'Suscribirse',
    popular: false,
    tipo: 'directivo',
  },
};

export type PlanId = 'gratuito' | 'grado' | 'pro_maestro' | 'pro_directivo' | 'pro';

export function getPlan(id: string): PlanDef {
  return PLANS[id] ?? PLANS.gratuito;
}

/** Planes con acceso a recursos/planeaciones */
export const planTieneAccesoRecursos = (planType: string): boolean =>
  ['grado', 'pro_maestro', 'pro_directivo', 'pro'].includes(planType);

/** Solo Pro Directivo tiene acceso a CTE */
export const planTieneAccesoCTE = (planType: string): boolean =>
  planType === 'pro_directivo';
