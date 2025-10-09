import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from './assets/Logo.png';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Simulate login process
    setTimeout(() => {
      setIsLoading(false);
      
      // Check credentials
      if (username === 'admin' && password === 'admin') {
        navigate('/main-menu'); // Navigate to main menu on successful login
      } else {
        setError('Invalid credentials');
      }
    }, 1500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 to-slate-300">
      {/* Header with logo and error message */}
      <header className="flex justify-between items-center px-8 py-4 bg-white shadow-lg relative z-10">
    <div className="flex items-center">
      <img 
        src={Logo} 
        alt="Revive Medical Technologies" 
        className="h-12 w-auto object-contain"
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
      {/* <div className="hidden flex-col items-start">
        <div className="text-2xl font-bold text-blue-600 tracking-wider">REVIVE</div>
        <div className="text-xs text-slate-500 tracking-wide -mt-1">MEDICAL TECHNOLOGIES INC.</div>
      </div> */}
    </div>
    
    <button 
     onClick={() => {
    const confirmed = window.confirm("Are you sure you want to exit?");
    if (confirmed) {
      window.close();
    }
  }}
    className="group bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl w-14 h-14 flex items-center justify-center transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-2xl border border-red-400/30">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" className="group-hover:scale-110 transition-transform duration-300">
            <path d="M12 2V12M18.36 6.64C19.78 8.05 20.55 9.92 20.55 12C20.55 16.14 17.19 19.5 13.05 19.5C8.91 19.5 5.55 16.14 5.55 12C5.55 9.92 6.32 8.05 7.74 6.64" 
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
  </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-8 py-12 gap-16">
        <div className="bg-white rounded-2xl p-12 shadow-2xl w-full max-w-md hover:-translate-y-2 transition-transform duration-300">
          {error && (
            <div className="mb-4 p-2 bg-red-100 text-red-700 rounded text-center">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="username" className="font-semibold text-gray-700 text-lg">Username</label>
              <input
                type="text"
                id="username"
                className="p-4 border-2 border-gray-200 rounded-lg text-base transition-all duration-300 bg-gray-50 focus:outline-none focus:border-blue-600 focus:bg-white focus:shadow-lg focus:ring-2 focus:ring-blue-100"
                placeholder="Enter Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="off"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="font-semibold text-gray-700 text-lg">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  className="w-full p-4 pr-12 border-2 border-gray-200 rounded-lg text-base transition-all duration-300 bg-gray-50 focus:outline-none focus:border-blue-600 focus:bg-white focus:shadow-lg focus:ring-2 focus:ring-blue-100"
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  required
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors duration-200"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <img 
                    src={showPassword ? "/src/assets/eye-open.png" : "/src/assets/eye-close.png"}
                    alt={showPassword ? "Hide" : "Show"}
                    className="w-5 h-5"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'block';
                    }}
                  />
                  <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none"
                    className="w-5 h-5 text-gray-600 hidden"
                  >
                    {showPassword ? (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                      </>
                    ) : (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2"/>
                        <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2"/>
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-4 text-lg font-semibold cursor-pointer transition-all duration-300 mt-4 flex items-center justify-center min-h-[52px] hover:-translate-y-1 hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none disabled:bg-gray-500"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-transparent border-t-white rounded-full animate-spin"></div>
              ) : (
                'LOGIN'
              )}
            </button>
          </form>
        </div>

        <div className="max-w-2xl text-gray-700">
          <h1 className="text-7xl font-bold text-gray-800 mb-2 tracking-tight">CTTM-100</h1>
          <h2 className="text-3xl font-semibold text-blue-600 mb-6 leading-tight">Catheter Trackability Testing Machine</h2>
          <p className="text-lg leading-relaxed text-gray-600 max-w-lg">
            A reliable solution for precise catheter navigation and accurate performance 
            evaluation, designed for accuracy in every test.
          </p>
        </div>
      </main>

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

export default Login;