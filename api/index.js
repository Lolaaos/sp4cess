import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import xss from 'xss';
import cookieParser from 'cookie-parser';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import { ADMIN_IDS, PURCHASE_WEBHOOK_URL } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configura Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middlewares
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'dist')));

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

// Funciones para Supabase
const getSupabaseData = async (table, defaultValue = []) => {
  try {
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw error;
    return data || defaultValue;
  } catch (e) {
    console.error(`[Supabase] Error al leer ${table}:`, e.message);
    return defaultValue;
  }
};

const saveSupabaseData = async (table, data, idField = 'id') => {
  try {
    if (data[idField]) {
      const { error } = await supabase.from(table).upsert(data, { onConflict: idField });
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).insert(data);
      if (error) throw error;
    }
  } catch (e) {
    console.error(`[Supabase] Error al guardar en ${table}:`, e.message);
  }
};

// Configuración de Discord
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const fetchUserFromBot = async (userId) => {
  if (!BOT_TOKEN) return null;
  try {
    const res = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
      timeout: 1500,
    });
    return res.data;
  } catch (e) {
    return null;
  }
};

const updateTeamList = async (user) => {
  if (!user || !user.id) return;
  const idStr = String(user.id);
  const adminIdsStr = ADMIN_IDS.map(id => String(id));

  if (adminIdsStr.includes(idStr)) {
    let teamList = await getSupabaseData('team', []);
    if (!Array.isArray(teamList)) teamList = [];

    const idx = teamList.findIndex(m => String(m.id) === idStr);
    const data = { id: idStr, username: user.username, avatar: user.avatar, banner: user.banner };
    if (idx === -1) teamList.push(data);
    else teamList[idx] = data;

    await saveSupabaseData('team', teamList);
  }
};

const isAdmin = (req, res, next) => {
  const userId = req.session.user ? String(req.session.user.id) : null;
  if (userId && ADMIN_IDS.map(id => String(id)).includes(userId)) return next();
  res.status(403).json({ error: 'Acceso denegado' });
};

// --- Rutas API ---
// Products
app.get('/api/products', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

app.post('/api/products', isAdmin, async (req, res) => {
  try {
    const product = { id: Date.now(), ...req.body };
    const { error } = await supabase.from('products').insert(product);
    if (error) throw error;
    res.status(201).json(product);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// Coupons
app.get('/api/coupons', async (req, res) => {
  try {
    const { data, error } = await supabase.from('coupons').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener cupones' });
  }
});

// Notifications
app.get('/api/notifications', isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('notifications').select('*');
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

// Reviews
app.get('/api/reviews/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('target_id', req.params.id);
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener reseñas' });
  }
});

// Auth
app.get('/api/me', (req, res) => {
  if (req.session.user) {
    const userId = String(req.session.user.id);
    const isUserAdmin = ADMIN_IDS.map(id => String(id)).includes(userId);
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
    await updateTeamList(userResponse.data);

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

// Manejo de rutas estáticas
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Exporta la app para Vercel
export default app;
