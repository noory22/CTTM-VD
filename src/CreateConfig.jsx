import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// SVG Icon Components
const ArrowLeft = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
);

const Power = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/>
  </svg>
);

const AlertCircle = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 8v4M12 16h.01"/>
  </svg>
);

const Download = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
  </svg>
);

const CreateConfig = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    configurationName: '',
    thresholdForce: '',
    temperature: '',
    pathLength: ''
  });
  
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showSerialError, setShowSerialError] = useState(true);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.configurationName.trim()) {
      newErrors.configurationName = 'Configuration name is required';
    }
    
    if (!formData.thresholdForce.trim()) {
      newErrors.thresholdForce = 'Threshold force is required';
    } else if (isNaN(formData.thresholdForce) || parseFloat(formData.thresholdForce) <= 0) {
      newErrors.thresholdForce = 'Please enter a valid positive number';
    }
    
    if (!formData.temperature.trim()) {
      newErrors.temperature = 'Temperature is required';
    } else {
      const temp = parseFloat(formData.temperature);
      if (isNaN(temp) || temp < 37 || temp > 40) {
        newErrors.temperature = 'Temperature must be between 37-40°C';
      }
    }
    
    if (!formData.pathLength.trim()) {
      newErrors.pathLength = 'Path length is required';
    } else if (isNaN(formData.pathLength) || parseFloat(formData.pathLength) <= 0) {
      newErrors.pathLength = 'Please enter a valid positive number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const convertToCSV = (data) => {
    const headers = ['Configuration Name', 'Threshold Force (N)', 'Temperature (°C)', 'Path Length (mm)', 'Created At'];
    const values = [
      data.configurationName,
      data.thresholdForce,
      data.temperature,
      data.pathLength,
      new Date().toISOString()
    ];
    
    return [
      headers.join(','),
      values.map(value => `"${value}"`).join(',')
    ].join('\n');
  };

  const saveToCSV = async (data) => {
    try {
      const csvContent = convertToCSV(data);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `configuration_${data.configurationName.replace(/\s+/g, '_')}_${Date.now()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      return true;
    } catch (error) {
      console.error('Error saving CSV:', error);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const success = await saveToCSV(formData);
      
      if (success) {
        setFormData({
          configurationName: '',
          thresholdForce: '',
          temperature: '',
          pathLength: ''
        });
        alert('Configuration created and saved successfully!');
      } else {
        alert('Error saving configuration. Please try again.');
      }
    } catch (error) {
      console.error('Error creating configuration:', error);
      alert('Error creating configuration. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-white hover:shadow-md rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Create Configuration</h1>
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
                  <p className="text-red-600 text-sm mt-1">Please ensure the device is connected and try again.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSerialError(false)}
                className="text-red-500 hover:text-red-700 transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Configuration Name */}
              <div className="space-y-2">
                <label htmlFor="configurationName" className="block text-sm font-semibold text-slate-700">
                  Configuration Name
                </label>
                <input
                  type="text"
                  id="configurationName"
                  name="configurationName"
                  value={formData.configurationName}
                  onChange={handleInputChange}
                  placeholder="Enter configuration name"
                  className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                    errors.configurationName 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-slate-200 focus:border-blue-500'
                  }`}
                />
                {errors.configurationName && (
                  <p className="text-red-500 text-sm flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.configurationName}</span>
                  </p>
                )}
              </div>

              {/* Threshold Force and Temperature Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Threshold Force */}
                <div className="space-y-2">
                  <label htmlFor="thresholdForce" className="block text-sm font-semibold text-slate-700">
                    Threshold Force (N)
                  </label>
                  <input
                    type="number"
                    id="thresholdForce"
                    name="thresholdForce"
                    value={formData.thresholdForce}
                    onChange={handleInputChange}
                    placeholder="Enter threshold force..."
                    step="0.01"
                    className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                      errors.thresholdForce 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-slate-200 focus:border-blue-500'
                    }`}
                  />
                  {errors.thresholdForce && (
                    <p className="text-red-500 text-sm flex items-center space-x-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.thresholdForce}</span>
                    </p>
                  )}
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <label htmlFor="temperature" className="block text-sm font-semibold text-slate-700">
                    Temperature (°C)
                  </label>
                  <input
                    type="number"
                    id="temperature"
                    name="temperature"
                    value={formData.temperature}
                    onChange={handleInputChange}
                    placeholder="Enter temp (37-40)"
                    min="37"
                    max="40"
                    step="0.1"
                    className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                      errors.temperature 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-slate-200 focus:border-blue-500'
                    }`}
                  />
                  {errors.temperature && (
                    <p className="text-red-500 text-sm flex items-center space-x-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.temperature}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Path Length */}
              <div className="space-y-2">
                <label htmlFor="pathLength" className="block text-sm font-semibold text-slate-700">
                  Path Length (mm)
                </label>
                <input
                  type="number"
                  id="pathLength"
                  name="pathLength"
                  value={formData.pathLength}
                  onChange={handleInputChange}
                  placeholder="Enter path length (--)"
                  step="0.01"
                  className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 ${
                    errors.pathLength 
                      ? 'border-red-300 focus:border-red-500' 
                      : 'border-slate-200 focus:border-blue-500'
                  }`}
                />
                {errors.pathLength && (
                  <p className="text-red-500 text-sm flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.pathLength}</span>
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full md:w-auto md:ml-auto md:block bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-blue-400 disabled:to-blue-500 text-white font-semibold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl disabled:shadow-md transition-all duration-200 transform hover:-translate-y-0.5 disabled:transform-none flex items-center justify-center space-x-2 min-w-[140px]"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>Create</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-6">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Configuration Guidelines</h3>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• Configuration will be automatically saved as CSV file</li>
                <li>• Temperature must be within operational range (37-40°C)</li>
                <li>• All values are validated before saving</li>
                <li>• Ensure serial port connection before creating configuration</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateConfig;
