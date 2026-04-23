'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function StorefrontError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Surface the error in the browser console so we can correlate with
        // server-side logs using the digest.
        console.error('[Storefront] Uncaught route error:', error);
    }, [error]);

    return (
        <main className="min-h-[60vh] flex items-center justify-center px-4">
            <div className="max-w-md text-center bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                    <i className="ri-error-warning-line text-3xl text-red-500"></i>
                </div>
                <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
                <p className="text-gray-600 text-sm mb-6">
                    We couldn&apos;t load this page. Please try again, or return home and retry from there.
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => reset()}
                        className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium"
                    >
                        Try again
                    </button>
                    <Link
                        href="/"
                        className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Go home
                    </Link>
                </div>
                {error.digest && (
                    <p className="text-xs text-gray-400 mt-6 font-mono">Reference: {error.digest}</p>
                )}
            </div>
        </main>
    );
}
