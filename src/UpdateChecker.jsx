import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, Download, X } from 'lucide-react';

const UpdateChecker = () => {
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(null);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (window.api) {
      if (window.api.onUpdateStatus) {
        window.api.onUpdateStatus((updateStatus) => {
          setStatus(updateStatus);
          setChecking(false);
          
          if (updateStatus === 'Update available' || updateStatus === 'downloaded' || updateStatus.startsWith('Error')) {
            setIsVisible(true);
          } else if (updateStatus === 'latest' && !checking) {
            // briefly show latest then hide
            setIsVisible(true);
            setTimeout(() => setIsVisible(false), 3000);
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
  }, [checking]);

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
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-5 w-84 overflow-hidden relative">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${status === 'downloaded' ? 'bg-blue-50 text-blue-600' : 'bg-blue-50 text-blue-600'}`}>
              {status === 'downloaded' ? <CheckCircle size={22} strokeWidth={2.5} /> : <Download size={22} strokeWidth={2.5} />}
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">
                {status === 'downloaded' ? 'Update Ready' : 'Software Update'}
              </h3>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {updateInfo ? `Version ${updateInfo.version}` : 'Checking...'}
              </p>
            </div>
          </div>
          <button 
            onClick={closeToast}
            className="p-1 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-full transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {status === 'Update available' && (
            <>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                A new version of CTTM is available. Update now to get the latest features and improvements.
              </p>
              <button
                onClick={handleDownload}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center space-x-2 active:scale-[0.98]"
              >
                <Download size={16} strokeWidth={2.5} />
                <span>Update Now</span>
              </button>
            </>
          )}

          {status === 'downloaded' && (
            <>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                Update downloaded and ready to install. The application will restart to apply the changes.
              </p>
              <button
                onClick={handleRestart}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center space-x-2 active:scale-[0.98]"
              >
                <RefreshCw size={16} strokeWidth={2.5} />
                <span>Restart to Apply</span>
              </button>
            </>
          )}

          {(status === 'Checking for updates...' || progress) && (
            <div className="py-2 space-y-3">
              <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase tracking-widest font-black">
                <span>{progress ? 'Downloading...' : 'Checking...'}</span>
                {progress && <span className="text-blue-600">{Math.round(progress.percent)}%</span>}
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${progress ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]' : 'bg-slate-300 w-1/3 animate-pulse'}`}
                  style={progress ? { width: `${progress.percent}%` } : {}}
                />
              </div>
            </div>
          )}

          {status === 'latest' && (
            <div className="flex items-center space-x-2 text-blue-600 bg-blue-50 p-2.5 rounded-xl border border-blue-100 animate-in zoom-in-95 duration-300">
              <CheckCircle size={16} strokeWidth={2.5} />
              <span className="text-xs font-bold tracking-tight">You're running the latest version</span>
            </div>
          )}

          {status.startsWith('Error') && (
            <div className="flex items-start space-x-2 text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">
              <AlertCircle size={16} className="mt-0.5 shrink-0" strokeWidth={2.5} />
              <span className="text-[11px] font-bold leading-tight">{status}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateChecker;
