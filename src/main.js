const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const ModbusRTU = require("modbus-serial");
const { SerialPort } = require('serialport');
const path = require("path");
import { log } from "node:console";
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
let PORT = null; // Auto-detected
const BAUDRATE = 9600;
const TIMEOUT = 0; // Using buffered read, timeout not as critical in this config

const COIL_HOME = 2001;
const COIL_LLS = 1000;
const COIL_START = 2002;
const COIL_STOP = 2003;
const COIL_RESET = 2004;
const COIL_HEATING = 2012;
const COIL_HEATER = 2005;
const COIL_RETRACTION = 2006;
const COIL_MANUAL = 2070;
const COIL_INSERTION = 2008;
const COIL_RET = 2009;
const COIL_CLAMP = 2007;

const REG_DISTANCE = 70;  // 1 register (16-bit integer)
const REG_FORCE = 54;  // 2 registers (32-bit float)
const REG_TEMP = 501; // 1 register (16-bit integer)
const REG_MANUAL_DISTANCE = 6550; // 1 register (16-bit integer)

// Global State
let isConnected = false;
const client = new ModbusRTU();

// PLC Cache & Command Queue
let plcState = {
  distance: 0,
  force_mN: 0,
  temperature: 0,
  manualDistance: 0,
  coilLLS: false,
  lastUpdated: 0
};

// Queue items: { id, type: 'write', task: async () => {}, resolve, reject }
const commandQueue = [];
let isLoopRunning = false;

// ============================
// CONFIGURATION FILE SETTINGS
// ============================
const CONFIG_FILE_PATH = path.join(app.getPath('documents'), 'SCTTM.json');

// -------------------------
// Connect Modbus - UPDATED
// -------------------------
// -------------------------
// Connect Modbus - UPDATED
// -------------------------
async function connectModbus(targetPort) {
  try {
    console.log("🔌 Attempting to connect to Modbus on", targetPort);

    // Close existing connection if any
    if (client.isOpen) {
      client.close();
    }

    await client.connectRTUBuffered(targetPort, {
      baudRate: BAUDRATE,
      dataBits: 8,
      stopBits: 1,
      parity: 'Even'
    });

    client.setID(1);
    client.setTimeout(200); // 200ms timeout for faster disconnection detection
    isConnected = true;
    PORT = targetPort; // Update global
    console.log("✅ Modbus connected on", PORT);

    // Update UI to show connection status
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('modbus-status', 'connected');
    }

    return true;
  } catch (err) {
    isConnected = false;
    // console.log(`Connection failed on ${targetPort}: ${err.message}`);
    return false;
  }
}

// -------------------------
// Helper: Find and Connect to Port logic
// -------------------------
async function findAndConnectPort() {
  try {
    console.log("🔍 Scanning for available COM ports...");
    const ports = await SerialPort.list();
    console.log("Found ports:", ports.map(p => p.path).join(', '));

    if (ports.length === 0) {
      console.log("⚠️ No COM ports found.");
      return false;
    }

    for (const portInfo of ports) {
      const portPath = portInfo.path;
      console.log(`👉 Trying port: ${portPath}`);

      const success = await connectModbus(portPath);
      if (success) {
        // Try to read a coil to verify responsiveness
        try {
          await client.readCoils(COIL_LLS, 1);
          console.log(`✅ Verified Modbus device on ${portPath}`);
          return true;
        } catch (readErr) {
          console.warn(`⚠️ Connected to ${portPath} but read failed. Next...`);
          isConnected = false;
          client.close();
        }
      }
    }

    console.log("❌ Could not find a valid Modbus device on any port.");
    return false;

  } catch (err) {
    console.error("Error scanning ports:", err);
    return false;
  }
}

// -------------------------
// Auto connect to port - UPDATED
// -------------------------
async function autoConnectPort() {
  try {
    console.log("🔄 Attempting auto-connect...");

    // 1. Try last known PORT first if exists
    if (PORT && await connectModbus(PORT)) {
      try {
        await client.readCoils(COIL_LLS, 1);
        console.log(`✅ Quick re-connect successful on ${PORT}`);
        return true;
      } catch (e) {
        console.log(`⚠️ Quick connect failed verify. Scanning all...`);
        isConnected = false;
        client.close();
      }
    }

    // 2. Scan all
    const connected = await findAndConnectPort();

    if (!connected) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('modbus-status', 'disconnected');
      }
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
    console.log("🔌 Manual connection scan...");
    const connected = await autoConnectPort();

    if (!connected && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'Modbus Connection Error',
        `Failed to find compatible Modbus device.\n\nPlease check:\n1. Cable connection\n2. Device power\n3. Port availability`
      );
    }

    return connected;
  } catch (error) {
    console.error("Manual connect error:", error.message);
    return false;
  }
}

