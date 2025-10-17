import React, { useState, useEffect } from 'react';
import { ArrowLeft, Power, AlertCircle, ChevronDown, FileText, X, Trash2, Calendar, Clock, TrendingUp, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';

const ProcessLogs = () => {
  const navigate = useNavigate();
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showSerialError, setShowSerialError] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    loadLogFiles();
  }, []);

  const loadLogFiles = async () => {
    try {
      setIsLoading(true);
      const logFiles = await window.serialAPI.getLogFiles();
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
      const result = await window.serialAPI.readLogFile(log.filePath);
      
      if (result.success) {
        // Extract configuration from CSV file headers
        const configData = extractConfigFromCsv(result.rawData);
        
        setSelectedLog({
          ...log,
          processData: result.data,
          configData: configData
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

  // Helper function to extract config from CSV headers
  const extractConfigFromCsv = (rawData) => {
    const lines = rawData.split('\n');
    const config = {
      configName: 'Unknown',
      distance: '--',
      temperature: '--',
      peakForce: '--'
    };
    
    lines.forEach(line => {
      if (line.startsWith('# Configuration:')) {
        config.configName = line.replace('# Configuration:', '').trim();
      } else if (line.startsWith('# Distance:')) {
        config.distance = line.replace('# Distance:', '').replace('mm', '').trim();
      } else if (line.startsWith('# Temperature:')) {
        config.temperature = line.replace('# Temperature:', '').replace('°C', '').trim();
      } else if (line.startsWith('# Peak Force:')) {
        config.peakForce = line.replace('# Peak Force:', '').replace('N', '').trim();
      }
    });
    
    return config;
  };

  const handleDeleteLog = async (logToDelete = null) => {
    const targetLog = logToDelete || selectedLog;
    if (!targetLog) return;

    setIsLoading(true);
    
    try {
      const result = await window.serialAPI.deleteLogFile(targetLog.filePath);
      
      if (result.success) {
        // Remove from log files
        const updatedLogs = logFiles.filter(log => log.filename !== targetLog.filename);
        setLogFiles(updatedLogs);
        
        // Reset selection if deleted log was selected
        if (selectedLog && selectedLog.filename === targetLog.filename) {
          setSelectedLog(null);
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
        window.serialAPI.deleteLogFile(log.filePath)
      );
      
      await Promise.all(deletePromises);
      
      setLogFiles([]);
      setSelectedLog(null);
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

  const formatTime = (timeStr) => {
    return timeStr.replace(/-/g, ':');
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
            className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl w-12 h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-2xl border border-red-400/30"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="lg:w-7 lg:h-7 group-hover:scale-110 transition-transform duration-300">
              <path d="M12 2V12M18.36 6.64C19.78 8.05 20.55 9.92 20.55 12C20.55 16.14 17.19 19.5 13.05 19.5C8.91 19.5 5.55 16.14 5.55 12C5.55 9.92 6.32 8.05 7.74 6.64" 
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
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
                                <span>{formatTime(log.time)}</span>
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
                      <span>{formatTime(selectedLog.time)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

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

          {/* Right Panel - Graph and Config Details */}
          <div className="xl:col-span-3 space-y-6">
            {/* Force vs Distance Graph */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-slate-800">Force & Distance vs Time Analysis</h2>
              </div>

              {selectedLog ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedLog.processData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#64748b"
                        label={{ value: 'Time (s)', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis 
                        stroke="#64748b"
                        label={{ value: 'Distance (mm) / Force (N)', angle: -90, position: 'insideLeft' }}
                      />
                     <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '2px solid #e2e8f0',
                          borderRadius: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value, name) => {
                          if (name === 'force') {
                            return [`${value} N`, 'Force'];
                          } else if (name === 'distance') {
                            return [`${value} mm`, 'Distance'];
                          }
                          return [value, name];
                        }}
                        labelFormatter={(label) => `Time: ${label} seconds`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="force" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 1, r: 2 }}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                        name="Force"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="distance" 
                        stroke="#22c55e" 
                        strokeWidth={3}
                        dot={{ fill: '#22c55e', strokeWidth: 1, r: 2 }}
                        activeDot={{ r: 6, stroke: '#22c55e', strokeWidth: 2 }}
                        name="Distance"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center bg-slate-50 rounded-xl">
                  <div className="text-center text-slate-500">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Select a log file to view analysis</p>
                    <p className="text-sm mt-2">Force & Distance vs Time graph will be displayed here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Configuration Details */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Configuration Details</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-slate-600 text-sm font-medium mb-1">Config Name</p>
                  <p className="text-slate-800 font-bold text-lg">
                    {selectedLog ? selectedLog.configData.configName : '--'}
                  </p>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-slate-600 text-sm font-medium mb-1">Temp</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-slate-800 font-bold text-lg">
                      {selectedLog ? selectedLog.configData.temperature : '--'}
                    </p>
                    <span className="text-slate-600 text-sm">°C</span>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-slate-600 text-sm font-medium mb-1">Distance</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-slate-800 font-bold text-lg">
                      {selectedLog ? selectedLog.configData.distance : '--'}
                    </p>
                    <span className="text-slate-600 text-sm">mm</span>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-slate-600 text-sm font-medium mb-1">Peak Force</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-slate-800 font-bold text-lg">
                      {selectedLog ? selectedLog.configData.peakForce : '--'}
                    </p>
                    <span className="text-slate-600 text-sm">N</span>
                  </div>
                </div>
              </div>
            </div>
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
                  <h3 className="text-lg lg:text-xl font-bold text-blue-900">Configuration Guidelines</h3>
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
                      <span className="font-semibold">Process  Logs are automatically generated. </span>
                    </p>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      Each log contains force, distance data and confguration details. 
                    </p>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-blue-800 text-sm lg:text-base">
                      Deleted Logs cannot be revcovered.
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