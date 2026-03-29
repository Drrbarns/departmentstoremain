'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { getOptimizedImageUrl } from '@/lib/imageOptimization';

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  status: string;
  paymentStatus: string;
  total: number;
  items: {
    id: string;
    name: string;
    image: string;
    quantity: number;
    price: number;
  }[];
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('orders')
          .select(`
                    *,
                    order_items (*)
                `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const formattedOrders = data.map((order: any) => ({
            id: order.id,
            orderNumber: order.order_number,
            date: order.created_at,
            status: order.status,
            paymentStatus: order.payment_status,
            total: order.total,
            items: order.order_items.map((item: any) => ({
              id: item.id,
              name: item.product_name,
              image: item.metadata?.image || 'https://via.placeholder.com/150',
              quantity: item.quantity,
              price: item.unit_price
            }))
          }));
          setOrders(formattedOrders);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700';
      case 'shipped': return 'bg-blue-100 text-blue-700';
      case 'picked_up': return 'bg-indigo-100 text-indigo-700';
      case 'processing': return 'bg-yellow-100 text-yellow-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      case 'refund_requested': return 'bg-orange-100 text-orange-700';
      case 'refunded': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'shipped': return 'Packaged';
      case 'picked_up': return 'Picked Up by Rider';
      case 'refund_requested': return 'Refund Requested';
      case 'refunded': return 'Refunded';
      default: return status.replace('_', ' ').replace(/^\w/, (c: string) => c.toUpperCase());
    }
  };

  const handleReorder = (order: Order) => {
    // Implement reorder logic (add items back to cart)
    console.log('Reordering:', order);
    alert('Reorder feature coming soon!');
  };

  const handleDownloadInvoice = (orderId: string) => {
    console.log('Downloading invoice for order:', orderId);
    alert('Invoice download coming soon!');
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <i className="ri-loader-4-line animate-spin text-3xl text-blue-700"></i>
        <p className="mt-2 text-gray-500">Loading orders...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-lg border border-gray-200">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-shopping-bag-line text-3xl text-gray-400"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No orders yet</h3>
        <p className="text-gray-500 mb-6">Start shopping to see your orders here.</p>
        <Link href="/shop" className="inline-block bg-blue-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-800 transition-colors">
          Go to Shop
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Order History</h2>
        <div className="text-sm text-gray-600">
          Total Orders: <span className="font-bold text-gray-900">{orders.length}</span>
        </div>
      </div>

      <div className="space-y-6">
        {orders.map((order) => (
          <div key={order.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
                  <div className="w-full sm:w-auto">
                    <p className="text-xs text-gray-600 mb-1">Order Number</p>
                    <p className="font-bold text-gray-900">{order.orderNumber}</p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <p className="text-xs text-gray-600 mb-1">Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(order.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="w-full sm:w-auto">
                    <p className="text-xs text-gray-600 mb-1">Total</p>
                    <p className="font-bold text-blue-700">GH₵{order.total.toFixed(2)}</p>
                  </div>
                </div>
                <div className="w-full sm:w-auto">
                  <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex space-x-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      <img
                        src={getOptimizedImageUrl(item.image, { width: 160 })}
                        alt={item.name}
                        className="w-full h-full object-cover object-center"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>
                      <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      <p className="text-sm font-bold text-gray-900 mt-1">GH₵{item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {order.status === 'refund_requested' && (
                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
                  <i className="ri-information-line text-orange-600 mt-0.5 flex-shrink-0"></i>
                  <p className="text-sm text-orange-800">
                    <strong>Refund requested.</strong> Our team is reviewing your request and will process the refund manually. Please keep your order number handy.
                  </p>
                </div>
              )}
              {order.status === 'refunded' && (
                <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-start gap-2">
                  <i className="ri-checkbox-circle-line text-purple-600 mt-0.5 flex-shrink-0"></i>
                  <p className="text-sm text-purple-800">
                    <strong>Refund processed.</strong> Your refund has been completed. Please allow a few business days for it to reflect.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-4 border-t border-gray-200">
                <Link
                  href={`/order-tracking?order=${order.orderNumber}`}
                  className="flex-1 sm:flex-none text-center px-4 py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap"
                >
                  <i className="ri-map-pin-line mr-2"></i>
                  Track Order
                </Link>
                <button
                  onClick={() => handleReorder(order)}
                  className="flex-1 sm:flex-none px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-refresh-line mr-2"></i>
                  Reorder
                </button>
                <button
                  onClick={() => handleDownloadInvoice(order.id)}
                  className="flex-1 sm:flex-none px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-download-line mr-2"></i>
                  Invoice
                </button>
                <Link
                  href="/contact"
                  className="flex-1 sm:flex-none text-center px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-customer-service-line mr-2"></i>
                  Get Help
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
