const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const ModbusRTU = require("modbus-serial"); 
const path = require("path");
import "./index.css";
const fs = require('fs');  // Changed from fs.promises to regular fs for sync operations
const fsPromises = require('fs').promises;  // Keep for async operations

import { pathToFileURL } from 'node:url';
const MAIN_WINDOW_VITE_DEV_SERVER_URL = !app.isPackaged ? 'http://localhost:5173' : null;

let mainWindow;
// if (started){
//   app.quit();
// }
// ============================
// CSV LOGGING STATE
// ============================
let csvStream = null;
let csvFilePath = null;
// -------------------------
// Modbus / PLC settings - UPDATED BASED ON PYTHON CODE
// -------------------------
const PORT = "COM4";
const BAUDRATE = 9600;
const TIMEOUT = 1;

const COIL_HOME  = 2001;
const COIL_LLS = 1000;
const COIL_START = 2002;
const COIL_STOP  = 2003;
const COIL_RESET = 2004;
const COIL_HEATING = 2005;
const COIL_RETRACTION = 2006;
const COIL_MANUAL = 2070;
const COIL_INSERTION = 2008;
const COIL_RET = 2009;
const COIL_CLAMP = 2007;
const REG_DISTANCE   = 6116;  // 1 register (16-bit integer) - UPDATED
const REG_FORCE      = 54;    // 2 registers (32-bit float) - UPDATED
const REG_TEMP    = 501;// 
const REG_MANUAL_DISTANCE = 6550;
let isConnected = false;
let dataReadingActive = false;
const client = new ModbusRTU();

// ============================
// CONFIGURATION FILE SETTINGS
// ============================
const CONFIG_FILE_PATH = path.join(app.getPath('documents'), 'SCTTM.json');

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

// Add this variable near the top with other state variables
let lastLLSState = false;

// Add this function to monitor COIL_LLS
async function checkLLSStatus() {
  try {
    if (!isConnected) return;
    
    // Read COIL_LLS status
    const llsResult = await client.readCoils(COIL_LLS, 1);
    const currentLLSState = llsResult.data[0];
    
    // If LLS changed to TRUE
    if (currentLLSState && !lastLLSState) {
      console.log("✅ COIL_LLS became TRUE - Homing should be complete");
      
      // Send notification to UI that homing is complete
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lls-status', 'true');
      }
    }
    
    // Update last state
    lastLLSState = currentLLSState;
    
  } catch (err) {
    console.error("Error checking COIL_LLS:", err.message);
  }
}

// Start checking LLS periodically
setInterval(checkLLSStatus, 500);


// ============================
// CSV LOGGING FUNCTIONS
// ============================

async function startCSVLogging(config) {
  try {
    const logsDir = path.join(app.getPath("documents"), "SCTTM_Logs");

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    csvFilePath = path.join(
      logsDir,
      `${config.configName || "Process"}_${timestamp}.csv`
    );

    csvStream = fs.createWriteStream(csvFilePath, { flags: "a" });

    // CSV HEADER
    csvStream.write(
      "Timestamp,Distance(mm),Force(mN),Temperature,ConfigName,PathLength,ThresholdForce,BathTemperature,RetractionStrokelength,NumberOfCurves,CurveDistances\n"
    );

    return { success: true, filePath: csvFilePath };
  } catch (error) {
    console.error("CSV start error:", error);
    return { success: false, error: error.message };
  }
}

async function appendCSVData(data, config) {
  try {
    if (!csvStream) {
      throw new Error("CSV stream not initialized");
    }

    const row = [
      new Date().toISOString(),
      data.distance,
      data.force_mN,
      data.temperature,
      config.configName,
      config.pathlength,
      config.thresholdForce,
      config.temperature,
      config.retractionLength,
      config.numberOfCurves,
      JSON.stringify(config.curveDistances || {})
    ].join(",") + "\n";

    csvStream.write(row);
    return { success: true };
  } catch (error) {
    console.error("CSV append error:", error);
    return { success: false, error: error.message };
  }
}

