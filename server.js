import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import citizenAuthRoutes from './routes/citizenAuth.js';
import authorityAuthRoutes from './routes/authorityAuth.js';
import citizenProfileRoutes from './routes/citizenProfile.js';
import passwordResetRoutes from './routes/passwordReset.js';
import superAdminRoutes from './routes/superAdmin.js';
import reportsRoutes from './routes/reports.js';

dotenv.config();

const app = express();

// ─── MIDDLEWARE ──────────────────────────────────────────
app.use(cors({
  origin: (origin, callback) => callback(null, true), // Allow Vercel and Localhost dynamically
  credentials: true,                                  // Allow cookies
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static('uploads'));

// ─── ROUTES ─────────────────────────────────────────────
app.use('/api/citizen', citizenAuthRoutes);
app.use('/api/authority', authorityAuthRoutes);
app.use('/api/citizen', citizenProfileRoutes);
app.use('/api/password', passwordResetRoutes);
app.use('/api/superadmin', superAdminRoutes);
app.use('/api/reports', reportsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── START SERVER ───────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 LoclyAI backend running on http://localhost:${PORT}`);
});
