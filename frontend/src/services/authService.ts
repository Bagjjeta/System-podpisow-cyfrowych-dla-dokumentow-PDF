import axios from 'axios';

// Dla lokalnego developmentu:
const API_BASE_URL = 'http://localhost:8000/api';
// Dla produkcji (Render):
// const API_BASE_URL = 'https://projekt-pai-gr5.onrender.com/api';

interface RegisterData {
  username: string;
  email: string;
  password: string;
  is_admin: boolean;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
}

const authService = {
  register: async (data: RegisterData) => {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, data);
    return response.data;
  },

  login: async (username: string, password: string): Promise<LoginResponse> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const response = await axios.post<LoginResponse>(
      `${API_BASE_URL}/auth/token`,
      formData,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, role } = response.data;
    
    localStorage.setItem('token', access_token);
    localStorage.setItem('role', role);  // ZAPISZ ROLĘ
    
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.href = '/login';
  },

  getToken: () => {
    return localStorage.getItem('token');
  },

  getRole: () => {
    return localStorage.getItem('role');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  isAdmin: () => {
    return localStorage.getItem('role') === 'admin';
  }
};

export default authService;
