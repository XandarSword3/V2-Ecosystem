'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-slate-700 rounded-full flex items-center justify-center">
          <svg
            className="w-12 h-12 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-4">
          You&apos;re Offline
        </h1>
        
        <p className="text-slate-400 mb-8 max-w-md">
          It looks like you&apos;ve lost your internet connection. 
          Some features may not be available until you&apos;re back online.
        </p>
        
        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors"
          >
            Try Again
          </button>
          
          <p className="text-sm text-slate-500">
            Your pending actions will sync automatically when you&apos;re back online.
          </p>
        </div>
        
        <div className="mt-12 pt-8 border-t border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            Available Offline:
          </h2>
          <ul className="text-slate-400 space-y-2">
            <li>✓ View cached bookings</li>
            <li>✓ Browse saved menus</li>
            <li>✓ Access your profile</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
