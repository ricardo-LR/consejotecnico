'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface CteArchivos {
  presentacion?: { nombre: string; version?: number; ultima_actualizacion?: string } | null;
  orden_dia?: { nombre: string } | null;
  guia_facilitador?: { nombre: string } | null;
  minuta_template?: { nombre: string } | null;
  material_referencia?: { nombre: string } | null;
}

interface CteMetadata {
  duracion_minutos?: number;
  grados_afectados?: string[];
}

interface Cte {
  cte_id: string;
  mes: string;
  año: number;
  titulo: string;
  descripcion: string;
  estado: 'borrador' | 'revision' | 'produccion';
  archivos: CteArchivos;
  metadata?: CteMetadata;
}

const ESTADO_INFO = {
  borrador:   { color: 'bg-gray-100 text-gray-800',   icon: '✏️', label: 'Borrador'    },
  revision:   { color: 'bg-yellow-100 text-yellow-800', icon: '👁️', label: 'Revisión'   },
  produccion: { color: 'bg-green-100 text-green-800',  icon: '✅', label: 'Producción' },
};

const NEXT_STATES: Record<string, string[]> = {
  borrador:   ['revision'],
  revision:   ['borrador', 'produccion'],
  produccion: ['revision'],
};

export default function AdminCTEPage() {
  const router = useRouter();
  const [ctes, setCtes]           = useState<Cte[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ mes: '', año: 2025, titulo: '', descripcion: '' });
  const [creating, setCreating]   = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { router.push('/admin/login'); return; }
    fetchCTEs();
  }, [router]);

  async function fetchCTEs() {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token') ?? '';
      const res = await fetch(`${API_URL}/admin/cte/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCtes(data.ctes ?? []);
      }
    } catch { /* no-op */ } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.mes || !form.titulo) { alert('Mes y título requeridos'); return; }
    setCreating(true);
    try {
      const token = localStorage.getItem('admin_token') ?? '';
      const res = await fetch(`${API_URL}/admin/cte`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setShowForm(false);
        setForm({ mes: '', año: 2025, titulo: '', descripcion: '' });
        fetchCTEs();
      } else {
        alert(data.error ?? 'Error al crear CTE');
      }
    } catch { alert('Error de red'); } finally {
      setCreating(false);
    }
  }

  async function handleChangeState(cte_id: string, newState: string) {
    const token = localStorage.getItem('admin_token') ?? '';
    const res = await fetch(`${API_URL}/admin/cte/${cte_id}/state`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: newState }),
    });
    const data = await res.json();
    if (res.ok) {
      fetchCTEs();
    } else {
      alert(data.error ?? 'Error al cambiar estado');
    }
  }

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
    <div className="p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CTE — Consejo Técnico Escolar</h1>
          <p className="text-gray-500 text-sm mt-1">Gestiona CTEs: borrador → revisión → producción</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm"
        >
          + Nuevo CTE
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold mb-5">Crear nuevo CTE</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Mes</label>
                <select
                  value={form.mes}
                  onChange={(e) => setForm({ ...form, mes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                >
                  <option value="">Seleccionar mes</option>
                  {['Agosto','Septiembre','Octubre','Noviembre','Diciembre','Enero','Febrero','Marzo','Abril','Mayo','Junio'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Año</label>
                <input
                  type="number"
                  value={form.año}
                  onChange={(e) => setForm({ ...form, año: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Título</label>
              <input
                type="text"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej: Estrategias de Lectura"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-sm disabled:bg-gray-300"
              >
                {creating ? 'Creando...' : 'Crear CTE'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold text-sm"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CTE grid */}
      {ctes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium mb-2">No hay CTEs aún</p>
          <button onClick={() => setShowForm(true)} className="text-blue-600 hover:underline text-sm">
            Crear el primero
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ctes.map((cte) => (
            <CTECard key={cte.cte_id} cte={cte} onChangeState={handleChangeState} />
          ))}
        </div>
      )}
    </div>
  );
}

function CTECard({ cte, onChangeState }: { cte: Cte; onChangeState: (id: string, s: string) => void }) {
  const [open, setOpen] = useState(false);
  const info = ESTADO_INFO[cte.estado] ?? ESTADO_INFO.borrador;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-gray-900 text-sm leading-tight pr-2">{cte.titulo}</h3>
        <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${info.color}`}>
          {info.icon} {info.label}
        </span>
      </div>

      <p className="text-gray-500 text-xs mb-3 line-clamp-2">{cte.descripcion}</p>

      <div className="flex justify-between text-xs text-gray-400 mb-4">
        <span>{cte.mes} {cte.año}</span>
        <span>{cte.metadata?.duracion_minutos ?? 75} min</span>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/admin/cte/edit?id=${cte.cte_id}`}
          className="flex-1 text-center px-3 py-1.5 bg-blue-50 text-blue-600 rounded text-xs font-semibold hover:bg-blue-100 transition"
        >
          Editar
        </Link>

        <div className="relative flex-1">
          <button
            onClick={() => setOpen(!open)}
            className="w-full px-3 py-1.5 bg-purple-50 text-purple-600 rounded text-xs font-semibold hover:bg-purple-100 transition"
          >
            ↻ Estado
          </button>
          {open && (
            <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 z-10 min-w-32">
              {(NEXT_STATES[cte.estado] ?? []).map((ns) => {
                const ni = ESTADO_INFO[ns as keyof typeof ESTADO_INFO];
                return (
                  <button
                    key={ns}
                    onClick={() => { setOpen(false); onChangeState(cte.cte_id, ns); }}
                    className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 border-b last:border-0"
                  >
                    {ni.icon} {ni.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
