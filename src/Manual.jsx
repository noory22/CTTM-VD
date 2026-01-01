import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Power, AlertCircle, X, Thermometer, Zap, ChevronLeft, ChevronRight, RotateCw, Camera, Flame, Usb, AlertTriangle, Move } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const Manual = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [showConnectionError, setShowConnectionError] = useState(false);
  const [temperature, setTemperature] = useState(22.0);
  const [force, setForce] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [controls, setControls] = useState({
    clamp: false,
    heater: false,
    homing: false
  });
// ----------------------------------------------
  // const [catheterDistance, setCatheterDistance] = useState(0);
  const [manualDistance, setManualDistance] = useState(0);
  const [graphData, setGraphData] = useState([]);
  const [movementDirection, setMovementDirection] = useState("forward");
  const forwardData = graphData.filter(p => p.direction === "forward");
  const backwardData = graphData.filter(p => p.direction === "backward");

// --------------------------------------------


  const [catheterPosition, setCatheterPosition] = useState(0);
  const [motorState, setMotorState] = useState({
    forward: false,
    backward: false
  });
  
  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    port: 'COM4',
    lastCheck: null,
    dataSource: 'simulated' // 'simulated' or 'real'
  });

  // Check connection status on load and setup listener
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await window.api.checkConnection();
        setConnectionStatus({
          connected: status.connected,
          port: status.port,
          lastCheck: status.timestamp,
          dataSource: status.connected ? 'real' : 'simulated'
        });
        
        if (!status.connected) {
          setShowConnectionError(true);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
        setConnectionStatus({
          connected: false,
          port: 'COM4',
          lastCheck: new Date().toISOString(),
          dataSource: 'simulated'
        });
        setShowConnectionError(true);
      }
    };

    // Check connection initially
    checkConnection();

    // Set up interval to check connection periodically (every 5 seconds)
    const intervalId = setInterval(checkConnection, 5000);

    // Listen for connection status updates from main process
    const handleModbusStatusChange = (event) => {
      const status = event.detail; // 'connected' or 'disconnected'
      const newConnected = status === 'connected';
      setConnectionStatus(prev => ({
        ...prev,
        connected: newConnected,
        dataSource: newConnected ? 'real' : 'simulated'
      }));
      
      if (status === 'disconnected') {
        setShowConnectionError(true);
      } else {
        setShowConnectionError(false);
      }
    };

    window.addEventListener('modbus-status-change', handleModbusStatusChange);

    // Initialize camera feed
    const initCamera = async () => {
      try {
        setCameraLoading(true);
        setCameraError(false);
        
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
      clearInterval(intervalId);
      window.removeEventListener('modbus-status-change', handleModbusStatusChange);
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, []);

  // Handle control toggles using window.api
  // const handleControlToggle = async (controlName) => {
  //   try {
  //     // Check connection first
  //     const status = await window.api.checkConnection();
  //     if (!status.connected) {
  //       alert('PLC is not connected. Please connect to PLC first.');
  //       setShowConnectionError(true);
  //       return;
  //     }

  //     if (controlName === 'clamp') {
  //       const result = await window.api.clamp();
  //       if (result.success) {
  //         const newClampState = result.clampState === "ON";
  //         setControls(prev => ({ ...prev, clamp: newClampState }));
  //         console.log('Clamp toggled:', newClampState, 'Result:', result);
  //       } else {
  //         throw new Error(result.message || 'Clamp operation failed');
  //       }
  //     } else if (controlName === 'heater') {
  //       const result = await window.api.heating();
  //       if (result && result.success) {
  //         setControls(prev => ({ ...prev, heater: result.heating }));
  //         console.log('Heater toggled to:', result.heating, 'Result:', result);
  //       }else {
  //         throw new Error(result?.message || 'Heater operation failed');
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Control error:', error.message);
  //     setShowConnectionError(true);
  //     // alert(`Operation failed: ${error.message}`);
  //   }
  // };

  // // Function to stop all motor movement
  // const stopAllMotors = async () => {
  //   try {
  //     // If insertion is currently active, toggle it off
  //     if (motorState.forward) {
  //       const result = await window.api.insertion();
  //       if (result.success && !result.insertionState) {
  //         setMotorState({ forward: false, backward: false });
  //       }
  //     }
      
  //     // If retraction is currently active, toggle it off
  //     if (motorState.backward) {
  //       const result = await window.api.ret();
  //       if (result.success && !result.retState) {
  //         setMotorState({ forward: false, backward: false });
  //       }
  //     }
  //   } catch (error) {
  //     console.error('Stop motors error:', error.message);
  //   }
  // };

  // const moveCatheter = async (direction) => {
  //   try {
  //     // Check connection first
  //     const status = await window.api.checkConnection();
  //     if (!status.connected) {
  //       alert('PLC is not connected. Please connect to PLC first.');
  //       setShowConnectionError(true);
  //       return;
  //     }

  //     if (direction === "forward") {
  //       // If forward is already active, toggle it off
  //       if (motorState.forward) {
  //         const result = await window.api.insertion();
  //         if (result.success) {
  //           const newInsertionState = result.insertionState === "ON";
  //           setMotorState({ forward: newInsertionState, backward: false });
  //           console.log('Insertion toggled:', newInsertionState, 'Result:', result);
  //         } else {
  //           throw new Error(result.message || 'Insertion operation failed');
  //         }
  //       } else {
  //         // Stop any backward movement first
  //         if (motorState.backward) {
  //           await window.api.ret();
  //         }
          
  //         // Turn on COIL_INSERTION
  //         const result = await window.api.insertion();
  //         if (result.success) {
  //           const newInsertionState = result.insertionState === "ON";
  //           setMotorState({ forward: newInsertionState, backward: false });
  //           console.log('Insertion activated:', newInsertionState, 'Result:', result);
  //         }else {
  //           throw new Error(result.message || 'Insertion failed');
  //         }
  //       }
  //     } else if (direction === "backward") {
  //       // If backward is already active, toggle it off
  //       if (motorState.backward) {
  //         const result = await window.api.ret();
  //         if (result.success) {
  //           const newRetState = result.retState === "ON";
  //           setMotorState({ forward: false, backward: newRetState });
  //           console.log('Retraction toggled:', newRetState, 'Result:', result);
  //         } 
  //         else {
  //           throw new Error(result.message || 'Retraction operation failed');
  //         }
  //       } else {
  //         // Stop any forward movement first
  //         if (motorState.forward) {
  //           await window.api.insertion();
  //         }
          
  //         // Turn on COIL_RET
  //         const result = await window.api.ret();
  //         if (result.success) {
  //           const newRetState = result.retState === "ON";
  //           setMotorState({ forward: false, backward: newRetState });
  //           console.log('Retraction activated:', newRetState, 'Result:', result);
  //         } else {
  //           throw new Error(result.message || 'Retraction failed');
  //         }
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Motor movement error:", error.message);
  //     setShowConnectionError(true);
  //     // alert(`Movement failed: ${error.message}`);
  //   }
  // };

  const resetCatheter = async () => {
    try {
      // Check connection first
      const status = await window.api.checkConnection();
      if (!status.connected) {
        alert('PLC is not connected. Please connect to PLC first.');
        setShowConnectionError(true);
        return;
      }

      // Stop any motor movement first
      // await stopAllMotors();
      
      // Activate homing (COIL_HOME)
      setControls(prev => ({ ...prev, homing: true }));
      const result = await window.api.home();

      // ✅ Clear graph data when homing completes
      setGraphData([]);
      
      if (result.success) {
        console.log('Homing initiated:', result);
        setCatheterPosition(0);
        setMotorState({ forward: false, backward: false });
      } else {
        throw new Error(result.message || 'Homing failed');
        setControls(prev => ({ ...prev, homing: false }));
      }
    } catch (error) {
      console.error('Homing error:', error.message);
      setShowConnectionError(true);
      setControls(prev => ({ ...prev, homing: false }));
      // alert(`Homing failed: ${error.message}`);
    }
  };

  const handleReconnect = async () => {
    try {
      const result = await window.api.reconnect();
      if (result.success && result.connected) {
        setShowConnectionError(false);
        setConnectionStatus(prev => ({ ...prev, connected: true, dataSource: 'real' }));
        alert('Successfully reconnected to PLC!');
      } else {
        alert('Failed to reconnect. Please check PLC connection.');
      }
    } catch (error) {
      console.error('Reconnect error:', error);
      alert('Reconnection failed. Please check PLC connection.');
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
  
  // Listen for LLS status changes (homing completion)
  useEffect(() => {
    const handleLLSStatusChange = (event) => {
      if (event.detail === 'true') {
        console.log("🔄 Manual Mode: COIL_LLS detected TRUE - Homing complete");
        setControls(prev => ({ ...prev, homing: false }));
        console.log("✅ Manual mode UI updated: Homing inactive");
      }
    };

    window.addEventListener('lls-status-change', handleLLSStatusChange);
    
    return () => {
      window.removeEventListener('lls-status-change', handleLLSStatusChange);
    };
  }, []);

  // Read PLC data periodically - FIXED VERSION
  useEffect(() => {
    const readData = async () => {
      try {
        const data = await window.api.readData();
        if (data.success) {
          // DEBUG: Log the data structure (optional)
          // console.log('PLC Data:', {
          //   force_mN: data.force_mN,
          //   forceDisplay: data.forceDisplay,
          //   distance: data.distance,
          //   temperature: data.temperature
          // });

          // Update force (already in mN)
          setForce(data.force_mN);
          
          // Update temperature
          setTemperature(data.temperature);
          
          // Convert distance to position percentage (assuming 1000mm max)
          const maxDistance = 1000;
          // --------------------------------------------------------
          const positionPercent = Math.min(100, (data.distance / maxDistance) * 100);
          setCatheterPosition(positionPercent);
          setManualDistance(data.manualDistance || 0);

          // ---------------- GRAPH DATA UPDATE ----------------
// ---------------- MANUAL GRAPH DATA UPDATE ----------------
          // X-axis: manual distance (D550)
          // Y-axis: force (mN)
          // setGraphData(prev => {
          //   const x = Number(data.manualDistance);
          //   const y = Number(data.force_mN);

          //   // Safety: ignore invalid values
          //   if (isNaN(x) || isNaN(y)) return prev;

          //   const newPoint = {
          //     manualDistance: x,
          //     force: y,
          //     ts: Date.now()
          //   };

          //   const updated = [...prev, newPoint];

          //   // Keep last 200 points only (prevents lag / blinking)
          //   return updated.length > 200
          //     ? updated.slice(updated.length - 200)
          //     : updated;
          // });

          setGraphData(prev => {
            const x = Number(data.manualDistance);
            const y = Number(data.force_mN);

            if (isNaN(x) || isNaN(y)) return prev;

            let direction = "forward";

            if (prev.length > 0) {
              const lastX = prev[prev.length - 1].manualDistance;
              direction = x < lastX ? "backward" : "forward";
            }

            const newPoint = {
              manualDistance: x,
              force: y,
              direction, // 👈 VERY IMPORTANT
            };

            const updated = [...prev, newPoint];

            return updated.length > 200
              ? updated.slice(updated.length - 200)
              : updated;
          });






        // ------------------------------------------------  
          // Update data source indicator
          if (data.isSimulated && connectionStatus.dataSource !== 'simulated') {
            setConnectionStatus(prev => ({ ...prev, dataSource: 'simulated' }));
          } else if (!data.isSimulated && connectionStatus.dataSource !== 'real') {
            setConnectionStatus(prev => ({ ...prev, dataSource: 'real' }));
          }
        }
      } catch (error) {
        console.error('Error reading PLC data:', error);
        // Fallback to simulated data
        const simulatedDistance = Math.floor(Math.random() * 1000);
        const simulatedForce = 1000 + (Math.random() * 5000);
        const simulatedTemp = 22 + (Math.random() * 3);
        
        setForce(simulatedForce);
        setTemperature(simulatedTemp);
        const positionPercent = Math.min(100, (simulatedDistance / 1000) * 100);
        setCatheterPosition(positionPercent);
        setConnectionStatus(prev => ({ ...prev, dataSource: 'simulated' }));
      }
    };

    // Read data every 500ms when connected, every 2s when not connected
    let intervalId;
    if (connectionStatus.connected) {
      readData();
      intervalId = setInterval(readData, 500);
    } else {
      // Simulate data when not connected
      const simulateData = () => {
        const simulatedDistance = Math.floor(Math.random() * 1000);
        const simulatedForce = 1000 + (Math.random() * 5000);
        const simulatedTemp = 22 + (Math.random() * 3);
        
        setForce(simulatedForce);
        setTemperature(simulatedTemp);
        const positionPercent = Math.min(100, (simulatedDistance / 1000) * 100);
        setCatheterPosition(positionPercent);
      };
      
      simulateData();
      intervalId = setInterval(simulateData, 2000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [connectionStatus.connected]);
  // Add this function in Manual.jsx, near other handler functions
  const disableManualMode = async () => {
    try {
      // Only try to disable if connected
      const status = await window.api.checkConnection();
      if (status.connected) {
        const result = await window.api.disableManualMode();
        if (result.success) {
          console.log('Manual mode disabled successfully');
        }
      }
    } catch (error) {
      console.error('Error disabling manual mode:', error);
      // Don't show error to user for cleanup operations
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={async () => {
                await disableManualMode(); // Turn off manual mode first
                window.history.back(); // Then go back
              }}
              className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>

            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Manual Mode</h1>
            
            {/* USB Connection Status Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${connectionStatus.connected ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
              <Usb className="w-4 h-4" />
              <span className="text-sm font-medium">
                {connectionStatus.connected ? 'PLC Connected' : 'PLC Disconnected'}
              </span>
              <span className="text-xs opacity-75">
                {connectionStatus.port}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${connectionStatus.dataSource === 'real' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                {connectionStatus.dataSource === 'real' ? 'LIVE' : 'SIM'}
              </span>
            </div>
          </div>
          
          <button
            onClick={async () => {
              const confirmed = window.confirm("Are you sure you want to exit?");
              if (confirmed) {
                await disableManualMode(); // Turn off manual mode first
                window.close(); // Then close window
              }
            }}
            className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white 
            rounded-xl lg:rounded-2xl w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all 
            duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl border border-red-400/30 flex-shrink-0"
          >
            <Power className="w-3 h-3 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:scale-110 transition-transform duration-300" />
          </button>
        </div>

        {/* PLC Connection Error */}
        {/* {showConnectionError && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-red-800 font-semibold">PLC CONNECTION ERROR</p>
                  <p className="text-red-600 text-sm mt-1">
                    Cannot communicate with PLC on {connectionStatus.port}. 
                    {connectionStatus.connected ? ' Connection lost.' : ' Device not connected.'}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={handleReconnect}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                    >
                      Reconnect
                    </button>
                    <button 
                      onClick={() => setShowConnectionError(false)}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setShowConnectionError(false)}
                className="text-red-500 hover:text-red-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )} */}

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Live Video Feed */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold flex items-center space-x-2">
                    <div className={`w-3 h-3 ${connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'} rounded-full animate-pulse`}></div>
                    <span>Live Feed</span>
                  </h2>
                  {/* <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-xs text-gray-300">
                      PLC: {connectionStatus.connected ? 'Online' : 'Offline'} | Data: {connectionStatus.dataSource === 'real' ? 'Live' : 'Simulated'}
                    </span>
                  </div> */}
                </div>
              </div>
              
              {/* Video Container */}
              <div className="relative bg-slate-200 aspect-video flex items-center justify-center">
                {cameraLoading ? (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-600"></div>
                    <p className="text-slate-600 font-medium">Initializing camera...</p>
                  </div>
                ) : cameraError ? (
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
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    
                    <div className="absolute inset-0">
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
                      
                      <div className="absolute top-4 left-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-lg text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span>Position: {catheterPosition.toFixed(1)}%</span>
                          <span className="text-xs opacity-75">
                            ({connectionStatus.dataSource === 'real' ? 'LIVE' : 'SIM'})
                          </span>
                        </div>
                      </div>
                      
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
                        <div className="bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="w-24 h-2 bg-slate-600 rounded-full">
                              <div 
                                className="h-full bg-blue-400 rounded-full transition-all duration-300"
                                style={{ width: `${catheterPosition}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium">{catheterPosition.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Manual Distance Graph */}
              <div className="bg-white border-t border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  Manual Distance vs Force 
                </h3>

                <div className="w-full h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={graphData}
                      margin={{ top: 10, right: 30, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                      <XAxis
                        dataKey="manualDistance"
                        type="number"
                        label={{ value: "Manual Distance (mm)", position: "insideBottom", offset: -10 }}
                        tick={{ fontSize: 11 }}
                      />

                      <YAxis
                        label={{ value: "Force (mN)", angle: -90, position: "insideLeft" }}
                        tick={{ fontSize: 11 }}
                      />

                      <Tooltip
                        formatter={(value) => [`${value} mN`, "Force"]}
                        labelFormatter={(label) =>
                          `Manual Distance: ${label} mm`
                        }
                      />

                      <Line
                        type="monotone"
                        data={forwardData}
                        dataKey="force"
                        stroke="#3b82f6"  
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}   // 🚨 stops blinking
                      />

                      {/* Backward movement (left / retraction) */}
                      <Line
                        type="monotone"
                        data={backwardData}
                        dataKey="force"
                        stroke="#ef4444"   // red
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
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
                      <p className="text-slate-600 text-sm font-medium">Temperature</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-2 bg-orange-200 rounded-full">
                          <div 
                            className="h-full bg-orange-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (temperature / 40) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-slate-800 font-bold text-lg">{temperature.toFixed(1)}°C</span>
                      </div>
                      {connectionStatus.dataSource === 'simulated' && (
                        <p className="text-xs text-orange-500 mt-1">Simulated Data</p>
                      )}
                    </div>
                  </div>

                  {/* Force in mN */}
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
                            style={{ width: `${Math.min(100, (force / 2000) * 100)}%` }}
                          ></div>
                        </div>

                        <span className="text-slate-800 font-bold text-lg">{force.toFixed(2)} mN</span>
                      </div>

                      {connectionStatus.dataSource === 'simulated' && (
                        <p className="text-xs text-blue-500 mt-1">Simulated Data</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        ≈ {(force / 1000).toFixed(4)} N
                      </p>
                    </div>
                  </div>

                  {/* Manual Movement Distance */}
                  <div className="flex items-center space-x-4 mt-3">
                    <div className="p-3 bg-emerald-100 rounded-xl">
                      <Move className="w-6 h-6 text-emerald-600" />
                    </div>

                    <div>
                      <p className="text-slate-600 text-sm font-medium">Movement Distance</p>

                      <span className="text-slate-800 font-bold text-lg">
                        {manualDistance} mm
                      </span>

                      {connectionStatus.dataSource === 'simulated' && (
                        <p className="text-xs text-emerald-500 mt-1">Simulated Data</p>
                      )}
                    </div>
                  </div>




                </div>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            


            {/* Heater and Homing */}
            <div className="grid grid-cols-2 gap-4">
              {/* Heater */}
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                <h4 className="text-sm font-semibold text-slate-800 mb-3">Heater</h4>
                <div className="flex justify-center">
                  <button
                    onClick={() => handleControlToggle('heater')}
                    disabled={!connectionStatus.connected || controls.homing}
                    className={`relative w-16 h-16 rounded-full border-4 transition-all duration-300 shadow-lg hover:shadow-xl ${
                      !connectionStatus.connected || controls.homing
                        ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                        : controls.heater 
                          ? 'bg-orange-500 border-orange-600 text-white' 
                          : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Flame className="w-6 h-6" />
                    </div>
                    {controls.heater && connectionStatus.connected && (
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
                    disabled={!connectionStatus.connected || controls.homing}
                    className={`relative w-16 h-16 rounded-full border-4 transition-all duration-300 shadow-lg hover:shadow-xl ${
                      !connectionStatus.connected
                        ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                        : controls.homing 
                          ? 'bg-blue-500 border-blue-600 text-white' 
                          : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <RotateCw className={`w-6 h-6 ${controls.homing ? 'animate-spin' : ''}`} />
                    </div>
                    {controls.homing && connectionStatus.connected && (
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
                {/* <div className="flex items-center justify-between">
                  <span className="text-slate-600">Clamp:</span>
                  <span className={`font-semibold ${controls.clamp ? 'text-green-600' : 'text-red-600'}`}>
                    {controls.clamp ? 'ON' : 'OFF'}
                  </span>
                </div> */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Heater:</span>
                  <span className={`font-semibold ${controls.heater ? 'text-orange-600' : 'text-slate-600'}`}>
                    {controls.heater ? 'HEATING' : 'OFF'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Homing:</span>
                  <span className={`font-semibold ${controls.homing ? 'text-blue-600' : 'text-slate-600'}`}>
                    {controls.homing ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                {/* <div className="flex items-center justify-between">
                  <span className="text-slate-600">Movement:</span>
                  <span className={`font-semibold ${
                    motorState.forward ? 'text-blue-600' : 
                    motorState.backward ? 'text-blue-600' : 
                    'text-slate-600'
                  }`}>
                    {motorState.forward ? 'FORWARD' : motorState.backward ? 'BACKWARD' : 'IDLE'}
                  </span>
                </div> */}
                {/* <div className="flex items-center justify-between">
                  <span className="text-slate-600">Data Source:</span>
                  <span className={`font-semibold ${connectionStatus.dataSource === 'real' ? 'text-green-600' : 'text-gray-600'}`}>
                    {connectionStatus.dataSource === 'real' ? 'LIVE PLC' : 'SIMULATED'}
                  </span>
                </div> */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Manual;