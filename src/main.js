const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const ModbusRTU = require("modbus-serial"); 
const path = require("path");
const fs = require('fs');  // Changed from fs.promises to regular fs for sync operations
const fsPromises = require('fs').promises;  // Keep for async operations

// -------------------------
// Modbus / PLC settings - UPDATED BASED ON PYTHON CODE
// -------------------------
const PORT = "COM4";
const BAUDRATE = 9600;
const TIMEOUT = 1;

const COIL_HOME  = 2001;
const COIL_START = 2002;
const COIL_STOP  = 2003;
const COIL_RESET = 2004;
const COIL_HEATING = 2005;
const COIL_RETRACTION = 2006;
const COIL_MANUAL = 2070;
const COIL_INSERTION = 2008;
const COIL_RET = 2009;
const COIL_CLAMP = 2007;
const REG_WRITE_DIST = 6000;
const REG_DISTANCE   = 6116;  // 1 register (16-bit integer) - UPDATED
const REG_FORCE      = 54;    // 2 registers (32-bit float) - UPDATED
const REG_TEMP    = 501;// 
let mainWindow;
let isConnected = false;
let dataReadingActive = false;
const client = new ModbusRTU();

// ============================
// CONFIGURATION FILE SETTINGS
// ============================
const CONFIG_FILE_PATH = path.join(app.getPath('documents'), 'SCTTM.csv');

// -------------------------
// Connect Modbus - UPDATED
// -------------------------
async function connectModbus() {
  try {
    console.log("🔌 Attempting to connect to Modbus on", PORT);
    
    // Close existing connection if any
    if (client.isOpen) {
      client.close();
    }
    
    await client.connectRTUBuffered(PORT, { 
      baudRate: BAUDRATE,
      dataBits: 8,
      stopBits: 1,
      parity: 'Even'
    });
    
    client.setID(1);
    // client.setTimeout(TIMEOUT * 1000);
    isConnected = true;
    console.log("✅ Modbus connected on", PORT);
    
    // Update UI to show connection status
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('modbus-status', 'connected');
    }
    
    return true;
  } catch (err) {
    isConnected = false;
    console.error("❌ Modbus connection error:", err.message);
    
    // DON'T show error dialog on auto-connect
    // Only show dialog for manual connection attempts
    
    // Send disconnected status to UI
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('modbus-status', 'disconnected');
    }
    
    return false;
  }
}

// -------------------------
// Auto connect to port - UPDATED
// -------------------------
async function autoConnectPort() {
  try {
    console.log("🔄 Attempting auto-connect...");
    const connected = await connectModbus();
    if (connected) {
      console.log("✅ Auto-connect successful");
    } else {
      console.log("⚠️ Auto-connect failed - Device may not be connected");
    }
    return connected;
  } catch (error) {
    console.log("⚠️ Auto-connect error:", error.message);
    return false;
  }
}

// -------------------------
// Manual connect (with error dialog) - NEW FUNCTION
// -------------------------
async function manualConnectModbus() {
  try {
    console.log("🔌 Manual connection attempt to", PORT);
    const connected = await connectModbus();
    
    if (!connected && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'Modbus Connection Error',
        `Failed to connect to ${PORT}.\n\nPlease check:\n1. COM port number\n2. Cable connection\n3. Device power\n4. Port permissions\n\nCurrent port: ${PORT}`
      );
    }
    
    return connected;
  } catch (error) {
    console.error("Manual connect error:", error.message);
    return false;
  }
}

// -------------------------
// Create Window - UPDATED
// -------------------------
const createWindow = () => {
  // Get the correct preload path for Electron Forge with Vite
  let preloadPath;
  
  // Try multiple possible locations
  const possiblePaths = [
    // Electron Forge Vite plugin default location
    path.join(process.cwd(), '.vite/build/preload/preload.js'),
    // Alternative location
    path.join(__dirname, 'preload.js'),
    // Development location
    path.join(process.cwd(), 'src/preload.js'),
  ];
  
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {  // Use sync version for checking
        preloadPath = p;
        console.log('✅ Found preload at:', preloadPath);
        break;
      }
    } catch (e) {
      // Continue checking other paths
    }
  }
  
  if (!preloadPath) {
    console.error('❌ Could not find preload script in any expected location');
    // Fallback to default
    preloadPath = path.join(process.cwd(), '.vite/build/preload/preload.js');
  }
  
  console.log('📁 Using preload path:', preloadPath);
  
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('🌐 Loading from Vite dev server');
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    // For production
    const indexPath = path.join(__dirname, '../renderer/main_window/index.html');
    console.log('📄 Loading from file:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
  
  // Auto-connect after window is ready
  mainWindow.on('ready-to-show', () => {
    console.log('🪟 Window is ready');
    // Delay auto-connect to ensure UI is loaded
    setTimeout(() => {
      autoConnectPort();
    }, 2000);
  });
  
  // Handle window close
  mainWindow.on('closed', () => {
    if (client.isOpen) {
      console.log("Closing Modbus connection...");
      client.close();
      isConnected = false;
    }
    mainWindow = null;
  });
};

