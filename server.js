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

// Importa la configuración de admins y webhook
import { ADMIN_IDS, PURCHASE_WEBHOOK_URL } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configuración de Supabase ---
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Middlewares ---
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

// Middleware para manejar la sesión desde cookies
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

// --- Funciones para Supabase ---
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

const deleteSupabaseData = async (table, id, idField = 'id') => {
  try {
    const { error } = await supabase.from(table).delete().eq(idField, id);
    if (error) throw error;
  } catch (e) {
    console.error(`[Supabase] Error al eliminar de ${table}:`, e.message);
  }
};

// --- Configuración de Discord ---
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
    console.error(`[Discord] Error al obtener usuario ${userId}:`, e.message);
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
    const data = {
      id: idStr,
      username: user.username,
      avatar: user.avatar,
      banner: user.banner
    };
    if (idx === -1) teamList.push(data);
    else teamList[idx] = data;

    await saveSupabaseData('team', teamList);
    console.log(`[TEAM] Perfil actualizado para Admin: ${user.username}`);
  }
};

const isAdmin = (req, res, next) => {
  const userId = req.session.user ? String(req.session.user.id) : null;
  if (userId && ADMIN_IDS.map(id => String(id)).includes(userId)) return next();
  res.status(403).json({ error: 'Acceso denegado: solo para administradores' });
};

// --- API ROUTES ---

// Team
app.get('/api/team', async (req, res) => {
  try {
    const finalTeam = [];
    const processedIds = new Set();
    const currentUserId = req.session.user ? String(req.session.user.id) : null;
    let teamList = await getSupabaseData('team', []);
    const adminIdsStr = ADMIN_IDS.map(id => String(id));

    // Agrega admins desde team.json
    if (Array.isArray(teamList)) {
      teamList.forEach(m => {
        const idStr = String(m.id);
        if (adminIdsStr.includes(idStr)) {
          finalTeam.push({ ...m, role: "Admin Principal" });
          processedIds.add(idStr);
        }
      });
    }

    // Agrega admins desde Discord si no están en teamList
    for (const idStr of adminIdsStr) {
      if (!processedIds.has(idStr)) {
        const botUser = await fetchUserFromBot(idStr);
        if (botUser) {
          finalTeam.push({
            id: idStr,
            username: botUser.username,
            avatar: botUser.avatar,
            banner: botUser.banner,
            role: "Admin Principal"
          });
        } else {
          finalTeam.push({
            id: idStr,
            username: `Admin (${idStr.slice(-4)})`,
            avatar: null,
            banner: null,
            role: "Admin Principal",
            isPlaceholder: true
          });
        }
        processedIds.add(idStr);
      }
    }

    // Obtiene los likes para cada admin
    const teamWithLikes = await Promise.all(finalTeam.map(async (m) => {
      const { data: stats } = await supabase
        .from('admin_stats')
        .select('likes')
        .eq('admin_id', m.id)
        .single();
      const likes = stats?.likes || [];
      return {
        ...m,
        likes: likes.length,
        hasLiked: currentUserId ? likes.some(id => String(id) === currentUserId) : false,
      };
    }));

    res.json(teamWithLikes);
  } catch (err) {
    console.error('[TEAM] Error:', err.message);
    res.status(500).json({ error: 'Error al obtener el equipo' });
  }
});

// Admin Stats (Likes)
app.post('/api/admin-stats/:id/like', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Inicia sesión para votar' });
  const adminId = String(req.params.id);
  const userId = String(req.session.user.id);

  const { data: stats, error } = await supabase
    .from('admin_stats')
    .select('likes')
    .eq('admin_id', adminId)
    .single();

  let likes = [];
  if (!error && stats) likes = stats.likes || [];

  const alreadyLiked = likes.some(id => String(id) === userId);
  if (alreadyLiked) {
    return res.status(400).json({
      error: 'Ya has apoyado a este administrador',
      likes: likes.length
    });
  }

  likes.push(userId);
  await supabase
    .from('admin_stats')
    .upsert({ admin_id: adminId, likes }, { onConflict: 'admin_id' });

  res.json({ likes: likes.length, hasLiked: true });
});

