import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sliders, 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  Weight, 
  Binary, 
  ArrowLeft,
  Power,
  Usb
} from 'lucide-react';

const CALIBRATION_MODES = [
  { id: 'normal', label: 'Normal', coil: 'M10', description: 'Default normal mode' },
  { id: 'tare', label: 'Tare', coil: 'M11', description: 'Zero / Tare the load cell' },
  { id: 'calibrate', label: 'Calibrate', coil: 'M12', description: 'Calibrate load cell' }
];

const Settings = () => {
  const navigate = useNavigate();

  // Weight Range (R2)
  const [weightRange, setWeightRange] = useState('');
  
  // Calibration Mode (Normal: M10, Tare: M11, Calibrate: M12)
  const [activeMode, setActiveMode] = useState('normal');

  // Telemetry state (R54, R1, R0)
  const [telemetry, setTelemetry] = useState({
    force: '--',
    rawForce: '--',
    realtimePlcValue: '--'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isModeLoading, setIsModeLoading] = useState(false);
  const [hasLoadedInitials, setHasLoadedInitials] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Connection & machine status
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [powerActive, setPowerActive] = useState(false);

  // Status checks on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const conn = await window.api.checkConnection();
        setConnectionStatus(conn && conn.connected ? 'connected' : 'disconnected');
      } catch (e) {
        setConnectionStatus('disconnected');
      }

      try {
        const pwr = await window.api.checkPowerStatus();
        setPowerActive(pwr?.active === true);
      } catch (e) {}
    };

    checkStatus();

    const handleModbusStatus = (event) => {
      setConnectionStatus(event.detail);
    };
    const handlePowerStatus = (event) => {
      setPowerActive(event.detail === true);
    };

    window.addEventListener('modbus-status-change', handleModbusStatus);
    window.addEventListener('power-status-change', handlePowerStatus);

    return () => {
      window.removeEventListener('modbus-status-change', handleModbusStatus);
      window.removeEventListener('power-status-change', handlePowerStatus);
    };
  }, []);

  // Ensure Normal mode (M10) is activated on PLC when entering Settings screen
  useEffect(() => {
    const initMode = async () => {
      try {
        console.log("Settings mounted: Activating Normal mode (M10) on PLC...");
        const result = await window.api.setCalibrationMode('normal');
        if (result && result.success) {
          setActiveMode('normal');
        }
      } catch (err) {
        console.error("Error setting initial Normal mode on mount:", err);
      }
    };

    initMode();
  }, []);

  // Poll telemetry from PLC Modbus cache every 500ms
  useEffect(() => {
    let intervalId;
    const pollData = async () => {
      try {
        const data = await window.api.readData();
        if (data && data.success) {
          setConnectionStatus('connected');

          // R54: Real-time Force (mN)
          const forceVal = Number(data.force_mN);
          const formattedForce = isFinite(forceVal) ? `${forceVal.toFixed(2)} mN` : (data.forceDisplay || '--');

          // R1: Raw Force Value
          const rawForceVal = Number(data.rawForce);
          const formattedRawForce = isFinite(rawForceVal) ? `${rawForceVal}` : '--';

          // R0: PLC Real-time Value
          const plcVal = Number(data.realtimePlcValue);
          const formattedPlcVal = isFinite(plcVal) ? `${plcVal}` : '--';

          setTelemetry({
            force: formattedForce,
            rawForce: formattedRawForce,
            realtimePlcValue: formattedPlcVal
          });

          // Sync initial values from PLC
          if (!hasLoadedInitials) {
            if (data.weightRange !== undefined && data.weightRange !== null) {
              setWeightRange(data.weightRange.toString());
            }
            if (data.calibrationMode) {
              setActiveMode(data.calibrationMode);
            }
            setHasLoadedInitials(true);
          } else if (data.calibrationMode && !isModeLoading) {
            setActiveMode(data.calibrationMode);
          }
        } else {
          setConnectionStatus('disconnected');
        }
      } catch (err) {
        setConnectionStatus('disconnected');
      }
    };

    pollData();
    intervalId = setInterval(pollData, 500);

    return () => clearInterval(intervalId);
  }, [hasLoadedInitials, isModeLoading]);

  // Handle Weight range input change (0-1000)
  const handleWeightChange = (e) => {
    const val = e.target.value;
    if (val === '' || (/^\d+$/.test(val) && Number(val) >= 0 && Number(val) <= 1000)) {
      setWeightRange(val);
    }
  };

  // Send Weight Range to R2
  const handleSendWeight = async () => {
    setSuccessMessage('');
    setErrorMessage('');

    if (weightRange === '') {
      setErrorMessage('Weight range is required');
      return;
    }

    const weightNum = Number(weightRange);
    if (isNaN(weightNum) || weightNum < 0 || weightNum > 1000) {
      setErrorMessage('Weight range must be an integer between 0 and 1000');
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.api.writeWeightRange(weightNum);
      if (result && result.success) {
        setSuccessMessage(`Weight range (${weightNum}) successfully written to register R2.`);
      } else {
        setErrorMessage(result?.error || 'Failed to write weight range to R2.');
      }
    } catch (err) {
      console.error('Error writing weight range:', err);
      setErrorMessage(err.message || 'Error writing weight range to R2.');
    } finally {
      setIsLoading(false);
    }
  };

  // Mode Selection: Sets chosen coil ON and forces the other two OFF
  const handleSelectMode = async (modeId) => {
    setSuccessMessage('');
    setErrorMessage('');
    setIsModeLoading(true);

    const modeConfig = CALIBRATION_MODES.find(m => m.id === modeId);

    try {
      console.log(`Selecting calibration mode: ${modeId}`);
      const result = await window.api.setCalibrationMode(modeId);
      if (result && result.success) {
        setActiveMode(modeId);
        setSuccessMessage(`Mode "${modeConfig?.label}" (${modeConfig?.coil}) activated on PLC. Other calibration coils set to OFF.`);
      } else {
        setErrorMessage(result?.error || `Failed to activate mode "${modeConfig?.label}".`);
      }
    } catch (err) {
      console.error('Error setting calibration mode:', err);
      setErrorMessage(err.message || `Error setting calibration mode.`);
    } finally {
      setIsModeLoading(false);
    }
  };

  const handleReconnect = async () => {
    try {
      const res = await window.api.reconnect();
      if (res && res.success && res.connected) {
        setConnectionStatus('connected');
      }
    } catch (err) {
      console.error('Reconnect failed:', err);
    }
  };

  const activeModeConfig = CALIBRATION_MODES.find(m => m.id === activeMode) || CALIBRATION_MODES[0];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-100 hover:shadow-sm rounded-xl transition-all duration-200 text-slate-700"
            title="Return to Main Menu"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Settings</h1>
            <p className="text-xs text-slate-500 font-medium">Load Cell Calibration & Diagnostics</p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3">
          {/* Power Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${
            powerActive ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-100 border-red-200 text-red-700'
          }`}>
            <Power className="w-4 h-4" />
            <span>POWERED {powerActive ? 'ON' : 'OFF'}</span>
          </div>

          {/* USB Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${
            connectionStatus === 'connected' ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-100 border-red-200 text-red-700'
          }`}>
            <Usb className="w-4 h-4" />
            <span>{connectionStatus === 'connected' ? 'USB Connected' : 'USB Disconnected'}</span>
          </div>

          {connectionStatus === 'disconnected' && (
            <button
              onClick={handleReconnect}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              Reconnect
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Banner Section matching reference UI */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
              <Sliders className="h-4 w-4" />
              CALIBRATION UTILITY
            </p>
            <h2 className="mt-2 text-3xl font-bold text-slate-900 tracking-tight">Load Cell Calibration</h2>
            <p className="mt-1.5 text-sm text-slate-600 max-w-3xl leading-relaxed">
              Configure load cell calibration inputs and monitor real-time force register telemetry.
            </p>
          </div>
        </section>

        {/* Feedback Banners */}
        {successMessage && (
          <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-xl shadow-sm flex items-center gap-3 animate-fadeIn">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <p className="text-emerald-900 font-medium text-sm">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-r-xl shadow-sm flex items-center gap-3 animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <p className="text-rose-900 font-medium text-sm">{errorMessage}</p>
          </div>
        )}

        {/* Two-Column Grid matching reference UI */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          
          {/* Left Column: Calibration Parameters (Inputs to PLC) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden flex flex-col justify-between p-6 md:p-8 space-y-6">
            <div className="space-y-6">
              
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Calibration Parameters</h3>
                  <p className="text-xs text-slate-500">Configure parameters to send to PLC registers & coils</p>
                </div>
              </div>

              {/* Weight Range Input (R2) */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Weight className="w-4 h-4 text-slate-400" />
                  <span>Weight Range (0-1000)</span>
                  <span className="text-xs font-mono font-normal text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">R2</span>
                </label>
                
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={weightRange}
                      onChange={handleWeightChange}
                      placeholder="Enter weight range parameter"
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 placeholder:text-slate-400 font-medium text-slate-800"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendWeight}
                    disabled={isLoading || connectionStatus !== 'connected'}
                    className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-7 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
                  >
                    {isLoading ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>

              {/* Input Mode Selection (M10, M11, M12) */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Binary className="w-4 h-4 text-slate-400" />
                  <span>Input Mode Selection</span>
                  <span className="text-xs font-normal text-slate-400">(Only one coil active at a time)</span>
                </label>

                <div className="grid grid-cols-3 gap-3">
                  {CALIBRATION_MODES.map((mode) => {
                    const isSelected = activeMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => handleSelectMode(mode.id)}
                        disabled={isModeLoading || connectionStatus !== 'connected'}
                        className={`flex flex-col items-center justify-center py-3.5 px-3 rounded-xl border-2 font-bold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/70 text-blue-600 shadow-sm ring-2 ring-blue-200'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-sm font-semibold">{mode.label}</span>
                        <span className={`text-[11px] font-mono mt-0.5 ${isSelected ? 'text-blue-500' : 'text-slate-400'}`}>
                          {mode.coil}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Current Mode Badge */}
                <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                  <span>Current:</span>
                  <span className="font-mono font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-md">
                    {activeModeConfig.label} ({activeModeConfig.coil})
                  </span>
                </div>

              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">
              * Selecting any mode will immediately write <code className="text-slate-600 font-semibold font-mono">1</code> to its PLC coil and <code className="text-slate-600 font-semibold font-mono">0</code> to the other two coils.
            </div>
          </div>

          {/* Right Column: Live Calibration Reads (Telemetry from PLC) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden flex flex-col justify-between p-6 md:p-8 space-y-6">
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Live Calibration Reads</h3>
                  <p className="text-xs text-slate-500">Continuous telemetry polled from PLC holding registers</p>
                </div>
              </div>

              {/* Three Telemetry Cards matching screenshot */}
              <div className="space-y-4 my-auto py-2">
                
                {/* 1. Real-Time Force (R54) */}
                <div className="p-5 bg-slate-50/80 border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs hover:border-emerald-300 transition-colors">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      REAL-TIME FORCE
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Register R54</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl md:text-3xl font-bold text-emerald-600 font-mono tracking-tight">
                      {telemetry.force}
                    </span>
                  </div>
                </div>

                {/* 2. Raw Force Value (R1) */}
                <div className="p-5 bg-slate-50/80 border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs hover:border-blue-300 transition-colors">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      RAW FORCE VALUE
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Register R1</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl md:text-3xl font-bold text-blue-600 font-mono tracking-tight">
                      {telemetry.rawForce}
                    </span>
                  </div>
                </div>

                {/* 3. PLC Real-Time Value (R0) */}
                <div className="p-5 bg-slate-50/80 border border-slate-200 rounded-2xl flex items-center justify-between shadow-xs hover:border-amber-300 transition-colors">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      PLC REAL-TIME VALUE
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Register R0</span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl md:text-3xl font-bold text-amber-500 font-mono tracking-tight">
                      {telemetry.realtimePlcValue}
                    </span>
                  </div>
                </div>

              </div>

              <div className="pt-4 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
                <span>Polling frequency: 500 ms</span>
                <span className={`inline-flex items-center gap-1.5 font-medium ${connectionStatus === 'connected' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  {connectionStatus === 'connected' ? 'Live Telemetry Active' : 'PLC Disconnected'}
                </span>
              </div>

            </div>
          </div>

        </div>

      </main>
    </div>
  );
};

export default Settings;