// -------------------------
// Data conversion helpers - UPDATED BASED ON PYTHON LOGIC
// -------------------------
function registersToFloat32LE(register1, register2) {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  
  view.setUint16(0, register1, true);
  view.setUint16(2, register2, true);
  
  return view.getFloat32(0, true);
}

// -------------------------
// Safe register reading
// -------------------------
async function safeReadRegisters(address, count) {
  try {
    if (!client.isOpen) {
      throw new Error('Modbus connection is not open');
    }
    return await client.readHoldingRegisters(address, count);
  } catch (err) {
    console.error(`Error reading register ${address}:`, err.message);
    throw err;
  }
}

// -------------------------
// Read PLC Data Function - UPDATED
// -------------------------
async function readPLCData() {
  if (!isConnected) {
    // Return simulated data when not connected
    const simulatedDistance = Math.floor(Math.random() * 1000);
    const simulatedForce = 1.0 + (Math.random() * 5);
    const simulatedTemp = 20 + (Math.random() * 10); // Simulated temperature
    
    return {
      success: true,
      isSimulated: true,
      distance: simulatedDistance,
      distanceDisplay: `${simulatedDistance.toFixed(2)} mm`,
      force: simulatedForce,
      forceDisplay: `${simulatedForce.toFixed(4)} N`,
      force_mN: simulatedForce * 1000,
      force_mN_Display: `${(simulatedForce * 1000).toFixed(2)} mN`,
      temperature: simulatedTemp,
      temperatureDisplay: `${simulatedTemp.toFixed(1)} °C`,
      message: 'Using simulated data - Modbus not connected'
    };
  }
  
  try {
    // Read distance (16-bit integer, already in mm)
    const distanceResult = await safeReadRegisters(REG_DISTANCE, 1);
    const distanceRegister = distanceResult.data[0];
    
    // Read force (32-bit float, already in mN based on your comment)
    const forceResult = await safeReadRegisters(REG_FORCE, 2);
    const forceRegisters = forceResult.data;
    
    // Read temperature (assuming 16-bit integer, already in °C)
    const tempResult = await safeReadRegisters(REG_TEMP, 1);
    const tempRegister = tempResult.data[0];
    
    // Convert force to float (from 32-bit float)
    const forceFloat = registersToFloat32LE(forceRegisters[0], forceRegisters[1]);
    
    // Note: According to your comment, force is already in mN, not N
    // So we don't need to multiply by 1000
    const distanceMM = distanceRegister; // Already in mm
    const forceMN = forceFloat; // Already in mN
    const forceN = forceFloat / 1000; // Convert to N if needed
    const temperatureC = tempRegister; // Already in °C
    
    return {
      success: true,
      isSimulated: false,
      // Distance data
      distance: distanceMM,
      distanceDisplay: `${distanceMM.toFixed(2)} mm`,
      
      // Force data - both mN and N versions
      force: forceN, // In Newtons
      forceDisplay: `${forceN.toFixed(4)} N`,
      force_mN: forceMN, // In milliNewtons
      force_mN_Display: `${forceMN.toFixed(2)} mN`,
      
      // Temperature data
      temperature: temperatureC,
      temperatureDisplay: `${temperatureC.toFixed(1)} °C`,
      
      // Raw data for debugging
      rawRegisters: {
        distance: distanceRegister,
        force: forceRegisters,
        temperature: tempRegister
      }
    };
    
  } catch (err) {
    console.error("❌ Error reading PLC data:", err.message);
    
    // Fallback to simulated data on read error
    const simulatedDistance = Math.floor(Math.random() * 1000);
    const simulatedForce = 1.0 + (Math.random() * 5);
    const simulatedTemp = 20 + (Math.random() * 10);
    
    return {
      success: true,
      isSimulated: true,
      distance: simulatedDistance,
      distanceDisplay: `${simulatedDistance.toFixed(2)} mm`,
      // force: simulatedForce,
      // forceDisplay: `${simulatedForce.toFixed(4)} N`,
      force_mN: simulatedForce * 1000,
      force_mN_Display: `${(simulatedForce * 1000).toFixed(2)} mN`,
      temperature: simulatedTemp,
      temperatureDisplay: `${simulatedTemp.toFixed(1)} °C`,
      message: `Using simulated data: ${err.message}`
    };
  }
}

