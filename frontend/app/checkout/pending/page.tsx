export default function CheckoutPending() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#fffbeb',
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
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>⏳</div>
        <h1 style={{ color: '#d97706', marginBottom: '0.5rem' }}>
          Pago en proceso
        </h1>
        <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
          Tu pago está siendo procesado. Te notificaremos cuando se confirme.
        </p>
        <a
          href="/maestro/dashboard"
          style={{
            display: 'inline-block',
            backgroundColor: '#d97706',
            color: 'white',
            padding: '0.875rem 2.5rem',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '1rem',
          }}
        >
          Ir al Dashboard
        </a>
      </div>
    </div>
  );
}
