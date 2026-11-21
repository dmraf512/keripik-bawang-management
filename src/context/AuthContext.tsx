import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import {
  DatabaseConnectionResult,
  mapSupabaseAuthError,
  supabase,
  supabaseConfig,
  verifyDatabaseConnection,
} from '../lib/supabase';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isInitializing: boolean;
  isSubmitting: boolean;
  authError: string | null;
  configError: string | null;
  dbStatus: DatabaseConnectionResult | null;
  isCheckingDb: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  checkDbConnection: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<DatabaseConnectionResult | null>(null);
  const [isCheckingDb, setIsCheckingDb] = useState<boolean>(false);

  const checkDbConnection = useCallback(async () => {
    setIsCheckingDb(true);
    const result = await verifyDatabaseConnection();
    setDbStatus(result);
    setIsCheckingDb(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setIsInitializing(false);
      return;
    }

    let isMounted = true;

    const initSession = async () => {
      try {
        const { data, error } = await supabase!.auth.getSession();
        if (!isMounted) return;

        if (error) {
          setAuthError(mapSupabaseAuthError(error));
          setSession(null);
          setUser(null);
        } else {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          if (data.session?.access_token) {
            void checkDbConnection();
          }
        }
      } catch (err) {
        if (!isMounted) return;
        setAuthError(mapSupabaseAuthError(err));
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };

    void initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession) {
        setDbStatus(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<boolean> => {
    if (!supabase) {
      setAuthError(
        supabaseConfig.errorMessage ??
          'Konfigurasi Supabase belum tersedia. Periksa file .env.local.'
      );
      return false;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setAuthError('Email dan kata sandi wajib diisi.');
      return false;
    }

    setIsSubmitting(true);
    setAuthError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setAuthError(mapSupabaseAuthError(error));
        return false;
      }

      setSession(data.session);
      setUser(data.user);
      if (data.session?.access_token) {
        void checkDbConnection();
      }
      return true;
    } catch (err) {
      setAuthError(mapSupabaseAuthError(err));
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async (): Promise<void> => {
    if (!supabase) {
      setSession(null);
      setUser(null);
      return;
    }

    setIsSubmitting(true);
    setAuthError(null);

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        setAuthError(mapSupabaseAuthError(error));
      }
      setSession(null);
      setUser(null);
      setDbStatus(null);
    } catch (err) {
      setAuthError(mapSupabaseAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearAuthError = () => setAuthError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isInitializing,
        isSubmitting,
        authError,
        configError: supabaseConfig.errorMessage,
        dbStatus,
        isCheckingDb,
        signIn,
        signOut,
        clearAuthError,
        checkDbConnection: () => checkDbConnection(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.');
  }
  return ctx;
}
