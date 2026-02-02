import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Power, Thermometer, Zap, RotateCw, Camera, Flame, Usb, Move, TrendingUp } from 'lucide-react';
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
  const [temperature, setTemperature] = useState('--');
  const [force, setForce] = useState('--');
  const [cameraError, setCameraError] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [controls, setControls] = useState({
    heater: false,
    homing: false
  });

  const [manualDistance, setManualDistance] = useState('--');
  const [graphData, setGraphData] = useState([]);
  const forwardData = graphData.filter(p => p.direction === "forward");
  const backwardData = graphData.filter(p => p.direction === "backward");

  const [catheterPosition, setCatheterPosition] = useState(0);

  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    port: '--', // Default to placeholder instead of hardcoded COM4
    lastCheck: null,
    dataSource: 'real'
  });

  // State to track COIL_LLS status
  const [coilLLSStatus, setCoilLLSStatus] = useState(false);

  // Check connection status on load and setup listener
  useEffect(() => {
    const checkConnection = () => {
      window.api.checkConnection()
        .then(status => {
          setConnectionStatus({
            connected: status.connected,
            port: status.port || '--', // Use port from backend
            lastCheck: status.timestamp,
            dataSource: status.connected ? 'real' : 'real'
          });

          if (!status.connected) {
            setShowConnectionError(true);
            setTemperature('--');
            setForce('--');
            setManualDistance('--');
            setCoilLLSStatus(false);
          }
        })
        .catch(error => {
          console.error('Error checking connection:', error);
          setConnectionStatus({
            connected: false,
            port: '--', // No hardcoded fallback
            lastCheck: new Date().toISOString(),
            dataSource: 'real'
          });
          setShowConnectionError(true);
          setTemperature('--');
          setForce('--');
          setManualDistance('--');
          setCoilLLSStatus(false);
        });
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
        dataSource: 'real'
      }));

      if (status === 'disconnected') {
        setShowConnectionError(true);
        setTemperature('--');
        setForce('--');
        setManualDistance('--');
        setCoilLLSStatus(false);
      } else {
        setShowConnectionError(false);
      }
    };

    window.addEventListener('modbus-status-change', handleModbusStatusChange);

    // Initialize camera feed
    // const initCamera = () => {
    //   setCameraLoading(true);
    //   setCameraError(false);

    //   navigator.mediaDevices.getUserMedia({
    //     video: {
    //       width: { ideal: 1280 },
    //       height: { ideal: 720 },
    //       facingMode: 'environment'
    //     },
    //     audio: false
    //   })
    //     .then(stream => {
    //       streamRef.current = stream;

    //       if (videoRef.current) {
    //         videoRef.current.srcObject = stream;
    //       }

    //       setCameraLoading(false);
    //     })
    //     .catch(error => {
    //       console.error('Camera access error:', error);
    //       setCameraError(true);
    //       setCameraLoading(false);
    //     });
    // };

    // initCamera();

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

  // COIL_LLS monitoring via events from main process
  useEffect(() => {
    console.log("🔍 Setting up COIL_LLS monitoring...");

    // Event listener for real-time COIL_LLS updates from main process
    const handleLLSStatusChange = (status) => {
      // The event data comes as string 'true' or 'false' from main.js
      const isLLSTrue = status === 'true' || status === true;

      console.log(`🔄 COIL_LLS Event Received: ${isLLSTrue ? 'TRUE' : 'FALSE'}`);

      // Update COIL_LLS status state
      setCoilLLSStatus(isLLSTrue);

      // If COIL_LLS becomes TRUE, homing is complete
      if (isLLSTrue) {
        setControls(prev => ({ ...prev, homing: false }));
        // Clear graph data when homing completes
        setGraphData([]);
        console.log("✅ Homing completed (via event)");
      }

      // If COIL_LLS becomes FALSE, motor has moved away from home position
      if (!isLLSTrue) {
        console.log("🔄 Motor moved away from home - COIL_LLS is FALSE");
      }
    };

    // Listen for custom events from main process
    const handleCustomEvent = (event, status) => {
      console.log("📡 Received LLS status:", status);
      handleLLSStatusChange(status);
    };

    // Setup the event listener
    window.electron?.receive?.('lls-status', handleCustomEvent) ||
      window.api?.onLlsStatus?.(handleCustomEvent);

    // Fallback: Add event listener to window
    const handleWindowEvent = (e) => {
      if (e.detail !== undefined) {
        handleLLSStatusChange(e.detail);
      }
    };

    window.addEventListener('lls-status-change', handleWindowEvent);

    console.log("✅ COIL_LLS monitoring setup complete");

    // Cleanup
    return () => {
      console.log("🧹 Cleaning up COIL_LLS monitoring");
      window.removeEventListener('lls-status-change', handleWindowEvent);
    };
  }, []);

  // Handle heater toggle using window.api
  const handleHeaterToggle = () => {
    window.api.checkConnection()
      .then(status => {
        if (!status.connected) {
          alert('PLC is not connected. Please connect to PLC first.');
          setShowConnectionError(true);
          return;
        }

        window.api.heating()
          .then(result => {
            if (result && result.success) {
              setControls(prev => ({ ...prev, heater: result.heating }));
              console.log('Heater toggled to:', result.heating, 'Result:', result);
            } else {
              throw new Error(result?.message || 'Heater operation failed');
            }
          })
          .catch(error => {
            console.error('Heater control error:', error.message);
            setShowConnectionError(true);
            // alert(`Heater operation failed: ${error.message}`);
          });
      })
      .catch(error => {
        console.error('Connection check error:', error);
        // alert('PLC connection check failed. Please check connection.');
      });
  };

  const resetCatheter = () => {
    window.api.checkConnection()
      .then(status => {
        if (!status.connected) {
          alert('PLC is not connected. Please connect to PLC first.');
          setShowConnectionError(true);
          return;
        }

        // Clear graph data immediately
        setGraphData([]);

        // Activate homing UI state immediately
        setControls(prev => ({ ...prev, homing: true }));
        setCatheterPosition(0);

        // Send home command
        window.api.home()
          .then(result => {
            if (result.success) {
              console.log('Homing initiated:', result);
            } else {
              setControls(prev => ({ ...prev, homing: false }));
              throw new Error(result.message || 'Homing failed');
            }
          })
          .catch(error => {
            console.error('Homing error:', error.message);
            setShowConnectionError(true);
            setControls(prev => ({ ...prev, homing: false }));
            // alert(`Homing failed: ${error.message}`);
          });
      })
      .catch(error => {
        console.error('Connection check error:', error);
        // alert('PLC connection check failed. Please check connection.');
      });
  };

  const handleReconnect = async () => {
    try {
      console.log('Attempting to reconnect...');
      const result = await window.api.reconnect();
      if (result.success && result.connected) {
        setShowConnectionError(false);
        setConnectionStatus(prev => ({ ...prev, connected: true, dataSource: 'real' }));
        console.log('Reconnect successful');
      } else {
        console.log('Reconnect failed');
      }
    } catch (error) {
      console.error('Reconnect error:', error);
    }
  };

  // const retryCamera = () => {
  //   setCameraLoading(true);
  //   setCameraError(false);

  //   navigator.mediaDevices.getUserMedia({
  //     video: {
  //       width: { ideal: 1280 },
  //       height: { ideal: 720 },
  //       facingMode: 'environment'
  //     },
  //     audio: false
  //   })
  //     .then(stream => {
  //       streamRef.current = stream;

  //       if (videoRef.current) {
  //         videoRef.current.srcObject = stream;
  //       }

  //       setCameraLoading(false);
  //     })
  //     .catch(error => {
  //       console.error('Camera retry error:', error);
  //       setCameraError(true);
  //       setCameraLoading(false);
  //     });
  // };

  // Read PLC data periodically - REAL-TIME DATA ONLY
  useEffect(() => {
    const readData = () => {
      window.api.readData()
        .then(data => {
          if (data.success) {
            // Update force (already in mN)
            setForce(data.force_mN);

            // Update temperature
            setTemperature(data.temperature);

            // Convert distance to position percentage (assuming 1000mm max)
            const maxDistance = 1000;
            const positionPercent = Math.min(100, (data.distance / maxDistance) * 100);
            setCatheterPosition(positionPercent);
            setManualDistance(data.manualDistance || 0);

            // Update COIL_LLS status from PLC data
            if (data.coilLLS !== undefined) {
              const newCoilLLSStatus = Boolean(data.coilLLS);
              setCoilLLSStatus(newCoilLLSStatus);

              // If COIL_LLS becomes TRUE, homing is complete
              if (newCoilLLSStatus) {
                setControls(prev => ({ ...prev, homing: false }));
              }
            }

            // Update graph data
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
                direction,
              };

              const updated = [...prev, newPoint];

              return updated.length > 200
                ? updated.slice(updated.length - 200)
                : updated;
            });
          } else {
            // Handle success: false (e.g. disconnected)
            setForce('--');
            setTemperature('--');
            setManualDistance('--');
            setCoilLLSStatus(false);
          }
        })
        .catch(error => {
          console.error('Error reading PLC data:', error);
          setForce('--');
          setTemperature('--');
          setManualDistance('--');
          setCoilLLSStatus(false);
        });
    };

    // Read data only when connected
    let intervalId;
    if (connectionStatus.connected) {
      readData();
      intervalId = setInterval(readData, 500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [connectionStatus.connected]);

  const disableManualMode = () => {
    window.api.checkConnection()
      .then(status => {
        if (status.connected) {
          window.api.disableManualMode()
            .then(result => {
              if (result.success) {
                console.log('Manual mode disabled successfully');
              }
            })
            .catch(error => console.error('Disable error:', error));
        }
      })
      .catch(error => console.error('Connection check error:', error));
  };

  // Determine if Homing button should be disabled
  const isHomingButtonDisabled = !connectionStatus.connected || controls.homing || coilLLSStatus;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                window.api.checkConnection()
                  .then(status => {
                    if (status.connected) {
                      window.api.disableManualMode()
                        .catch(error => console.error('Disable error:', error));
                    }
                  })
                  .catch(error => console.error('Connection check error:', error));

                window.history.back();
              }}
              className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>

            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Manual Mode</h1>
          </div>

          <div className="flex items-center space-x-3">
            {/* USB Connection Status Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${connectionStatus.connected ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
              <Usb className="w-4 h-4" />
              <span className="text-sm font-medium">
                {connectionStatus.connected ? 'USB Connected' : 'USB Disconnected'}
              </span>
            </div>

            {!connectionStatus.connected && (
              <button
                onClick={handleReconnect}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Attempt to reconnect USB"
              >
                Reconnect
              </button>
            )}

            <button
              onClick={() => {
                const confirmed = window.confirm("Are you sure you want to exit?");
                if (confirmed) {
                  disableManualMode();
                  window.close();
                }
              }}
              className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white 
            rounded-xl lg:rounded-2xl w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all 
            duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl border border-red-400/30 flex-shrink-0"
            >
              <Power className="w-3 h-3 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:scale-110 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Live Video Feed */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              {/* <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold flex items-center space-x-2">
                    <div className={`w-3 h-3 ${connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'} rounded-full animate-pulse`}></div>
                    <span>Live Feed</span>
                  </h2>
                </div>
              </div>*/}

              {/* Video Container */}
              {/*} <div className="relative bg-slate-200 aspect-video flex items-center justify-center">
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
                              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#64748b" strokeWidth="1" />
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#grid)" />
                        </svg>
                      </div>

                      <div className="absolute top-4 left-4 bg-black bg-opacity-60 text-white px-3 py-1 rounded-lg text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span>Position: {catheterPosition.toFixed(1)}%</span>
                          <span className="text-xs opacity-75">
                            (LIVE)
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
              // </div>
              */}

              {/* Manual Distance Graph */}
              <div className="bg-white border-t border-slate-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg shadow-sm">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-800">
                        Distance vs Force
                      </h3>
                      <p className="text-slate-500 text-xs font-medium">Real-time analysis</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6 bg-slate-50/50 px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-1 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50" />
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Insertion</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-1 bg-red-500 rounded-full shadow-sm shadow-red-500/50" />
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Retraction</span>
                    </div>
                  </div>
                </div>

                <div className="w-full h-56 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={graphData}
                      margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                      <XAxis
                        dataKey="manualDistance"
                        type="number"
                        tick={{ fontSize: 11 }}
                      />

                      <YAxis
                        label={{ value: "Force (mN)", angle: -90, position: "insideLeft" }}
                        tick={{ fontSize: 11 }}
                      />

                      <Tooltip
                        formatter={(value) => [`${value} mN`, "Force"]}
                        labelFormatter={(label) =>
                          `Distance: ${label} mm`
                        }
                      />

                      <Line
                        type="monotone"
                        data={forwardData}
                        dataKey="force"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />

                      {/* Backward movement (left / retraction) */}
                      <Line
                        type="monotone"
                        data={backwardData}
                        dataKey="force"
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Static X-Axis Label to prevent blinking */}
                  <div className="absolute bottom-1 left-0 right-0 text-center pointer-events-none">
                    <span className="text-[11px] font-medium text-slate-600">
                      Distance (mm)
                    </span>
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
                      <p className="text-slate-600 text-sm font-medium">Temperature</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-2 bg-orange-200 rounded-full">
                          <div
                            className="h-full bg-orange-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (temperature / 40) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-slate-800 font-bold text-lg">
                          {temperature === '--' ? '-- °C' : (parseFloat(temperature) > 100 ? 'ERROR 01' : `${parseFloat(temperature).toFixed(1)}°C`)}
                        </span>
                      </div>
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

                        <span className="text-slate-800 font-bold text-lg">
                          {force === '--' ? '-- mN' : `${parseFloat(force).toFixed(2)} mN`}
                        </span>
                      </div>
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
                      <p className="text-slate-600 text-sm font-medium">Distance</p>

                      <span className="text-slate-800 font-bold text-lg">
                        {manualDistance === '--' ? '-- mm' : `${manualDistance} mm`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            {/* Heater Control */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Heater Control</h3>
              <p className="text-sm text-slate-500 mb-4">Press to toggle ON/OFF</p>
              <div className="flex justify-center">
                <button
                  onClick={handleHeaterToggle}
                  disabled={!connectionStatus.connected || controls.homing}
                  className={`relative w-24 h-24 rounded-full border-4 transition-all duration-300 shadow-lg hover:shadow-xl ${!connectionStatus.connected || controls.homing
                    ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                    : controls.heater
                      ? 'bg-orange-500 border-orange-600 text-white hover:bg-orange-600'
                      : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Flame className="w-8 h-8" />
                  </div>
                  {controls.heater && connectionStatus.connected && (
                    <div className="absolute -inset-1 bg-orange-500 rounded-full animate-ping opacity-30"></div>
                  )}
                </button>
              </div>
              <div className="mt-4 text-center">
                <span className={`text-sm font-semibold ${controls.heater ? 'text-orange-600' : 'text-slate-600'}`}>
                  {controls.heater ? 'HEATING' : 'OFF'}
                </span>
              </div>
            </div>

            {/* Homing Control */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Homing Control</h3>
              <p className="text-sm text-slate-500 mb-4">Press to reset catheter position</p>
              <div className="flex justify-center">
                <button
                  onClick={resetCatheter}
                  disabled={isHomingButtonDisabled}
                  className={`relative w-24 h-24 rounded-full border-4 transition-all duration-300 shadow-lg hover:shadow-xl ${isHomingButtonDisabled
                    ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                    : controls.homing
                      ? 'bg-blue-500 border-blue-600 text-white'
                      : 'bg-white border-slate-300 text-slate-600 hover:border-slate-400'
                    }`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RotateCw className={`w-8 h-8 ${controls.homing ? 'animate-spin' : ''}`} />
                  </div>
                  {controls.homing && connectionStatus.connected && (
                    <div className="absolute -inset-1 bg-blue-500 rounded-full animate-ping opacity-30"></div>
                  )}
                </button>
              </div>
              <div className="mt-4 text-center">
                <span className={`text-sm font-semibold ${controls.homing ? 'text-blue-600' : 'text-slate-600'}`}>
                  {controls.homing ? 'HOMING ACTIVE' : coilLLSStatus ? 'AT HOME' : 'READY'}
                </span>
              </div>

              {/* Status Messages */}
              {/* {coilLLSStatus && !controls.homing && (
                <p className="text-xs text-green-500 text-center mt-2">
                  ✅ Gripper is at home position. Homing disabled.
                </p>
              )}

              {!coilLLSStatus && !controls.homing && (
                <p className="text-xs text-amber-500 text-center mt-2">
                  🔄 Gripper is away from home. Homing available.
                </p>
              )}

              {controls.homing && (
                <p className="text-xs text-blue-500 text-center mt-2">
                  ⚙️ Homing in progress... Waiting for COIL_LLS = TRUE
                </p>
              )} */}
            </div>

            {/* Status Panel */}
            {/* <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">System Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Heater:</span>
                  <span className={`font-semibold ${controls.heater ? 'text-orange-600' : 'text-slate-600'}`}>
                    {controls.heater ? 'HEATING' : 'OFF'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Homing Status:</span>
                  <span className={`font-semibold ${controls.homing ? 'text-blue-600' : coilLLSStatus ? 'text-green-600' : 'text-amber-600'}`}>
                    {controls.homing ? 'ACTIVE' : coilLLSStatus ? 'AT HOME' : 'AWAY FROM HOME'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">COIL_LLS:</span>
                  <span className={`font-semibold ${coilLLSStatus ? 'text-green-600' : 'text-red-600'}`}>
                    {coilLLSStatus ? 'TRUE' : 'FALSE'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Manual Distance:</span>
                  <span className="font-semibold text-emerald-600">
                    {manualDistance} mm
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Homing Button:</span>
                  <span className={`font-semibold ${isHomingButtonDisabled ? 'text-gray-600' : 'text-green-600'}`}>
                    {isHomingButtonDisabled ? 'DISABLED' : 'ENABLED'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Data Source:</span>
                  <span className="font-semibold text-blue-600">
                    REAL-TIME PLC DATA
                  </span>
                </div>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Manual;