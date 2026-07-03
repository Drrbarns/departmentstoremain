'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import OrderHistory from './OrderHistory';
import AddressBook from './AddressBook';
import AffiliateDashboardPanel from '@/components/AffiliateDashboardPanel';
import { supabase } from '@/lib/supabase';

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'profile';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Update active tab when URL param changes
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'orders', 'addresses', 'security', 'affiliate'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Profile Form States
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form States
  const [passwordData, setPasswordData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login');
        return;
      }

      setUser(session.user);
      setProfileData({
        firstName: session.user.user_metadata?.first_name || '',
        lastName: session.user.user_metadata?.last_name || '',
        email: session.user.email || '',
        phone: session.user.phone || ''
      });
      setLoading(false);
    }
    checkUser();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          first_name: profileData.firstName,
          last_name: profileData.lastName,
          phone: profileData.phone // Storing phone in metadata for now
        }
      });

      if (error) throw error;
      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (passwordData.password.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setPasswordLoading(true);
    setPasswordMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.password
      });
      if (error) throw error;
      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setPasswordData({ password: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ecfdf5]/50">
        <i className="ri-loader-4-line animate-spin text-4xl text-emerald-600"></i>
      </div>
    );
  }

  const quickActions = [
    {
      icon: 'ri-medal-line',
      title: 'Loyalty Program',
      description: 'Earn points and rewards',
      link: '/loyalty'
    },
    {
      icon: 'ri-user-add-line',
      title: 'Refer & Earn',
      description: 'Invite friends and earn rewards',
      link: '/referral'
    }
  ];

  const securityOptions = [
    {
      icon: 'ri-mail-check-line',
      title: 'Verify Email',
      description: user?.email,
      status: user?.email_confirmed_at ? 'verified' : 'unverified',
      link: '#' // /account/verify-email
    },
    {
      icon: 'ri-phone-line',
      title: 'Verify Phone',
      description: user?.phone || 'No phone added',
      status: user?.phone_confirmed_at ? 'verified' : 'unverified',
      link: '#' // /account/verify-phone
    }
  ];

  const tabs = [
    { id: 'profile', icon: 'ri-user-line', label: 'Profile' },
    { id: 'orders', icon: 'ri-shopping-bag-line', label: 'Orders' },
    { id: 'addresses', icon: 'ri-map-pin-line', label: 'Addresses' },
    { id: 'affiliate', icon: 'ri-user-star-line', label: 'Affiliate' },
    { id: 'security', icon: 'ri-shield-keyhole-line', label: 'Security' },
  ];

  const inputCls =
    'w-full h-11 px-4 rounded-xl border border-[#d1fae5] bg-white text-[#0B1B3A] transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200/50 focus:outline-none';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#ecfdf5]/60 to-white py-10 lg:py-14 pb-24 lg:pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Heading */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight text-[#0B1B3A]">My Account</h1>
            <p className="mt-2 text-gray-500">Manage your profile, orders, and delivery addresses.</p>
          </div>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-full border border-[#d1fae5] bg-white px-5 py-2.5 text-sm font-medium text-[#0B1B3A] transition-all hover:border-emerald-300 hover:text-emerald-700"
          >
            <i className="ri-logout-box-r-line"></i>
            Sign Out
          </button>
        </div>

        {/* Pill tabs */}
        <div className="mt-8 mb-8">
          <div className="flex w-full flex-nowrap gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-[#d1fae5]/50 scrollbar-hide sm:w-fit sm:flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'border border-emerald-200 bg-[#ecfdf5] text-emerald-700'
                    : 'border border-transparent text-gray-500 hover:text-[#0B1B3A]'
                }`}
              >
                <i className={`${tab.icon} text-base`}></i>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'profile' && (
            <div className="max-w-2xl space-y-8">
              <div>
                <h3 className="font-serif text-xl font-semibold text-[#0B1B3A]">Personal Information</h3>
                <p className="mt-1 text-sm text-gray-500">Update your personal details and preferences.</p>
              </div>

              {profileMessage.text && (
                <div className={`p-4 rounded-xl flex items-start gap-3 ${profileMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  <i className={`text-xl mt-0.5 ${profileMessage.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`}></i>
                  <div>{profileMessage.text}</div>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0B1B3A]">First Name</label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={e => setProfileData({ ...profileData, firstName: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0B1B3A]">Last Name</label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={e => setProfileData({ ...profileData, lastName: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0B1B3A]">Email Address</label>
                    <div className="relative">
                      <input
                        type="email"
                        value={profileData.email}
                        disabled
                        className="w-full h-11 pl-4 pr-24 rounded-xl border border-[#d1fae5] bg-[#ecfdf5]/50 text-gray-500 cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-1 rounded">Read Only</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0B1B3A]">Phone Number</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={e => setProfileData({ ...profileData, phone: e.target.value })}
                      placeholder="+233 XX XXX XXXX"
                      className={inputCls}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={profileLoading}
                  className="rounded-full bg-emerald-600 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                >
                  {profileLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </form>

              <div className="mt-4 pt-8 border-t border-[#d1fae5]/50">
                <h3 className="font-serif text-xl font-semibold text-[#0B1B3A]">Change Password</h3>
                <p className="mt-1 text-sm text-gray-500 mb-6">Ensure your account uses a strong, unique password.</p>

                {passwordMessage.text && (
                  <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 ${passwordMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                    <i className={`text-xl mt-0.5 ${passwordMessage.type === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}`}></i>
                    <div>{passwordMessage.text}</div>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#0B1B3A]">New Password</label>
                      <input
                        type="password"
                        value={passwordData.password}
                        onChange={e => setPasswordData({ ...passwordData, password: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[#0B1B3A]">Confirm Password</label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="rounded-full border border-[#d1fae5] px-8 py-3 text-sm font-medium text-[#0B1B3A] transition-all hover:border-emerald-400 hover:text-emerald-700 active:scale-95 disabled:opacity-50"
                  >
                    {passwordLoading ? 'Updating…' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'orders' && <OrderHistory />}

          {activeTab === 'addresses' && <AddressBook />}

          {activeTab === 'affiliate' && (
            <div>
              <h3 className="font-serif text-xl font-semibold text-[#0B1B3A] mb-6">Affiliate</h3>
              <AffiliateDashboardPanel />
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h3 className="font-serif text-xl font-semibold text-[#0B1B3A] mb-6">Security Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {securityOptions.map((option, index) => (
                  <Link
                    key={index}
                    href={option.link}
                    className="flex items-center justify-between p-5 border border-[#d1fae5] rounded-2xl bg-white transition-all hover:border-emerald-300 hover:shadow-md group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 bg-[#ecfdf5] rounded-full flex items-center justify-center text-[#0B1B3A]/70 group-hover:text-emerald-600 transition-colors flex-shrink-0">
                        <i className={`${option.icon} text-xl`}></i>
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-[#0B1B3A] truncate">{option.title}</h4>
                        <p className="text-sm text-gray-500 truncate">{option.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {option.status === 'verified' && (
                        <span className="text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full flex items-center gap-1">
                          <i className="ri-verified-badge-fill"></i> <span className="hidden sm:inline">Verified</span>
                        </span>
                      )}
                      {option.status === 'unverified' && (
                        <span className="text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 bg-amber-50 text-amber-700 rounded-full flex items-center gap-1">
                          <i className="ri-error-warning-fill"></i> <span className="hidden sm:inline">Verify</span>
                        </span>
                      )}
                      <i className="ri-arrow-right-line text-gray-300 group-hover:text-emerald-400 transition-colors"></i>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#ecfdf5]/50">
        <i className="ri-loader-4-line animate-spin text-4xl text-emerald-600"></i>
      </div>
    }>
      <AccountContent />
    </Suspense>
  );
}
