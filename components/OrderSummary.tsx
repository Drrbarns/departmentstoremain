import { getOptimizedImageUrl } from '@/lib/imageOptimization';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  variant?: string;
}

interface OrderSummaryProps {
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  deliveryMethod?: string;
}

export default function OrderSummary({ items, subtotal, shipping, tax, total, deliveryMethod }: OrderSummaryProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 sticky top-4">
      <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

      <div className="space-y-4 mb-6">
        {items.map((item) => (
          <div key={`${item.id}-${item.variant || 'novar'}`} className="flex space-x-4">
            <div className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={getOptimizedImageUrl(item.image, { width: 160 })}
                alt={item.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute -top-2 -right-2 w-6 h-6 flex items-center justify-center bg-blue-700 text-white text-xs font-bold rounded-full">
                {item.quantity}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-sm line-clamp-2">{item.name}</h3>
              {item.variant && <p className="text-xs text-gray-500 mt-0.5">{item.variant}</p>}
              <p className="text-blue-700 font-bold mt-1">GH₵ {item.price.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex justify-between text-gray-700">
          <span>Subtotal</span>
          <span className="font-semibold">GH₵ {subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-gray-700">
          <span>Shipping</span>
          <span className={`font-semibold ${deliveryMethod === 'doorstep' ? 'text-amber-600' : ''}`}>
            {deliveryMethod === 'doorstep' ? 'At a Cost' : shipping === 0 ? 'FREE' : `GH₵ ${shipping.toFixed(2)}`}
          </span>
        </div>

      </div>

      <div className="border-t border-gray-200 mt-4 pt-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-gray-900">Total</span>
          <span className="text-2xl font-bold text-blue-700">GH₵ {total.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center space-x-2 text-blue-800">
          <i className="ri-shield-check-line text-xl"></i>
          <p className="text-sm font-semibold">Secure Checkout</p>
        </div>
      </div>
    </div>
  );
}
