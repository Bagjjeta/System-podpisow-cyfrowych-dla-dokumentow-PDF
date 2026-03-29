import React, { useState } from 'react';
import CryptoService from '../services/cryptoService';
import apiService from '../services/apiService';

const PdfSigner: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState({
    name: '',
    location: '',
    reason: '',
    contact: '',
  });
  const [keySize, setKeySize] = useState<number>(2048);
  const [loading, setLoading] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);
  const [message, setMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);

  // Sprawdź czy klucze istnieją przy starcie
  React.useEffect(() => {
    const keys = CryptoService.loadKeys();
    setHasKeys(!!keys);
  }, []);

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setMessage('');
    } else {
      alert('❌ Proszę wybrać plik PDF');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        setMessage('');
      } else {
        alert('❌ Proszę wybrać plik PDF');
      }
    }
  };

  // === GENEROWANIE KLUCZY (ZAWSZE NADPISUJE STARE) ===
  const handleGenerateKeys = async () => {
    setGeneratingKeys(true);
    setMessage('');

    try {
      setMessage(`🔑 Generowanie kluczy RSA-PSS ${keySize}-bit...`);
      
      const keyPair = await CryptoService.generateKeyPair(keySize);
      const publicKeyJwk = await CryptoService.exportKey(keyPair.publicKey);
      const privateKeyJwk = await CryptoService.exportKey(keyPair.privateKey);
      
      CryptoService.saveKeys(
        { publicKey: publicKeyJwk, privateKey: privateKeyJwk },
        keySize
      );

      setHasKeys(true);
      setMessage(`✅ Klucze ${keySize}-bit wygenerowane i zapisane w sessionStorage (do zamknięcia przeglądarki)!`);
    } catch (error: any) {
      console.error('❌ Błąd generowania kluczy:', error);
      setMessage(`❌ Błąd: ${error.message}`);
    } finally {
      setGeneratingKeys(false);
    }
  };

  // === POBIERANIE KLUCZA PRYWATNEGO ===
  const handleDownloadKeys = () => {
    const keys = CryptoService.loadKeys();
    if (!keys) {
      alert('❌ Brak kluczy do pobrania. Najpierw wygeneruj klucze.');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Pobierz TYLKO klucz prywatny (zawiera informacje do wyodrębnienia klucza publicznego)
    const privateKeyData = JSON.stringify(
      {
        version: '1.0',
        privateKey: keys.privateKey,
        keySize: keys.keySize,
        createdAt: keys.createdAt,
        description: 'Klucz prywatny do podpisywania dokumentów',
        warning: 'NIE UDOSTĘPNIAJ TEGO PLIKU NIKOMU!',
        note: 'Klucz publiczny zostanie automatycznie wyodrębniony przy imporcie',
        info: 'Ten plik zawiera wszystkie informacje potrzebne do podpisywania dokumentów'
      },
      null,
      2
    );
    downloadFile(privateKeyData, `private_key_${timestamp}.json`);

    setMessage('✅ Klucz prywatny pobrany. UWAGA: Przechowuj bezpiecznie!');
  };

  // === IMPORT KLUCZA PRYWATNEGO - ULEPSZONE ===
  const handleImportPrivateKey = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileText = await file.text();
      const keyData = JSON.parse(fileText);

      // Walidacja struktury
      if (!keyData.privateKey) {
        throw new Error('Nieprawidłowy format pliku - brak klucza prywatnego');
      }

      // Sprawdź czy to prawidłowy klucz JWK
      if (!keyData.privateKey.kty || !keyData.privateKey.n || !keyData.privateKey.d) {
        throw new Error('Nieprawidłowa struktura klucza prywatnego');
      }

      let publicKey: JsonWebKey;

      // Wyodrębnij klucz publiczny z prywatnego
      console.log('⚙️ Wyodrębniam klucz publiczny z prywatnego...');
      publicKey = CryptoService.extractPublicKeyFromPrivate(keyData.privateKey);
      console.log('✅ Klucz publiczny wyodrębniony pomyślnie');

      // Zapisz parę kluczy
      CryptoService.saveKeys(
        {
          publicKey: publicKey,
          privateKey: keyData.privateKey,
        },
        keyData.keySize || 2048
      );

      setHasKeys(true);
      setMessage(`✅ Klucz prywatny zaimportowany! Klucz publiczny wyodrębniony automatycznie. (${keyData.keySize || 2048}-bit)`);
      
      // Wyczyść input
      e.target.value = '';
    } catch (error: any) {
      console.error('❌ Błąd importu klucza:', error);
      alert(`❌ Błąd importu: ${error.message}`);
      e.target.value = '';
    }
  };

  // === PODPISYWANIE ===
  const handleSign = async () => {
    if (!file) {
      alert('❌ Wybierz plik PDF');
      return;
    }

    if (!metadata.name || !metadata.location || !metadata.reason) {
      alert('❌ Wypełnij wszystkie wymagane pola metadanych');
      return;
    }

    const keys = CryptoService.loadKeys();
    if (!keys) {
      alert('❌ Najpierw wygeneruj klucze!');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify({
        ...metadata,
        filename: file.name,
        keySize: keys.keySize,
      }));

      setMessage('📄 Przygotowywanie dokumentu...');
      const prepareResponse = await apiService.prepareSignatureWithMetadata(formData);
      const fileHashBase64 = prepareResponse.file_hash;
      const tempFilePath = prepareResponse.temp_file_path;

      const hashBytes = Uint8Array.from(atob(fileHashBase64), c => c.charCodeAt(0));

      setMessage('🔐 Podpisywanie dokumentu...');
      const privateKeyObj = await window.crypto.subtle.importKey(
        'jwk',
        keys.privateKey,
        { name: 'RSA-PSS', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await CryptoService.signHash(hashBytes.buffer, privateKeyObj);
      const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)));

      setMessage('💾 Zapisywanie podpisu...');
      const embedFormData = new FormData();
      embedFormData.append('temp_file_path', tempFilePath);
      embedFormData.append('signature', signatureBase64);
      embedFormData.append('public_key', JSON.stringify(keys.publicKey));
      embedFormData.append('metadata', JSON.stringify({
        ...metadata,
        filename: file.name,
        keySize: keys.keySize,
      }));

      const embedResponse = await apiService.embedSignatureToDb(embedFormData);

      setMessage(`✅ Dokument podpisany! Podpisany PDF zapisany jako: ${embedResponse.filename}`);
      setFile(null);
      setMetadata({ name: '', location: '', reason: '', contact: '' });
    } catch (error: any) {
      console.error('❌ Błąd podpisywania:', error);
      setMessage(`❌ Błąd: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* STATUS */}
      <div style={{ 
        padding: '15px', 
        marginBottom: '20px', 
        background: hasKeys ? '#d4edda' : '#fff3cd',
        border: `2px solid ${hasKeys ? '#c3e6cb' : '#ffeaa7'}`,
        borderRadius: '8px'
      }}>
        <strong>{hasKeys ? '🔑 Klucze gotowe' : '⚠️ Brak kluczy'}</strong>
        <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#666' }}>
          {hasKeys 
            ? 'Możesz podpisywać dokumenty, pobierać lub wygenerować nowe klucze.' 
            : 'Wybierz rozmiar klucza i kliknij "Wygeneruj klucze" lub zaimportuj klucz prywatny.'}
        </p>
      </div>

      {/* DRAG & DROP */}
      <div
        onClick={() => document.getElementById('fileInput')?.click()}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        style={{
          border: dragActive ? '3px dashed #667eea' : '2px dashed #ccc',
          borderRadius: '10px',
          padding: '40px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragActive ? '#f0f4ff' : '#fafafa',
          marginBottom: '20px',
        }}
      >
        <input
          id="fileInput"
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>
          {file ? `✅ ${file.name}` : '📄 Przeciągnij plik PDF lub kliknij'}
        </p>
        <p style={{ color: '#999', fontSize: '14px' }}>Obsługiwane formaty: PDF</p>
      </div>

      {/* METADANE */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Imię i Nazwisko *
        </label>
        <input
          type="text"
          value={metadata.name}
          onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
          placeholder="Jan Kowalski"
          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Lokalizacja *
        </label>
        <input
          type="text"
          value={metadata.location}
          onChange={(e) => setMetadata({ ...metadata, location: e.target.value })}
          placeholder="Warszawa, Polska"
          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Powód podpisania *
        </label>
        <input
          type="text"
          value={metadata.reason}
          onChange={(e) => setMetadata({ ...metadata, reason: e.target.value })}
          placeholder="Akceptacja dokumentu"
          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Kontakt (opcjonalnie)
        </label>
        <input
          type="text"
          value={metadata.contact}
          onChange={(e) => setMetadata({ ...metadata, contact: e.target.value })}
          placeholder="email@example.com"
          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
        />
      </div>

      {/* ROZMIAR KLUCZA */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Rozmiar klucza RSA
        </label>
        <select
          value={keySize}
          onChange={(e) => setKeySize(Number(e.target.value))}
          style={{ width: '100%', padding: '10px', border: '1px solid #ddd', borderRadius: '5px' }}
        >
          <option value={2048}>2048 bitów (standardowy)</option>
          <option value={3072}>3072 bitów (wysoki)</option>
          <option value={4096}>4096 bitów (bardzo wysoki)</option>
        </select>
      </div>

      {/* PRZYCISKI ZARZĄDZANIA KLUCZAMI */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button
          onClick={handleGenerateKeys}
          disabled={generatingKeys}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '15px',
            background: generatingKeys ? '#ccc' : '#ffc107',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: generatingKeys ? 'not-allowed' : 'pointer',
          }}
        >
          {generatingKeys ? '⏳ Generuję...' : '🔑 Wygeneruj nowe klucze'}
        </button>

        <button
          onClick={handleDownloadKeys}
          disabled={!hasKeys}
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '15px',
            background: !hasKeys ? '#ccc' : '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: !hasKeys ? 'not-allowed' : 'pointer',
          }}
        >
          ⬇️ Pobierz klucz prywatny
        </button>

        <label
          style={{
            flex: 1,
            minWidth: '150px',
            padding: '15px',
            background: '#9c27b0',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          📥 Importuj klucz prywatny
          <input
            type="file"
            accept=".json"
            onChange={handleImportPrivateKey}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {/* PRZYCISK PODPISU */}
      <button
        onClick={handleSign}
        disabled={loading || !file || !hasKeys}
        style={{
          width: '100%',
          padding: '15px',
          background: !hasKeys ? '#ccc' : loading ? '#ccc' : '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: loading || !file || !hasKeys ? 'not-allowed' : 'pointer',
          marginBottom: '20px',
        }}
      >
        {loading ? '⏳ Podpisywanie...' : '✍️ Podpisz dokument'}
      </button>

      {/* KOMUNIKAT */}
      {message && (
        <div
          style={{
            padding: '15px',
            background: message.includes('✅') ? '#d4edda' : message.includes('❌') ? '#f8d7da' : '#d1ecf1',
            border: `1px solid ${message.includes('✅') ? '#c3e6cb' : message.includes('❌') ? '#f5c6cb' : '#bee5eb'}`,
            borderRadius: '5px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {message}
        </div>
      )}

      {/* OSTRZEŻENIE BEZPIECZEŃSTWA */}
      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: '#fff3cd',
        border: '2px solid #ffc107',
        borderRadius: '8px',
      }}>
        <strong>⚠️ Ważne informacje o bezpieczeństwie:</strong>
        <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
          <li><strong>Klucz prywatny</strong> - służy do podpisywania dokumentów. NIGDY NIE UDOSTĘPNIAJ!</li>
          <li><strong>Klucz publiczny</strong> - jest automatycznie dołączany do każdego podpisanego dokumentu</li>
          <li>Administrator może pobrać klucz publiczny z podpisanego PDF do weryfikacji</li>
          <li>Import klucza prywatnego automatycznie wyodrębnia z niego klucz publiczny</li>
          <li>Przechowuj plik <code>private_key_*.json</code> w bezpiecznym miejscu (np. zaszyfrowany dysk, pendrive)</li>
          <li>Jeśli utracisz klucz prywatny, nie będziesz mógł podpisywać dokumentów tym samym kluczem</li>
          <li>Klucze są przechowywane w przeglądarce do momentu jej zamknięcia (sessionStorage)</li>
        </ul>
      </div>
    </div>
  );
};

export default PdfSigner;
