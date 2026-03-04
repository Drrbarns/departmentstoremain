'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';

export default function SettingsPage() {
  const { getSetting, updateSetting, refreshCMS } = useCMS();

  const [saving, setSaving] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState<'dark' | 'white' | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Local form state
  const [siteName, setSiteName] = useState(getSetting('site_name'));
  const [siteTagline, setSiteTagline] = useState(getSetting('site_tagline'));
  const [contactEmail, setContactEmail] = useState(getSetting('contact_email'));
  const [contactPhone, setContactPhone] = useState(getSetting('contact_phone'));

  const currentDarkLogo = getSetting('site_logo') || '/logo.png';
  const currentWhiteLogo = getSetting('site_logo_white') || '/logo-white.png';

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const uploadLogo = async (file: File, type: 'dark' | 'white') => {
    setUploadingLogo(type);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `branding/logo-${type}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

      const settingKey = type === 'dark' ? 'site_logo' : 'site_logo_white';
      await updateSetting(settingKey, publicUrl);
      await refreshCMS();

      showSuccess(`${type === 'dark' ? 'Header' : 'Footer'} logo updated successfully`);
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingLogo(null);
    }
  };

  const handleSaveGeneral = async () => {
    setSaving('general');
    try {
      await updateSetting('site_name', siteName);
      await updateSetting('site_tagline', siteTagline);
      await updateSetting('contact_email', contactEmail);
      await updateSetting('contact_phone', contactPhone);
      showSuccess('Settings saved successfully');
    } catch (err: any) {
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>
        <p className="text-gray-600 mt-1">Manage your store branding and general information</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          <i className="ri-checkbox-circle-line text-green-600"></i>
          {success}
        </div>
      )}

      {/* Logo Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Logo</h2>
        <p className="text-sm text-gray-600 mb-6">
          Upload separate logos for the header and footer. Use a dark logo on the header (light background) and a white/light logo on the footer (dark background).
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          {/* Dark Logo (Header) */}
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-sun-line text-gray-700"></i>
              <h3 className="font-semibold text-gray-900">Header Logo</h3>
              <span className="text-xs text-gray-500">(dark version)</span>
            </div>

            <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center mb-4 h-24">
              <img
                src={currentDarkLogo}
                alt="Header Logo"
                className="max-h-16 max-w-full object-contain"
                key={currentDarkLogo}
              />
            </div>

            <label className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer text-sm font-medium text-gray-600 hover:text-blue-700 ${uploadingLogo === 'dark' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {uploadingLogo === 'dark' ? (
                <><i className="ri-loader-4-line animate-spin"></i> Uploading...</>
              ) : (
                <><i className="ri-upload-2-line"></i> Upload New Logo</>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingLogo !== null}
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0], 'dark')}
              />
            </label>
          </div>

          {/* White Logo (Footer) */}
          <div className="border-2 border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-moon-line text-gray-700"></i>
              <h3 className="font-semibold text-gray-900">Footer Logo</h3>
              <span className="text-xs text-gray-500">(white/light version)</span>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-center mb-4 h-24">
              <img
                src={currentWhiteLogo}
                alt="Footer Logo"
                className="max-h-16 max-w-full object-contain"
                key={currentWhiteLogo}
              />
            </div>

            <label className={`flex items-center justify-center gap-2 w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors cursor-pointer text-sm font-medium text-gray-600 hover:text-blue-700 ${uploadingLogo === 'white' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {uploadingLogo === 'white' ? (
                <><i className="ri-loader-4-line animate-spin"></i> Uploading...</>
              ) : (
                <><i className="ri-upload-2-line"></i> Upload New Logo</>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingLogo !== null}
                onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0], 'white')}
              />
            </label>
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          <i className="ri-information-line mr-1"></i>
          Recommended: PNG with transparent background, min 400px wide. Changes take effect immediately.
        </p>
      </div>

      {/* General Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6">General Information</h2>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Store Name</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Discount Discovery Zone"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Tagline</label>
              <input
                type="text"
                value={siteTagline}
                onChange={(e) => setSiteTagline(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Dresses, Electronics, Bags, Shoes & More"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Contact Phone</label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveGeneral}
          disabled={saving === 'general'}
          className="mt-6 px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving === 'general' ? (
            <><i className="ri-loader-4-line animate-spin"></i> Saving...</>
          ) : (
            <><i className="ri-save-line"></i> Save Changes</>
          )}
        </button>
      </div>
    </div>
  );
}
