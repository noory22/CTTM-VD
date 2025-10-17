import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'fs';
import started from 'electron-squirrel-startup';
import "./index.css";

const { SerialPort } = require('serialport');
import { pathToFileURL } from 'node:url';
const MAIN_WINDOW_VITE_DEV_SERVER_URL = !app.isPackaged ? 'http://localhost:5173' : null;

const TARGET_HWID = "317C39553131"

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow;
let currentPort = null;

// CSV Logging variables
let csvWriteStream = null;
let currentLogFileName = null;

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
    // Add these icon properties:
    icon: path.join(__dirname, 'assets', 'icon.ico'), // For development
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

  // -------------------------
  // Auto-connect serial port
  // -------------------------
  autoConnectPort();
}

// Auto-connect function
async function autoConnectPort() {
  try {
    const ports = await SerialPort.list();
    let selectedPort = null;

    for (const port of ports) {
      console.log(`Checking port: ${port.path}, HWID: ${port.pnpId || ""}`);
      if ((port.pnpId || "").includes(TARGET_HWID)) {
        selectedPort = port.path;
        break;
      }
    }

    if (selectedPort) {
      console.log(`✅ Found target device on ${selectedPort}, connecting...`);
      await connectToPort(selectedPort, 9600);
    } else {
      console.error("❌ Target device not found.");
      if (mainWindow) {
        mainWindow.webContents.send("serial-error", "Target serial device not found");
      }
    }
  } catch (err) {
    console.error("Error while scanning ports:", err);
  }
}

// Wrapper for connecting
function connectToPort(path, baudRate) {
  return new Promise((resolve, reject) => {
    currentPort = new SerialPort({ path, baudRate, autoOpen: true });

    currentPort.on('open', () => {
      console.log(`✅ Auto-connected to ${path} @ ${baudRate}`);
      resolve(`Connected to ${path} @ ${baudRate}`);
    });

    currentPort.on('data', (data) => {
      const dataString = data.toString().trim();
      console.log('Received data:', dataString);
      parseReceivedData(dataString);
      if (mainWindow) {
        mainWindow.webContents.send('serial-data', dataString);
      }
    });

    currentPort.on('error', (e) => {
      if (mainWindow) {
        mainWindow.webContents.send('serial-error', e.message);
      }
    });

    currentPort.on('close', () => {
      if (mainWindow) {
        mainWindow.webContents.send('serial-error', 'Port was closed');
      }
    });
  });
}

// Existing IPC handlers
ipcMain.handle('list-ports', async () => {
  return await SerialPort.list();
});

ipcMain.handle('connect-port', async (event, args) => {
  const { path, baudRate } = args;
  return connectToPort(path, baudRate);
});

ipcMain.handle('send-data', async (event, data) => {
  return new Promise((resolve, reject) => {
    if (!currentPort || !currentPort.isOpen) {
      return reject('Cannot send data - Port not Open');
    }
    console.log('Sending data:', data);
    currentPort.write(data, (err) => {
      if (err) return reject(`Error on write: ${err.message}`);
      resolve('Data sent');
    });
  });
});

// Manual mode specific commands
let motorStates = {
  forward: false, // false = stopped, true = running
  backward: false // false = stopped, true = running
};

ipcMain.handle('move-motor', async (event, direction) => {
  let command;
  
  if (direction === 'forward') {
    if (motorStates.forward) {
      // Stop forward motor
      command = '*2:4:2:2#';
      motorStates.forward = false;
      console.log(`🛑 STOP FORWARD MOTOR COMMAND: ${command}`);
    } else {
      // Start forward motor and stop backward if running
      command = '*2:4:1:1#';
      motorStates.forward = true;
      motorStates.backward = false; // Stop backward direction
      console.log(`🔄 START FORWARD MOTOR COMMAND: ${command}`);
    }
  } else if (direction === 'backward') {
    if (motorStates.backward) {
      // Stop backward motor
      command = '*2:4:2:1#';
      motorStates.backward = false;
      console.log(`🛑 STOP BACKWARD MOTOR COMMAND: ${command}`);
    } else {
      // Start backward motor and stop forward if running
      command = '*2:4:1:2#';
      motorStates.backward = true;
      motorStates.forward = false; // Stop forward direction
      console.log(`🔄 START BACKWARD MOTOR COMMAND: ${command}`);
    }
  }

  return new Promise((resolve, reject) => {
    if (!currentPort || !currentPort.isOpen) {
      return reject('Cannot send data - Port not Open');
    }
    currentPort.write(command, (err) => {
      if (err) return reject(`Error on write: ${err.message}`);
      resolve('Motor command sent');
    });
  });
});

