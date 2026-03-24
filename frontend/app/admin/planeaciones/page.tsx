'use client';

import { useEffect, useState } from 'react';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface Planeacion {
  planeacionId: string;
  titulo:       string;
  grado:        string;
  materia?:     string;
  price?:       number | string;
  createdAt?:   string;
}

export default function AdminPlaneacionesPage() {
  const [items,   setItems]   = useState<Planeacion[]>([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlaneaciones() {
      try {
        const res  = await fetch(`${API_URL}/planeaciones`);
        const data = res.ok ? await res.json() : { items: [] };
        setItems(data.items ?? []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPlaneaciones();
  }, []);

  const filtered = items.filter((p) =>
    (p.titulo ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.grado  ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Planeaciones</h1>
        <span className="text-sm text-gray-500">{filtered.length} planeaciones</span>
      </div>

      <input
        type="search"
        placeholder="Buscar por título o grado..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando planeaciones...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium">Título</th>
                <th className="px-6 py-3 text-left font-medium">Grado</th>
                <th className="px-6 py-3 text-left font-medium">Materia</th>
                <th className="px-6 py-3 text-left font-medium">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                    Sin planeaciones.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.planeacionId} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-800 font-medium">{p.titulo}</td>
                    <td className="px-6 py-3 text-gray-500">{p.grado}</td>
                    <td className="px-6 py-3 text-gray-500">{p.materia || '—'}</td>
                    <td className="px-6 py-3 text-gray-700">
                      {p.price != null ? `$${parseFloat(String(p.price)).toFixed(2)} MXN` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
