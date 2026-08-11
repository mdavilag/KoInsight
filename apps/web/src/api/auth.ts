import { API_URL } from './api';

export async function login(username: string, password: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return response.ok;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function checkAuth(): Promise<boolean> {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: 'include',
  });
  return response.ok;
}
