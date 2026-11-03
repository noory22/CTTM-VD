import React, { useState, useEffect } from 'react';
import { Power, Usb, ChevronLeft } from 'lucide-react';

const AppHeader = ({
  title = 'Main Menu',
  showBackButton = false,
  onBack,
  onExit,
  className = '',
  style = {}
}) => {
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectionChecked, setConnectionChecked] = useState(false);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const [powerActive, setPowerActive] = useState(false);

  useEffect(() => {
    // Initial checks
    checkInitialConnection();
    checkInitialEmergencyStatus();
    checkInitialPowerStatus();

    // Listen for modbus status updates
    const handleModbusStatus = (event) => {
      const status = event.detail;
      setConnectionStatus(status);
      setConnectionChecked(true);
      console.log('Modbus status updated:', status);
    };
    window.addEventListener('modbus-status-change', handleModbusStatus);

    // Listen for emergency status updates
    const handleEmergencyStatus = (event) => {
      setEmergencyActive(event.detail === true);
    };
    window.addEventListener('emergency-status-change', handleEmergencyStatus);

    // Listen for power status updates
    const handlePowerStatus = (event) => {
      setPowerActive(event.detail === true);
    };
    window.addEventListener('power-status-change', handlePowerStatus);

    // Cleanup
    return () => {
      window.removeEventListener('modbus-status-change', handleModbusStatus);
      window.removeEventListener('emergency-status-change', handleEmergencyStatus);
      window.removeEventListener('power-status-change', handlePowerStatus);
    };
  }, []);

  const checkInitialConnection = async () => {
    try {
      const status = await window.api.checkConnection();
      setConnectionStatus(status.connected ? 'connected' : 'disconnected');
      setConnectionChecked(true);
    } catch (error) {
      console.error('Failed to check connection:', error);
      setConnectionStatus('disconnected');
      setConnectionChecked(true);
    }
  };

  const checkInitialEmergencyStatus = async () => {
    try {
      const status = await window.api.checkEmergencyStatus();
      setEmergencyActive(status.active);
    } catch (error) {
      console.error('Failed to check emergency status:', error);
    }
  };

  const checkInitialPowerStatus = async () => {
    try {
      const status = await window.api.checkPowerStatus();
      setPowerActive(status.active);
    } catch (error) {
      console.error('Failed to check power status:', error);
    }
  };

  const handleReconnect = async () => {
    try {
      console.log('Attempting to reconnect...');
      const result = await window.api.reconnect();
      if (result.success && result.connected) {
        setConnectionStatus('connected');
        console.log('Reconnect successful');
      } else {
        console.log('Reconnect failed');
      }
    } catch (error) {
      console.error('Reconnect error:', error);
    }
  };

  const handleExitClick = () => {
    const confirmed = window.confirm("Are you sure you want to exit?");
    if (confirmed) {
      if (onExit) {
        onExit();
      }
      window.close();
    }
  };

  return (
    <header
      className={`flex items-center px-6 py-4 bg-white/80 backdrop-blur-lg shadow-xl border-b border-gray-200/50 relative z-10 shrink-0 min-h-0 ${className}`}
      style={{ flex: '0 0 auto', ...style }}
    >
      <div className="flex-1 flex items-center gap-4">
        {showBackButton && (
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-800 flex items-center justify-center mr-1"
            title="Back"
          >
            <ChevronLeft className="w-7 h-7 stroke-[2.2]" />
          </button>
        )}
        <h1 className="text-3xl font-bold bg-linear-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          {title}
        </h1>
        {emergencyActive && (
          <div className="bg-red-600 text-white px-4 py-2 rounded-full animate-pulse border-2 border-red-400 shadow-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-bold tracking-wider">EMERGENCY BUTTON ACTIVATED</span>
          </div>
        )}
      </div>

      {/* Connection & Power Status Indicators */}
      <div className="flex items-center gap-3 mr-4">
        {/* Power Status Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${powerActive ? 'bg-green-100 border-green-200' : 'bg-red-100 border-red-200'} border`}>
          <Power className={`w-4 h-4 ${powerActive ? 'text-green-700' : 'text-red-700'}`} />
          <span className={`text-sm font-medium ${powerActive ? 'text-green-700' : 'text-red-700'}`}>
            POWERED {powerActive ? 'ON' : 'OFF'}
          </span>
        </div>

        {/* USB Status Indicator */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${connectionStatus === 'connected' ? 'bg-green-100 border-green-200' : 'bg-red-100 border-red-200'} border`}>
          <Usb className={`w-4 h-4 ${connectionStatus === 'connected' ? 'text-green-700' : 'text-red-700'}`} />
          <span className={`text-sm font-medium ${connectionStatus === 'connected' ? 'text-green-700' : 'text-red-700'}`}>
            {connectionStatus === 'connected' ? 'USB Connected' : 'USB Disconnected'}
          </span>
        </div>

        {connectionStatus === 'disconnected' && connectionChecked && (
          <button
            onClick={handleReconnect}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Reconnect
          </button>
        )}
      </div>

      {/* Direct Power Button */}
      <button
        onClick={handleExitClick}
        className="group bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl lg:rounded-2xl w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl border border-red-400/30 shrink-0"
        title="Exit"
      >
        <Power className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:scale-110 transition-transform duration-300" />
      </button>
    </header>
  );
};

export default AppHeader;

