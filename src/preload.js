const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("api", {
  // ============= CONFIGURATION API =============
  readConfigFile: () => ipcRenderer.invoke("read-config-file"),
  writeConfigFile: (configs) => ipcRenderer.invoke("write-config-file", configs),
  deleteConfigFile: (configName) => ipcRenderer.invoke("delete-config-file", configName),
  sendProcessMode: (config) => ipcRenderer.invoke("send-process-mode", config),
  
  // ============= COMMAND FUNCTIONS =============
  home:  () => ipcRenderer.invoke("home"),
  start: () => ipcRenderer.invoke("start"),
  stop:  () => ipcRenderer.invoke("stop"),
  reset: () => ipcRenderer.invoke("reset"),
  heating: () => ipcRenderer.invoke("heating"),
  retraction: () => ipcRenderer.invoke("retraction"),
  manual: () => ipcRenderer.invoke("manual"),
  clamp: () => ipcRenderer.invoke("clamp"),
  insertion: () => ipcRenderer.invoke("insertion"),
  ret: () => ipcRenderer.invoke("ret"),
  debugRegisters: () => ipcRenderer.invoke("debug-registers"),
  
  // ============= DATA FUNCTIONS =============
  readData: () => ipcRenderer.invoke("read-data"),
  // Add this to the exposed API in preload.js
  connectModbus: () => ipcRenderer.invoke("connect-modbus"),
  checkConnection: () => ipcRenderer.invoke("check-connection"),
  reconnect: () => ipcRenderer.invoke("reconnect")
});

// Listen for connection status updates from main process
ipcRenderer.on('modbus-status', (event, status) => {
  // Dispatch a custom event that the UI can listen for
  window.dispatchEvent(new CustomEvent('modbus-status-change', { 
    detail: status 
  }));
});

// Optional: Add error handling for IPC
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload script loaded');
});