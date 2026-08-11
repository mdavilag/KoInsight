import { Center, Loader } from '@mantine/core';
import { createContext, JSX, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { setUnauthorizedHandler } from '../api/api';
import * as authApi from '../api/auth';
import { RoutePath } from '../routes';

type AuthContextValue = {
  // null while the initial session check is in flight.
  authenticated: boolean | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    authApi.checkAuth().then(setAuthenticated);
  }, []);

  // Let the central API client flip us to logged-out when a request 401s
  // (e.g. the session cookie expired), so guarded routes redirect to login.
  useEffect(() => {
    setUnauthorizedHandler(() => setAuthenticated(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const ok = await authApi.login(username, password);
    setAuthenticated(ok);
    return ok;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function RequireAuth({ children }: { children: ReactNode }): JSX.Element {
  const { authenticated } = useAuth();

  if (authenticated === null) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    );
  }

  if (!authenticated) {
    return <Navigate to={RoutePath.LOGIN} replace />;
  }

  return <>{children}</>;
}
