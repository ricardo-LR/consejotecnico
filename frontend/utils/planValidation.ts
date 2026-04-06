/**
 * Plan validation utilities for Workspace Maestro (client-side).
 * Mirrors the backend plan_validator.py limits.
 */

export type PlanType = 'gratuito' | 'grado' | 'pro' | 'pro_maestro' | 'pro_directivo';

export interface PlanLimits {
  grupos: number;
  alumnosPorGrupo: number;
  evaluacionesPorGrupo: number;
  pdf: boolean;
  imprimir: boolean;
  diario: boolean;
  recursos: boolean;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  gratuito: {
    grupos: 1,
    alumnosPorGrupo: 50,
    evaluacionesPorGrupo: 5,
    pdf: false,
    imprimir: false,
    diario: false,
    recursos: false,
  },
  grado: {
    grupos: 3,
    alumnosPorGrupo: 999999,
    evaluacionesPorGrupo: 999999,
    pdf: true,
    imprimir: true,
    diario: true,
    recursos: true,
  },
  pro: {
    grupos: 999999,
    alumnosPorGrupo: 999999,
    evaluacionesPorGrupo: 999999,
    pdf: true,
    imprimir: true,
    diario: true,
    recursos: true,
  },
  pro_maestro: {
    grupos: 999999,
    alumnosPorGrupo: 999999,
    evaluacionesPorGrupo: 999999,
    pdf: true,
    imprimir: true,
    diario: true,
    recursos: true,
  },
  pro_directivo: {
    grupos: 999999,
    alumnosPorGrupo: 999999,
    evaluacionesPorGrupo: 999999,
    pdf: true,
    imprimir: true,
    diario: true,
    recursos: true,
  },
};

export function getLimits(planType: string): PlanLimits {
  return PLAN_LIMITS[planType as PlanType] ?? PLAN_LIMITS.gratuito;
}

export function canCreateGrupo(
  planType: string,
  currentCount: number
): { allowed: boolean; message: string | null } {
  const limits = getLimits(planType);
  if (currentCount >= limits.grupos) {
    return {
      allowed: false,
      message: `Tu plan ${planType} permite máximo ${limits.grupos} grupo(s). Actualiza tu plan para crear más.`,
    };
  }
  return { allowed: true, message: null };
}

export function canAddAlumno(
  planType: string,
  currentCount: number
): { allowed: boolean; message: string | null } {
  const limits = getLimits(planType);
  if (currentCount >= limits.alumnosPorGrupo) {
    return {
      allowed: false,
      message: `Tu plan permite máximo ${limits.alumnosPorGrupo} alumnos por grupo.`,
    };
  }
  return { allowed: true, message: null };
}

export function canCreateEvaluacion(
  planType: string,
  currentCount: number
): { allowed: boolean; message: string | null } {
  const limits = getLimits(planType);
  if (currentCount >= limits.evaluacionesPorGrupo) {
    return {
      allowed: false,
      message: `Tu plan permite máximo ${limits.evaluacionesPorGrupo} evaluaciones por grupo.`,
    };
  }
  return { allowed: true, message: null };
}

export function canUseFeature(
  planType: string,
  feature: keyof Pick<PlanLimits, 'pdf' | 'imprimir' | 'diario' | 'recursos'>
): { allowed: boolean; message: string | null } {
  const limits = getLimits(planType);
  if (!limits[feature]) {
    return {
      allowed: false,
      message: `La función '${feature}' no está disponible en tu plan actual. Actualiza a Plan Grado o Pro.`,
    };
  }
  return { allowed: true, message: null };
}

export function getPlanLabel(planType: string): string {
  const labels: Record<string, string> = {
    gratuito:     'Plan Gratuito',
    grado:        'Plan Grado',
    pro:          'Plan Pro',
    pro_maestro:  'Pro Maestro',
    pro_directivo:'Pro Directivo',
  };
  return labels[planType] ?? planType;
}

export function getPlanBadgeColor(planType: string): string {
  const colors: Record<string, string> = {
    gratuito:     'bg-gray-100 text-gray-700',
    grado:        'bg-blue-100 text-blue-700',
    pro:          'bg-purple-100 text-purple-700',
    pro_maestro:  'bg-purple-100 text-purple-700',
    pro_directivo:'bg-indigo-100 text-indigo-700',
  };
  return colors[planType] ?? 'bg-gray-100 text-gray-700';
}
