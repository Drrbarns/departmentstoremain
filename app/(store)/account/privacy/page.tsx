'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PrivacySettingsPage() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleExportData = async () => {
    setExporting(true);
    
    setTimeout(() => {
      const userData = {
        personalInfo: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          createdAt: '2024-01-15'
        },
        orders: [
          { id: 'ORD-2024-001', date: '2024-03-15', total: 129.99 },
          { id: 'ORD-2024-002', date: '2024-03-20', total: 89.99 }
        ],
        addresses: [
          { type: 'Home', street: '123 Main St', city: 'New York', zip: '10001' }
        ],
        preferences: {
          newsletter: true,
          smsNotifications: false,
          marketing: true
        }
      };

      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `my-data-export-${Date.now()}.json`;
      link.click();
      
      setExporting(false);
      alert('Your data has been downloaded successfully!');
    }, 2000);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    setDeleting(true);
    
    setTimeout(() => {
      alert('Account deletion request submitted. You will receive a confirmation email within 24 hours.');
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
      setDeleting(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link href="/account" className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors">
              <i className="ri-arrow-left-line text-xl"></i>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Privacy & Data</h1>
              <p className="text-sm text-gray-600">Manage your personal information</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex gap-3">
            <i className="ri-shield-check-line text-xl text-emerald-600 flex-shrink-0 mt-0.5"></i>
            <div>
              <h3 className="font-semibold text-emerald-900 mb-1">Your Privacy Matters</h3>
              <p className="text-sm text-emerald-800">
                We are committed to protecting your personal information in compliance with GDPR, CCPA, and other privacy regulations.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold mb-4">Data Export</h2>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <i className="ri-download-cloud-line text-lg"></i>
                Download Your Data
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Get a complete copy of all your personal information, orders, and preferences in JSON format.
              </p>
              <button
                onClick={handleExportData}
                disabled={exporting}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium whitespace-nowrap"
              >
                {exporting ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Preparing Export...
                  </>
                ) : (
                  <>
                    <i className="ri-download-line mr-2"></i>
                    Export My Data
                  </>
                )}
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">What's Included?</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-green-600 mt-0.5 flex-shrink-0"></i>
                  <span>Personal information (name, email, phone)</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-green-600 mt-0.5 flex-shrink-0"></i>
                  <span>Order history and transaction details</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-green-600 mt-0.5 flex-shrink-0"></i>
                  <span>Saved addresses and payment methods</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-green-600 mt-0.5 flex-shrink-0"></i>
                  <span>Marketing preferences and subscriptions</span>
                </li>
                <li className="flex items-start gap-2">
                  <i className="ri-check-line text-green-600 mt-0.5 flex-shrink-0"></i>
                  <span>Wishlist and browsing history</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-lg font-bold mb-4 text-red-600">Danger Zone</h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <i className="ri-delete-bin-line text-lg"></i>
                Delete Account
              </h3>
              <p className="text-sm text-red-800 mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium whitespace-nowrap"
                >
                  Request Account Deletion
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 border border-red-300">
                    <h4 className="font-semibold text-red-900 mb-2">⚠️ Before You Continue:</h4>
                    <ul className="space-y-2 text-sm text-gray-700 mb-4">
                      <li className="flex items-start gap-2">
                        <i className="ri-alert-line text-red-600 mt-0.5 flex-shrink-0"></i>
                        <span>All your orders and purchase history will be deleted</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-alert-line text-red-600 mt-0.5 flex-shrink-0"></i>
                        <span>Your loyalty points and rewards will be forfeited</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-alert-line text-red-600 mt-0.5 flex-shrink-0"></i>
                        <span>Active subscriptions will be cancelled</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <i className="ri-alert-line text-red-600 mt-0.5 flex-shrink-0"></i>
                        <span>This action cannot be reversed</span>
                      </li>
                    </ul>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2 text-gray-900">
                        Type <span className="font-bold">DELETE</span> to confirm:
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="DELETE"
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium whitespace-nowrap"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== 'DELETE' || deleting}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium whitespace-nowrap"
                      >
                        {deleting ? (
                          <>
                            <i className="ri-loader-4-line animate-spin mr-2"></i>
                            Processing...
                          </>
                        ) : (
                          'Delete My Account'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-4">Your Privacy Rights</h2>
          <div className="space-y-4 text-sm text-gray-700">
            <div className="flex gap-3">
              <i className="ri-eye-line text-lg text-gray-400 flex-shrink-0"></i>
              <div>
                <h3 className="font-semibold mb-1">Right to Access</h3>
                <p className="text-gray-600">You can request and download all your personal data at any time.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <i className="ri-edit-line text-lg text-gray-400 flex-shrink-0"></i>
              <div>
                <h3 className="font-semibold mb-1">Right to Rectification</h3>
                <p className="text-gray-600">You can update and correct your personal information in account settings.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <i className="ri-delete-bin-line text-lg text-gray-400 flex-shrink-0"></i>
              <div>
                <h3 className="font-semibold mb-1">Right to Erasure</h3>
                <p className="text-gray-600">You can request complete deletion of your account and all data.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <i className="ri-file-shield-line text-lg text-gray-400 flex-shrink-0"></i>
              <div>
                <h3 className="font-semibold mb-1">Right to Data Portability</h3>
                <p className="text-gray-600">Export your data in a structured, machine-readable format.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-100 rounded-xl p-4">
          <p className="text-sm text-gray-600 text-center">
            Questions about privacy? Read our{' '}
            <Link href="/privacy" className="text-black font-medium hover:underline">
              Privacy Policy
            </Link>
            {' '}or{' '}
            <Link href="/contact" className="text-black font-medium hover:underline">
              contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
