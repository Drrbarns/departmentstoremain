interface CheckoutStepsProps {
  currentStep: number;
}

export default function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  const steps = [
    { number: 1, title: 'Shipping', icon: 'ri-map-pin-line' },
    { number: 2, title: 'Delivery', icon: 'ri-truck-line' },
    { number: 3, title: 'Payment', icon: 'ri-bank-card-line' }
  ];

  return (
    <div className="flex items-center justify-between max-w-2xl mx-auto">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div className={`w-12 h-12 flex items-center justify-center rounded-full font-bold transition-colors ${
              currentStep >= step.number
                ? 'bg-emerald-700 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              <i className={`${step.icon} text-xl`}></i>
            </div>
            <p className={`mt-2 text-sm font-semibold ${
              currentStep >= step.number ? 'text-emerald-700' : 'text-gray-500'
            }`}>
              {step.title}
            </p>
          </div>
          {index < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-4 transition-colors ${
              currentStep > step.number ? 'bg-emerald-700' : 'bg-gray-200'
            }`}></div>
          )}
        </div>
      ))}
    </div>
  );
}
