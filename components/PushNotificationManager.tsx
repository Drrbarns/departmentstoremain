'use client';

import { useState, useEffect } from 'react';

export default function PushNotificationManager() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);

      const lastPromptTime = localStorage.getItem('notificationPromptTime');
      const daysSinceLastPrompt = lastPromptTime
        ? (Date.now() - parseInt(lastPromptTime)) / (1000 * 60 * 60 * 24)
        : 999;

      if (Notification.permission === 'default' && daysSinceLastPrompt > 7) {
        setTimeout(() => setShowPrompt(true), 10000);
      }
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermission(permission);
      localStorage.setItem('notificationPromptTime', Date.now().toString());

      if (permission === 'granted') {
        await subscribeToPushNotifications();
        setShowPrompt(false);

        new Notification('Notifications Enabled! 🎉', {
          body: 'You will now receive updates about orders, deals, and more.',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'welcome-notification'
        });
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  const subscribeToPushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        setSubscription(existingSubscription);
        return;
      }

      const vapidPublicKey = 'YOUR_VAPID_PUBLIC_KEY_HERE';

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any
      });

      setSubscription(newSubscription);

      console.log('Push subscription:', JSON.stringify(newSubscription));

    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('notificationPromptTime', Date.now().toString());
  };

  if (!showPrompt || permission !== 'default') return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-xl shadow-2xl p-6 z-50 border border-gray-200 animate-slide-up">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <i className="ri-notification-line text-2xl text-emerald-700"></i>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 mb-2">Stay Updated! 🔔</h3>
          <p className="text-sm text-gray-600 mb-4">
            Get instant notifications about your orders, exclusive deals, and price drops on your wishlist items!
          </p>
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <i className="ri-check-line text-green-600"></i>
              <span>Order updates & tracking</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <i className="ri-check-line text-green-600"></i>
              <span>Flash sales & exclusive offers</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <i className="ri-check-line text-green-600"></i>
              <span>Price drops on wishlist</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={requestPermission}
              className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-2 px-4 rounded-lg font-medium transition-colors whitespace-nowrap"
            >
              Enable Notifications
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors whitespace-nowrap"
            >
              Not Now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <i className="ri-close-line"></i>
        </button>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}