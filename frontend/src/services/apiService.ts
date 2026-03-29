import axios from 'axios';
import authService from './authService';

// Dla lokalnego developmentu:
const API_BASE_URL = 'http://localhost:8000/api';
// Dla produkcji (Render):
// const API_BASE_URL = 'https://projekt-pai-gr5.onrender.com/api';

// Interceptor - dodaje token do każdego requesta
axios.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor - obsługa błędów autentykacji
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      authService.logout();
    }
    return Promise.reject(error);
  }
);

const apiService = {
  // Przygotowuje plik do podpisania (z metadanymi)
  prepareSignatureWithMetadata: async (formData: FormData) => {
    const response = await axios.post(
      `${API_BASE_URL}/signature/prepare-signature-with-metadata`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  // Usuń dokument
  deleteDocument: async (documentId: string) => {
    const token = localStorage.getItem('token');
    const response = await axios.delete(`${API_BASE_URL}/admin/documents/${documentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
  },

  // NOWE - Osadza podpis w PDF i zapisuje w bazie (NIE POBIERA!)
  embedSignatureToDb: async (formData: FormData) => {
    const response = await axios.post(
      `${API_BASE_URL}/signature/embed-signature-to-db`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  // NOWE - Lista podpisanych PDF-ów
  listSignedPdfs: async () => {
    const response = await axios.get(`${API_BASE_URL}/signature/signed-pdfs`);
    return response.data;
  },

  // NOWE - Pobierz podpisany PDF
  downloadSignedPdf: async (signatureId: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/signature/download-signed-pdf/${signatureId}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  // NOWE - Pobierz klucz publiczny dla podpisu
  downloadPublicKey: async (signatureId: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/signature/download-public-key/${signatureId}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  // Weryfikuje podpis
  verifySignature: async (formData: FormData) => {
    const response = await axios.post(
      `${API_BASE_URL}/signature/verify-signature`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  }
};

export default apiService;
