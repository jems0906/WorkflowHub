import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

dotenv.config();

import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import commentRoutes from './routes/comment.routes';
import notificationRoutes from './routes/notification.routes';
import userRoutes from './routes/user.routes';
import { errorHandler } from './middleware/errorHandler';
import { pool } from './db/pool';

const app = express();

const defaultOrigins = ['http://localhost:5173', 'http://localhost:4000'];
const configuredOrigins = (process.env.FRONTEND_URL ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultOrigins, ...configuredOrigins]);
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '900000', 10);
const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX ?? '200', 10);

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('CORS origin denied'));
    },
    credentials: true,
  })
);
app.use(
  '/api',
  rateLimit({
    windowMs: rateLimitWindowMs,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/tasks/:taskId/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use(errorHandler);

const PORT = parseInt(process.env.PORT ?? '4000', 10);

async function ensureDatabaseConnection(): Promise<void> {
  const maxAttempts = parseInt(process.env.DB_CONNECT_MAX_ATTEMPTS ?? '5', 10);
  const retryDelayMs = parseInt(process.env.DB_CONNECT_RETRY_MS ?? '1500', 10);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query('SELECT 1');
      if (attempt > 1) {
        console.log(`✅ Database connection established on attempt ${attempt}/${maxAttempts}`);
      }
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Database connection attempt ${attempt}/${maxAttempts} failed: ${message}`);

      if (attempt === maxAttempts) {
        throw new Error(
          'Unable to connect to PostgreSQL. Check backend/.env DATABASE_URL and DB service availability.'
        );
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

async function startServer(): Promise<void> {
  try {
    await ensureDatabaseConnection();
    app.listen(PORT, () => {
      console.log(`🚀 WorkflowHub API running on http://localhost:${PORT}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Startup failed: ${message}`);
    process.exit(1);
  }
}

void startServer();

export default app;
