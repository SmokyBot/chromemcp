/**
 * Chrome MCP Extension - Popup Script
 * 
 * Handles the extension popup interface, status display, and server configuration.
 */

const DEFAULT_SERVER = 'localhost:8080';

class PopupManager {
  constructor() {
    this.init();
  }

  async init() {
    await this.loadServerConfig();
    await this.updateStatus();
    this.setupEventListeners();
    
    // Update status every 2 seconds
    setInterval(() => this.updateStatus(), 2000);
  }

  async loadServerConfig() {
    try {
      const result = await chrome.storage.sync.get(['serverUrl', 'savedServers']);
      const serverUrl = result.serverUrl || DEFAULT_SERVER;
      document.getElementById('serverUrl').value = serverUrl;
      
      // Load saved servers into preset dropdown
      if (result.savedServers && result.savedServers.length > 0) {
        this.updatePresetDropdown(result.savedServers);
      }
    } catch (error) {
      console.error('Error loading server config:', error);
      document.getElementById('serverUrl').value = DEFAULT_SERVER;
    }
  }

  updatePresetDropdown(servers) {
    const select = document.getElementById('presetServers');
    // Clear existing options except the first two
    while (select.options.length > 2) {
      select.remove(2);
    }
    // Add saved servers
    servers.forEach(server => {
      if (server !== 'localhost:8080') {
        const option = document.createElement('option');
        option.value = server;
        option.textContent = server;
        select.appendChild(option);
      }
    });
  }

  setupEventListeners() {
    const reconnectBtn = document.getElementById('reconnectBtn');
    reconnectBtn.addEventListener('click', () => {
      this.reconnectToServer();
    });

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.addEventListener('click', () => {
      this.saveServerConfig();
    });

    const serverInput = document.getElementById('serverUrl');
    serverInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveServerConfig();
      }
    });

    const presetSelect = document.getElementById('presetServers');
    presetSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        document.getElementById('serverUrl').value = e.target.value;
        this.saveServerConfig();
        e.target.value = ''; // Reset dropdown
      }
    });
  }

  async saveServerConfig() {
    const serverUrl = document.getElementById('serverUrl').value.trim();
    if (!serverUrl) {
      alert('Please enter a valid server address');
      return;
    }

    try {
      // Get existing saved servers
      const result = await chrome.storage.sync.get(['savedServers']);
      let savedServers = result.savedServers || ['localhost:8080'];
      
      // Add new server if not already in list
      if (!savedServers.includes(serverUrl)) {
        savedServers.push(serverUrl);
        // Keep only last 10 servers
        if (savedServers.length > 10) {
          savedServers = savedServers.slice(-10);
        }
      }

      // Save to storage
      await chrome.storage.sync.set({ 
        serverUrl: serverUrl,
        savedServers: savedServers
      });
      
      // Update UI
      const saveBtn = document.getElementById('saveBtn');
      saveBtn.textContent = 'Saved!';
      saveBtn.classList.add('saved');
      setTimeout(() => {
        saveBtn.textContent = 'Save';
        saveBtn.classList.remove('saved');
      }, 1500);

      this.updatePresetDropdown(savedServers);
      
      // Notify content script to reconnect with new server
      this.reconnectToServer();
    } catch (error) {
      console.error('Error saving server config:', error);
      alert('Failed to save server configuration');
    }
  }

  async updateStatus() {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[Popup] updateStatus - tab:', tab?.id, 'url:', tab?.url);

      if (tab) {
        document.getElementById('currentUrl').textContent = tab.url;

        // Check if URL is restricted (chrome://, edge://, etc.)
        if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('edge://') ||
            tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('about:')) {
          console.log('[Popup] Restricted URL, content script cannot run here');
          this.updateStatusDisplay(false);
          return;
        }

        // Try to get connection status from content script
        try {
          console.log('[Popup] Sending get_status to tab', tab.id);
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'get_status' });
          console.log('[Popup] Received response:', response);
          this.updateStatusDisplay(response?.connected || false, response?.serverUrl);
        } catch (error) {
          // Content script might not be loaded or responding
          console.log('[Popup] Content script not responding:', error.message);
          console.log('[Popup] Attempting to inject content script...');
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/content.js']
            });
            console.log('[Popup] Content script injected, retrying...');
            // Wait a moment for script to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
            const retryResponse = await chrome.tabs.sendMessage(tab.id, { type: 'get_status' });
            console.log('[Popup] Retry response:', retryResponse);
            this.updateStatusDisplay(retryResponse?.connected || false, retryResponse?.serverUrl);
          } catch (injectError) {
            console.error('[Popup] Failed to inject content script:', injectError.message);
            this.updateStatusDisplay(false);
          }
        }
      }
    } catch (error) {
      console.error('[Popup] Error updating status:', error);
      this.updateStatusDisplay(false);
    }
  }

  updateStatusDisplay(connected, serverUrl) {
    const statusElement = document.getElementById('status');
    const statusText = document.getElementById('statusText');
    const reconnectBtn = document.getElementById('reconnectBtn');

    if (connected) {
      statusElement.className = 'status connected';
      statusText.textContent = 'Connected' + (serverUrl ? ' to ' + serverUrl : '');
      reconnectBtn.textContent = 'Reconnect';
      reconnectBtn.disabled = false;
    } else {
      statusElement.className = 'status disconnected';
      statusText.textContent = 'Disconnected';
      reconnectBtn.textContent = 'Connect to Server';
      reconnectBtn.disabled = false;
    }
  }

  async reconnectToServer() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[Popup] reconnectToServer - tab:', tab?.id, 'url:', tab?.url);

      if (tab) {
        // Check if URL is restricted
        if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('edge://') ||
            tab.url?.startsWith('chrome-extension://') || tab.url?.startsWith('about:')) {
          console.log('[Popup] Cannot reconnect on restricted URL');
          alert('Cannot connect on this page. Please navigate to a regular website.');
          return;
        }

        const serverUrl = document.getElementById('serverUrl').value.trim() || DEFAULT_SERVER;
        console.log('[Popup] Sending reconnect message with serverUrl:', serverUrl);

        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'reconnect',
            serverUrl: serverUrl
          });
          console.log('[Popup] Reconnect message sent successfully');
        } catch (sendError) {
          console.log('[Popup] Failed to send reconnect, trying to inject content script first:', sendError.message);
          // Try to inject content script first
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/content.js']
            });
            console.log('[Popup] Content script injected, retrying reconnect...');
            await new Promise(resolve => setTimeout(resolve, 500));
            await chrome.tabs.sendMessage(tab.id, {
              type: 'reconnect',
              serverUrl: serverUrl
            });
            console.log('[Popup] Reconnect after injection succeeded');
          } catch (injectError) {
            console.error('[Popup] Failed to inject and reconnect:', injectError.message);
            alert('Failed to connect. Please refresh the page and try again.');
          }
        }

        // Update status after a short delay
        setTimeout(() => this.updateStatus(), 1000);
      }
    } catch (error) {
      console.error('[Popup] Error reconnecting:', error);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});
