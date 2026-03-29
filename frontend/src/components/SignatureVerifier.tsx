import React, { useState } from 'react';
import apiService from '../services/apiService';

const SignatureVerifier: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [publicKeyFile, setPublicKeyFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleVerify = async () => {
    if (!pdfFile || !publicKeyFile) {
      alert('❌ Wybierz plik PDF i klucz publiczny');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // 1. Wczytaj klucz publiczny z pliku JSON
      const publicKeyText = await publicKeyFile.text();
      const publicKeyData = JSON.parse(publicKeyText);
      const publicKeyJwk = publicKeyData.publicKey;

      // 2. Wyślij do backendu - PDF jako plik, public_key jako string
      const formData = new FormData();
      formData.append('file', pdfFile);
      formData.append('public_key', JSON.stringify(publicKeyJwk));  // STRING nie plik!

      const response = await apiService.verifySignature(formData);
      setResult(response);

    } catch (error: any) {
      console.error('Verification error:', error);
      
      let errorMessage = 'Nieznany błąd';
      
      if (error.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
          errorMessage = error.response.data.detail
            .map((err: any) => `${err.loc.join('.')}: ${err.msg}`)
            .join(', ');
        } else if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else {
          errorMessage = JSON.stringify(error.response.data.detail);
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setResult({
        valid: false,
        message: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* PDF File Input */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
          1. Wybierz podpisany plik PDF
        </label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px'
          }}
        />
        {pdfFile && (
          <p style={{ marginTop: '5px', color: '#667eea' }}>✅ {pdfFile.name}</p>
        )}
      </div>

      {/* Public Key File Input */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>
          2. Wybierz klucz publiczny (JSON)
        </label>
        <input
          type="file"
          accept="application/json"
          onChange={(e) => setPublicKeyFile(e.target.files?.[0] || null)}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '5px'
          }}
        />
        {publicKeyFile && (
          <p style={{ marginTop: '5px', color: '#667eea' }}>✅ {publicKeyFile.name}</p>
        )}
      </div>

      {/* Verify Button */}
      <button
        onClick={handleVerify}
        disabled={loading || !pdfFile || !publicKeyFile}
        style={{
          width: '100%',
          padding: '15px',
          background: loading || !pdfFile || !publicKeyFile ? '#ccc' : '#4caf50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: loading || !pdfFile || !publicKeyFile ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '⏳ Weryfikowanie...' : '✅ Weryfikuj podpis'}
      </button>

      {/* Result */}
      {result && (
        <div style={{
          marginTop: '20px',
          padding: '20px',
          background: result.valid ? '#d4edda' : '#f8d7da',
          color: result.valid ? '#155724' : '#721c24',
          borderRadius: '5px',
          border: `2px solid ${result.valid ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>
            {result.valid ? '✅ Podpis PRAWIDŁOWY' : '❌ Podpis NIEPRAWIDŁOWY'}
          </h3>
          <p style={{ margin: '5px 0' }}>{String(result.message)}</p>
          {result.metadata && (
            <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ccc' }}>
              <strong>Metadane podpisu:</strong>
              <ul style={{ marginTop: '10px' }}>
                <li><strong>Podpisał:</strong> {result.metadata.name}</li>
                <li><strong>Lokalizacja:</strong> {result.metadata.location}</li>
                <li><strong>Powód:</strong> {result.metadata.reason}</li>
                {result.metadata.timestamp && (
                  <li><strong>Data:</strong> {new Date(result.metadata.timestamp).toLocaleString('pl-PL')}</li>
                )}
                {result.metadata.contact && (
                  <li><strong>Kontakt:</strong> {result.metadata.contact}</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SignatureVerifier;
