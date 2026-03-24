export function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('token');
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function getUser(): { email?: string; nombre?: string; plan_type?: string } | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('user');
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
}

export function getPlanType(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('plan_type');
}

export function logout(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  localStorage.removeItem('plan_type');
  localStorage.removeItem('user');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}
