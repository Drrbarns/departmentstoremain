"use client";

import { useState } from 'react';

// Newsletter Component
export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSubmitStatus('success');
      setEmail('');
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 mb-12">
      <div className="bg-[#04241c] rounded-[2rem] overflow-hidden shadow-2xl relative">

        {/* Background Image / Texture */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('/pattern-noise.png')] opacity-20"></div> {/* Fallback to simple noise if available or just raw color */}
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-400 rounded-full blur-[100px] opacity-30"></div>
          <div className="absolute top-40 -left-20 w-72 h-72 bg-emerald-300 rounded-full blur-[100px] opacity-20"></div>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between p-8 md:p-10 lg:p-12 gap-8">

          {/* Left Content */}
          <div className="text-center lg:text-left max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 text-xs font-bold tracking-widest uppercase mb-4 animate-pulse-glow">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              The Insider Club
            </div>

            <h3 className="text-3xl md:text-4xl font-serif text-white mb-4 leading-tight">
              Unlock <span className="italic text-emerald-400">10% Off</span> <br /> Your First Order
            </h3>

            <p className="text-emerald-100/80 text-base leading-relaxed">
              Be the first to know about new arrivals, restocks, and exclusive deals. From dresses to electronics, we keep you updated on the latest products.
            </p>
          </div>

          {/* Right Form */}
          <div className="w-full max-w-md bg-white/5 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 pwa-submit-form">
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 bg-transparent border-none text-white placeholder-white/40 px-5 py-3 focus:ring-0 text-base"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-emerald-400 hover:bg-emerald-500 text-emerald-950 font-bold px-6 py-3 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed shadow-lg whitespace-nowrap text-sm"
              >
                {isSubmitting ? (
                  <i className="ri-loader-4-line animate-spin text-lg"></i>
                ) : (
                  <span className="flex items-center gap-2">
                    Join <i className="ri-arrow-right-line"></i>
                  </span>
                )}
              </button>
            </form>
          </div>

        </div>

        {submitStatus === 'success' && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-400 text-emerald-950 px-6 py-2 rounded-full font-bold shadow-lg animate-in fade-in slide-in-from-bottom-2">
            <i className="ri-checkbox-circle-line mr-2"></i> Welcome to the club!
          </div>
        )}
      </div>
    </div>
  );
}
