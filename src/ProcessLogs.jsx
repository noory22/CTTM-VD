import React, { useState, useEffect } from 'react';
import { ArrowLeft, Power, AlertCircle, ChevronDown, FileText, X, Trash2, Calendar, Clock, TrendingUp } from 'lucide-react';
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

  // Mock process log data - Replace with actual file reading logic
  const mockLogFiles = [
    {
      id: 1,
      filename: 'process_log_TestConfig1_2024-01-15_14-30-25.json',
      displayName: 'Test Configuration 1',
      date: '2024-01-15',
      time: '14:30:25',
      configData: {
        configName: 'Test Configuration 1',
        pathLength: '150.0',
        temperature: '38.2',
        force: '25.5'
      },
      processData: [
        { distance: 0, force: 0, time: 0 },
        { distance: 10, force: 5.2, time: 1000 },
        { distance: 20, force: 12.8, time: 2000 },
        { distance: 30, force: 18.5, time: 3000 },
        { distance: 40, force: 22.1, time: 4000 },
        { distance: 50, force: 25.5, time: 5000 },
        { distance: 60, force: 23.8, time: 6000 },
        { distance: 70, force: 20.2, time: 7000 },
        { distance: 80, force: 15.9, time: 8000 },
        { distance: 90, force: 10.3, time: 9000 },
        { distance: 100, force: 5.1, time: 10000 },
        { distance: 110, force: 2.8, time: 11000 },
        { distance: 120, force: 1.2, time: 12000 },
        { distance: 130, force: 0.5, time: 13000 },
        { distance: 140, force: 0.2, time: 14000 },
        { distance: 150, force: 0.1, time: 15000 }
      ]
    },
    {
      id: 2,
      filename: 'process_log_ProductionSetup_2024-01-15_16-45-12.json',
      displayName: 'Production Setup',
      date: '2024-01-15',
      time: '16:45:12',
      configData: {
        configName: 'Production Setup',
        pathLength: '200.0',
        temperature: '37.5',
        force: '30.0'
      },
      processData: [
        { distance: 0, force: 0, time: 0 },
        { distance: 15, force: 8.5, time: 1500 },
        { distance: 30, force: 16.2, time: 3000 },
        { distance: 45, force: 22.8, time: 4500 },
        { distance: 60, force: 27.5, time: 6000 },
        { distance: 75, force: 30.0, time: 7500 },
        { distance: 90, force: 28.3, time: 9000 },
        { distance: 105, force: 25.1, time: 10500 },
        { distance: 120, force: 21.4, time: 12000 },
        { distance: 135, force: 17.2, time: 13500 },
        { distance: 150, force: 12.8, time: 15000 },
        { distance: 165, force: 8.9, time: 16500 },
        { distance: 180, force: 5.3, time: 18000 },
        { distance: 195, force: 2.1, time: 19500 },
        { distance: 200, force: 0.8, time: 20000 }
      ]
    },
    {
      id: 3,
      filename: 'process_log_DebugMode_2024-01-16_09-15-33.json',
      displayName: 'Debug Mode Test',
      date: '2024-01-16',
      time: '09:15:33',
      configData: {
        configName: 'Debug Mode Test',
        pathLength: '100.0',
        temperature: '39.8',
        force: '15.2'
      },
      processData: [
        { distance: 0, force: 0, time: 0 },
        { distance: 8, force: 3.2, time: 800 },
        { distance: 16, force: 7.8, time: 1600 },
        { distance: 24, force: 11.5, time: 2400 },
        { distance: 32, force: 14.2, time: 3200 },
        { distance: 40, force: 15.2, time: 4000 },
        { distance: 48, force: 14.8, time: 4800 },
        { distance: 56, force: 13.1, time: 5600 },
        { distance: 64, force: 10.9, time: 6400 },
        { distance: 72, force: 8.2, time: 7200 },
        { distance: 80, force: 5.8, time: 8000 },
        { distance: 88, force: 3.1, time: 8800 },
        { distance: 96, force: 1.4, time: 9600 },
        { distance: 100, force: 0.3, time: 10000 }
      ]
    }
  ];

  useEffect(() => {
    loadLogFiles();
  }, []);

  const loadLogFiles = async () => {
    try {
      // In real implementation, you would read log files from file system
      setLogFiles(mockLogFiles);
    } catch (error) {
      console.error('Error loading log files:', error);
    }
  };

  const handleLogSelection = (log) => {
    setSelectedLog(log);
    setShowDropdown(false);
  };

  const handleDeleteLog = async (logToDelete = null) => {
    const targetLog = logToDelete || selectedLog;
    if (!targetLog) return;

    setIsLoading(true);
    
    try {
      // Simulate deletion process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Remove from log files
      const updatedLogs = logFiles.filter(log => log.id !== targetLog.id);
      setLogFiles(updatedLogs);
      
      // Reset selection if deleted log was selected
      if (selectedLog && selectedLog.id === targetLog.id) {
        setSelectedLog(null);
      }
      
      setShowDeleteConfirm(false);
      alert('Log file deleted successfully!');
      
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
      // Simulate deletion process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setLogFiles([]);
      setSelectedLog(null);
      setShowDeleteAllConfirm(false);
      alert('All log files deleted successfully!');
      
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
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Process Logs</h1>
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
                  <p className="text-red-600 text-sm mt-1">Serial port connection required for real-time logging.</p>
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
                          key={log.id}
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
                <h2 className="text-xl font-semibold text-slate-800">Force vs Distance Analysis</h2>
              </div>

              {selectedLog ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={selectedLog.processData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="distance" 
                        stroke="#64748b"
                        label={{ value: 'Distance (mm)', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis 
                        stroke="#64748b"
                        label={{ value: 'Force (N)', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '2px solid #e2e8f0',
                          borderRadius: '12px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value, name) => [
                          `${value} ${name === 'force' ? 'N' : 'mm'}`,
                          name === 'force' ? 'Force' : 'Distance'
                        ]}
                        labelFormatter={(label) => `Distance: ${label} mm`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="force" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                        name="Force"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-96 flex items-center justify-center bg-slate-50 rounded-xl">
                  <div className="text-center text-slate-500">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Select a log file to view analysis</p>
                    <p className="text-sm mt-2">Force vs Distance graph will be displayed here</p>
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
                  <p className="text-slate-600 text-sm font-medium mb-1">Path Length</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-slate-800 font-bold text-lg">
                      {selectedLog ? selectedLog.configData.pathLength : '--'}
                    </p>
                    <span className="text-slate-600 text-sm">mm</span>
                  </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-slate-600 text-sm font-medium mb-1">Force</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-slate-800 font-bold text-lg">
                      {selectedLog ? selectedLog.configData.force : '--'}
                    </p>
                    <span className="text-slate-600 text-sm">N</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Process Logs Information</h3>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• Process logs are automatically generated during catheter testing procedures</li>
                <li>• Each log contains force measurements, distance data, and configuration details</li>
                <li>• Graphs show the relationship between applied force and catheter distance</li>
                <li>• Log files can be exported for further analysis or regulatory compliance</li>
                <li>• Deleted logs cannot be recovered - ensure you have backups of important data</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
    </div>
  );
};

export default ProcessLogs;