'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import UpgradeModal from '@/components/maestro/UpgradeModal';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface Planeacion {
  id: string;
  titulo: string;
  descripcion: string;
  materia: string;
  grado: string;
}

const YOUTUBE_RESOURCES = [
  {
    title: 'Estrategias de enseñanza para primaria',
    channel: 'SEP México',
    url: 'https://www.youtube.com/@SEPMexico',
    description: 'Canal oficial de la Secretaría de Educación Pública con recursos para docentes.',
  },
  {
    title: 'Matemáticas con Paco el Chato',
    channel: 'Paco el Chato',
    url: 'https://www.youtube.com/@PacoelChato',
    description: 'Videos educativos de matemáticas para primaria y secundaria.',
  },
  {
    title: 'Aprende en casa – SEP',
    channel: 'AprendeEnCasaMX',
    url: 'https://www.youtube.com/@AprendeEnCasaMx',
    description: 'Clases transmitidas por la SEP para todos los grados escolares.',
  },
  {
    title: 'Ciencias Naturales para Niños',
    channel: 'Happy Learning Español',
    url: 'https://www.youtube.com/@HappyLearningEspanol',
    description: 'Videos animados de ciencias naturales con enfoque didáctico.',
  },
  {
    title: 'Historia de México para niños',
    channel: 'Smile and Learn Español',
    url: 'https://www.youtube.com/@SmileandLearnEspanol',
    description: 'Historia y ciencias sociales explicadas de manera divertida.',
  },
];

const SEP_RESOURCES = [
  {
    title: 'Planes y programas de estudio',
    description: 'Plan de estudios 2022 y programas por asignatura y grado.',
    url: 'https://www.sep.gob.mx/es/sep1/curriculos',
  },
  {
    title: 'Libros de texto gratuitos',
    description: 'Libros de texto gratuitos para todos los grados de educación básica.',
    url: 'https://www.conaliteg.sep.gob.mx/',
  },
  {
    title: 'Portal de formación docente',
    description: 'Cursos y materiales de formación continua para maestros.',
    url: 'https://www.gob.mx/usicamm',
  },
  {
    title: 'Recursos para la enseñanza',
    description: 'Materiales didácticos digitales del Portal Educativo de la SEP.',
    url: 'https://portaleducativo.sep.gob.mx/',
  },
];

export default function RecursosPage() {
  const [planType, setPlanType] = useState('gratuito');
  const [planeaciones, setPlaneaciones] = useState<Planeacion[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const p = localStorage.getItem('plan_type') ?? 'gratuito';
    const t = localStorage.getItem('token') ?? '';
    setPlanType(p);

    if (p === 'gratuito') {
      setShowUpgradeModal(true);
      return;
    }

    if (t) fetchPlaneaciones(t);
  }, []);

  async function fetchPlaneaciones(token: string) {
    setLoadingPlan(true);
    try {
      const res = await fetch(`${API_URL}/planeaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPlaneaciones(data.items ?? data ?? []);
      }
    } catch {
      // silently fail — planeaciones section just shows empty
    } finally {
      setLoadingPlan(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Recursos Didácticos</h1>

      {/* Mis Planeaciones */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Mis Planeaciones</h2>
          <Link href="/catalog" className="text-sm text-blue-600 hover:underline font-medium">
            Ver catálogo
          </Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {loadingPlan ? (
            <div className="flex justify-center py-8">
              <svg className="w-6 h-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : planeaciones.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400">
              <p className="text-sm mb-3">Aún no tienes planeaciones.</p>
              <Link
                href="/catalog"
                className="inline-block bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Explorar catálogo
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {planeaciones.slice(0, 10).map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.titulo}</p>
                    {p.materia && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {p.materia}
                        {p.grado ? ` · ${p.grado}` : ''}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/catalog/${p.id}`}
                    className="text-xs text-blue-600 font-medium hover:underline shrink-0 ml-3"
                  >
                    Ver
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Khan Academy */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Khan Academy en Español</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">Ejercicios y lecciones gratuitas</h3>
            <p className="text-sm text-gray-500 mt-1">
              Accede a miles de ejercicios interactivos de matemáticas, ciencias, historia y más para todos los niveles.
            </p>
            <a
              href="https://es.khanacademy.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-green-600 font-medium hover:underline mt-2"
            >
              Ir a Khan Academy
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Videos recomendados */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Videos Recomendados</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {YOUTUBE_RESOURCES.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-red-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 leading-tight">{r.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.channel}</p>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{r.description}</p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* SEP Resources */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recursos SEP</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SEP_RESOURCES.map((r) => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 leading-tight">{r.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{r.description}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium mt-1.5">
                    Visitar
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Upgrade modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="recursos"
        plan_type={planType}
      />
    </div>
  );
}
