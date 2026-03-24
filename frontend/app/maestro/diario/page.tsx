'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import UpgradeModal from '@/components/maestro/UpgradeModal';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface Grupo {
  grupoId: string;
  nombre: string;
}

interface DiarioEntry {
  diarioId: string;
  fecha: string;
  tema: string;
  actividad: string;
  asistencia: number;
  observaciones: string;
}

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function DiarioContent() {
  const searchParams = useSearchParams();
  const [token, setToken] = useState('');
  const [planType, setPlanType] = useState('gratuito');

  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState('');
  const [entries, setEntries] = useState<DiarioEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // New entry form
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [tema, setTema] = useState('');
  const [actividad, setActividad] = useState('');
  const [asistencia, setAsistencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);

  // Upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Messages
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  function showMsg(type: 'error' | 'success', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  useEffect(() => {
    const t = localStorage.getItem('token') ?? '';
    const p = localStorage.getItem('plan_type') ?? 'gratuito';
    setToken(t);
    setPlanType(p);

    if (p === 'gratuito') {
      setShowUpgradeModal(true);
      return;
    }

    // If grupoId in URL, pre-select it
    const urlGrupoId = searchParams.get('grupoId') ?? '';
    if (urlGrupoId) setSelectedGrupoId(urlGrupoId);

    if (t) fetchGrupos(t, urlGrupoId);
  }, [searchParams]);

  async function fetchGrupos(t: string, preSelectId = '') {
    try {
      const res = await fetch(`${API_URL}/maestro/grupos`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      const items: Grupo[] = data.items ?? [];
      setGrupos(items);
      const idToUse = preSelectId || (items[0]?.grupoId ?? '');
      if (idToUse) {
        setSelectedGrupoId(idToUse);
        fetchEntries(t, idToUse);
      }
    } catch {
      showMsg('error', 'Error al cargar grupos');
    }
  }

  async function fetchEntries(t: string, grupoId: string) {
    if (!grupoId) return;
    setLoadingEntries(true);
    try {
      const res = await fetch(`${API_URL}/maestro/diario?grupoId=${grupoId}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 403) {
        setShowUpgradeModal(true);
        return;
      }
      const data = await res.json();
      setEntries(data.items ?? []);
    } catch {
      showMsg('error', 'Error al cargar entradas del diario');
    } finally {
      setLoadingEntries(false);
    }
  }

  function handleGrupoChange(grupoId: string) {
    setSelectedGrupoId(grupoId);
    setEntries([]);
    if (token && grupoId) fetchEntries(token, grupoId);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tema.trim() || !selectedGrupoId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/maestro/diario`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          grupoId: selectedGrupoId,
          fecha,
          tema,
          actividad,
          asistencia: parseInt(asistencia || '0', 10),
          observaciones,
        }),
      });
      if (res.status === 403) {
        setShowUpgradeModal(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setEntries((prev) => [data, ...prev]);
        setTema('');
        setActividad('');
        setAsistencia('');
        setObservaciones('');
        showMsg('success', 'Entrada registrada');
      } else {
        const data = await res.json();
        showMsg('error', data.error ?? 'Error al guardar');
      }
    } catch {
      showMsg('error', 'Error de red');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Diario de Clase</h1>

      {/* Toast */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            message.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Grupo selector */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">Grupo</label>
        <select
          value={selectedGrupoId}
          onChange={(e) => handleGrupoChange(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Selecciona un grupo</option>
          {grupos.map((g) => (
            <option key={g.grupoId} value={g.grupoId}>
              {g.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* New entry form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Nueva entrada</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asistencia (# alumnos)</label>
              <input
                type="number"
                min={0}
                value={asistencia}
                onChange={(e) => setAsistencia(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tema *</label>
            <input
              type="text"
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              placeholder="Tema de la clase"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actividad</label>
            <textarea
              value={actividad}
              onChange={(e) => setActividad(e.target.value)}
              placeholder="Descripción de la actividad realizada"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales, comportamiento, pendientes..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !selectedGrupoId}
              className="flex items-center gap-2 bg-blue-600 text-white text-sm px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {saving && <Spinner />}
              Registrar entrada
            </button>
          </div>
        </form>
      </div>

      {/* Entries list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Historial</h2>
          <span className="text-xs text-gray-400">{entries.length} entradas</span>
        </div>

        {loadingEntries ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            {selectedGrupoId ? 'Sin entradas aún para este grupo' : 'Selecciona un grupo para ver el historial'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.diarioId} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {entry.fecha}
                      </span>
                      {entry.asistencia > 0 && (
                        <span className="text-xs text-gray-500">{entry.asistencia} presentes</span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 text-sm">{entry.tema}</p>
                    {entry.actividad && (
                      <p className="text-sm text-gray-600 mt-1">{entry.actividad}</p>
                    )}
                    {entry.observaciones && (
                      <p className="text-xs text-gray-400 mt-1 italic">{entry.observaciones}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upgrade modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="diario"
        plan_type={planType}
      />
    </div>
  );
}

export default function DiarioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      }
    >
      <DiarioContent />
    </Suspense>
  );
}
