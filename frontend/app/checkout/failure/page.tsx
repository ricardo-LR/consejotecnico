export default function CheckoutFailure() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fef2f2',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        maxWidth: '480px',
        backgroundColor: 'white',
        borderRadius: '1rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>❌</div>
        <h1 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>
          Pago no completado
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
          Hubo un problema con tu pago. Puedes intentarlo de nuevo.
        </p>
        <a
          href="/catalogo"
          style={{
            display: 'inline-block',
            backgroundColor: '#dc2626',
            color: 'white',
            padding: '0.875rem 2.5rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '1rem',
          }}
        >
          Intentar de nuevo
        </a>
      </div>
    </div>
  );
}
