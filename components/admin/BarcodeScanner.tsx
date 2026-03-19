'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
    onScan: (barcode: string) => void;
    onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(true);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const cooldownRef = useRef(false);
    const containerIdRef = useRef(`scanner-${Date.now()}`);

    const startScanner = useCallback(async (mode: 'environment' | 'user') => {
        setIsStarting(true);
        setError(null);

        try {
            if (scannerRef.current) {
                try { await scannerRef.current.stop(); } catch { /* already stopped */ }
                scannerRef.current.clear();
                scannerRef.current = null;
            }
        } catch { /* ignore cleanup errors */ }

        await new Promise(r => setTimeout(r, 300));

        try {
            const scanner = new Html5Qrcode(containerIdRef.current);
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: mode },
                {
                    fps: 10,
                    qrbox: { width: 280, height: 150 },
                    aspectRatio: 1.5,
                },
                (decodedText) => {
                    if (cooldownRef.current) return;
                    cooldownRef.current = true;
                    setLastScanned(decodedText);
                    onScan(decodedText);
                    setTimeout(() => { cooldownRef.current = false; }, 1500);
                },
                () => { /* ignore scan failures (normal while aiming) */ }
            );

            setIsStarting(false);
        } catch (err: any) {
            console.error('Scanner start error:', err);
            if (mode === 'environment') {
                try {
                    const scanner = new Html5Qrcode(containerIdRef.current);
                    scannerRef.current = scanner;
                    await scanner.start(
                        { facingMode: 'user' },
                        { fps: 10, qrbox: { width: 280, height: 150 }, aspectRatio: 1.5 },
                        (decodedText) => {
                            if (cooldownRef.current) return;
                            cooldownRef.current = true;
                            setLastScanned(decodedText);
                            onScan(decodedText);
                            setTimeout(() => { cooldownRef.current = false; }, 1500);
                        },
                        () => {}
                    );
                    setFacingMode('user');
                    setIsStarting(false);
                } catch (fallbackErr: any) {
                    setError('Camera access denied. Please allow camera permissions and try again.');
                    setIsStarting(false);
                }
            } else {
                setError('Camera access denied. Please allow camera permissions and try again.');
                setIsStarting(false);
            }
        }
    }, [onScan]);

    useEffect(() => {
        startScanner(facingMode);

        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
                scannerRef.current.clear();
                scannerRef.current = null;
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleFlipCamera = async () => {
        const newMode = facingMode === 'environment' ? 'user' : 'environment';
        setFacingMode(newMode);
        await startScanner(newMode);
    };

    const handleClose = async () => {
        if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch { /* ignore */ }
            try { scannerRef.current.clear(); } catch { /* ignore */ }
            scannerRef.current = null;
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                        <i className="ri-barcode-line text-xl text-blue-700"></i>
                        <h3 className="text-lg font-bold text-gray-900">Scan Barcode</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleFlipCamera}
                            className="w-9 h-9 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
                            title="Switch camera"
                        >
                            <i className="ri-camera-switch-line text-lg"></i>
                        </button>
                        <button
                            onClick={handleClose}
                            className="w-9 h-9 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
                        >
                            <i className="ri-close-line text-xl"></i>
                        </button>
                    </div>
                </div>

                {/* Scanner Area */}
                <div className="relative bg-black">
                    <div id={containerIdRef.current} className="w-full" style={{ minHeight: 300 }} />

                    {isStarting && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white">
                            <i className="ri-loader-4-line animate-spin text-4xl text-blue-400 mb-3"></i>
                            <p className="text-sm text-gray-300">Starting camera...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
                            <i className="ri-camera-off-line text-5xl text-red-400 mb-3"></i>
                            <p className="text-sm text-red-300 mb-4">{error}</p>
                            <button
                                onClick={() => startScanner(facingMode)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100">
                    {lastScanned ? (
                        <div className="flex items-center gap-2 text-sm">
                            <i className="ri-checkbox-circle-fill text-green-500"></i>
                            <span className="text-gray-600">Last scanned:</span>
                            <span className="font-mono font-semibold text-gray-900">{lastScanned}</span>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 text-center">
                            Point your camera at a barcode to scan
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
