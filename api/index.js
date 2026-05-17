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
import { ADMIN_IDS, PURCHASE_WEBHOOK_URL } from '../config.js';

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

app.put('/api/products/:id', isAdmin, async (req, res) => {
  try {
    const productId = req.params.id;
    const updatedProduct = { id: productId, ...req.body };
    const { error } = await supabase.from('products').upsert(updatedProduct, { onConflict: 'id' });
    if (error) throw error;
    res.json(updatedProduct);
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

app.delete('/api/products/:id', isAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar producto' });
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

app.post('/api/coupons', isAdmin, async (req, res) => {
  try {
    const coupon = { id: Date.now(), ...req.body };
    const { error } = await supabase.from('coupons').insert(coupon);
    if (error) throw error;
    res.status(201).json(coupon);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear cupón' });
  }
});

app.delete('/api/coupons/:id', isAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('coupons').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al eliminar cupón' });
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

app.post('/api/notifications/:id/confirm', isAdmin, async (req, res) => {
  try {
    const notifId = Number(req.params.id);
    const { data: notif, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notifId)
      .single();

    if (error || !notif) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }
    if (notif.status === 'confirmed') {
      return res.status(400).json({ error: 'La compra ya fue confirmada' });
    }

    const updatedNotif = {
      ...notif,
      status: 'confirmed',
      confirmedAt: new Date().toISOString()
    };
    await supabase.from('notifications').upsert(updatedNotif, { onConflict: 'id' });

    if (Array.isArray(notif.items)) {
      const { data: products, error: prodError } = await supabase.from('products').select('*');
      if (!prodError && products) {
        for (const item of notif.items) {
          const prod = products.find(p => String(p.id) === String(item.id));
          if (prod) {
            const currentStock = Number(prod.stock) || 0;
            const qty = Number(item.qty) || 0;
            const newStock = Math.max(0, currentStock - qty);
            await supabase.from('products').upsert({ ...prod, stock: newStock }, { onConflict: 'id' });
          }
        }
      }
    }

    res.json({ success: true, notification: updatedNotif });
  } catch (e) {
    res.status(500).json({ error: 'Error al confirmar notificación' });
  }
});

app.delete('/api/notifications/:id', isAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('notifications').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch
