import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // In-memory server cache for cross-device shared real-time state
  let serverVendors: any[] = [];
  let serverLeads: any[] = [];
  let serverLogs: any[] = [];
  let sseClients: Response[] = [];

  const broadcastSSE = (eventType: string, payload: any) => {
    const data = JSON.stringify({ type: eventType, payload, timestamp: Date.now() });
    sseClients.forEach((client) => {
      try {
        client.write(`data: ${data}\n\n`);
      } catch {
        // Client disconnected
      }
    });
  };

  // SSE Stream for Real-Time Multi-Device Sync
  app.get('/api/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);

    // Initial state push
    res.write(`data: ${JSON.stringify({ type: 'init', payload: { leads: serverLeads, vendors: serverVendors, logs: serverLogs } })}\n\n`);

    req.on('close', () => {
      sseClients = sseClients.filter((c) => c !== res);
    });
  });

  // REST API: Leads
  app.get('/api/leads', (_req: Request, res: Response) => {
    res.json({ leads: serverLeads });
  });

  app.post('/api/leads/batch', (req: Request, res: Response) => {
    const { leads } = req.body;
    if (Array.isArray(leads)) {
      serverLeads = leads;
      broadcastSSE('leads_updated', { leads: serverLeads });
    }
    res.json({ success: true, count: serverLeads.length });
  });

  // REST API: Vendors
  app.get('/api/vendors', (_req: Request, res: Response) => {
    res.json({ vendors: serverVendors });
  });

  app.post('/api/vendors/batch', (req: Request, res: Response) => {
    const { vendors } = req.body;
    if (Array.isArray(vendors)) {
      serverVendors = vendors;
      broadcastSSE('vendors_updated', { vendors: serverVendors });
    }
    res.json({ success: true, count: serverVendors.length });
  });

  // REST API: Rotation Logs
  app.get('/api/rotation-logs', (_req: Request, res: Response) => {
    res.json({ logs: serverLogs });
  });

  app.post('/api/rotation-logs', (req: Request, res: Response) => {
    const { log } = req.body;
    if (log) {
      serverLogs = [log, ...serverLogs].slice(0, 1000);
      broadcastSSE('new_rotation_log', { log });
    }
    res.json({ success: true });
  });

  // Google Sheet Proxy to bypass browser CORS when fetching published CSV
  app.get('/api/google-sheet/sync', async (req: Request, res: Response) => {
    const sheetUrl = req.query.url as string;
    if (!sheetUrl) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      const response = await fetch(sheetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Rotex-CRM/1.0',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Google Sheets respondió con código ${response.status}`,
        });
      }

      const csv = await response.text();
      res.json({ success: true, csv });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Error al descargar la Google Sheet' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // Mount Vite or static dist
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rotex Platform server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
