# Chrome MCP: Give Your AI the Keys to Your Browser

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://developer.chrome.com/docs/extensions/)

**Unleash your AI's full potential by giving it direct, secure control over your personal Chrome browser.**

---

## Core Philosophy: Speed and Simplicity

- **No Heavy Dependencies**: Minimal set of well-vetted libraries
- **Instant Startup**: Hooks into your existing browser
- **Zero-Clutter Setup**: Configuration completed in minutes

## The Solution: Seamless, Context-Aware Automation

chromemcp is a **Model Context Protocol (MCP)** server that bridges AI agents with **your own Chrome browser**. It connects to the browser you are already using, complete with your logins, history, and cookies.

Your AI can:
- Operate on websites that require a login
- Leverage your existing session data for context
- Avoid bot detection by using your genuine browser fingerprint
- Work alongside you, in your environment

## Quick Start

1. **Clone and Install**
   ```bash
   git clone https://github.com/hoangcongst/chromemcp.git
   cd chromemcp
   pnpm install && pnpm build
   ```

2. **Load the Extension**
   - Go to chrome://extensions, enable **Developer Mode**
   - Click **Load unpacked** and select the extension folder

3. **Configure Your AI Client**
   ```json
   {
     "name": "ChromeMCP",
     "command": "node",
     "args": ["/path/to/chromemcp/dist/index.cjs"],
     "type": "stdio"
   }
   ```
   
   Or use the published version:
   ```json
   {
     "name": "ChromeMCP",
     "command": "npx",
     "args": ["@hoangcongst/chromemcp"],
     "type": "stdio"
   }
   ```

## Advanced Configuration

### CLI Options

| Option | Description | Default |
| :--- | :--- | :--- |
| --host <host> | Host/IP to bind the WebSocket server | 0.0.0.0 |
| --port <port> | Port for the WebSocket server | 8080 |
| --ssl | Enable WSS with auto-generated self-signed certificate | disabled |
| --cert <path> | Path to custom SSL certificate file | - |
| --key <path> | Path to custom SSL key file | - |

### Remote Server Setup

Run the MCP server on a remote machine and connect from your browser:

1. **Start the server on the remote machine:**
   ```bash
   # Basic (HTTP pages only)
   node dist/index.cjs --host 0.0.0.0 --port 8080

   # With SSL for HTTPS pages (auto-generates certificate)
   node dist/index.cjs --host 0.0.0.0 --port 8080 --ssl
   ```

2. **Configure the extension:**
   - Click the Chrome MCP extension icon
   - Enter your server address (e.g., myserver.local:8080)
   - Click Save then Connect to Server

3. **For HTTPS pages (when using --ssl):**
   - Visit https://YOUR_SERVER:PORT in your browser
   - Click Advanced then Proceed to accept the self-signed certificate
   - Now the extension can connect via WSS from HTTPS pages

**Note:** Self-signed certificates are stored in ~/.chromemcp/certs/ and reused on subsequent runs.

### Example Remote Configuration

```json
{
  "name": "ChromeMCP",
  "command": "node",
  "args": [
    "/path/to/chromemcp/dist/index.cjs",
    "--host", "0.0.0.0",
    "--port", "8080",
    "--ssl"
  ],
  "type": "stdio"
}
```

## Available Tools

### Vision and Understanding
- **snapshot**: Perceive the structure and content of a webpage
- **screenshot**: See the visual layout of the page
- **get_inner_html**: Read the raw content or text of any element
- **get_console_logs**: Debug by checking for errors and messages
- **get_network_logs**: Monitor network requests and responses

### Action and Interaction
- **click**, **hover**, **type**: Interact with any element
- **navigate**, **go_back**, **go_forward**: Control browser navigation
- **press_key**, **select_option**: Handle forms and keyboard shortcuts

## License

This project is licensed under the **MIT License**. See the LICENSE file for details.
