import SqliteStore from 'better-sqlite3-session-store';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

import { getDb } from './db/index.js';
import apiRoutes from './routes/api.js';
import authRoutes from './routes/auth.js';
import previewRoutes from './routes/preview.js';
import publishRoutes from './routes/publish.js';
import settingsRoutes from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration with SQLite store (persists across server restarts)
const SqliteSessionStore = SqliteStore(session);
app.use(session({
  store: new SqliteSessionStore({
    client: getDb(),
    expired: {
      clear: true,
      intervalMs: 24 * 60 * 60 * 1000 // Clear expired sessions every 24 hours
    }
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Serve editor assets
app.use('/editor', express.static(path.join(__dirname, '../editor')));

// Serve @tailwindplus/elements from node_modules
app.use('/vendor/tailwindplus-elements', express.static(
  path.join(__dirname, '../node_modules/@tailwindplus/elements/dist')
));

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/publish', publishRoutes);
app.use('/settings', settingsRoutes);

// Preview mode handler (must be before static files)
app.use(previewRoutes);

// Serve published files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Capuzzella server running at http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
