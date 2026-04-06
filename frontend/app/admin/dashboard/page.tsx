'use client';

import { useEffect, useState } from 'react';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface Stats {
  totalUsuarios:        number;
  usuariosGrado:        number;
  usuariosProMaestro:   number;
  usuariosProDirectivo: number;
  usuariosGratis:       number;
  totalPagos:           number;
  ingresoTotal:         number;
}

interface Transaction {
  purchaseId: string;
  email:      string;
  planType:   string;
  status:     string;
  createdAt:  string;
}

export default function AdminDashboardPage() {
  const [stats, setStats]  = useState<Stats | null>(null);
  const [txns,  setTxns]   = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const token = localStorage.getItem('admin_token') ?? '';
      try {
        const [usersRes, purchasesRes] = await Promise.all([
          fetch(`${API_URL}/admin/users`,     { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/admin/purchases`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const users     = usersRes.ok     ? await usersRes.json()     : { items: [] };
        const purchases = purchasesRes.ok ? await purchasesRes.json() : { items: [] };

        const ul = users.items ?? [];
        const pl = purchases.items ?? [];

        const PRECIO_PLAN: Record<string, number> = { grado: 499, pro_maestro: 999, pro_directivo: 999, pro: 999 };
        setStats({
          totalUsuarios:        ul.length,
          usuariosGrado:        ul.filter((u: any) => u.plan_type === 'grado').length,
          usuariosProMaestro:   ul.filter((u: any) => ['pro_maestro', 'pro'].includes(u.plan_type)).length,
          usuariosProDirectivo: ul.filter((u: any) => u.plan_type === 'pro_directivo').length,
          usuariosGratis:       ul.filter((u: any) => !u.plan_type || u.plan_type === 'gratuito').length,
          totalPagos:           pl.length,
          ingresoTotal:         pl.filter((p: any) => p.status === 'COMPLETED').reduce((s: number, p: any) => s + (PRECIO_PLAN[p.planType] || 0), 0),
        });
        setTxns(pl.slice(0, 10));
      } catch {
        // show zeros on error
        setStats({ totalUsuarios: 0, usuariosGrado: 0, usuariosProMaestro: 0, usuariosProDirectivo: 0, usuariosGratis: 0, totalPagos: 0, ingresoTotal: 0 });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const STAT_CARDS = stats
    ? [
        { label: 'Total Usuarios',    value: stats.totalUsuarios,                    color: 'bg-blue-50 text-blue-700'    },
        { label: 'Plan Grado',        value: stats.usuariosGrado,                    color: 'bg-green-50 text-green-700'  },
        { label: 'Pro Maestro',       value: stats.usuariosProMaestro,               color: 'bg-purple-50 text-purple-700' },
        { label: 'Pro Directivo',     value: stats.usuariosProDirectivo,             color: 'bg-indigo-50 text-indigo-700' },
        { label: 'Plan Gratis',       value: stats.usuariosGratis,                   color: 'bg-gray-50 text-gray-700'    },
        { label: 'Total Pagos',       value: stats.totalPagos,                       color: 'bg-yellow-50 text-yellow-700' },
        { label: 'Ingresos (MXN)',    value: `$${stats.ingresoTotal.toLocaleString('es-MX')}`, color: 'bg-emerald-50 text-emerald-700' },
      ]
    : [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {loading ? (
        <p className="text-gray-400 text-sm">Cargando estadísticas...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {STAT_CARDS.map(({ label, value, color }) => (
              <div key={label} className={`rounded-xl p-5 ${color}`}>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
                <p className="text-3xl font-bold mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Últimas transacciones</h2>
            </div>
            {txns.length === 0 ? (
              <p className="px-6 py-8 text-sm text-gray-400">Sin transacciones aún.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                    <th className="px-6 py-3 text-left font-medium">Email</th>
                    <th className="px-6 py-3 text-left font-medium">Plan</th>
                    <th className="px-6 py-3 text-left font-medium">Monto</th>
                    <th className="px-6 py-3 text-left font-medium">Estado</th>
                    <th className="px-6 py-3 text-left font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {txns.map((t) => (
                    <tr key={t.purchaseId} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-800">{t.email}</td>
                      <td className="px-6 py-3 capitalize">{t.planType}</td>
                      <td className="px-6 py-3">${({ grado: 499, pro_maestro: 999, pro_directivo: 999, pro: 999 } as Record<string,number>)[t.planType] ?? '—'} MXN</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          t.status === 'PENDING'   ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString('es-MX') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
