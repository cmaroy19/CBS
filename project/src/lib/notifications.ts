// Système de notifications toast simple et efficace

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration: number;
}

let notifications: Notification[] = [];
let listeners: Array<(notifications: Notification[]) => void> = [];

function emit() {
  listeners.forEach(listener => listener([...notifications]));
}

export function subscribe(listener: (notifications: Notification[]) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function addNotification(type: NotificationType, title: string, message?: string, duration = 5000) {
  const id = Math.random().toString(36).substring(2, 9);
  const notification: Notification = { id, type, title, message, duration };

  notifications.push(notification);
  emit();

  setTimeout(() => {
    notifications = notifications.filter(n => n.id !== id);
    emit();
  }, duration);
}

export function notifySuccess(title: string, message?: string) {
  addNotification('success', title, message);
}

export function notifyError(title: string, error?: any) {
  const message = error?.message || error?.toString() || 'Une erreur est survenue';
  addNotification('error', title, message, 7000);
}

export function notifyInfo(title: string, message?: string) {
  addNotification('info', title, message);
}

export function notifyWarning(title: string, message?: string) {
  addNotification('warning', title, message);
}

export function getNotifications() {
  return [...notifications];
}

export function dismissNotification(id: string) {
  notifications = notifications.filter(n => n.id !== id);
  emit();
}
