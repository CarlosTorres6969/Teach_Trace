/**
 * Composable para registrar el Service Worker y gestionar suscripciones Web Push.
 * Solo activo para estudiantes — el docente no recibe push de calificaciones.
 */
import { api } from './api';

const SW_PATH = '/sw.js';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    buffer[i] = rawData.charCodeAt(i);
  }
  return buffer.buffer as ArrayBuffer;
}

export async function registerPushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    // 1. Registrar el service worker
    const registration = await navigator.serviceWorker.register(SW_PATH, { scope: '/' });

    // 2. Obtener la VAPID public key del backend
    const { publicKey } = await api<{ publicKey: string }>('/vapid-public-key');
    if (!publicKey) return;

    // 3. Solicitar permiso de notificaciones (solo si no fue decidido antes)
    if (Notification.permission === 'denied') return;
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }

    // 4. Suscribirse al push service del navegador
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    // 5. Guardar la suscripción en el backend
    const { endpoint, keys } = subscription.toJSON() as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    await api('/notifications/push-subscriptions', {
      method: 'POST',
      body: JSON.stringify({ endpoint, p256dh: keys.p256dh, auth: keys.auth }),
    });
  } catch (error) {
    // No lanzar — si el push falla el resto de la app sigue funcionando
    console.warn('[TeachTrace] Push registration failed:', error);
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await api('/notifications/push-subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  } catch (error) {
    console.warn('[TeachTrace] Push unregister failed:', error);
  }
}
