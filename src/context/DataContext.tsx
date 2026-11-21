import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { EMPTY_SUPABASE_STATE, supabaseService } from '../services/supabaseService';
import { SupabaseBusinessState } from '../types/supabase';
import { mapSupabaseDatabaseError } from '../lib/supabase';

export interface NotificationItem {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface DataContextValue {
  db: SupabaseBusinessState;
  isLoading: boolean;
  isRefreshing: boolean;
  isMutating: boolean;
  loadError: string | null;
  notifications: NotificationItem[];
  dismissNotification: (id: string) => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  refreshData: () => Promise<void>;
  executeMutation: <T>(
    operation: () => Promise<T>,
    successMessage: string
  ) => Promise<T | null>;
}

const DataContext = createContext<DataContextValue | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, user } = useAuth();
  const [db, setDb] = useState<SupabaseBusinessState>(EMPTY_SUPABASE_STATE);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const pushNotification = useCallback(
    (type: 'success' | 'error', message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setNotifications((prev) => [...prev.slice(-3), { id, type, message }]);
      window.setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 6000);
    },
    []
  );

  const notifySuccess = useCallback(
    (message: string) => pushNotification('success', message),
    [pushNotification]
  );

  const notifyError = useCallback(
    (message: string) => pushNotification('error', message),
    [pushNotification]
  );

  const refreshData = useCallback(
    async (initial = false) => {
      if (!session || !user) return;
      if (initial) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setLoadError(null);

      try {
        const next = await supabaseService.fetchAllData();
        setDb(next);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : mapSupabaseDatabaseError(err);
        setLoadError(message);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [session, user]
  );

  useEffect(() => {
    if (session && user) {
      void refreshData(true);
    } else {
      setDb(EMPTY_SUPABASE_STATE);
      setLoadError(null);
    }
  }, [session, user, refreshData]);

  const executeMutation = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      successMessage: string
    ): Promise<T | null> => {
      setIsMutating(true);
      try {
        const result = await operation();
        await refreshData(false);
        notifySuccess(successMessage);
        return result;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : mapSupabaseDatabaseError(err);
        notifyError(message);
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [refreshData, notifySuccess, notifyError]
  );

  return (
    <DataContext.Provider
      value={{
        db,
        isLoading,
        isRefreshing,
        isMutating,
        loadError,
        notifications,
        dismissNotification,
        notifySuccess,
        notifyError,
        refreshData: () => refreshData(false),
        executeMutation,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useBusinessData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error('useBusinessData harus digunakan di dalam DataProvider.');
  }
  return ctx;
}