async function stopCSVLogging() {
  try {
    if (csvStream) {
      csvStream.end();
      csvStream = null;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================
// CSV LOGGING - FILE READING FUNCTIONS
// ============================

async function getLogFiles() {
  try {
    const logsDir = path.join(app.getPath("documents"), "SCTTM_Logs");
    
    if (!fs.existsSync(logsDir)) {
      return [];
    }
    
    const files = await fsPromises.readdir(logsDir);
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    
    const logFiles = [];
    
    for (const file of csvFiles) {
      const filePath = path.join(logsDir, file);
      const stats = await fsPromises.stat(filePath);
      
      // Extract configuration name and timestamp from filename
      const fileNameWithoutExt = file.replace('.csv', '');
      const parts = fileNameWithoutExt.split('_');
      const configName = parts.slice(0, -1).join('_');
      const timestamp = parts[parts.length - 1];
      
      logFiles.push({
        filename: file,
        displayName: `${configName} - ${new Date(timestamp.replace(/-/g, ':')).toLocaleString()}`,
        filePath: filePath,
        date: stats.mtime.toISOString().split('T')[0],
        time: timestamp,
        configName: configName
      });
    }
    
    // Sort by date (newest first)
    return logFiles.sort((a, b) => new Date(b.time) - new Date(a.time));
    
  } catch (error) {
    console.error('Error getting log files:', error);
    return [];
  }
}

async function readLogFile(filePath) {
  try {
    const data = await fsPromises.readFile(filePath, 'utf8');
    const lines = data.trim().split('\n');
    
    if (lines.length <= 1) {
      return { success: false, error: 'Empty or invalid CSV file' };
    }
    
    const headers = lines[0].split(',');
    const configData = extractConfigFromCsv(data);
    const processData = [];
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      
      const values = lines[i].split(',');
      if (values.length >= 3) {
        const timeMatch = values[0].match(/T(\d{2}):(\d{2}):(\d{2})/);
        let timeValue = i-1; // Default to index if time parsing fails
        let force = parseFloat(values[2]) || 0;
        let distance = parseFloat(values[1]) || 0;
        
        // Convert force from mN to N for better display
        const forceN = force / 1000;
        
        processData.push({
          time: timeValue,
          distance: distance,
          force: forceN,
          temperature: parseFloat(values[3]) || 0
        });
      }
    }
    
    return {
      success: true,
      data: processData,
      configData: configData,
      rawData: data
    };
    
  } catch (error) {
    console.error('Error reading log file:', error);
    return { success: false, error: error.message };
  }
}

function extractConfigFromCsv(csvData) {
  const lines = csvData.split('\n');

  const config = {
    configName: 'Unknown',
    pathlength: '--',
    thresholdForce: '--',
    temperature: '--',        // BathTemperature
    retractionLength: '--',   // RetractionStrokelength
    numberOfCurves: '--',
    curveDistances: {}
  };

  // Read configuration from first data row
  if (lines.length > 1) {
    const firstDataRow = lines[1].split(',');

    // Ensure row has enough columns
    if (firstDataRow.length >= 11) {
      config.configName       = firstDataRow[4] || 'Unknown';
      config.pathlength       = firstDataRow[5] || '--';
      config.thresholdForce   = firstDataRow[6] || '--';
      config.temperature      = firstDataRow[7] || '--';   // ✅ BathTemperature
      config.retractionLength = firstDataRow[8] || '--';   // ✅ RetractionStrokelength
      config.numberOfCurves   = firstDataRow[9] || '--';

      // Parse curve distances
      try {
        if (firstDataRow[10]) {
          const curveDistancesStr = firstDataRow[10].replace(/\\"/g, '"');
          config.curveDistances = JSON.parse(curveDistancesStr);
        }
      } catch (e) {
        console.log('Could not parse curve distances:', e.message);
      }
    }
  }

  return config;
}


async function deleteLogFile(filePath) {
  try {
    await fsPromises.unlink(filePath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting log file:', error);
    return { success: false, error: error.message };
  }
}

// -------------------------
// Create Window - UPDATED
// -------------------------
function createWindow() {
  // -------------------------
  // Resolve preload differently in dev vs prod
  // -------------------------
  const preloadPath = app.isPackaged
    ? path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        '.vite',
        'build',
        'preload',
        'preload.js'
      )
    : path.join(__dirname, '../../../src/preload.js');

  console.log('Preload path:', preloadPath);
  console.log('Preload file exists:', require('fs').existsSync(preloadPath));

  // -------------------------
  // Create the main window
  // -------------------------
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Remove the menu completely
  mainWindow.setMenu(null);

  // -------------------------
  // Load renderer HTML
  // -------------------------
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // Development → Vite Dev Server
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    // Production → packaged HTML in app.asar.unpacked
    const indexPath = app.isPackaged
      ? path.join(
          process.resourcesPath,
          'app.asar.unpacked',
          'src',
          '.vite',
          'build',
          'renderer',
          'main_window',
          'index.html'
        )
      : path.join(__dirname, '../.vite/build/renderer/main_window/index.html');

    // Load from inside app.asar in production
    if (app.isPackaged) {
      console.log('Loading renderer from:', indexPath);
      mainWindow.loadFile(indexPath);
    } else {
      mainWindow.loadURL(pathToFileURL(indexPath).href);
    }
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
      console.log("Disabling manual mode and closing Modbus connection...");
      
      try {
        // Send coil off commands before closing
        client.writeCoil(COIL_MANUAL, false);
        client.writeCoil(COIL_RET, false);
        client.writeCoil(COIL_INSERTION, false);
        client.writeCoil(COIL_CLAMP, false);
        
        // Small delay to ensure commands are sent before closing
        setTimeout(() => {
          client.close();
          isConnected = false;
          console.log("Modbus connection closed.");
        }, 50);
        
      } catch (err) {
        console.error("Error during cleanup:", err.message);
        // Still close the connection even if there's an error
        client.close();
        isConnected = false;
      }
    } else {
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
// async function readPLCData() {
//   if (!isConnected) {
//     // Connection not established
//     return {
//       success: false,
//       message: 'Not connected to PLC'
//     };
//   }
  
//   try {
//     // Read distance (16-bit integer, already in mm)
//     const distanceResult = await safeReadRegisters(REG_DISTANCE, 1);
//     const distanceMM = distanceResult.data[0];
    
//     // Read force (32-bit float, already in mN)
//     const forceResult = await safeReadRegisters(REG_FORCE, 2);
//     const forceRegisters = forceResult.data;
//     const forceMN = registersToFloat32LE(forceRegisters[0], forceRegisters[1]);
    
//     // Read temperature (16-bit integer, already in °C)
//     const tempResult = await safeReadRegisters(REG_TEMP, 1);
//     const temperatureC = tempResult.data[0];

//     const manualDistanceResult = await safeReadRegisters(REG_MANUAL_DISTANCE, 1);
//     const manualDistance = manualDistanceResult.data[0];

//      // 🔍 DEBUG LOG — ADD THIS SECTION
//     console.log("=========================================");
//     console.log(" PLC LIVE DATA RECEIVED");
//     console.log("-----------------------------------------");
//     console.log("RAW REGISTERS:");
//     console.log("  Distance (70):", distanceMM);
//     console.log("  Force (54,55):", forceRegisters);
//     console.log("  Temperature (501):", temperatureC);
//     console.log("-----------------------------------------");
//     console.log("DECODED VALUES:");
//     console.log(`  Distance:      ${distanceMM} mm`);
//     console.log(`  Force:         ${forceMN.toFixed(2)} mN`);
//     // console.log(`  Temperature:   ${temperatureC} °C`);
//     console.log(`  Temperature Display: ${temperatureC.toFixed(1)} °C`);
//     console.log(" Manual Distance:", manualDistance);
//     console.log("=========================================");
    
//     return {
//       success: true,
//       // Distance data - already in mm
//       distance: distanceMM,
//       distanceDisplay: `${distanceMM} mm`,
      
//       // Force data - already in mN
//       force_mN: forceMN,
//       forceDisplay: `${forceMN.toFixed(2)} mN`,
      
//       // Temperature data - already in °C
//       temperature: temperatureC,
//       temperatureDisplay: `${temperatureC} °C`,

//       manualDistance: manualDistance,   // NEW
//       manualDistanceDisplay: `${manualDistance} mm`,  // NEW
      
//       // Raw data for debugging
//       rawRegisters: {
//         distance: distanceMM,
//         force: forceRegisters,
//         temperature: temperatureC,
//         manualDistance: manualDistance
//       }
//     };
    
//   } catch (err) {
//     console.error("❌ Error reading PLC data:", err.message);
    
//     return {
//       success: false,
//       message: `Failed to read PLC data: ${err.message}`
//     };
//   }
// }
async function readPLCData() {
  if (!isConnected) {
    // Connection not established
    return {
      success: false,
      message: 'Not connected to PLC'
    };
  }
  
  try {
    // Read distance (16-bit integer, already in mm)
    const distanceResult = await safeReadRegisters(REG_DISTANCE, 1);
    const distanceMM = distanceResult.data[0];
    
    // Read force (32-bit float, already in mN)
    const forceResult = await safeReadRegisters(REG_FORCE, 2);
    const forceRegisters = forceResult.data;
    const forceMN = registersToFloat32LE(forceRegisters[0], forceRegisters[1]);
    
    // Read temperature (16-bit integer, multiply by 10 for precision)
    const tempResult = await safeReadRegisters(REG_TEMP, 1);
    const temperatureRaw = tempResult.data[0];
    // Divide by 10 to get actual temperature in °C
    const temperatureC = temperatureRaw / 10;

    const manualDistanceResult = await safeReadRegisters(REG_MANUAL_DISTANCE, 1);
    const manualDistance = manualDistanceResult.data[0];

     // 🔍 DEBUG LOG — ADD THIS SECTION
    console.log("=========================================");
    console.log(" PLC LIVE DATA RECEIVED");
    console.log("-----------------------------------------");
    console.log("RAW REGISTERS:");
    console.log("  Distance (70):", distanceMM);
    console.log("  Force (54,55):", forceRegisters);
    console.log("  Temperature (501):", temperatureRaw);
    console.log("-----------------------------------------");
    console.log("DECODED VALUES:");
    console.log(`  Distance:      ${distanceMM} mm`);
    console.log(`  Force:         ${forceMN.toFixed(2)} mN`);
    console.log(`  Temperature (raw): ${temperatureRaw}`);
    console.log(`  Temperature (actual): ${temperatureC.toFixed(1)} °C`);
    console.log(" Manual Distance:", manualDistance);
    console.log("=========================================");
    
    return {
      success: true,
      // Distance data - already in mm
      distance: distanceMM,
      distanceDisplay: `${distanceMM} mm`,
      
      // Force data - already in mN
      force_mN: forceMN,
      forceDisplay: `${forceMN.toFixed(2)} mN`,
      
      // Temperature data - divide by 10 to get actual °C
      temperature: temperatureC,
      temperatureDisplay: `${temperatureC.toFixed(1)} °C`,

      manualDistance: manualDistance,   // NEW
      manualDistanceDisplay: `${manualDistance} mm`,  // NEW
      
      // Raw data for debugging
      rawRegisters: {
        distance: distanceMM,
        force: forceRegisters,
        temperature: temperatureRaw,  // Keep raw value here
        manualDistance: manualDistance
      }
    };
    
  } catch (err) {
    console.error("❌ Error reading PLC data:", err.message);
    
    return {
      success: false,
      message: `Failed to read PLC data: ${err.message}`
    };
  }
}
// ============================
// CONFIGURATION FILE FUNCTIONS
// ============================

// ============================
// CONFIGURATION FILE SETTINGS
// ===========================

// Helper function to ensure config file exists
async function ensureConfigFile() {
  try {
    await fsPromises.access(CONFIG_FILE_PATH);
  } catch (error) {
    // Create empty JSON array for configurations
    const emptyConfigs = [];
    await fsPromises.writeFile(CONFIG_FILE_PATH, JSON.stringify(emptyConfigs, null, 2), 'utf8');
    console.log('Created new JSON config file:', CONFIG_FILE_PATH);
  }
}

// Read configuration file (JSON format)
async function readConfigurations() {
  try {
    await ensureConfigFile();

    const data = await fsPromises.readFile(CONFIG_FILE_PATH, 'utf8');
    
    try {
      const configs = JSON.parse(data);
      // Ensure curveDistances exists for each config
      return configs.map(config => ({
        ...config,
        curveDistances: config.curveDistances || {}
      }));
    } catch (parseError) {
      console.error('Error parsing JSON config file:', parseError);
      // If JSON is invalid, return empty array
      return [];
    }
  } catch (error) {
    console.error('Error reading config file:', error);
    return [];
  }
}

// Write configuration file (JSON format)
async function writeConfigurations(configs) {
  try {
    // Ensure curveDistances is properly formatted
    const formattedConfigs = configs.map(config => ({
      configName: config.configName || '',
      pathlength: config.pathlength || '',
      thresholdForce: config.thresholdForce || '',
      temperature: config.temperature || '',
      retractionLength: config.retractionLength || '',
      numberOfCurves: config.numberOfCurves || '',
      curveDistances: config.curveDistances || {}
    }));

    await fsPromises.writeFile(
      CONFIG_FILE_PATH, 
      JSON.stringify(formattedConfigs, null, 2), 
      'utf8'
    );
    return true;
  } catch (error) {
    console.error('Error writing JSON config file:', error);
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
// -------------------------
// Safe command execution - UPDATED FIXED VERSION
// -------------------------
async function safeExecute(command, action) {
  try {
    if (!isConnected || !client.isOpen) {
      console.log(`❌ ${command}: Modbus not connected`);
      return { 
        success: false, 
        message: 'Modbus not connected. Please check COM port.',
        error: 'NOT_CONNECTED'
      };
    }
    
    const result = await action();
    console.log(`✅ ${command}: executed successfully`);
    return { 
      success: true, 
      message: `${command} executed successfully`,
      ...result
    };
    
  } catch (err) {
    console.error(`❌ ${command} error:`, err.message);
    return { 
      success: false, 
      message: `${command} failed: ${err.message}`,
      error: err.message
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
    await client.writeCoil(COIL_RETRACTION, false);
    
    return { startInitiated: true };
  });
});

ipcMain.handle("stop", async () => {
  return await safeExecute("STOP", async () => {
    if (!isConnected) throw new Error('Modbus not connected');
    
    await client.writeCoil(COIL_START, false);
    await client.writeCoil(COIL_STOP, true);
    await client.writeCoil(COIL_RETRACTION, false);

    
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
    await client.writeCoil(COIL_STOP, false);
    await client.writeCoil(COIL_START, false);

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

// Add near other IPC handlers in main.js
ipcMain.handle("disable-manual-mode", async () => {
  return await safeExecute("DISABLE-MANUAL-MODE", async () => {
    if (!isConnected) throw new Error('Modbus not connected');
    
    // Turn off COIL_MANUAL
    await client.writeCoil(COIL_MANUAL, false);
    
    // Also turn off related coils
    await client.writeCoil(COIL_RET, false);
    await client.writeCoil(COIL_INSERTION, false);
    await client.writeCoil(COIL_CLAMP, false);
    
    return { manualModeDisabled: true };
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

// ipcMain.handle("send-process-mode", async (event, config) => {
//   try {
//     console.log('🔧 Process mode config received:', config);
    
//     if (!isConnected || !client.isOpen) {
//       console.error('❌ Cannot send process mode: Modbus not connected');
//       return false;
//     }
    
//     // Parse configuration values
//     const pathLength = parseInt(config.pathlength);
//     const thresholdForce = parseFloat(config.thresholdForce); // mN
//     const temperature = parseFloat(config.temperature); // °C
//     const retractionLength = parseFloat(config.retractionLength); // mm
    
//     console.log('📊 Parsed config values:', {
//       pathLength: `${pathLength} mm`,
//       thresholdForce: `${thresholdForce} mN`,
//       temperature: `${temperature} °C`,
//       retractionLength: `${retractionLength} mm`
//     });
    
//     // Validate values
//     if (isNaN(pathLength) || isNaN(thresholdForce) || isNaN(temperature) || isNaN(retractionLength)) {
//       console.error('❌ Invalid configuration values');
//       return false;
//     }
    
//     // Prepare all write operations to run in parallel
//     const writeOperations = [
//       {
//         name: 'Path Length',
//         address: 6000,
//         value: pathLength,
//         description: `${pathLength} mm`
//       },
//       {
//         name: 'Threshold Force',
//         address: 150,
//         value: Math.round(thresholdForce),
//         description: `${thresholdForce} mN`
//       },
//       {
//         name: 'Temperature',
//         address: 510,
//         value: Math.round(temperature * 10), // Store with 0.1°C precision
//         description: `${temperature} °C`
//       },
//       {
//         name: 'Retraction Stroke Length',
//         address: 122,
//         value: Math.round(retractionLength),
//         description: `${retractionLength} mm`
//       }
//     ];
    
//     console.log('🚀 Starting parallel write operations...');
    
//     // Execute all writes in parallel
//     const writePromises = writeOperations.map(async (operation) => {
//       try {
//         console.log(`📝 Writing ${operation.name}: ${operation.description} to address ${operation.address}`);
//         await client.writeRegister(operation.address, operation.value);
//         console.log(`✅ ${operation.name} written successfully`);
//         return {
//           name: operation.name,
//           address: operation.address,
//           value: operation.value,
//           success: true,
//           error: null
//         };
//       } catch (error) {
//         console.error(`❌ Error writing ${operation.name} to address ${operation.address}:`, error.message);
//         return {
//           name: operation.name,
//           address: operation.address,
//           value: operation.value,
//           success: false,
//           error: error.message
//         };
//       }
//     });
    
//     // Wait for all write operations to complete
//     const results = await Promise.allSettled(writePromises);
    
//     // Process results
//     const successfulWrites = [];
//     const failedWrites = [];
    
//     results.forEach((result, index) => {
//       if (result.status === 'fulfilled') {
//         const operationResult = result.value;
//         if (operationResult.success) {
//           successfulWrites.push(operationResult);
//         } else {
//           failedWrites.push(operationResult);
//         }
//       } else {
//         failedWrites.push({
//           name: writeOperations[index].name,
//           address: writeOperations[index].address,
//           error: result.reason?.message || 'Unknown error'
//         });
//       }
//     });
    
//     console.log('📋 Write operation summary:', {
//       total: writeOperations.length,
//       successful: successfulWrites.length,
//       failed: failedWrites.length
//     });
    
//     if (failedWrites.length > 0) {
//       console.error('⚠️ Some writes failed:', failedWrites);
//     }
    
//     // Optional: Parallel verification (if all writes succeeded)
//     if (failedWrites.length === 0) {
//       console.log('🔄 Starting parallel verification...');
      
//       const verifyPromises = writeOperations.map(async (operation) => {
//         try {
//           const readResult = await client.readHoldingRegisters(operation.address, 1);
//           const readValue = readResult.data[0];
//           const matches = readValue === operation.value;
          
//           console.log(`🔍 ${operation.name}: written=${operation.value}, read=${readValue}, match=${matches}`);
          
//           return {
//             name: operation.name,
//             address: operation.address,
//             written: operation.value,
//             read: readValue,
//             match: matches
//           };
//         } catch (error) {
//           console.error(`❌ Error verifying ${operation.name}:`, error.message);
//           return {
//             name: operation.name,
//             address: operation.address,
//             error: error.message
//           };
//         }
//       });
      
//       const verifyResults = await Promise.allSettled(verifyPromises);
//       const allVerified = verifyResults.every(result => 
//         result.status === 'fulfilled' && result.value.match !== false
//       );
      
//       if (allVerified) {
//         console.log('✅ All values verified successfully!');
//       } else {
//         console.warn('⚠️ Verification shows some values may not match');
//       }
//     }
    
//     return failedWrites.length === 0;
    
//   } catch (error) {
//     console.error('❌ Error sending process mode:', error);
//     return false;
//   }
// });

// ============================
// CSV LOGGING IPC
// ============================

ipcMain.handle("csv-start", async (event, config) => {
  return await startCSVLogging(config);
});

ipcMain.handle("csv-append", async (event, payload) => {
  const { data, config } = payload;
  return await appendCSVData(data, config);
});

ipcMain.handle("csv-stop", async () => {
  return await stopCSVLogging();
});
// ============================
// CSV FILE MANAGEMENT IPC HANDLERS
// ============================

ipcMain.handle("get-log-files", async () => {
  return await getLogFiles();
});

ipcMain.handle("read-log-file", async (event, filePath) => {
  return await readLogFile(filePath);
});

ipcMain.handle("delete-log-file", async (event, filePath) => {
  return await deleteLogFile(filePath);
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
