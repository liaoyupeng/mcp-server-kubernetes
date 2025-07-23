import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "crypto";

export function startHttpServer(server: Server) {
  const app = express();
  
  // Middleware for parsing JSON (with size limit)
  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/health_check', (req, res) => {
    res.json({ status: 'ok', service: 'mcp-kubernetes-server' });
  });

  // Create a single transport instance for the HTTP server
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  // Connect the server to the transport once
  server.connect(transport);

  // MCP endpoint handler - supports both GET (SSE) and POST (JSON-RPC)
  app.all('/mcp', async (req, res) => {
    try {
      // Handle the request through the transport
      await transport.handleRequest(req, res, req.body);
      
    } catch (error) {
      console.error('MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
  });

  let port = 3000;
  try {
    port = parseInt(process.env.PORT || "3000", 10);
  } catch (e) {
    console.error("Invalid PORT environment variable, using default port 3000.");
  }

  const host = process.env.HOST || "localhost";
  
  app.listen(port, host, () => {
    console.log(
      `mcp-kubernetes-server HTTP API is listening on port ${port}\n` +
      `Base URL: http://${host}:${port}\n` +
      `Available endpoints:\n` +
      `  GET  /health - Health check\n` +
      `  GET  /mcp - SSE connection for MCP clients\n` +
      `  POST /mcp - Send JSON-RPC messages (all MCP communication goes through this endpoint)\n` +
      `  DELETE /mcp - Close MCP session`
    );
  });
}
