import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'fs';
import started from 'electron-squirrel-startup';
import "./index.css";
const { SerialPort } = require('serialport');

const TARGET_HWID = "3267334E3133"

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();

}


let mainWindow;
let currentPort = null;

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
  });
// Remove the menu completely
mainWindow.setMenu(null);



if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  // 🔹 Auto-connect to port on startup
  autoConnectPort();
};

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
ipcMain.handle('move-motor', async (event, direction) => {
  const command = direction === 'forward' ? '*2:4:1:1#' : '*2:4:1:2#';
  console.log(`🔄 MOTOR COMMAND: ${command} (Direction: ${direction})`);
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
    
    // Parse temperature data: *TEP:xxx#
    if (data.includes('*TEP:') && data.includes('#')) {
      const tempMatch = data.match(/\*TEP:(\d+)#/);
      if (tempMatch) {
        const temperature = parseInt(tempMatch[1]) / 10; // Assuming temperature is in tenths
        console.log(`🌡️ TEMPERATURE UPDATE: ${temperature}°C`);
        mainWindow.webContents.send('temperature-update', temperature);
      }
    }
    
    // Parse force data: *FRC:xxxxxx#
    if (data.includes('*FRC:') && data.includes('#')) {
      const forceMatch = data.match(/\*FRC:(\d+)#/);
      if (forceMatch) {
        const force = parseInt(forceMatch[1]) / 100; // Assuming force needs scaling
        console.log(`💪 FORCE UPDATE: ${force}N`);
        mainWindow.webContents.send('force-update', force);
      }
    }
    
    // Parse distance data: *DST:xxxxxx#
    if (data.includes('*DST:') && data.includes('#')) {
      const distMatch = data.match(/\*DST:(\d+)#/);
      if (distMatch) {
        const distance = parseInt(distMatch[1]) / 10; // Assuming distance needs scaling
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
      console.log('🔄 PROCESS RESET/HOMING STARTED');
      mainWindow.webContents.send('process-response', 'reset');
    }
    if (data.includes('*PRS:RED#')) {
      console.log('🔄 HOMING COMPLETED - READY');
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

// const createWindow = () => {
//   // Create the browser window.
//   const mainWindow = new BrowserWindow({
//     width: 1024,
//     height: 768,
//     webPreferences: {
//       preload: path.join(__dirname, 'preload.js'),
//       nodeIntegration: false,
//       contextIsolation: true
//     },
//   });

  // and load the index.html of the app.
  
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