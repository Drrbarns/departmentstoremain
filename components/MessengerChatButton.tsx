'use client';

import { useState, useEffect } from 'react';

export default function MessengerChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ text: string; sender: 'user' | 'bot'; time: string }>>([
    { text: 'Hi! Welcome to our store. How can I help you today?', sender: 'bot', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);

  const quickReplies = [
    { text: 'Track my order', icon: 'ri-truck-line' },
    { text: 'Product inquiry', icon: 'ri-shopping-bag-line' },
    { text: 'Return request', icon: 'ri-arrow-go-back-line' },
    { text: 'Speak to agent', icon: 'ri-customer-service-2-line' }
  ];

  const handleSendMessage = () => {
    if (!message.trim()) return;

    const newMessage = {
      text: message,
      sender: 'user' as const,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages([...messages, newMessage]);
    setMessage('');

    setTimeout(() => {
      const botReply = {
        text: 'Thanks for your message! An agent will respond shortly. You can also check our Help Center for instant answers.',
        sender: 'bot' as const,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, botReply]);
    }, 1000);
  };

  const handleQuickReply = (text: string) => {
    setMessage(text);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-emerald-500 to-purple-600 text-white rounded-full shadow-2xl hover:scale-110 transition-transform z-50 flex items-center justify-center"
      >
        {isOpen ? (
          <i className="ri-close-line text-2xl"></i>
        ) : (
          <i className="ri-messenger-fill text-2xl"></i>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-emerald-500 to-purple-600 text-white p-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-12 h-12 flex items-center justify-center bg-white text-purple-600 rounded-full font-bold text-xl">
                  <i className="ri-customer-service-2-fill"></i>
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Customer Support</h3>
                <p className="text-sm text-emerald-100">Typically replies instantly</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded-full transition-colors"
              >
                <i className="ri-subtract-line text-xl"></i>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] ${msg.sender === 'user' ? 'order-2' : 'order-1'}`}>
                  <div className={`px-4 py-2 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-emerald-500 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                  }`}>
                    <p className="text-sm">{msg.text}</p>
                  </div>
                  <p className={`text-xs text-gray-500 mt-1 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.time}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 p-3 bg-white">
            <div className="flex flex-wrap gap-2 mb-3">
              {quickReplies.map((reply, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickReply(reply.text)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm transition-colors"
                >
                  <i className={`${reply.icon} text-sm`}></i>
                  <span>{reply.text}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                <i className="ri-add-line text-xl"></i>
              </button>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={handleSendMessage}
                className="w-9 h-9 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-colors"
              >
                <i className="ri-send-plane-fill"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}