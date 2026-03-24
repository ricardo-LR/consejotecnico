'use client';

import { useRouter } from 'next/navigation';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  plan_type: string;
}

const FEATURE_INFO: Record<string, { title: string; description: string; benefits: string[] }> = {
  diario: {
    title: 'Diario de Clase',
    description: 'Registra actividades, asistencia y observaciones diarias para cada grupo.',
    benefits: [
      'Historial completo de clases',
      'Registro de asistencia por sesión',
      'Notas y observaciones personales',
      'Exportación de registros',
    ],
  },
  recursos: {
    title: 'Recursos Didácticos',
    description: 'Accede a planeaciones, videos y materiales educativos curados para docentes.',
    benefits: [
      'Biblioteca de planeaciones SEP',
      'Videos educativos recomendados',
      'Materiales de Khan Academy en español',
      'Recursos actualizados constantemente',
    ],
  },
  pdf: {
    title: 'Exportar a PDF',
    description: 'Genera reportes en PDF de calificaciones y listas de alumnos.',
    benefits: [
      'Reportes de calificaciones en PDF',
      'Listas de alumnos imprimibles',
      'Formato profesional',
      'Descarga instantánea',
    ],
  },
  imprimir: {
    title: 'Imprimir Reportes',
    description: 'Imprime reportes y listas directamente desde el sistema.',
    benefits: [
      'Impresión de listas de alumnos',
      'Reportes de evaluaciones',
      'Formato optimizado para impresión',
    ],
  },
  grupos: {
    title: 'Más Grupos',
    description: 'Crea más grupos para gestionar todos tus salones.',
    benefits: [
      'Plan Grado: hasta 3 grupos',
      'Plan Pro: grupos ilimitados',
      'Alumnos ilimitados por grupo',
      'Evaluaciones ilimitadas',
    ],
  },
  alumnos: {
    title: 'Más Alumnos',
    description: 'Agrega más alumnos a tus grupos sin límite.',
    benefits: [
      'Alumnos ilimitados por grupo',
      'Importación masiva por CSV',
      'Sin restricciones de tamaño de clase',
    ],
  },
  evaluaciones: {
    title: 'Más Evaluaciones',
    description: 'Crea evaluaciones ilimitadas para tus grupos.',
    benefits: [
      'Evaluaciones ilimitadas por grupo',
      'Diferentes tipos: examen, tarea, proyecto',
      'Tabla de calificaciones completa',
    ],
  },
};

export default function UpgradeModal({ isOpen, onClose, feature, plan_type }: UpgradeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const info = FEATURE_INFO[feature] ?? {
    title: 'Función Premium',
    description: 'Esta función está disponible en planes de pago.',
    benefits: ['Acceso a todas las funciones', 'Sin límites', 'Soporte prioritario'],
  };

  function handleUpgrade() {
    router.push('/checkout?plan=grado');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 mb-2">
              Función Premium
            </span>
            <h2 id="upgrade-modal-title" className="text-xl font-bold text-gray-900">
              {info.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 ml-4 shrink-0"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-gray-600 text-sm mb-4">{info.description}</p>

        {/* Benefits */}
        <ul className="space-y-2 mb-6">
          {info.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm text-gray-700">
              <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {benefit}
            </li>
          ))}
        </ul>

        {/* Plan comparison */}
        <div className="bg-blue-50 rounded-xl p-4 mb-5">
          <p className="text-sm font-semibold text-blue-900 mb-1">Plan Grado — $499 MXN/año</p>
          <p className="text-xs text-blue-700">3 grupos · Alumnos ilimitados · Todas las funciones</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Ahora no
          </button>
          <button
            onClick={handleUpgrade}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Actualizar plan
          </button>
        </div>
      </div>
    </div>
  );
}
