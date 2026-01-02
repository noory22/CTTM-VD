import React, { useState, useEffect } from 'react';
import { ArrowLeft, Power, ChevronDown, FileText, X, Trash2, Calendar, Clock, TrendingUp, Info, Thermometer, Ruler, AlertCircle, Gauge, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { useNavigate } from 'react-router-dom';

const ProcessLogs = () => {
  const navigate = useNavigate();
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [graphData, setGraphData] = useState([]);

  useEffect(() => {
    loadLogFiles();
  }, []);

  const loadLogFiles = async () => {
    try {
      setIsLoading(true);
      const logFiles = await window.api.getLogFiles();
      setLogFiles(logFiles);
    } catch (error) {
      console.error('Error loading log files:', error);
      alert('Error loading log files: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };



  const handleLogSelection = async (log) => {
    try {
      setIsLoading(true);
      
      // Read the actual CSV file data
      const result = await window.api.readLogFile(log.filePath);
      
      if (result.success) {
        // Use the config data from CSV
        const configData = result.configData;
        // ----------------------------------
        let prevDistance = null;
        let phase = 'insertion';
        const processedData = result.data.map((point, index) => {
          const d = Number(point.distance);
          const f = Number(point.force);

          // Detect first true decrease -> switch permanently to retraction
          if (prevDistance !== null && phase === 'insertion') {
            // treat equal distance as same phase (plateau), only strict decrease switches
            if (d < prevDistance) phase = 'retraction';
          }
          prevDistance = d;

          return {
            ...point,
            time: index,

            // ✅ X axis remains distance
            distance: d,

            // ✅ Y axis remains force
            // Split FORCE into two series so we can color phases
            forceInsertion: phase === 'insertion' ? f : null,
            forceRetraction: phase === 'retraction' ? f : null,
          };
        });
        // Process graph data
        // const processedData = result.data.map((point, index) => ({
        //   ...point,
        //   time: index,
        //   forceN: point.force, 
        //   distanceMm: point.distance 
        // }));

        
        setGraphData(processedData);
        setSelectedLog({
          ...log,
          processData: processedData,
          configData: configData,
          rawData: result.rawData
        });
      } else {
        alert('Error reading log file: ' + result.error);
      }
    } catch (error) {
      console.error('Error selecting log:', error);
      alert('Error reading log file');
    } finally {
      setIsLoading(false);
      setShowDropdown(false);
    }
  };

  const handleDeleteLog = async (logToDelete = null) => {
    const targetLog = logToDelete || selectedLog;
    if (!targetLog) return;

    setIsLoading(true);
    
    try {
      const result = await window.api.deleteLogFile(targetLog.filePath);
      
      if (result.success) {
        // Remove from log files
        const updatedLogs = logFiles.filter(log => log.filename !== targetLog.filename);
        setLogFiles(updatedLogs);
        
        // Reset selection if deleted log was selected
        if (selectedLog && selectedLog.filename === targetLog.filename) {
          setSelectedLog(null);
          setGraphData([]);
        }
        
        setShowDeleteConfirm(false);
        setShowSuccessMessage(true);
        
        // Auto hide success message after 2 seconds
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 2000);
      } else {
        alert('Error deleting log file: ' + result.error);
      }
      
    } catch (error) {
      console.error('Error deleting log file:', error);
      alert('Error deleting log file. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAllLogs = async () => {
    setIsLoading(true);
    
    try {
      // Delete all log files one by one
      const deletePromises = logFiles.map(log => 
        window.api.deleteLogFile(log.filePath)
      );
      
      await Promise.all(deletePromises);
      
      setLogFiles([]);
      setSelectedLog(null);
      setGraphData([]);
      setShowDeleteAllConfirm(false);
      setShowSuccessMessage(true);
      
      // Auto hide success message after 2 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error deleting all log files:', error);
      alert('Error deleting log files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateStr, timeStr) => {
    try {
      if (!dateStr || !timeStr) return '--';

      // Parse date string like "Jan 2, 2026"
      const baseDate = new Date(dateStr);
      if (isNaN(baseDate.getTime())) return '--';

      // Parse time "HH-MM-SS"
      const [hours, minutes, seconds] = timeStr.split('-').map(Number);

      baseDate.setHours(hours, minutes, seconds || 0);

      return baseDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '--';
    }
  };



  // const formatTime = (timeStr) => {
  //   try {
  //     // Convert ISO timestamp to readable time
  //     const date = new Date(timeStr.replace(/-/g, ':'));
  //     return date.toLocaleTimeString('en-US', { 
  //       hour: '2-digit', 
  //       minute: '2-digit',
  //       second: '2-digit'
  //     });
  //   } catch (e) {
  //     return timeStr;
  //   }
  // };

  const renderCurveReferenceLines = () => {
    if (!selectedLog?.configData?.curveDistances) return null;
    
    const curveDistances = selectedLog.configData.curveDistances;

    return Object.entries(curveDistances).map(([curveName, distance]) => (
      <ReferenceLine
        key={curveName}
        x={parseFloat(distance)}
        stroke="#ef4444"
        strokeWidth={2}
        strokeDasharray="4 4"
        label={{
          value: `Curve ${curveName}`,
          position: 'top',
          fill: '#ef4444',
          fontSize: 12
        }}
      />
    ));
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6 ${(showDeleteConfirm || showDeleteAllConfirm || showSuccessMessage) ? 'backdrop-blur-sm' : ''}`}>
      <div className="w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate('/main-menu')} 
              className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Process Logs</h1>
          </div>
          <div className="flex items-center space-x-2 lg:space-x-3">
            {/* Help Button */}
            <button 
              onClick={() => setShowHelpModal(true)}
              className="group bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl lg:rounded-2xl w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl border border-blue-400/30"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:scale-110 transition-transform duration-300" />
            </button>
            <button
              onClick={() => {
                const confirmed = window.confirm("Are you sure you want to exit?");
                if (confirmed) {
                  window.close();
                }
              }}
              className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl lg:rounded-2xl w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl border border-red-400/30 flex-shrink-0"
            >
              <Power className="w-3 h-3 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:scale-110 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Left Panel - Log Selection & Config Info */}
          <div className="xl:col-span-1 space-y-6">
            {/* Log File Selector */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4 text-left flex items-center justify-between hover:from-blue-100 hover:to-blue-150 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-800">Select Log File</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-blue-600 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-xl z-50 max-h-80 overflow-y-auto">
                    {logFiles.length === 0 ? (
                      <div className="p-6 text-center text-slate-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No log files found</p>
                        <p className="text-sm mt-1">Process logs will appear here after running tests</p>
                      </div>
                    ) : (
                      logFiles.map((log) => (
                        <button
                          key={log.filename}
                          onClick={() => handleLogSelection(log)}
                          className="w-full p-4 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors duration-150 focus:outline-none focus:bg-blue-50"
                        >
                          <div>
                            <p className="font-medium text-slate-800">{log.displayName}</p>
                            <div className="flex items-center space-x-4 mt-1 text-xs text-slate-500">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatDate(log.date)}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                {/* <span>{formatTime(log.time)}</span> */}
                                <span>{formatTime(log.date, log.time)}</span>

                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Log Info */}
              {selectedLog && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span className="text-green-800 font-medium">Selected Log:</span>
                  </div>
                  <p className="text-green-700 text-sm font-medium">{selectedLog.displayName}</p>
                  <div className="flex items-center space-x-3 mt-2 text-xs text-green-600">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(selectedLog.date)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      {/* <span>{formatTime(selectedLog.time)}</span> */}
                      <span>{formatTime(selectedLog.date, selectedLog.time)}</span>

                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Configuration Details Panel */}
            {selectedLog && selectedLog.configData && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>Configuration Details</span>
                </h3>
                
                <div className="space-y-4">
                  {/* Config Name */}
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center space-x-2 mb-1">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <p className="text-slate-700 text-sm font-medium">Configuration Name</p>
                    </div>
                    <p className="text-blue-700 font-bold text-lg">
                      {selectedLog.configData.configName || 'Unknown'}
                    </p>
                  </div>

                  {/* Main Parameters Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Path Length */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 border border-green-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <Ruler className="w-4 h-4 text-green-600" />
                        <p className="text-slate-600 text-xs font-medium">Path Length</p>
                      </div>
                      <p className="text-green-700 font-bold">
                        {selectedLog.configData.pathlength || '--'} mm
                      </p>
                    </div>

                    {/* Threshold Force */}
                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-3 border border-cyan-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <Gauge className="w-4 h-4 text-blue-600" />
                        <p className="text-slate-600 text-xs font-medium">Threshold Force</p>
                      </div>
                      <p className="text-blue-700 font-bold">
                        {selectedLog.configData.thresholdForce || '--'} mN
                      </p>
                    </div>

                    {/* Temperature */}
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-3 border border-orange-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <Thermometer className="w-4 h-4 text-orange-600" />
                        <p className="text-slate-600 text-xs font-medium">Temperature</p>
                      </div>
                      <p className="text-orange-700 font-bold">
                        {selectedLog.configData.temperature || '--'} °C
                      </p>
                    </div>

                    {/* Retraction Length */}
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <RotateCcw className="w-4 h-4 text-purple-600" />
                        <p className="text-slate-600 text-xs font-medium">Retraction Length</p>
                      </div>
                      <p className="text-purple-700 font-bold">
                        {selectedLog.configData.retractionLength || '--'} mm
                      </p>
                    </div>
                  </div>

                  {/* Number of Curves */}
                  {selectedLog.configData.numberOfCurves && selectedLog.configData.numberOfCurves !== '--' && (
                    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-4 border border-yellow-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <p className="text-slate-700 text-sm font-medium">Number of Curves</p>
                      </div>
                      <p className="text-yellow-700 font-bold text-lg">
                        {selectedLog.configData.numberOfCurves}
                      </p>
                    </div>
                  )}

                  {/* Curve Distances */}
                  {selectedLog.configData.curveDistances && 
                   Object.keys(selectedLog.configData.curveDistances).length > 0 && (
                    <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-4 border border-red-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-red-600" />
                        <p className="text-slate-700 text-sm font-medium">Curve Distances</p>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(selectedLog.configData.curveDistances).map(([curveName, distance]) => (
                          <div key={curveName} className="flex justify-between items-center bg-white/50 rounded-lg p-2">
                            <span className="text-slate-700 text-sm font-medium">Curve {curveName}</span>
                            <span className="text-red-600 font-bold">{distance} mm</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Delete Buttons */}
            <div className="space-y-3">
              <button
                onClick={() => {
                  if (selectedLog) {
                    setDeleteTarget(selectedLog);
                    setShowDeleteConfirm(true);
                  } else {
                    alert('Please select a log file to delete.');
                  }
                }}
                disabled={!selectedLog || isLoading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl disabled:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Selected</span>
              </button>

              <button
                onClick={() => {
                  if (logFiles.length > 0) {
                    setShowDeleteAllConfirm(true);
                  } else {
                    alert('No log files to delete.');
                  }
                }}
                disabled={logFiles.length === 0 || isLoading}
                className="w-full bg-red-700 hover:bg-red-800 disabled:bg-red-400 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl disabled:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete All Logs</span>
              </button>
            </div>
          </div>

          {/* Right Panel - Graph and Data */}
          <div className="xl:col-span-3 space-y-6">
            {/* Force vs Distance Graph */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">Force vs Distance Analysis</h2>
                    <p className="text-slate-600 text-sm">Recorded during process execution</p>
                  </div>
                </div>
                {selectedLog && (
                  <div className="text-sm text-slate-500">
                    Total data points: {graphData.length}
                  </div>
                )}
              </div>

              {selectedLog ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={graphData} 
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="distance" 
                        stroke="#64748b"
                        label={{ 
                          value: 'Distance (mm)', 
                          position: 'insideBottom', 
                          offset: -10,
                          style: { fill: '#64748b', fontWeight: 'bold' }
                        }}
                      />
                      <YAxis 
                        stroke="#64748b"
                        label={{ 
                          value: 'Force (N)', 
                          angle: -90, 
                          position: 'insideLeft',
                          style: { fill: '#64748b', fontWeight: 'bold' }
                        }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '2px solid #e2e8f0',
                          borderRadius: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          padding: '12px'
                        }}
                        formatter={(value, name) => {
                          if (name === 'force') {
                            return [`${value.toFixed(3)} mN`, 'Force'];
                          } else if (name === 'distance') {
                            return [`${value} mm`, 'Distance'];
                          }
                          return [value, name];
                        }}
                        labelFormatter={(label) => `Distance: ${label} mm`}
                      />



                      {renderCurveReferenceLines()}
                      {/* <Line 
                        type="monotone" 
                        dataKey="force" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                        name="Force (N)"
                      /> */}
                      {/* Force during insertion (green) */}
                      <Line
                        type="linear"
                        dataKey="forceInsertion"
                        stroke="#22c55e"
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                        name="Force (Insertion)"
                      />

                      {/* Force during retraction (red) */}
                      <Line
                        type="linear"
                        dataKey="forceRetraction"
                        stroke="#ef4444"
                        strokeWidth={3}
                        dot={false}
                        isAnimationActive={false}
                        name="Force (Retraction)"
                      />



                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-dashed border-slate-200">
                  <div className="text-center text-slate-500">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium text-slate-600">Select a log file to view analysis</p>
                    <p className="text-sm mt-2 text-slate-500">Force vs Distance graph will be displayed here</p>
                  </div>
                </div>
              )}

              {/* Graph Statistics */}
              {selectedLog && graphData.length > 0 && (
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                    <p className="text-blue-700 text-sm font-medium mb-1">Max Force</p>
                    <p className="text-blue-800 font-bold text-lg">
                      {Math.max(...graphData.map(d => d.force)).toFixed(3)} mN
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                    <p className="text-green-700 text-sm font-medium mb-1">Max Distance</p>
                    <p className="text-green-800 font-bold text-lg">
                      {Math.max(...graphData.map(d => d.distance)).toFixed(1)} mm
                    </p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                    <p className="text-purple-700 text-sm font-medium mb-1">Data Points</p>
                    <p className="text-purple-800 font-bold text-lg">{graphData.length}</p>
                  </div>
                  <div className="bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
                    <p className="text-amber-700 text-sm font-medium mb-1">Avg Force</p>
                    <p className="text-amber-800 font-bold text-lg">
                      {(graphData.reduce((sum, d) => sum + d.force, 0) / graphData.length).toFixed(3)} mN
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Raw Data Preview */}
            {selectedLog && (
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Sample Data Preview</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="p-3 text-left text-slate-700 font-medium">Time Index</th>
                        <th className="p-3 text-left text-slate-700 font-medium">Distance (mm)</th>
                        <th className="p-3 text-left text-slate-700 font-medium">Force (mN)</th>
                        <th className="p-3 text-left text-slate-700 font-medium">Temperature (°C)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {graphData.slice(0, 5).map((row, index) => (
                        <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 text-slate-600">{row.time}</td>
                          <td className="p-3 text-blue-600 font-medium">{row.distance.toFixed(1)}</td>
                          <td className="p-3 text-green-600 font-medium">{row.force.toFixed(3)}</td>
                          <td className="p-3 text-orange-600 font-medium">
                            {row.temperature ? row.temperature.toFixed(1) : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {graphData.length > 5 && (
                  <p className="text-slate-500 text-sm mt-3 text-center">
                    Showing first 5 of {graphData.length} data points
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Confirm Deletion</h3>
            </div>
            
            <p className="text-slate-600 mb-2">Are you sure you want to delete this log file?</p>
            <p className="text-slate-800 font-medium mb-6">"{deleteTarget?.displayName}"</p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLog(deleteTarget)}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">Delete All Logs</h3>
            </div>
            
            <p className="text-slate-600 mb-2">Are you sure you want to delete all log files?</p>
            <p className="text-red-600 font-medium mb-6">This action cannot be undone and will permanently remove all {logFiles.length} log files.</p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAllLogs}
                disabled={isLoading}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete All</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Message Modal */}
      {showSuccessMessage && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800">Success!</h3>
            </div>
            
            <p className="text-slate-600 mb-6">Log file deleted successfully!</p>
            
            <button
              onClick={() => setShowSuccessMessage(false)}
              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-2xl max-w-md lg:max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Info className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg lg:text-xl font-bold text-blue-900">Process Logs Guide</h3>
                </div>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-blue-600" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-96">
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      <span className="font-semibold">Process Logs are automatically generated</span> after each test run and saved as CSV files.
                    </p>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      Each log contains complete test data including <span className="font-semibold">force, distance, temperature, and configuration details</span>.
                    </p>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      The graph shows <span className="font-semibold">Force vs Distance</span> with curve markers indicating where each curve occurred during the test.
                    </p>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      Configuration details shown are exactly what was used during the test, including curve distances if configured.
                    </p>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      <span className="font-semibold">Warning:</span> Deleted logs cannot be recovered. Always backup important data.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessLogs;
