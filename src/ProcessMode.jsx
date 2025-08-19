import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Play, Pause, RotateCcw, Power, Camera, Wifi, WifiOff, Activity, Thermometer, Gauge, Ruler } from 'lucide-react';

const ProcessMode = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [sensorData, setSensorData] = useState({
    temperature: '--',
    force: '--',
    distance: '--',
    status: '--'
  });
  const [chartData, setChartData] = useState([]);
  const [isProcessRunning, setIsProcessRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  // Simulate real-time data (replace with actual WebSocket/Serial communication)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isProcessRunning && !isPaused) {
        const currentTime = (Date.now() - startTimeRef.current) / 1000;
        const newForce = Math.sin(currentTime * 0.3) * 80 + 120 + Math.random() * 15;
        const newDistance = Math.cos(currentTime * 0.2) * 30 + 50 + Math.random() * 8;
        const newTemp = 24 + Math.sin(currentTime * 0.1) * 3 + Math.random() * 1.5;

        setSensorData(prev => ({
          ...prev,
          temperature: newTemp.toFixed(1),
          force: Math.max(0, newForce).toFixed(1),
          distance: Math.max(0, newDistance).toFixed(1),
          status: isProcessRunning ? (isPaused ? 'PAUSED' : 'RUNNING') : 'STOPPED'
        }));

        setChartData(prev => {
          const newData = [...prev, {
            time: currentTime.toFixed(1),
            force: parseFloat(Math.max(0, newForce).toFixed(1)),
            distance: parseFloat(Math.max(0, newDistance).toFixed(1))
          }];
          return newData.slice(-60); // Keep last 60 points
        });
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isProcessRunning, isPaused]);

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

  // Protocol communication functions
  const sendCommand = (command) => {
    console.log(`Sending command: ${command}`);
    
    // Simulate response
    setTimeout(() => {
      if (command.includes('*1:1:')) {
        console.log('Received: *PRS:STR#');
        setIsProcessRunning(true);
        setIsPaused(false);
        startTimeRef.current = Date.now();
      } else if (command.includes('*1:2:')) {
        console.log('Received: *PRS:PUS#');
        setIsPaused(true);
      } else if (command.includes('*1:3:')) {
        console.log('Received: *PRS:HOM#');
        setIsProcessRunning(false);
        setIsPaused(false);
        setChartData([]);
        setSensorData(prev => ({ ...prev, status: 'RESET' }));
      }
    }, 100);
  };

  const handleStart = () => {
    const command = '*1:1:xxx:xxx:xxx:xxx#';
    sendCommand(command);
  };

  const handlePause = () => {
    const command = '*1:2:xxx:xxx:xxx:xxx#';
    sendCommand(command);
  };

  const handleReset = () => {
    const command = '*1:3:xxx:xxx:xxx:xxx#';
    sendCommand(command);
  };

  const toggleConnection = () => {
    setIsConnected(!isConnected);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 text-gray-900 overflow-hidden">
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:20px_20px] opacity-50"></div>
      
      {/* Header */}
      <header className="relative bg-white/80 backdrop-blur-xl border-b border-gray-200/80 shadow-lg">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-700 bg-clip-text text-transparent">
                    Catheter Trackability Testing Machine
                  </h1>
                  <p className="text-gray-600 text-sm mt-1">Process Mode - Real-time Monitoring</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-3 px-4 py-2 rounded-xl font-medium transition-all ${
                isConnected 
                  ? 'bg-green-50 text-green-700 border border-green-200 shadow-sm shadow-green-500/10' 
                  : 'bg-red-50 text-red-700 border border-red-200 shadow-sm shadow-red-500/10'
              }`}>
                {isConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                <span className="text-sm font-semibold">
                  {isConnected ? 'CONNECTED' : 'ERROR: NO SERIAL PORT'}
                </span>
              </div>
              
              <button
                onClick={toggleConnection}
                className="p-3 rounded-xl bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 shadow-lg shadow-red-500/25 text-white"
              >
                <Power className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex h-[calc(100vh-100px)]">
        {/* Left Panel - Camera Feed */}
        <section className="flex-1 p-6">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 h-full shadow-xl shadow-gray-200/50">
            <div className="p-6 border-b border-gray-200/80">
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
                  <span className="text-red-600 text-sm font-medium">REC</span>
                </div>
              </div>
            </div>
            
            <div className="p-6 flex-1 flex items-center justify-center h-[calc(100%-88px)]">
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
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm">
                  <span className="text-gray-900 text-xs">1920×1080 • 60fps</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Right Panel - Controls and Data */}
        <section className="flex-1 p-6 flex flex-col space-y-6">
          {/* Sensor Data Cards */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-gray-200/80 p-6 shadow-lg shadow-gray-200/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Thermometer className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Temperature</p>
                    <p className="text-2xl font-bold text-orange-600">{sensorData.temperature}°C</p>
                  </div>
                </div>
                <div className="w-16 h-16 relative">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgb(229 231 235)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgb(234 88 12)"
                      strokeWidth="3"
                      strokeDasharray={`${(parseFloat(sensorData.temperature) || 0) / 50 * 100}, 100`}
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-gray-200/80 p-6 shadow-lg shadow-gray-200/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Gauge className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Force</p>
                    <p className="text-2xl font-bold text-blue-600">{sensorData.force} N</p>
                  </div>
                </div>
                <div className="w-16 h-16 relative">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgb(229 231 235)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgb(37 99 235)"
                      strokeWidth="3"
                      strokeDasharray={`${(parseFloat(sensorData.force) || 0) / 200 * 100}, 100`}
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-gray-200/80 p-6 shadow-lg shadow-gray-200/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Ruler className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Distance</p>
                    <p className="text-2xl font-bold text-green-600">{sensorData.distance} mm</p>
                  </div>
                </div>
                <div className="w-16 h-16 relative">
                  <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgb(229 231 235)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="rgb(34 197 94)"
                      strokeWidth="3"
                      strokeDasharray={`${(parseFloat(sensorData.distance) || 0) / 100 * 100}, 100`}
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-gray-200/80 p-6 shadow-lg shadow-gray-200/30">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-sm ${
                    sensorData.status === 'RUNNING' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                    sensorData.status === 'PAUSED' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' :
                    sensorData.status === 'RESET' ? 'bg-gradient-to-br from-blue-500 to-indigo-500' : 
                    'bg-gradient-to-br from-gray-400 to-gray-500'
                  }`}>
                    <Activity className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-gray-600 text-sm">Status</p>
                    <p className={`text-2xl font-bold ${
                      sensorData.status === 'RUNNING' ? 'text-green-600' :
                      sensorData.status === 'PAUSED' ? 'text-yellow-600' :
                      sensorData.status === 'RESET' ? 'text-blue-600' : 'text-gray-600'
                    }`}>{sensorData.status}</p>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full ${
                  sensorData.status === 'RUNNING' ? 'bg-green-500 animate-pulse' :
                  sensorData.status === 'PAUSED' ? 'bg-yellow-500' :
                  sensorData.status === 'RESET' ? 'bg-blue-500' : 'bg-gray-400'
                }`}></div>
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex space-x-4 justify-center">
            <button
              onClick={handleStart}
              disabled={isProcessRunning && !isPaused}
              className={`group flex items-center space-x-3 px-8 py-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
                isProcessRunning && !isPaused
                  ? 'bg-gray-200 cursor-not-allowed text-gray-500 border border-gray-300'
                  : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-xl shadow-green-500/25 border border-green-400/30'
              }`}
            >
              <Play className="w-6 h-6" />
              <span className="text-lg">START</span>
              <div className="w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
            
            <button
              onClick={handlePause}
              disabled={!isProcessRunning || isPaused}
              className={`group flex items-center space-x-3 px-8 py-4 rounded-xl font-bold transition-all transform hover:scale-105 ${
                !isProcessRunning || isPaused
                  ? 'bg-gray-200 cursor-not-allowed text-gray-500 border border-gray-300'
                  : 'bg-gradient-to-br from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white shadow-xl shadow-yellow-500/25 border border-yellow-400/30'
              }`}
            >
              <Pause className="w-6 h-6" />
              <span className="text-lg">PAUSE</span>
              <div className="w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
            
            <button
              onClick={handleReset}
              className="group flex items-center space-x-3 px-8 py-4 rounded-xl font-bold transition-all transform hover:scale-105 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-xl shadow-red-500/25 border border-red-400/30"
            >
              <RotateCcw className="w-6 h-6" />
              <span className="text-lg">RESET</span>
              <div className="w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </div>

          {/* Real-time Graph */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/80 p-6 flex-1 shadow-xl shadow-gray-200/30">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Real-time Analytics</h2>
                <p className="text-gray-600 text-sm">Force & Distance vs Time</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Force</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">Distance</span>
                </div>
              </div>
            </div>
            
            <div className="h-[calc(100%-80px)]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="forceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="distanceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.7} />
                  <XAxis 
                    dataKey="time" 
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#9ca3af' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#9ca3af' }}
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
                  <Line 
                    type="monotone" 
                    dataKey="force" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    dot={false}
                    name="Force (N)"
                    fill="url(#forceGradient)"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="distance" 
                    stroke="#22c55e" 
                    strokeWidth={3}
                    dot={false}
                    name="Distance (mm)"
                    fill="url(#distanceGradient)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default ProcessMode;