// Settings
app.get('/api/settings', async (req, res) => {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single();

  if (error || !data) {
    const defaultSettings = { id: '1', currency: 'USD' };
    await supabase.from('settings').insert(defaultSettings);
    res.json(defaultSettings);
  } else {
    res.json(data);
  }
});

app.post('/api/settings', isAdmin, async (req, res) => {
  const settings = { id: '1', ...req.body };
  await supabase
    .from('settings')
    .upsert(settings, { onConflict: 'id' });
  res.json(settings);
});

// Products
app.get('/api/products', async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .select('*');
  if (error) {
    console.error('[Products] Error:', error.message);
    return res.json([]);
  }
  res.json(data);
});

app.post('/api/products', isAdmin, async (req, res) => {
  const product = {
    id: Date.now(),
    ...req.body
  };
  const { error } = await supabase
    .from('products')
    .insert(product);
  if (error) {
    console.error('[Products] Error al crear:', error.message);
    return res.status(500).json({ error: 'No se pudo crear el producto' });
  }
  res.status(201).json(product);
});

app.put('/api/products/:id', isAdmin, async (req, res) => {
  const productId = req.params.id;
  const updatedProduct = {
    id: productId,
    ...req.body
  };
  const { error } = await supabase
    .from('products')
    .upsert(updatedProduct, { onConflict: 'id' });
  if (error) {
    console.error('[Products] Error al actualizar:', error.message);
    return res.status(500).json({ error: 'No se pudo actualizar el producto' });
  }
  res.json(updatedProduct);
});

app.delete('/api/products/:id', isAdmin, async (req, res) => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', req.params.id);
  if (error) {
    console.error('[Products] Error al eliminar:', error.message);
    return res.status(500).json({ error: 'No se pudo eliminar el producto' });
  }
  res.json({ success: true });
});

// Coupons
app.get('/api/coupons', async (req, res) => {
  const { data, error } = await supabase
    .from('coupons')
    .select('*');
  if (error) {
    console.error('[Coupons] Error:', error.message);
    return res.json([]);
  }
  res.json(data);
});

app.post('/api/coupons', isAdmin, async (req, res) => {
  const coupon = {
    id: Date.now(),
    ...req.body
  };
  const { error } = await supabase
    .from('coupons')
    .insert(coupon);
  if (error) {
    console.error('[Coupons] Error al crear:', error.message);
    return res.status(500).json({ error: 'No se pudo crear el cupón' });
  }
  res.status(201).json(coupon);
});

app.delete('/api/coupons/:id', isAdmin, async (req, res) => {
  const { error } = await supabase
    .from('coupons')
    .delete()
    .eq('id', req.params.id);
  if (error) {
    console.error('[Coupons] Error al eliminar:', error.message);
    return res.status(500).json({ error: 'No se pudo eliminar el cupón' });
  }
  res.json({ success: true });
});

// Notifications
app.get('/api/notifications', isAdmin, async (req, res) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*');
  if (error) {
    console.error('[Notifications] Error:', error.message);
    return res.json([]);
  }
  res.json(data);
});

app.post('/api/notifications/:id/confirm', isAdmin, async (req, res) => {
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

  // Actualiza el estado de la notificación
  const updatedNotif = {
    ...notif,
    status: 'confirmed',
    confirmedAt: new Date().toISOString()
  };
  await supabase
    .from('notifications')
    .upsert(updatedNotif, { onConflict: 'id' });

  // Actualiza el stock de los productos
  if (Array.isArray(notif.items)) {
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*');
    if (!prodError && products) {
      for (const item of notif.items) {
        const prod = products.find(p => String(p.id) === String(item.id));
        if (prod) {
          const currentStock = Number(prod.stock) || 0;
          const qty = Number(item.qty) || 0;
          const newStock = Math.max(0, currentStock - qty);
          await supabase
            .from('products')
            .upsert({ ...prod, stock: newStock }, { onConflict: 'id' });
        }
      }
    }
  }

  res.json({ success: true, notification: updatedNotif });
});

