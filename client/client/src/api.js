import axios from 'axios';
const base = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
export const api = axios.create({ baseURL: base + '/api' });
export const authApi = axios.create({ baseURL: base + '/api/auth' });