// Add this function to main.js
async function debugRegisters() {
  try {
    console.log("=== DEBUG REGISTER VALUES ===");
    
    // Read all three registers
    const distanceResult = await safeReadRegisters(REG_DISTANCE, 1);
    const forceResult = await safeReadRegisters(REG_FORCE, 2);
    const tempResult = await safeReadRegisters(REG_TEMP, 1);
    
    console.log("Distance register (6116):", distanceResult.data);
    console.log("Force registers (54-55):", forceResult.data);
    console.log("Temperature register (501):", tempResult.data);
    
    // Show the actual values
    const distance = distanceResult.data[0];
    const force = registersToFloat32LE(forceResult.data[0], forceResult.data[1]);
    const temp = tempResult.data[0];
    
    console.log(`Distance: ${distance} mm`);
    console.log(`Force: ${force} mN (${force/1000} N)`);
    console.log(`Temperature: ${temp} °C`);
    
  } catch (error) {
    console.error("Debug error:", error);
  }
}

// Call this from an IPC handler if needed
ipcMain.handle("debug-registers", async () => {
  return await debugRegisters();
});
// ============================
// CONFIGURATION FILE FUNCTIONS
// ============================

// Helper function to ensure config file exists
async function ensureConfigFile() {
  try {
    await fsPromises.access(CONFIG_FILE_PATH);
  } catch (error) {
    const headers = 'configName,pathlength,thresholdForce,temperature,retractionLength,numberOfCurves,curveDistances\n';
    await fsPromises.writeFile(CONFIG_FILE_PATH, headers, 'utf8');
    console.log('Created new config file:', CONFIG_FILE_PATH);
  }
}

// Read configuration file
async function readConfigurations() {
  try {
    await ensureConfigFile();
    const content = await fsPromises.readFile(CONFIG_FILE_PATH, 'utf8');
    const lines = content.trim().split('\n');
    
    if (lines.length <= 1) return [];
    
    const configs = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = [];
      let currentPart = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(currentPart);
          currentPart = '';
        } else {
          currentPart += char;
        }
      }
      parts.push(currentPart);
      
      if (parts.length >= 7) {
        let curveDistances = {};
        try {
          if (parts[6] && parts[6] !== '' && parts[6] !== '{}' && parts[6] !== '""') {
            const curveStr = parts[6].replace(/^"|"$/g, '');
            if (curveStr && curveStr !== '{}') {
              curveDistances = JSON.parse(curveStr);
            }
          }
        } catch (e) {
          console.error('Error parsing curveDistances:', e, 'Value:', parts[6]);
          curveDistances = {};
        }
        
        configs.push({
          configName: parts[0],
          pathlength: parts[1],
          thresholdForce: parts[2],
          temperature: parts[3],
          retractionLength: parts[4],
          numberOfCurves: parts[5],
          curveDistances: curveDistances
        });
      }
    }
    
    return configs;
  } catch (error) {
    console.error('Error reading config file:', error);
    return [];
  }
}

// Write configuration file
async function writeConfigurations(configs) {
  try {
    await ensureConfigFile();
    
    let csvContent = 'configName,pathlength,thresholdForce,temperature,retractionLength,numberOfCurves,curveDistances\n';
    
    configs.forEach(config => {
      const curveDistancesStr = config.curveDistances && Object.keys(config.curveDistances).length > 0 ? 
        JSON.stringify(config.curveDistances) : '{}';
      
      const escapedCurveDistances = `"${curveDistancesStr.replace(/"/g, '""')}"`;
      
      csvContent += `${config.configName},${config.pathlength},${config.thresholdForce},${config.temperature},${config.retractionLength},${config.numberOfCurves},${escapedCurveDistances}\n`;
    });
    
    await fsPromises.writeFile(CONFIG_FILE_PATH, csvContent, 'utf8');
    console.log('Config file saved:', CONFIG_FILE_PATH);
    return true;
  } catch (error) {
    console.error('Error writing config file:', error);
    return false;
  }
}

