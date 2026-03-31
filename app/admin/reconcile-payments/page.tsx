'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Row = {
    id: string;
    order_number: string | null;
    total: number | null;
    payment_status: string | null;
    created_at: string | null;
    email: string | null;
    moolre_externalref: string | null;
    moolre_reference: string | null;
};

export default function ReconcilePaymentsPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) {
                setError('Not signed in');
                setLoading(false);
                return;
            }
            const res = await fetch('/api/admin/reconcile-payments', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            if (!res.ok) {
                setError(json.error || 'Request failed');
                setRows([]);
                return;
            }
            setRows(json.orders || []);
            setNote(json.note || '');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="p-6 max-w-6xl">
            <h1 className="text-2xl font-bold mb-2">Payment reconciliation (Moolre)</h1>
            <p className="text-gray-600 mb-4 max-w-3xl">
                Supabase does not store Moolre callback payloads unless we add a dedicated log table.
                This list shows orders where a Moolre payment link was generated (
                <code className="text-sm bg-gray-100 px-1 rounded">moolre_externalref</code>
                ) but the order is still not marked paid — the usual suspects when money arrived at Moolre
                but our callback or success flow did not complete.
            </p>
            {note && <p className="text-sm text-gray-700 mb-4 border-l-4 border-amber-400 pl-3">{note}</p>}

            <div className="flex gap-3 mb-6">
                <button
                    type="button"
                    onClick={() => load()}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? 'Loading…' : 'Refresh list'}
                </button>
                <Link
                    href="/admin/orders"
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 inline-flex items-center"
                >
                    All orders
                </Link>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-800 rounded border border-red-200">{error}</div>
            )}

            {!loading && !error && rows.length === 0 && (
                <p className="text-gray-600">No unmatched Moolre link orders in the recent window.</p>
            )}

            {rows.length > 0 && (
                <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white shadow-sm">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="bg-gray-50 text-left border-b">
                                <th className="p-3 font-semibold">Order</th>
                                <th className="p-3 font-semibold">Total</th>
                                <th className="p-3 font-semibold">Status</th>
                                <th className="p-3 font-semibold">Created</th>
                                <th className="p-3 font-semibold">External ref</th>
                                <th className="p-3 font-semibold">Moolre ref</th>
                                <th className="p-3 font-semibold">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                                    <td className="p-3">
                                        <div className="font-medium">{r.order_number || r.id}</div>
                                        <div className="text-gray-500 text-xs truncate max-w-[200px]">{r.email}</div>
                                    </td>
                                    <td className="p-3 whitespace-nowrap">{r.total != null ? `₵${Number(r.total).toFixed(2)}` : '—'}</td>
                                    <td className="p-3">
                                        <span className="text-amber-700">{r.payment_status || '—'}</span>
                                    </td>
                                    <td className="p-3 whitespace-nowrap text-gray-600">
                                        {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                                    </td>
                                    <td className="p-3 font-mono text-xs max-w-[180px] break-all">
                                        {r.moolre_externalref || '—'}
                                    </td>
                                    <td className="p-3 font-mono text-xs max-w-[120px] break-all">
                                        {r.moolre_reference ?? '—'}
                                    </td>
                                    <td className="p-3">
                                        <Link
                                            href={`/admin/orders/${r.id}`}
                                            className="text-blue-600 hover:underline whitespace-nowrap"
                                        >
                                            Open order
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="mt-8 text-sm text-gray-500 max-w-3xl">
                If you have raw callback JSON from Moolre (or a spreadsheet of successful transactions), you can
                match <code className="bg-gray-100 px-1 rounded">data.externalref</code> to{' '}
                <code className="bg-gray-100 px-1 rounded">moolre_externalref</code> here, then mark the order paid
                after confirming the amount. A future improvement is storing each callback in the database for audit.
            </p>
        </div>
    );
}
