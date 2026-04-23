export default function AdminLoading() {
    return (
        <div className="min-h-[50vh] flex items-center justify-center bg-gray-50">
            <div className="flex items-center gap-3 text-gray-500">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-700 rounded-full animate-spin" />
                <span className="text-sm">Loading admin…</span>
            </div>
        </div>
    );
}
