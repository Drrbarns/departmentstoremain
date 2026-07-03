'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useRecaptcha } from '@/hooks/useRecaptcha';

export default function SupportTicketPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    orderNumber: '',
    category: 'order',
    priority: 'normal',
    subject: '',
    description: '',
    attachments: [] as File[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { getToken } = useRecaptcha();

  const categories = [
    { value: 'order', label: 'Order Issue', icon: 'ri-shopping-bag-line' },
    { value: 'delivery', label: 'Delivery Problem', icon: 'ri-truck-line' },
    { value: 'return', label: 'Return Request', icon: 'ri-arrow-left-right-line' },
    { value: 'payment', label: 'Payment Issue', icon: 'ri-bank-card-line' },
    { value: 'product', label: 'Product Question', icon: 'ri-gift-line' },
    { value: 'account', label: 'Account Help', icon: 'ri-user-line' },
    { value: 'other', label: 'Other', icon: 'ri-question-line' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // reCAPTCHA verification
    const isHuman = await getToken('support_ticket');
    if (!isHuman) {
      setIsSubmitting(false);
      alert('Security verification failed. Please try again.');
      return;
    }
    
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccess(true);
      setTimeout(() => {
        router.push('/support/tickets');
      }, 2000);
    }, 1500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData({
        ...formData,
        attachments: Array.from(e.target.files)
      });
    }
  };

  if (showSuccess) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
          <div className="max-w-md mx-auto px-4 text-center">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="w-20 h-20 flex items-center justify-center bg-emerald-100 rounded-full mx-auto mb-6">
                <i className="ri-check-line text-4xl text-emerald-700"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Ticket Created!</h2>
              <p className="text-gray-600 mb-2">
                Your support ticket has been submitted successfully.
              </p>
              <p className="text-sm text-gray-500 mb-6">
                Ticket #TKT-2024-{Math.floor(Math.random() * 10000)}
              </p>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  We'll respond to your email within 24 hours.
                </p>
                <Link
                  href="/support/tickets"
                  className="block bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
                >
                  View My Tickets
                </Link>
                <Link
                  href="/help"
                  className="block text-emerald-700 hover:text-emerald-900 font-semibold whitespace-nowrap"
                >
                  Back to Help Center
                </Link>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <Link
            href="/help"
            className="inline-flex items-center text-emerald-700 hover:text-emerald-900 font-semibold mb-6 whitespace-nowrap"
          >
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Help Center
          </Link>

          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Support Ticket</h1>
              <p className="text-gray-600">
                Fill out the form below and our team will get back to you within 24 hours
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Order Number (if applicable)
                </label>
                <input
                  type="text"
                  value={formData.orderNumber}
                  onChange={(e) => setFormData({ ...formData, orderNumber: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="ORD-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  What can we help you with? *
                </label>
                <div className="grid md:grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, category: cat.value })}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.category === cat.value
                          ? 'border-emerald-700 bg-emerald-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <i className={`${cat.icon} text-2xl ${
                          formData.category === cat.value ? 'text-emerald-700' : 'text-gray-400'
                        }`}></i>
                        <span className="font-semibold text-gray-900">{cat.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Priority Level *
                </label>
                <div className="flex space-x-4">
                  <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.priority === 'low' ? 'border-gray-700 bg-gray-50' : 'border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      value="low"
                      checked={formData.priority === 'low'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">Low</p>
                      <p className="text-xs text-gray-600">3-5 days</p>
                    </div>
                  </label>
                  <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.priority === 'normal' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      value="normal"
                      checked={formData.priority === 'normal'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">Normal</p>
                      <p className="text-xs text-gray-600">1-2 days</p>
                    </div>
                  </label>
                  <label className={`flex-1 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    formData.priority === 'high' ? 'border-red-700 bg-red-50' : 'border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      value="high"
                      checked={formData.priority === 'high'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <p className="font-semibold text-gray-900">High</p>
                      <p className="text-xs text-gray-600">Within 24h</p>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Brief description of your issue"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 h-32 resize-none"
                  placeholder="Please provide as much detail as possible..."
                  required
                  maxLength={500}
                />
                <p className="text-sm text-gray-500 mt-1">
                  {formData.description.length}/500 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Attachments (optional)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <input
                    type="file"
                    onChange={handleFileChange}
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer"
                  >
                    <i className="ri-upload-cloud-line text-4xl text-gray-400 mb-2"></i>
                    <p className="text-gray-900 font-semibold mb-1">
                      Click to upload files
                    </p>
                    <p className="text-sm text-gray-500">
                      PNG, JPG, PDF up to 10MB
                    </p>
                  </label>
                  {formData.attachments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {formData.attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-center space-x-2 text-sm text-gray-600">
                          <i className="ri-file-line"></i>
                          <span>{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-4 pt-6">
                <button
                  type="button"
                  onClick={() => router.push('/help')}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2"></i>
                      Submitting...
                    </>
                  ) : (
                    'Submit Ticket'
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-xl p-6">
            <div className="flex items-start space-x-3">
              <i className="ri-information-line text-2xl text-emerald-700 mt-0.5"></i>
              <div>
                <p className="font-semibold text-emerald-900 mb-2">Before submitting a ticket</p>
                <ul className="text-sm text-emerald-700 space-y-1">
                  <li>• Check our <Link href="/help" className="underline hover:text-emerald-900">Help Center</Link> for quick answers</li>
                  <li>• Average response time: 24 hours</li>
                  <li>• Include your order number for faster assistance</li>
                  <li>• Attach photos if reporting a product issue</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
