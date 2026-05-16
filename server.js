import 'dotenv/config';
import express from 'express';
import cookieSession from 'cookie-session';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import xss from 'xss';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

app.use(cookieSession({
  name: 'sp4ce_session',
  secret: process.env.SESSION_SECRET || 'sp4ce_ultra_secure_2026',
  maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
  secure: false,
  sameSite: 'lax'
}));

const DATA_FILE = path.join(__dirname, 'products.json');
const COUPONS_FILE = path.join(__dirname, 'coupons.json');
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');
const ADMIN_STATS_FILE = path.join(__dirname, 'admin_stats.json');
const TEAM_FILE = path.join(__dirname, 'team.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const NOTIFICATIONS_FILE = path.join(__dirname, 'notifications.json');


const resolveFilePath = (file) => {
  if (process.env.VERCEL) {
    const filename = path.basename(file);
    const tmpPath = path.join('/tmp', filename);
    if (fs.existsSync(tmpPath)) {
      return tmpPath;
    }
  }
  return file;
};

const loadData = (file, isArray = true) => {
  try {
    const activeFile = resolveFilePath(file);
    if (!fs.existsSync(activeFile)) return isArray ? [] : {};
    const raw = fs.readFileSync(activeFile, 'utf-8').trim();
    if (!raw) return isArray ? [] : {};
    return JSON.parse(raw);
  } catch (e) { 
    console.warn(`[SP4CE] Warning: Invalid JSON in ${file}. Using fallback.`);
    return isArray ? [] : {}; 
  }
};

let products = loadData(DATA_FILE);
let coupons = loadData(COUPONS_FILE);
let reviews = loadData(REVIEWS_FILE);
let adminStats = loadData(ADMIN_STATS_FILE, false);
let teamList = loadData(TEAM_FILE);
let settings = loadData(SETTINGS_FILE, false);
let notifications = loadData(NOTIFICATIONS_FILE);
if (!settings.currency) settings.currency = 'USD';


const saveData = (file, data) => {
  try {
    if (process.env.VERCEL) {
      const filename = path.basename(file);
      const tmpPath = path.join('/tmp', filename);
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    } else {
      fs.writeFileSync(file, JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.warn(`[SP4CE] Warning: Could not write to ${file}:`, e.message);
  }
};

import { ADMIN_IDS, PURCHASE_WEBHOOK_URL } from './config.js';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

const fetchUserFromBot = async (userId) => {
  if (!BOT_TOKEN) return null;
  try {
    const res = await axios.get(`https://discord.com/api/v10/users/${userId}`, {
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
      timeout: 1500
    });
    return res.data;
  } catch (e) { return null; }
};

const updateTeamList = (user) => {
  if (!user || !user.id) return;
  const idStr = String(user.id);
  const adminIdsStr = ADMIN_IDS.map(id => String(id));
  
  if (adminIdsStr.includes(idStr)) {
    // Reload teamList from file to be absolutely sure we don't use stale memory
    let currentTeamList = loadData(TEAM_FILE);
    if (!Array.isArray(currentTeamList)) currentTeamList = [];
    
    const idx = currentTeamList.findIndex(m => String(m.id) === idStr);
    const data = { id: idStr, username: user.username, avatar: user.avatar, banner: user.banner };
    if (idx === -1) currentTeamList.push(data);
    else currentTeamList[idx] = data;
    
    saveData(TEAM_FILE, currentTeamList);
    console.log(`[TEAM] Profile updated for Admin: ${user.username}`);
  } else {
    console.log(`[TEAM] Skip: User ${user.username} (${idStr}) is not in Admin list.`);
  }
};

const isAdmin = (req, res, next) => {
  const userId = req.session.user ? String(req.session.user.id) : null;
  if (userId && ADMIN_IDS.map(id => String(id)).includes(userId)) return next();
  res.status(403).json({ error: 'Denied' });
};

// API ROUTES
app.get('/api/team', async (req, res) => {
  try {
    const finalTeam = [];
    const processedIds = new Set();
    const currentUserId = req.session.user ? String(req.session.user.id) : null;
    const currentTeamList = loadData(TEAM_FILE);
    const adminIdsStr = ADMIN_IDS.map(id => String(id));

    console.log(`[DEBUG-TEAM] API Hit. Config ADMIN_IDS:`, adminIdsStr);
    console.log(`[DEBUG-TEAM] Raw team.json:`, currentTeamList);

    if (Array.isArray(currentTeamList)) {
      currentTeamList.forEach(m => { 
        const idStr = String(m.id);
        if (adminIdsStr.includes(idStr)) {
          finalTeam.push({ ...m, role: "Admin Principal" }); 
          processedIds.add(idStr); 
        } else {
          console.log(`[DEBUG-TEAM] Filtered out user from team.json:`, m.username, `(${idStr})`);
        }
      });
    }
    
    for (const idStr of adminIdsStr) {
      if (!processedIds.has(idStr)) {
        const botUser = await fetchUserFromBot(idStr);
        if (botUser) finalTeam.push({ id: idStr, username: botUser.username, avatar: botUser.avatar, banner: botUser.banner, role: "Admin Principal" });
        else finalTeam.push({ id: idStr, username: `Admin (${idStr.slice(-4)})`, avatar: null, banner: null, role: "Admin Principal", isPlaceholder: true });
        processedIds.add(idStr);
      }
    }

    console.log(`[DEBUG-TEAM] Final Team sent to frontend:`, finalTeam.map(f => f.username));
    
    res.json(finalTeam.map(m => {
      const likedBy = Array.isArray(adminStats[m.id]) ? adminStats[m.id] : [];
      return { 
        ...m, 
        likes: likedBy.length,
        hasLiked: currentUserId ? likedBy.some(id => String(id) === currentUserId) : false
      };
    }));
  } catch (err) { res.status(500).end(); }
});

app.post('/api/admin-stats/:id/like', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Inicia sesión para votar' });
  const adminId = String(req.params.id);
  const userId = String(req.session.user.id);
  
  // adminStats will now be { adminId: [userId1, userId2, ...] }
  if (!Array.isArray(adminStats[adminId])) adminStats[adminId] = [];

  const alreadyLiked = adminStats[adminId].some(id => String(id) === userId);
  
  if (alreadyLiked) {
    return res.status(400).json({ error: 'Ya has apoyado a este administrador', likes: adminStats[adminId].length });
  }

  adminStats[adminId].push(userId);
  saveData(ADMIN_STATS_FILE, adminStats);
  
  res.json({ likes: adminStats[adminId].length, hasLiked: true });
});

app.get('/api/settings', (req, res) => res.json(settings));
app.post('/api/settings', isAdmin, (req, res) => {
  settings = { ...settings, ...req.body };
  saveData(SETTINGS_FILE, settings);
  res.json(settings);
});

app.get('/api/products', (req, res) => {
  // Defensive check: if products is an object (not array), convert to array
  if (!Array.isArray(products) && typeof products === 'object') {
    const list = Object.entries(products).map(([id, val]) => ({ id, ...val }));
    return res.json(list);
  }
  res.json(products);
});
app.get('/api/coupons', (req, res) => res.json(coupons));

const sendPurchaseWebhook = async ({ user, items, couponCode, discountPercent, subtotal, total, currency }) => {
  const totalQty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const productLines = items.map(i => {
    const lineTotal = Number(i.price || 0) * (Number(i.qty) || 0);
    return `• **${i.name}** ×${i.qty} — $${lineTotal.toFixed(2)}`;
  }).join('\n');

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const embed = {
    title: '🛒 Nueva Compra — SP4CE Store',
    color: 0xff3333,
    thumbnail: { url: avatarUrl },
    fields: [
      { name: '👤 Cliente', value: `**${user.username}**`, inline: true },
      { name: '🆔 ID Discord', value: `\`${user.id}\``, inline: true },
      { name: '🔢 Unidades', value: String(totalQty), inline: true },
      { name: '📦 Productos', value: productLines || '—', inline: false },
      { name: '💰 Subtotal', value: `$${Number(subtotal).toFixed(2)} ${currency}`, inline: true },
    ],
    footer: { text: 'SP4CE Store • Pedido recibido' },
    timestamp: new Date().toISOString()
  };

  if (couponCode && discountPercent > 0) {
    const saved = subtotal * (discountPercent / 100);
    embed.fields.push(
      { name: '🎫 Cupón', value: `\`${couponCode}\` (−${discountPercent}%)`, inline: true },
      { name: '🏷️ Ahorro', value: `−$${saved.toFixed(2)}`, inline: true }
    );
  } else {
    embed.fields.push({ name: '🎫 Cupón', value: 'No usado', inline: true });
  }

  embed.fields.push({
    name: '💵 Total pagado',
    value: `**$${Number(total).toFixed(2)} ${currency}**`,
    inline: false
  });

  const mainImage = items[0]?.image;
  if (mainImage) embed.image = { url: mainImage };

  await axios.post(PURCHASE_WEBHOOK_URL, { embeds: [embed] });
};

app.post('/api/purchase', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Inicia sesión para comprar' });

  const { items, couponCode, discountPercent, subtotal, total, currency } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }

  try {
    await sendPurchaseWebhook({
      user: req.session.user,
      items,
      couponCode: couponCode || null,
      discountPercent: Number(discountPercent) || 0,
      subtotal: Number(subtotal) || 0,
      total: Number(total) || 0,
      currency: currency || settings.currency || 'USD'
    });

    const newNotification = {
      id: Date.now(),
      user: req.session.user,
      items,
      couponCode: couponCode || null,
      discountPercent: Number(discountPercent) || 0,
      subtotal: Number(subtotal) || 0,
      total: Number(total) || 0,
      currency: currency || settings.currency || 'USD',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    notifications.unshift(newNotification);
    saveData(NOTIFICATIONS_FILE, notifications);

    res.json({ success: true });

  } catch (e) {
    console.error('[PURCHASE] Webhook error:', e.response?.data || e.message);
    res.status(500).json({ error: 'No se pudo registrar la compra' });
  }
});

// --- ROUTES ---
app.get('/api/me', (req, res) => {
  if (req.session.user) {
    const userId = String(req.session.user.id);
    const isUserAdmin = ADMIN_IDS.map(id => String(id)).includes(userId);
    res.json({ user: req.session.user, isAdmin: isUserAdmin });
  } else res.status(401).end();
});

// AUTH
app.get('/auth/discord', (req, res) => {
  res.redirect(`https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`);
});
app.get('/auth/discord/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const t = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: process.env.DISCORD_REDIRECT_URI }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const u = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${t.data.access_token}` } });
    req.session.user = u.data; updateTeamList(u.data); res.redirect('/');
  } catch (e) { res.redirect('/?error=auth'); }
});
app.get('/api/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

// CRUD & REVIEWS
app.post('/api/products', isAdmin, (req, res) => { const p = { id: Date.now(), ...req.body }; products.push(p); saveData(DATA_FILE, products); res.status(201).json(p); });
app.put('/api/products/:id', isAdmin, (req, res) => {
  const idx = products.findIndex(p => String(p.id) === req.params.id);
  if (idx !== -1) {
    products[idx] = { ...products[idx], ...req.body };
    saveData(DATA_FILE, products);
    res.json(products[idx]);
  } else res.status(404).json({ error: 'Not found' });
});
app.delete('/api/products/:id', isAdmin, (req, res) => {
  products = products.filter(p => String(p.id) !== req.params.id);
  saveData(DATA_FILE, products);
  res.json({ success: true });
});

app.post('/api/coupons', isAdmin, (req, res) => { const c = { id: Date.now(), ...req.body }; coupons.push(c); saveData(COUPONS_FILE, coupons); res.status(201).json(c); });
app.delete('/api/coupons/:id', isAdmin, (req, res) => {
  coupons = coupons.filter(c => String(c.id) !== req.params.id);
  saveData(COUPONS_FILE, coupons);
  res.json({ success: true });
});

app.get('/api/notifications', isAdmin, (req, res) => {
  res.json(notifications);
});
app.post('/api/notifications/:id/confirm', isAdmin, (req, res) => {
  const notifId = Number(req.params.id);
  const notif = notifications.find(n => n.id === notifId);
  if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
  if (notif.status === 'confirmed') return res.status(400).json({ error: 'La compra ya fue confirmada' });

  notif.status = 'confirmed';
  notif.confirmedAt = new Date().toISOString();
  saveData(NOTIFICATIONS_FILE, notifications);

  if (Array.isArray(notif.items)) {
    notif.items.forEach(item => {
      const prod = products.find(p => String(p.id) === String(item.id));
      if (prod) {
        const currentStock = Number(prod.stock) || 0;
        const qty = Number(item.qty) || 0;
        const newStock = Math.max(0, currentStock - qty);
        prod.stock = typeof prod.stock === 'string' ? String(newStock) : newStock;
      }
    });
    saveData(DATA_FILE, products);
  }

  res.json({ success: true, notification: notif, products });
});
app.delete('/api/notifications/:id', isAdmin, (req, res) => {
  const notifId = Number(req.params.id);
  notifications = notifications.filter(n => n.id !== notifId);
  saveData(NOTIFICATIONS_FILE, notifications);
  res.json({ success: true });
});

app.get('/api/reviews/:id', (req, res) => { const t = reviews.find(x => x.targetId === req.params.id); res.json(t ? t.reviews : []); });
app.post('/api/reviews/:id', (req, res) => { if (!req.session.user) return res.status(401).end(); const r = { id: Date.now(), userId: String(req.session.user.id), username: req.session.user.username, avatar: req.session.user.avatar, rating: parseInt(req.body.rating) || 5, comment: xss(req.body.comment), date: new Date().toISOString() }; let t = reviews.find(x => x.targetId === req.params.id); if (!t) { t = { targetId: req.params.id, reviews: [] }; reviews.push(t); } t.reviews.unshift(r); saveData(REVIEWS_FILE, reviews); res.status(201).json(r); });


app.use(express.static(path.join(__dirname, 'dist')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[SP4CE] Running on port ${PORT}`);
    console.log(`[AUTH] Administrators Loaded: ${ADMIN_IDS.join(', ')}`);
  });
}

export default app;
