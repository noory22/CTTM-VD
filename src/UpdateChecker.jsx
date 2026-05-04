import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Download, X, Loader2 } from 'lucide-react';

const UpdateChecker = () => {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (window.api) {
      // Listen for checking event
      if (window.api.onUpdateStatus) {
        window.api.onUpdateStatus((updateStatus) => {
          console.log('Update Status Received:', updateStatus);
          setStatus(updateStatus);
          
          if (updateStatus === 'Checking for updates...') {
            setChecking(true);
            setIsVisible(true); // Always show when checking manually or auto
          } else if (updateStatus === 'Update available' || updateStatus === 'downloaded' || updateStatus.startsWith('Error')) {
            setChecking(false);
            setIsVisible(true);
          } else if (updateStatus === 'latest') {
            setChecking(false);
            // We show 'latest' only if we were actively checking
            setIsVisible(true);
          }
        });
      }
      
      if (window.api.onUpdateAvailable) {
        window.api.onUpdateAvailable((info) => {
          setUpdateInfo(info);
        });
      }

      if (window.api.onUpdateProgress) {
        window.api.onUpdateProgress((updateProgress) => {
          setProgress(updateProgress);
        });
      }
    }
  }, []);

  const handleDownload = async () => {
    try {
      await window.api.downloadUpdate();
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    }
  };

  const handleRestart = () => {
    window.api.quitAndInstall();
  };

  const closeToast = () => {
    setIsVisible(false);
    // Reset status after closing if it was just a "latest" check
    if (status === 'latest') {
        setStatus('');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={status !== 'Checking for updates...' && !progress ? closeToast : undefined}
      />
      
      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        
        {/* Close Button - Only show when not critical */}
        {(!checking && !progress) && (
          <button 
            onClick={closeToast}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all z-10"
          >
            <X size={20} />
          </button>
        )}

        <div className="p-8">
          {/* Icon Header */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 ${
              status === 'latest' ? 'bg-green-50 text-green-500' :
              status.startsWith('Error') ? 'bg-red-50 text-red-500' :
              'bg-blue-50 text-blue-600'
            }`}>
              {status === 'Checking for updates...' ? (
                <Loader2 size={40} className="animate-spin" />
              ) : status === 'latest' ? (
                <CheckCircle size={40} strokeWidth={2.5} />
              ) : status.startsWith('Error') ? (
                <AlertCircle size={40} strokeWidth={2.5} />
              ) : (
                <Download size={40} strokeWidth={2.5} />
              )}
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">
              {status === 'Checking for updates...' ? 'Checking for Updates' :
               status === 'latest' ? "You're All Set!" :
               status === 'downloaded' ? 'Update Ready' :
               status.startsWith('Error') ? 'Update Failed' :
               'New Update Available'}
            </h2>
            
            <p className="text-slate-500 text-sm font-medium">
               {status === 'Checking for updates...' ? 'Searching for the latest version on GitHub...' :
                status === 'latest' ? 'The application is running the most recent version.' :
                status === 'downloaded' ? 'The new version is ready to be applied.' :
                status.startsWith('Error') ? 'There was an issue reaching the update server.' :
                `Version ${updateInfo?.version || ''} is now available for download.`}
            </p>
          </div>

          {/* Progress / Status Content */}
          <div className="space-y-6">
            {status === 'Update available' && !progress && (
              <button
                onClick={handleDownload}
                className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-base font-bold transition-all shadow-xl shadow-blue-500/25 flex items-center justify-center space-x-3 active:scale-[0.98]"
              >
                <Download size={20} strokeWidth={2.5} />
                <span>Download & Install Now</span>
              </button>
            )}

            {status === 'downloaded' && (
              <button
                onClick={handleRestart}
                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-base font-bold transition-all shadow-xl shadow-indigo-500/25 flex items-center justify-center space-x-3 active:scale-[0.98]"
              >
                <RefreshCw size={20} strokeWidth={2.5} />
                <span>Restart to Apply Update</span>
              </button>
            )}

            {progress && (
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Downloading Assets</span>
                  <span className="text-xl font-bold text-blue-600 leading-none">{Math.round(progress.percent)}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all duration-300 rounded-full"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
                <p className="text-[11px] text-center text-slate-400 font-medium italic">
                  Please keep the application open until finished...
                </p>
              </div>
            )}

            {status === 'latest' && (
              <button
                onClick={closeToast}
                className="w-full py-4 px-6 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-base font-bold transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center active:scale-[0.98]"
              >
                <span>Perfect, Thanks!</span>
              </button>
            )}

            {status.startsWith('Error') && (
               <div className="space-y-4">
                 <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                   <p className="text-xs text-red-600 font-bold leading-relaxed">
                     {status}
                   </p>
                 </div>
                 <button
                    onClick={closeToast}
                    className="w-full py-3 px-6 text-slate-500 hover:text-slate-800 font-bold transition-all"
                  >
                    Close
                  </button>
               </div>
            )}
          </div>
        </div>
        
        {/* Footer info */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex justify-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Revive Medical • CTTM Update System
            </p>
        </div>
      </div>
    </div>
  );
};

export default UpdateChecker;
