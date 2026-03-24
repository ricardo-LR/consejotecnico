'use client';

import { useEffect, useState } from 'react';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface MonthData {
  mes:      string;
  ingresos: number;
  pagos:    number;
  usuarios: number;
}

export default function AdminReportesPage() {
  const [byMonth, setByMonth] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const token = localStorage.getItem('admin_token') ?? '';
      try {
        const [usersRes, purchasesRes] = await Promise.all([
          fetch(`${API_URL}/admin/users`,     { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/admin/purchases`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const users     = usersRes.ok     ? (await usersRes.json()).items     ?? [] : [];
        const purchases = purchasesRes.ok ? (await purchasesRes.json()).items ?? [] : [];

        // Group by month
        const map: Record<string, MonthData> = {};

        for (const p of purchases) {
          if (!p.createdAt) continue;
          const mes = p.createdAt.slice(0, 7); // YYYY-MM
          if (!map[mes]) map[mes] = { mes, ingresos: 0, pagos: 0, usuarios: 0 };
          map[mes].pagos++;
          if (p.status === 'COMPLETED') map[mes].ingresos += parseFloat(p.price || '0');
        }

        for (const u of users) {
          if (!u.createdAt) continue;
          const mes = u.createdAt.slice(0, 7);
          if (!map[mes]) map[mes] = { mes, ingresos: 0, pagos: 0, usuarios: 0 };
          map[mes].usuarios++;
        }

        const sorted = Object.values(map).sort((a, b) => b.mes.localeCompare(a.mes));
        setByMonth(sorted);
      } catch {
        setByMonth([]);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reportes</h1>

      {loading ? (
        <p className="text-gray-400 text-sm">Calculando reportes...</p>
      ) : byMonth.length === 0 ? (
        <p className="text-gray-400 text-sm">Sin datos suficientes para generar reportes.</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Resumen por mes</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b border-gray-100">
                <th className="px-6 py-3 text-left font-medium">Mes</th>
                <th className="px-6 py-3 text-left font-medium">Nuevos usuarios</th>
                <th className="px-6 py-3 text-left font-medium">Pagos</th>
                <th className="px-6 py-3 text-left font-medium">Ingresos (MXN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {byMonth.map((row) => (
                <tr key={row.mes} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-800">{row.mes}</td>
                  <td className="px-6 py-3 text-gray-600">{row.usuarios}</td>
                  <td className="px-6 py-3 text-gray-600">{row.pagos}</td>
                  <td className="px-6 py-3 font-semibold text-emerald-700">
                    ${row.ingresos.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
