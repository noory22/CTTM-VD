import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Play, Pause, RotateCcw, Power, Camera, ArrowLeft, Usb, Info, X, Activity, Thermometer, Gauge, Ruler, Flame } from 'lucide-react';
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
  
  // Temperature Control State
  const [temperatureStatus, setTemperatureStatus] = useState({
    isHeatingRequired: false,
    isHeatingComplete: false,
    showHeaterDialog: false,
    dialogMessage: '',
    dialogType: '' ,// 'heating-required' or 'heating-complete'
    heaterButtonDisabled: false,
    targetTemperature: null,
    wasTemperatureDrop: false // NEW: Track if temperature dropped during process
  });

  // CSV Logging state
  const [isLogging, setIsLogging] = useState(false);
  const lastLoggedDataRef = useRef({ time: null, distance: null, force: null });

  // Screen size state
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // Monitor screen size changes
  useEffect(() => {
    const handleResize = () => {
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine responsive breakpoints
  const isXlScreen = screenSize.width >= 1920;
  const isLgScreen = screenSize.width >= 1366 && screenSize.width < 1920;
  const isMdScreen = screenSize.width >= 1024 && screenSize.width < 1366;
  const isSmScreen = screenSize.width < 1024;

  // Load selected configuration from localStorage
  useEffect(() => {
    const config = localStorage.getItem('selectedConfig');
    if (config) {
      setSelectedConfig(JSON.parse(config));
    }
  }, []);

    //-----------------------------------------------------------------//
  // Temperature monitoring effect - UPDATED
  useEffect(() => {
    if (!selectedConfig || sensorData.temperature === '--') return;

    const currentTemp = parseFloat(sensorData.temperature);
    const targetTemp = parseFloat(selectedConfig.temperature);

    if (isNaN(currentTemp) || isNaN(targetTemp)) return;

    console.log(`🌡️ Temperature Check: Current=${currentTemp}°C, Target=${targetTemp}°C, ProcessRunning=${isProcessRunning}, Status=${sensorData.status}`);

    // NEW: Check if temperature drops below target during running process
    if (isProcessRunning && !isPaused && currentTemp < targetTemp) {
      console.log('❌ Temperature dropped below target during process - Auto-pausing');
      
      // Set temperature drop flag
      setTemperatureStatus(prev => ({
        ...prev,
        wasTemperatureDrop: true
      }));

      // Auto-pause the process using the same command as manual pause
      handleAutoPause();
      
      // Show heater dialog
      setTemperatureStatus(prev => ({
        ...prev,
        isHeatingRequired: true,
        isHeatingComplete: false,
        showHeaterDialog: true,
        dialogMessage: `Temperature dropped to ${currentTemp}°C (below required ${targetTemp}°C). Process auto-paused. Please turn ON the heater.`,
        dialogType: 'heating-required',
        heaterButtonDisabled: false,
        targetTemperature: targetTemp
      }));
      
      return; // Exit early since we're handling the temperature drop case
    }

    // Existing temperature monitoring logic for non-running states
    if (currentTemp < targetTemp) {
      // Temperature is below target
      if (!temperatureStatus.isHeatingRequired) {
        setTemperatureStatus(prev => ({
          ...prev,
          isHeatingRequired: true,
          isHeatingComplete: false,
          showHeaterDialog: true,
          dialogMessage: `Real-time temperature (${currentTemp}°C) is less than required (${targetTemp}°C). Please turn ON the heater.`,
          dialogType: 'heating-required',
          heaterButtonDisabled: false,
          targetTemperature: targetTemp,
          wasTemperatureDrop: false
        }));
        console.log('🔥 Heating required - showing dialog');
      }
    } else {
      // Temperature reached or exceeded target
      if (temperatureStatus.isHeatingRequired && !temperatureStatus.isHeatingComplete) {
        setTemperatureStatus(prev => ({
          ...prev,
          isHeatingRequired: false,
          isHeatingComplete: true,
          showHeaterDialog: true,
          dialogMessage: `Real-time temperature (${currentTemp}°C) has reached the required level (${targetTemp}°C). Please turn OFF the heater.`,
          dialogType: 'heating-complete',
          heaterButtonDisabled: false,
          targetTemperature: targetTemp,
          wasTemperatureDrop: false
        }));
        console.log('✅ Heating complete - showing turn off dialog');
      }
    }
  }, [sensorData.temperature, selectedConfig, temperatureStatus.isHeatingRequired, temperatureStatus.isHeatingComplete, isProcessRunning, isPaused]);
  //-----------------------------------------------------------------//

  // NEW: Auto-pause function for temperature drops - USES SAME COMMAND AS MANUAL PAUSE
  const handleAutoPause = async () => {
    try {
      if (!selectedConfig) return;
      
      const distanceVal = formatCommandValue(selectedConfig.distance);
      const tempVal = formatCommandValue(selectedConfig.temperature);
      const forceVal = formatCommandValue(selectedConfig.peakForce);
      
      const command = `*1:2:${distanceVal}:${tempVal}:${forceVal}#`;
      console.log('🔄 Auto-pause command due to temperature drop:', command);
      
      await window.serialAPI.sendData(command);
      
      // Note: We don't update local state here because the process-response listener
      // will handle the state update when it receives the 'paused' response from the machine
      
    } catch (error) {
      console.error('Failed to auto-pause process:', error);
    }
  };
  // CSV Logging functions
  const startCsvLogging = async () => {
    if (!selectedConfig) {
      console.error('No configuration selected for logging');
      return;
    }
    
    try {
      console.log('🟡 Starting CSV logging with config:', selectedConfig);
      const result = await window.serialAPI.startCsvLogging(selectedConfig);
      if (result.success) {
        setIsLogging(true);
        console.log('✅ CSV logging started:', result.fileName);
        lastLoggedDataRef.current = { time: null, distance: null, force: null };
      } else {
        console.error('❌ Failed to start CSV logging:', result.error);
      }
    } catch (error) {
      console.error('❌ Error starting CSV logging:', error);
    }
  };

  const stopCsvLogging = async () => {
    if (isLogging) {
      try {
        const result = await window.serialAPI.stopCsvLogging();
        if (result.success) {
          setIsLogging(false);
          console.log('🟡 CSV logging stopped:', result.fileName);
        }
      } catch (error) {
        console.error('Error stopping CSV logging:', error);
      }
    }
  };

  const logSensorData = async (time, distance, force) => {
    const timeNum = parseFloat(time);
    const distNum = parseFloat(distance);
    const forceNum = parseFloat(force);
    
    if (isNaN(timeNum) || isNaN(distNum) || isNaN(forceNum) || 
        distance === '--' || force === '--') {
      return;
    }
    
    // Prevent logging duplicate data points
    if (lastLoggedDataRef.current.time === timeNum && 
        lastLoggedDataRef.current.distance === distNum && 
        lastLoggedDataRef.current.force === forceNum) {
      return;
    }
    
    try {
      console.log(`📊 ATTEMPTING LOG: Time=${timeNum}s, Distance=${distNum}mm, Force=${forceNum}N, isLogging=${isLogging}`);
      
      await window.serialAPI.logSensorData({
        time: timeNum,
        distance: distNum,
        force: forceNum
      });
      
      lastLoggedDataRef.current = { time: timeNum, distance: distNum, force: forceNum };
      console.log(`✅ SUCCESSFULLY LOGGED: Time=${timeNum}s, Distance=${distNum}mm, Force=${forceNum}N`);
    } catch (error) {
      console.error('❌ Error logging sensor data:', error);
    }
  };
  //---------------------------------------------------------------------------------//
  // Heater Control Functions - UPDATED
  const handleHeaterOn = async () => {
    try {
      // Disable button immediately
      setTemperatureStatus(prev => ({
        ...prev,
        heaterButtonDisabled: true
      }));
      
      console.log('🔥 Turning heater ON...');
      await window.serialAPI.controlHeater('on');
      console.log('✅ Heater ON command sent');
      
    } catch (error) {
      console.error('❌ Failed to turn heater ON:', error);
    }
  };

  const handleHeaterOff = async () => {
    try {
      // Disable button immediately
      setTemperatureStatus(prev => ({
        ...prev,
        heaterButtonDisabled: true
      }));
      
      console.log('🔥 Turning heater OFF...');
      await window.serialAPI.controlHeater('off');
      
      // Close dialog and enable start button
      setTemperatureStatus({
        isHeatingRequired: false,
        isHeatingComplete: false,
        showHeaterDialog: false,
        dialogMessage: '',
        dialogType: '',
        heaterButtonDisabled: false,
        targetTemperature: null,
        wasTemperatureDrop: false
      });
      console.log('✅ Heater OFF command sent, dialog closed');
      
    } catch (error) {
      console.error('❌ Failed to turn heater OFF:', error);
    }
  };

  const closeHeaterDialog = () => {
    // Only allow closing for heating-complete dialog, not for heating-required
    if (temperatureStatus.dialogType === 'heating-complete') {
      setTemperatureStatus(prev => ({
        ...prev,
        showHeaterDialog: false,
        wasTemperatureDrop: false
      }));
    }
  };
  //---------------------------------------------------------------------------------//
  // Setup serial communication listeners
  useEffect(() => {
    console.log('🔄 Setting up serial communication listeners...'); // Debug log
    const handleTemperatureUpdate = (temp) => {
      setSensorData(prev => ({ ...prev, temperature: temp }));
    };

    // const handleForceUpdate = (force) => {
    //   console.log('📱 ProcessMode.jsx received force:', force);
    //   const currentTime = (Date.now() - startTimeRef.current) / 1000;
    //   const timeFormatted = parseFloat(currentTime.toFixed(1));
    //   const forceFormatted = parseFloat(force.toFixed(1));
      
    //   setSensorData(prev => ({ ...prev, force: forceFormatted.toFixed(1) }));
      
    //   // Add to chart data only when process is running or paused
    //   if (isProcessRunning || isPaused) {
    //     setChartData(prev => {
    //       const newData = [...prev, {
    //         time: timeFormatted,
    //         force: forceFormatted,
    //         distance: parseFloat(sensorData.distance) || 0
    //       }];
    //       return newData;
    //     });
    //   }
      
    //   // Log data when process is running and not paused
    //   if (isProcessRunning && !isPaused && sensorData.distance !== '--') {
    //     logSensorData(timeFormatted, sensorData.distance, forceFormatted);
    //   }
    // };
    const handleForceUpdate = (force) => {
      console.log('📱 ProcessMode.jsx received force:', force);
      const currentTime = (Date.now() - startTimeRef.current) / 1000;
      const timeFormatted = parseFloat(currentTime.toFixed(1));
      const forceFormatted = parseFloat(force.toFixed(1));
      
      setSensorData(prev => ({ ...prev, force: forceFormatted.toFixed(1) }));
      
      // NEW: Auto-pause check - Add this right after setting sensor data
      if (selectedConfig && isProcessRunning && !isPaused) {
        const peakForce = parseFloat(selectedConfig.peakForce);
        if (!isNaN(forceFormatted) && !isNaN(peakForce) && forceFormatted >= peakForce) {
          console.log('🛑 Peak force safety limit reached: ${forceFormatted}N >= ${peakForce}N');
          console.log('🟡 Auto-pausing process for safety...');
          
          // Use the pause logic directly instead of handlePause to avoid command formatting issues
          const distanceVal = formatCommandValue(selectedConfig.distance);
          const tempVal = formatCommandValue(selectedConfig.temperature);
          const forceVal = formatCommandValue(selectedConfig.peakForce);
          
          const command = '*1:2:${distanceVal}:${tempVal}:${forceVal}#';
          console.log('Auto-pause command:', command);
          
          window.serialAPI.sendData(command);
          return; // Stop further processing
        }
      }
      
      // Add to chart data only when process is running or paused
      if (isProcessRunning || isPaused) {
        setChartData(prev => {
          const newData = [...prev, {
            time: timeFormatted,
            force: forceFormatted,
            distance: parseFloat(sensorData.distance) || 0
          }];
          return newData;
        });
      }
      
      // Log data when process is running and not paused
      if (isProcessRunning && !isPaused && sensorData.distance !== '--') {
        logSensorData(timeFormatted, sensorData.distance, forceFormatted);
      }
    };

    const handleDistanceUpdate = (distance) => {
      const currentTime = (Date.now() - startTimeRef.current) / 1000;
      const timeFormatted = parseFloat(currentTime.toFixed(1));
      const distanceFormatted = parseFloat(distance.toFixed(1));
      
      setSensorData(prev => ({ ...prev, distance: distanceFormatted }));
      
      // Add to chart data only when process is running or paused
      if (isProcessRunning || isPaused) {
        setChartData(prev => {
          // Create new data point with both force and distance
          const newDataPoint = {
            time: timeFormatted,
            distance: distanceFormatted,
            force: parseFloat(sensorData.force) || 0
          };
          
          // Add to array - keep all data points
          const newData = [...prev, newDataPoint];
          return newData;
        });
      }
      
      // Log data when process is running and not paused
      if (isProcessRunning && !isPaused && sensorData.force !== '--') {
        logSensorData(timeFormatted, distanceFormatted, sensorData.force);
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
          
          console.log('🟡 Process started, starting CSV logging...');
          if (selectedConfig && window.serialAPI) {
            startCsvLogging();
          } else { 
            console.error('❌ Cannot start logging: missing config or serialAPI');
          }
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
          
          console.log('🟡 Process ready, stopping CSV logging...');
          stopCsvLogging();
          break;
          
        case 'reset': // Keep this for backward compatibility
          setIsProcessRunning(false);
          setIsPaused(false);
          setIsHoming(true);
          setChartData([]);
          setSensorData(prev => ({ ...prev, status: 'HOMING' }));
          
          console.log('🟡 Process reset, stopping CSV logging...');
          stopCsvLogging();
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
  }, [sensorData.distance, sensorData.force, isProcessRunning, isPaused, selectedConfig]);

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
    // Check if heating is required
    if (temperatureStatus.isHeatingRequired && !temperatureStatus.wasTemperatureDrop) {
      console.log('❌ Cannot start process - heating required');
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

      // Reset temperature status
      setTemperatureStatus({
        isHeatingRequired: false,
        isHeatingComplete: false,
        showHeaterDialog: false,
        dialogMessage: '',
        dialogType: '',
        heaterButtonDisabled: false,
        targetTemperature: null,
        wasTemperatureDrop: false
      });
      
      // Stop CSV logging when reset is pressed
      stopCsvLogging();
    } catch (error) {
      console.error('Failed to reset process:', error);
    }
  };

  const shouldDisableButtons = () => {
    return isHoming || !selectedConfig;
  };

  const handleBack = () => {
    navigate('/handle-config/load');
  };

  const getStartButtonText = () => {
    return isPaused ? 'RESUME' : 'START';
  };

  const shouldDisableBackButton = () => {
    return sensorData.status !== 'READY';
  };

  const shouldDisablePowerButton = () => {
    return sensorData.status !== 'READY';
  };

  return (
    <div className="min-h-screen h-screen bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900 overflow-hidden flex flex-col">
      {/* Heater Control Modal */}
      {temperatureStatus.showHeaterDialog && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-200/80">
            <div className={`p-6 rounded-t-2xl flex items-center justify-between ${
              temperatureStatus.dialogType === 'heating-required' 
                ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                : 'bg-gradient-to-r from-green-500 to-emerald-500'
            }`}>
              <div className="flex items-center space-x-3">
                <Flame className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">
                  {temperatureStatus.dialogType === 'heating-required' 
                    ? (temperatureStatus.wasTemperatureDrop ? 'Process Auto-Paused' : 'Heating Required')
                    : 'Heating Complete'}
                </h2>
              </div>
              {temperatureStatus.dialogType === 'heating-complete' && (
                <button
                  onClick={closeHeaterDialog}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all"
                >
                  <X className="w-6 h-6 text-white" />
                </button>
              )}
            </div>
            
            <div className="p-6">
              {/* Temperature Display */}
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Real-time Temperature</p>
                    <div className="flex items-center justify-center space-x-2">
                      <Thermometer className="w-5 h-5 text-blue-600" />
                      <p className="text-2xl font-bold text-blue-700">{sensorData.temperature}°C</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">User-Defined Temperature</p>
                    <div className="flex items-center justify-center space-x-2">
                      <Flame className="w-5 h-5 text-orange-600" />
                      <p className="text-2xl font-bold text-orange-700">
                        {temperatureStatus.targetTemperature || selectedConfig?.temperature}°C
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Progress indicator */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>0°C</span>
                    <span>Progress</span>
                    <span>{temperatureStatus.targetTemperature || selectedConfig?.temperature}°C</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-1000 ${
                        temperatureStatus.dialogType === 'heating-required' 
                          ? 'bg-orange-500' 
                          : 'bg-green-500'
                      }`}
                      style={{ 
                        width: `${Math.min(100, (parseFloat(sensorData.temperature) / (temperatureStatus.targetTemperature || 1)) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
              
              {/* Message - UPDATED FOR TEMPERATURE DROP */}
              <div className={`p-4 rounded-xl mb-4 ${
                temperatureStatus.dialogType === 'heating-required' 
                  ? 'bg-orange-50 border border-orange-200' 
                  : 'bg-green-50 border border-green-200'
              }`}>
                <p className={`font-medium text-center ${
                  temperatureStatus.dialogType === 'heating-required' ? 'text-orange-800' : 'text-green-800'
                }`}>
                  {temperatureStatus.dialogMessage}
                </p>
                {temperatureStatus.wasTemperatureDrop && (
                  <p className="text-orange-700 text-sm mt-2 text-center font-semibold">
                    ⚠️ Process will resume automatically when temperature reaches target
                  </p>
                )}
              </div>
              
              {/* Action Button */}
              <div className="flex space-x-3">
                {temperatureStatus.dialogType === 'heating-required' ? (
                  <button
                    onClick={handleHeaterOn}
                    disabled={temperatureStatus.heaterButtonDisabled}
                    className={`flex-1 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 ${
                      temperatureStatus.heaterButtonDisabled
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg'
                    }`}
                  >
                    <Flame className="w-5 h-5" />
                    <span>
                      {temperatureStatus.heaterButtonDisabled ? 'Turning ON...' : 'Turn Heater ON'}
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={handleHeaterOff}
                    disabled={temperatureStatus.heaterButtonDisabled}
                    className={`flex-1 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 ${
                      temperatureStatus.heaterButtonDisabled
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg'
                    }`}
                  >
                    <Flame className="w-5 h-5" />
                    <span>
                      {temperatureStatus.heaterButtonDisabled ? 'Turning OFF...' : 'Turn Heater OFF'}
                    </span>
                  </button>
                )}
              </div>
              
              {/* Status Message - UPDATED */}
              {temperatureStatus.dialogType === 'heating-required' && (
                <div className="mt-3 text-center">
                  <p className="text-orange-600 text-sm font-medium">
                    {temperatureStatus.wasTemperatureDrop 
                      ? '⚠️ Process paused. Resume when temperature reaches target'
                      : '⚠️ Start button will be enabled when temperature reaches target'
                    }
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Current: {sensorData.temperature}°C / Target: {temperatureStatus.targetTemperature || selectedConfig?.temperature}°C
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600
                 hover:to-cyan-600 text-white font-bold py-3 px-6 rounded-xl transition-all"
              >
                I Understand - Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Slide Panel - Small & Medium Screens */}
      <div className={`${isXlScreen ? 'hidden' : 'fixed'} top-0 left-0 h-auto w-[90vw] max-w-sm bg-white/95 
      backdrop-blur-xl shadow-2xl z-40 transform transition-transform duration-300 ${
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

      {/* Config Slide Panel - Small & Medium Screens */}
      <div className={`${isXlScreen ? 'hidden' : 'fixed'} top-0 right-0 h-auto w-[90vw] max-w-sm bg-white/95 
      backdrop-blur-xl shadow-2xl z-40 transform transition-transform duration-300 ${
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
      <header className="flex-shrink-0 relative bg-white/80 backdrop-blur-xl border-b border-gray-200/80 shadow-lg">
        <div className={`${isXlScreen ? 'px-6 py-4' : isLgScreen ? 'px-4 py-3' : 'px-3 py-2'}`}>
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
                  <ArrowLeft className={`${isXlScreen ? 'w-6 h-6' : 'w-5 h-5'}`} />
                </button>
                <div className="min-w-0">
                  <h1 className={`${isXlScreen ? 'text-2xl' : isLgScreen ? 'text-xl' : 'text-lg'} font-bold bg-gradient-to-r
                   from-gray-900 to-blue-700 bg-clip-text text-transparent truncate`}>
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
                <Usb className={`${isXlScreen ? 'w-5 h-5' : 'w-4 h-4'}`} />
                <span className="text-xs sm:text-sm font-semibold hidden sm:inline">
                  {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>

              <button 
                onClick={() => setShowInfoModal(true)}
                className="group bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white 
                rounded-xl w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 
                hover:-translate-y-1 shadow-xl hover:shadow-2xl border border-blue-400/30"
              >
                <Info className={`${isXlScreen ? 'w-7 h-7' : 'w-5 h-5'} group-hover:scale-110 transition-transform duration-300`} />
              </button>
              
              <button 
                onClick={() => {
                  const confirmed = window.confirm("Are you sure you want to exit?");
                  if (confirmed) {
                    window.close();
                  }
                }}
                disabled={shouldDisablePowerButton()}
                className={`group rounded-xl lg:rounded-2xl w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex 
                  items-center justify-center transition-all duration-300 shadow-lg border
                  ${shouldDisablePowerButton() 
                    ? 'bg-gray-200 cursor-not-allowed text-gray-400 border-gray-300' 
                    : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white hover:-translate-y-1 hover:shadow-xl border-red-400/30'
                  }`}
                >
                <Power className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 transition-transform duration-300
                  ${shouldDisablePowerButton() ? '' : 'group-hover:scale-110'}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Floating Toggle Buttons - Small & Medium Screens Only - Draggable */}
      {!isXlScreen && (
        <div className="fixed z-30">
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
      )}

      {/* Main Content */}
      <main className={`relative flex ${isXlScreen ? 'flex-row' : 'flex-col'} flex-1 ${isXlScreen ? 'gap-6 p-6' : isLgScreen ? 'gap-4 p-4' : 'gap-3 p-3'} min-h-0 overflow-hidden`}>
        {/* Left Panel - Camera Feed and Graph */}
        <section className={`flex-1 flex flex-col ${isXlScreen ? 'gap-6' : 'gap-4'} min-w-0 min-h-0`}>
          {/* Camera Feed - Hidden on small & medium screens */}
          {isXlScreen && (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 shadow-xl shadow-gray-200/50 flex-[0_0_40%] min-h-0">
              <div className="p-3 border-b border-gray-200/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center shadow-sm">
                      <Camera className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Live Camera Feed</h2>
                      <p className="text-gray-600 text-xs">Real-time Machine Vision</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
                    <span className="text-red-600 text-xs font-medium">LIVE</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 h-[calc(100%-60px)]">
                <div className="relative w-full h-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200/80 shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/10 to-transparent pointer-events-none"></div>
                  <div className="absolute top-3 left-3 flex items-center space-x-2 bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg shadow-sm">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-900 text-xs font-medium">LIVE</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Real-time Chart with Sensor Data on Small Screens */}
          <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-gray-200/80 p-3 sm:p-4 shadow-xl shadow-gray-200/50 min-h-0 flex flex-col">
            <div className="mb-2 sm:mb-3 flex-shrink-0">
              <h3 className={`${isXlScreen ? 'text-lg' : 'text-base'} font-bold text-gray-900`}>Real-time Analytics</h3>
              <p className="text-gray-600 text-xs hidden sm:block">Force & Distance vs Time</p>
            </div>
            
            {/* Sensor Data - Only visible on small & medium screens */}
            {!isXlScreen && (
              <div className="mb-3 grid grid-cols-2 gap-2 flex-shrink-0">
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200/50 p-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-md flex items-center justify-center">
                      <Thermometer className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-gray-600 text-xs font-medium">Temperature</p>
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
                    <p className="text-gray-600 text-xs font-medium">Distance</p>
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
            )}
            
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={chartData} 
                  margin={{ top: 5, right: 10, left: 0, bottom: 25 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.7} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: '#9ca3af' }}
                    label={{ value: 'Time (s)', position: 'insideBottom', offset: -3, fontSize: 11 }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: '#9ca3af' }}
                    width={40}
                    label={{ value: 'Distance (mm) / Force (N)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      color: '#1f2937',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                      backdropFilter: 'blur(10px)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="force" 
                    stroke="#3b82f6" 
                    strokeWidth={2.5}
                    dot={false}
                    name="Force (N)"
                    activeDot={{ r: 5, fill: '#3b82f6' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="distance" 
                    stroke="#22c55e" 
                    strokeWidth={2.5}
                    dot={false}
                    name="Distance (mm)"
                    activeDot={{ r: 5, fill: '#22c55e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Right Panel - Configuration and Sensor Data */}
        <section className={`${isXlScreen ? 'w-[400px]' : 'w-full'} flex flex-col ${isXlScreen ? 'gap-6' : 'gap-4'} pb-20 xl:pb-0 min-h-0`}>
          {/* Active Configuration Parameters - Hidden on small & medium screens */}
          {isXlScreen && (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 p-4 shadow-xl shadow-gray-200/50 flex-shrink-0">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-gray-900">Active Configuration</h3>
                <p className="text-gray-600 text-xs">Current process parameters</p>
              </div>
              
              {selectedConfig ? (
                <div className="space-y-2.5">
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-3 rounded-xl border border-blue-200/50">
                    <p className="text-gray-600 text-xs mb-0.5">Configuration Name</p>
                    <p className="text-base font-bold text-blue-700">{selectedConfig.configName}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-3 rounded-xl border border-green-200/50">
                      <p className="text-gray-600 text-xs mb-0.5">Distance</p>
                      <p className="text-base font-bold text-green-700">{selectedConfig.distance} mm</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-3 rounded-xl border border-cyan-200/50">
                      <p className="text-gray-600 text-xs mb-0.5">Peak Force</p>
                      <p className="text-base font-bold text-blue-700">{selectedConfig.peakForce} N</p>
                    </div>
                    
                    <div className="col-span-2 bg-gradient-to-br from-orange-50 to-red-50 p-3 rounded-xl border border-orange-200/50">
                      <p className="text-gray-600 text-xs mb-0.5">Temperature</p>
                      <p className="text-base font-bold text-orange-700">{selectedConfig.temperature}°C</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-r-xl">
                  <p className="text-yellow-800 font-medium text-sm">⚠️ No configuration selected</p>
                  <p className="text-yellow-700 text-xs mt-1">Please load a configuration to proceed</p>
                </div>
              )}
            </div>
          )}

          {/* Real-time Sensor Data - Hidden on small & medium screens */}
          {isXlScreen && (
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 p-4 shadow-xl shadow-gray-200/50 flex-1 min-h-0">
              <div className="mb-3">
                <h3 className="text-lg font-bold text-gray-900">Real-time Sensors</h3>
                <p className="text-gray-600 text-xs">Live monitoring data</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200/50 p-3">
                  <div className="flex items-center space-x-2 mb-1.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-sm">
                      <Thermometer className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-gray-600 text-xs font-medium">Temperature</p>
                  </div>
                  <p className="text-xl font-bold text-orange-600">{sensorData.temperature}°C</p>
                </div>

                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-200/50 p-3">
                  <div className="flex items-center space-x-2 mb-1.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                      <Gauge className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-gray-600 text-xs font-medium">Force</p>
                  </div>
                  <p className="text-xl font-bold text-blue-600">{sensorData.force} N</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200/50 p-3">
                  <div className="flex items-center space-x-2 mb-1.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                      <Ruler className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-gray-600 text-xs font-medium">Distance</p>
                  </div>
                  <p className="text-xl font-bold text-green-600">{sensorData.distance} mm</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${
                        sensorData.status === 'RUNNING' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                        sensorData.status === 'PAUSED' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                        sensorData.status === 'HOMING' ? 'bg-gradient-to-br from-purple-500 to-indigo-500' :
                        sensorData.status === 'READY' ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : 
                        'bg-gradient-to-br from-gray-400 to-gray-500'
                      }`}>
                        <Activity className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-gray-600 text-xs font-medium">Status</p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      sensorData.status === 'RUNNING' ? 'bg-green-500 animate-pulse' :
                      sensorData.status === 'PAUSED' ? 'bg-yellow-500' :
                      sensorData.status === 'HOMING' ? 'bg-purple-500 animate-pulse' :
                      sensorData.status === 'READY' ? 'bg-blue-500' : 'bg-gray-400'
                    }`}></div>
                  </div>
                  <p className={`text-xl font-bold ${
                    sensorData.status === 'RUNNING' ? 'text-green-600' :
                    sensorData.status === 'PAUSED' ? 'text-yellow-600' :
                    sensorData.status === 'HOMING' ? 'text-purple-600' :
                    sensorData.status === 'READY' ? 'text-blue-600' : 'text-gray-600'
                  }`}>{sensorData.status}</p>
                </div>
              </div>
            </div>
          )}

          {/* Control Buttons - Now fixed at bottom on small & medium screens */}
          <div className={`${isXlScreen ? 'relative' : 'fixed bottom-0 left-0 right-0'} bg-white/95 xl:bg-white/70 
          backdrop-blur-xl rounded-t-2xl xl:rounded-2xl border-t xl:border border-gray-200/80 p-3 sm:p-4 shadow-2xl 
          xl:shadow-xl shadow-gray-200/50 z-20 flex-shrink-0`}>
            {isXlScreen && (
              <div className="mb-2">
                <h3 className="text-lg font-bold text-gray-900">Process Controls</h3>
                <p className="text-gray-600 text-xs">Manage process execution</p>
              </div>
            )}
            
            <div className="flex space-x-2 sm:space-x-3 justify-center max-w-2xl mx-auto">
              <button
                onClick={handleStart}
                disabled={shouldDisableButtons() || (isProcessRunning && !isPaused)}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-3 sm:py-3 
                  rounded-lg sm:rounded-xl font-bold transition-all transform hover:scale-[1.02] min-w-0 ${
                  shouldDisableButtons() || (isProcessRunning && !isPaused)
                    ? 'bg-gray-200 cursor-not-allowed text-gray-500 border border-gray-300'
                    : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-xl shadow-green-500/25 border border-green-400/30'
                }`}
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">{getStartButtonText()}</span>
              </button>
              
              <button
                onClick={handlePause}
                disabled={shouldDisableButtons() || !isProcessRunning || isPaused}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-3 rounded-lg sm:rounded-xl 
                  font-bold transition-all transform hover:scale-[1.02] min-w-0 ${
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
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-3 rounded-lg sm:rounded-xl 
                  font-bold transition-all transform hover:scale-[1.02] min-w-0 ${
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