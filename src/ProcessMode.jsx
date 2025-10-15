import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Play, Pause, RotateCcw, Power, Camera, ArrowLeft, Usb, Info, X, Activity, Thermometer, Gauge, Ruler } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProcessMode = () => {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [sensorData, setSensorData] = useState({
    temperature: '--',
    force: '--',
    distance: '--',
    status: 'READY'
  });
  const [chartData, setChartData] = useState([]);
  const [isProcessRunning, setIsProcessRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isHoming, setIsHoming] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showCameraPanel, setShowCameraPanel] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const videoRef = useRef(null);
  const [cameraButtonPos, setCameraButtonPos] = useState({ x: window.innerWidth - 70, y: 112 });
  const [configButtonPos, setConfigButtonPos] = useState({ x: window.innerWidth - 70, y: 168 });
  const [isDraggingCamera, setIsDraggingCamera] = useState(false);
  const [isDraggingConfig, setIsDraggingConfig] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const startTimeRef = useRef(Date.now());

  // Load selected configuration from localStorage
  useEffect(() => {
    const config = localStorage.getItem('selectedConfig');
    if (config) {
      setSelectedConfig(JSON.parse(config));
    }
  }, []);

  // Setup serial communication listeners
  useEffect(() => {
    const handleTemperatureUpdate = (temp) => {
      setSensorData(prev => ({ ...prev, temperature: temp.toFixed(1) }));
    };

    const handleForceUpdate = (force) => {
      setSensorData(prev => ({ ...prev, force: force.toFixed(1) }));
      
      // Add to chart data only when process is running or paused
      if (isProcessRunning || isPaused) {
        const currentTime = (Date.now() - startTimeRef.current) / 1000;
        setChartData(prev => {
          const newData = [...prev, {
            time: parseFloat(currentTime.toFixed(1)),
            force: parseFloat(force.toFixed(1)),
            distance: parseFloat(sensorData.distance) || 0
          }];
          return newData;
        });
      }
    };

    const handleDistanceUpdate = (distance) => {
      setSensorData(prev => ({ ...prev, distance: distance.toFixed(1) }));
      
      // Add to chart data only when process is running or paused
      if (isProcessRunning || isPaused) {
        const currentTime = (Date.now() - startTimeRef.current) / 1000;
        setChartData(prev => {
          // Create new data point with both force and distance
          const newDataPoint = {
            time: parseFloat(currentTime.toFixed(1)),
            distance: parseFloat(distance.toFixed(1)),
            force: parseFloat(sensorData.force) || 0
          };
          
          // Add to array - keep all data points
          const newData = [...prev, newDataPoint];
          return newData;
        });
      }
    };

    const handleProcessResponse = (response) => {
      console.log('Process response:', response);
      
      switch (response) {
        case 'started':
          setIsProcessRunning(true);
          setIsPaused(false);
          setIsHoming(false);
          setSensorData(prev => ({ ...prev, status: 'RUNNING' }));
          startTimeRef.current = Date.now();
          // Don't clear chart data here - we want to keep all data from start
          break;
        case 'paused':
          setIsPaused(true);
          setIsHoming(false);
          setSensorData(prev => ({ ...prev, status: 'PAUSED' }));
          break;
        case 'homing': // Handle homing start
          setIsProcessRunning(false);
          setIsPaused(false);
          setIsHoming(true);
          setSensorData(prev => ({ ...prev, status: 'HOMING' }));
          break;
        case 'ready': // Handle homing completion
          setIsHoming(false);
          setIsProcessRunning(false);
          setIsPaused(false);
          setSensorData(prev => ({ ...prev, status: 'READY' }));
          break;
        case 'reset': // Keep this for backward compatibility
          setIsProcessRunning(false);
          setIsPaused(false);
          setIsHoming(true);
          setChartData([]);
          setSensorData(prev => ({ ...prev, status: 'HOMING' }));
          break;
      }
    };

    const handleSerialError = (error) => {
      console.error('Serial error:', error);
      setIsConnected(false);
    };

    // Setup listeners
    window.serialAPI.onForceUpdate(handleForceUpdate);
    window.serialAPI.onTemperatureUpdate(handleTemperatureUpdate);
    window.serialAPI.onDistanceUpdate(handleDistanceUpdate);
    window.serialAPI.onProcessResponse(handleProcessResponse);
    window.serialAPI.onError(handleSerialError);

    // Cleanup listeners
    return () => {
      window.serialAPI.removeAllListeners('temperature-update');
      window.serialAPI.removeAllListeners('force-update');
      window.serialAPI.removeAllListeners('distance-update');
      window.serialAPI.removeAllListeners('process-response');
      window.serialAPI.removeAllListeners('serial-error');
    };
  }, [sensorData.distance, sensorData.force, isProcessRunning, isPaused]);

    // Update main.js to handle PRS:RED feedback
  // In the parseReceivedData function in main.js, add this case:
  /*
  if (data.includes('*PRS:RED#')) {
    console.log('âœ… HOMING COMPLETE - READY');
    mainWindow.webContents.send('process-response', 'ready');
  }
  */

  // Initialize camera feed
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 1280, height: 720 } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera access denied:', err);
      }
    };

    initCamera();
  }, []);

  // Check connection status
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(true);
    };

    checkConnection();
  }, []);

  // Handle dragging for camera button
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingCamera) {
        setCameraButtonPos({
          x: Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.y))
        });
      }
      if (isDraggingConfig) {
        setConfigButtonPos({
          x: Math.max(0, Math.min(window.innerWidth - 56, e.clientX - dragOffset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 56, e.clientY - dragOffset.y))
        });
      }
    };

    const handleMouseUp = () => {
      setIsDraggingCamera(false);
      setIsDraggingConfig(false);
    };

    const handleTouchMove = (e) => {
      if (isDraggingCamera && e.touches.length > 0) {
        setCameraButtonPos({
          x: Math.max(0, Math.min(window.innerWidth - 56, e.touches[0].clientX - dragOffset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 56, e.touches[0].clientY - dragOffset.y))
        });
      }
      if (isDraggingConfig && e.touches.length > 0) {
        setConfigButtonPos({
          x: Math.max(0, Math.min(window.innerWidth - 56, e.touches[0].clientX - dragOffset.x)),
          y: Math.max(0, Math.min(window.innerHeight - 56, e.touches[0].clientY - dragOffset.y))
        });
      }
    };

    const handleTouchEnd = () => {
      setIsDraggingCamera(false);
      setIsDraggingConfig(false);
    };

    if (isDraggingCamera || isDraggingConfig) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDraggingCamera, isDraggingConfig, dragOffset]);

  const formatCommandValue = (value) => {
    return Math.round(parseFloat(value)).toString().padStart(3, '0');
  };

  const handleStart = async () => {
    if (!selectedConfig) {
      console.error('No configuration selected');
      return;
    }

    try {
      const distanceVal = formatCommandValue(selectedConfig.distance);
      const tempVal = formatCommandValue(selectedConfig.temperature);
      const forceVal = formatCommandValue(selectedConfig.peakForce);
      
      const command = `*1:1:${distanceVal}:${tempVal}:${forceVal}#`;
      console.log('Start command with values:', command);
      
      await window.serialAPI.sendData(command);
    } catch (error) {
      console.error('Failed to start process:', error);
    }
  };

  const handlePause = async () => {
    try {
      const distanceVal = formatCommandValue(selectedConfig.distance);
      const tempVal = formatCommandValue(selectedConfig.temperature);
      const forceVal = formatCommandValue(selectedConfig.peakForce);
      
      const command = `*1:2:${distanceVal}:${tempVal}:${forceVal}#`;
      console.log('Pause command with values:', command);
      
      await window.serialAPI.sendData(command);
    } catch (error) {
      console.error('Failed to pause process:', error);
    }
  };

  const handleReset = async () => {
    try {
      const distanceVal = formatCommandValue(selectedConfig.distance);
      const tempVal = formatCommandValue(selectedConfig.temperature);
      const forceVal = formatCommandValue(selectedConfig.peakForce);
      
      const command = `*1:3:${distanceVal}:${tempVal}:${forceVal}#`;
      console.log('Reset command with values:', command);
      
      await window.serialAPI.sendData(command);

      // Clear the sensor data labels immediately when reset is pressed
      setSensorData(prev => ({
        ...prev,
        force: '--',
        distance: '--',
        status: 'HOMING'
      }));
      setChartData([]);
    } catch (error) {
      console.error('Failed to reset process:', error);
    }
  };
  
  // const toggleConnection = () => {
  //   // This could trigger reconnection logic
  //   setIsConnected(!isConnected);
  // };



  const shouldDisableButtons = () => {
    return isHoming || !selectedConfig;
  };

  const handleBack = () => {
    navigate('/handle-config/load');
  };

  const shouldDisableBackButton = () => {
    return sensorData.status !== 'READY';
  };

  const shouldDisablePowerButton = () => {
    return sensorData.status !== 'READY';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900 overflow-hidden">
      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-cyan-500 p-6 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Info className="w-6 h-6 text-white" />
                <h2 className="text-2xl font-bold text-white">Pre-Process Checklist</h2>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-all"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                <h3 className="font-bold text-red-900 mb-2 flex items-center space-x-2">
                  <span className="text-xl">⚠️</span>
                  <span>CRITICAL: Before Starting Process</span>
                </h3>
                <ul className="space-y-2 text-red-800">
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Configuration Loaded:</strong> Ensure a valid configuration is selected and displayed</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Serial Connection:</strong> Verify "CONNECTED" status is shown in green</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Status READY:</strong> System must be in READY state before starting</span>
                  </li>
                </ul>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <h3 className="font-bold text-blue-900 mb-2 flex items-center space-x-2">
                  <span className="text-xl">🔧</span>
                  <span>Equipment & Safety Checks</span>
                </h3>
                <ul className="space-y-2 text-blue-800">
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Camera Feed:</strong> Verify live camera feed is active and clear</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Machine Position:</strong> Ensure machine is at home position (Distance = 0.0 mm)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Sample Placement:</strong> Verify sample is properly positioned and secured</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Emergency Stop:</strong> Know the location of emergency stop button</span>
                  </li>
                </ul>
              </div>

              <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg">
                <h3 className="font-bold text-green-900 mb-2 flex items-center space-x-2">
                  <span className="text-xl">📊</span>
                  <span>Sensor Verification</span>
                </h3>
                <ul className="space-y-2 text-green-800">
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Temperature Reading:</strong> Check temperature sensor shows valid readings</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Force Sensor:</strong> Verify force reading is at baseline (near 0 N)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Distance Sensor:</strong> Confirm distance sensor is responding</span>
                  </li>
                </ul>
              </div>

              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
                <h3 className="font-bold text-yellow-900 mb-2 flex items-center space-x-2">
                  <span className="text-xl">🎯</span>
                  <span>Process Parameters</span>
                </h3>
                <ul className="space-y-2 text-yellow-800">
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Distance:</strong> Verify matches your test requirements</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Peak Force:</strong> Confirm safety threshold is set correctly</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Temperature:</strong> Ensure temperature setting is appropriate</span>
                  </li>
                </ul>
              </div>

              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 rounded-r-lg">
                <h3 className="font-bold text-purple-900 mb-2 flex items-center space-x-2">
                  <span className="text-xl">⚡</span>
                  <span>During Process</span>
                </h3>
                <ul className="space-y-2 text-purple-800">
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Monitor Graph:</strong> Watch real-time force-distance plot for anomalies</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>PAUSE Function:</strong> Use PAUSE button if any issues are observed</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="font-bold mt-1">•</span>
                    <span><strong>Stay Present:</strong> Never leave the machine unattended during operation</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 p-4 rounded-b-2xl border-t border-gray-200">
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-3 px-6 rounded-xl transition-all"
              >
                I Understand - Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Slide Panel - Small Screens */}
      <div className={`xl:hidden fixed top-0 left-0 h-auto w-[90vw] max-w-sm bg-white/95 backdrop-blur-xl shadow-2xl z-40 transform transition-transform duration-300 ${
        showCameraPanel ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Camera className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-bold text-gray-900">Camera Feed</h3>
            </div>
            <button
              onClick={() => setShowCameraPanel(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          <div className="aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Config Slide Panel - Small Screens */}
      <div className={`xl:hidden fixed top-0 right-0 h-auto w-[90vw] max-w-sm bg-white/95 backdrop-blur-xl shadow-2xl z-40 transform transition-transform duration-300 ${
        showConfigPanel ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Configuration</h3>
            <button
              onClick={() => setShowConfigPanel(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-all"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          {selectedConfig ? (
            <div className="space-y-3">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-3 rounded-xl border border-blue-200/50">
                <p className="text-gray-600 text-xs mb-1">Configuration Name</p>
                <p className="text-sm font-bold text-blue-700">{selectedConfig.configName}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-3 rounded-xl border border-green-200/50">
                  <p className="text-gray-600 text-xs mb-1">Distance</p>
                  <p className="text-sm font-bold text-green-700">{selectedConfig.distance} mm</p>
                </div>
                
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-3 rounded-xl border border-cyan-200/50">
                  <p className="text-gray-600 text-xs mb-1">Peak Force</p>
                  <p className="text-sm font-bold text-blue-700">{selectedConfig.peakForce} N</p>
                </div>
                
                <div className="col-span-2 bg-gradient-to-br from-orange-50 to-red-50 p-3 rounded-xl border border-orange-200/50">
                  <p className="text-gray-600 text-xs mb-1">Temperature</p>
                  <p className="text-sm font-bold text-orange-700">{selectedConfig.temperature}°C</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-r-xl">
              <p className="text-yellow-800 text-sm font-medium">⚠️ No configuration selected</p>
            </div>
          )}
        </div>
      </div>

      {/* Header */}
      <header className="relative bg-white/80 backdrop-blur-xl border-b border-gray-200/80 shadow-lg">
        <div className="px-2 sm:px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-6 min-w-0">
              <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
                <button
                  onClick={handleBack}
                  disabled={shouldDisableBackButton()}
                  className={`p-1.5 sm:p-2 rounded-xl transition-all duration-300 group flex-shrink-0 ${
                    shouldDisableBackButton()
                      ? 'bg-gray-100 cursor-not-allowed text-gray-400'
                      : 'p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200'
                  }`}
                >
                  <ArrowLeft className="w-6 h-6 sm:w-5 sm:h-5" />
                </button>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-2xl xl:text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-700 bg-clip-text text-transparent truncate">
                    Process Mode
                  </h1>
                  <p className="text-gray-600 text-xs sm:text-sm mt-0.5 truncate hidden sm:block">Process Mode - Real-time Monitoring</p>
                  {selectedConfig && (
                    <p className="text-blue-600 text-xs sm:text-sm mt-0.5 font-medium truncate hidden lg:block">
                      Using configuration: {selectedConfig.configName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-3 flex-shrink-0">
              <div className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1 sm:py-2 rounded-xl font-medium transition-all ${
                isConnected 
                  ? 'bg-green-50 text-green-700 border border-green-200 shadow-sm shadow-green-500/10' 
                  : 'bg-red-50 text-red-700 border border-red-200 shadow-sm shadow-red-500/10'
              }`}>
                <Usb className="w-3 h-3 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-semibold hidden sm:inline">
                  {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>

              <button 
                onClick={() => setShowInfoModal(true)}
                className="group bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-2xl border border-blue-400/30"
              >
                <Info className="w-4 h-4 sm:w-6 sm:h-6 lg:w-7 lg:h-7 group-hover:scale-110 transition-transform duration-300" />
              </button>
              
              <button 
                onClick={() => {
                  const confirmed = window.confirm("Are you sure you want to exit?");
                  if (confirmed) {
                    window.close();
                  }
                }}
                disabled={shouldDisablePowerButton()}
                className={`group rounded-xl w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 shadow-xl border
                  ${shouldDisablePowerButton() 
                    ? 'bg-gray-200 cursor-not-allowed text-gray-400 border-gray-300' 
                    : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white hover:-translate-y-1 hover:shadow-2xl border-red-400/30'
                  }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="sm:w-6 sm:h-6 lg:w-7 lg:h-7">
                  <path d="M12 2V12M18.36 6.64C19.78 8.05 20.55 9.92 20.55 12C20.55 16.14 17.19 19.5 13.05 19.5C8.91 19.5 5.55 16.14 5.55 12C5.55 9.92 6.32 8.05 7.74 6.64" 
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Toggle Buttons - Small Screens Only - Draggable */}
      <div className="xl:hidden fixed z-30">
        <button
          onMouseDown={(e) => {
            setIsDraggingCamera(true);
            setDragOffset({
              x: e.clientX - cameraButtonPos.x,
              y: e.clientY - cameraButtonPos.y
            });
          }}
          onTouchStart={(e) => {
            if (e.touches.length > 0) {
              setIsDraggingCamera(true);
              setDragOffset({
                x: e.touches[0].clientX - cameraButtonPos.x,
                y: e.touches[0].clientY - cameraButtonPos.y
              });
            }
          }}
          onClick={(e) => {
            if (!isDraggingCamera) {
              setShowCameraPanel(!showCameraPanel);
            }
            e.stopPropagation();
          }}
          style={{
            position: 'fixed',
            left: `${cameraButtonPos.x}px`,
            top: `${cameraButtonPos.y}px`,
            cursor: isDraggingCamera ? 'grabbing' : 'grab',
            touchAction: 'none'
          }}
          className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white p-3 rounded-xl shadow-xl hover:shadow-2xl transition-all"
        >
          <Camera className="w-5 h-5" />
        </button>
        <button
          onMouseDown={(e) => {
            setIsDraggingConfig(true);
            setDragOffset({
              x: e.clientX - configButtonPos.x,
              y: e.clientY - configButtonPos.y
            });
          }}
          onTouchStart={(e) => {
            if (e.touches.length > 0) {
              setIsDraggingConfig(true);
              setDragOffset({
                x: e.touches[0].clientX - configButtonPos.x,
                y: e.touches[0].clientY - configButtonPos.y
              });
            }
          }}
          onClick={(e) => {
            if (!isDraggingConfig) {
              setShowConfigPanel(!showConfigPanel);
            }
            e.stopPropagation();
          }}
          style={{
            position: 'fixed',
            left: `${configButtonPos.x}px`,
            top: `${configButtonPos.y}px`,
            cursor: isDraggingConfig ? 'grabbing' : 'grab',
            touchAction: 'none'
          }}
          className="bg-gradient-to-br from-purple-500 to-indigo-500 text-white p-3 rounded-xl shadow-xl hover:shadow-2xl transition-all"
        >
          <Info className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <main className="relative flex flex-col xl:flex-row h-[calc(100vh-80px)] sm:h-[calc(100vh-100px)] xl:h-[calc(100vh-120px)] gap-2 sm:gap-4 p-2 sm:p-4">
        {/* Left Panel - Camera Feed and Graph */}
        <section className="flex-1 flex flex-col gap-2 sm:gap-6 min-w-0">
          {/* Camera Feed - Hidden on small screens */}
          <div className="hidden xl:block bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 shadow-xl shadow-gray-200/50 h-[45%]">
            <div className="p-4 border-b border-gray-200/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Live Camera Feed</h2>
                    <p className="text-gray-600 text-sm">Real-time Machine Vision</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
                  <span className="text-red-600 text-sm font-medium">LIVE</span>
                </div>
              </div>
            </div>
            
            <div className="p-6 h-[calc(100%-88px)]">
              <div className="relative w-full h-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200/80 shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/10 to-transparent pointer-events-none"></div>
                <div className="absolute top-4 left-4 flex items-center space-x-2 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-gray-900 text-xs font-medium">LIVE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Chart with Sensor Data on Small Screens */}
          <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-gray-200/80 p-3 sm:p-6 shadow-xl shadow-gray-200/50 min-h-0 flex flex-col">
            <div className="mb-2 sm:mb-4 flex-shrink-0">
              <h3 className="text-base sm:text-xl font-bold text-gray-900">Real-time Analytics</h3>
              <p className="text-gray-600 text-xs sm:text-sm hidden sm:block">Force & Distance vs Time</p>
            </div>
            
            {/* Sensor Data - Only visible on small screens */}
            <div className="xl:hidden mb-3 grid grid-cols-2 gap-2 flex-shrink-0">
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200/50 p-2">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-md flex items-center justify-center">
                    <Thermometer className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-gray-600 text-xs font-medium">Temp</p>
                </div>
                <p className="text-sm font-bold text-orange-600">{sensorData.temperature}°C</p>
              </div>

              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border border-cyan-200/50 p-2">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-md flex items-center justify-center">
                    <Gauge className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-gray-600 text-xs font-medium">Force</p>
                </div>
                <p className="text-sm font-bold text-blue-600">{sensorData.force} N</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200/50 p-2">
                <div className="flex items-center space-x-2 mb-1">
                  <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-md flex items-center justify-center">
                    <Ruler className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-gray-600 text-xs font-medium">Dist</p>
                </div>
                <p className="text-sm font-bold text-green-600">{sensorData.distance} mm</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200/50 p-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                      sensorData.status === 'RUNNING' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                      sensorData.status === 'PAUSED' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                      sensorData.status === 'HOMING' ? 'bg-gradient-to-br from-purple-500 to-indigo-500' :
                      sensorData.status === 'READY' ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : 
                      'bg-gradient-to-br from-gray-400 to-gray-500'
                    }`}>
                      <Activity className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-gray-600 text-xs font-medium">Status</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${
                    sensorData.status === 'RUNNING' ? 'bg-green-500 animate-pulse' :
                    sensorData.status === 'PAUSED' ? 'bg-yellow-500' :
                    sensorData.status === 'HOMING' ? 'bg-purple-500 animate-pulse' :
                    sensorData.status === 'READY' ? 'bg-blue-500' : 'bg-gray-400'
                  }`}></div>
                </div>
                <p className={`text-sm font-bold ${
                  sensorData.status === 'RUNNING' ? 'text-green-600' :
                  sensorData.status === 'PAUSED' ? 'text-yellow-600' :
                  sensorData.status === 'HOMING' ? 'text-purple-600' :
                  sensorData.status === 'READY' ? 'text-blue-600' : 'text-gray-600'
                }`}>{sensorData.status}</p>
              </div>
            </div>
            
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={chartData} 
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.7} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#9ca3af' }}
                    label={{ value: 'Time (s)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#9ca3af' }}
                    label={{ value: 'Distance (mm) / Force (N)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      color: '#1f2937',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                      backdropFilter: 'blur(12px)'
                    }}
                  />
                  {/* <Legend /> */}
                  <Line 
                    type="monotone" 
                    dataKey="force" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={false}
                    name="Force (N)"
                    activeDot={{ r: 6, fill: '#3b82f6' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="distance" 
                    stroke="#22c55e" 
                    strokeWidth={3}
                    dot={false}
                    name="Distance (mm)"
                    activeDot={{ r: 6, fill: '#22c55e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Right Panel - Configuration and Sensor Data */}
        <section className="w-full xl:w-[800px] flex flex-col gap-2 sm:gap-6">
          {/* Active Configuration Parameters - Hidden on small screens */}
          <div className="hidden xl:block bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 p-6 shadow-xl shadow-gray-200/50">
            <div className="mb-2">
              <h3 className="text-xl font-bold text-gray-900">Active Configuration</h3>
              <p className="text-gray-600 text-sm">Current process parameters</p>
            </div>
            
            {selectedConfig ? (
              <div className="space-y-3">
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-200/50">
                  <p className="text-gray-600 text-sm mb-1">Configuration Name</p>
                  <p className="text-lg font-bold text-blue-700">{selectedConfig.configName}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200/50">
                    <p className="text-gray-600 text-sm mb-1">Distance</p>
                    <p className="text-xl font-bold text-green-700">{selectedConfig.distance} mm</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-4 rounded-xl border border-cyan-200/50">
                    <p className="text-gray-600 text-sm mb-1">Peak Force</p>
                    <p className="text-xl font-bold text-blue-700">{selectedConfig.peakForce} N</p>
                  </div>
                  
                  <div className="col-span-2 bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-xl border border-orange-200/50">
                    <p className="text-gray-600 text-sm mb-1">Temperature</p>
                    <p className="text-xl font-bold text-orange-700">{selectedConfig.temperature}°C</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-xl">
                <p className="text-yellow-800 font-medium">⚠️ No configuration selected</p>
                <p className="text-yellow-700 text-sm mt-1">Please load a configuration to proceed</p>
              </div>
            )}
          </div>

          {/* Real-time Sensor Data - Hidden on small screens */}
          <div className="hidden xl:block bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 p-6 shadow-xl shadow-gray-200/50">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-gray-900">Real-time Sensors</h3>
              <p className="text-gray-600 text-sm">Live monitoring data</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200/50 p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Thermometer className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-gray-600 text-sm font-medium">Temperature</p>
                </div>
                <p className="text-2xl font-bold text-orange-600">{sensorData.temperature}°C</p>
              </div>

              <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-200/50 p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Gauge className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-gray-600 text-sm font-medium">Force</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">{sensorData.force} N</p>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200/50 p-4">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Ruler className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-gray-600 text-sm font-medium">Distance</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{sensorData.distance} mm</p>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ${
                      sensorData.status === 'RUNNING' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                      sensorData.status === 'PAUSED' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                      sensorData.status === 'HOMING' ? 'bg-gradient-to-br from-purple-500 to-indigo-500' :
                      sensorData.status === 'READY' ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : 
                      'bg-gradient-to-br from-gray-400 to-gray-500'
                    }`}>
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-gray-600 text-sm font-medium">Status</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${
                    sensorData.status === 'RUNNING' ? 'bg-green-500 animate-pulse' :
                    sensorData.status === 'PAUSED' ? 'bg-yellow-500' :
                    sensorData.status === 'HOMING' ? 'bg-purple-500 animate-pulse' :
                    sensorData.status === 'READY' ? 'bg-blue-500' : 'bg-gray-400'
                  }`}></div>
                </div>
                <p className={`text-2xl font-bold ${
                  sensorData.status === 'RUNNING' ? 'text-green-600' :
                  sensorData.status === 'PAUSED' ? 'text-yellow-600' :
                  sensorData.status === 'HOMING' ? 'text-purple-600' :
                  sensorData.status === 'READY' ? 'text-blue-600' : 'text-gray-600'
                }`}>{sensorData.status}</p>
              </div>
            </div>
          </div>

          {/* Control Buttons - Now fixed at bottom on small screens */}
          <div className="xl:relative fixed bottom-0 left-0 right-0 bg-white/95 xl:bg-white/70 backdrop-blur-xl rounded-t-2xl xl:rounded-2xl border-t xl:border border-gray-200/80 p-3 sm:p-4 xl:p-6 shadow-2xl xl:shadow-xl shadow-gray-200/50 z-20">
            <div className="mb-2 hidden xl:block">
              <h3 className="text-xl font-bold text-gray-900">Process Controls</h3>
              <p className="text-gray-600 text-sm">Manage process execution</p>
            </div>
            
            <div className="flex space-x-2 sm:space-x-3 justify-center max-w-2xl mx-auto">
              <button
                onClick={handleStart}
                disabled={shouldDisableButtons() || (isProcessRunning && !isPaused)}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-3 sm:py-3 rounded-lg sm:rounded-xl font-bold transition-all transform hover:scale-[1.02] min-w-0 ${
                  shouldDisableButtons() || (isProcessRunning && !isPaused)
                    ? 'bg-gray-200 cursor-not-allowed text-gray-500 border border-gray-300'
                    : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-xl shadow-green-500/25 border border-green-400/30'
                }`}
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">START</span>
              </button>
              
              <button
                onClick={handlePause}
                disabled={shouldDisableButtons() || !isProcessRunning || isPaused}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-3 sm:py-3 rounded-lg sm:rounded-xl font-bold transition-all transform hover:scale-[1.02] min-w-0 ${
                  shouldDisableButtons() || !isProcessRunning || isPaused
                    ? 'bg-gray-200 cursor-not-allowed text-gray-500 border border-gray-300'
                    : 'bg-gradient-to-br from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-xl shadow-yellow-500/25 border border-yellow-400/30'
                }`}
              >
                <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">PAUSE</span>
              </button>
              
              <button
                onClick={handleReset}
                disabled={!selectedConfig || isHoming}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-3 sm:py-3 rounded-lg sm:rounded-xl font-bold transition-all transform hover:scale-[1.02] min-w-0 ${
                  !selectedConfig || isHoming
                    ? 'bg-gray-200 cursor-not-allowed text-gray-500 border border-gray-300'
                    : 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl shadow-red-500/25 border border-red-400/30'
                }`}
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">RESET</span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ProcessMode;