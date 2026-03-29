import React, { useState, useEffect } from 'react';
import apiService from '../services/apiService';

interface SignedPdf {
  id: string;
  filename: string;
  signer: string;
  username: string;
  signed_at: string;
  location: string;
  reason: string;
}

const PdfDownloader: React.FC = () => {
  const [pdfs, setPdfs] = useState<SignedPdf[]>([]);
  const [filteredPdfs, setFilteredPdfs] = useState<SignedPdf[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPdfs();
  }, []);

  useEffect(() => {
    filterPdfs();
  }, [selectedUser, pdfs]);

  const loadPdfs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiService.listSignedPdfs();
      setPdfs(data.documents);
      
      // Wyciągnij unikalnych użytkowników - POPRAWIONE
      const uniqueUsers = Array.from(
        new Set(data.documents.map((pdf: SignedPdf) => pdf.username))
      ) as string[];
      setUsers(uniqueUsers);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Błąd ładowania listy');
    } finally {
      setLoading(false);
    }
  };

  const filterPdfs = () => {
    if (selectedUser === 'all') {
      setFilteredPdfs(pdfs);
    } else {
      setFilteredPdfs(pdfs.filter(pdf => pdf.username === selectedUser));
    }
  };

  const downloadPdf = async (id: string, filename: string) => {
    try {
      const blob = await apiService.downloadSignedPdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`❌ Błąd pobierania: ${err.response?.data?.detail || err.message}`);
    }
  };

  const downloadPublicKey = async (id: string, filename: string) => {
    try {
      const blob = await apiService.downloadPublicKey(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const keyFilename = filename.replace('.pdf', '_public_key.json');
      a.download = keyFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`❌ Błąd pobierania klucza: ${err.response?.data?.detail || err.message}`);
    }
  };

  const deletePdf = async (id: string, filename: string) => {
    if (!confirm(`Czy na pewno usunąć dokument: ${filename}?`)) {
      return;
    }

    try {
      await apiService.deleteDocument(id);
      alert(`✅ Dokument usunięty: ${filename}`);
      loadPdfs(); // Odśwież listę
    } catch (err: any) {
      alert(`❌ Błąd usuwania: ${err.response?.data?.detail || err.message}`);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>⏳ Ładowanie...</div>;
  }

  if (error) {
    return (
      <div style={{
        padding: '20px',
        background: '#f8d7da',
        color: '#721c24',
        borderRadius: '5px',
        border: '1px solid #f5c6cb'
      }}>
        ❌ {error}
      </div>
    );
  }

  if (pdfs.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '40px',
        background: '#f0f0f0',
        borderRadius: '10px'
      }}>
        <p style={{ fontSize: '48px', margin: '0 0 10px 0' }}>📭</p>
        <p style={{ color: '#666' }}>Brak podpisanych dokumentów w systemie</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: '#666', margin: '0 0 10px 0' }}>
            Znaleziono <strong>{filteredPdfs.length}</strong> / {pdfs.length} dokumentów
          </p>
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '5px',
              background: 'white'
            }}
          >
            <option value="all">Wszyscy użytkownicy</option>
            {users.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>
        </div>
        <button
          onClick={loadPdfs}
          style={{
            padding: '8px 16px',
            background: '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          🔄 Odśwież
        </button>
      </div>

      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        background: 'white',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
      }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Nazwa pliku</th>
            <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Użytkownik</th>
            <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Podpisał</th>
            <th style={{ padding: '15px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Data</th>
            <th style={{ padding: '15px', textAlign: 'center', borderBottom: '2px solid #ddd', width: '220px' }}>Akcje</th>
          </tr>
        </thead>
        <tbody>
          {filteredPdfs.map((pdf) => (
            <tr key={pdf.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '15px' }}>
                <strong>📄 {pdf.filename}</strong>
                <br />
                <small style={{ color: '#999' }}>{pdf.reason}</small>
              </td>
              <td style={{ padding: '15px' }}>
                <strong style={{ color: '#667eea' }}>@{pdf.username}</strong>
              </td>
              <td style={{ padding: '15px' }}>{pdf.signer}</td>
              <td style={{ padding: '15px' }}>
                {new Date(pdf.signed_at).toLocaleString('pl-PL')}
              </td>
              <td style={{ padding: '15px', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => downloadPdf(pdf.id, pdf.filename)}
                    style={{
                      padding: '8px 12px',
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      whiteSpace: 'nowrap'
                    }}
                    title="Pobierz podpisany PDF"
                  >
                    📄 PDF
                  </button>
                  <button
                    onClick={() => downloadPublicKey(pdf.id, pdf.filename)}
                    style={{
                      padding: '8px 12px',
                      background: '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      whiteSpace: 'nowrap'
                    }}
                    title="Pobierz klucz publiczny do weryfikacji"
                  >
                    🔑 Klucz
                  </button>
                  <button
                    onClick={() => deletePdf(pdf.id, pdf.filename)}
                    style={{
                      padding: '8px 12px',
                      background: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      whiteSpace: 'nowrap'
                    }}
                    title="Usuń dokument"
                  >
                    🗑️ Usuń
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PdfDownloader;
