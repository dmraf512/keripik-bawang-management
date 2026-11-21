import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { NotificationItem } from '../../context/DataContext';

interface NotificationToastProps {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notifications,
  onDismiss,
}) => {
  if (notifications.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0 pointer-events-none no-print"
      aria-live="polite"
    >
      {notifications.map((item) => {
        const isSuccess = item.type === 'success';
        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 p-3.5 rounded-xl border shadow-md text-xs ${
              isSuccess
                ? 'bg-white border-[#B9DEC9] text-[#175736]'
                : 'bg-[#FDF2F0] border-[#F2C6BF] text-[#9E2A1E]'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#1E6B43]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#B4382A]" />
            )}
            <div className="flex-1 leading-relaxed">{item.message}</div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Tutup notifikasi"
              className="p-0.5 rounded hover:bg-black/5 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
