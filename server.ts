import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
const DB_FILE = path.resolve(DATA_DIR, 'app_database.json');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hruenqwrztbmsxntpclz.supabase.co';
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydWVucXdyenRibXN4bnRwY2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTc3NDYsImV4cCI6MjEwNTUzMzc0Nn0.EebQK3Y5LSFBL-KfUMAHCv1HjGuTL9aQPLHu4z-wwrc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Ensure data and backup directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Function to fetch full authoritative data from Supabase
async function fetchFullDataFromSupabase() {
  try {
    const [
      teachersRes,
      buildingsRes,
      roomsRes,
      subjectsRes,
      examsRes,
      invsRes,
      settingsRes,
    ] = await Promise.all([
      supabase.from('teachers').select('*').order('name'),
      supabase.from('buildings').select('*').order('name'),
      supabase.from('rooms').select('*, building:buildings(*)').order('code'),
      supabase.from('subjects').select('*').order('name'),
      supabase.from('exam_schedules').select('*, subject:subjects(*)').order('exam_date').order('start_time'),
      supabase.from('invigilator_schedules').select('*, exam_schedule:exam_schedules(*, subject:subjects(*)), room:rooms(*), teacher:teachers!invigilator_schedules_teacher_id_fkey(*)'),
      supabase.from('settings').select('*').limit(1).maybeSingle(),
    ]);

    if (!teachersRes.data || teachersRes.data.length === 0) {
      console.warn('[Supabase Sync] No teachers found in Supabase');
      return null;
    }

    const teachers = teachersRes.data;
    const buildings = buildingsRes.data || [];
    const rooms = roomsRes.data || [];
    const subjects = subjectsRes.data || [];
    const examSchedules = examsRes.data || [];
    const invigilatorSchedules = invsRes.data || [];

    // Permanent deleted list to ensure mock/dummy projects never return
    const deletedProjectIds = ['proj-pas-genap-2025', 'proj-asaj-2025'];

    // Construct primary authentic project based on real Supabase exam schedules
    const realProject = {
      id: 'proj-real-sumatif-2026',
      name: 'Asesmen Sumatif / Ujian Sekolah 2026/2027',
      exam_name: 'ASESMEN SUMATIF / UJIAN SEKOLAH',
      academic_year: '2026/2027',
      semester: 'Ganjil',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      exam_schedules: examSchedules,
      invigilator_schedules: invigilatorSchedules,
    };

    const defaultSettings = settingsRes.data || {
      id: 'settings-default',
      school_name: 'SMP BHINNEKA TUNGGAL IKA',
      school_address: 'Jl. Raya Pendidikan No. 01',
      exam_name: 'ASESMEN SUMATIF / UJIAN SEKOLAH',
      academic_year: '2026/2027',
      semester: 'Ganjil',
      principal_name: "Drs. Moh. Mas'ud, S.Pd, M.Pd",
      principal_nip: 'P - 01',
      committee_chairman_name: 'Muhammad Ainul Yaqin, M.Pd.I',
      committee_chairman_nip: 'P - 02',
      committee_secretary_name: 'Mochammad Amiruddin, S.Pd.I',
      document_city: 'Jombang',
      document_date: '2026-10-10',
      default_invigilators_per_room: 1,
      default_start_time: '07:30',
      default_duration: 60,
      break_duration: 30,
      honor_per_session: 50000,
      app_name: 'Sistem Manajemen Ujian & Pengawas Ruang',
      theme: 'blue',
      date_format: 'DD/MM/YYYY',
    };

    const databaseSnapshot = {
      projects: [realProject],
      activeProjectId: realProject.id,
      deletedProjectIds,
      examSchedules,
      invigilatorSchedules,
      settings: defaultSettings,
      teachers,
      buildings,
      rooms,
      subjects,
      users: [],
      clientTimestamp: new Date().toISOString(),
      serverSavedAt: new Date().toISOString(),
      source: 'supabase_authoritative',
    };

    return databaseSnapshot;
  } catch (err) {
    console.error('[Supabase Sync] Error fetching data from Supabase:', err);
    return null;
  }
}

async function startServer() {
  const app = express();

  // Parse JSON payloads up to 50MB (supporting multiple projects and full schedules)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // ==================== REST API ENDPOINTS ====================

  // App & Supabase Configuration endpoint for any browser/email
  app.get('/api/config', (req, res) => {
    res.json({
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_KEY,
      serverTime: new Date().toISOString(),
    });
  });

  // Force sync from Supabase endpoint
  app.post('/api/sync-supabase', async (req, res) => {
    try {
      const data = await fetchFullDataFromSupabase();
      if (!data) {
        return res.status(500).json({ success: false, error: 'Failed to fetch from Supabase' });
      }
      const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, DB_FILE);
      return res.json({ success: true, message: 'Synchronized successfully from Supabase', data });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Sync failed' });
    }
  });

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
  app.get('/api/data', async (req, res) => {
    try {
      if (!fs.existsSync(DB_FILE)) {
        const fresh = await fetchFullDataFromSupabase();
        if (fresh) {
          fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2), 'utf-8');
          return res.json({ initialized: true, data: fresh });
        }
        return res.json({ initialized: false, data: null });
      }
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      let data = JSON.parse(raw);

      // Self-heal: If database has fewer than 20 teachers but Supabase has 79 teachers, auto-sync
      if (!data.teachers || data.teachers.length < 20) {
        const fresh = await fetchFullDataFromSupabase();
        if (fresh) {
          data = fresh;
          fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
        }
      }

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

      // Protection: if existing DB has authentic teachers (>= 50), do not allow mock dummy data (<= 15) to overwrite it
      if (fs.existsSync(DB_FILE)) {
        try {
          const current = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
          if (current.teachers && current.teachers.length >= 50) {
            if (!payload.teachers || payload.teachers.length < 20) {
              payload.teachers = current.teachers;
            }
            if (!payload.buildings || payload.buildings.length < 1) {
              payload.buildings = current.buildings;
            }
            if (!payload.rooms || payload.rooms.length < 10) {
              payload.rooms = current.rooms;
            }
            if (!payload.subjects || payload.subjects.length < 5) {
              payload.subjects = current.subjects;
            }
          }
        } catch (_) {}
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

  // On startup: Ensure database is initialized with real Supabase data if missing or stale
  try {
    if (!fs.existsSync(DB_FILE)) {
      console.log('[Server] No database file found on startup. Syncing from Supabase...');
      const snapshot = await fetchFullDataFromSupabase();
      if (snapshot) {
        fs.writeFileSync(DB_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');
        console.log('[Server] Initialized app_database.json from Supabase with', snapshot.teachers?.length, 'teachers');
      }
    } else {
      const current = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      if (!current.teachers || current.teachers.length < 20) {
        console.log('[Server] Database has mock data (<20 teachers). Syncing authentic data from Supabase...');
        const snapshot = await fetchFullDataFromSupabase();
        if (snapshot) {
          fs.writeFileSync(DB_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');
          console.log('[Server] Replaced mock data with Supabase data (', snapshot.teachers?.length, 'teachers)');
        }
      }
    }
  } catch (initErr) {
    console.warn('[Server] Startup Supabase sync warning:', initErr);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
