import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Power, AlertCircle, X, Thermometer, Zap, ChevronLeft, ChevronRight, RotateCcw, Camera } from 'lucide-react';

const Manual = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [showSerialError, setShowSerialError] = useState(false);
  const [temperature, setTemperature] = useState(0);
  const [force, setForce] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [controls, setControls] = useState({
    clamp: false,
    heater: false,
    homing: false
  });
  const [catheterPosition, setCatheterPosition] = useState(0);

  // Setup serial communication listeners
  useEffect(() => {
    const handleTemperatureUpdate = (temp) => {
      setTemperature(temp);
    };

    const handleForceUpdate = (force) => {
      setForce(force);
    };

    const handleManualResponse = (response) => {
      console.log('Manual response:', response);
    };

    const handleSerialError = (error) => {
      console.error('Serial error:', error);
      setShowSerialError(true);
    };

    const handleProcessResponse = (response) => {
      if (response === 'reset' || response === 'homing') {
        setControls(prev => ({ ...prev, homing: false }));
        setCatheterPosition(0); // Reset position after homing
      }
    };

    // Setup listeners
    window.serialAPI.onTemperatureUpdate(handleTemperatureUpdate);
    window.serialAPI.onForceUpdate(handleForceUpdate);
    window.serialAPI.onManualResponse(handleManualResponse);
    window.serialAPI.onProcessResponse(handleProcessResponse);
    window.serialAPI.onError(handleSerialError);

    // Cleanup listeners
    return () => {
      window.serialAPI.removeAllListeners('temperature-update');
      window.serialAPI.removeAllListeners('force-update');
      window.serialAPI.removeAllListeners('manual-response');
      window.serialAPI.removeAllListeners('process-response');
      window.serialAPI.removeAllListeners('serial-error');
    };
  }, []);

  // Initialize camera feed
  useEffect(() => {
    const initCamera = async () => {
      try {
        setCameraLoading(true);
        setCameraError(false);
        
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'environment'
          },
          audio: false
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        setCameraLoading(false);
      } catch (error) {
        console.error('Camera access error:', error);
        setCameraError(true);
        setCameraLoading(false);
      }
    };

    initCamera();

    // Cleanup function
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, []);

  const handleControlToggle = async (controlName) => {
    try {
      if (controlName === 'clamp') {
        const newState = !controls.clamp;
        await window.serialAPI.controlClamp(newState ? 'on' : 'off');
        setControls(prev => ({ ...prev, clamp: newState }));
      } else if (controlName === 'heater') {
        const newState = !controls.heater;
        await window.serialAPI.controlHeater(newState ? 'on' : 'off');
        setControls(prev => ({ ...prev, heater: newState }));
      }
    } catch (error) {
      console.error('Control error:', error);
      setShowSerialError(true);
    }
  };

  const moveCatheter = async (direction) => {
    try {
      // Send motor command via serial
      await window.serialAPI.moveMotor(direction);
      
      // Update UI position (this is just visual - real position should come from device)
      setCatheterPosition(prev => {
        if (direction === 'backward') {
          return Math.max(0, prev - 10);
        } else {
          return Math.min(100, prev + 10);
        }
      });
    } catch (error) {
      console.error('Motor movement error:', error);
      setShowSerialError(true);
    }
  };

  const resetCatheter = async () => {
    try {
      // Send homing command via serial
      setControls(prev => ({ ...prev, homing: true }));
      await window.serialAPI.processReset();
      
      // The actual position reset will happen when we receive the homing complete response
    } catch (error) {
      console.error('Homing error:', error);
      setShowSerialError(true);
      setControls(prev => ({ ...prev, homing: false }));
    }
  };

  const retryCamera = async () => {
    setCameraLoading(true);
    setCameraError(false);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'environment'
        },
        audio: false
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setCameraLoading(false);
    } catch (error) {
      console.error('Camera retry error:', error);
      setCameraError(true);
      setCameraLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => window.history.back()}
              className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Manual Mode</h1>
          </div>
          
          <button 
            onClick={() => {
              const confirmed = window.confirm("Are you sure you want to exit?");
              if (confirmed) {
                window.close();
              }
            }}
            className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl w-12 h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-2xl border border-red-400/30"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="lg:w-7 lg:h-7 group-hover:scale-110 transition-transform duration-300">
              <path d="M12 2V12M18.36 6.64C19.78 8.05 20.55 9.92 20.55 12C20.55 16.14 17.19 19.5 13.05 19.5C8.91 19.5 5.55 16.14 5.55 12C5.55 9.92 6.32 8.05 7.74 6.64" 
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Serial Port Error */}
        {showSerialError && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-red-800 font-semibold">SERIAL COMMUNICATION ERROR</p>
                  <p className="text-red-600 text-sm mt-1">Please check device connection and try again.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSerialError(false)}
                className="text-red-500 hover:text-red-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Live Video Feed */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-4">
                <h2 className="text-white font-semibold flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span>Live Feed</span>
                </h2>
              </div>
              
              {/* Video Container */}
              <div className="relative bg-slate-200 aspect-video flex items-center justify-center">
                {cameraLoading ? (
                  // Loading state
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
                    <p className="text-slate-600 font-medium">Initializing camera...</p>
                  </div>
                ) : cameraError ? (
                  // Error state
                  <div className="flex flex-col items-center space-y-4 p-8">
                    <Camera className="w-16 h-16 text-slate-400" />
                    <div className="text-center">
                      <p className="text-slate-600 font-medium mb-2">Camera not available</p>
                      <p className="text-slate-500 text-sm mb-4">Please check camera permissions and connection</p>
                      <button 
                        onClick={retryCamera}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Retry Camera
                      </button>
                    </div>
                  </div>
                ) : (
                  // Live camera feed
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Overlay elements */}
                    <div className="absolute inset-0">
                      {/* Grid overlay */}
                      <div className="absolute inset-0 opacity-20">
                        <svg className="w-full h-full">
                          <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#64748b" strokeWidth="1"/>
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                      </div>
                      
                      {/* Position indicator */}
                      <div className="absolute top-4 left-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-lg text-sm font-medium">
                        Position: {catheterPosition}%
                      </div>
                      
                      {/* Catheter position indicator */}
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                        <div className="bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="w-24 h-2 bg-slate-600 rounded-full">
                              <div 
                                className="h-full bg-blue-400 rounded-full transition-all duration-300"
                                style={{ width: `${catheterPosition}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium">{catheterPosition}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Sensor Readings */}
              <div className="p-6 bg-slate-50 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-6">
                  {/* Temperature */}
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-orange-100 rounded-xl">
                      <Thermometer className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-slate-600 text-sm font-medium">Temp</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-2 bg-orange-200 rounded-full">
                          <div 
                            className="h-full bg-orange-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (temperature / 40) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-slate-800 font-bold text-lg">{temperature.toFixed(1)}°C</span>
                      </div>
                    </div>
                  </div>

                  {/* Force */}
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Zap className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-slate-600 text-sm font-medium">Force</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-2 bg-blue-200 rounded-full">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (force / 50) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-slate-800 font-bold text-lg">{force.toFixed(1)}N</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            {/* Clamp Control */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Clamp {controls.clamp ? 'ON' : 'OFF'}</h3>
              <div className="flex justify-center">
                <button
                  onClick={() => handleControlToggle('clamp')}
                  className={`relative w-24 h-24 rounded-full border-4 transition-all duration-300 shadow-lg hover:shadow-xl ${
                    controls.clamp 
                      ? 'bg-green-500 border-green-600 text-white' 
                      : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Clamp Icon */}
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 4h4v4h-4V4zM4 16h4v4H4v-4zM16 8h4v8h-4V8zM8 4h8v4H8V4zM4 8h4v4H4V8zM8 12h8v8H8v-8z"/>
                    </svg>
                  </div>
                  {controls.clamp && (
                    <div className="absolute -inset-1 bg-green-500 rounded-full animate-ping opacity-30"></div>
                  )}
                </button>
              </div>
            </div>

            {/* Catheter Movement */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Catheter Movement</h3>
              <div className="flex justify-center space-x-4 mb-4">
                <button
                  onClick={() => moveCatheter('backward')}
                  className="w-16 h-16 bg-white border-4 border-slate-300 rounded-full flex items-center justify-center text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => moveCatheter('forward')}
                  className="w-16 h-16 bg-white border-4 border-slate-300 rounded-full flex items-center justify-center text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
              
              {/* Position indicator */}
              <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${catheterPosition}%` }}
                ></div>
              </div>
              <p className="text-center text-slate-600 text-sm">Position: {catheterPosition}%</p>
            </div>

            {/* Heater and Homing */}
            <div className="grid grid-cols-2 gap-4">
              {/* Heater */}
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Heater</h4>
                <div className="flex justify-center">
                  <button
                    onClick={() => handleControlToggle('heater')}
                    className={`relative w-16 h-16 rounded-full border-4 transition-all duration-300 shadow-lg hover:shadow-xl ${
                      controls.heater 
                        ? 'bg-orange-500 border-orange-600 text-white' 
                        : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      {/* Heat waves icon */}
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm-6-4c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm6 0c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z"/>
                      </svg>
                    </div>
                    {controls.heater && (
                      <div className="absolute -inset-1 bg-orange-500 rounded-full animate-ping opacity-30"></div>
                    )}
                  </button>
                </div>
              </div>

              {/* Homing */}
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Homing</h4>
                <div className="flex justify-center">
                  <button
                    onClick={resetCatheter}
                    disabled={controls.homing}
                    className={`relative w-16 h-16 rounded-full border-4 transition-all duration-300 shadow-lg hover:shadow-xl ${
                      controls.homing 
                        ? 'bg-blue-500 border-blue-600 text-white' 
                        : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400 disabled:opacity-50'
                    }`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <RotateCcw className={`w-6 h-6 ${controls.homing ? 'animate-spin' : ''}`} />
                    </div>
                    {controls.homing && (
                      <div className="absolute -inset-1 bg-blue-500 rounded-full animate-ping opacity-30"></div>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Status Panel */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">System Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Clamp:</span>
                  <span className={`font-semibold ${controls.clamp ? 'text-green-600' : 'text-red-600'}`}>
                    {controls.clamp ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Heater:</span>
                  <span className={`font-semibold ${controls.heater ? 'text-orange-600' : 'text-slate-600'}`}>
                    {controls.heater ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Homing:</span>
                  <span className={`font-semibold ${controls.homing ? 'text-blue-600' : 'text-slate-600'}`}>
                    {controls.homing ? 'ACTIVE' : 'IDLE'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Stop */}
        <div className="mt-6 flex justify-center">
          <button className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-0.5">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
              </div>
              <span>EMERGENCY STOP</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Manual;