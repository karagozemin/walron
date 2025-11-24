"use client";

export function LoadingWalrus() {
  return (
    <div 
      className="fixed top-0 left-0 right-0 bottom-0 z-[100] flex items-center justify-center" 
      style={{ 
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '100vw',
        height: '100vh'
      }}
    >
      <div className="text-center flex flex-col items-center justify-center">
        {/* Walrus Image with Animation */}
        <div className="relative mb-8">
          <img 
            src="/walrus-loading.jpg" 
            alt="Loading..." 
            className="w-40 h-40 object-cover rounded-full animate-bounce shadow-2xl"
          />
          {/* Animated pulse ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-4 border-blue-400 rounded-full animate-ping opacity-20"></div>
          </div>
        </div>
        
        {/* Loading Text */}
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          Loading...
        </h2>
      </div>
    </div>
  );
}

