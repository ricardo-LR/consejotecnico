'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { planTieneAccesoCTE } from '@/config/plans';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface CteArchivo {
  nombre: string;
  s3_key: string;
}

interface Cte {
  cte_id: string;
  mes: string;
  año: string | number;
  titulo: string;
  descripcion?: string;
  estado: string;
  archivos: Record<string, CteArchivo | null>;
  metadata?: {
    duracion_minutos?: number;
    grados_afectados?: string[];
    temas_clave?: string[];
  };
}

const FILE_LABELS: Record<string, string> = {
  presentacion:        '📊 Presentación',
  orden_dia:           '📋 Orden del Día',
  guia_facilitador:    '📖 Guía de Facilitador',
  minuta_template:     '📝 Template de Minuta',
  material_referencia: '📚 Material de Referencia',
};

export default function DirectivoCTEPage() {
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acceso, setAcceso] = useState<boolean | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token') ?? '';
    if (!token) { window.location.href = '/auth/login'; return; }
    const planType = localStorage.getItem('plan_type') ?? 'gratuito';
    if (!planTieneAccesoCTE(planType)) {
      setAcceso(false);
      setLoading(false);
      return;
    }
    setAcceso(true);
    fetch(`${API_URL}/cte/list?estado=produccion`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => setCtes(data.ctes ?? []))
      .catch(() => setError('No se pudieron cargar los CTEs'))
      .finally(() => setLoading(false));
  }, []);

  if (acceso === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow max-w-md">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Acceso restringido</h2>
          <p className="text-gray-500 mb-6">
            Los recursos CTE están disponibles exclusivamente para el Plan Pro Directivo.
          </p>
          <a
            href="/checkout?plan=pro_directivo"
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 inline-block"
          >
            Ver Plan Pro Directivo →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Volver al Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">🎓 Consejo Técnico Escolar</h1>
        <p className="text-gray-600 mb-8">Materiales y recursos para tus sesiones de CTE</p>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg mb-6">
            {error}
          </div>
        )}

        {!loading && ctes.length === 0 && !error && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
            <p className="text-lg mb-2">No hay CTEs disponibles</p>
            <p className="text-sm">Los materiales aparecerán aquí cuando estén publicados.</p>
          </div>
        )}

        <div className="space-y-6">
          {ctes.map((cte) => (
            <CTECard key={cte.cte_id} cte={cte} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CTECard({ cte }: { cte: Cte }) {
  const [open, setOpen] = useState(false);
  const archivos = cte.archivos ?? {};
  const hasFiles = Object.values(archivos).some(Boolean);
  const duracion = cte.metadata?.duracion_minutos ?? 75;
  const grados   = cte.metadata?.grados_afectados ?? [];
  const temas    = cte.metadata?.temas_clave ?? [];

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-6 flex items-start justify-between">
        <div className="flex-1 mr-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {cte.mes} {cte.año}
            </span>
            <span className="text-xs text-gray-400">{duracion} min</span>
            {grados.length > 0 && (
              <span className="text-xs text-gray-400">{grados.join(', ')}</span>
            )}
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">{cte.titulo}</h2>
          {cte.descripcion && (
            <p className="text-gray-600 text-sm">{cte.descripcion}</p>
          )}
          {temas.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {temas.map((t) => (
                <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        {hasFiles && (
          <button
            onClick={() => setOpen(!open)}
            className="shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition"
          >
            {open ? 'Ocultar' : 'Ver materiales'}
          </button>
        )}
      </div>

      {open && hasFiles && (
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Materiales disponibles
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(archivos).map(([tipo, archivo]) => {
              if (!archivo) return null;
              return (
                <a
                  key={tipo}
                  href={`https://consejotecnico-files-dev.s3.amazonaws.com/${archivo.s3_key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition"
                >
                  <span className="text-lg">{FILE_LABELS[tipo]?.split(' ')[0] ?? '📄'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {FILE_LABELS[tipo]?.split(' ').slice(1).join(' ') ?? tipo}
                    </p>
                    <p className="text-xs text-gray-400">{archivo.nombre}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {!hasFiles && (
        <div className="border-t border-gray-100 px-6 py-3 bg-gray-50">
          <p className="text-xs text-gray-400">Materiales próximamente</p>
        </div>
      )}
    </div>
  );
}