// -------------------------
// Pulse coil helper
// -------------------------
async function pulseCoil(coil) {
  if (!isConnected) {
    throw new Error('Modbus not connected');
  }
  
  try {
    await client.writeCoil(coil, true);
    console.log(`Coil ${coil} turned ON`);
    
    setTimeout(async () => {
      try {
        await client.writeCoil(coil, false);
        console.log(`Coil ${coil} turned OFF`);
      } catch (e) {
        console.error(`Error turning off coil ${coil}:`, e.message);
      }
    }, 2000);
    
  } catch (err) {
    console.error(`Error pulsing coil ${coil}:`, err.message);
    throw err;
  }
}

// -------------------------
// Safe command execution
// -------------------------
async function safeExecute(command, action) {
  try {
    if (!isConnected) {
      throw new Error('Modbus not connected. Please check COM port.');
    }
    
    const result = await action();
    return { 
      success: true, 
      message: `${command} executed successfully`,
      ...result
    };
    
  } catch (err) {
    console.error(`${command} error:`, err.message);
    return { 
      success: false, 
      message: `${command} failed: ${err.message}` 
    };
  }
}

const coilState = {
  heating: false,
  retraction: false,
  manualRet: false
};
// -------------------------
// IPC handlers - ADD MANUAL CONNECT HANDLER
// -------------------------

// NEW: Manual connect handler
ipcMain.handle("connect-modbus", async () => {
  return await manualConnectModbus();
});

ipcMain.handle("home", async () => {
  return await safeExecute("HOME", async () => {
    if (!isConnected) throw new Error("Modbus not connected");

    // Turn ON homing
    await client.writeCoil(COIL_HOME, true);

    return { success: true };
  });
});


ipcMain.handle("start", async () => {
  return await safeExecute("START", async () => {
    if (!isConnected) throw new Error('Modbus not connected');
    
    await client.writeCoil(COIL_STOP, false);
    await client.writeCoil(COIL_RESET, false);
    await client.writeCoil(COIL_START, true);
    
    return { startInitiated: true };
  });
});

ipcMain.handle("stop", async () => {
  return await safeExecute("STOP", async () => {
    if (!isConnected) throw new Error('Modbus not connected');
    
    await client.writeCoil(COIL_START, false);
    await client.writeCoil(COIL_STOP, true);
    
    return { stopPressed: true };
  });
});

ipcMain.handle("reset", async () => {
  return await safeExecute("RESET", async () => {
    if (!isConnected) throw new Error('Modbus not connected');
    
    await client.writeCoil(COIL_RESET, true);
    await client.writeCoil(COIL_STOP, false);
    
    return { resetPressed: true };
  });
});

ipcMain.handle("heating", async () => {
  return await safeExecute("HEATING", async () => {
    if (!isConnected) throw new Error("Modbus not connected");

    coilState.heating = !coilState.heating;
    await client.writeCoil(COIL_HEATING, coilState.heating);

    return { heating: coilState.heating };
  });
});

ipcMain.handle("retraction", async () => {
  return await safeExecute("RETRACTION", async () => {
    if (!isConnected) throw new Error("Modbus not connected");

    coilState.retraction = !coilState.retraction;
    await client.writeCoil(COIL_RETRACTION, coilState.retraction);

    return { retraction: coilState.retraction };
  });
});


ipcMain.handle("manual", async () => {
  return await safeExecute("MANUAL-MODE", async () => {
    if (!isConnected) throw new Error('Modbus not connected');
    await client.writeCoil(COIL_MANUAL, true);
    await client.writeCoil(COIL_RET, false);
    await client.writeCoil(COIL_INSERTION, false);
    await client.writeCoil(COIL_CLAMP, false);
    return { manualModeActivated: true };
  });
});

let clampState = false;
ipcMain.handle("clamp", async () => {
  return await safeExecute("CLAMP", async () => {
    if (!isConnected) throw new Error("Modbus not connected");

    clampState = !clampState;

    await client.writeCoil(COIL_MANUAL, true);
    // await client.writeCoil(COIL_RET, false);
    // await client.writeCoil(COIL_INSERTION, false);

    await client.writeCoil(COIL_CLAMP, clampState);

    return {
      clampState: clampState ? "ON" : "OFF",
      message: `Clamp turned ${clampState ? "ON" : "OFF"}`
    };
  });
});

