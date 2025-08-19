import React, { useState, useEffect } from 'react';
import { ArrowLeft, Power, AlertCircle, X, Thermometer, Zap, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Manual = () => {
  const navigate = useNavigate();
  const [showSerialError, setShowSerialError] = useState(true);
  const [temperature, setTemperature] = useState(37.5);
  const [force, setForce] = useState(0);
  const [controls, setControls] = useState({
    clamp: false,
    heater: false,
    homing: false
  });
  const [catheterPosition, setCatheterPosition] = useState(50); // Percentage position

  // Simulate real-time data updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate temperature fluctuation
      if (controls.heater) {
        setTemperature(prev => Math.min(40, prev + (Math.random() * 0.5)));
      } else {
        setTemperature(prev => Math.max(20, prev - (Math.random() * 0.2)));
      }
      
      // Simulate force readings
      setForce(prev => Math.max(0, prev + (Math.random() * 2 - 1)));
    }, 1000);

    return () => clearInterval(interval);
  }, [controls.heater]);

  const handleControlToggle = (controlName) => {
    setControls(prev => ({
      ...prev,
      [controlName]: !prev[controlName]
    }));
  };

  const moveCatheter = (direction) => {
    setCatheterPosition(prev => {
      if (direction === 'left') {
        return Math.max(0, prev - 10);
      } else {
        return Math.min(100, prev + 10);
      }
    });
  };

  const resetCatheter = () => {
    setCatheterPosition(50);
    setControls(prev => ({ ...prev, homing: true }));
    
    // Simulate homing process
    setTimeout(() => {
      setControls(prev => ({ ...prev, homing: false }));
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/main-menu')}
              className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Manual Mode</h1>
          </div>
          
          <button className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200">
            <Power className="w-6 h-6" />
          </button>
        </div>

        {/* Serial Port Error */}
        {showSerialError && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-red-800 font-semibold">ERROR: REQUIRED SERIAL PORT NOT FOUND</p>
                  <p className="text-red-600 text-sm mt-1">Please ensure the device is connected and try again.</p>
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
                {/* Simulated medical device view */}
                <div className="relative w-full h-full bg-gradient-to-br from-slate-300 to-slate-400">
                  {/* Catheter visualization */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-3/4 h-2 bg-slate-600 rounded-full">
                      {/* Catheter tip */}
                      <div 
                        className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-600 rounded-full shadow-lg transition-all duration-300"
                        style={{ left: `${catheterPosition}%` }}
                      ></div>
                    </div>
                  </div>
                  
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
                  
                  {/* Status indicator */}
                  <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded-lg text-sm">
                    Position: {catheterPosition}%
                  </div>
                </div>
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
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Clamp OFF</h3>
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
                  onClick={() => moveCatheter('left')}
                  className="w-16 h-16 bg-white border-4 border-slate-300 rounded-full flex items-center justify-center text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={() => moveCatheter('right')}
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