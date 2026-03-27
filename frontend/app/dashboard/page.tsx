'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UserProfile {
  email: string;
  nombre?: string;
  plan_type?: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    console.log('[DASHBOARD] ════════════════════════════════════════');
    console.log('[DASHBOARD] Iniciando Dashboard');
    console.log('[DASHBOARD] ════════════════════════════════════════');

    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    const planType = localStorage.getItem('plan_type');

    console.log('[DASHBOARD] localStorage.token:', token ? `${token.substring(0, 30)}...` : 'NULL');
    console.log('[DASHBOARD] localStorage.user:', userStr ? 'EXISTE' : 'NULL');
    console.log('[DASHBOARD] localStorage.plan_type:', planType ?? 'NULL');

    setDebugInfo(
      `localStorage:\n- token: ${token ? 'SI' : 'NO'}\n- user: ${userStr ? 'SI' : 'NO'}\n- plan_type: ${planType ?? 'NO'}`
    );

    if (!token) {
      console.log('[DASHBOARD] ❌ SIN TOKEN - Redirigiendo a login');
      setError('No hay token en localStorage');
      setLoading(false);
      setTimeout(() => router.push('/auth/login'), 1000);
      return;
    }

    console.log('[DASHBOARD] ✅ Token encontrado en localStorage');

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev';
    console.log('[DASHBOARD] API URL:', apiUrl);
    console.log('[DASHBOARD] 📡 Haciendo fetch a /auth/me');

    fetch(`${apiUrl}/auth/me`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        console.log('[DASHBOARD] Response status:', res.status);

        const text = await res.text();
        console.log('[DASHBOARD] Response body:', text.substring(0, 200));

        let data: Record<string, unknown>;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('[DASHBOARD] ❌ Error parsing JSON:', (e as Error).message);
          setError('Error parseando respuesta del servidor');
          setLoading(false);
          return null;
        }

        if (res.status === 401) {
          console.log('[DASHBOARD] ❌ Status 401 - Token inválido');
          localStorage.removeItem('token');
          setError('Token inválido o expirado (401)');
          setLoading(false);
          setTimeout(() => router.push('/auth/login'), 1500);
          return null;
        }

        if (res.status === 404) {
          console.log('[DASHBOARD] ❌ Status 404 - /auth/me no existe');
          setError('Endpoint /auth/me no encontrado (404)');
          setLoading(false);
          return null;
        }

        if (!res.ok) {
          console.log('[DASHBOARD] ❌ Status no OK:', res.status);
          setError(`Error ${res.status}: ${String(data.error ?? data.message ?? 'desconocido')}`);
          setLoading(false);
          return null;
        }

        console.log('[DASHBOARD] ✅ Status 200 OK');
        return data as unknown as UserProfile;
      })
      .then((data) => {
        if (!data) return;
        console.log('[DASHBOARD] ✅ Usuario encontrado');
        console.log('[DASHBOARD] Email:', data.email);
        console.log('[DASHBOARD] Nombre:', data.nombre);
        setUser(data);
        console.log('[DASHBOARD] ✅ setUser() ejecutado');
      })
      .catch((err: Error) => {
        console.error('[DASHBOARD] ❌ EXCEPCIÓN:', err.message);
        setError(`Error: ${err.message}`);
      })
      .finally(() => {
        console.log('[DASHBOARD] Loading = false');
        setLoading(false);
        console.log('[DASHBOARD] ════════════════════════════════════════');
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="mb-4">Cargando dashboard...</p>
          <details className="text-left text-xs text-gray-600 bg-gray-100 p-4 rounded">
            <summary>Debug Info</summary>
            <pre>{debugInfo}</pre>
          </details>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-bold text-lg mb-4">❌ Error</p>
          <p className="text-gray-600 mb-6">{error}</p>
          <details className="text-left text-xs text-gray-600 bg-red-50 p-4 rounded mb-6">
            <summary>Debug Info</summary>
            <pre>{debugInfo}</pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">No autorizado - Sin datos de usuario</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 py-8 px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            ¡Hola, {user.nombre || user.email}!
          </h1>
          <p className="text-gray-600">{user.email}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-8 mb-8 text-white">
          <h2 className="text-2xl font-bold mb-2">📚 Mi Workspace</h2>
          <p className="mb-6 text-blue-100">Accede a tu espacio de trabajo</p>
          <Link
            href="/maestro/dashboard"
            className="inline-block px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50"
          >
            Ir al Workspace →
          </Link>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📋 Mis Recursos</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/directivo/cte">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg cursor-pointer">
                <div className="text-4xl mb-4">🎓</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Consejo Técnico Escolar</h3>
                <p className="text-gray-600 text-sm">Sesiones CTE descargables</p>
              </div>
            </Link>

            <Link href="/mis-planeaciones">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg cursor-pointer">
                <div className="text-4xl mb-4">📖</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Planeaciones</h3>
                <p className="text-gray-600 text-sm">Por grado y asignatura</p>
              </div>
            </Link>

            <Link href="/documentos">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg cursor-pointer">
                <div className="text-4xl mb-4">📄</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Documentos</h3>
                <p className="text-gray-600 text-sm">Plantillas y circulares</p>
              </div>
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">⚡ Accesos Rápidos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/maestro/grupos">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-md cursor-pointer flex items-start space-x-4">
                <div className="text-3xl">👥</div>
                <div>
                  <h3 className="font-bold text-gray-900">Mis Grupos</h3>
                  <p className="text-gray-600 text-sm">Gestiona tus grupos</p>
                </div>
              </div>
            </Link>

            <Link href="/maestro/dashboard">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-md cursor-pointer flex items-start space-x-4">
                <div className="text-3xl">📊</div>
                <div>
                  <h3 className="font-bold text-gray-900">Evaluaciones</h3>
                  <p className="text-gray-600 text-sm">Registra calificaciones</p>
                </div>
              </div>
            </Link>

            <Link href="/maestro/diario">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-md cursor-pointer flex items-start space-x-4">
                <div className="text-3xl">📝</div>
                <div>
                  <h3 className="font-bold text-gray-900">Diario de Clase</h3>
                  <p className="text-gray-600 text-sm">Anota actividades</p>
                </div>
              </div>
            </Link>

            <Link href="/maestro/recursos">
              <div className="bg-white rounded-lg shadow p-6 hover:shadow-md cursor-pointer flex items-start space-x-4">
                <div className="text-3xl">🎬</div>
                <div>
                  <h3 className="font-bold text-gray-900">Recursos Multimedia</h3>
                  <p className="text-gray-600 text-sm">Videos y materiales</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
