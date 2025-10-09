import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MainMenu = () => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [isHovering, setIsHovering] = useState(null);
  const navigate = useNavigate();

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
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'manual-mode',
      title: 'Manual Mode',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
      ),
      description: 'Manually control the testing process',
      gradient: 'from-purple-500 to-pink-500'
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
      gradient: 'from-green-500 to-emerald-500'
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
      gradient: 'from-orange-500 to-amber-500'
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
      gradient: 'from-red-500 to-rose-500'
    }
  ];

  const handleOptionClick = (option) => {
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
    navigate('/manual-mode');
  }
    else if (option.id === 'process-logs') {
      navigate('/process-logs');
    }
  };

  const handleBackClick = () => {
    console.log('Back to previous screen');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="flex items-center px-6 py-4 bg-white/80 backdrop-blur-lg shadow-xl border-b border-gray-200/50 relative z-10">
      
      <div className="flex-1">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
          Main Menu
        </h1>
        <p className="text-sm text-gray-500 mt-1">Select an option to continue</p>
      </div>
      
      <div className="flex items-center gap-6">
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
    </header>

      {/* Main Content */}
      <main className="flex-1 px-8 py-8 xl:py-16">
        <div className="max-w-[1800px] mx-auto">
          <div className="flex flex-col xl:flex-row gap-8 xl:gap-20 items-start xl:items-center">
            {/* Left Section - Menu Options */}
            <div className="w-full xl:flex-1 xl:max-w-3xl">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">System Operations</h2>
                <p className="text-gray-600">Choose an operation to perform with the CTTM-100 system</p>
              </div>
              
              <div className="grid gap-5">
                {menuOptions.map((option, index) => (
                  <button
                    key={option.id}
                    className={`group relative bg-white/70 backdrop-blur-sm border-2 rounded-2xl p-8 cursor-pointer transition-all duration-500 flex items-center gap-6 text-left shadow-xl hover:shadow-2xl transform hover:-translate-y-2 overflow-hidden
                      ${option.variant === 'danger' 
                        ? 'border-red-200/50 bg-gradient-to-r from-red-50/80 to-rose-50/80 hover:border-red-400 hover:from-red-100/90 hover:to-rose-100/90' 
                        : 'border-gray-200/50 hover:border-blue-400/80 hover:bg-white/90'
                      }
                      ${selectedOption === option.id 
                        ? 'border-blue-400 bg-blue-50/80 shadow-blue-200/50' 
                        : ''
                      }
                    `}
                    onClick={() => handleOptionClick(option)}
                    onMouseEnter={() => setIsHovering(option.id)}
                    onMouseLeave={() => setIsHovering(null)}
                    style={{
                      animationDelay: `${index * 100}ms`
                    }}
                  >
                    {/* Animated background gradient */}
                    <div className={`absolute inset-0 bg-gradient-to-r ${option.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                    
                    {/* Left accent line */}
                    <div className={`absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b ${option.gradient} transition-all duration-500 transform scale-y-0 group-hover:scale-y-100 origin-top
                      ${selectedOption === option.id ? 'scale-y-100' : ''}`}></div>
                    
                    {/* Icon container */}
                    <div className={`relative w-16 h-16 flex items-center justify-center rounded-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3
                      ${option.variant === 'danger' 
                        ? 'bg-gradient-to-br from-red-100 to-rose-200 text-red-600 group-hover:from-red-200 group-hover:to-rose-300' 
                        : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-700 group-hover:from-blue-100 group-hover:to-indigo-200 group-hover:text-blue-600'
                      }
                      ${selectedOption === option.id ? 'scale-110 rotate-3' : ''}`}>
                      {option.icon}
                      
                      {/* Glow effect */}
                      <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${option.gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-sm`}></div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-2xl font-bold mb-2 transition-colors duration-300
                        ${option.variant === 'danger' 
                          ? 'text-red-700 group-hover:text-red-800' 
                          : 'text-gray-800 group-hover:text-blue-800'
                        }
                        ${selectedOption === option.id ? 'text-blue-800' : ''}`}>
                        {option.title}
                      </h3>
                      <p className="text-gray-600 leading-relaxed text-base group-hover:text-gray-700 transition-colors duration-300">
                        {option.description}
                      </p>
                    </div>
                    
                    {/* Arrow with enhanced animation */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 transform
                      ${option.variant === 'danger' 
                        ? 'bg-red-100 text-red-600 group-hover:bg-red-200 group-hover:translate-x-2 group-hover:scale-110' 
                        : 'bg-blue-100 text-blue-600 group-hover:bg-blue-200 group-hover:translate-x-2 group-hover:scale-110'
                      }
                      ${selectedOption === option.id ? 'translate-x-2 scale-110' : ''}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="transition-transform duration-300 group-hover:scale-125">
                        <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                    CTTM-100
                  </h1>
                  <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-6 leading-tight">
                    Catheter Trackability Testing
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
            <p className="text-gray-400 text-sm">Copyright © Revive Medical Technologies Inc.</p>
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