import { useEffect, useState } from 'react';
import { X, CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react';
import { subscribe, dismissNotification, getNotifications, type NotificationType } from '../../lib/notifications';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration: number;
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
};

const styles = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
};

const iconStyles = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

export function ToastContainer() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setNotifications(getNotifications());
    const unsubscribe = subscribe(setNotifications);
    return unsubscribe;
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
      {notifications.map((notification) => {
        const Icon = icons[notification.type];
        return (
          <div
            key={notification.id}
            className={`${styles[notification.type]} border rounded-lg shadow-lg p-4 flex items-start gap-3 animate-in slide-in-from-top-2 duration-300`}
          >
            <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconStyles[notification.type]}`} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{notification.title}</p>
              {notification.message && (
                <p className="text-sm opacity-90 mt-1">{notification.message}</p>
              )}
            </div>
            <button
              onClick={() => dismissNotification(notification.id)}
              className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