ipcMain.handle('control-heater', async (event, state) => {
  const command = state === 'on' ? '*2:7:1#' : '*2:7:2#';
  console.log(`🔥 HEATER COMMAND: ${command} (State: ${state})`);
  return new Promise((resolve, reject) => {
    if (!currentPort || !currentPort.isOpen) {
      return reject('Cannot send data - Port not Open');
    }
    currentPort.write(command, (err) => {
      if (err) return reject(`Error on write: ${err.message}`);
      resolve('Heater command sent');
    });
  });
});

ipcMain.handle('control-clamp', async (event, state) => {
  // Clamp is controlled via Valve 1 (button 5 in protocol)
  const command = state === 'on' ? '*2:5:1#' : '*2:5:2#';
  console.log(`🔒 CLAMP COMMAND: ${command} (State: ${state})`);
  return new Promise((resolve, reject) => {
    if (!currentPort || !currentPort.isOpen) {
      return reject('Cannot send data - Port not Open');
    }
    currentPort.write(command, (err) => {
      if (err) return reject(`Error on write: ${err.message}`);
      resolve('Clamp command sent');
    });
  });
});

ipcMain.handle('homing-command', async (event, state) => {
  // Clamp is controlled via Valve 1 (button 5 in protocol)
  const command = '*2:9:1#';
  console.log(`🔒 HOMING COMMAND: ${command} `);
  return new Promise((resolve, reject) => {
    if (!currentPort || !currentPort.isOpen) {
      return reject('Cannot send data - Port not Open');
    }
    currentPort.write(command, (err) => {
      if (err) return reject(`Error on write: ${err.message}`);
      resolve('Homing command sent');
    });
  });
});

// Process mode specific commands
ipcMain.handle('process-start-with-values', async (event, distance, temperature, peakForce) => {
  const command = `*1:1:${distance}:${temperature}:${peakForce}#`;
  console.log(`▶️ PROCESS START COMMAND: ${command}`);
  return new Promise((resolve, reject) => {
    if (!currentPort || !currentPort.isOpen) {
      return reject('Cannot send data - Port not Open');
    }
    currentPort.write(command, (err) => {
      if (err) return reject(`Error on write: ${err.message}`);
      resolve('Process start command sent');
    });
  });
});

ipcMain.handle('process-pause-with-values', async (event, distance, temperature, peakForce) => {
  const command = `*1:2:${distance}:${temperature}:${peakForce}#`;
  console.log(`⏸️ PROCESS PAUSE COMMAND: ${command}`);
  return new Promise((resolve, reject) => {
    if (!currentPort || !currentPort.isOpen) {
      return reject('Cannot send data - Port not Open');
    }
    currentPort.write(command, (err) => {
      if (err) return reject(`Error on write: ${err.message}`);
      resolve('Process pause command sent');
    });
  });
});

ipcMain.handle('process-reset-with-values', async (event, distance, temperature, peakForce) => {
  const command = `*1:3:${distance}:${temperature}:${peakForce}#`;
  console.log(`🔄 PROCESS RESET/HOMING COMMAND: ${command}`);
  return new Promise((resolve, reject) => {
    if (!currentPort || !currentPort.isOpen) {
      return reject('Cannot send data - Port not Open');
    }
    currentPort.write(command, (err) => {
      if (err) return reject(`Error on write: ${err.message}`);
      resolve('Process reset command sent');
    });
  });
});

