/**
 * Chrome MCP Extension - Background Script
 * 
 * Handles screenshot capture, console log collection, network monitoring,
 * and communication between content scripts and the MCP server.
 */

class BackgroundService {
  constructor() {
    this.consoleLogs = [];
    this.networkLogs = [];
    this.attachedTabs = new Set();
    this.init();
  }

  init() {
    console.log('[Chrome MCP Background] Initializing background service');
    this.setupMessageHandlers();
    this.setupDebuggerCapture();
  }

  setupMessageHandlers() {
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep the message channel open for async responses
    });

    // Listen for tab updates to reset logs
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'loading') {
        this.consoleLogs = [];
        this.networkLogs = [];
      }
    });

    // Clean up debugger when tab is closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.attachedTabs.delete(tabId);
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'screenshot_request':
          await this.handleScreenshotRequest(sender.tab.id, sendResponse);
          break;
        case 'console_logs_request':
          await this.handleConsoleLogsRequest(sendResponse);
          break;
        case 'network_logs_request':
          await this.handleNetworkLogsRequest(sendResponse);
          break;
        default:
          console.warn('[Chrome MCP Background] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[Chrome MCP Background] Error handling message:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleScreenshotRequest(tabId, sendResponse) {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 90
      });
      
      sendResponse({
        type: 'screenshot_complete',
        data: { screenshot: dataUrl }
      });
    } catch (error) {
      console.error('[Chrome MCP Background] Screenshot capture failed:', error);
      sendResponse({ error: 'Screenshot capture failed: ' + error.message });
    }
  }

  async handleConsoleLogsRequest(sendResponse) {
    sendResponse({
      type: 'console_logs_complete',
      data: { logs: this.consoleLogs }
    });
  }

  async handleNetworkLogsRequest(sendResponse) {
    sendResponse({
      type: 'network_logs_complete',
      data: { logs: this.networkLogs }
    });
  }

  setupDebuggerCapture() {
    // Capture console and network logs using the debugger API
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      await this.attachDebugger(activeInfo.tabId);
    });

    // Handle debugger events
    chrome.debugger.onEvent.addListener((source, method, params) => {
      this.handleDebuggerEvent(source, method, params);
    });

    // Handle debugger detachment
    chrome.debugger.onDetach.addListener((source, reason) => {
      console.log('[Chrome MCP Background] Debugger detached:', reason);
      this.attachedTabs.delete(source.tabId);
    });
  }

  async attachDebugger(tabId) {
    // Skip if already attached
    if (this.attachedTabs.has(tabId)) {
      return;
    }

    try {
      await chrome.debugger.attach({ tabId }, '1.0');
      this.attachedTabs.add(tabId);
      
      // Enable Runtime for console logs
      await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
      
      // Enable Network for network monitoring
      await chrome.debugger.sendCommand({ tabId }, 'Network.enable');
      
      console.log('[Chrome MCP Background] Debugger attached to tab:', tabId);
    } catch (error) {
      // Debugger attachment might fail, that's okay
      console.log('[Chrome MCP Background] Could not attach debugger:', error.message);
    }
  }

  handleDebuggerEvent(source, method, params) {
    // Handle console logs
    if (method === 'Runtime.consoleAPICalled') {
      this.consoleLogs.push({
        timestamp: Date.now(),
        level: params.type,
        args: params.args.map(arg => arg.value || arg.description || String(arg))
      });
      
      // Keep only the last 100 logs to prevent memory issues
      if (this.consoleLogs.length > 100) {
        this.consoleLogs = this.consoleLogs.slice(-100);
      }
    }

    // Handle network requests
    if (method === 'Network.requestWillBeSent') {
      const request = {
        id: params.requestId,
        timestamp: Date.now(),
        type: 'request',
        url: params.request.url,
        method: params.request.method,
        headers: params.request.headers,
        postData: params.request.postData || null,
        resourceType: params.type,
        initiator: params.initiator?.type || 'unknown'
      };
      this.networkLogs.push(request);
    }

    // Handle network responses
    if (method === 'Network.responseReceived') {
      const response = {
        id: params.requestId,
        timestamp: Date.now(),
        type: 'response',
        url: params.response.url,
        status: params.response.status,
        statusText: params.response.statusText,
        headers: params.response.headers,
        mimeType: params.response.mimeType,
        fromCache: params.response.fromDiskCache || params.response.fromServiceWorker || false,
        timing: params.response.timing || null
      };
      this.networkLogs.push(response);
    }

    // Handle loading finished (for timing info)
    if (method === 'Network.loadingFinished') {
      const finished = {
        id: params.requestId,
        timestamp: Date.now(),
        type: 'finished',
        encodedDataLength: params.encodedDataLength
      };
      this.networkLogs.push(finished);
    }

    // Handle loading failed
    if (method === 'Network.loadingFailed') {
      const failed = {
        id: params.requestId,
        timestamp: Date.now(),
        type: 'failed',
        errorText: params.errorText,
        canceled: params.canceled || false
      };
      this.networkLogs.push(failed);
    }

    // Keep only the last 200 network logs to prevent memory issues
    if (this.networkLogs.length > 200) {
      this.networkLogs = this.networkLogs.slice(-200);
    }
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Chrome MCP Background] Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Show welcome notification or open options page
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Chrome MCP Installed',
      message: 'Chrome MCP is ready to automate your browser with AI!'
    });
  }
});
