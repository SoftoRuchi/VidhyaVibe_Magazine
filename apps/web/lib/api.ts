import axios from 'axios';
import { getApiOrigin } from './apiBase';

const origin = getApiOrigin();

const api = axios.create({
  baseURL: origin || undefined,
  withCredentials: true,
});

export default api;
