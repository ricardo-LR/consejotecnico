'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/maestro/dashboard';

  const [email, setEmail]       = useState('test@mercadopago.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      console.log('[LOGIN] ════════════════════════════════════════');
      console.log('[LOGIN] Iniciando login');
      console.log('[LOGIN] Email:', email);
      console.log('[LOGIN] API URL:', apiUrl);
      console.log('[LOGIN] Redirect destino:', redirect);

      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });

      console.log('[LOGIN] Response status:', res.status);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error('[LOGIN] ❌ Error response:', errorData);
        setError(
          (errorData as { message?: string; error?: string }).message ||
          (errorData as { message?: string; error?: string }).error ||
          `Error ${res.status}`
        );
        setLoading(false);
        return;
      }

      const data = await res.json();
      console.log('[LOGIN] ✅ Response OK');
      console.log('[LOGIN] Data recibida:', {
        token:     data.token     ? '✅ SI' : '❌ NO',
        user:      data.user      ? '✅ SI' : '❌ NO',
        plan_type: data.plan_type ? `✅ ${data.plan_type}` : '❌ NO',
      });

      if (!data.token) {
        console.error('[LOGIN] ❌ Server no envió token');
        setError('Servidor no envió token');
        setLoading(false);
        return;
      }

      console.log('[LOGIN] 💾 Guardando en localStorage...');

      localStorage.setItem('token', data.token);
      console.log('[LOGIN]   ✅ token guardado:', data.token.substring(0, 30) + '...');

      const userEmail = data.email ?? email;
      localStorage.setItem('email', userEmail);
      console.log('[LOGIN]   ✅ email guardado:', userEmail);

      // API devuelve email/nombre/plan_type como campos planos (no dentro de data.user)
      const userObj = {
        email:     userEmail,
        nombre:    data.nombre    ?? '',
        plan_type: data.plan_type ?? 'gratuito',
      };
      localStorage.setItem('user', JSON.stringify(userObj));
      console.log('[LOGIN]   ✅ user guardado:', userObj.email, '| plan:', userObj.plan_type);

      localStorage.setItem('plan_type', data.plan_type ?? 'gratuito');
      console.log('[LOGIN]   ✅ plan_type guardado:', data.plan_type ?? 'gratuito');

      // Verificación post-guardado
      console.log('[LOGIN] 🔍 Verificando localStorage...');
      const verifyToken = localStorage.getItem('token');
      const verifyUser  = localStorage.getItem('user');
      const verifyPlan  = localStorage.getItem('plan_type');

      console.log('[LOGIN]   token  en localStorage:', verifyToken ? '✅ SI' : '❌ NO');
      console.log('[LOGIN]   user   en localStorage:', verifyUser  ? '✅ SI' : '❌ NO');
      console.log('[LOGIN]   plan   en localStorage:', verifyPlan  ? `✅ ${verifyPlan}` : '❌ NO');

      if (!verifyToken) {
        throw new Error('Token no se guardó en localStorage');
      }

      console.log('[LOGIN] ✅ TODO GUARDADO CORRECTAMENTE');
      console.log('[LOGIN] Redirigiendo a:', redirect);
      console.log('[LOGIN] ════════════════════════════════════════');

      router.push(redirect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[LOGIN] ❌ Excepción:', msg);
      setError('Error: ' + msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded text-white flex items-center justify-center font-bold text-sm">
              CT
            </div>
            <span className="font-bold text-gray-900">CONSEJOTECNICO</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Iniciar sesión</h1>
          <p className="text-gray-600 mt-2">Accede a tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              ❌ {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              placeholder="Ingresa tu contraseña"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {loading ? '⏳ Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-sm mt-6">
          ¿No tienes cuenta?{' '}
          <Link href="/auth/register" className="text-blue-600 font-semibold hover:text-blue-700">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