// // Add this variable near the top with other state variables
// let lastLLSState = false;

// // Add this function to monitor COIL_LLS
// async function checkLLSStatus() {
//   try {
//     if (!isConnected) return;

//     // Read COIL_LLS status
//     const llsResult = await client.readCoils(COIL_LLS, 1);
//     const currentLLSState = llsResult.data[0];

//     // If LLS changed to TRUE
//     if (currentLLSState && !lastLLSState) {
//       console.log("✅ COIL_LLS became TRUE - Homing should be complete");

//       // Send notification to UI that homing is complete
//       if (mainWindow && !mainWindow.isDestroyed()) {
//         mainWindow.webContents.send('lls-status', 'true');
//       }
//     }

//     // Update last state
//     lastLLSState = currentLLSState;

//   } catch (err) {
//     console.error("Error checking COIL_LLS:", err.message);
//   }
// }

// // Start checking LLS periodically
// setInterval(checkLLSStatus, 500);

// Remove old LLS checking logic
// We will integrate this into the main loop
let lastLLSState = false;


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
      "Timestamp,Distance(mm),Force(mN),Temperature,ConfigName,PathLength,ThresholdForce,InsertionStrokeLength,RetractionStrokelength,NumberOfCurves,CurveDistances\n"
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
      config.insertionLength,
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

// async function getLogFiles() {
//   try {
//     const logsDir = path.join(app.getPath("documents"), "SCTTM_Logs");

//     if (!fs.existsSync(logsDir)) {
//       return [];
//     }

//     const files = await fsPromises.readdir(logsDir);
//     const csvFiles = files.filter(file => file.endsWith('.csv'));

//     const logFiles = [];

//     for (const file of csvFiles) {
//       const filePath = path.join(logsDir, file);
//       const stats = await fsPromises.stat(filePath);

//       // Extract configuration name and timestamp from filename
//       const fileNameWithoutExt = file.replace('.csv', '');
//       const parts = fileNameWithoutExt.split('_');
//       const configName = parts.slice(0, -1).join('_');
//       const timestamp = parts[parts.length - 1];

//       logFiles.push({
//         filename: file,
//         displayName: `${configName} - ${new Date(timestamp.replace(/-/g, ':')).toLocaleString()}`,
//         filePath: filePath,
//         date: stats.mtime.toISOString().split('T')[0],
//         time: timestamp,
//         configName: configName
//       });
//     }

//     // Sort by date (newest first)
//     return logFiles.sort((a, b) => new Date(b.time) - new Date(a.time));

