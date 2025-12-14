#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { program } from "commander";
import type { Resource } from "@/resources/resource";
import { createServerWithTools } from "@/server";
import * as common from "@/tools/common";
import * as custom from "@/tools/custom";
import * as snapshot from "@/tools/snapshot";
import type { Tool } from "@/tools/tool";

import packageJSON from "../package.json";

function setupExitWatchdog(server: Server) {
  process.stdin.on("close", async () => {
    setTimeout(() => process.exit(0), 15000);
    await server.close();
    process.exit(0);
  });
}

const commonTools: Tool[] = [common.pressKey, common.wait];

const customTools: Tool[] = [
  custom.getConsoleLogs,
  custom.getNetworkLogs,
  custom.screenshot,
  custom.getInnerHTML,
];

const snapshotTools: Tool[] = [
  common.navigate(true),
  common.goBack(true),
  common.goForward(true),
  snapshot.snapshot,
  snapshot.click,
  snapshot.hover,
  snapshot.type,
  snapshot.selectOption,
  ...commonTools,
  ...customTools,
];

const resources: Resource[] = [];

program
  .version("Version " + packageJSON.version)
  .name(packageJSON.name)
  .option("--host <host>", "Host to bind WebSocket server", "0.0.0.0")
  .option("--port <port>", "Port for WebSocket server", "8080")
  .option("--ssl", "Enable WSS with auto-generated self-signed certificate")
  .option("--cert <path>", "Path to custom SSL certificate file")
  .option("--key <path>", "Path to custom SSL key file")
  .action(async (options) => {
    const wsOptions = {
      host: options.host,
      port: parseInt(options.port, 10),
      ssl: options.ssl || (options.cert && options.key),
      certPath: options.cert,
      keyPath: options.key,
    };
    
    console.log();
    
    const server = await createServerWithTools({
      name: "chromemcp",
      version: packageJSON.version,
      tools: snapshotTools,
      resources,
      wsOptions,
    });
    
    setupExitWatchdog(server);

    const transport = new StdioServerTransport();
    console.log("MCP server started - listening for connections via stdio");
    await server.connect(transport);
  });

program.parse(process.argv);
