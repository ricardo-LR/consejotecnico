'use client';

import { useEffect, useState } from 'react';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface CteArchivo {
  nombre: string;
  s3_key: string;
  version?: number;
  ultima_actualizacion?: string;
}

interface CteMetadata {
  duracion_minutos?: number;
  grados_afectados?: string[];
  temas_clave?: string[];
}

interface Cte {
  cte_id: string;
  mes: string;
  año: number | string;
  titulo: string;
  descripcion: string;
  estado: string;
  fecha_produccion?: string;
  archivos: Record<string, CteArchivo | null>;
  metadata?: CteMetadata;
}

const FILE_LABELS: Record<string, string> = {
  presentacion:        '📊 Presentación',
  orden_dia:           '📋 Orden del Día',
  guia_facilitador:    '📖 Guía de Facilitador',
  minuta_template:     '📝 Template de Minuta',
  material_referencia: '📚 Material de Referencia',
};

export default function MaestroCTEPage() {
  const [ctes, setCtes]       = useState<Cte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token') ?? '';
    fetch(`${API_URL}/cte/list?estado=produccion`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => setCtes(data.ctes ?? []))
      .catch(() => setError('No se pudieron cargar los CTEs'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Cargando CTEs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Consejo Técnico Escolar</h1>
        <p className="text-gray-500 text-sm mt-1">
          Materiales y recursos para tus sesiones de CTE
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {ctes.length === 0 && !error ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400 text-lg mb-2">No hay CTEs disponibles</p>
          <p className="text-gray-400 text-sm">
            Los materiales aparecerán aquí cuando estén publicados.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {ctes.map((cte) => (
            <CTECard key={cte.cte_id} cte={cte} />
          ))}
        </div>
      )}
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
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

      {/* Files section */}
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
