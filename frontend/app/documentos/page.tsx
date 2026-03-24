'use client';

import Link from 'next/link';

export default function DocumentosPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Volver al Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">📄 Documentos</h1>
        <p className="text-gray-600 mb-8">Plantillas de oficios, circulares y reportes</p>

        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-400 text-lg mb-2">Próximamente</p>
          <p className="text-gray-400 text-sm">
            Plantillas y documentos administrativos disponibles pronto.
          </p>
        </div>
      </div>
    </div>
  );
}
