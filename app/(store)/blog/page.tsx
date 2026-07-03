import Link from 'next/link';

export default function BlogPage() {
  const featuredPost = {
    id: '1',
    title: 'The Ultimate Guide to Online Shopping in Ghana',
    excerpt: 'Everything you need to know about safe, convenient online shopping in Ghana. From payment methods to delivery options, we cover it all.',
    image: 'https://readdy.ai/api/search-image?query=Modern%20African%20woman%20shopping%20online%20on%20laptop%20in%20bright%20contemporary%20home%20office%20coffee%20cup%20plants%20natural%20light%20relaxed%20lifestyle%20photography%20minimal%20clean%20background&width=1200&height=600&seq=blog1&orientation=landscape',
    category: 'Shopping Tips',
    date: 'December 15, 2024',
    readTime: '8 min read',
    author: 'Ama Osei'
  };

  const posts = [
    {
      id: '2',
      title: '10 Must-Have Products for Your Home This Season',
      excerpt: 'Discover the trending products that will elevate your living space and make your home more comfortable and stylish.',
      image: 'https://readdy.ai/api/search-image?query=Beautiful%20modern%20African%20home%20interior%20with%20stylish%20furniture%20decor%20items%20plants%20bright%20natural%20lighting%20contemporary%20design%20magazine%20quality%20photography&width=800&height=500&seq=blog2&orientation=landscape',
      category: 'Home & Living',
      date: 'December 12, 2024',
      readTime: '6 min read',
      author: 'Yaw Darko'
    },
    {
      id: '3',
      title: 'How to Choose Quality Products: A Buyer\'s Guide',
      excerpt: 'Learn the key indicators of quality products and how to make informed purchasing decisions that offer the best value for your money.',
      image: 'https://readdy.ai/api/search-image?query=Person%20examining%20product%20quality%20checking%20labels%20and%20details%20in%20bright%20retail%20setting%20closeup%20hands%20inspecting%20merchandise%20professional%20photography%20clean%20background&width=800&height=500&seq=blog3&orientation=landscape',
      category: 'Buying Guide',
      date: 'December 10, 2024',
      readTime: '7 min read',
      author: 'Kwame Mensah'
    },
    {
      id: '1',
      title: 'The Ultimate Guide to Online Shopping in Ghana',
      excerpt: 'Everything you need to know about safe, convenient online shopping in Ghana. From payment methods to delivery options.',
      image: 'https://readdy.ai/api/search-image?query=Modern%20African%20woman%20shopping%20online%20on%20laptop%20in%20bright%20contemporary%20home%20office%20coffee%20cup%20plants%20natural%20light%20relaxed%20lifestyle%20photography%20minimal%20clean%20background&width=800&height=500&seq=blog1b&orientation=landscape',
      category: 'Shopping Tips',
      date: 'December 15, 2024',
      readTime: '8 min read',
      author: 'Ama Osei'
    }
  ];

  const categories = [
    { name: 'All Posts', count: 12, icon: 'ri-article-line' },
    { name: 'Shopping Tips', count: 5, icon: 'ri-shopping-bag-line' },
    { name: 'Product Reviews', count: 4, icon: 'ri-star-line' },
    { name: 'Home & Living', count: 3, icon: 'ri-home-line' },
    { name: 'Buying Guide', count: 6, icon: 'ri-guide-line' },
    { name: 'News', count: 2, icon: 'ri-newspaper-line' }
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-emerald-50 via-white to-amber-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">Our Blog</h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Shopping tips, product guides, and the latest trends to help you make smarter purchasing decisions.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link href={`/blog/${featuredPost.id}`} className="block mb-16 hover:opacity-90 transition-opacity cursor-pointer">
          <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow">
            <div className="grid md:grid-cols-2 gap-0">
              <div className="relative h-96 md:h-auto">
                <img
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-6 left-6">
                  <span className="bg-emerald-700 text-white px-4 py-2 rounded-full text-sm font-medium">
                    Featured
                  </span>
                </div>
              </div>
              <div className="p-12 flex flex-col justify-center">
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
                    {featuredPost.category}
                  </span>
                  <span>{featuredPost.date}</span>
                  <span className="flex items-center gap-1">
                    <i className="ri-time-line"></i>
                    {featuredPost.readTime}
                  </span>
                </div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
                  {featuredPost.title}
                </h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-6">
                  {featuredPost.excerpt}
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <i className="ri-user-line text-emerald-700"></i>
                  </div>
                  <span className="text-gray-900 font-medium">{featuredPost.author}</span>
                </div>
              </div>
            </div>
          </div>
        </Link>

        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Latest Articles</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.id}`}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="relative h-64">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium text-xs">
                        {post.category}
                      </span>
                      <span className="text-xs">{post.date}</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 mb-4 leading-relaxed text-sm">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <i className="ri-user-line text-gray-600 text-sm"></i>
                        </div>
                        <span className="text-sm text-gray-900 font-medium">{post.author}</span>
                      </div>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <i className="ri-time-line"></i>
                        {post.readTime}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-12 flex justify-center">
              <nav className="flex items-center gap-2">
                <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <i className="ri-arrow-left-s-line text-gray-600"></i>
                </button>
                <button className="w-10 h-10 flex items-center justify-center bg-emerald-700 text-white rounded-lg cursor-pointer">
                  1
                </button>
                <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  2
                </button>
                <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  3
                </button>
                <button className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <i className="ri-arrow-right-s-line text-gray-600"></i>
                </button>
              </nav>
            </div>
          </div>

          <div>
            <div className="bg-gray-50 rounded-2xl p-6 mb-8 sticky top-24">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Categories</h3>
              <div className="space-y-2">
                {categories.map((category, index) => (
                  <button
                    key={index}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <i className={`${category.icon} text-emerald-700`}></i>
                      <span className="text-gray-900 font-medium">{category.name}</span>
                    </div>
                    <span className="text-sm text-gray-500">{category.count}</span>
                  </button>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Newsletter</h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                  Get the latest articles and shopping tips delivered to your inbox weekly.
                </p>
                <form className="space-y-3">
                  <input
                    type="email"
                    placeholder="Your email address"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                  />
                  <button
                    type="submit"
                    className="w-full bg-emerald-700 text-white py-3 rounded-xl font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap"
                  >
                    Subscribe
                  </button>
                </form>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Popular Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {['Shopping', 'Quality', 'Reviews', 'Ghana', 'Delivery', 'Tips', 'Home', 'Style'].map((tag, index) => (
                    <button
                      key={index}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-emerald-500 hover:text-emerald-700 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to Start Shopping?</h2>
          <p className="text-xl text-emerald-100 mb-8 leading-relaxed">
            Browse our range of dresses, electronics, bags, shoes and more
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-white text-emerald-700 px-8 py-4 rounded-full font-medium hover:bg-emerald-50 transition-colors whitespace-nowrap"
          >
            Explore Products
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