let insertionState = false;

ipcMain.handle("insertion", async () => {
  return await safeExecute("INSERTION", async () => {
    if (!isConnected) throw new Error("Modbus not connected");

    insertionState = !insertionState;

    await client.writeCoil(COIL_MANUAL, true);
    await client.writeCoil(COIL_RET, false);
    await client.writeCoil(COIL_INSERTION, insertionState);
    // await client.writeCoil(COIL_CLAMP, false); // optional safety

    return {
      insertionState: insertionState ? "ON" : "OFF",
      message: `Insertion turned ${insertionState ? "ON" : "OFF"}`
    };
  });
});

let retState = false;

ipcMain.handle("ret", async () => {
  return await safeExecute("RETRACTION_MANUAL", async () => {
    if (!isConnected) throw new Error("Modbus not connected");

    retState = !retState;

    await client.writeCoil(COIL_MANUAL, true);
    await client.writeCoil(COIL_RET, retState);
    await client.writeCoil(COIL_INSERTION, false);
    // await client.writeCoil(COIL_CLAMP, false); // optional safety

    return {
      retState: retState ? "ON" : "OFF",
      message: `Manual Retraction turned ${retState ? "ON" : "OFF"}`
    };
  });
});

// ipcMain.handle("ret", async () => {
//   return await safeExecute("RETRACTION-MANUAL", async () => {
//     if (!isConnected) throw new Error("Modbus not connected");

//     coilState.manualRet = !coilState.manualRet;

//     await client.writeCoil(COIL_MANUAL, true);
//     await client.writeCoil(COIL_RET, coilState.manualRet);
//     await client.writeCoil(COIL_INSERTION, false);
//     await client.writeCoil(COIL_CLAMP, false);

//     return { manualRetraction: coilState.manualRet };
//   });
// });

// Read data handler
ipcMain.handle("read-data", async () => {
  return await readPLCData();
});

// Check connection status
ipcMain.handle("check-connection", () => {
  return { 
    connected: isConnected, 
    port: PORT,
    timestamp: new Date().toISOString()
  };
});

// Reconnect command
ipcMain.handle("reconnect", async () => {
  try {
    console.log("Attempting to reconnect...");
    
    if (client.isOpen) {
      client.close();
      console.log("Closed existing connection");
    }
    
    isConnected = false;
    
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('modbus-status', 'disconnected');
    }
    
    const connected = await manualConnectModbus();
    
    return { 
      success: true, 
      connected: connected,
      message: connected ? 'Reconnected successfully' : 'Failed to reconnect'
    };
    
  } catch (err) {
    console.error("Reconnect error:", err.message);
    return { 
      success: false, 
      error: err.message,
      connected: false
    };
  }
});

// ============================
// CONFIGURATION IPC HANDLERS
// ============================

// Read configuration file
ipcMain.handle("read-config-file", async () => {
  return await readConfigurations();
});

// Write configuration file
ipcMain.handle("write-config-file", async (event, configs) => {
  return await writeConfigurations(configs);
});

// Delete configuration
ipcMain.handle("delete-config-file", async (event, configName) => {
  try {
    const configs = await readConfigurations();
    const updatedConfigs = configs.filter(config => config.configName !== configName);
    return await writeConfigurations(updatedConfigs);
  } catch (error) {
    console.error('Error deleting config:', error);
    return false;
  }
});

