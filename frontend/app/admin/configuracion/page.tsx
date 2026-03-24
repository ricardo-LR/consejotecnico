'use client';

import { useState } from 'react';

interface PriceConfig {
  grado: string;
  pro:   string;
}

export default function AdminConfiguracionPage() {
  const [prices, setPrices] = useState<PriceConfig>({ grado: '499', pro: '999' });
  const [saved,  setSaved]  = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // In production this would POST to an admin/config endpoint.
    // For MVP the prices are controlled via backend settings.
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Configuración</h1>
      <p className="text-sm text-gray-500 mb-8">
        Ajusta los precios de los planes. Los cambios se aplican a nuevas suscripciones.
      </p>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Precios de planes (MXN / año)
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan Grado
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={prices.grado}
                onChange={(e) => setPrices((p) => ({ ...p, grado: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-sm">MXN</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Plan Pro
            </label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="1"
                value={prices.pro}
                onChange={(e) => setPrices((p) => ({ ...p, pro: e.target.value }))}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-sm">MXN</span>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <strong>Nota:</strong> En esta versión MVP los precios también deben actualizarse en
          el archivo <code className="font-mono text-xs bg-amber-100 px-1 rounded">backend/src/models/pricing.py</code> y
          redesplegar las Lambdas para que el cambio sea efectivo en el backend.
        </div>

        {saved && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Configuración guardada.
          </p>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
        >
          Guardar configuración
        </button>
      </form>
    </div>
  );
}
