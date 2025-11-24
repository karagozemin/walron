"use client";

export function LoadingWalrus() {
  return (
    <div className="fixed inset-0 bg-white z-50 flex items-center justify-center">
      <div className="text-center">
        {/* Walrus Image with Animation */}
        <div className="relative">
          <img 
            src="/walrus-loading.jpg" 
            alt="Loading..." 
            className="w-40 h-40 object-cover rounded-full animate-bounce shadow-xl"
          />
          {/* Animated pulse ring */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 border-4 border-blue-400 rounded-full animate-ping opacity-20"></div>
          </div>
        </div>
        
        {/* Loading Text */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-800">
            Loading...
          </h2>
        </div>
      </div>
    </div>
  );
}

