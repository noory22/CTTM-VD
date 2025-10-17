// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("serialAPI", {
  // Config file operations
  readConfigFile: () => ipcRenderer.invoke("read-config-file"),
  writeConfigFile: (configs) =>
    ipcRenderer.invoke("write-config-file", configs),
  deleteConfigFile: (configName) =>
    ipcRenderer.invoke("delete-config-file", configName),

  // Basic serial communication
  listPorts: () => ipcRenderer.invoke("list-ports"),
  connectPort: (path, baudRate) =>
    ipcRenderer.invoke("connect-port", { path, baudRate }),
  sendData: (data) => ipcRenderer.invoke("send-data", data),

  // Manual mode specific commands
  moveMotor: (direction) => ipcRenderer.invoke("move-motor", direction),
  controlHeater: (state) => ipcRenderer.invoke("control-heater", state),
  controlClamp: (state) => ipcRenderer.invoke("control-clamp", state),
  homingCommand: () => ipcRenderer.invoke("homing-command"),

  // Process mode specific commands
  processStartWithValues: (distance, temperature, peakForce) =>
  ipcRenderer.invoke("process-start-with-values", distance, temperature, peakForce),
processPauseWithValues: (distance, temperature, peakForce) =>
  ipcRenderer.invoke("process-pause-with-values", distance, temperature, peakForce),
processResetWithValues: (distance, temperature, peakForce) =>
  ipcRenderer.invoke("process-reset-with-values", distance, temperature, peakForce),

  // CSV Logging APIs
  startCsvLogging: (configData) => ipcRenderer.invoke("start-csv-logging", configData),
  logSensorData: (sensorData) => ipcRenderer.invoke("log-sensor-data", sensorData),
  stopCsvLogging: () => ipcRenderer.invoke("stop-csv-logging"),
  getLogFiles: () => ipcRenderer.invoke("get-log-files"),
  readLogFile: (filePath) => ipcRenderer.invoke("read-log-file", filePath),
  deleteLogFile: (filePath) => ipcRenderer.invoke("delete-log-file", filePath),

  // Event listeners
  onData: (callback) =>
    ipcRenderer.on("serial-data", (event, data) => callback(data)),
  onError: (callback) =>
    ipcRenderer.on("serial-error", (event, error) => callback(error)),
  onTemperatureUpdate: (callback) =>
    ipcRenderer.on("temperature-update", (event, temp) => callback(temp)),
  onForceUpdate: (callback) =>
    ipcRenderer.on("force-update", (event, force) => callback(force)),
  onDistanceUpdate: (callback) =>
  ipcRenderer.on("distance-update", (event, distance) => callback(distance)),
  onManualResponse: (callback) =>
    ipcRenderer.on("manual-response", (event, response) => callback(response)),
  onProcessResponse: (callback) =>
    ipcRenderer.on("process-response", (event, response) =>
      callback(response)
    ),
  onHomingStatus: (callback) =>
   ipcRenderer.on("homing-status", (event, status) => callback(status)),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});