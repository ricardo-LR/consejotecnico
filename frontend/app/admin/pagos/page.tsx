'use client';

import { useEffect, useState } from 'react';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface Purchase {
  purchaseId:  string;
  email:       string;
  planType:    string;
  price:       string;
  status:      string;
  grado?:      string;
  createdAt:   string;
  sandboxMode: boolean;
}

type StatusFilter = 'ALL' | 'COMPLETED' | 'PENDING' | 'FAILED';

export default function AdminPagosPage() {
  const [items,    setItems]    = useState<Purchase[]>([]);
  const [filter,   setFilter]   = useState<StatusFilter>('ALL');
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function fetchPurchases() {
      const token = localStorage.getItem('admin_token') ?? '';
      try {
        const res  = await fetch(`${API_URL}/admin/purchases`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.ok ? await res.json() : { items: [] };
        setItems(data.items ?? []);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }
    fetchPurchases();
  }, []);

  const filtered = filter === 'ALL' ? items : items.filter((p) => p.status === filter);

  const totalRevenue = items
    .filter((p) => p.status === 'COMPLETED')
    .reduce((s, p) => s + (parseFloat(p.price) || 0), 0);

  const statusColor = (s: string) => {
    if (s === 'COMPLETED') return 'bg-green-100 text-green-700';
    if (s === 'PENDING')   return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
        <span className="text-sm font-semibold text-emerald-700">
          Ingresos confirmados: ${totalRevenue.toFixed(2)} MXN
        </span>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['ALL', 'COMPLETED', 'PENDING', 'FAILED'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'ALL' ? 'Todos' : s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando pagos...</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium">Email</th>
                <th className="px-6 py-3 text-left font-medium">Plan</th>
                <th className="px-6 py-3 text-left font-medium">Grado</th>
                <th className="px-6 py-3 text-left font-medium">Monto</th>
                <th className="px-6 py-3 text-left font-medium">Estado</th>
                <th className="px-6 py-3 text-left font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    Sin pagos{filter !== 'ALL' ? ` con estado ${filter}` : ''}.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.purchaseId} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-800">{p.email}</td>
                    <td className="px-6 py-3 capitalize text-gray-600">{p.planType}</td>
                    <td className="px-6 py-3 text-gray-500">{p.grado || '—'}</td>
                    <td className="px-6 py-3 font-medium text-gray-900">${parseFloat(p.price || '0').toFixed(2)}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-400">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-MX') : '—'}
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
