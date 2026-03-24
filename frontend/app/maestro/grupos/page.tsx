'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import UpgradeModal from '@/components/maestro/UpgradeModal';
import { getLimits } from '@/utils/planValidation';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Grupo {
  grupoId: string;
  nombre: string;
  grado: string;
  ciclo_escolar: string;
  createdAt: string;
}

interface Alumno {
  alumnoId: string;
  nombre: string;
  apellido: string;
  grupoId: string;
}

interface Evaluacion {
  evaluacionId: string;
  nombre: string;
  fecha: string;
  tipo: string;
  grupoId: string;
}

interface Calificacion {
  calificacionId: string;
  evaluacionId: string;
  alumnoId: string;
  calificacion: number | null;
}

type ActiveTab = 'alumnos' | 'calificaciones' | 'evaluaciones';

// ── Loading spinner ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

function GruposContent() {
  const [token, setToken] = useState('');
  const [planType, setPlanType] = useState('gratuito');

  // Grupos
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);
  const [loadingGrupos, setLoadingGrupos] = useState(true);

  // New grupo form
  const [showNewGrupoForm, setShowNewGrupoForm] = useState(false);
  const [newGrupoNombre, setNewGrupoNombre] = useState('');
  const [newGrupoGrado, setNewGrupoGrado] = useState('');
  const [newGrupoCiclo, setNewGrupoCiclo] = useState('');
  const [savingGrupo, setSavingGrupo] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<ActiveTab>('alumnos');

  // Alumnos
  const [alumnos, setAlumnos] = useState<Alumno[]>([]);
  const [loadingAlumnos, setLoadingAlumnos] = useState(false);
  const [newAlumnoNombre, setNewAlumnoNombre] = useState('');
  const [newAlumnoApellido, setNewAlumnoApellido] = useState('');
  const [savingAlumno, setSavingAlumno] = useState(false);

  // Evaluaciones
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [loadingEvals, setLoadingEvals] = useState(false);
  const [newEvalNombre, setNewEvalNombre] = useState('');
  const [newEvalFecha, setNewEvalFecha] = useState('');
  const [newEvalTipo, setNewEvalTipo] = useState('examen');
  const [savingEval, setSavingEval] = useState(false);

  // Calificaciones
  const [calificaciones, setCalificaciones] = useState<Calificacion[]>([]);
  const [loadingCals, setLoadingCals] = useState(false);
  const [gradeChanges, setGradeChanges] = useState<Record<string, number | null>>({});
  const [savingCals, setSavingCals] = useState(false);

  // Upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('grupos');

  // Error/success messages
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = localStorage.getItem('token') ?? '';
    const p = localStorage.getItem('plan_type') ?? 'gratuito';
    setToken(t);
    setPlanType(p);
  }, []);

  useEffect(() => {
    if (token) fetchGrupos();
  }, [token]);

  // ── API helpers ───────────────────────────────────────────────────────────────

  function showMsg(type: 'error' | 'success', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  async function apiFetch(path: string, opts: RequestInit = {}) {
    const res = await fetch(`${API_URL}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opts.headers ?? {}),
      },
    });
    const data = await res.json();
    if (res.status === 403 && data.upgrade_required) {
      return { _upgrade: true, error: data.error };
    }
    return { status: res.status, ok: res.ok, data };
  }

  // ── Grupos ────────────────────────────────────────────────────────────────────

  async function fetchGrupos() {
    setLoadingGrupos(true);
    try {
      const result = await apiFetch('/maestro/grupos') as any;
      if (result._upgrade) {
        setUpgradeFeature('grupos');
        setShowUpgradeModal(true);
        return;
      }
      if (result.ok) setGrupos(result.data.items ?? []);
    } catch {
      showMsg('error', 'Error al cargar grupos');
    } finally {
      setLoadingGrupos(false);
    }
  }

  async function handleCreateGrupo(e: React.FormEvent) {
    e.preventDefault();
    if (!newGrupoNombre.trim()) return;
    setSavingGrupo(true);
    try {
      const result = await apiFetch('/maestro/grupos', {
        method: 'POST',
        body: JSON.stringify({ nombre: newGrupoNombre, grado: newGrupoGrado, ciclo_escolar: newGrupoCiclo }),
      }) as any;
      if (result._upgrade) {
        setUpgradeFeature('grupos');
        setShowUpgradeModal(true);
        return;
      }
      if (result.ok) {
        setGrupos((prev) => [...prev, result.data]);
        setNewGrupoNombre('');
        setNewGrupoGrado('');
        setNewGrupoCiclo('');
        setShowNewGrupoForm(false);
        showMsg('success', 'Grupo creado');
      } else {
        showMsg('error', result.data.error ?? 'Error al crear grupo');
      }
    } catch {
      showMsg('error', 'Error de red');
    } finally {
      setSavingGrupo(false);
    }
  }

  async function handleDeleteGrupo(grupoId: string) {
    if (!confirm('¿Eliminar este grupo? Se perderán todos sus datos.')) return;
    try {
      const result = await apiFetch(`/maestro/grupos/${grupoId}`, { method: 'DELETE' }) as any;
      if (result.ok) {
        setGrupos((prev) => prev.filter((g) => g.grupoId !== grupoId));
        if (selectedGrupo?.grupoId === grupoId) setSelectedGrupo(null);
        showMsg('success', 'Grupo eliminado');
      }
    } catch {
      showMsg('error', 'Error al eliminar grupo');
    }
  }

  // ── Select grupo ──────────────────────────────────────────────────────────────

  function selectGrupo(grupo: Grupo) {
    setSelectedGrupo(grupo);
    setActiveTab('alumnos');
    setAlumnos([]);
    setEvaluaciones([]);
    setCalificaciones([]);
    setGradeChanges({});
    fetchAlumnos(grupo.grupoId);
    fetchEvaluaciones(grupo.grupoId);
    fetchCalificaciones(grupo.grupoId);
  }

  // ── Alumnos ───────────────────────────────────────────────────────────────────

  async function fetchAlumnos(grupoId: string) {
    setLoadingAlumnos(true);
    try {
      const result = await apiFetch(`/maestro/grupo/${grupoId}/alumnos`) as any;
      if (result.ok) setAlumnos(result.data.items ?? []);
    } catch {
      showMsg('error', 'Error al cargar alumnos');
    } finally {
      setLoadingAlumnos(false);
    }
  }

  async function handleAddAlumno(e: React.FormEvent) {
    e.preventDefault();
    if (!newAlumnoNombre.trim() || !selectedGrupo) return;
    setSavingAlumno(true);
    try {
      const result = await apiFetch('/maestro/alumnos', {
        method: 'POST',
        body: JSON.stringify({ grupoId: selectedGrupo.grupoId, nombre: newAlumnoNombre, apellido: newAlumnoApellido }),
      }) as any;
      if (result._upgrade) {
        setUpgradeFeature('alumnos');
        setShowUpgradeModal(true);
        return;
      }
      if (result.ok) {
        setAlumnos((prev) => [...prev, result.data]);
        setNewAlumnoNombre('');
        setNewAlumnoApellido('');
        showMsg('success', 'Alumno agregado');
      } else {
        showMsg('error', result.data.error ?? 'Error al agregar alumno');
      }
    } catch {
      showMsg('error', 'Error de red');
    } finally {
      setSavingAlumno(false);
    }
  }

  async function handleDeleteAlumno(alumnoId: string) {
    if (!confirm('¿Eliminar este alumno?')) return;
    try {
      const result = await apiFetch(`/maestro/alumnos/${alumnoId}`, { method: 'DELETE' }) as any;
      if (result.ok) {
        setAlumnos((prev) => prev.filter((a) => a.alumnoId !== alumnoId));
        showMsg('success', 'Alumno eliminado');
      }
    } catch {
      showMsg('error', 'Error al eliminar alumno');
    }
  }

  // ── Evaluaciones ──────────────────────────────────────────────────────────────

  async function fetchEvaluaciones(grupoId: string) {
    setLoadingEvals(true);
    try {
      const result = await apiFetch(`/maestro/grupo/${grupoId}/evaluaciones`) as any;
      if (result.ok) setEvaluaciones(result.data.items ?? []);
    } catch {
      showMsg('error', 'Error al cargar evaluaciones');
    } finally {
      setLoadingEvals(false);
    }
  }

  async function handleAddEvaluacion(e: React.FormEvent) {
    e.preventDefault();
    if (!newEvalNombre.trim() || !selectedGrupo) return;
    setSavingEval(true);
    try {
      const result = await apiFetch('/maestro/evaluaciones', {
        method: 'POST',
        body: JSON.stringify({ grupoId: selectedGrupo.grupoId, nombre: newEvalNombre, fecha: newEvalFecha, tipo: newEvalTipo }),
      }) as any;
      if (result._upgrade) {
        setUpgradeFeature('evaluaciones');
        setShowUpgradeModal(true);
        return;
      }
      if (result.ok) {
        setEvaluaciones((prev) => [...prev, result.data]);
        setNewEvalNombre('');
        setNewEvalFecha('');
        showMsg('success', 'Evaluación creada');
      } else {
        showMsg('error', result.data.error ?? 'Error al crear evaluación');
      }
    } catch {
      showMsg('error', 'Error de red');
    } finally {
      setSavingEval(false);
    }
  }

  async function handleDeleteEvaluacion(evalId: string) {
    if (!confirm('¿Eliminar esta evaluación?')) return;
    try {
      const result = await apiFetch(`/maestro/evaluaciones/${evalId}`, { method: 'DELETE' }) as any;
      if (result.ok) {
        setEvaluaciones((prev) => prev.filter((ev) => ev.evaluacionId !== evalId));
        showMsg('success', 'Evaluación eliminada');
      }
    } catch {
      showMsg('error', 'Error al eliminar evaluación');
    }
  }

  // ── Calificaciones ────────────────────────────────────────────────────────────

  async function fetchCalificaciones(grupoId: string) {
    setLoadingCals(true);
    try {
      const result = await apiFetch(`/maestro/grupo/${grupoId}/calificaciones`) as any;
      if (result.ok) setCalificaciones(result.data.items ?? []);
    } catch {
      showMsg('error', 'Error al cargar calificaciones');
    } finally {
      setLoadingCals(false);
    }
  }

  function getCalificacion(evalId: string, alumnoId: string): number | string {
    const key = `${evalId}#${alumnoId}`;
    if (key in gradeChanges) return gradeChanges[key] ?? '';
    const found = calificaciones.find(
      (c) => c.evaluacionId === evalId && c.alumnoId === alumnoId
    );
    return found?.calificacion ?? '';
  }

  function handleGradeChange(evalId: string, alumnoId: string, value: string) {
    const key = `${evalId}#${alumnoId}`;
    const num = value === '' ? null : parseFloat(value);
    setGradeChanges((prev) => ({ ...prev, [key]: num }));
  }

  async function handleSaveCalificaciones() {
    if (!selectedGrupo || Object.keys(gradeChanges).length === 0) return;
    setSavingCals(true);
    try {
      const saves = Object.entries(gradeChanges).map(async ([key, calificacion]) => {
        const [evalId, alumnoId] = key.split('#');
        return apiFetch('/maestro/calificaciones', {
          method: 'POST',
          body: JSON.stringify({
            evaluacionId: evalId,
            alumnoId,
            grupoId: selectedGrupo.grupoId,
            calificacion,
          }),
        });
      });
      await Promise.all(saves);
      // Refresh calificaciones
      await fetchCalificaciones(selectedGrupo.grupoId);
      setGradeChanges({});
      showMsg('success', 'Calificaciones guardadas');
    } catch {
      showMsg('error', 'Error al guardar calificaciones');
    } finally {
      setSavingCals(false);
    }
  }

  // ── Limits ────────────────────────────────────────────────────────────────────

  const limits = getLimits(planType);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis Grupos</h1>

      {/* Toast message */}
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: Grupos list */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 text-sm">Grupos</h2>
              <span className="text-xs text-gray-400">
                {grupos.length}/{limits.grupos === 999999 ? '∞' : limits.grupos}
              </span>
            </div>

            {loadingGrupos ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : grupos.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">
                Sin grupos aún
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {grupos.map((g) => (
                  <li key={g.grupoId}>
                    <button
                      onClick={() => selectGrupo(g)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between group ${
                        selectedGrupo?.grupoId === g.grupoId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            selectedGrupo?.grupoId === g.grupoId ? 'text-blue-700' : 'text-gray-800'
                          }`}
                        >
                          {g.nombre}
                        </p>
                        {g.grado && (
                          <p className="text-xs text-gray-400 mt-0.5">{g.grado}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteGrupo(g.grupoId); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        aria-label="Eliminar grupo"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* New grupo form */}
            {showNewGrupoForm ? (
              <form onSubmit={handleCreateGrupo} className="px-4 py-3 border-t border-gray-100 space-y-2">
                <input
                  type="text"
                  placeholder="Nombre del grupo *"
                  value={newGrupoNombre}
                  onChange={(e) => setNewGrupoNombre(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="text"
                  placeholder="Grado (ej. 4° Primaria)"
                  value={newGrupoGrado}
                  onChange={(e) => setNewGrupoGrado(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Ciclo escolar (ej. 2025-2026)"
                  value={newGrupoCiclo}
                  onChange={(e) => setNewGrupoCiclo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingGrupo}
                    className="flex-1 bg-blue-600 text-white text-sm py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                  >
                    {savingGrupo ? 'Guardando...' : 'Crear'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewGrupoForm(false)}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div className="px-4 py-3 border-t border-gray-100">
                <button
                  onClick={() => setShowNewGrupoForm(true)}
                  className="w-full flex items-center justify-center gap-2 text-sm text-blue-600 font-medium hover:bg-blue-50 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo grupo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Group detail panel */}
        <div className="flex-1 min-w-0">
          {!selectedGrupo ? (
            <div className="bg-white border border-gray-200 rounded-xl flex items-center justify-center py-20 text-gray-400">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="font-medium">Selecciona un grupo</p>
                <p className="text-sm mt-1">Elige un grupo de la lista para ver sus detalles</p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Group header */}
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900 text-lg">{selectedGrupo.nombre}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  {selectedGrupo.grado && <span>{selectedGrupo.grado}</span>}
                  {selectedGrupo.ciclo_escolar && <span>· {selectedGrupo.ciclo_escolar}</span>}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-100">
                {(['alumnos', 'calificaciones', 'evaluaciones'] as ActiveTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                      activeTab === tab
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {tab === 'alumnos' ? 'Alumnos' : tab === 'calificaciones' ? 'Calificaciones' : 'Evaluaciones'}
                    {tab === 'alumnos' && ` (${alumnos.length})`}
                    {tab === 'evaluaciones' && ` (${evaluaciones.length})`}
                  </button>
                ))}
              </div>

              {/* Tab: Alumnos */}
              {activeTab === 'alumnos' && (
                <div className="p-5">
                  {/* Add alumno form */}
                  <form onSubmit={handleAddAlumno} className="flex flex-col sm:flex-row gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Nombre *"
                      value={newAlumnoNombre}
                      onChange={(e) => setNewAlumnoNombre(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Apellido(s)"
                      value={newAlumnoApellido}
                      onChange={(e) => setNewAlumnoApellido(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={savingAlumno}
                      className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {savingAlumno ? <Spinner /> : 'Agregar'}
                    </button>
                  </form>

                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">
                      {alumnos.length} alumno{alumnos.length !== 1 ? 's' : ''} ·{' '}
                      Límite: {limits.alumnosPorGrupo === 999999 ? 'ilimitados' : limits.alumnosPorGrupo}
                    </p>
                  </div>

                  {loadingAlumnos ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : alumnos.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">Sin alumnos en este grupo</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {alumnos.map((a) => (
                        <div key={a.alumnoId} className="flex items-center justify-between py-2.5">
                          <span className="text-sm text-gray-800">
                            {a.apellido ? `${a.apellido}, ${a.nombre}` : a.nombre}
                          </span>
                          <button
                            onClick={() => handleDeleteAlumno(a.alumnoId)}
                            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                            aria-label="Eliminar alumno"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Evaluaciones */}
              {activeTab === 'evaluaciones' && (
                <div className="p-5">
                  {/* Add evaluacion form */}
                  <form onSubmit={handleAddEvaluacion} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
                    <input
                      type="text"
                      placeholder="Nombre de la evaluación *"
                      value={newEvalNombre}
                      onChange={(e) => setNewEvalNombre(e.target.value)}
                      className="sm:col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      type="date"
                      value={newEvalFecha}
                      onChange={(e) => setNewEvalFecha(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <select
                        value={newEvalTipo}
                        onChange={(e) => setNewEvalTipo(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="examen">Examen</option>
                        <option value="tarea">Tarea</option>
                        <option value="proyecto">Proyecto</option>
                        <option value="participacion">Participación</option>
                      </select>
                      <button
                        type="submit"
                        disabled={savingEval}
                        className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                      >
                        {savingEval ? <Spinner /> : 'Crear'}
                      </button>
                    </div>
                  </form>

                  <p className="text-xs text-gray-500 mb-2">
                    {evaluaciones.length} evaluaci{evaluaciones.length !== 1 ? 'ones' : 'ón'} ·{' '}
                    Límite: {limits.evaluacionesPorGrupo === 999999 ? 'ilimitadas' : limits.evaluacionesPorGrupo}
                  </p>

                  {loadingEvals ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : evaluaciones.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">Sin evaluaciones</p>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {evaluaciones.map((ev) => (
                        <div key={ev.evaluacionId} className="flex items-center justify-between py-2.5">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{ev.nombre}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {ev.tipo} · {ev.fecha}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteEvaluacion(ev.evaluacionId)}
                            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                            aria-label="Eliminar evaluación"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Calificaciones */}
              {activeTab === 'calificaciones' && (
                <div className="p-5">
                  {loadingCals || loadingAlumnos || loadingEvals ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : alumnos.length === 0 || evaluaciones.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-8">
                      {alumnos.length === 0
                        ? 'Agrega alumnos para registrar calificaciones'
                        : 'Crea evaluaciones para registrar calificaciones'}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left py-2 pr-4 font-semibold text-gray-700 whitespace-nowrap sticky left-0 bg-white">
                                Alumno
                              </th>
                              {evaluaciones.map((ev) => (
                                <th
                                  key={ev.evaluacionId}
                                  className="text-center py-2 px-2 font-semibold text-gray-700 whitespace-nowrap min-w-[90px]"
                                  title={`${ev.tipo} · ${ev.fecha}`}
                                >
                                  {ev.nombre}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {alumnos.map((alumno) => (
                              <tr key={alumno.alumnoId} className="border-b border-gray-50">
                                <td className="py-2 pr-4 text-gray-800 whitespace-nowrap sticky left-0 bg-white">
                                  {alumno.apellido
                                    ? `${alumno.apellido}, ${alumno.nombre}`
                                    : alumno.nombre}
                                </td>
                                {evaluaciones.map((ev) => (
                                  <td key={ev.evaluacionId} className="py-1 px-2 text-center">
                                    <input
                                      type="number"
                                      min={0}
                                      max={10}
                                      step={0.5}
                                      value={getCalificacion(ev.evaluacionId, alumno.alumnoId)}
                                      onChange={(e) =>
                                        handleGradeChange(ev.evaluacionId, alumno.alumnoId, e.target.value)
                                      }
                                      className="w-16 text-center border border-gray-200 rounded px-1 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      placeholder="—"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Save button */}
                      <div className="mt-4 flex justify-end">
                        <button
                          onClick={handleSaveCalificaciones}
                          disabled={savingCals || Object.keys(gradeChanges).length === 0}
                          className="flex items-center gap-2 bg-blue-600 text-white text-sm px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                        >
                          {savingCals && <Spinner />}
                          Guardar calificaciones
                          {Object.keys(gradeChanges).length > 0 && (
                            <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                              {Object.keys(gradeChanges).length}
                            </span>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upgrade modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeature}
        plan_type={planType}
      />
    </div>
  );
}

export default function GruposPage() {
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
      <GruposContent />
    </Suspense>
  );
}
