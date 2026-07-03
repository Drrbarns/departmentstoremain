'use client';

import { useState } from 'react';

interface Address {
  id: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

export default function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const deleteAddress = (id: string) => {
    setAddresses(addresses.filter(addr => addr.id !== id));
  };

  const setDefault = (id: string) => {
    setAddresses(addresses.map(addr => ({
      ...addr,
      isDefault: addr.id === id
    })));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Address Book</h2>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap"
        >
          <i className="ri-add-line mr-2"></i>
          Add New Address
        </button>
      </div>

      {showForm && (
        <div className="bg-white border-2 border-emerald-700 rounded-lg p-6 mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            {editingId ? 'Edit Address' : 'New Address'}
          </h3>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Full Name</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Phone Number</label>
              <input
                type="tel"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent"
                placeholder="+233 24 123 4567"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Street Address</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent"
                placeholder="123 Oxford Street"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">City</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent"
                placeholder="Accra"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">State / Region</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent"
                placeholder="Greater Accra"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Zip Code</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent"
                placeholder="00233"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Country</label>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-700 focus:border-transparent"
                placeholder="Ghana"
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center">
                <input type="checkbox" className="w-4 h-4 text-emerald-700 border-gray-300 rounded focus:ring-emerald-700" />
                <span className="ml-2 text-sm text-gray-700">Set as default address</span>
              </label>
            </div>
            <div className="md:col-span-2 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
              <button
                type="submit"
                className="flex-1 py-3 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap"
              >
                Save Address
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="flex-1 py-3 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {addresses.map((address) => (
          <div
            key={address.id}
            className={`bg-white border-2 rounded-lg p-6 relative ${address.isDefault ? 'border-emerald-700' : 'border-gray-200'
              }`}
          >
            {address.isDefault && (
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 bg-emerald-700 text-white text-xs font-semibold rounded-full whitespace-nowrap">
                  Default
                </span>
              </div>
            )}

            <div className="mb-4">
              <h3 className="text-lg font-bold text-gray-900">{address.name}</h3>
              <p className="text-gray-600">{address.phone}</p>
            </div>

            <div className="text-gray-700 space-y-1 mb-6">
              <p>{address.street}</p>
              <p>{address.city}, {address.state} {address.zipCode}</p>
              <p>{address.country}</p>
            </div>

            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <button
                onClick={() => {
                  setEditingId(address.id);
                  setShowForm(true);
                }}
                className="flex-1 py-2 border border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Edit
              </button>
              {!address.isDefault && (
                <button
                  onClick={() => setDefault(address.id)}
                  className="flex-1 py-2 border border-emerald-700 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-50 transition-colors whitespace-nowrap"
                >
                  Set Default
                </button>
              )}
              <button
                onClick={() => deleteAddress(address.id)}
                className="px-4 py-2 border border-red-600 text-red-600 rounded-lg font-semibold hover:bg-red-50 transition-colors whitespace-nowrap"
              >
                <i className="ri-delete-bin-line"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
