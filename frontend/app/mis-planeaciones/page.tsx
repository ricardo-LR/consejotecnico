'use client';

import Link from 'next/link';

export default function MisPlaneacionesPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Volver al Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">📖 Planeaciones</h1>
        <p className="text-gray-600 mb-8">Planeaciones por grado y asignatura</p>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-400 text-lg mb-2">Próximamente</p>
          <p className="text-gray-400 text-sm mb-6">
            Aquí aparecerán tus planeaciones descargadas.
          </p>
          <Link
            href="/catalog"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Ver catálogo de planeaciones
          </Link>
        </div>
      </div>
    </div>
  );
}