app.delete('/api/notifications/:id', isAdmin, async (req, res) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', req.params.id);
  if (error) {
    console.error('[Notifications] Error al eliminar:', error.message);
    return res.status(500).json({ error: 'No se pudo eliminar la notificación' });
  }
  res.json({ success: true });
});

// Reviews
app.get('/api/reviews/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('target_id', req.params.id);
  if (error) {
    console.error('[Reviews] Error:', error.message);
    return res.json([]);
  }
  res.json(data || []);
});

app.post('/api/reviews/:id', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Inicia sesión para dejar una reseña' });
  }

  const review = {
    id: Date.now(),
    target_id: req.params.id,
    userId: String(req.session.user.id),
    username: req.session.user.username,
    avatar: req.session.user.avatar,
    rating: parseInt(req.body.rating) || 5,
    comment: xss(req.body.comment),
    date: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('reviews')
    .insert(review);
  if (error) {
    console.error('[Reviews] Error al crear:', error.message);
    return res.status(500).json({ error: 'No se pudo crear la reseña' });
  }
  res.status(201).json(review);
});

// Purchase Webhook
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
    timestamp: new Date().toISOString(),
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
    inline: false,
  });

  const mainImage = items[0]?.image;
  if (mainImage) embed.image = { url: mainImage };

  try {
    await axios.post(PURCHASE_WEBHOOK_URL, { embeds: [embed] });
  } catch (e) {
    console.error('[PURCHASE] Error al enviar webhook:', e.message);
  }
};

app.post('/api/purchase', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Inicia sesión para comprar' });
  }

  const { items, couponCode, discountPercent, subtotal, total, currency } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El carrito está vacío' });
  }

  try {
    const settings = await getSupabaseData('settings', { currency: 'USD' });
    await sendPurchaseWebhook({
      user: req.session.user,
      items,
      couponCode: couponCode || null,
      discountPercent: Number(discountPercent) || 0,
      subtotal: Number(subtotal) || 0,
      total: Number(total) || 0,
      currency: currency || settings.currency || 'USD',
    });

    const newNotification = {
      id: Date.now(),
      user_data: req.session.user,  // ✅ Usamos user_data en lugar de user
      items,
      couponCode: couponCode || null,
      discountPercent: Number(discountPercent) || 0,
      subtotal: Number(subtotal) || 0,
      total: Number(total) || 0,
      currency: currency || settings.currency || 'USD',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('notifications')
      .insert(newNotification);
    if (error) {
      console.error('[PURCHASE] Error al guardar notificación:', error.message);
      return res.status(500).json({ error: 'No se pudo registrar la compra' });
    }

    res.json({ success: true });
  } catch (e) {
    console.error('[PURCHASE] Error:', e.message);
    res.status(500).json({ error: 'No se pudo registrar la compra' });
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
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 días
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    res.redirect('/');
  } catch (e) {
    console.error('[AUTH] Error en callback:', e.message);
    res.redirect('/?error=auth');
  }
});

app.get('/api/logout', (req, res) => {
  res.clearCookie('sp4ce_user');
  res.redirect('/');
});

// --- Manejo de rutas estáticas (para Vite) ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// --- Inicia el servidor ---
app.listen(PORT, () => {
  console.log(`[SP4CE] 🚀 Servidor corriendo en el puerto ${PORT}`);
  console.log(`[ADMINS] IDs de administradores: ${ADMIN_IDS.join(', ')}`);
  console.log(`[SUPABASE] Conectado a: ${supabaseUrl}`);
});

export default app;
