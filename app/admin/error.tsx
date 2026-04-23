'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[Admin] Uncaught route error:', error);
    }, [error]);

    return (
        <main className="min-h-[60vh] flex items-center justify-center px-4 bg-gray-50">
            <div className="max-w-md text-center bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
                <h1 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h1>
                <p className="text-gray-600 text-sm mb-6">
                    This admin screen hit an error. Try again, or head back to the dashboard.
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => reset()}
                        className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800"
                    >
                        Try again
                    </button>
                    <Link
                        href="/admin"
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Dashboard
                    </Link>
                </div>
                {error.digest && (
                    <p className="text-xs text-gray-400 mt-6 font-mono break-all">Ref: {error.digest}</p>
                )}
            </div>
        </main>
    );
}
