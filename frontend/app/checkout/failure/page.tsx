'use client';

export default function CheckoutFailure() {
  return (
    <div className="min-h-screen bg-red-50 flex items-center justify-center px-4">
      <div className="text-center p-8 max-w-md">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-3xl font-bold text-red-700 mb-4">
          Pago no procesado
        </h1>
        <p className="text-gray-600 mb-3">
          No se pudo completar el pago. Puede haber sido rechazado
          o cancelado.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          No se realizó ningún cargo. Puedes intentarlo de nuevo.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/checkout?plan=grado"
            className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Intentar de nuevo
          </a>
          <a
            href="/pricing"
            className="inline-block px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Ver Planes
          </a>
        </div>
      </div>
    </div>
  );
}
