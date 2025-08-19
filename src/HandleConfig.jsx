import React, { useState, useEffect } from 'react';
import { ArrowLeft, Power, AlertCircle, ChevronDown, Trash2, Play, FileText, X } from 'lucide-react';
import { useNavigate } from "react-router-dom";


const HandleConfig = ({ mode = 'load' }) => {
  const navigate = useNavigate();
  const [availableConfigs, setAvailableConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState('');
  const [configData, setConfigData] = useState({
    configurationName: '',
    thresholdForce: '',
    temperature: '',
    pathLength: ''
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSerialError, setShowSerialError] = useState(mode === 'load');
  const [isLoading, setIsLoading] = useState(false);

  // Mock CSV files - In real app, you'd read from file system
  const mockConfigs = [
    {
      filename: 'configuration_TestConfig1_1703123456789.csv',
      data: {
        configurationName: 'Test Configuration 1',
        thresholdForce: '25.5',
        temperature: '38.2',
        pathLength: '150.0'
      }
    },
    {
      filename: 'configuration_ProductionSetup_1703123556789.csv',
      data: {
        configurationName: 'Production Setup',
        thresholdForce: '30.0',
        temperature: '37.5',
        pathLength: '200.0'
      }
    },
    {
      filename: 'configuration_DebugMode_1703123656789.csv',
      data: {
        configurationName: 'Debug Mode',
        thresholdForce: '15.2',
        temperature: '39.8',
        pathLength: '100.5'
      }
    }
  ];

  useEffect(() => {
    // Load available configurations
    loadAvailableConfigs();
  }, []);

  const loadAvailableConfigs = async () => {
    try {
      // In real implementation, you would:
      // 1. Read files from a specific directory
      // 2. Filter for CSV files with your naming pattern
      // 3. Parse each CSV to get configuration data
      
      setAvailableConfigs(mockConfigs);
    } catch (error) {
      console.error('Error loading configurations:', error);
    }
  };

  const handleConfigSelection = (config) => {
    setSelectedConfig(config.filename);
    setConfigData(config.data);
    setShowDropdown(false);
  };

  const handleProcessMode = () => {
    if (!selectedConfig) {
      alert('Please select a configuration first.');
      return;
    }
    
    // Navigate to ProcessMode and pass config data
      navigate('/process-mode', { state: { config: configData } });
  };

  const handleDeleteConfig = async () => {
    if (!selectedConfig) {
      alert('Please select a configuration to delete.');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Simulate deletion process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Remove from available configs
      const updatedConfigs = availableConfigs.filter(config => config.filename !== selectedConfig);
      setAvailableConfigs(updatedConfigs);
      
      // Reset form
      setSelectedConfig('');
      setConfigData({
        configurationName: '',
        thresholdForce: '',
        temperature: '',
        pathLength: ''
      });
      
      setShowDeleteConfirm(false);
      alert('Configuration deleted successfully!');
      
    } catch (error) {
      console.error('Error deleting configuration:', error);
      alert('Error deleting configuration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getPageTitle = () => {
    return mode === 'load' ? 'Load Configuration' : 'Delete Configuration';
  };

  const getButtonText = () => {
    return mode === 'load' ? 'Process Mode' : 'Delete';
  };

  const getButtonColor = () => {
    return mode === 'load' 
      ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800' 
      : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800';
  };

  const getButtonIcon = () => {
    return mode === 'load' ? <Play className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200">
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{getPageTitle()}</h1>
          </div>
          
          <button className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200">
            <Power className="w-6 h-6" />
          </button>
        </div>

        {/* Serial Port Error (only for Load mode) */}
        {showSerialError && mode === 'load' && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-red-800 font-semibold">ERROR: REQUIRED SERIAL PORT NOT FOUND</p>
                  <p className="text-red-600 text-sm mt-1">Please ensure the device is connected and try again.</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Configuration Selector */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6">
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4 text-left flex items-center justify-between hover:from-blue-100 hover:to-blue-150 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-blue-800">Select Configuration</span>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-blue-600 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                    {availableConfigs.length === 0 ? (
                      <div className="p-4 text-center text-slate-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No configurations found</p>
                      </div>
                    ) : (
                      availableConfigs.map((config, index) => (
                        <button
                          key={index}
                          onClick={() => handleConfigSelection(config)}
                          className="w-full p-4 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors duration-150 focus:outline-none focus:bg-blue-50"
                        >
                          <div>
                            <p className="font-medium text-slate-800">{config.data.configurationName}</p>
                            <p className="text-sm text-slate-500 mt-1">{config.filename}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Configuration Info */}
              {selectedConfig && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="w-4 h-4 text-green-600" />
                    <span className="text-green-800 font-medium">Selected:</span>
                  </div>
                  <p className="text-green-700 text-sm font-medium">{configData.configurationName}</p>
                  <p className="text-green-600 text-xs mt-1">{selectedConfig}</p>
                </div>
              )}
            </div>
          </div>

          {/* Configuration Details */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 md:p-8">
              <div className="space-y-6">
                {/* Configuration Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Configuration Name
                  </label>
                  <input
                    type="text"
                    value={configData.configurationName}
                    readOnly
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none"
                    placeholder="Select a configuration to view details"
                  />
                </div>

                {/* Path Length */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Path Length (mm)
                  </label>
                  <input
                    type="text"
                    value={configData.pathLength}
                    readOnly
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none"
                  />
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Temperature (°C)
                  </label>
                  <input
                    type="text"
                    value={configData.temperature}
                    readOnly
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none"
                  />
                </div>

                {/* Threshold Force */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Threshold Force (N)
                  </label>
                  <input
                    type="text"
                    value={configData.thresholdForce}
                    readOnly
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-50 text-slate-700 focus:outline-none"
                  />
                </div>

                {/* Action Button */}
                <div className="pt-6">
                  <button
                    onClick={mode === 'load' ? handleProcessMode : () => setShowDeleteConfirm(true)}
                    disabled={!selectedConfig || isLoading}
                    className={`w-full md:w-auto md:ml-auto md:block ${getButtonColor()} disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl disabled:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center space-x-2 min-w-[160px]`}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        {getButtonIcon()}
                        <span>{getButtonText()}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                {mode === 'load' ? 'Load Configuration Info' : 'Delete Configuration Warning'}
              </h3>
              <ul className="text-blue-800 text-sm space-y-1">
                {mode === 'load' ? (
                  <>
                    <li>• Select a configuration from the dropdown to load its settings</li>
                    <li>• All configuration values will be populated automatically</li>
                    <li>• Click "Process Mode" to continue with the selected configuration</li>
                    <li>• Ensure serial port connection is active before processing</li>
                  </>
                ) : (
                  <>
                    <li>• Select a configuration to delete from your saved configurations</li>
                    <li>• This action cannot be undone - deleted configurations are permanently removed</li>
                    <li>• Make sure you have backups of important configurations</li>
                    <li>• Confirmation will be required before deletion</li>
                  </>
                )}
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
            
            <p className="text-slate-600 mb-2">Are you sure you want to delete this configuration?</p>
            <p className="text-slate-800 font-medium mb-6">"{configData.configurationName}"</p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-3 border-2 border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfig}
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
    </div>
  );
};

export default HandleConfig;