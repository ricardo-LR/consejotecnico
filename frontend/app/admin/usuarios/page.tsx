'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface User {
  email:     string;
  nombre:    string;
  plan_type: string;
  grado?:    string;
  createdAt: string;
  active?:   boolean;
}

export default function AdminUsuariosPage() {
  const [users,   setUsers]   = useState<User[]>([]);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      const token = localStorage.getItem('admin_token') ?? '';
      try {
        const res  = await fetch(`${API_URL}/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.ok ? await res.json() : { items: [] };
        setUsers(data.items ?? []);
      } catch {
        setUsers([]);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const filtered = users.filter((u) =>
    u.email.includes(search.toLowerCase()) ||
    (u.nombre ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const planBadge = (plan: string) => {
    const map: Record<string, string> = {
      grado:    'bg-green-100 text-green-700',
      pro:      'bg-purple-100 text-purple-700',
      gratuito: 'bg-gray-100 text-gray-600',
    };
    return map[plan] ?? 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <span className="text-sm text-gray-500">{filtered.length} usuarios</span>
      </div>

      <input
        type="search"
        placeholder="Buscar por email o nombre..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando usuarios...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium">Email</th>
                <th className="px-6 py-3 text-left font-medium">Nombre</th>
                <th className="px-6 py-3 text-left font-medium">Plan</th>
                <th className="px-6 py-3 text-left font-medium">Grado</th>
                <th className="px-6 py-3 text-left font-medium">Registro</th>
                <th className="px-6 py-3 text-left font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Sin usuarios.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.email} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-800 font-medium">{u.email}</td>
                    <td className="px-6 py-3 text-gray-600">{u.nombre || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${planBadge(u.plan_type)}`}>
                        {u.plan_type || 'gratuito'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-500">{u.grado || '—'}</td>
                    <td className="px-6 py-3 text-gray-400">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-MX') : '—'}
                    </td>
                    <td className="px-6 py-3">
                      <Link
                        href={`/admin/usuarios/edit?email=${encodeURIComponent(u.email)}`}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        Editar plan
                      </Link>
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
