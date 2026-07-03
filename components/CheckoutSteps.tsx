import { Fragment } from 'react';

interface CheckoutStepsProps {
  currentStep: number;
}

export default function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  const steps = [
    { number: 1, title: 'Details' },
    { number: 2, title: 'Delivery' },
    { number: 3, title: 'Payment' },
  ];

  return (
    <div className="flex items-center justify-center">
      {steps.map((step, index) => (
        <Fragment key={step.number}>
          <div className="flex flex-col items-center gap-2">
            <div
              className={`flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                currentStep > step.number
                  ? 'bg-emerald-600 text-white'
                  : currentStep === step.number
                  ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                  : 'border-2 border-gray-200 text-gray-400'
              }`}
            >
              {currentStep > step.number ? <i className="ri-check-line text-lg"></i> : step.number}
            </div>
            <span
              className={`text-[11px] font-medium sm:text-xs ${
                currentStep >= step.number ? 'text-[#0B1B3A]' : 'text-gray-400'
              }`}
            >
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`-mt-5 mx-1.5 h-0.5 w-10 transition-colors sm:mx-3 sm:w-16 ${
                currentStep > step.number ? 'bg-emerald-600' : 'bg-gray-200'
              }`}
            ></div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
