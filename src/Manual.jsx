import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Power, RotateCw, Usb, AlertCircle } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

import clampIcon from "./assets/Clamp.png";

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Manual = () => {
  const chartRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [showConnectionError, setShowConnectionError] = useState(false);
  const [showHomingPrompt, setShowHomingPrompt] = useState(false);
  const [force, setForce] = useState('--');
  const [cameraError, setCameraError] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [controls, setControls] = useState({
    homing: false,
    clamp: false,
    insertion: false,
    retraction: false
  });

  const [manualDistance, setManualDistance] = useState('--');
  const [graphData, setGraphData] = useState([]);
  const forwardData = graphData.filter(p => p.direction === "forward");
  const backwardData = graphData.filter(p => p.direction === "backward");

  const [catheterPosition, setCatheterPosition] = useState(0);

  // Connection status state
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    port: '--',
    lastCheck: null,
    dataSource: 'real'
  });

  // State to track COIL_LLS status
  const [coilLLSStatus, setCoilLLSStatus] = useState(false);
  const [powerActive, setPowerActive] = useState(false);

  // Chart configuration
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 0
    },
    events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
    interaction: {
      intersect: false,
      mode: 'nearest',
      axis: 'x'
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        mode: 'nearest',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#3b82f6',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 10,
        displayColors: false,
        callbacks: {
          label: function (context) {
            return `${context.dataset.label || 'Force'}: ${context.parsed.y.toFixed(2)} mN`;
          },
          title: function (context) {
            return `Distance: ${context[0].parsed.x.toFixed(2)} mm`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        title: {
          display: true,
          text: 'Distance (mm)',
          color: '#64748b',
          font: {
            size: 11,
            weight: '500'
          }
        },
        grid: {
          color: 'rgba(241, 245, 249, 1)',
          drawBorder: true,
          borderColor: 'rgba(203, 213, 225, 0.8)'
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 11
          },
          maxTicksLimit: 8
        }
      },
      y: {
        type: 'linear',
        title: {
          display: true,
          text: 'Force (mN)',
          color: '#64748b',
          font: {
            size: 11,
            weight: '500'
          }
        },
        grid: {
          color: 'rgba(241, 245, 249, 1)',
          drawBorder: true,
          borderColor: 'rgba(203, 213, 225, 0.8)'
        },
        ticks: {
          color: '#94a3b8',
          font: {
            size: 11
          },
          maxTicksLimit: 6
        }
      }
    },
    elements: {
      line: {
        tension: 0,
        borderWidth: 2.5,
        fill: false
      },
      point: {
        radius: 0,
        hoverRadius: 5
      }
    }
  };

  // Prepare chart data
  const chartConfig = {
    datasets: [
      {
        label: 'Insertion',
        data: forwardData.map(point => ({ x: point.manualDistance, y: point.force })),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: false,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#3b82f6'
      },
      {
        label: 'Retraction',
        data: backwardData.map(point => ({ x: point.manualDistance, y: point.force })),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: false,
        pointBackgroundColor: '#ef4444',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#ef4444'
      }
    ]
  };

  // Scope overflow: hidden to Manual Mode only
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, []);

  // Check connection status on load and setup listener
  useEffect(() => {
    const checkConnection = () => {
      window.api.checkConnection()
        .then(status => {
          setConnectionStatus({
            connected: status.connected,
            port: status.port || '--',
            lastCheck: status.timestamp,
            dataSource: status.connected ? 'real' : 'real'
          });

          if (!status.connected) {
            setShowConnectionError(true);
            setForce('--');
            setManualDistance('--');
            setCoilLLSStatus(false);
          }
        })
        .catch(error => {
          console.error('Error checking connection:', error);
          setConnectionStatus({
            connected: false,
            port: '--',
            lastCheck: new Date().toISOString(),
            dataSource: 'real'
          });
          setShowConnectionError(true);
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
      const status = event.detail;
      const newConnected = status === 'connected';
      setConnectionStatus(prev => ({
        ...prev,
        connected: newConnected,
        dataSource: 'real'
      }));

      if (status === 'disconnected') {
        setShowConnectionError(true);
        setForce('--');
        setManualDistance('--');
        setCoilLLSStatus(false);

        // Reset all control states when disconnected
        setControls({
          homing: false,
          clamp: false,
          insertion: false,
          retraction: false
        });
      } else {
        setShowConnectionError(false);
      }
    };

    window.addEventListener('modbus-status-change', handleModbusStatusChange);

    // Listen for power status updates
    const handlePowerStatusChange = (event) => {
      setPowerActive(event.detail === true);
    };
    window.addEventListener('power-status-change', handlePowerStatusChange);

    // Initial power status check
    window.api.checkPowerStatus().then(status => {
      setPowerActive(status.active);
    }).catch(err => console.error('Error checking initial power status:', err));

    // Cleanup function
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('modbus-status-change', handleModbusStatusChange);
      window.removeEventListener('power-status-change', handlePowerStatusChange);

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
      const isLLSTrue = status === 'true' || status === true;

      console.log(`🔄 COIL_LLS Event Received: ${isLLSTrue ? 'TRUE' : 'FALSE'}`);

      setCoilLLSStatus(isLLSTrue);

      if (isLLSTrue) {
        setControls(prev => ({
          ...prev,
          homing: false,
          retraction: false
        }));
        setGraphData([]);
        console.log("✅ Home position reached - Retraction stopped (via event)");
      }

      if (!isLLSTrue) {
        console.log("🔄 Motor moved away from home - COIL_LLS is FALSE");
      }
    };

    const handleCustomEvent = (event, status) => {
      console.log("📡 Received LLS status:", status);
      handleLLSStatusChange(status);
    };

    window.electron?.receive?.('lls-status', handleCustomEvent) ||
      window.api?.onLlsStatus?.(handleCustomEvent);

    const handleWindowEvent = (e) => {
      if (e.detail !== undefined) {
        handleLLSStatusChange(e.detail);
      }
    };

    window.addEventListener('lls-status-change', handleWindowEvent);

    console.log("✅ COIL_LLS monitoring setup complete");

    return () => {
      console.log("🧹 Cleaning up COIL_LLS monitoring");
      window.removeEventListener('lls-status-change', handleWindowEvent);
    };
  }, []);

  // Handle Clamp toggle
  const handleClampToggle = () => {
    window.api.checkConnection()
      .then(status => {
        if (!status.connected) {
          alert('PLC is not connected. Please connect to PLC first.');
          setShowConnectionError(true);
          return;
        }

        window.api.clamp()
          .then(result => {
            if (result && result.success) {
              setControls(prev => ({ ...prev, clamp: !prev.clamp }));
              console.log('Clamp toggled:', result);
            } else {
              throw new Error(result?.message || 'Clamp operation failed');
            }
          })
          .catch(error => {
            console.error('Clamp control error:', error.message);
            setShowConnectionError(true);
          });
      })
      .catch(error => {
        console.error('Connection check error:', error);
      });
  };

  // Handle Insertion (Forward) - Toggle behavior based on PLC state
  const handleInsertion = () => {
    window.api.checkConnection()
      .then(status => {
        if (!status.connected) {
          alert('PLC is not connected. Please connect to PLC first.');
          setShowConnectionError(true);
          return;
        }

        // If insertion is currently active in UI, we want to turn it OFF
        if (controls.insertion) {
          console.log('Attempting to STOP insertion...');

          // Call insertion API again - according to main.js, this will toggle it OFF
          window.api.insertion()
            .then(result => {
              console.log('Insertion stop result:', result);
              if (result && result.success) {
                // Update UI state based on the result from PLC
                setControls(prev => ({
                  ...prev,
                  insertion: false,  // The API toggles to OFF
                  retraction: false   // Ensure retraction is off
                }));
                console.log('Insertion stopped by user');
              }
            })
            .catch(error => {
              console.error('Insertion stop error:', error);
              setShowConnectionError(true);
            });
        }
        // If insertion is not active AND retraction is not active, turn it ON
        else if (!controls.retraction) {
          console.log('Attempting to START insertion...');
          window.api.insertion()
            .then(result => {
              console.log('Insertion start result:', result);
              if (result && result.success) {
                // According to main.js, when insertion turns ON, it sets retraction to false
                setControls(prev => ({
                  ...prev,
                  insertion: true,   // The API toggles to ON
                  retraction: false   // PLC ensures retraction is off
                }));
                console.log('Insertion started by user');
              }
            })
            .catch(error => {
              console.error('Insertion start error:', error);
              setShowConnectionError(true);
            });
        }
        // If retraction is active, show a message (button should be disabled, but just in case)
        else {
          console.log('Cannot start insertion while retraction is active');
          alert('Please stop retraction first by pressing the Retraction button again');
        }
      })
      .catch(error => {
        console.error('Connection check error:', error);
      });
  };

  // Handle Retraction (Backward) - Toggle behavior based on PLC state
  const handleRetraction = () => {
    window.api.checkConnection()
      .then(status => {
        if (!status.connected) {
          alert('PLC is not connected. Please connect to PLC first.');
          setShowConnectionError(true);
          return;
        }

        // If retraction is currently active in UI, we want to turn it OFF
        if (controls.retraction) {
          console.log('Attempting to STOP retraction...');

          // Call retraction API again - according to main.js, this will toggle it OFF
          window.api.ret()
            .then(result => {
              console.log('Retraction stop result:', result);
              if (result && result.success) {
                // Update UI state based on the result from PLC
                setControls(prev => ({
                  ...prev,
                  retraction: false,  // The API toggles to OFF
                  insertion: false     // Ensure insertion is off
                }));
                console.log('Retraction stopped by user');
              }
            })
            .catch(error => {
              console.error('Retraction stop error:', error);
              setShowConnectionError(true);
            });
        }
        // If retraction is not active AND insertion is not active, turn it ON
        else if (!controls.insertion) {
          console.log('Attempting to START retraction...');
          window.api.ret()
            .then(result => {
              console.log('Retraction start result:', result);
              if (result && result.success) {
                // According to main.js, when retraction turns ON, it sets insertion to false
                setControls(prev => ({
                  ...prev,
                  retraction: true,   // The API toggles to ON
                  insertion: false     // PLC ensures insertion is off
                }));
                console.log('Retraction started by user');
              }
            })
            .catch(error => {
              console.error('Retraction start error:', error);
              setShowConnectionError(true);
            });
        }
        // If insertion is active, show a message (button should be disabled, but just in case)
        else {
          console.log('Cannot start retraction while insertion is active');
          alert('Please stop insertion first by pressing the Insertion button again');
        }
      })
      .catch(error => {
        console.error('Connection check error:', error);
      });
  };

  // Emergency stop - reset both states
  const emergencyStop = () => {
    console.log('EMERGENCY STOP triggered');

    // First, if insertion is active, turn it off
    if (controls.insertion) {
      window.api.insertion()
        .then(() => {
          setControls(prev => ({ ...prev, insertion: false }));
        })
        .catch(e => console.log('Insertion stop error:', e));
    }

    // If retraction is active, turn it off
    if (controls.retraction) {
      window.api.ret()
        .then(() => {
          setControls(prev => ({ ...prev, retraction: false }));
        })
        .catch(e => console.log('Retraction stop error:', e));
    }
  };

  // Stop all movement
  const stopAllMovement = () => {
    window.api.checkConnection()
      .then(status => {
        if (!status.connected) return;

        // Turn off both insertion and retraction if they're active
        if (controls.insertion) {
          window.api.insertion().catch(error => console.error('Error turning off insertion:', error));
        }
        if (controls.retraction) {
          window.api.ret().catch(error => console.error('Error turning off retraction:', error));
        }

        setControls(prev => ({
          ...prev,
          insertion: false,
          retraction: false
        }));
      })
      .catch(error => console.error('Connection check error:', error));
  };

  const resetCatheter = () => {
    window.api.checkConnection()
      .then(status => {
        if (!status.connected) {
          alert('PLC is not connected. Please connect to PLC first.');
          setShowConnectionError(true);
          return;
        }

        // Stop all movement before homing
        stopAllMovement();

        setGraphData([]);
        setControls(prev => ({ ...prev, homing: true }));
        setCatheterPosition(0);

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
          });
      })
      .catch(error => {
        console.error('Connection check error:', error);
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

  // Read PLC data periodically
  useEffect(() => {
    const readData = () => {
      window.api.readData()
        .then(data => {
          if (data.success) {
            setForce(data.force_mN);

            const maxDistance = 1000;
            const positionPercent = Math.min(100, (data.distance / maxDistance) * 100);
            setCatheterPosition(positionPercent);
            setManualDistance(data.manualDistance || 0);

            // Hardware-backed state synchronization for control labels/colors
            setControls(prev => ({
              ...prev,
              clamp: data.clamp !== undefined ? Boolean(data.clamp) : prev.clamp,
              insertion: data.insertion !== undefined ? Boolean(data.insertion) : prev.insertion,
              retraction: data.retraction !== undefined ? Boolean(data.retraction) : prev.retraction
            }));

            if (data.coilLLS !== undefined) {
              const newCoilLLSStatus = Boolean(data.coilLLS);
              setCoilLLSStatus(newCoilLLSStatus);

              if (newCoilLLSStatus) {
                setControls(prev => ({
                  ...prev,
                  homing: false,
                  retraction: false
                }));
              }
            }

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
            setForce('--');
            setManualDistance('--');
            setCoilLLSStatus(false);
          }
        })
        .catch(error => {
          console.error('Error reading PLC data:', error);
          setForce('--');
          setManualDistance('--');
          setCoilLLSStatus(false);
        });
    };

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
          stopAllMovement();
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

  const isHomingButtonDisabled = !connectionStatus.connected || controls.homing || coilLLSStatus;

  // Movement disabled conditions:
  // - No connection OR homing in progress
  const isMovementDisabled = !connectionStatus.connected || controls.homing;

  // Individual button disabled conditions:
  // Insertion button disabled when: 
  // 1. Movement is globally disabled
  // 2. Retraction is currently active
  const isInsertionDisabled = isMovementDisabled || controls.retraction;

  // Retraction button disabled when:
  // 1. Movement is globally disabled
  // 2. Insertion is currently active
  const isRetractionDisabled = isMovementDisabled || controls.insertion;

  const handleBack = async () => {
    try {
      const status = await window.api.checkConnection();
      if (!status.connected) {
        const confirmLeave = window.confirm("PLC is not connected. Are you sure you want to leave manual mode?");
        if (confirmLeave) {
          window.history.back();
        }
        return;
      }

      // If homing is currently running, block exit and show prompt
      if (controls.homing) {
        setShowHomingPrompt(true);
        return;
      }

      // Verify latest X0 bit (COIL_LLS) state
      let isHomed = coilLLSStatus;
      try {
        const data = await window.api.readData();
        if (data && data.success && data.coilLLS !== undefined) {
          isHomed = Boolean(data.coilLLS);
          setCoilLLSStatus(isHomed);
        }
      } catch (err) {
        console.warn("Could not read immediate PLC data, using last known state:", err);
      }

      // If X0 bit is False, user cannot leave manual mode
      if (!isHomed) {
        setShowHomingPrompt(true);
        return;
      }

      // If X0 bit is True, user can leave manual mode
      stopAllMovement();
      await window.api.disableManualMode().catch(error => console.error('Disable error:', error));
      window.history.back();
    } catch (error) {
      console.error('Connection check error:', error);
      if (!coilLLSStatus) {
        setShowHomingPrompt(true);
      } else {
        window.history.back();
      }
    }
  };

  const handleExit = () => {
    disableManualMode();
  };

  return (
    <div
      className="w-full bg-slate-50"
      style={{
        height: '100vh',
        maxHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        padding: '0',
        gap: '0'
      }}
    >
            {/* Header (copied from Load Configuration design) */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0"
        style={{ flex: '0 0 auto' }}
      >
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200"
            title="Back"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Manual Mode
          </h1>
        </div>
        <div className="flex items-center space-x-2 lg:space-x-4">
          {/* Power Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${powerActive ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
            <Power className="w-4 h-4" />
            <span className="text-sm font-medium">
              POWERED {powerActive ? 'ON' : 'OFF'}
            </span>
          </div>
          {/* USB Connection Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${connectionStatus.connected ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
            <Usb className="w-4 h-4" />
            <span className="text-sm font-medium">
              {connectionStatus.connected ? 'USB Connected' : 'USB Disconnected'}
            </span>
          </div>
          {/* Reconnect button when disconnected */}
          {!connectionStatus.connected && (
            <button
              onClick={handleReconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Reconnect
            </button>
          )}
          {/* Power Button */}
          <button
            onClick={() => {
              const confirmed = window.confirm("Are you sure you want to exit?");
              if (confirmed) {
                handleExit();
                window.close();
              }
            }}
            className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-2xl w-14 h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl border border-red-400/30"
            title="Exit"
          >
            <Power className="w-6 h-6 group-hover:scale-110 transition-transform duration-300" />
          </button>
        </div>
      </div>

      {/* Content Area (below header): flex: 1; min-height: 0; display: grid; */}
      <div
        style={{
          flex: '1 1 0%',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 340px',
          gridTemplateRows: 'minmax(0, 1fr)',
          gap: '12px',
          padding: '12px 20px',
          boxSizing: 'border-box'
        }}
      >
        {/* Left Column: Distance vs Force Chart Card */}
        <div
          className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between shadow-xs"
          style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}
        >
          {/* Graph Header */}
          <div className="flex items-start justify-between mb-2 shrink-0">
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Distance vs Force</h2>
              <p className="text-xs text-slate-500 mt-0.5">Real-time analysis</p>
            </div>

            {/* Legend */}
            <div className="flex items-center space-x-4 text-xs font-medium text-slate-600">
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-1 bg-blue-500 rounded-full inline-block" />
                <span>Insertion</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-4 h-1 bg-red-500 rounded-full inline-block" />
                <span>Retraction</span>
              </div>
            </div>
          </div>

          {/* Chart Body Wrapper: flex: 1; min-height: 0; position: relative; */}
          <div
            style={{ flex: '1 1 0%', minHeight: 0, position: 'relative', width: '100%' }}
            onMouseLeave={() => {
              if (chartRef.current) {
                chartRef.current.setActiveElements([]);
                chartRef.current.tooltip?.setActiveElements([], { x: 0, y: 0 });
                chartRef.current.update();
              }
            }}
          >
            <Line
              ref={chartRef}
              data={chartConfig}
              options={chartOptions}
              redraw={false}
            />
          </div>
        </div>

        {/* Right Column: display: flex; flex-direction: column; gap: 12px; min-height: 0; */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minHeight: 0,
            height: '100%'
          }}
        >
          {/* a) Top row: display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              flex: '1 1 0%',
              minHeight: 0
            }}
          >
            {/* Clamp Control Card */}
            <div
              className="bg-white border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs"
              style={{ padding: '10px 14px', minHeight: 0, gap: '4px' }}
            >
              <div>
                <h3 className="font-bold text-slate-900 text-[15px] leading-tight">Clamp control</h3>
                <p className="text-[12px] text-slate-500 leading-tight mt-0.5">Toggle on/off</p>
              </div>

              <button
                onClick={handleClampToggle}
                disabled={!connectionStatus.connected || controls.homing}
                className={`rounded-full border flex items-center justify-center transition-all shadow-xs my-1 ${
                  !connectionStatus.connected || controls.homing
                    ? 'bg-slate-50 border-slate-200 opacity-40 cursor-not-allowed'
                    : controls.clamp
                      ? 'border-purple-500 bg-purple-50 text-purple-600 ring-2 ring-purple-200'
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 active:scale-95'
                }`}
                style={{ width: 'clamp(48px, 9vh, 80px)', height: 'clamp(48px, 9vh, 80px)' }}
              >
                <img
                  src={clampIcon}
                  alt="Clamp"
                  className={`w-5 h-5 sm:w-6 sm:h-6 object-contain transition-all ${
                    controls.clamp ? 'brightness-90' : 'opacity-70'
                  }`}
                />
              </button>

              <span
                className={`text-[11px] font-bold tracking-wider uppercase ${
                  controls.clamp ? 'text-purple-600' : 'text-slate-700'
                }`}
              >
                {controls.clamp ? 'CLAMPED' : 'UNCLAMPED'}
              </span>
            </div>

            {/* Homing Control Card */}
            <div
              className="bg-white border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs"
              style={{ padding: '10px 14px', minHeight: 0, gap: '4px' }}
            >
              <div>
                <h3 className="font-bold text-slate-900 text-[15px] leading-tight">Homing control</h3>
                <p className="text-[12px] text-slate-500 leading-tight mt-0.5">Reset position</p>
              </div>

              <button
                onClick={resetCatheter}
                disabled={isHomingButtonDisabled}
                className={`rounded-full border flex items-center justify-center transition-all shadow-xs my-1 ${
                  isHomingButtonDisabled
                    ? 'bg-slate-50 border-slate-200 opacity-40 cursor-not-allowed'
                    : controls.homing
                      ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-200'
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 active:scale-95'
                }`}
                style={{ width: 'clamp(48px, 9vh, 80px)', height: 'clamp(48px, 9vh, 80px)' }}
              >
                <RotateCw
                  className={`w-5 h-5 sm:w-6 sm:h-6 text-slate-700 ${
                    controls.homing ? 'animate-spin text-blue-600' : ''
                  }`}
                />
              </button>

              <span
                className={`text-[11px] font-bold tracking-wider uppercase ${
                  controls.homing ? 'text-blue-600' : 'text-slate-700'
                }`}
              >
                {controls.homing ? 'HOMING ACTIVE' : coilLLSStatus ? 'AT HOME' : 'READY'}
              </span>
            </div>
          </div>

          {/* b) Movement Control Card: flex: 1; min-height: 0 */}
          <div
            className="bg-white border border-slate-200/90 rounded-2xl flex flex-col items-center justify-center text-center shadow-xs"
            style={{
              padding: '10px 14px',
              flex: '1 1 0%',
              minHeight: 0,
              gap: '4px'
            }}
          >
            <div>
              <h3 className="font-bold text-slate-900 text-[15px] leading-tight">Movement control</h3>
            </div>

            <div className="flex items-center justify-center space-x-4 my-1">
              {/* Retraction (Left Arrow) */}
              <button
                onClick={handleRetraction}
                disabled={isRetractionDisabled}
                className={`rounded-full border flex items-center justify-center transition-all shadow-xs ${
                  isRetractionDisabled
                    ? 'bg-slate-50 border-slate-200 opacity-40 cursor-not-allowed'
                    : controls.retraction
                      ? 'border-red-500 bg-red-50 text-red-600 ring-2 ring-red-200'
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 active:scale-95'
                }`}
                style={{ width: 'clamp(48px, 9vh, 80px)', height: 'clamp(48px, 9vh, 80px)' }}
                title="Retract Backward"
              >
                <ChevronLeft className="w-6 h-6 stroke-[2.2]" />
              </button>

              {/* Insertion (Right Arrow) */}
              <button
                onClick={handleInsertion}
                disabled={isInsertionDisabled}
                className={`rounded-full border flex items-center justify-center transition-all shadow-xs ${
                  isInsertionDisabled
                    ? 'bg-slate-50 border-slate-200 opacity-40 cursor-not-allowed'
                    : controls.insertion
                      ? 'border-blue-500 bg-blue-50 text-blue-600 ring-2 ring-blue-200'
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 active:scale-95'
                }`}
                style={{ width: 'clamp(48px, 9vh, 80px)', height: 'clamp(48px, 9vh, 80px)' }}
                title="Insert Forward"
              >
                <ChevronRight className="w-6 h-6 stroke-[2.2]" />
              </button>
            </div>

            <span
              className={`text-[11px] font-bold tracking-wider uppercase ${
                controls.insertion || controls.retraction ? 'text-blue-600' : 'text-slate-700'
              }`}
            >
              {controls.insertion
                ? 'INSERTING FORWARD'
                : controls.retraction
                  ? 'RETRACTING BACKWARD'
                  : 'STATIONARY'}
            </span>
          </div>

          {/* c) Force / Distance Stats Card: flex: 0 0 auto */}
          <div
            className="bg-white border border-slate-200/90 rounded-2xl grid grid-cols-2 divide-x divide-slate-200 items-center shadow-xs"
            style={{
              padding: '10px 14px',
              flex: '0 0 auto'
            }}
          >
            <div className="text-center px-2">
              <p className="text-[12px] text-slate-500 font-medium leading-none mb-1">Force</p>
              <p className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                {force === '--' ? '0.00 mN' : `${parseFloat(force).toFixed(2)} mN`}
              </p>
            </div>
            <div className="text-center px-2">
              <p className="text-[12px] text-slate-500 font-medium leading-none mb-1">Distance</p>
              <p className="text-xl font-bold text-slate-900 tracking-tight leading-none">
                {manualDistance === '--' ? '0 mm' : `${manualDistance} mm`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Homing Required Prompt Modal */}
      {showHomingPrompt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center border border-amber-200">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-2">Homing Required</h3>
            <p className="text-slate-600 font-medium mb-6">
              Perform homing before leaving the manual mode
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowHomingPrompt(false)}
                className="flex-1 px-4 py-2.5 border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowHomingPrompt(false);
                  resetCatheter();
                }}
                disabled={controls.homing}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <RotateCw className={`w-4 h-4 ${controls.homing ? 'animate-spin' : ''}`} />
                <span>Perform Homing</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Manual;
