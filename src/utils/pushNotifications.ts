import { playAssignChime, playWarningBeep, playRotationAlert, playSaleFanfare } from './soundAlerts';

export interface ToastAlert {
  id: string;
  title: string;
  message: string;
  type: 'assignment' | 'warning' | 'rotation' | 'sale' | 'reopened' | 'info';
  timestamp: number;
}

type ToastListener = (toasts: ToastAlert[]) => void;

let activeToasts: ToastAlert[] = [];
const listeners: Set<ToastListener> = new Set();

export function subscribeToasts(listener: ToastListener) {
  listeners.add(listener);
  listener([...activeToasts]);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  listeners.forEach((l) => l([...activeToasts]));
}

export function removeToast(id: string) {
  activeToasts = activeToasts.filter((t) => t.id !== id);
  notifyListeners();
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return 'denied';
  }
}

export function hasNotificationPermission(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

/**
 * Sends a push notification + audio chime + UI toast
 */
export function sendLeadPushNotification(
  title: string,
  message: string,
  type: ToastAlert['type'] = 'assignment',
  onClick?: () => void
) {
  // 1. Audio chime based on event type
  if (type === 'assignment' || type === 'reopened') {
    playAssignChime();
  } else if (type === 'warning') {
    playWarningBeep();
  } else if (type === 'rotation') {
    playRotationAlert();
  } else if (type === 'sale') {
    playSaleFanfare();
  }

  // 2. Browser Desktop Push Notification
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        tag: 'rotex-' + Date.now(),
        silent: true, // We already synthesized sound via Web Audio API
      });
      if (onClick) {
        n.onclick = () => {
          window.focus();
          onClick();
          n.close();
        };
      }
    } catch {
      // Fallback in environments where Notification constructor fails
    }
  }

  // 3. In-App Toast
  const toast: ToastAlert = {
    id: 't_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title,
    message,
    type,
    timestamp: Date.now(),
  };

  activeToasts = [toast, ...activeToasts].slice(0, 5);
  notifyListeners();

  // Auto remove after 6 seconds
  setTimeout(() => {
    removeToast(toast.id);
  }, 6000);
}
