import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
const DB_FILE = path.resolve(DATA_DIR, 'app_database.json');

// Ensure data and backup directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

async function startServer() {
  const app = express();

  // Parse JSON payloads up to 50MB (supporting multiple projects and full schedules)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ==================== REST API ENDPOINTS ====================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasDatabaseFile: fs.existsSync(DB_FILE),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Get current database
  app.get('/api/data', (req, res) => {
    try {
      if (!fs.existsSync(DB_FILE)) {
        return res.json({ initialized: false, data: null });
      }
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return res.json({ initialized: true, data });
    } catch (err: any) {
      console.error('[API] Error reading database file:', err);
      return res.status(500).json({ initialized: false, error: err?.message || 'Failed to read data' });
    }
  });

  // Save database (called whenever changes happen in DataContext)
  app.post('/api/data', (req, res) => {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ success: false, error: 'Invalid payload' });
      }

      const timestamp = new Date().toISOString();
      const enrichedData = {
        ...payload,
        serverSavedAt: timestamp,
      };

      // Atomic write to prevent file corruption
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(enrichedData, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);

      // Create an automatic backup once per hour or on significant updates
      try {
        const dateStr = timestamp.split('T')[0];
        const backupFile = path.resolve(BACKUPS_DIR, `auto_backup_${dateStr}.json`);
        if (!fs.existsSync(backupFile)) {
          fs.writeFileSync(backupFile, JSON.stringify(enrichedData, null, 2), 'utf-8');
        }
      } catch (backupErr) {
        console.warn('[API] Auto backup warning:', backupErr);
      }

      return res.json({ success: true, savedAt: timestamp });
    } catch (err: any) {
      console.error('[API] Error saving database file:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Failed to save data' });
    }
  });

  // Create manual backup
  app.post('/api/backup', (req, res) => {
    try {
      if (!fs.existsSync(DB_FILE)) {
        return res.status(404).json({ success: false, error: 'No database to backup' });
      }
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const filename = `manual_backup_${Date.now()}.json`;
      const backupPath = path.resolve(BACKUPS_DIR, filename);
      fs.writeFileSync(backupPath, raw, 'utf-8');
      return res.json({ success: true, filename, savedAt: new Date().toISOString() });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message });
    }
  });

  // List backups
  app.get('/api/backups', (req, res) => {
    try {
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          const stats = fs.statSync(path.resolve(BACKUPS_DIR, f));
          return {
            filename: f,
            size: stats.size,
            createdAt: stats.birthtime || stats.mtime,
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return res.json({ success: true, backups: files });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message });
    }
  });

  // ==================== VITE SPA & STATIC ASSETS ====================
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.warn('[Server] dist folder not found, running Vite middlewares as fallback');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
