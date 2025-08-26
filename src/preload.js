// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import "./index.css";

// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
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

  // Process mode specific commands
  processStart: () => ipcRenderer.invoke("process-start"),
  processPause: () => ipcRenderer.invoke("process-pause"),
  processReset: () => ipcRenderer.invoke("process-reset"),

  // Event listeners
  onData: (callback) =>
    ipcRenderer.on("serial-data", (event, data) => callback(data)),
  onError: (callback) =>
    ipcRenderer.on("serial-error", (event, error) => callback(error)),
  onTemperatureUpdate: (callback) =>
    ipcRenderer.on("temperature-update", (event, temp) => callback(temp)),
  onForceUpdate: (callback) =>
    ipcRenderer.on("force-update", (event, force) => callback(force)),
  onManualResponse: (callback) =>
    ipcRenderer.on("manual-response", (event, response) => callback(response)),
  onProcessResponse: (callback) =>
    ipcRenderer.on("process-response", (event, response) =>
      callback(response)
    ),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
