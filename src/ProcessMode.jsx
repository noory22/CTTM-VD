import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Play, Pause, RotateCcw, Power, Camera, ArrowLeft, Usb, Info, X, Activity, Thermometer, Gauge, Ruler, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ProcessMode = () => {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [sensorData, setSensorData] = useState({
    temperature: '--',
    temperatureDisplay: '-- °C',
    force: '--',
    forceDisplay: '-- mN',
    force_mN: '--',
    force_mN_Display: '-- mN',
    distance: '--',
    distanceDisplay: '-- mm',
    status: 'READY'
  });
  const [readData, setReadData] = useState({
    temperature: '--',
    temperatureDisplay: '-- °C',
    force: '--',
    forceDisplay: '-- mN',
    force_mN: '--',
    force_mN_Display: '-- mN',
    distance: '--',
    distanceDisplay: '-- mm'
  });
  const [chartData, setChartData] = useState([]);
  const [reachedCurves, setReachedCurves] = useState({});
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
  const [isRetractionEnabled, setIsRetractionEnabled] = useState(false);
  const [isRetractionActive, setIsRetractionActive] = useState(false);
  const [isRetractionPaused, setIsRetractionPaused] = useState(false);
  const [isRetractionCompleted, setIsRetractionCompleted] = useState(false);

  // Temperature check state
  const [temperatureStatus, setTemperatureStatus] = useState({
    isHeatingRequired: false,
    isHeatingActive: false,
    showHeatingDialog: false,
    heaterButtonDisabled: false,
    targetTemperature: null,
    lastHeatingState: null
  });

  const [isLogging, setIsLogging] = useState(false);
  const lastLoggedDataRef = useRef({ time: null, distance: null, force: null });

  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  // NEW: COIL_LLS status state
  const [coilLLSStatus, setCoilLLSStatus] = useState(false);

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

  const isXlScreen = screenSize.width >= 1920;
  const isLgScreen = screenSize.width >= 1366 && screenSize.width < 1920;
  const isMdScreen = screenSize.width >= 1024 && screenSize.width < 1366;
  const isSmScreen = screenSize.width < 1024;
  
  //-------------------------------------------------------------------------//
  // NEW: COIL_LLS Monitoring - Continuously monitor COIL_LLS status
  //-------------------------------------------------------------------------//
  useEffect(() => {
    console.log("🔍 Setting up COIL_LLS monitoring for Process Mode...");
    
    // Event listener for real-time COIL_LLS updates from main process
    const handleLLSStatusChange = (event) => {
      // The event data comes as string 'true' or 'false' from main.js
      const isLLSTrue = event.detail === 'true' || event.detail === true;
      
      console.log(`🔄 Process Mode - COIL_LLS Event Received: ${isLLSTrue ? 'TRUE' : 'FALSE'}`);
      
      // Update COIL_LLS status state
      setCoilLLSStatus(isLLSTrue);
      
      // If COIL_LLS becomes TRUE, update sensor status to READY (if not in other states)
      if (isLLSTrue && sensorData.status === 'HOMING') {
        console.log("✅ Homing complete - changing status to READY");
        setSensorData(prev => ({ ...prev, status: 'READY' }));
        setIsHoming(false);
      }
      
      // If COIL_LLS becomes FALSE, motor has moved away from home position
      if (!isLLSTrue) {
        console.log("🔄 Motor moved away from home - COIL_LLS is FALSE");
      }
    };

    // Setup event listener for COIL_LLS changes
    window.addEventListener('lls-status-change', handleLLSStatusChange);
    
    console.log("✅ Process Mode COIL_LLS monitoring setup complete");

    // Cleanup
    return () => {
      console.log("🧹 Cleaning up Process Mode COIL_LLS monitoring");
      window.removeEventListener('lls-status-change', handleLLSStatusChange);
    };
  }, [sensorData.status]);
  
  // Also check COIL_LLS in PLC data when reading sensor data
  // useEffect(() => {
  //   let intervalId;
    
  //   const pollSensorData = () => {
  //     window.api.readData()
  //       .then(data => {
  //         if (data && data.success) {
  //           setReadData({
  //             temperature: data.temperature || '--',
  //             temperatureDisplay: data.temperatureDisplay || '-- °C',
  //             force: data.force_mN || '--',
  //             forceDisplay: data.forceDisplay || '-- mN',
  //             force_mN: data.force_mN || '--',
  //             force_mN_Display: data.forceDisplay || '-- mN',
  //             distance: data.distance || '--',
  //             distanceDisplay: data.distanceDisplay || '-- mm'
  //           });
            
  //           setSensorData(prev => ({
  //             ...prev,
  //             temperature: data.temperatureDisplay || '--',
  //             force: data.forceDisplay || '--',
  //             distance: data.distanceDisplay || '--'
  //           }));

  //           // NEW: Update COIL_LLS status from PLC data if available
  //           if (data.coilLLS !== undefined) {
  //             const newCoilLLSStatus = Boolean(data.coilLLS);
  //             setCoilLLSStatus(newCoilLLSStatus);
              
  //             // If COIL_LLS becomes TRUE and we were homing, update status
  //             if (newCoilLLSStatus && sensorData.status === 'HOMING') {
  //               console.log("✅ Homing complete (from PLC data) - changing status to READY");
  //               setSensorData(prev => ({ ...prev, status: 'READY' }));
  //               setIsHoming(false);
  //             }
  //           }

  //           // Handle curve and distance logic
  //           if (selectedConfig && data.distance !== '--' && data.distance !== undefined && 
  //               !isRetractionEnabled && isProcessRunning && !isPaused) {
              
  //             const currentDistance = parseFloat(data.distance);
  //             const targetDistance = parseFloat(selectedConfig.pathlength);

  //             const curves = selectedConfig?.curveDistances || {};
  //             Object.entries(curves).forEach(([curveLabel, curveVal]) => {
  //               const threshold = Number(curveVal);

  //               if (!reachedCurves[curveLabel] && currentDistance >= threshold) {
  //                 console.log(`🔥 Curve ${curveLabel} reached at ${threshold} mm`);
  //                 setReachedCurves(prev => ({
  //                   ...prev,
  //                   [curveLabel]: true
  //                 }));
  //               }
  //             });
              
  //             console.log(`🔍 Distance Check: Current=${currentDistance}mm, Target=${targetDistance}mm, isValid=${!isNaN(currentDistance) && !isNaN(targetDistance)}`);
              
  //             if (!isNaN(currentDistance) && !isNaN(targetDistance)) {
  //               if (Math.round(currentDistance) === Math.round(targetDistance)) {
  //                 console.log(`✅✅✅ Target distance reached exactly! ${currentDistance}mm = ${targetDistance}mm (rounded)`);
  //                 setIsRetractionEnabled(true);
  //                 setSensorData(prev => ({ ...prev, status: 'INSERTION COMPLETED' }));
  //               } else {
  //                 console.log(`📏 Not yet reached: ${currentDistance}mm vs ${targetDistance}mm (rounded: ${Math.round(currentDistance)} vs ${Math.round(targetDistance)})`);
  //               }
  //             }
  //           }

  //           // Check retraction completion
  //           if (isRetractionActive && !isRetractionPaused && data.distance !== '--' && data.distance !== undefined) {
  //             const currentDistance = parseFloat(data.distance);
  //             console.log(`🔍 Retraction Check: Current distance=${currentDistance}mm, isRetractionActive=${isRetractionActive}, isRetractionPaused=${isRetractionPaused}`);
              
  //             if (!isNaN(currentDistance) && Math.round(currentDistance) === 0) {
  //               console.log('✅✅✅ RETRACTION COMPLETED! Distance = 0mm');
  //               setIsRetractionCompleted(true);
  //               setIsRetractionActive(false);
  //               setIsRetractionEnabled(false);
  //               setIsProcessRunning(false);
  //               setSensorData(prev => ({ ...prev, status: 'READY' }));

  //               // Clear chart data
  //               setChartData([]);
                
  //               // Clear reached curves
  //               setReachedCurves({});
      
  //               // Stop CSV logging
  //               stopCsvLogging();
                
  //               console.log('🔄 System reset to READY state after retraction completion');
  //             }
  //           }

  //           // Update chart data and logging
  //           if (isProcessRunning || sensorData.status === 'PAUSED' || sensorData.status === 'RETRACTION PAUSED') {
  //             const currentTime = (Date.now() - startTimeRef.current) / 1000;
  //             const timeFormatted = parseFloat(currentTime.toFixed(1));
              
  //             setChartData(prev => {
  //               const newDataPoint = {
  //                 time: timeFormatted,
  //                 distance: parseFloat(data.distance) || 0,
  //                 force: parseFloat(data.force_mN) || 0
  //               };
                
  //               const newData = [...prev, newDataPoint];
  //               return newData;
  //             });
  //           }
            
  //           if (isProcessRunning && !isPaused && data.distance !== '--' && data.force_mN !== '--') {
  //             const currentTime = (Date.now() - startTimeRef.current) / 1000;
  //             logSensorData(currentTime.toFixed(1), data.distance, data.force_mN);
  //           }
  //         } else if (data && !data.success) {
  //           setReadData(prev => ({
  //             ...prev,
  //             temperatureDisplay: '-- °C',
  //             forceDisplay: '-- mN',
  //             distanceDisplay: '-- mm'
  //           }));
  //         }
  //       })
  //       .catch(error => {
  //         console.error('Error polling sensor data:', error);
  //       });
  //   };

  //   if (isConnected) {
  //     intervalId = setInterval(pollSensorData, 1500);
  //     pollSensorData(); // Initial call
  //   }

  //   return () => {
  //     if (intervalId) {
  //       clearInterval(intervalId);
  //     }
  //   };
  // }, [isConnected, isProcessRunning, isPaused, sensorData.status, selectedConfig, isRetractionEnabled, isRetractionActive, isRetractionPaused]);


  useEffect(() => {
    let intervalId;
    
    const pollSensorData = async () => {
      try {
        const data = await window.api.readData();
        
        if (data && data.success) {
          setReadData({
            temperature: data.temperature || '--',
            temperatureDisplay: data.temperatureDisplay || '-- °C',
            force: data.force_mN || '--',
            forceDisplay: data.forceDisplay || '-- mN',
            force_mN: data.force_mN || '--',
            force_mN_Display: data.forceDisplay || '-- mN',
            distance: data.distance || '--',
            distanceDisplay: data.distanceDisplay || '-- mm'
          });
          
          setSensorData(prev => ({
            ...prev,
            temperature: data.temperatureDisplay || '--',
            force: data.forceDisplay || '--',
            distance: data.distanceDisplay || '--'
          }));

          if (selectedConfig && data.distance !== '--' && data.distance !== undefined && 
              !isRetractionEnabled && isProcessRunning && !isPaused) {
            
            const currentDistance = parseFloat(data.distance);
            const targetDistance = parseFloat(selectedConfig.pathlength);

            const curves = selectedConfig?.curveDistances || {};
            Object.entries(curves).forEach(([curveLabel, curveVal]) => {
              const threshold = Number(curveVal);

              if (!reachedCurves[curveLabel] && currentDistance >= threshold) {
                console.log(`🔥 Curve ${curveLabel} reached at ${threshold} mm`);
                setReachedCurves(prev => ({
                  ...prev,
                  [curveLabel]: true
                }));
              }
            });
            
            console.log(`🔍 Distance Check: Current=${currentDistance}mm, Target=${targetDistance}mm, isValid=${!isNaN(currentDistance) && !isNaN(targetDistance)}`);
            
            if (!isNaN(currentDistance) && !isNaN(targetDistance)) {
              if (Math.round(currentDistance) === Math.round(targetDistance)) {
                console.log(`✅✅✅ Target distance reached exactly! ${currentDistance}mm = ${targetDistance}mm (rounded)`);
                setIsRetractionEnabled(true);
                setSensorData(prev => ({ ...prev, status: 'INSERTION COMPLETED' }));
              } else {
                console.log(`📏 Not yet reached: ${currentDistance}mm vs ${targetDistance}mm (rounded: ${Math.round(currentDistance)} vs ${Math.round(targetDistance)})`);
              }
            }
          }

          // Check if retraction is completed (distance = 0)
          if (isRetractionActive && !isRetractionPaused && data.distance !== '--' && data.distance !== undefined) {
            const currentDistance = parseFloat(data.distance);
            console.log(`🔍 Retraction Check: Current distance=${currentDistance}mm, isRetractionActive=${isRetractionActive}, isRetractionPaused=${isRetractionPaused}`);
            
            if (!isNaN(currentDistance) && Math.round(currentDistance) === 0) {
              console.log('✅✅✅ RETRACTION COMPLETED! Distance = 0mm');
              setIsRetractionCompleted(true);
              setIsRetractionActive(false);
              setIsRetractionEnabled(false);
              setIsProcessRunning(false);
              setSensorData(prev => ({ ...prev, status: 'READY' }));

              // Clear chart data
              setChartData([]);
              
              // Clear reached curves
              setReachedCurves({});
    
              // Stop CSV logging
              stopCsvLogging();
              
              console.log('🔄 System reset to READY state after retraction completion');
            }
          }

          if (isProcessRunning || sensorData.status === 'PAUSED' || sensorData.status === 'RETRACTION PAUSED') {
            const currentTime = (Date.now() - startTimeRef.current) / 1000;
            const timeFormatted = parseFloat(currentTime.toFixed(1));
            
            setChartData(prev => {
              const newDataPoint = {
                time: timeFormatted,
                distance: parseFloat(data.distance) || 0,
                force: parseFloat(data.force_mN) || 0
              };
              
              const newData = [...prev, newDataPoint];
              return newData;
            });
          }
          
          if (isProcessRunning && !isPaused && data.distance !== '--' && data.force_mN !== '--') {
            const currentTime = (Date.now() - startTimeRef.current) / 1000;
            logSensorData(currentTime.toFixed(1), data.distance, data.force_mN);
          }
        } else if (data && !data.success) {
          setReadData(prev => ({
            ...prev,
            temperatureDisplay: '-- °C',
            forceDisplay: '-- mN',
            distanceDisplay: '-- mm'
          }));
        }
      } catch (error) {
        console.error('Error polling sensor data:', error);
      }
    };

    if (isConnected) {
      intervalId = setInterval(pollSensorData, 1500);
      pollSensorData();
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isConnected, isProcessRunning, isPaused, sensorData.status, selectedConfig, isRetractionEnabled, isRetractionActive, isRetractionPaused]);


  // Check temperature when component mounts or config changes
  useEffect(() => {
    if (selectedConfig && readData.temperature !== '--') {
      const realTimeTemp = parseFloat(readData.temperature);
      const targetTemp = parseFloat(selectedConfig.temperature);
      
      if (!isNaN(realTimeTemp) && !isNaN(targetTemp)) {
        // Check if real-time temperature is LESS THAN user-defined temperature
        const isTempBelowTarget = realTimeTemp < (targetTemp - 0.5); // 0.5°C tolerance
        
        console.log(`🌡️ Temperature Check: Real=${realTimeTemp}°C, Target=${targetTemp}°C, isBelowTarget=${isTempBelowTarget}`);
        
        if (isTempBelowTarget && !temperatureStatus.isHeatingActive) {
          // Show heating dialog if temperature is below target
          setTemperatureStatus(prev => ({
            ...prev,
            isHeatingRequired: true,
            showHeatingDialog: true,
            targetTemperature: targetTemp,
            heaterButtonDisabled: false
          }));
        } else if (!isTempBelowTarget) {
          // If temperature is equal to or greater than target, close dialog and disable heating
          if (temperatureStatus.isHeatingActive) {
            // Turn off heater if it's active
            turnOffHeater();
          }
          
          // Close dialog and reset state
          setTemperatureStatus(prev => ({
            ...prev,
            isHeatingRequired: false,
            showHeatingDialog: false,
            isHeatingActive: false,
            heaterButtonDisabled: false
          }));
          
          console.log('✅ Temperature requirement satisfied - dialog closed');
        }
      }
    }
  }, [readData.temperature, selectedConfig]);

  // Monitor temperature to auto-close dialog when target is reached or exceeded
  useEffect(() => {
    if (temperatureStatus.isHeatingActive && selectedConfig && readData.temperature !== '--') {
      const realTimeTemp = parseFloat(readData.temperature);
      const targetTemp = temperatureStatus.targetTemperature || parseFloat(selectedConfig.temperature);
      
      if (!isNaN(realTimeTemp) && !isNaN(targetTemp)) {
        // Check if temperature is equal to or greater than target
        const isTempReached = realTimeTemp >= (targetTemp - 0.5); // 0.5°C tolerance
        
        if (isTempReached) {
          console.log(`✅ Target temperature reached or exceeded! Real=${realTimeTemp}°C, Target=${targetTemp}°C`);
          
          // Turn off heater
          turnOffHeater();
          
          // Close dialog and reset state
          setTemperatureStatus(prev => ({
            ...prev,
            isHeatingRequired: false,
            showHeatingDialog: false,
            isHeatingActive: false,
            heaterButtonDisabled: false
          }));
        }
      }
    }
  }, [readData.temperature, temperatureStatus.isHeatingActive, selectedConfig]);

  // Check temperature when component mounts
  useEffect(() => {
    if (selectedConfig) {
      // Small delay to ensure data is loaded
      setTimeout(() => {
        if (readData.temperature !== '--') {
          const realTimeTemp = parseFloat(readData.temperature);
          const targetTemp = parseFloat(selectedConfig.temperature);
          
          if (!isNaN(realTimeTemp) && !isNaN(targetTemp)) {
            const isTempBelowTarget = realTimeTemp < (targetTemp - 0.5);
            
            if (isTempBelowTarget) {
              console.log('🔥 Temperature check on entry: Heating required');
              setTemperatureStatus(prev => ({
                ...prev,
                isHeatingRequired: true,
                showHeatingDialog: true,
                targetTemperature: targetTemp,
                heaterButtonDisabled: false
              }));
            }
          }
        }
      }, 1000);
    }
  }, [selectedConfig]);

  const turnOnHeater = async () => {
    try {
      console.log('🔥 Turning heater ON...');
      setTemperatureStatus(prev => ({
        ...prev,
        heaterButtonDisabled: true
      }));
      
      const result = await window.api.heating();
      
      if (result && result.success) {
        console.log('✅ Heater turned ON successfully');
        setTemperatureStatus(prev => ({
          ...prev,
          isHeatingActive: true
        }));
      } else {
        console.error('❌ Failed to turn heater ON');
        setTemperatureStatus(prev => ({
          ...prev,
          heaterButtonDisabled: false
        }));
      }
    } catch (error) {
      console.error('❌ Error turning heater ON:', error);
      setTemperatureStatus(prev => ({
        ...prev,
        heaterButtonDisabled: false
      }));
    }
  };

  const turnOffHeater = async () => {
    try {
      console.log('🔥 Turning heater OFF...');
      
      const result = await window.api.heating();
      
      if (result && result.success) {
        console.log('✅ Heater turned OFF successfully');
        // Don't reset state here - let the temperature check handle it
      }
    } catch (error) {
      console.error('❌ Error turning heater OFF:', error);
    }
  };

  const closeHeatingDialog = () => {
    // Allow closing dialog
    setTemperatureStatus(prev => ({
      ...prev,
      showHeatingDialog: false
    }));
  };

  //-------------------------------------------------------------------------//

  useEffect(() => {
    const config = localStorage.getItem('selectedConfig');
    if (config) {
      setSelectedConfig(JSON.parse(config));
    }
  }, []);

  // UPDATED: LLS Status Change Handler - This should handle events from main.js
  useEffect(() => {
    const handleLLSStatusChange = (event) => {
      if (event.detail === 'true') {
        console.log("🔄 COIL_LLS detected TRUE");
        
        // Update COIL_LLS status
        setCoilLLSStatus(true);
        
        // Only update status to READY if we're coming from HOMING state
        setSensorData(prev => {
          console.log(`📊 Previous status: ${prev.status}, isHoming: ${isHoming}`);
          
          // If previous status was HOMING, change to READY
          if (prev.status === 'HOMING') {
            console.log("✅ Homing complete, changing status to READY");
            setIsHoming(false);
            return { ...prev, status: 'READY' };
          }
          
          // If previous status was INSERTION, RETRACTION, or their paused states,
          // don't change the status
          console.log(`⚠️ COIL_LLS triggered but status remains: ${prev.status} (not from HOMING)`);
          return prev; // Keep the same status
        });
      } else if (event.detail === 'false') {
        console.log("🔄 COIL_LLS detected FALSE");
        setCoilLLSStatus(false);
      }
    };

    window.addEventListener('lls-status-change', handleLLSStatusChange);
    
    return () => {
      window.removeEventListener('lls-status-change', handleLLSStatusChange);
    };
  }, []);

  const startCsvLogging = async () => {
    if (!selectedConfig) {
      console.error('No configuration selected for logging');
      return;
    }
    
    try {
      console.log('🟡 Starting CSV logging with config:', selectedConfig);
      const result = await window.api.startCSV(selectedConfig);
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
        const result = await window.api.stopCSV();
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
    
    if (lastLoggedDataRef.current.time === timeNum && 
        lastLoggedDataRef.current.distance === distNum && 
        lastLoggedDataRef.current.force === forceNum) {
      return;
    }
    
    try {
      console.log(`📊 ATTEMPTING LOG: Time=${timeNum}s, Distance=${distNum}mm, Force=${forceNum}mN, isLogging=${isLogging}`);
      
      // Send data with config included
      await window.api.appendCSV({
        data: {
          distance: distNum,
          force_mN: forceNum,
          temperature: parseFloat(readData.temperature) || 0
        },
        config: selectedConfig // Make sure config is included
      });
      
      lastLoggedDataRef.current = { time: timeNum, distance: distNum, force: forceNum };
      console.log(`✅ SUCCESSFULLY LOGGED: Time=${timeNum}s, Distance=${distNum}mm, Force=${forceNum}mN`);
    } catch (error) {
      console.error('❌ Error logging sensor data:', error);
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const connection = await window.api.checkConnection();
        setIsConnected(connection.connected);
        
        if (!connection.connected) {
          setReadData(prev => ({
            ...prev,
            temperatureDisplay: '-- °C',
            forceDisplay: '-- mN',
            distanceDisplay: '-- mm'
          }));
        }
      } catch (error) {
        console.error('Error checking connection:', error);
        setIsConnected(false);
      }
    };

    checkConnection();
    
    const handleModbusStatusChange = (event) => {
      setIsConnected(event.detail === 'connected');
    };

    window.addEventListener('modbus-status-change', handleModbusStatusChange);
    
    return () => {
      window.removeEventListener('modbus-status-change', handleModbusStatusChange);
    };
  }, []);

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
  

  const handleStart = async () => {
    if (!selectedConfig) {
      console.error('No configuration selected');
      return;
    }
    
    // Prevent start if heating is required
    if (temperatureStatus.isHeatingRequired) {
      console.log('❌ Cannot start process - heating required');
      return;
    }

    try {
      console.log('🚀 Starting process...');
      let result;
      
      if (isPaused || isRetractionPaused) {
        console.log('⏯️ Resuming process from pause...');
        result = await window.api.start();
        
        if (result && result.success) {
          setIsProcessRunning(true);
          setIsPaused(false);
          setIsRetractionPaused(false);
          
          if (isRetractionEnabled && isRetractionActive) {
            setSensorData(prev => ({ ...prev, status: 'RETRACTION' }));
          } else {
            setSensorData(prev => ({ ...prev, status: 'INSERTION' }));
          }
        }
      } else {
        result = await window.api.start();
        result = await window.api.heating();
        
        if (result && result.success) {
          setIsProcessRunning(true);
          setIsPaused(false);
          setIsRetractionCompleted(false);
          setIsHoming(false);
          setSensorData(prev => ({ ...prev, status: 'INSERTION' }));
          startTimeRef.current = Date.now();
        }
      }
      
      if (result && result.success) {
        console.log('🟡 Process started/resumed, starting CSV logging...');
        if (selectedConfig) {
          startCsvLogging();
        } else { 
          console.error('❌ Cannot start logging: missing config');
        }
      } else {
        console.error('Failed to start process:', result?.message);
      }
    } catch (error) {
      console.error('Failed to start process:', error);
    }
  };

  const handlePause = async () => {
    try {
      console.log('⏸️ Pausing process...');
      const result = await window.api.stop(); // Using stop API for pause
      
      if (result && result.success) {
        setIsProcessRunning(false);
        setIsPaused(true);
        
        // Update status based on current state
        if (sensorData.status === 'INSERTION' || sensorData.status === 'INSERTION COMPLETED') {
          setSensorData(prev => ({ ...prev, status: 'PAUSED' }));
        } else if (sensorData.status === 'RETRACTION') {
          setIsRetractionPaused(true);
          setSensorData(prev => ({ ...prev, status: 'RETRACTION PAUSED' }));
        }
        
        console.log('Process paused');
      } else {
        console.error('Failed to pause process:', result?.message);
      }
    } catch (error) {
      console.error('Failed to pause process:', error);
    }
  };

  const handleRetraction = async () => {
    try {
      console.log('🔄 Starting retraction...');
      const result = await window.api.retraction();
      
      if (result && result.success) {
        setIsRetractionActive(true);
        setIsRetractionPaused(false);
        setIsRetractionCompleted(false);
        setIsProcessRunning(true);
        setSensorData(prev => ({ ...prev, status: 'RETRACTION' }));
        console.log('✅ Retraction started');
      } else {
        console.error('Failed to start retraction:', result?.message);
      }
    } catch (error) {
      console.error('Failed to start retraction:', error);
    }
  };

  const handleReset = async () => {
    try {
      console.log('🔄 Resetting process...');
      const result = await window.api.reset();
      
      if (result && result.success) {
        setIsProcessRunning(false);
        setIsPaused(false);
        setIsHoming(true);
        setIsRetractionEnabled(false);
        setIsRetractionActive(false);
        setIsRetractionPaused(false);
        setIsRetractionCompleted(false);
        setChartData([]);
        setReachedCurves({});
        setSensorData(prev => ({
          ...prev,
          force: '--',
          distance: '--',
          status: 'HOMING'
        }));

        // Reset temperature status
        setTemperatureStatus({
          isHeatingRequired: false,
          isHeatingActive: false,
          showHeatingDialog: false,
          heaterButtonDisabled: false,
          targetTemperature: null,
          lastHeatingState: null
        });
        
        stopCsvLogging();
        console.log('Process reset');
      } else {
        console.error('Failed to reset process:', result?.message);
      }
    } catch (error) {
      console.error('Failed to reset process:', error);
    }
  };

  const shouldDisableButtons = () => {
    return isHoming || !selectedConfig;
  };
  
  // Add this to prevent process start when heating is required
  const shouldDisableStartButton = () => {
    if (shouldDisableButtons()) return true;
    if (temperatureStatus.isHeatingRequired) return true; // Disable if heating is required
    if (isRetractionEnabled && !isRetractionPaused) return true;
    if (isRetractionPaused) return true;
    if (isRetractionCompleted) return false;
    if (isProcessRunning && !isPaused && !isRetractionPaused) return true;
    return false;
  };

  const shouldDisablePauseButton = () => {
    if (shouldDisableButtons()) return true;
    if (isRetractionCompleted) return true; // Disable when retraction is completed
    if (!isProcessRunning && !isPaused && !isRetractionPaused) return true;
    if (sensorData.status === 'INSERTION COMPLETED' && !isRetractionActive) return true;
    return false;
  };

  const shouldDisableRetractionButton = () => {
    if (shouldDisableButtons()) return true;
    if (isRetractionCompleted) return true; // Disable when retraction is completed
    if (!isRetractionEnabled) return true;
    if (isRetractionActive && !isRetractionPaused) return true;
    return false;
  };

  // UPDATED: Reset button logic based on COIL_LLS status
  const shouldDisableResetButton = () => {
    // If COIL_LLS is TRUE, disable reset button
    if (coilLLSStatus) {
      console.log('🔄 Reset button disabled because COIL_LLS is TRUE');
      return true;
    }
    
    // Other conditions from original logic
    if (!selectedConfig || isHoming) return true;
    if (isRetractionCompleted) return true; // Disable when retraction is completed
    
    return false;
  };

  const handleBack = () => {
    navigate('/handle-config/load');
  };

  const getStartButtonText = () => {
    if (isPaused && sensorData.status === 'PAUSED') return 'RESUME';
    if (isRetractionCompleted) return 'START'; // Show START when retraction is completed
    return 'START';
  };

  const getRetractionButtonText = () => {
    if (isRetractionPaused) return 'RESUME RETRACTION';
    return 'RETRACTION';
  };

  const shouldDisableBackButton = () => {
    if (isRetractionCompleted) return false; // Enable back button when retraction is completed
    return sensorData.status !== 'READY';
  };

  const shouldDisablePowerButton = () => {
    if (isRetractionCompleted) return false; // Enable power button when retraction is completed
    return sensorData.status !== 'READY';
  };

  // NEW: Helper function to get COIL_LLS status display
  const getCoilLLSDisplay = () => {
    return coilLLSStatus ? 'TRUE' : 'FALSE';
  };

  // NEW: Helper function to get COIL_LLS color
  const getCoilLLSColor = () => {
    return coilLLSStatus ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="min-h-screen h-screen bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900 overflow-hidden flex flex-col">
      {/* Heating Dialog */}
      {temperatureStatus.showHeatingDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-200/80">
            <div className="p-6 rounded-t-2xl bg-gradient-to-r from-orange-500 to-red-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Flame className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">
                    {temperatureStatus.isHeatingActive ? 'Heating In Progress' : 'Heating Required'}
                  </h2>
                </div>
                {!temperatureStatus.isHeatingRequired && (
                  <button
                    onClick={closeHeatingDialog}
                    className="p-2 hover:bg-white/20 rounded-lg transition-all"
                  >
                    <X className="w-6 h-6 text-white" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Real-time Temperature</p>
                    <div className="flex items-center justify-center space-x-2">
                      <Thermometer className="w-5 h-5 text-blue-600" />
                      <p className="text-2xl font-bold text-blue-700">{readData.temperatureDisplay}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Target Temperature</p>
                    <div className="flex items-center justify-center space-x-2">
                      <Flame className="w-5 h-5 text-orange-600" />
                      <p className="text-2xl font-bold text-orange-700">
                        {temperatureStatus.targetTemperature || selectedConfig?.temperature}°C
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>0°C</span>
                    <span>Progress</span>
                    <span>{temperatureStatus.targetTemperature || selectedConfig?.temperature}°C</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-1000 bg-orange-500"
                      style={{ 
                        width: `${Math.min(100, (parseFloat(readData.temperature) / (temperatureStatus.targetTemperature || 1)) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg mb-4">
                <p className="font-medium text-orange-800 text-center">
                  {temperatureStatus.isHeatingActive 
                    ? `Heating in progress. Waiting for temperature to reach ${temperatureStatus.targetTemperature || selectedConfig?.temperature}°C`
                    : `Real-time temperature (${readData.temperatureDisplay}) is below target (${temperatureStatus.targetTemperature || selectedConfig?.temperature}°C). Please turn on heating.`
                  }
                </p>
                {temperatureStatus.isHeatingActive && (
                  <p className="text-orange-700 text-sm mt-2 text-center">
                    Current: {readData.temperatureDisplay} / Target: {temperatureStatus.targetTemperature || selectedConfig?.temperature}°C
                  </p>
                )}
              </div>

              <div className="flex space-x-3">
                {!temperatureStatus.isHeatingActive ? (
                  <button
                    onClick={turnOnHeater}
                    disabled={temperatureStatus.heaterButtonDisabled}
                    className={`flex-1 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center space-x-2 ${
                      temperatureStatus.heaterButtonDisabled
                        ? 'bg-gray-400 cursor-not-allowed text-gray-200'
                        : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg'
                    }`}
                  >
                    <Flame className="w-5 h-5" />
                    <span>
                      {temperatureStatus.heaterButtonDisabled ? 'Turning ON...' : 'Turn ON Heater'}
                    </span>
                  </button>
                ) : (
                  <div className="w-full bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                        <Flame className="w-3 h-3 text-white" />
                      </div>
                      <p className="text-green-700 font-bold">Heater is ON</p>
                    </div>
                    <p className="text-green-600 text-center text-sm mt-1">
                      Waiting for temperature to reach target...
                    </p>
                  </div>
                )}
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-gray-500 text-sm">
                  {temperatureStatus.isHeatingActive 
                    ? 'Dialog will close automatically when temperature reaches target'
                    : 'Process start will be enabled when temperature reaches target'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
                    <span><strong>Force Sensor:</strong> Verify force reading is at baseline (near 0 mN)</span>
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
                    <span><strong>Peak Force:</strong> Confirm safety threshold is set correctly (in mN)</span>
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
                    <span><strong>STOP Function:</strong> Use STOP button if any issues are observed</span>
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

      <div className={`${isXlScreen ? 'hidden' : 'fixed'} top-0 left-0 h-auto w-[90vw] max-w-sm bg-white/95 backdrop-blur-xl shadow-2xl z-40 transform transition-transform duration-300 ${
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

      <div className={`${isXlScreen ? 'hidden' : 'fixed'} top-0 right-0 h-auto w-[90vw] max-w-sm bg-white/95 backdrop-blur-xl shadow-2xl z-40 transform transition-transform duration-300 ${
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
                  <p className="text-sm font-bold text-green-700">{selectedConfig.pathlength} mm</p>
                </div>
                
                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-3 rounded-xl border border-cyan-200/50">
                  <p className="text-gray-600 text-xs mb-1">Threshold Force</p>
                  <p className="text-sm font-bold text-blue-700">{selectedConfig.thresholdForce} mN</p>
                </div>
                
                <div className="col-span-2 bg-gradient-to-br from-orange-50 to-red-50 p-3 rounded-xl border border-orange-200/50">
                  <p className="text-gray-600 text-xs mb-1">Temperature</p>
                  <p className="text-sm font-bold text-orange-700">{selectedConfig.temperature}°C</p>
                </div>
                <div className="col-span-2 bg-gradient-to-br from-orange-50 to-red-50 p-3 rounded-xl border border-orange-200/50">
                  <p className="text-gray-600 text-xs mb-1">Retraction Stroke Length</p>
                  <p className="text-sm font-bold text-orange-700">{selectedConfig.retractionLength} mm</p>
                </div>
              </div>
              
              {/* NEW: COIL_LLS Status Display */}
              <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-3 rounded-xl border border-gray-200/50">
                <div className="flex items-center justify-between">
                  <p className="text-gray-600 text-xs mb-1">COIL_LLS Status</p>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${coilLLSStatus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {getCoilLLSDisplay()}
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {coilLLSStatus 
                    ? '✅ Machine is at home position. Reset disabled.' 
                    : '🔄 Machine is away from home. Reset enabled.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded-r-xl">
              <p className="text-yellow-800 text-sm font-medium">⚠️ No configuration selected</p>
            </div>
          )}
        </div>
      </div>

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
                  <h1 className={`${isXlScreen ? 'text-2xl' : isLgScreen ? 'text-xl' : 'text-lg'} font-bold bg-gradient-to-r from-gray-900 to-blue-700 bg-clip-text text-transparent truncate`}>
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
                className="group bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-2xl border border-blue-400/30"
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
                className={`group rounded-xl lg:rounded-2xl w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 shadow-lg border ${
                  shouldDisablePowerButton() 
                    ? 'bg-gray-200 cursor-not-allowed text-gray-400 border-gray-300' 
                    : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white hover:-translate-y-1 hover:shadow-xl border-red-400/30'
                }`}
              >
                <Power className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 transition-transform duration-300 ${
                  shouldDisablePowerButton() ? '' : 'group-hover:scale-110'
                }`} />
              </button>
            </div>
          </div>
        </div>
      </header>

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

      <main className={`relative flex ${isXlScreen ? 'flex-row' : 'flex-col'} flex-1 ${isXlScreen ? 'gap-6 p-6' : isLgScreen ? 'gap-4 p-4' : 'gap-3 p-3'} min-h-0 overflow-hidden`}>
        <section className={`flex-1 flex flex-col ${isXlScreen ? 'gap-6' : 'gap-4'} min-w-0 min-h-0`}>
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

          <div className="flex-1 bg-white/70 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-gray-200/80 p-3 sm:p-4 shadow-xl shadow-gray-200/50 min-h-0 flex flex-col">
            <div className="mb-2 sm:mb-3 flex-shrink-0">
              <h3 className={`${isXlScreen ? 'text-lg' : 'text-base'} font-bold text-gray-900`}>Real-time Analytics</h3>
              <p className="text-gray-600 text-xs hidden sm:block">Force & Distance vs Time</p>
            </div>
            
            {!isXlScreen && (
              <div className="mb-3 grid grid-cols-2 gap-2 flex-shrink-0">
                <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg border border-orange-200/50 p-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-500 rounded-md flex items-center justify-center">
                      <Thermometer className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-gray-600 text-xs font-medium">Temperature</p>
                  </div>
                  <p className="text-sm font-bold text-orange-600">{readData.temperatureDisplay}</p>
                </div>

                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border border-cyan-200/50 p-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-md flex items-center justify-center">
                      <Gauge className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-gray-600 text-xs font-medium">Force</p>
                  </div>
                  <p className="text-sm font-bold text-blue-600">{readData.forceDisplay}</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200/50 p-2">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-md flex items-center justify-center">
                      <Ruler className="w-3 h-3 text-white" />
                    </div>
                    <p className="text-gray-600 text-xs font-medium">Distance</p>
                  </div>
                  <p className="text-sm font-bold text-green-600">{readData.distanceDisplay}</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200/50 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                        sensorData.status === 'INSERTION' || sensorData.status === 'RETRACTION' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                        sensorData.status === 'PAUSED' || sensorData.status === 'RETRACTION PAUSED' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                        sensorData.status === 'HOMING' ? 'bg-gradient-to-br from-purple-500 to-indigo-500' :
                        sensorData.status === 'READY' || sensorData.status === 'INSERTION COMPLETED' ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : 
                        'bg-gradient-to-br from-gray-400 to-gray-500'
                      }`}>
                        <Activity className="w-3 h-3 text-white" />
                      </div>
                      <p className="text-gray-600 text-xs font-medium">Status</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      sensorData.status === 'INSERTION' || sensorData.status === 'RETRACTION' ? 'bg-green-500 animate-pulse' :
                      sensorData.status === 'PAUSED' || sensorData.status === 'RETRACTION PAUSED' ? 'bg-yellow-500' :
                      sensorData.status === 'HOMING' ? 'bg-purple-500 animate-pulse' :
                      sensorData.status === 'READY' || sensorData.status === 'INSERTION COMPLETED' ? 'bg-blue-500' : 'bg-gray-400'
                    }`}></div>
                  </div>
                  <p className={`text-sm font-bold ${
                    sensorData.status === 'INSERTION' || sensorData.status === 'RETRACTION' ? 'text-green-600' :
                    sensorData.status === 'PAUSED' || sensorData.status === 'RETRACTION PAUSED' ? 'text-yellow-600' :
                    sensorData.status === 'HOMING' ? 'text-purple-600' :
                    sensorData.status === 'READY' || sensorData.status === 'INSERTION COMPLETED' ? 'text-blue-600' : 'text-gray-600'
                  }`}>{sensorData.status}</p>
                </div>
                
                {/* NEW: COIL_LLS Status Display for small screens */}
                <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border border-gray-200/50 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center ${coilLLSStatus ? 'bg-green-500' : 'bg-red-500'}`}>
                        <Activity className="w-3 h-3 text-white" />
                      </div>
                      <p className="text-gray-600 text-xs font-medium">COIL_LLS</p>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${coilLLSStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  </div>
                  <p className={`text-sm font-bold ${getCoilLLSColor()}`}>{getCoilLLSDisplay()}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {coilLLSStatus ? 'At home' : 'Away'}
                  </p>
                </div>
              </div>
            )}
            
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                  <XAxis
                    dataKey="distance"
                    type="number"
                    domain={['auto', 'auto']}
                    label={{ value: 'Distance (mm)', position: 'insideBottom', offset: -5 }}
                  />

                  <YAxis
                    type="number"
                    domain={['auto', 'auto']}
                    label={{ value: 'Force (mN)', angle: -90, position: 'insideLeft' }}
                  />
                  {selectedConfig?.curveDistances &&
                    Object.entries(selectedConfig.curveDistances).map(([label, value]) => (
                      reachedCurves[label] && (
                        <ReferenceLine
                          key={label}
                          x={Number(value)}
                          stroke="#ef4444"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          label={{
                            value: `Curve ${label}`,
                            position: 'top',
                            fill: '#ef4444',
                            fontSize: 12
                          }}
                        />
                      )
                    ))
                  }

                  <Tooltip />

                  <Line
                    type="monotone"
                    dataKey="force"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className={`${isXlScreen ? 'w-[400px]' : 'w-full'} flex flex-col ${isXlScreen ? 'gap-6' : 'gap-4'} pb-20 xl:pb-0 min-h-0`}>
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
                      <p className="text-base font-bold text-green-700">{selectedConfig.pathlength} mm</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-3 rounded-xl border border-cyan-200/50">
                      <p className="text-gray-600 text-xs mb-0.5">Threshold Force</p>
                      <p className="text-base font-bold text-blue-700">{selectedConfig.thresholdForce} mN</p>
                    </div>
                    
                    <div className="col-span-2 bg-gradient-to-br from-orange-50 to-red-50 p-3 rounded-xl border border-orange-200/50">
                      <p className="text-gray-600 text-xs mb-0.5">Temperature</p>
                      <p className="text-base font-bold text-orange-700">{selectedConfig.temperature}°C</p>
                    </div>
                    <div className="col-span-2 bg-gradient-to-br from-orange-50 to-red-50 p-3 rounded-xl border border-orange-200/50">
                      <p className="text-gray-600 text-xs mb-0.5">Retraction Stroke Length</p>
                      <p className="text-base font-bold text-orange-700">{selectedConfig.retractionLength} mm</p>
                    </div>
                  </div>
                  
                  {/* NEW: COIL_LLS Status Display for large screens */}
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-3 rounded-xl border border-gray-200/50">
                    <div className="flex items-center justify-between">
                      <p className="text-gray-600 text-xs mb-0.5">COIL_LLS Status</p>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${coilLLSStatus ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {getCoilLLSDisplay()}
                      </div>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      {coilLLSStatus 
                        ? '✅ Machine is at home position. Reset disabled.' 
                        : '🔄 Machine is away from home. Reset enabled.'}
                    </p>
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
                  <p className="text-xl font-bold text-orange-600">{readData.temperatureDisplay}</p>
                </div>

                <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl border border-cyan-200/50 p-3">
                  <div className="flex items-center space-x-2 mb-1.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                      <Gauge className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-gray-600 text-xs font-medium">Force</p>
                  </div>
                  <p className="text-xl font-bold text-blue-600">{readData.forceDisplay}</p>
                </div>

                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200/50 p-3">
                  <div className="flex items-center space-x-2 mb-1.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                      <Ruler className="w-4 h-4 text-white" />
                    </div>
                    <p className="text-gray-600 text-xs font-medium">Distance</p>
                  </div>
                  <p className="text-xl font-bold text-green-600">{readData.distanceDisplay}</p>
                </div>

                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200/50 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${
                        sensorData.status === 'INSERTION' || sensorData.status === 'RETRACTION' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                        sensorData.status === 'PAUSED' || sensorData.status === 'RETRACTION PAUSED' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                        sensorData.status === 'HOMING' ? 'bg-gradient-to-br from-purple-500 to-indigo-500' :
                        sensorData.status === 'READY' || sensorData.status === 'INSERTION COMPLETED' ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : 
                        'bg-gradient-to-br from-gray-400 to-gray-500'
                      }`}>
                        <Activity className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-gray-600 text-xs font-medium">Status</p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      sensorData.status === 'INSERTION' || sensorData.status === 'RETRACTION' ? 'bg-green-500 animate-pulse' :
                      sensorData.status === 'PAUSED' || sensorData.status === 'RETRACTION PAUSED' ? 'bg-yellow-500' :
                      sensorData.status === 'HOMING' ? 'bg-purple-500 animate-pulse' :
                      sensorData.status === 'READY' || sensorData.status === 'INSERTION COMPLETED' ? 'bg-blue-500' : 'bg-gray-400'
                    }`}></div>
                  </div>
                  <p className={`text-xl font-bold ${
                    sensorData.status === 'INSERTION' || sensorData.status === 'RETRACTION' ? 'text-green-600' :
                    sensorData.status === 'PAUSED' || sensorData.status === 'RETRACTION PAUSED' ? 'text-yellow-600' :
                    sensorData.status === 'HOMING' ? 'text-purple-600' :
                    sensorData.status === 'READY' || sensorData.status === 'INSERTION COMPLETED' ? 'text-blue-600' : 'text-gray-600'
                  }`}>{sensorData.status}</p>
                </div>
                
                {/* NEW: COIL_LLS Status Display in sensors panel */}
                <div className="col-span-2 bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl border border-gray-200/50 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${coilLLSStatus ? 'bg-gradient-to-br from-green-500 to-emerald-500' : 'bg-gradient-to-br from-red-500 to-orange-500'}`}>
                        <Activity className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-gray-600 text-xs font-medium">COIL_LLS Status</p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${coilLLSStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xl font-bold ${getCoilLLSColor()}`}>
                      {getCoilLLSDisplay()}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {coilLLSStatus ? 'At home position' : 'Away from home'}
                    </p>
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    {coilLLSStatus 
                      ? 'Reset button is disabled when COIL_LLS is TRUE' 
                      : 'Reset button is enabled when COIL_LLS is FALSE'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className={`${isXlScreen ? 'relative' : 'fixed bottom-0 left-0 right-0'} bg-white/95 xl:bg-white/70 backdrop-blur-xl rounded-t-2xl xl:rounded-2xl border-t xl:border border-gray-200/80 p-3 sm:p-4 shadow-2xl xl:shadow-xl shadow-gray-200/50 z-20 flex-shrink-0`}>
            {isXlScreen && (
              <div className="mb-2">
                <h3 className="text-lg font-bold text-gray-900">Process Controls</h3>
                <p className="text-gray-600 text-xs">Manage process execution</p>
              </div>
            )}
            
            <div className="flex space-x-2 sm:space-x-3 justify-center max-w-2xl mx-auto">
              <button
                onClick={handleStart}
                disabled={shouldDisableStartButton()}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-3 sm:py-3 rounded-lg sm:rounded-xl font-bold transition-all transform hover:scale-[1.02] min-w-0 ${
                  shouldDisableStartButton()
                    ? 'bg-gray-200 cursor-not-allowed text-gray-500 border border-gray-300'
                    : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-xl shadow-green-500/25 border border-green-400/30'
                }`}
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">{getStartButtonText()}</span>
              </button>
              
              <button
                onClick={handlePause}
                disabled={shouldDisablePauseButton()}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-3 rounded-lg sm:rounded-xl font-bold transition-all transform hover:scale-[1.02] min-w-0 ${
                  shouldDisablePauseButton()
                    ? 'bg-gray-200 cursor-not-allowed text-gray-500 border border-gray-300'
                    : 'bg-gradient-to-br from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-xl shadow-yellow-500/25 border border-yellow-400/30'
                }`}
              >
                <Pause className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">PAUSE</span>
              </button>
              
              <button
                onClick={handleRetraction}
                disabled={shouldDisableRetractionButton()}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-3 rounded-lg sm:rounded-xl font-bold transition-all transform hover:scale-[1.02] min-w-0 ${
                  shouldDisableRetractionButton()
                    ? 'bg-gray-200 cursor-not-allowed text-gray-500 border border-gray-300'
                    : 'bg-gradient-to-br from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-xl shadow-purple-500/25 border border-purple-400/30'
                }`}
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">
                  {getRetractionButtonText()}
                </span>
              </button>
              
              <button
                onClick={handleReset}
                disabled={shouldDisableResetButton()}
                className={`flex-1 flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-3 rounded-lg sm:rounded-xl font-bold transition-all transform hover:scale-[1.02] min-w-0 ${
                  shouldDisableResetButton()
                    ? 'bg-gray-200 cursor-not-allowed text-gray-500 border border-gray-300'
                    : 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl shadow-red-500/25 border border-red-400/30'
                }`}
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">RESET</span>
                {coilLLSStatus && (
                  <span className="text-xs ml-1 text-gray-500">(Disabled)</span>
                )}
              </button>
            </div>
            
            {/* NEW: Reset button status indicator */}
            <div className="mt-2 text-center">
              <p className={`text-xs ${coilLLSStatus ? 'text-green-600' : 'text-red-600'}`}>
                {coilLLSStatus 
                  ? '✅ Reset disabled - Machine is at home position (COIL_LLS = TRUE)' 
                  : '🔄 Reset enabled - Machine is away from home (COIL_LLS = FALSE)'}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ProcessMode;