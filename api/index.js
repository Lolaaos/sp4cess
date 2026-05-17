import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import xss from 'xss';
import cookieParser from 'cookie-parser';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_IDS, PURCHASE_WEBHOOK_URL } from '../config.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Configura Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middlewares
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Middleware para sesión
app.use((req, res, next) => {
  req.session = req.session || {};
  if (req.cookies.sp4ce_user) {
    try {
      const decoded = Buffer.from(req.cookies.sp4ce_user, 'base64').toString('utf-8');
      req.session.user = JSON.parse(decoded);
    } catch (e) {
      req.session.user = null;
    }
  }
  next();
});

// --- Rutas API (solo las esenciales para probar) ---
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.get('/api/me', (req, res) => {
  if (req.session.user) {
    const userId = String(req.session.user.id);
    const isUserAdmin = ADMIN_IDS.includes(userId);
    res.json({ user: req.session.user, isAdmin: isUserAdmin });
  } else {
    res.status(401).end();
  }
});

app.get('/auth/discord', (req, res) => {
  res.redirect(
    `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
      process.env.DISCORD_REDIRECT_URI
    )}&response_type=code&scope=identify`
  );
});

app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?error=auth');

  try {
    const tokenResponse = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
    });

    req.session.user = userResponse.data;
    const base64User = Buffer.from(JSON.stringify(userResponse.data)).toString('base64');
    res.cookie('sp4ce_user', base64User, {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    res.redirect('/');
  } catch (e) {
    res.redirect('/?error=auth');
  }
});

app.get('/api/logout', (req, res) => {
  res.clearCookie('sp4ce_user');
  res.redirect('/');
});

// Exporta la app para Vercel
export default app;
