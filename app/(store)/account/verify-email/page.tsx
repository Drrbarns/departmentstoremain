'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function VerifyEmailPage() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [email] = useState('john@example.com');

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = pastedData.split('');
    while (newCode.length < 6) newCode.push('');
    setCode(newCode);
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    if (verificationCode.length !== 6) return;

    setIsVerifying(true);
    
    setTimeout(() => {
      setIsVerifying(false);
      alert('Email verified successfully!');
      window.location.href = '/account';
    }, 2000);
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    
    setResendCooldown(60);
    alert('Verification code sent to your email!');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-mail-check-line text-3xl text-white"></i>
            </div>
            <h1 className="text-2xl font-bold mb-2">Verify Your Email</h1>
            <p className="text-gray-600 text-sm">
              We sent a 6-digit code to<br />
              <span className="font-medium text-black">{email}</span>
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3 text-center">
                Enter Verification Code
              </label>
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {code.map((digit, index) => (
                  <input
                    key={index}
                    id={`code-${index}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:border-black focus:ring-2 focus:ring-black/20 transition-all"
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleVerify}
              disabled={code.join('').length !== 6 || isVerifying}
              className="w-full py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium whitespace-nowrap"
            >
              {isVerifying ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>

            <div className="text-center">
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-sm text-gray-600 hover:text-black transition-colors disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
              >
                {resendCooldown > 0 ? (
                  `Resend code in ${resendCooldown}s`
                ) : (
                  <>
                    <i className="ri-refresh-line mr-1"></i>
                    Resend Code
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t">
            <div className="bg-emerald-50 rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <i className="ri-information-line text-emerald-600"></i>
                Didn't receive the code?
              </h3>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Check your spam/junk folder</li>
                <li>• Make sure {email} is correct</li>
                <li>• Wait a few minutes and try resending</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link href="/account" className="text-sm text-gray-600 hover:text-black transition-colors">
              ← Back to Account
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          By verifying your email, you confirm that you own this address and agree to receive important account notifications.
        </p>
      </div>
    </div>
  );
}
