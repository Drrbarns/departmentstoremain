'use client';

import { Suspense } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import ScrollToTop from '@/components/ScrollToTop';
import ErrorBoundary from '@/components/ErrorBoundary';
import NavigationProgress from '@/components/NavigationProgress';
import CookieConsent from '@/components/CookieConsent';
// Lazy-load non-critical components
import dynamic from 'next/dynamic';
const SessionTimeoutWarning = dynamic(() => import('@/components/SessionTimeoutWarning'), { ssr: false });
const PWAPrompt = dynamic(() => import('@/components/PWAPrompt'), { ssr: false });
const PWAInstaller = dynamic(() => import('@/components/PWAInstaller'), { ssr: false });
const PWASplash = dynamic(() => import('@/components/PWASplash'), { ssr: false });
const PushNotificationManager = dynamic(() => import('@/components/PushNotificationManager'), { ssr: false });
const OfflineIndicator = dynamic(() => import('@/components/OfflineIndicator'), { ssr: false });
const NetworkStatusMonitor = dynamic(() => import('@/components/NetworkStatusMonitor'), { ssr: false });
const UpdatePrompt = dynamic(() => import('@/components/UpdatePrompt'), { ssr: false });
const LiveSalesNotification = dynamic(() => import('@/components/LiveSalesNotification'), { ssr: false });

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <NavigationProgress />
      </Suspense>
      <ScrollToTop />
      <div className="min-h-screen bg-gray-50">
        <PWASplash />
        <PWAInstaller />
        <Header />
        <ErrorBoundary>
          <div className="pwa-page-enter">
            {children}
          </div>
        </ErrorBoundary>
        <Footer />
        <MobileBottomNav />
        <SessionTimeoutWarning />
        <PWAPrompt />
        <PushNotificationManager />
        <OfflineIndicator />
        <NetworkStatusMonitor />
        <UpdatePrompt />
        <LiveSalesNotification />
        <CookieConsent />
      </div>
    </>
  );
}
