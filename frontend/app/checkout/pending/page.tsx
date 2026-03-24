'use client';

export default function CheckoutPending() {
  return (
    <div className="min-h-screen bg-yellow-50 flex items-center justify-center px-4">
      <div className="text-center p-8 max-w-md">
        <div className="text-6xl mb-4">⏳</div>
        <h1 className="text-3xl font-bold text-yellow-700 mb-4">
          Pago en revisión
        </h1>
        <p className="text-gray-600 mb-3">
          Tu pago está siendo procesado. Esto puede tardar unos minutos.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Recibirás un correo de confirmación cuando se acredite.
          Tu plan se activará automáticamente.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/maestro/dashboard"
            className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Ir a Mi Dashboard
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
