import PdfDownloader from '../components/PdfDownloader';
import SignatureVerifier from '../components/SignatureVerifier';
import authService from '../services/authService';

export default function VerifierPage() {
  const handleLogout = () => {
    authService.logout();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <header style={{
        background: '#4caf50',
        color: 'white',
        padding: '20px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h1 style={{ margin: 0 }}>👑 System Podpisów PDF - Administrator</h1>
          <button
            onClick={handleLogout}
            style={{
              background: '#ff4444',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Wyloguj
          </button>
        </div>
      </header>

      <div style={{
        maxWidth: '1200px',
        margin: '40px auto',
        padding: '0 20px'
      }}>
        <section style={{
          background: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '30px'
        }}>
          <h2>📋 Lista Podpisanych Dokumentów</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Pobierz podpisane dokumenty z systemu.
          </p>
          <PdfDownloader />
        </section>

        <section style={{
          background: 'white',
          padding: '30px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <h2>✅ Weryfikacja Podpisu</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Wgraj podpisany PDF i klucz publiczny aby zweryfikować podpis.
          </p>
          <SignatureVerifier />
        </section>
      </div>
    </div>
  );
}