// Send process mode configuration to PLC
// Send process mode configuration to PLC (with float support)
// Send process mode configuration to PLC
ipcMain.handle("send-process-mode", async (event, config) => {
  try {
    console.log('🔧 Process mode config received:', config);
    
    if (!isConnected || !client.isOpen) {
      console.error('❌ Cannot send process mode: Modbus not connected');
      return false;
    }
    
    // Parse configuration values
    const pathLength = parseInt(config.pathlength);
    const thresholdForce = parseFloat(config.thresholdForce); // mN
    const temperature = parseFloat(config.temperature); // °C
    const retractionLength = parseFloat(config.retractionLength); // mm
    
    console.log('📊 Parsed config values:', {
      pathLength: `${pathLength} mm`,
      thresholdForce: `${thresholdForce} mN`,
      temperature: `${temperature} °C`,
      retractionLength: `${retractionLength} mm`
    });
    
    // Validate values
    if (isNaN(pathLength) || isNaN(thresholdForce) || isNaN(temperature) || isNaN(retractionLength)) {
      console.error('❌ Invalid configuration values');
      return false;
    }
    
    let allSuccess = true;
    const results = [];
    
    try {
      // 1. Write Path Length to address 6000 (D0)
      console.log(`📝 Writing Path Length: ${pathLength} mm to address 6000`);
      await client.writeRegister(6000, pathLength);
      console.log('✅ Path Length written to address 6000');
      results.push({ register: '6000 (D0)', value: pathLength, success: true });
      
      // 2. Write Threshold Force to R150 (address 150)
      console.log(`📝 Writing Threshold Force: ${thresholdForce} mN to R150 (address 150)`);
      const thresholdForceValue = Math.round(thresholdForce);
      await client.writeRegister(150, thresholdForceValue);
      console.log('✅ Threshold Force written to R150');
      results.push({ register: '150 (R150)', value: thresholdForceValue, success: true });
      
      // 3. Write Temperature to R510 (address 510)
      console.log(`📝 Writing Temperature: ${temperature}°C to R510 (address 510)`);
      const temperatureValue = Math.round(temperature * 10); // Store with 0.1°C precision
      await client.writeRegister(510, temperatureValue);
      console.log('✅ Temperature written to R510');
      results.push({ register: '510 (R510)', value: temperatureValue, success: true });
      
      // 4. Write Retraction Stroke Length to R122 (address 122)
      console.log(`📝 Writing Retraction Stroke Length: ${retractionLength} mm to R122 (address 122)`);
      const retractionValue = Math.round(retractionLength);
      await client.writeRegister(122, retractionValue);
      console.log('✅ Retraction Stroke Length written to R122');
      results.push({ register: '122 (R122)', value: retractionValue, success: true });
      
      console.log('✅ All configuration values successfully written to PLC');
      console.log('📋 Write operation results:', results);
      
      // Optional: Verify the writes by reading back
      console.log('🔄 Verifying written values...');
      try {
        const verify6000 = await client.readHoldingRegisters(6000, 1);
        const verify150 = await client.readHoldingRegisters(150, 1);
        const verify510 = await client.readHoldingRegisters(510, 1);
        const verify122 = await client.readHoldingRegisters(122, 1);
        
        console.log('🔍 Verification reads:', {
          '6000 (Path Length)': verify6000.data[0],
          '150 (Threshold Force)': verify150.data[0],
          '510 (Temperature)': verify510.data[0],
          '122 (Retraction)': verify122.data[0]
        });
        
        // Check if values match
        const verificationPassed = 
          verify6000.data[0] === pathLength &&
          verify150.data[0] === thresholdForceValue &&
          verify510.data[0] === temperatureValue &&
          verify122.data[0] === retractionValue;
          
        if (verificationPassed) {
          console.log('✅ All values verified successfully!');
        } else {
          console.warn('⚠️ Some values may not have been written correctly');
        }
        
      } catch (verifyError) {
        console.log('⚠️ Could not verify writes (reading failed):', verifyError.message);
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Error writing to PLC:', error.message);
      
      // More detailed error information
      if (error.message.includes('6000')) {
        console.error('⚠️ Specific error writing to address 6000 (Path Length)');
        console.error('Check if address 6000 is a valid holding register in your PLC');
      } else if (error.message.includes('150')) {
        console.error('⚠️ Specific error writing to address 150 (Threshold Force)');
      } else if (error.message.includes('510')) {
        console.error('⚠️ Specific error writing to address 510 (Temperature)');
      } else if (error.message.includes('122')) {
        console.error('⚠️ Specific error writing to address 122 (Retraction)');
      }
      
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error sending process mode:', error);
    return false;
  }
});

// -------------------------
// App lifecycle - FIXED
// -------------------------
app.whenReady().then(() => {
  createWindow();
  // DON'T call connectModbus() here - it's called via autoConnectPort()
});

// Close port when app quits
app.on('window-all-closed', () => {
  if (client.isOpen) {
    console.log("Closing Modbus connection...");
    client.close();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle unexpected errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    dialog.showErrorBox(
      'Application Error',
      `An unexpected error occurred:\n${error.message}\n\nThe application may not function correctly.`
    );
  }
});