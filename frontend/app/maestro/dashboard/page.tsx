'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';

interface Grupo {
  grupoId: string;
  nombre: string;
}

interface Stats {
  grupos: number;
  alumnos: number;
  evaluaciones: number;
}

function StatCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      {loading ? (
        <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      )}
    </div>
  );
}

export default function MaestroDashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [planType, setPlanType] = useState('gratuito');
  const [stats, setStats] = useState<Stats>({ grupos: 0, alumnos: 0, evaluaciones: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/auth/login');
      return;
    }
    setEmail(localStorage.getItem('email') ?? '');
    setPlanType(localStorage.getItem('plan_type') ?? 'gratuito');
    fetchStats(token);
  }, [router]);

  async function fetchStats(token: string) {
    setLoading(true);
    setError('');
    try {
      const gruposRes = await fetch(`${API_URL}/maestro/grupos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!gruposRes.ok) throw new Error('Error al cargar grupos');
      const gruposData = await gruposRes.json();
      const grupos: Grupo[] = gruposData.items ?? [];

      // Fetch alumnos count per group in parallel
      let totalAlumnos = 0;
      await Promise.all(
        grupos.map(async (g) => {
          try {
            const res = await fetch(`${API_URL}/maestro/grupo/${g.grupoId}/alumnos`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              totalAlumnos += data.count ?? 0;
            }
          } catch {
            // skip individual group errors
          }
        })
      );

      // Fetch evaluaciones count per group in parallel
      let totalEvaluaciones = 0;
      await Promise.all(
        grupos.map(async (g) => {
          try {
            const res = await fetch(`${API_URL}/maestro/grupo/${g.grupoId}/evaluaciones`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json();
              totalEvaluaciones += data.count ?? 0;
            }
          } catch {
            // skip
          }
        })
      );

      setStats({ grupos: grupos.length, alumnos: totalAlumnos, evaluaciones: totalEvaluaciones });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Hola{email ? `, ${email.split('@')[0]}` : ''}!
        </h1>
        <p className="text-gray-500 text-sm mt-1">{email}</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Mis grupos" value={stats.grupos} loading={loading} />
        <StatCard label="Total alumnos" value={stats.alumnos} loading={loading} />
        <StatCard label="Evaluaciones" value={stats.evaluaciones} loading={loading} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/maestro/grupos"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">Mis Grupos</h3>
          </div>
          <p className="text-sm text-gray-500">Gestiona alumnos, evaluaciones y calificaciones</p>
        </Link>

        <Link
          href={planType !== 'gratuito' ? '/maestro/diario' : '/checkout?plan=grado'}
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600 group-hover:bg-green-100 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">Diario de Clase</h3>
              {planType === 'gratuito' && (
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">Premium</span>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500">Registra actividades y asistencia diaria</p>
        </Link>
      </div>

      {/* Upgrade CTA for gratuito */}
      {planType === 'gratuito' && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white">
          <h2 className="text-lg font-bold mb-1">Desbloquea el Plan Grado</h2>
          <p className="text-blue-100 text-sm mb-4">
            Accede a diario de clase, recursos didácticos, hasta 3 grupos y funciones de exportación.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/checkout?plan=grado"
              className="inline-block bg-white text-blue-600 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-50 transition-colors text-center"
            >
              Ver Plan Grado — $199/mes
            </Link>
            <Link
              href="/checkout?plan=pro"
              className="inline-block bg-blue-500 text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-400 transition-colors text-center border border-blue-400"
            >
              Ver Plan Pro — $349/mes
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