//   } catch (error) {
//     console.error('Error getting log files:', error);
//     return [];
//   }
// }
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

      // Parse the date properly
      let formattedDate = 'Invalid Date';
      try {
        // The timestamp is in format: 2026-01-02T10-01-00-000Z
        // Extract date parts
        const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/);
        if (match) {
          const [_, year, month, day, hour, minute, second] = match;
          const date = new Date(year, month - 1, day, hour, minute, second);
          formattedDate = date.toLocaleString();
          console.error("Date Formatted: ", formattedDate);

        }
      } catch (e) {
        console.log('Date parsing error:', e.message);
      }

      logFiles.push({
        filename: file,
        displayName: `${configName}`,
        filePath: filePath,
        date: stats.mtime.toISOString().split('T')[0],
        time: timestamp,
        configName: configName
      });
    }

    // Sort by date (newest first)
    return logFiles.sort((a, b) => new Date(b.time) - new Date(a.time));

    // return logFiles.sort((a, b) => {
    //   const toISO = (t) =>
    //     t.replace(
    //       /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/,
    //       "$1T$2:$3:$4.$5Z"
    //     );

    //   return new Date(toISO(b.time)) - new Date(toISO(a.time));
    // });


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
        let force = parseFloat(values[2]) || 0;
        let distance = parseFloat(values[1]) || 0;

        processData.push({
          time: i - 1,
          distance: distance,
          force: force, // Keep in mN for consistency with real-time graph
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
    insertionLength: '--',        // Insertion stroke length
    retractionLength: '--',   // RetractionStrokelength
    numberOfCurves: '--',
    curveDistances: {}
  };

  // Read configuration from first data row
  if (lines.length > 1) {
    const firstDataRow = lines[1].split(',');

    // Ensure row has enough columns
    if (firstDataRow.length >= 10) {
      config.configName = firstDataRow[4] || 'Unknown';
      config.pathlength = firstDataRow[5] || '--';
      config.thresholdForce = firstDataRow[6] || '--';
      config.insertionLength = firstDataRow[7] || '--';
      config.retractionLength = firstDataRow[8] || '--';
      config.numberOfCurves = firstDataRow[9] || '--';

      // Parse curve distances - CurveDistances is from index 9 onwards
      try {
        if (firstDataRow.length >= 10) {
          // Join parts from index 10 onwards to handle JSON strings with commas
          let curveDistancesStr = firstDataRow.slice(10).join(',').trim();

          // Handle potential issues with surrounding quotes or escapes
          if (curveDistancesStr.startsWith('"') && curveDistancesStr.endsWith('"')) {
            curveDistancesStr = curveDistancesStr.slice(1, -1);
          }

          curveDistancesStr = curveDistancesStr.replace(/""/g, '"').replace(/\\"/g, '"');

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
    // Cleanup logic handled by window-all-closed or app quit
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

//     // Read temperature (16-bit integer, multiply by 10 for precision)
//     const tempResult = await safeReadRegisters(REG_TEMP, 1);
//     const temperatureRaw = tempResult.data[0];
//     // Divide by 10 to get actual temperature in °C
//     const temperatureC = temperatureRaw / 10;

//     const manualDistanceResult = await safeReadRegisters(REG_MANUAL_DISTANCE, 1);
//     const manualDistance = manualDistanceResult.data[0];

//      // 🔍 DEBUG LOG — ADD THIS SECTION
//     console.log("=========================================");
//     console.log(" PLC LIVE DATA RECEIVED");
//     console.log("-----------------------------------------");
//     console.log("RAW REGISTERS:");
//     console.log("  Distance (70):", distanceMM);
//     console.log("  Force (54,55):", forceRegisters);
//     console.log("  Temperature (501):", temperatureRaw);
//     console.log("-----------------------------------------");
//     console.log("DECODED VALUES:");
//     console.log(`  Distance:      ${distanceMM} mm`);
//     console.log(`  Force:         ${forceMN.toFixed(2)} mN`);
//     console.log(`  Temperature (raw): ${temperatureRaw}`);
//     console.log(`  Temperature (actual): ${temperatureC.toFixed(1)} °C`);
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

//       // Temperature data - divide by 10 to get actual °C
//       temperature: temperatureC,
//       temperatureDisplay: `${temperatureC.toFixed(1)} °C`,

//       manualDistance: manualDistance,   // NEW
//       manualDistanceDisplay: `${manualDistance} mm`,  // NEW

//       // Raw data for debugging
//       rawRegisters: {
//         distance: distanceMM,
//         force: forceRegisters,
//         temperature: temperatureRaw,  // Keep raw value here
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

// -------------------------
// Background Modbus Processing Loop
// -------------------------
let consecutiveErrors = 0;

async function processModbusLoop() {
  if (isLoopRunning) return;
  isLoopRunning = true;
  console.log("🔄 Background Modbus Loop Started");

  while (true) {
    // 0. Critical Check: Unexpected Port Closure
    if (isConnected && !client.isOpen) {
      console.error("❌ Port closed unexpectedly (client.isOpen is false). Triggering disconnect.");
      isConnected = false;
      consecutiveErrors = 0;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('modbus-status', 'disconnected');
      }
    }

    // 1. Check Connection
    if (!isConnected || !client.isOpen) {
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }

    try {
      // 2. Process High Priority Commands FIRST
      if (commandQueue.length > 0) {
        const cmd = commandQueue.shift();
        try {
          // console.log(`⚡ Executing command: ${cmd.commandName}`); // Optional debug
          const result = await cmd.task();
          cmd.resolve(result);
        } catch (e) {
          console.error(`❌ Command ${cmd.commandName} failed:`, e.message);
          cmd.reject(e);
        }
        // Iterate again immediately to process next command if any
        continue;
      }

      // 3. Read Data Cycle (Only if no commands pending)
      let cycleSuccess = false;

      // Read COIL_LLS (Coil 1000)
      try {
        const llsResult = await client.readCoils(COIL_LLS, 1);
        const currentLLSState = Boolean(llsResult.data[0]);
        plcState.coilLLS = currentLLSState;

        cycleSuccess = true;

        // Emit change event
        if (currentLLSState !== lastLLSState) {
          console.log(`🔄 COIL_LLS changed: ${lastLLSState} -> ${currentLLSState}`);
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lls-status', currentLLSState.toString());
          }
          lastLLSState = currentLLSState;
        }
      } catch (e) {
        // console.error("Error reading LLS:", e.message);
      }

      // Read Distance (Reg 70)
      try {
        const dRes = await client.readHoldingRegisters(REG_DISTANCE, 1);
        plcState.distance = dRes.data[0]; // Already in mm
        cycleSuccess = true;
      } catch (e) { }

      // Read Force (Reg 54-55)
      try {
        const fRes = await client.readHoldingRegisters(REG_FORCE, 2);
        plcState.force_mN = registersToFloat32LE(fRes.data[0], fRes.data[1]);
        cycleSuccess = true;
      } catch (e) { }

      // Read Temperature (Reg 501)
      try {
        const tRes = await client.readHoldingRegisters(REG_TEMP, 1);
        plcState.temperature = tRes.data[0] / 10.0; // Scale to degrees C
        cycleSuccess = true;
      } catch (e) { }

      // Read Manual Distance (Reg 6550)
      try {
        const mdRes = await client.readHoldingRegisters(REG_MANUAL_DISTANCE, 1);
        // plcState.manualDistance = mdRes.data[0];
        plcState.manualDistance = new Int16Array(new Uint16Array([mdRes.data[0]]).buffer)[0];
        // console.log(typeof (plcState, manualDistance));
        cycleSuccess = true;
      } catch (e) { }

      // 4. Check Cycle Success & Disconnection
      if (cycleSuccess) {
        if (consecutiveErrors > 0) {
          console.log(`✅ Connection recovered after ${consecutiveErrors} errors`);
        }
        consecutiveErrors = 0;
      } else {
        consecutiveErrors++;
        console.warn(`⚠️ Read cycle failed (TIMEOUT/ERR). Consecutive errors: ${consecutiveErrors}`);

        // Threshold: 
        // 5 reads * 200ms = 1000ms per cycle in worst case (timeout).
        // 5 cycles = ~5 seconds worst case. 
        if (consecutiveErrors >= 5) {
          console.error("❌ Disconnection detected: Too many consecutive read failures.");
          isConnected = false;
          consecutiveErrors = 0;

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('modbus-status', 'disconnected');
          }

          // Force close internal client to ensure clean state
          try {
            if (client.isOpen) {
              client.close();
            }
          } catch (e) { console.error("Error closing client:", e); }
        }
      }

      plcState.lastUpdated = Date.now();

    } catch (loopError) {
      console.error("⚠️ Modbus loop error:", loopError.message);
      // Wait a bit longer on error
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }

    // 5. Yield / Wait
    // Short wait to prevent blocking event loop, but keep high poll rate
    // 20ms = ~50 polls/sec theoretical max (in practice less due to serial latency)
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

// Start the loop
processModbusLoop();


// -------------------------
// Read PLC Data Function - SERVES CACHE
// -------------------------
async function readPLCData() {
  if (!isConnected) {
    return {
      success: false,
      message: 'Not connected to PLC'
    };
  }

  // Return cached state immediately
  return {
    success: true,
    distance: plcState.distance,
    distanceDisplay: `${plcState.distance} mm`,

    force_mN: plcState.force_mN,
    forceDisplay: `${plcState.force_mN} mN`,

    temperature: plcState.temperature,
    temperatureDisplay: `${plcState.temperature.toFixed(1)} °C`,

    manualDistance: plcState.manualDistance,
    manualDistanceDisplay: `${plcState.manualDistance} mm`,

    coilLLS: plcState.coilLLS,

    // Raw data stub for compatibility if needed
    rawRegisters: {}
  };
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
      insertionLength: config.insertionLength || '',
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
// -------------------------
// Safe command execution - QUEUED VERSION
// -------------------------
function safeExecute(commandName, action) {
  return new Promise((resolve, reject) => {
    // 1. Validate connection first (fail fast)
    // Note: client.isOpen checks properly, isConnected is our own flag
    // We check isConnected to keep consistent with existing logic
    if (!isConnected) {
      console.log(`❌ ${commandName}: Modbus not connected (Rejected immediately)`);
      return resolve({
        success: false,
        message: 'Modbus not connected.',
        error: 'NOT_CONNECTED'
      });
    }

    // 2. Push to queue
    commandQueue.push({
      commandName,
      task: async () => {
        try {
          // Wrap the action to ensure it returns standard format or throws
          const result = await action();
          // Automatically inject success: true so frontend is happy
          return { success: true, ...result };
        } catch (e) {
          throw e;
        }
      },
      resolve,
      reject
    });
  });
}

const coilState = {
  heating: false,
  heater: false,
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

// ipcMain.handle("stop", async () => {
//   return await safeExecute("STOP", async () => {
//     if (!isConnected) throw new Error('Modbus not connected');

//     await client.writeCoil(COIL_START, false);
//     await client.writeCoil(COIL_STOP, true);
//     await client.writeCoil(COIL_RETRACTION, false);


//     return { stopPressed: true };
//   });
// });
ipcMain.handle("stop", async () => {
  return await safeExecute("STOP", async () => {
    if (!isConnected) throw new Error("Modbus not connected");

    coilState.retraction = false;
    coilState.heater = false;
    coilState.manualRet = false;

    await client.writeCoil(COIL_RETRACTION, false);
    await client.writeCoil(COIL_START, false);
    await client.writeCoil(COIL_STOP, true);

    return { success: true, retraction: false };
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

// ipcMain.handle("retraction", async () => {
//   return await safeExecute("RETRACTION", async () => {
//     if (!isConnected) throw new Error("Modbus not connected");

//     coilState.retraction = !coilState.retraction;
//     await client.writeCoil(COIL_RETRACTION, coilState.retraction);
//     await client.writeCoil(COIL_STOP, false);
//     await client.writeCoil(COIL_START, false);

//     return { retraction: coilState.retraction };
//   });
// });
ipcMain.handle("retraction", async () => {
  return await safeExecute("RETRACTION", async () => {
    if (!isConnected) throw new Error("Modbus not connected");

    // Do NOT toggle – only turn ON
    if (coilState.retraction) {
      return { success: true, retraction: true };
    }

    coilState.retraction = true;

    await client.writeCoil(COIL_RETRACTION, true);
    await client.writeCoil(COIL_STOP, false);
    await client.writeCoil(COIL_START, false);

    return { success: true, retraction: true };
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

ipcMain.handle("heater", async () => {
  return await safeExecute("HEATER", async () => {
    if (!isConnected) throw new Error("Modbus not connected");

    // Always turn ON, regardless of state
    coilState.heater = true;
    await client.writeCoil(COIL_HEATER, true);

    return { heater: coilState.heater };
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
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
ipcMain.handle("send-process-mode", async (event, config) => {
  return await safeExecute("SEND_PROCESS_CONFIG", async () => {
    try {
      console.log('🔧 Process mode config received:', config);

      if (!isConnected || !client.isOpen) {
        throw new Error('Modbus not connected');
      }

      // Parse configuration values
      const pathLength = parseInt(config.pathlength);
      const thresholdForce = parseFloat(config.thresholdForce); // mN
      const insertionLength = parseFloat(config.insertionLength); // mm
      const retractionLength = parseFloat(config.retractionLength); // mm

      console.log('📊 Parsed config values:', {
        pathLength: `${pathLength} mm`,
        thresholdForce: `${thresholdForce} mN`,
        insertionLength: `${insertionLength} mm`,
        retractionLength: `${retractionLength} mm`
      });

      // Validate values
      if (isNaN(pathLength) || isNaN(thresholdForce) || isNaN(retractionLength)) {
        console.error('❌ Invalid configuration values');
        return false;
      }

      const results = [];

      // 1. Write Path Length
      console.log(`📝 Writing Path Length: ${pathLength} mm to address 6000`);
      await client.writeRegister(6000, pathLength);
      await delay(150);
      console.log('✅ Path Length written to address 6000');
      results.push({ register: '6000 (D0)', value: pathLength, success: true });

      // 2. Write Threshold Force
      const thresholdForceValue = Math.round(thresholdForce);
      console.log(`📝 Writing Threshold Force: ${thresholdForceValue} mN to R150`);
      await client.writeRegister(150, thresholdForceValue);
      await delay(150);
      console.log('✅ Threshold Force written to R150');
      results.push({ register: '150 (R150)', value: thresholdForceValue, success: true });

      // 3. Write Temperature
      const insertionValue = Math.round(insertionLength); // 0.1°C
      console.log(`📝 Writing Insertion Length: ${insertionValue} to 6050`);
      await client.writeRegister(6050, insertionValue);
      await delay(150);
      console.log('✅ Insertion length written to 6050');
      results.push({ register: '6050 (D50)', value: insertionValue, success: true });

      // 4. Write Retraction Length
      const retractionValue = Math.round(retractionLength);
      console.log(`📝 Writing Retraction Stroke Length: ${retractionValue} mm to R122`);
      await client.writeRegister(122, retractionValue);
      await delay(150);
      console.log('✅ Retraction Stroke Length written to R122');
      results.push({ register: '122 (R122)', value: retractionValue, success: true });

      console.log('✅ All configuration values written');
      console.log('📋 Write results:', results);

      return true;

    } catch (error) {
      console.error('❌ Error sending process mode:', error.message);
      return false;
    }
  });
});


// const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
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

//     const results = [];

//     try {
//       // 1. Write Path Length
//       console.log(`📝 Writing Path Length: ${pathLength} mm to address 6000`);
//       await client.writeRegister(6000, pathLength);
//       await delay(150);
//       console.log('✅ Path Length written to address 6000');
//       results.push({ register: '6000 (D0)', value: pathLength, success: true });

//       // 2. Write Threshold Force
//       const thresholdForceValue = Math.round(thresholdForce);
//       console.log(`📝 Writing Threshold Force: ${thresholdForceValue} mN to R150`);
//       await client.writeRegister(150, thresholdForceValue);
//       await delay(150);
//       console.log('✅ Threshold Force written to R150');
//       results.push({ register: '150 (R150)', value: thresholdForceValue, success: true });

//       // 3. Write Temperature
//       const temperatureValue = Math.round(temperature * 10); // 0.1°C
//       console.log(`📝 Writing Temperature: ${temperatureValue} to R510`);
//       await client.writeRegister(510, temperatureValue);
//       await delay(150);
//       console.log('✅ Temperature written to R510');
//       results.push({ register: '510 (R510)', value: temperatureValue, success: true });

//       // 4. Write Retraction Length
//       const retractionValue = Math.round(retractionLength);
//       console.log(`📝 Writing Retraction Stroke Length: ${retractionValue} mm to R122`);
//       await client.writeRegister(122, retractionValue);
//       await delay(150);
//       console.log('✅ Retraction Stroke Length written to R122');
//       results.push({ register: '122 (R122)', value: retractionValue, success: true });

//       console.log('✅ All configuration values written');
//       console.log('📋 Write results:', results);

//       // ---- Verification ----
//       console.log('🔄 Verifying written values...');
//       // await delay(200);

//       const verify6000 = await client.readHoldingRegisters(6000, 1);
//       const verify150 = await client.readHoldingRegisters(150, 1);
//       const verify510 = await client.readHoldingRegisters(510, 1);
//       const verify122 = await client.readHoldingRegisters(122, 1);

//       console.log('🔍 Verification reads:', {
//         '6000 (Path Length)': verify6000.data[0],
//         '150 (Threshold Force)': verify150.data[0],
//         '510 (Temperature)': verify510.data[0],
//         '122 (Retraction)': verify122.data[0]
//       });

//       const verificationPassed = 
//         verify6000.data[0] === pathLength &&
//         verify150.data[0] === thresholdForceValue &&
//         verify510.data[0] === temperatureValue &&
//         verify122.data[0] === retractionValue;

//       if (!verificationPassed) {
//         console.warn('⚠️ Verification failed');
//         return false;
//       }

//       console.log('✅ All values verified successfully!');
//       return true;

//     } catch (error) {
//       console.error('❌ Error writing to PLC:', error.message);
//       return false;
//     }

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
