'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

const GRADOS = [
  { id: 'preescolar', label: 'Preescolar'  },
  { id: '1',          label: '1° Primaria' },
  { id: '2',          label: '2° Primaria' },
  { id: '3',          label: '3° Primaria' },
  { id: '4',          label: '4° Primaria' },
  { id: '5',          label: '5° Primaria' },
  { id: '6',          label: '6° Primaria' },
];

interface User {
  email:     string;
  nombre:    string;
  plan_type: string;
  grado?:    string;
  createdAt: string;
}

function EditUserContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const email        = searchParams.get('email') ?? '';

  const [user,     setUser]     = useState<User | null>(null);
  const [planType, setPlanType] = useState('gratuito');
  const [grado,    setGrado]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [message,  setMessage]  = useState('');
  const [error,    setError]    = useState('');

  useEffect(() => {
    if (!email) {
      router.replace('/admin/usuarios');
      return;
    }
    async function fetchUser() {
      const token = localStorage.getItem('admin_token') ?? '';
      try {
        const res  = await fetch(`${API_URL}/admin/users?email=${encodeURIComponent(email)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.ok ? await res.json() : null;
        const u    = data?.item ?? null;
        if (u) {
          setUser(u);
          setPlanType(u.plan_type ?? 'gratuito');
          setGrado(u.grado ?? '');
        }
      } catch {
        setError('No se pudo cargar el usuario.');
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [email, router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (planType === 'grado' && !grado) {
      setError('Selecciona el grado.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    const token = localStorage.getItem('admin_token') ?? '';
    try {
      const res = await fetch(`${API_URL}/admin/change-plan`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({ email, plan_type: planType, grado }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar');
      setMessage('Plan actualizado correctamente.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  }

  if (!email) return null;

  if (loading) {
    return <div className="p-8 text-gray-400 text-sm">Cargando usuario...</div>;
  }

  return (
    <div className="p-8 max-w-lg">
      <div className="mb-6">
        <Link href="/admin/usuarios" className="text-sm text-blue-600 hover:underline">
          ← Volver a Usuarios
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Editar Plan</h1>
      <p className="text-sm text-gray-500 mb-6">{email}</p>

      {user && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm text-gray-700 space-y-1">
          <p><span className="font-medium">Nombre:</span> {user.nombre || '—'}</p>
          <p><span className="font-medium">Plan actual:</span> {user.plan_type || 'gratuito'}</p>
          {user.grado && <p><span className="font-medium">Grado:</span> {user.grado}</p>}
          <p>
            <span className="font-medium">Registro:</span>{' '}
            {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-MX') : '—'}
          </p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nuevo plan</label>
          <div className="space-y-2">
            {(['gratuito', 'grado', 'pro'] as const).map((p) => (
              <label
                key={p}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  planType === p ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="plan_type"
                  value={p}
                  checked={planType === p}
                  onChange={() => { setPlanType(p); if (p !== 'grado') setGrado(''); }}
                  className="accent-blue-600"
                />
                <span className="text-sm font-medium capitalize text-gray-900">{p}</span>
              </label>
            ))}
          </div>
        </div>

        {planType === 'grado' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Grado</label>
            <div className="grid grid-cols-2 gap-2">
              {GRADOS.map(({ id, label }) => (
                <label
                  key={id}
                  className={`flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer text-sm transition-colors ${
                    grado === id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="grado"
                    value={id}
                    checked={grado === id}
                    onChange={() => setGrado(id)}
                    className="accent-blue-600"
                  />
                  <span className="font-medium text-gray-900">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}
        {message && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{message}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}

export default function AdminUsuarioEditPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Cargando...</div>}>
      <EditUserContent />
    </Suspense>
  );
}
