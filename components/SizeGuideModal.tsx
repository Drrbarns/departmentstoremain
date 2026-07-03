'use client';

interface SizeGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: string;
}

export default function SizeGuideModal({ isOpen, onClose, category = 'General' }: SizeGuideModalProps) {
  if (!isOpen) return null;

  const sizeGuides: Record<string, any> = {
    'Tops & Shirts': {
      measurements: ['Chest', 'Waist', 'Length', 'Sleeve'],
      sizes: [
        { size: 'XS', chest: '32-34', waist: '24-26', length: '26', sleeve: '31' },
        { size: 'S', chest: '34-36', waist: '26-28', length: '27', sleeve: '32' },
        { size: 'M', chest: '38-40', waist: '30-32', length: '28', sleeve: '33' },
        { size: 'L', chest: '42-44', waist: '34-36', length: '29', sleeve: '34' },
        { size: 'XL', chest: '46-48', waist: '38-40', length: '30', sleeve: '35' },
        { size: '2XL', chest: '50-52', waist: '42-44', length: '31', sleeve: '36' },
      ]
    },
    'Bottoms': {
      measurements: ['Waist', 'Hip', 'Inseam', 'Outseam'],
      sizes: [
        { size: '26', waist: '26', hip: '36', inseam: '30', outseam: '40' },
        { size: '28', waist: '28', hip: '38', inseam: '30', outseam: '40' },
        { size: '30', waist: '30', hip: '40', inseam: '32', outseam: '42' },
        { size: '32', waist: '32', hip: '42', inseam: '32', outseam: '42' },
        { size: '34', waist: '34', hip: '44', inseam: '32', outseam: '42' },
        { size: '36', waist: '36', hip: '46', inseam: '32', outseam: '42' },
      ]
    },
    'Shoes': {
      measurements: ['UK', 'EU', 'US', 'CM'],
      sizes: [
        { size: '5', uk: '5', eu: '38', us: '6', cm: '23.5' },
        { size: '6', uk: '6', eu: '39', us: '7', cm: '24.5' },
        { size: '7', uk: '7', eu: '40-41', us: '8', cm: '25.5' },
        { size: '8', uk: '8', eu: '42', us: '9', cm: '26.5' },
        { size: '9', uk: '9', eu: '43', us: '10', cm: '27.5' },
        { size: '10', uk: '10', eu: '44-45', us: '11', cm: '28.5' },
        { size: '11', uk: '11', eu: '46', us: '12', cm: '29.5' },
      ]
    },
    'General': {
      measurements: ['Chest', 'Waist', 'Hip'],
      sizes: [
        { size: 'XS', chest: '32-34', waist: '24-26', hip: '34-36' },
        { size: 'S', chest: '34-36', waist: '26-28', hip: '36-38' },
        { size: 'M', chest: '38-40', waist: '30-32', hip: '40-42' },
        { size: 'L', chest: '42-44', waist: '34-36', hip: '44-46' },
        { size: 'XL', chest: '46-48', waist: '38-40', hip: '48-50' },
        { size: '2XL', chest: '50-52', waist: '42-44', hip: '52-54' },
      ]
    }
  };

  const guide = sizeGuides[category] || sizeGuides['General'];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20">
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        <div className="relative bg-white rounded-lg w-full max-w-4xl">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Size Guide - {category}</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
            >
              <i className="ri-close-line text-2xl text-gray-700"></i>
            </button>
          </div>

          <div className="p-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
              <div className="flex items-start">
                <div className="w-6 h-6 flex items-center justify-center mr-3">
                  <i className="ri-information-line text-xl text-emerald-600"></i>
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-900 mb-2">How to Measure</h3>
                  <ul className="text-sm text-emerald-800 space-y-1">
                    <li>• Use a soft measuring tape for accurate measurements</li>
                    <li>• Measure over light clothing or undergarments</li>
                    <li>• Keep the tape parallel to the floor</li>
                    <li>• Take measurements at the fullest part of each area</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-900">Size</th>
                    {guide.measurements.map((measurement: string) => (
                      <th key={measurement} className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-900">
                        {measurement} (inches)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guide.sizes.map((row: any, index: number) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border border-gray-300 px-4 py-3 font-semibold text-gray-900">{row.size}</td>
                      {guide.measurements.map((measurement: string) => {
                        const key = measurement.toLowerCase();
                        return (
                          <td key={measurement} className="border border-gray-300 px-4 py-3 text-center text-gray-700">
                            {row[key]}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <div className="w-6 h-6 flex items-center justify-center mr-2">
                    <i className="ri-ruler-line text-emerald-700"></i>
                  </div>
                  Measurement Tips
                </h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• <strong>Chest:</strong> Measure around the fullest part</li>
                  <li>• <strong>Waist:</strong> Measure around natural waistline</li>
                  <li>• <strong>Hip:</strong> Measure around the fullest part</li>
                  <li>• <strong>Inseam:</strong> Measure from crotch to ankle</li>
                </ul>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                  <div className="w-6 h-6 flex items-center justify-center mr-2">
                    <i className="ri-question-line text-emerald-700"></i>
                  </div>
                  Fit Guide
                </h4>
                <ul className="text-sm text-gray-700 space-y-2">
                  <li>• Between sizes? Size up for comfort</li>
                  <li>• Check product description for fit notes</li>
                  <li>• Read customer reviews for insights</li>
                  <li>• Contact support for personalized help</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 mb-4">
                Still not sure about sizing? Our customer service team is here to help!
              </p>
              <button className="px-6 py-3 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
