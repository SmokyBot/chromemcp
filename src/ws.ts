import { WebSocketServer } from "ws";
import { createServer as createHttpsServer } from "https";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import selfsigned from "selfsigned";

import { mcpConfig } from "./config";
import { wait } from "./utils";

import { isPortInUse, killProcessOnPort } from "@/utils/port";

export interface WebSocketOptions {
  host?: string;
  port?: number;
  ssl?: boolean;
  certPath?: string;
  keyPath?: string;
}

const CERT_DIR = join(homedir(), ".chromemcp", "certs");
const CERT_PATH = join(CERT_DIR, "server.crt");
const KEY_PATH = join(CERT_DIR, "server.key");

function ensureCertificates(host: string): { cert: string; key: string } {
  // Check if certificates already exist
  if (existsSync(CERT_PATH) && existsSync(KEY_PATH)) {
    console.log(`[Chrome MCP] Using existing certificates from ${CERT_DIR}`);
    return {
      cert: readFileSync(CERT_PATH, "utf-8"),
      key: readFileSync(KEY_PATH, "utf-8"),
    };
  }

  console.log(`[Chrome MCP] Generating new self-signed certificate...`);

  // Create cert directory if it doesn't exist
  if (!existsSync(CERT_DIR)) {
    mkdirSync(CERT_DIR, { recursive: true });
  }

  // Generate self-signed certificate
  const attrs = [{ name: "commonName", value: "Chrome MCP Server" }];
  const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: "sha256",
    extensions: [
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" }, // DNS
          { type: 7, ip: "127.0.0.1" }, // IP
          { type: 7, ip: host }, // Custom host IP
          { type: 2, value: host }, // Custom host as DNS
        ],
      },
    ],
  });

  // Save certificates
  writeFileSync(CERT_PATH, pems.cert);
  writeFileSync(KEY_PATH, pems.private);

  console.log(`[Chrome MCP] Certificates saved to ${CERT_DIR}`);

  return {
    cert: pems.cert,
    key: pems.private,
  };
}

export async function createWebSocketServer(
  options: WebSocketOptions = {}
): Promise<WebSocketServer> {
  const host = options.host ?? mcpConfig.webSocket.host;
  const port = options.port ?? mcpConfig.webSocket.port;
  const useSSL = options.ssl ?? false;

  const protocol = useSSL ? "wss" : "ws";
  console.log(
    `[Chrome MCP] Setting up ${protocol.toUpperCase()} server on ${host}:${port}`
  );

  // Kill any process that might be using the port
  killProcessOnPort(port);

  // Wait until the port is free
  let attempts = 0;
  while (await isPortInUse(port)) {
    attempts++;
    console.log(
      `[Chrome MCP] Port ${port} still in use, waiting... (attempt ${attempts})`
    );
    await wait(100);
    if (attempts > 50) {
      console.error(
        `[Chrome MCP] Failed to free up port ${port} after ${attempts} attempts`
      );
      throw new Error(`Could not start WebSocket server: port ${port} is in use`);
    }
  }

  let wss: WebSocketServer;

  if (useSSL) {
    // Get or generate certificates
    const { cert, key } = options.certPath && options.keyPath
      ? {
          cert: readFileSync(options.certPath, "utf-8"),
          key: readFileSync(options.keyPath, "utf-8"),
        }
      : ensureCertificates(host);

    const httpsServer = createHttpsServer({ cert, key });

    wss = new WebSocketServer({ server: httpsServer });

    httpsServer.listen(port, host, () => {
      console.log(`[Chrome MCP] WSS server is listening on ${host}:${port}`);
      console.log();
      console.log("=".repeat(60));
      console.log("  IMPORTANT: To use from HTTPS pages, accept the certificate:");
      console.log(`  Open in browser: https://${host}:${port}`);
      console.log("  Click 'Advanced' -> 'Proceed' to trust the certificate");
      console.log("=".repeat(60));
      console.log();
    });

    httpsServer.on("error", (error) => {
      console.error(`[Chrome MCP] HTTPS server error:`, error);
    });
  } else {
    console.log(`[Chrome MCP] Creating WS server on ${host}:${port}`);
    wss = new WebSocketServer({ host, port });

    wss.on("listening", () => {
      console.log(`[Chrome MCP] WS server is listening on ${host}:${port}`);
    });
  }

  wss.on("error", (error) => {
    console.error(`[Chrome MCP] WebSocket server error:`, error);
  });

  return wss;
}
