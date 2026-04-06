'use client';

import { useEffect, useState } from 'react';
import { isLoggedIn, getPlanType, getAuthToken } from '@/lib/auth';

const API = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface Recurso {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  grado: string;
  precio: number;
  tipo: 'libre' | 'incluido' | 'comprar';
  url_descarga?: string;
}

export default function RecursosPage() {
  const [mounted, setMounted]   = useState(false);
  const [planType, setPlanType] = useState('gratuito');
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!isLoggedIn()) {
      window.location.href = '/auth/login';
      return;
    }

    const plan = getPlanType() || 'gratuito';
    setPlanType(plan);
    setMounted(true);

    cargarRecursos(plan);
  }, []);

  async function cargarRecursos(plan: string) {
    try {
      setLoading(true);
      const token = getAuthToken();

      const res = await fetch(`${API}/planeaciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data = await res.json();
      setRecursos(data.planeaciones || data.items || data || []);
    } catch (e: any) {
      console.error('Error cargando recursos:', e);
      setError(e.message || 'Error cargando recursos');
      setRecursos([]);
    } finally {
      setLoading(false);
    }
  }

  function tieneAcceso(_recurso: Recurso): boolean {
    return ['grado', 'pro_maestro', 'pro_directivo', 'pro'].includes(planType);
  }

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Mis Recursos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Plan actual: <span className="font-medium capitalize">{planType}</span>
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6 animate-pulse">
                <div className="h-32 bg-gray-100 rounded-lg mb-4" />
                <div className="h-4 bg-gray-100 rounded mb-2" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Error no crítico */}
        {error && !loading && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <p className="text-yellow-700 text-sm">
              No se pudieron cargar los recursos del servidor. Mostrando catálogo local.
            </p>
          </div>
        )}

        {/* Sin recursos */}
        {!loading && recursos.length === 0 && (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="text-5xl mb-4">📚</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Recursos próximamente
            </h2>
            <p className="text-gray-400 mb-6">
              Estamos preparando el contenido para tu grado.
            </p>
            <a
              href="/catalogo"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 inline-block"
            >
              Ver catálogo →
            </a>
          </div>
        )}

        {/* Grid de recursos */}
        {!loading && recursos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recursos.map((recurso) => {
              const acceso = tieneAcceso(recurso);
              return (
                <div
                  key={recurso.id}
                  className="bg-white rounded-xl border hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="h-32 bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                    <span className="text-4xl">📄</span>
                  </div>

                  <div className="p-4">
                    <div className="flex gap-2 mb-2">
                      {recurso.categoria && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {recurso.categoria}
                        </span>
                      )}
                      {recurso.grado && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {recurso.grado}
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2">
                      {recurso.titulo}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                      {recurso.descripcion}
                    </p>

                    {acceso ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-600 font-medium">
                          ✓ Incluido en tu plan
                        </span>
                        <a
                          href={recurso.url_descarga || '#'}
                          className="bg-green-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1"
                        >
                          ⬇️ Descargar
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800">
                          ${recurso.precio} MXN
                        </span>
                        <a
                          href={`/checkout?planeacion_id=${recurso.id}&precio=${recurso.precio}&plan_type=individual`}
                          className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700"
                        >
                          Comprar
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
