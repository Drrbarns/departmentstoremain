'use client';

import { useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const categories = [
  {
    id: 'orders',
    title: 'Orders & Delivery',
    icon: 'ri-shopping-bag-line',
    count: 12,
    articles: [
      { id: 1, title: 'How do I track my order?', views: 1247 },
      { id: 2, title: 'What are the delivery times?', views: 892 },
      { id: 3, title: 'Can I change my delivery address?', views: 654 },
      { id: 4, title: 'What if my order is delayed?', views: 543 },
      { id: 5, title: 'Do you offer express delivery?', views: 421 }
    ]
  },
  {
    id: 'returns',
    title: 'Returns & Refunds',
    icon: 'ri-arrow-left-right-line',
    count: 10,
    articles: [
      { id: 6, title: 'How do I return an item?', views: 2341 },
      { id: 7, title: 'What is your return policy?', views: 1876 },
      { id: 8, title: 'When will I get my refund?', views: 1432 },
      { id: 9, title: 'Can I exchange instead of return?', views: 987 },
      { id: 10, title: 'How do I print a return label?', views: 765 }
    ]
  },
  {
    id: 'payment',
    title: 'Payment & Pricing',
    icon: 'ri-bank-card-line',
    count: 8,
    articles: [
      { id: 11, title: 'What payment methods do you accept?', views: 1654 },
      { id: 12, title: 'Is my payment information secure?', views: 1234 },
      { id: 13, title: 'Can I pay in installments?', views: 987 },
      { id: 14, title: 'Do you accept gift cards?', views: 543 },
      { id: 15, title: 'Why was my payment declined?', views: 432 }
    ]
  },
  {
    id: 'account',
    title: 'Account & Profile',
    icon: 'ri-user-line',
    count: 9,
    articles: [
      { id: 16, title: 'How do I create an account?', views: 876 },
      { id: 17, title: 'I forgot my password', views: 1543 },
      { id: 18, title: 'How do I update my email?', views: 654 },
      { id: 19, title: 'Can I delete my account?', views: 432 },
      { id: 20, title: 'How do I manage my addresses?', views: 543 }
    ]
  },
  {
    id: 'products',
    title: 'Products & Stock',
    icon: 'ri-gift-line',
    count: 7,
    articles: [
      { id: 21, title: 'When will items be back in stock?', views: 1987 },
      { id: 22, title: 'How do I use the size guide?', views: 876 },
      { id: 23, title: 'Are your products authentic?', views: 765 },
      { id: 24, title: 'Do you offer gift wrapping?', views: 543 },
      { id: 25, title: 'How do I care for my product?', views: 432 }
    ]
  },
  {
    id: 'loyalty',
    title: 'Loyalty & Rewards',
    icon: 'ri-medal-line',
    count: 6,
    articles: [
      { id: 26, title: 'How do I earn loyalty points?', views: 2134 },
      { id: 27, title: 'How do I redeem my points?', views: 1765 },
      { id: 28, title: 'Do my points expire?', views: 987 },
      { id: 29, title: 'What are the loyalty tiers?', views: 654 },
      { id: 30, title: 'How does the referral program work?', views: 543 }
    ]
  }
];

const popularArticles = [
  { id: 1, title: 'How do I track my order?', category: 'Orders', views: 1247 },
  { id: 6, title: 'How do I return an item?', category: 'Returns', views: 2341 },
  { id: 26, title: 'How do I earn loyalty points?', category: 'Loyalty', views: 2134 },
  { id: 21, title: 'When will items be back in stock?', category: 'Products', views: 1987 },
  { id: 7, title: 'What is your return policy?', category: 'Returns', views: 1876 }
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredCategories = selectedCategory
    ? categories.filter(cat => cat.id === selectedCategory)
    : categories;

  const filteredArticles = searchQuery
    ? categories.flatMap(cat => 
        cat.articles.filter(article => 
          article.title.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(article => ({ ...article, category: cat.title }))
      )
    : [];

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 text-white py-16">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold mb-4">How can we help you?</h1>
            <p className="text-emerald-100 mb-8 text-lg">Search our help center or browse by category</p>
            
            <div className="relative max-w-2xl mx-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for articles..."
                className="w-full px-6 py-4 pl-14 rounded-xl text-gray-900 text-lg focus:outline-none focus:ring-4 focus:ring-emerald-300"
              />
              <i className="ri-search-line absolute left-5 top-1/2 -translate-y-1/2 text-2xl text-gray-400"></i>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"
                >
                  <i className="ri-close-line text-xl"></i>
                </button>
              )}
            </div>

            {searchQuery && filteredArticles.length > 0 && (
              <div className="mt-4 bg-white rounded-xl shadow-lg text-left max-w-2xl mx-auto max-h-96 overflow-y-auto">
                {filteredArticles.map((article) => (
                  <Link
                    key={article.id}
                    href={`/help/article/${article.id}`}
                    className="block p-4 hover:bg-gray-50 border-b border-gray-200 last:border-0"
                  >
                    <p className="font-semibold text-gray-900">{article.title}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {article.category} • {article.views.toLocaleString()} views
                    </p>
                  </Link>
                ))}
              </div>
            )}

            {searchQuery && filteredArticles.length === 0 && (
              <div className="mt-4 bg-white rounded-xl shadow-lg p-6 text-center max-w-2xl mx-auto">
                <i className="ri-file-search-line text-4xl text-gray-400 mb-2"></i>
                <p className="text-gray-900 font-semibold">No results found</p>
                <p className="text-sm text-gray-600 mt-1">Try different keywords or browse categories below</p>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Browse by Category</h2>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-emerald-700 hover:text-emerald-900 font-semibold whitespace-nowrap"
              >
                <i className="ri-arrow-left-line mr-2"></i>
                All Categories
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {filteredCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className="bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-lg transition-all border-2 border-transparent hover:border-emerald-700"
              >
                <div className="w-14 h-14 flex items-center justify-center bg-emerald-100 rounded-xl mb-4">
                  <i className={`${category.icon} text-3xl text-emerald-700`}></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{category.title}</h3>
                <p className="text-gray-600">{category.count} articles</p>
                
                {selectedCategory === category.id && (
                  <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                    {category.articles.map((article) => (
                      <Link
                        key={article.id}
                        href={`/help/article/${article.id}`}
                        className="block text-sm text-gray-700 hover:text-emerald-700 font-medium"
                      >
                        • {article.title}
                      </Link>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm p-8 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Popular Articles</h2>
            <div className="space-y-4">
              {popularArticles.map((article, index) => (
                <Link
                  key={article.id}
                  href={`/help/article/${article.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 flex items-center justify-center bg-emerald-100 text-emerald-700 rounded-full font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{article.title}</p>
                      <p className="text-sm text-gray-600">{article.category}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-500">{article.views.toLocaleString()} views</span>
                    <i className="ri-arrow-right-s-line text-2xl text-gray-400"></i>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Link
              href="/support/ticket"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-all text-center"
            >
              <div className="w-16 h-16 flex items-center justify-center bg-emerald-100 rounded-full mx-auto mb-4">
                <i className="ri-customer-service-2-line text-3xl text-emerald-700"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Contact Support</h3>
              <p className="text-gray-600 text-sm mb-4">Get help from our support team</p>
              <span className="text-emerald-700 font-semibold whitespace-nowrap">Create Ticket →</span>
            </Link>

            <Link
              href="/returns"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-all text-center"
            >
              <div className="w-16 h-16 flex items-center justify-center bg-purple-100 rounded-full mx-auto mb-4">
                <i className="ri-arrow-left-right-line text-3xl text-purple-700"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Start a Return</h3>
              <p className="text-gray-600 text-sm mb-4">Return or exchange your item</p>
              <span className="text-purple-700 font-semibold whitespace-nowrap">Initiate Return →</span>
            </Link>

            <Link
              href="/order-tracking"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-lg transition-all text-center"
            >
              <div className="w-16 h-16 flex items-center justify-center bg-amber-100 rounded-full mx-auto mb-4">
                <i className="ri-map-pin-line text-3xl text-amber-700"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Track Order</h3>
              <p className="text-gray-600 text-sm mb-4">Check your order status</p>
              <span className="text-amber-700 font-semibold whitespace-nowrap">Track Now →</span>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
