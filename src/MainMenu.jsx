import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Power, LogOut, X, User, Wifi, WifiOff, Usb, Cable } from 'lucide-react';
import manualIcon from './assets/Manual.png';

const MainMenu = () => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [isHovering, setIsHovering] = useState(null);
  const navigate = useNavigate();
  const [showPowerDropdown, setShowPowerDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Get user info from localStorage
  const [user, setUser] = useState(null);

  // Connection state
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [connectionChecked, setConnectionChecked] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const userData = JSON.parse(localStorage.getItem('user'));
    if (!userData) {
      navigate('/'); // Redirect to login if no user data
    } else {
      setUser(userData);
    }

    // Initial connection check
    checkInitialConnection();

    // Listen for modbus status updates
    window.addEventListener('modbus-status-change', handleModbusStatus);

    // Cleanup
    return () => {
      window.removeEventListener('modbus-status-change', handleModbusStatus);
    };
  }, [navigate]);

  const menuOptions = [
    {
      id: 'load-config',
      title: 'Load Configuration',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      description: 'Load existing configuration files',
      gradient: 'from-blue-500 to-cyan-500',
      roles: ['admin', 'operator'] // Both roles can access
    },
    {
      id: 'manual-mode',
      title: 'Manual Mode',
      icon: (
        <img
          src={manualIcon}
          alt="Manual Mode"
          className="w-8 h-8 object-contain"
        />
      ),
      description: 'Manually control the testing process',
      gradient: 'from-purple-500 to-pink-500',
      roles: ['admin', 'operator'] // Both roles can access
    },
    {
      id: 'process-logs',
      title: 'Show Process Logs',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      description: 'View detailed process logs and history',
      gradient: 'from-green-500 to-emerald-500',
      roles: ['admin', 'operator'] // Both roles can access
    },
    {
      id: 'create-config',
      title: 'Create Configuration',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      description: 'Create new configuration settings',
      gradient: 'from-orange-500 to-amber-500',
      roles: ['admin'] // Only admin can access
    },
    {
      id: 'delete-config',
      title: 'Delete Configuration',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      ),
      description: 'Remove existing configuration files',
      variant: 'danger',
      gradient: 'from-red-500 to-rose-500',
      roles: ['admin'] // Only admin can access
    }
  ];

  // Handle modbus status updates
  const handleModbusStatus = (event) => {
    const status = event.detail;
    setConnectionStatus(status);
    setConnectionChecked(true);
    console.log('Modbus status updated:', status);
  };

  // Check initial connection
  const checkInitialConnection = async () => {
    try {
      console.log('Checking initial connection...');
      const status = await window.api.checkConnection();
      setConnectionStatus(status.connected ? 'connected' : 'disconnected');
      setConnectionChecked(true);
      console.log('Initial connection status:', status);
    } catch (error) {
      console.error('Failed to check connection:', error);
      setConnectionStatus('disconnected');
      setConnectionChecked(true);
    }
  };

  // Handle manual connection attempt
  const handleConnect = async () => {
    try {
      console.log('Attempting to connect manually...');
      const connected = await window.api.connectModbus();
      if (connected) {
        setConnectionStatus('connected');
        console.log('Manual connection successful');
      } else {
        console.log('Manual connection failed');
      }
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  // Handle reconnect
  const handleReconnect = async () => {
    try {
      console.log('Attempting to reconnect...');
      const result = await window.api.reconnect();
      if (result.success && result.connected) {
        setConnectionStatus('connected');
        console.log('Reconnect successful');
      } else {
        console.log('Reconnect failed');
      }
    } catch (error) {
      console.error('Reconnect error:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowPowerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOptionClick = async (option) => {
    // Check if user has permission to access this option
    if (!user || !option.roles.includes(user.role)) {
      alert(`Access Denied: ${user?.role === 'operator' ? 'Operator' : 'Unknown user'} cannot access ${option.title}`);
      return;
    }

    setSelectedOption(option.id);
    console.log(`Selected: ${option.title}`);

    if (option.id === 'create-config') {
      navigate('/create-config');
    }
    else if (option.id === 'load-config') {
      navigate('/handle-config/load');
    }
    else if (option.id === 'delete-config') {
      navigate('/handle-config/delete');
    }
    else if (option.id === 'manual-mode') {
      // DIRECT NAVIGATION - Send command and navigate immediately
      try {
        console.log('Activating manual mode (non-blocking)...');

        // Send manual mode command without waiting
        window.api.manual().catch(error => {
          console.error('Manual mode command error (non-blocking):', error);
          // Don't block navigation even if command fails
        });

        // Navigate immediately
        navigate('/manual-mode');

      } catch (error) {
        console.error('Navigation error for manual mode:', error);
        // Still navigate even if there's an error
        navigate('/manual-mode');
      }
    }
    else if (option.id === 'process-logs') {
      navigate('/process-logs');
    }
  };

  const handleExit = () => {
    const confirmed = window.confirm("Are you sure you want to exit?");
    if (confirmed) {
      window.close();
    }
    setShowPowerDropdown(false);
  };

  const handleLogout = () => {
    // Clear user data from localStorage
    localStorage.removeItem('user');
    navigate('/');
    setShowPowerDropdown(false);
  };

  const togglePowerDropdown = () => {
    setShowPowerDropdown(!showPowerDropdown);
  };

  // Filter menu options based on user role
  const filteredMenuOptions = menuOptions.filter(option =>
    user && option.roles.includes(user.role)
  );

  // Connection status display
  const getConnectionDisplay = () => {
    if (!connectionChecked) {
      return {
        text: 'Checking connection...',
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-200',
        icon: <Usb className="w-4 h-4 animate-pulse" />
      };
    }

    if (connectionStatus === 'connected') {
      return {
        text: 'USB Connected',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        borderColor: 'border-green-200',
        icon: <Usb className="w-4 h-4" />
      };
    } else {
      return {
        text: 'USB Disconnected',
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        borderColor: 'border-red-200',
        icon: <Usb className="w-4 h-4" />
      };
    }
  };

  const connectionInfo = getConnectionDisplay();

  // Show loading while checking user
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex-shrink-0 ">
      {/* Header */}
      <header className="flex items-center px-6 py-4 bg-white/80 backdrop-blur-lg shadow-xl border-b border-gray-200/50 relative z-10 flex-shrink-o min-h-0">

        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
            Main Menu
          </h1>
          {/* <p className="text-sm text-gray-500 mt-1">Select an option to continue</p> */}

          {/* User info badge */}
          <div className="flex items-center gap-2 mt-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              <User className="w-3 h-3" />
              <span className="text-xs font-medium">
                {user.username} ({user.role === 'admin' ? 'Administrator' : 'Operator'})
              </span>
            </div>
          </div>
        </div>

        {/* Connection Status Indicator */}
        <div className="flex items-center gap-3 mr-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${connectionInfo.bgColor} border ${connectionInfo.borderColor}`}>
            {connectionInfo.icon}
            <span className={`text-sm font-medium ${connectionInfo.color}`}>
              {connectionInfo.text}
            </span>
          </div>

          {connectionStatus === 'disconnected' && connectionChecked && (
            <button
              onClick={handleReconnect}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reconnect
            </button>
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={togglePowerDropdown}
            className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl lg:rounded-2xl w-8 h-8 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-xl border border-red-400/30 flex-shrink-0 z-40"
          >
            <Power className="w-3 h-3 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover:scale-110 transition-transform duration-300" />
          </button>

          {/* Dropdown Menu - Enhanced with higher z-index */}
          {showPowerDropdown && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 z-50 overflow-hidden transform origin-top-right animate-in fade-in-0 zoom-in-95 duration-200">
              {/* Dropdown Header */}
              <div className="px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100/80 border-b border-gray-200/50">
                <p className="text-sm font-semibold text-gray-700">Power Options</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Logged in as: <span className="font-medium">{user.username}</span>
                </p>
              </div>

              {/* Exit Button */}
              <button
                onClick={handleExit}
                className="w-full flex items-center gap-3 px-4 py-4 text-left text-red-600 hover:bg-red-50/80 transition-all duration-200 border-b border-gray-100/50 group"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                  <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold block">Exit</span>
                  <span className="text-xs text-red-500">Close the application</span>
                </div>
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-4 text-left text-blue-600 hover:bg-blue-50/80 transition-all duration-200 border-b border-gray-100/50 group"
              >
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex-1">
                  <span className="font-semibold block">Logout</span>
                  <span className="text-xs text-blue-500">Return to login screen</span>
                </div>
              </button>
              {/* Dropdown decoration */}
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-500 via-blue-500 to-gray-500 opacity-30 rounded-l-lg"></div>

              {/* Dropdown arrow */}
              <div className="absolute -top-2 right-4 w-4 h-4 bg-white/95 backdrop-blur-xl transform rotate-45 border-t border-l border-gray-200/50"></div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-8 xl:py-16 flex-shrink-0 min-h-0">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex flex-col xl:flex-row gap-8 xl:gap-20 items-start xl:items-center">
            {/* Left Section - Menu Options */}
            <div className="w-full xl:flex-1 xl:max-w-3xl">
              <div className="mb-8">
                <p className="text-xl font-semibold text-gray-500">Select an option to continue</p>
              </div>

              <div className="grid gap-5">
                {filteredMenuOptions.map((option, index) => (
                  <button
                    key={option.id}
                    className={`group relative bg-white/70 backdrop-blur-sm border-2 rounded-2xl p-8 cursor-pointer transition-all duration-500 flex items-center gap-6 text-left shadow-xl hover:shadow-2xl transform hover:-translate-y-2 overflow-hidden
                      ${option.variant === 'danger'
                        ? 'border-gray-200/50 bg-gradient-to-r from-gray-50/80 to-gray-50/80 hover:border-red-400 hover:from-red-100/90 hover:to-rose-100/90'
                        : 'border-gray-200/50 hover:border-blue-400/80 hover:bg-white/90'
                      }
                      ${selectedOption === option.id
                        ? 'border-blue-400 bg-blue-50/80 shadow-blue-200/50'
                        : ''
                      }
                      ${!option.roles.includes(user?.role) ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    onClick={() => handleOptionClick(option)}
                    onMouseEnter={() => setIsHovering(option.id)}
                    onMouseLeave={() => setIsHovering(null)}
                    style={{
                      animationDelay: `${index * 100}ms`
                    }}
                    disabled={!option.roles.includes(user?.role)}
                  >
                    {/* Animated background gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${option.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>

                    {/* Left accent line */}
                    <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${option.gradient} transition-all duration-500 transform scale-y-0 group-hover:scale-y-100 origin-top
                      ${selectedOption === option.id ? 'scale-y-100' : ''}`}></div>

                    {/* Icon container */}
                    <div className={`relative w-16 h-16 flex items-center justify-center rounded-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3
                      ${option.variant === 'danger'
                        ? 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 group-hover:from-red-200 group-hover:to-rose-300'
                        : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 group-hover:from-blue-100 group-hover:to-indigo-200 group-hover:text-blue-600'
                      }
                      ${selectedOption === option.id ? 'scale-110 rotate-3' : ''}
                      ${!option.roles.includes(user?.role) ? 'opacity-70' : ''}`}>
                      {option.icon}

                      {/* Glow effect */}
                      <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${option.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-sm`}></div>

                      {/* Restricted icon for operators */}
                      {user.role === 'operator' && !option.roles.includes('operator') && (
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-2xl font-bold transition-colors duration-300
                          ${option.variant === 'danger'
                            ? 'text-gray-800 group-hover:text-red-800'
                            : 'text-gray-800 group-hover:text-blue-800'
                          }
                          ${selectedOption === option.id ? 'text-blue-800' : ''}`}>
                          {option.title}
                        </h3>
                      </div>
                      <p className="text-gray-600 leading-relaxed text-base group-hover:text-gray-700 transition-colors duration-300">
                        {option.description}
                      </p>
                    </div>

                    {/* Arrow with enhanced animation */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 transform
                      ${option.variant === 'danger'
                        ? 'bg-blue-100 text-blue-600 group-hover:bg-red-200 group-hover:text-red-600 group-hover:translate-x-2 group-hover:scale-110'
                        : 'bg-blue-100 text-blue-600 group-hover:bg-blue-200 group-hover:translate-x-2 group-hover:scale-110'
                      }
                      ${selectedOption === option.id ? 'translate-x-2 scale-110' : ''}
                      ${!option.roles.includes(user?.role) ? 'opacity-50' : ''}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300 group-hover:scale-125">
                        <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>

                    {/* Hover glow effect */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${option.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none`}></div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Section - Product Info */}
            <div className="w-full xl:flex-1 xl:max-w-2xl flex xl:justify-center">
              <div className="bg-white/60 backdrop-blur-lg rounded-3xl p-10 shadow-2xl border border-white/20 w-full">
                {/* Product Header */}
                <div className="mb-8">
                  <h1 className="text-8xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent mb-4 tracking-tight leading-none">
                    SCTTM
                  </h1>
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 leading-tight">
                    Specialized Catheter Trackability Testing Machine
                  </h2>
                </div>

                <p className="text-xl leading-relaxed text-gray-700 mb-10 font-medium">
                  A reliable solution for precise catheter navigation and accurate performance
                  evaluation, designed for accuracy in every test.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Enhanced Footer */}
      <footer className="relative z-10 px-4 lg:px-8 py-4 lg:py-6 bg-white/90 backdrop-blur-xl border-t border-gray-200/50 flex-shrink-0 shadow-lg">
        <div className="flex flex-col lg:flex-row justify-between items-center max-w-[2000px] mx-auto gap-3 lg:gap-0 w-full">
          <div className="flex items-center gap-4 lg:gap-6">
            <p className="text-gray-400 text-sm">Copyright 2026 © Revive Medical Technologies Inc.</p>
            <div className="flex items-center gap-2">
            </div>
          </div>
          <div className="flex items-center gap-3 lg:gap-6 text-xs lg:text-sm text-gray-400 font-medium">
            <span>Version 1.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainMenu;