"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useCMS } from '@/context/CMSContext';
import { PUBLIC_CONTACT_PHONE } from '@/lib/brand-contact';

function FooterSection({ title, children }: { title: string, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-blue-800/50 lg:border-none last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left lg:py-0 lg:cursor-default lg:mb-6"
      >
        <h4 className="font-bold text-lg text-white">{title}</h4>
        <i className={`ri-arrow-down-s-line text-blue-400 text-xl transition-transform duration-300 lg:hidden ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-6' : 'max-h-0 lg:max-h-full lg:overflow-visible'}`}>
        {children}
      </div>
    </div>
  );
}

export default function Footer() {
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || 'Discount Discovery Zone';
  const siteTagline = getSetting('site_tagline') || 'Dresses, Electronics, Bags, Shoes & More.';
  const contactEmail = getSetting('contact_email') || '';
  const contactPhone = getSetting('contact_phone') || PUBLIC_CONTACT_PHONE;
  const socialFacebook = getSetting('social_facebook') || '';
  const socialInstagram = getSetting('social_instagram') || 'https://www.instagram.com/mey_phua';
  const socialTwitter = getSetting('social_twitter') || 'https://x.com/mey_phua';
  const socialTiktok = getSetting('social_tiktok') || 'https://www.tiktok.com/@mey_phua';
  const socialSnapchat = getSetting('social_snapchat') || 'https://snapchat.com/t/eL9wfuQa';
  const socialYoutube = getSetting('social_youtube') || 'https://youtube.com/@mey_phua';

  return (
    <footer className="relative mt-12 z-0">

      {/* Footer Background Shape */}
      <div className="absolute inset-0 bg-blue-950 rounded-t-[3rem] -z-10 overflow-hidden">
        {/* Decorative elements inside footer bg */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-800 to-transparent opacity-30"></div>
      </div>

      <div className="text-white pt-16 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">

            {/* Brand Column */}
            <div className="lg:col-span-1 space-y-6">
              <Link href="/" className="inline-block group">
                {getSetting('site_logo_white') ? (
                  <img src={getSetting('site_logo_white')} alt={siteName} className="h-16 w-auto object-contain drop-shadow-lg group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <span className="text-2xl font-bold text-white tracking-tight">{siteName}</span>
                )}
              </Link>
              <p className="text-blue-200/60 leading-relaxed text-sm">
                Your one-stop shop for dresses, electronics, bags, shoes and more. Locally sourced and imported quality products from Accra, Ghana.
              </p>

              <div className="flex gap-3 pt-2">
                {[
                  { link: socialInstagram, icon: 'ri-instagram-line' },
                  { link: socialTiktok, icon: 'ri-tiktok-fill' },
                  { link: socialSnapchat, icon: 'ri-snapchat-fill' },
                  { link: socialYoutube, icon: 'ri-youtube-fill' },
                  { link: socialTwitter, icon: 'ri-twitter-x-fill' },
                  { link: socialFacebook, icon: 'ri-facebook-fill' }
                ].map((social, i) => social.link && (
                  <a
                    key={i}
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-blue-900/40 border border-blue-800 rounded-full flex items-center justify-center text-blue-300 hover:bg-blue-500 hover:text-blue-950 hover:border-blue-500 transition-all hover:-translate-y-1"
                  >
                    <i className={social.icon}></i>
                  </a>
                ))}
              </div>
            </div>

            {/* Links Sections */}
            <div className="lg:col-span-3 grid md:grid-cols-3 gap-8 lg:gap-12 pl-0 lg:pl-12">

              <div className="space-y-6">
                <h4 className="font-serif text-xl font-bold text-white">Shop</h4>
                <ul className="space-y-3 text-blue-100/60 text-sm">
                  <li><Link href="/shop" className="hover:text-blue-300 transition-colors">All Products</Link></li>
                  <li><Link href="/categories" className="hover:text-blue-300 transition-colors">Collections</Link></li>
                  <li><Link href="/shop?sort=newest" className="hover:text-blue-300 transition-colors">New Arrivals</Link></li>
                  <li><Link href="/shop?sort=bestsellers" className="hover:text-blue-300 transition-colors">Best Sellers</Link></li>
                </ul>
              </div>

              <div className="space-y-6">
                <h4 className="font-serif text-xl font-bold text-white">Support</h4>
                <ul className="space-y-3 text-blue-100/60 text-sm">
                  <li><Link href="/contact" className="hover:text-blue-300 transition-colors">Contact Us</Link></li>
                  <li><Link href="/order-tracking" className="hover:text-blue-300 transition-colors">Track Order</Link></li>
                  <li><Link href="/shipping" className="hover:text-blue-300 transition-colors">Shipping & Delivery</Link></li>
                  <li><Link href="/returns" className="hover:text-blue-300 transition-colors">Returns & Exchange</Link></li>
                </ul>
              </div>

              <div className="space-y-6">
                <h4 className="font-serif text-xl font-bold text-white">Company</h4>
                <ul className="space-y-3 text-blue-100/60 text-sm">
                  <li><Link href="/about" className="hover:text-blue-300 transition-colors">Our Story</Link></li>
                  <li><Link href="/privacy" className="hover:text-blue-300 transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-blue-300 transition-colors">Terms of Service</Link></li>
                  <li><Link href="/admin" className="hover:text-blue-300 transition-colors">Admin Access</Link></li>
                </ul>
              </div>

            </div>
          </div>

          <div className="border-t border-blue-900/50 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-blue-500/40">
            <p>&copy; {new Date().getFullYear()} {siteName}. All rights reserved.</p>
            <div className="flex gap-4 opacity-40">
              <i className="ri-visa-line text-2xl"></i>
              <i className="ri-mastercard-line text-2xl"></i>
              <i className="ri-paypal-line text-2xl"></i>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