function parseReceivedData(data) {
  try {
    const mainWindow = BrowserWindow.getFocusedWindow();
    if (!mainWindow) return;
    
    console.log('Raw received data:', data); // Debug log
    
    // Handle temperature data - FIXED VERSION
    if (data.includes('*TEP:')) {
      // Use a more flexible approach that handles both with and without #
      const tepIndex = data.indexOf('*TEP:');
      if (tepIndex !== -1) {
        // Extract everything after *TEP:
        const afterTep = data.substring(tepIndex + 5);
        
        // Find the next # or end of string
        let valueEnd = afterTep.indexOf('#');
        if (valueEnd === -1) {
          // If no # found, use the rest of the string
          valueEnd = afterTep.length;
        }
        
        // Extract the temperature value
        const tempStr = afterTep.substring(0, valueEnd);
        const temperature = parseFloat(tempStr);
        
        if (!isNaN(temperature)) {
          console.log(`🌡️ TEMPERATURE UPDATE: ${temperature}°C`);
          mainWindow.webContents.send('temperature-update', temperature);
        } else {
          console.log(`❌ Invalid temperature value: ${tempStr}`);
        }
      }
    }

    
    // Parse force data: *FRC:xxxxxx#
    if (data.includes('*FRC:') && data.includes('#')) {
      const forcePattern = /\*FRC:(\d+(?:\.\d+)?)#/g;
      let forceMatch;
      
      while ((forceMatch = forcePattern.exec(data)) !== null) {
        const force = parseFloat(forceMatch[1]);
        console.log(`💪 FORCE UPDATE: ${force}N`);
        mainWindow.webContents.send('force-update', force);
      }
    }
    
    // Parse distance data: *DST:xxxxxx#
    if (data.includes('*DIS:') && data.includes('#')) {
      const distPattern = /\*DIS:(\d+(?:\.\d+)?)#/g;
      let distMatch;
      
      while ((distMatch = distPattern.exec(data)) !== null) {
        const distance = parseFloat(distMatch[1]);
        console.log(`📏 DISTANCE UPDATE: ${distance}mm`);
        mainWindow.webContents.send('distance-update', distance);
      }
    }
    
    // Parse manual response: *MAN:RES#
    if (data.includes('*MAN:RES#')) {
      console.log('✅ MANUAL COMMAND ACKNOWLEDGED');
      mainWindow.webContents.send('manual-response', 'Command acknowledged');
    }
    
    // Parse process responses
    if (data.includes('*PRS:STR#')) {
      console.log('✅ PROCESS STARTED');
      mainWindow.webContents.send('process-response', 'started');
    }
    if (data.includes('*PRS:PUS#')) {
      console.log('⏸️ PROCESS PAUSED');
      mainWindow.webContents.send('process-response', 'paused');
    }
    if (data.includes('*PRS:HOM#')) {
      console.log('🔄 HOMING STARTED');
      mainWindow.webContents.send('homing-status', 'HOMING');
      mainWindow.webContents.send('process-response', 'homing');
    }
    if (data.includes('*PRS:RED#')) {
      console.log('🔄 HOMING COMPLETED - READY');
      // mainWindow.webContents.send('homing-status', 'IDLE')
      mainWindow.webContents.send('process-response', 'ready');
    }
  } catch (error) {
    console.error('Error parsing received data:', error);
  }
}

// IPC handlers for configuration management
ipcMain.handle('read-config-file', async () => {
  const configPath = path.join(app.getPath('userData'), 'ConfigFile.csv');
  
  if (!fs.existsSync(configPath)) {
    // Create empty file with headers if doesn't exist
    const headers = 'ConfigName,Distance,Temperature,Peak Force\n';
    fs.writeFileSync(configPath, headers);
    return [];
  }
  
  const data = fs.readFileSync(configPath, 'utf8');
  const lines = data.trim().split('\n');
  const configs = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const [configName, distance, temperature, peakForce] = lines[i].split(',');
    if (configName && configName.trim() !== '') {
      configs.push({ 
        configName: configName.trim(), 
        distance: distance.trim(), 
        temperature: temperature.trim(), 
        peakForce: peakForce.trim() 
      });
    }
  }
  
  return configs;
});

ipcMain.handle('write-config-file', async (event, configs) => {
  const configPath = path.join(app.getPath('userData'), 'ConfigFile.csv');
  let csvData = 'ConfigName,Distance,Temperature,Peak Force\n';
  
  configs.forEach(config => {
    csvData += `${config.configName},${config.distance},${config.temperature},${config.peakForce}\n`;
  });
  
  fs.writeFileSync(configPath, csvData);
  return true;
});

ipcMain.handle('delete-config-file', async (event, configName) => {
  const configPath = path.join(app.getPath('userData'), 'ConfigFile.csv');
  
  if (!fs.existsSync(configPath)) {
    return false;
  }
  
  const data = fs.readFileSync(configPath, 'utf8');
  const lines = data.trim().split('\n');
  const header = lines[0];
  const updatedLines = [header];
  
  for (let i = 1; i < lines.length; i++) {
    const [currentConfigName] = lines[i].split(',');
    if (currentConfigName.trim() !== configName) {
      updatedLines.push(lines[i]);
    }
  }
  
  fs.writeFileSync(configPath, updatedLines.join('\n'));
  return true;
});

// -----------------------------------------------------------------------------------
// CSV Logging IPC Handlers
// -----------------------------------------------------------------------------------

ipcMain.handle('start-csv-logging', async (event, configData) => {
  try {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(app.getPath('userData'), 'process_logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create filename with timestamp and config name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const configName = configData.configName.replace(/[^a-zA-Z0-9]/g, '_');
    currentLogFileName = `process_${configName}_${timestamp}.csv`;
    const filePath = path.join(logsDir, currentLogFileName);

    // Create write stream
    csvWriteStream = fs.createWriteStream(filePath, { flags: 'w' });
    
    // Write CSV header with configuration details
    csvWriteStream.write(`# Configuration: ${configData.configName}\n`);
    csvWriteStream.write(`# Distance: ${configData.distance} mm\n`);
    csvWriteStream.write(`# Temperature: ${configData.temperature} °C\n`);
    csvWriteStream.write(`# Peak Force: ${configData.peakForce} N\n`);
    csvWriteStream.write(`# Start Time: ${new Date().toISOString()}\n`);
    csvWriteStream.write('Time (s),Distance (mm),Force (N),Timestamp\n');
    
    console.log(`📝 Started CSV logging: ${currentLogFileName}`);
    console.log(`📝 Config: ${configData.configName}, Distance: ${configData.distance}mm, Peak Force: ${configData.peakForce}N, Temp: ${configData.temperature}°C`);
    return { success: true, fileName: currentLogFileName };
  } catch (error) {
    console.error('Error starting CSV logging:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('log-sensor-data', async (event, sensorData) => {
  if (!csvWriteStream) {
    console.error('❌ No active CSV write stream');
    return { success: false, error: 'No active log file' };
  }

  try {
    const timestamp = new Date().toISOString();
    const csvLine = `${sensorData.time},${sensorData.distance},${sensorData.force},${timestamp}\n`;
    
    // Use callback to ensure write completion
    return new Promise((resolve, reject) => {
      csvWriteStream.write(csvLine, (error) => {
        if (error) {
          console.error('Error writing sensor data:', error);
          reject({ success: false, error: error.message });
        } else {
          console.log(`✅ Logged: Time=${sensorData.time}s, Distance=${sensorData.distance}mm, Force=${sensorData.force}N`);
          resolve({ success: true });
        }
      });
    });
  } catch (error) {
    console.error('Error in log-sensor-data:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-csv-logging', async () => {
  try {
    if (csvWriteStream) {
      csvWriteStream.end();
      csvWriteStream = null;
      
      console.log(`📝 Stopped CSV logging: ${currentLogFileName}`);
      const fileName = currentLogFileName;
      currentLogFileName = null;
      
      return { success: true, fileName };
    }
    return { success: false, error: 'No active log file' };
  } catch (error) {
    console.error('Error stopping CSV logging:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-log-files', async () => {
  try {
    const logsDir = path.join(app.getPath('userData'), 'process_logs');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(logsDir);
    console.log('📁 Raw files found:', files); // Debug log
    
    const logFiles = files
      .filter(file => file.endsWith('.csv'))
      .map(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        console.log('📄 Processing file:', file); // Debug log
        
        // Parse filename to extract config name
        let configName = 'Unknown Configuration';
        const match = file.match(/process_(.+)_\d/);
        if (match && match[1]) {
          configName = match[1].replace(/_/g, ' ');
        }
        
        // Use file stats for date/time instead of parsing from filename
        const date = stats.mtime;
        
        const logFile = {
          filename: file,
          displayName: configName,
          date: date.toISOString().split('T')[0],
          time: date.toTimeString().split(' ')[0],
          filePath: filePath
        };
        
        console.log('✅ Processed log file:', logFile); // Debug log
        return logFile;
      })
      .sort((a, b) => new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time));

    console.log('📁 Final log files count:', logFiles.length); // Debug log
    return logFiles;
  } catch (error) {
    console.error('❌ Error reading log files:', error);
    return [];
  }
});

ipcMain.handle('read-log-file', async (event, filePath) => {
  try {
    console.log('📖 Reading log file:', filePath);
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.trim().split('\n');
    
    console.log('📊 Raw file lines:', lines.length);
    
    // Skip header and parse data
    const processData = [];
    let dataLinesFound = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip comment lines, header, and empty lines
      if (line.startsWith('#') || line.startsWith('Time (s),Distance (mm),Force (N)') || line === '') {
        console.log('⏩ Skipping header/comment line:', line.substring(0, 50));
        continue;
      }
      
      // Skip the simplified header if present
      if (line === 'Time (s),Distance (mm),Force (N),Timestamp') {
        console.log('⏩ Skipping simplified header');
        continue;
      }
      
      const parts = line.split(',');
      console.log('📝 Parsing line:', parts);
      
      if (parts.length >= 3) {
        const time = parseFloat(parts[0]);
        const distance = parseFloat(parts[1]);
        const force = parseFloat(parts[2]);
        
        // Only add valid data points
        if (!isNaN(time) && !isNaN(distance) && !isNaN(force)) {
          processData.push({
            time: time,
            distance: distance,
            force: force
          });
          dataLinesFound++;
        } else {
          console.log('⚠️ Skipping invalid data:', parts);
        }
      } else {
        console.log('⚠️ Skipping line with insufficient parts:', parts);
      }
    }

    console.log(`📊 Successfully read ${dataLinesFound} data points from ${processData.length} valid entries`);
    return { success: true, data: processData, rawData: data };
  } catch (error) {
    console.error('❌ Error reading log file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-log-file', async (event, filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true };
    }
    return { success: false, error: 'File not found' };
  } catch (error) {
    console.error('Error deleting log file:', error);
    return { success: false, error: error.message };
  }
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});