import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingBag, LogOut, LayoutDashboard, X, Plus, Trash2, Edit2, Tag, 
  ShieldCheck, Zap, Heart, MessageSquare, ChevronDown, Star, Users,
  Mail, Globe, MessageCircle, ExternalLink, ArrowRight, ShoppingCart, ThumbsUp, Send, CheckCircle
} from 'lucide-react';
import axios from 'axios';

// --- SHARED COMPONENTS ---
const Navbar = ({ user, isAdmin, cartCount, onOpenCart }) => {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`glass ${scrolled ? 'nav-scrolled' : ''}`} style={{ 
      position: 'fixed', top: scrolled ? 10 : 20, left: '50%', transform: 'translateX(-50%)', 
      width: '95%', maxWidth: '1200px', zIndex: 1000, padding: '12px 25px', 
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      transition: 'all 0.4s ease'
    }}>
      <Link to="/" style={{ fontSize: '1.6rem', fontWeight: 900, textDecoration: 'none', color: 'white' }}>SP4<span style={{ color: 'var(--primary)' }}>CE</span></Link>
      
      <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
        <Link to="/" style={{ color: pathname === '/' ? 'var(--primary)' : 'white', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>Inicio</Link>
        <Link to="/productos" style={{ color: pathname === '/productos' ? 'var(--primary)' : 'white', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>Tienda</Link>
        {isAdmin && <Link to="/admin" style={{ color: pathname === '/admin' ? 'var(--primary)' : 'white', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}>Admin</Link>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        {user && (
          <button onClick={onOpenCart} style={{ background: 'none', border: 'none', color: 'white', position: 'relative', cursor: 'pointer', padding: '5px' }}>
            <ShoppingBag size={22} />
            {cartCount > 0 && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ position: 'absolute', top: -5, right: -5, background: 'var(--primary)', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>{cartCount}</motion.span>
            )}
          </button>
        )}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{user.username}</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--primary)', opacity: 0.8 }}>ID: {user.id}</div>
            </div>
            <img src={user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} 
                 style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--primary)' }} />
            <a href="/api/logout" style={{ color: 'var(--text-gray)', opacity: 0.8 }}><LogOut size={18} /></a>
          </div>
        ) : (
          <a href="/auth/discord" className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.8rem' }}>Iniciar Sesión</a>
        )}
      </div>
    </nav>
  );
};

// --- INTERACTIVE COMPONENTS ---
const StarRating = ({ rating, setRating, readOnly = false }) => (
  <div style={{ display: 'flex', gap: '5px' }}>
    {[1, 2, 3, 4, 5].map(star => (
      <Star 
        key={star} 
        size={readOnly ? 14 : 20} 
        fill={star <= rating ? 'var(--primary)' : 'none'} 
        color={star <= rating ? 'var(--primary)' : 'var(--text-gray)'}
        onClick={() => !readOnly && setRating(star)}
        style={{ cursor: readOnly ? 'default' : 'pointer', transition: '0.2s' }}
      />
    ))}
  </div>
);

const ReviewSection = ({ targetId, user }) => {
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchReviews(); }, [targetId]);
  const fetchReviews = async () => { try { const res = await axios.get(`/api/reviews/${targetId}`); setReviews(res.data); } catch (e) {} };

  const submitReview = async () => {
    if (!user) return alert("Inicia sesión para valorar");
    if (!comment.trim()) return alert("El comentario no puede estar vacío");
    setIsSubmitting(true);
    try {
      const res = await axios.post(`/api/reviews/${targetId}`, { rating, comment });
      setReviews([res.data, ...reviews]);
      setComment('');
    } catch (e) { alert("Error al enviar reseña"); }
    setIsSubmitting(false);
  };

  return (
    <div style={{ marginTop: '25px' }}>
      <h4 style={{ fontWeight: 900, marginBottom: '20px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <MessageSquare size={18} color="var(--primary)"/> OPINIONES ({reviews.length})
      </h4>
      
      {user ? (
        <div style={{ marginBottom: '25px', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <StarRating rating={rating} setRating={setRating} />
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <input value={comment} onChange={e => setComment(e.target.value)} placeholder="¿Qué opinas de esto?" className="form-input" style={{ background: 'rgba(0,0,0,0.3)' }} />
            <button onClick={submitReview} disabled={isSubmitting} className="btn-primary" style={{ padding: '0 20px' }}>
              <Send size={18}/>
            </button>
          </div>
        </div>
      ) : (
        <p style={{ marginBottom: '20px', padding: '15px', background: 'rgba(255,51,51,0.08)', borderRadius: '10px', border: '1px solid rgba(255,51,51,0.2)', color: 'var(--text-gray)', fontSize: '0.9rem', textAlign: 'center' }}>
          <a href="/auth/discord" style={{ color: 'var(--primary)', fontWeight: 800, textDecoration: 'none' }}>Inicia sesión</a> para dejar una opinión.
        </p>
      )}

      <div style={{ display: 'grid', gap: '12px', maxHeight: '300px', overflowY: 'auto', paddingRight: '10px' }}>
        {reviews.length > 0 ? reviews.map(r => (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={r.id} style={{ padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={r.avatar ? `https://cdn.discordapp.com/avatars/${r.userId}/${r.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{r.username}</span>
              </div>
              <StarRating rating={r.rating} readOnly />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', lineHeight: 1.5 }}>{r.comment}</p>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', marginTop: '8px' }}>{new Date(r.date).toLocaleDateString()}</div>
          </motion.div>
        )) : (
          <p style={{ textAlign: 'center', color: 'var(--text-gray)', fontSize: '0.9rem' }}>Aún no hay reseñas. ¡Sé el primero!</p>
        )}
      </div>
    </div>
  );
};

// --- TEAM COMPONENTS ---
const TeamCard = ({ member, user, onLike }) => {
  const [showReviews, setShowReviews] = useState(false);
  const bannerUrl = member.banner ? `https://cdn.discordapp.com/banners/${member.id}/${member.banner}.webp?size=1024` : null;
  const avatarUrl = member.avatar ? `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`;

  // Use the hasLiked property provided by the server
  const hasLiked = member.hasLiked;

  return (
    <motion.div whileHover={{ y: -10 }} layout className="glass" style={{ width: '100%', maxWidth: '360px', overflow: 'hidden' }}>
      <div style={{ height: '130px', background: bannerUrl ? `url(${bannerUrl})` : 'linear-gradient(135deg, #111, #ff333322)', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, rgba(8,8,8,0.8))' }}/>
      </div>
      <div style={{ padding: '0 30px 40px', textAlign: 'center', marginTop: '-50px', position: 'relative' }}>
        <motion.img 
          initial={{ scale: 0.8 }} animate={{ scale: 1 }}
          src={avatarUrl} style={{ width: '100px', height: '100px', borderRadius: '50%', border: '5px solid var(--bg-black)', marginBottom: '15px', boxShadow: '0 5px 20px rgba(0,0,0,0.5)' }} 
        />
        <h3 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '5px' }}>{member.username}</h3>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '25px' }}>
          <ShieldCheck size={14} color="var(--primary)" />
          <span style={{ color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '2px' }}>{member.role}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '30px' }}>
          {user ? (
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => onLike(member.id)} 
              className="btn-outline" 
              style={{ 
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderRadius: '30px',
                borderColor: hasLiked ? 'var(--primary)' : 'var(--glass-border)',
                background: hasLiked ? 'rgba(255, 51, 51, 0.1)' : 'transparent'
              }}
            >
              <ThumbsUp size={18} fill={hasLiked ? 'var(--primary)' : 'none'} color={hasLiked ? 'var(--primary)' : 'white'}/> {member.likes}
            </motion.button>
          ) : (
            <a href="/auth/discord" className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderRadius: '30px', textDecoration: 'none', opacity: 0.6 }}>
              <ThumbsUp size={18}/> {member.likes}
            </a>
          )}
          <button onClick={() => setShowReviews(!showReviews)} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderRadius: '30px' }}>
            <MessageSquare size={18}/> {showReviews ? 'Cerrar' : 'Reseñas'}
          </button>
        </div>

        <AnimatePresence>
          {showReviews && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ textAlign: 'left' }}>
              <ReviewSection targetId={`admin_${member.id}`} user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// --- PRODUCT COMPONENTS ---
const ProductCard = ({ p, onAddToCart, onOpenDetails, user, currency = 'USD' }) => (
  <motion.div whileHover={{ scale: 1.02 }} className="glass" style={{ padding: '20px' }}>
    <div style={{ width: '100%', height: '180px', borderRadius: '15px', overflow: 'hidden', marginBottom: '20px', cursor: 'pointer', background: 'rgba(0,0,0,0.2)' }} onClick={onOpenDetails}>
      <img src={p.image} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '10px' }} />
    </div>
    <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '15px' }}>{p.name}</h3>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>${Number(p.price || 0).toFixed(2)} <span style={{fontSize: '0.7rem', opacity: 0.6}}>{currency}</span></span>
      <button onClick={onOpenDetails} style={{ background: 'none', border: 'none', color: 'var(--text-gray)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Ver más</button>
    </div>
    {user ? (
      <button 
        onClick={() => onAddToCart(p)} 
        disabled={p.stock <= 0} 
        className="btn-primary" 
        style={{ width: '100%', padding: '15px' }}
      >
        {p.stock > 0 ? <><ShoppingCart size={20}/> AÑADIR AL CARRITO</> : 'AGOTADO'}
      </button>
    ) : (
      <a href="/auth/discord" className="btn-primary" style={{ width: '100%', padding: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}>
        INICIAR SESIÓN PARA COMPRAR
      </a>
    )}
  </motion.div>
);

const ProductModal = ({ product, user, currency = 'USD', onClose, onAddToCart }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
    style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 3000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
    <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }} className="glass" 
      style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: '40px', position: 'relative' }}>
      <X onClick={onClose} style={{ position: 'absolute', top: 25, right: 25, cursor: 'pointer', color: 'var(--text-gray)' }} size={24} />
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '40px' }}>
        <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '15px', overflow: 'hidden', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={product.image} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '20px' }} />
        </div>
        <div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '15px' }}>{product.name}</h2>
          <p style={{ color: 'var(--text-gray)', lineHeight: 1.8, fontSize: '1.05rem', marginBottom: '25px' }}>{product.description}</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)' }}>${Number(product.price || 0).toFixed(2)} <span style={{fontSize: '0.9rem', opacity: 0.5}}>{currency}</span></span>
            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '5px 15px', borderRadius: '20px', fontSize: '0.9rem' }}>Stock: {product.stock}</span>
          </div>
          {user ? (
            <button 
              onClick={() => { onAddToCart(product); onClose(); }} 
              disabled={product.stock <= 0} 
              className="btn-primary" 
              style={{ width: '100%', padding: '20px', fontSize: '1.2rem' }}
            >
              <ShoppingCart size={24}/> {product.stock > 0 ? 'AÑADIR AL CARRITO' : 'AGOTADO'}
            </button>
          ) : (
            <a href="/auth/discord" className="btn-primary" style={{ width: '100%', padding: '20px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textDecoration: 'none' }}>
              INICIAR SESIÓN PARA COMPRAR
            </a>
          )}
          <ReviewSection targetId={`prod_${product.id}`} user={user} />
        </div>
      </div>
    </motion.div>
  </motion.div>
);

// --- MAIN APPLICATION ---
export default function App() {
  const [products, setProducts] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [team, setTeam] = useState([]);
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [isTeamLoading, setIsTeamLoading] = useState(true);
  const [cartReady, setCartReady] = useState(false);

  useEffect(() => { fetchSession(); fetchData(); }, []);

  useEffect(() => {
    if (!user) {
      setCart([]);
      setIsCartOpen(false);
      setCartReady(false);
      localStorage.removeItem('sp4ce_cart_v9');
      return;
    }
    try {
      const saved = localStorage.getItem(`sp4ce_cart_${user.id}`);
      setCart(saved ? JSON.parse(saved) : []);
    } catch {
      setCart([]);
    }
    setCartReady(true);
  }, [user?.id]);

  useEffect(() => {
    if (!user || !cartReady) return;
    localStorage.setItem(`sp4ce_cart_${user.id}`, JSON.stringify(cart));
  }, [cart, user, cartReady]);

  const fetchSession = async () => {
    try {
      const res = await axios.get(`/api/me?t=${Date.now()}`);
      setUser(res.data.user);
      setIsAdmin(res.data.isAdmin);
      console.log(`[AUTH] Logged in as: ${res.data.user?.username} (${res.data.user?.id}) - isAdmin: ${res.data.isAdmin}`);
    } catch (e) { 
      setUser(null); 
      setIsAdmin(false);
      setCart([]);
      setIsCartOpen(false);
    }
  };

  // Security Watchdog: Redirect if admin status is lost
  useEffect(() => {
    const checkPath = () => {
      if (window.location.pathname === '/admin' && !isAdmin && user) {
        window.location.href = '/';
      }
    };
    checkPath();
  }, [isAdmin, user]);

  const fetchData = async () => {
    const t = Date.now();
    // Fetch Products
    try {
      const pRes = await axios.get(`/api/products?t=${t}`);
      setProducts(pRes.data);
    } catch (e) { console.error("Error loading products"); }

    // Fetch Coupons
    try {
      const cRes = await axios.get(`/api/coupons?t=${t}`);
      setCoupons(cRes.data);
    } catch (e) { console.error("Error loading coupons"); }

    // Fetch Settings
    try {
      const sRes = await axios.get(`/api/settings?t=${t}`);
      setCurrency(sRes.data.currency || 'USD');
    } catch (e) {}

    // Fetch Team
    setIsTeamLoading(true);
    try {
      const tRes = await axios.get(`/api/team?t=${t}`);
      setTeam(tRes.data);
    } catch (e) { console.error("Error loading team"); }
    setIsTeamLoading(false);
  };

  const completePurchase = async (items, { couponCode = '', discountPercent = 0 } = {}) => {
    if (!user) { alert("Inicia sesión para comprar"); window.location.href = "/auth/discord"; return false; }
    const subtotal = items.reduce((s, i) => s + (Number(i.price || 0) * i.qty), 0);
    const total = subtotal * (1 - discountPercent / 100);
    try {
      await axios.post('/api/purchase', {
        items: items.map(({ id, name, price, qty, image, description }) => ({ id, name, price, qty, image, description })),
        couponCode: couponCode || null,
        discountPercent,
        subtotal,
        total,
        currency
      });
      alert('¡Compra enviada! Un administrador recibirá tu pedido y te contactará pronto.');
      return true;
    } catch (e) {
      alert(e.response?.data?.error || 'Error al procesar la compra');
      return false;
    }
  };

  const onAddToCart = (p) => {
    if (!user) { alert("Inicia sesión para añadir al carrito"); window.location.href = "/auth/discord"; return; }
    const existing = cart.find(i => i.id === p.id);
    if (existing) {
      if (existing.qty < Number(p.stock)) {
        setCart(cart.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      } else {
        alert(`Lo sentimos, solo quedan ${p.stock} unidades en stock.`);
      }
    } else {
      if (Number(p.stock) > 0) {
        setCart([...cart, { ...p, qty: 1 }]);
      } else {
        alert("Este producto está agotado");
      }
    }
    setIsCartOpen(true);
  };

  return (
    <Router>
      <div className="bg-animated"></div>
      <div className="gif-overlay"></div>
      <Navbar user={user} isAdmin={isAdmin} cartCount={user ? cart.reduce((s,i) => s+i.qty, 0) : 0} onOpenCart={() => user && setIsCartOpen(true)} />
      
      <main style={{ minHeight: '90vh' }}>
        <Routes>
          <Route path="/" element={
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {/* HERO */}
              <section style={{ paddingTop: '220px', paddingBottom: '100px', textAlign: 'center' }}>
                <div className="container">
                  <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 900, letterSpacing: '6px', fontSize: '1rem', textTransform: 'uppercase' }}>Elite Gaming Marketplace</span>
                    <h1 style={{ fontSize: 'clamp(3rem, 10vw, 6rem)', fontWeight: 900, lineHeight: 1, margin: '25px 0 30px' }}>SP4<span style={{ color: 'var(--primary)' }}>CE</span> STORE</h1>
                    <p style={{ fontSize: '1.25rem', color: 'var(--text-gray)', maxWidth: '750px', margin: '0 auto 50px' }}>Activos digitales exclusivos, seguridad garantizada y entrega inmediata. Liderando la industria desde 2024.</p>
                    <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
                      <a href="#catalogo" className="btn-primary" style={{ padding: '18px 40px' }}>VER CATÁLOGO <ArrowRight size={20}/></a>
                      <a href="#team" className="btn-outline" style={{ padding: '18px 40px' }}>NUESTRO EQUIPO</a>
                    </div>
                  </motion.div>
                </div>
              </section>

              {/* STATS */}
              <section className="container" style={{ marginBottom: '150px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px' }}>
                  <div className="glass" style={{ padding: '40px', textAlign: 'center' }}>
                    <ShieldCheck size={45} color="var(--primary)" style={{ marginBottom: '20px' }} />
                    <h3 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '12px' }}>Seguridad de Élite</h3>
                    <p style={{ color: 'var(--text-gray)', lineHeight: 1.6 }}>Protección total en cada transacción con encriptación avanzada.</p>
                  </div>
                  <div className="glass" style={{ padding: '40px', textAlign: 'center' }}>
                    <Zap size={45} color="var(--primary)" style={{ marginBottom: '20px' }} />
                    <h3 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '12px' }}>Entrega Instantánea</h3>
                    <p style={{ color: 'var(--text-gray)', lineHeight: 1.6 }}>Recibe tus productos segundos después del pago, sin esperas.</p>
                  </div>
                  <div className="glass" style={{ padding: '40px', textAlign: 'center' }}>
                    <Heart size={45} color="var(--primary)" style={{ marginBottom: '20px' }} />
                    <h3 style={{ fontSize: '1.6rem', fontWeight: 900, marginBottom: '12px' }}>Soporte 24/7</h3>
                    <p style={{ color: 'var(--text-gray)', lineHeight: 1.6 }}>Un equipo de expertos siempre listo para resolver tus dudas.</p>
                  </div>
                </div>
              </section>

              {/* CATALOG FIRST */}
              <section id="catalogo" style={{ marginBottom: '150px' }}>
                <div className="container">
                  <div className="section-header">
                    <h2>Catálogo <span style={{ color: 'var(--primary)' }}>Digital</span></h2>
                    <p>Los mejores activos al mejor precio del mercado.</p>
                    <div className="underline"></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' }}>
                    {products.length > 0 ? products.map(p => (
                      <ProductCard key={p.id} p={p} user={user} currency={currency} onAddToCart={onAddToCart} onOpenDetails={() => setSelectedProduct(p)} />
                    )) : (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '50px', color: 'var(--text-gray)' }}>Aún no hay productos disponibles.</div>
                    )}
                  </div>
                </div>
              </section>

              {/* TEAM BELOW CATALOG */}
              <section id="team" style={{ marginBottom: '150px' }}>
                <div className="container">
                  <div className="section-header">
                    <h2>Equipo <span style={{ color: 'var(--primary)' }}>Profesional</span></h2>
                    <p>Conoce a los administradores detrás de SP4CE.</p>
                    <div className="underline"></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '35px', flexWrap: 'wrap' }}>
                    {isTeamLoading ? (
                      <motion.p animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ color: 'var(--primary)', fontWeight: 900 }}>CARGANDO EQUIPO...</motion.p>
                    ) : team.length > 0 ? team.map(m => (
                      <TeamCard key={m.id} member={m} user={user} onLike={async (id) => { 
                        if(!user) { alert("Inicia sesión para apoyar"); window.location.href = "/auth/discord"; return; }
                        try {
                          await axios.post(`/api/admin-stats/${id}/like`); 
                          fetchData(); 
                        } catch (e) {
                          if (e.response && e.response.data && e.response.data.error) {
                            alert(e.response.data.error);
                          } else {
                            alert("Ya has apoyado a este administrador");
                          }
                          fetchData();
                        }
                      }} />
                    )) : (
                      <p style={{ color: 'var(--text-gray)' }}>No hay administradores registrados.</p>
                    )}
                  </div>
                </div>
              </section>
            </motion.div>
          } />
          
          <Route path="/productos" element={
            <div className="container" style={{ paddingTop: '180px', marginBottom: '100px' }}>
              <div className="section-header"><h2>Catálogo <span style={{ color: 'var(--primary)' }}>Premium</span></h2><div className="underline"></div></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '30px' }}>
                {products.map(p => <ProductCard key={p.id} p={p} user={user} currency={currency} onAddToCart={onAddToCart} onOpenDetails={() => setSelectedProduct(p)} />)}
              </div>
            </div>
          } />

          <Route path="/admin" element={isAdmin ? <AdminPanel products={products} coupons={coupons} currency={currency} onRefresh={fetchData} /> : <div style={{ paddingTop: '200px', textAlign: 'center' }}><h2>Acceso Denegado</h2><Link to="/" className="btn-primary" style={{ display: 'inline-block', marginTop: '20px', padding: '10px 30px' }}>Volver al Inicio</Link></div>} />
        </Routes>
      </main>

      <Footer />

      <AnimatePresence>
        {user && isCartOpen && <CartDrawer cart={cart} setCart={setCart} coupons={coupons} currency={currency} onPurchase={completePurchase} onClose={() => setIsCartOpen(false)} />}
        {selectedProduct && <ProductModal product={selectedProduct} user={user} currency={currency} onClose={() => setSelectedProduct(null)} onAddToCart={onAddToCart} />}
      </AnimatePresence>
    </Router>
  );
}

// --- FULL CART DRAWER ---
const CartDrawer = ({ cart, setCart, coupons, currency = 'USD', onPurchase, onClose }) => {
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isPaying, setIsPaying] = useState(false);

  const subtotal = cart.reduce((s, i) => s + (Number(i.price || 0) * i.qty), 0);
  const total = subtotal * (1 - discount / 100);

  const applyCoupon = () => {
    const c = coupons.find(x => x.code === couponCode.toUpperCase());
    if (c) { setDiscount(c.discount); alert(`¡Cupón aplicado! Descuento: ${c.discount}%`); }
    else { alert("Cupón inválido"); setDiscount(0); }
  };

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }} 
      style={{ position: 'fixed', top: 0, right: 0, width: 'min(450px, 100%)', height: '100%', zIndex: 4000, padding: '40px', display: 'flex', flexDirection: 'column' }} className="glass">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h2 style={{ fontWeight: 900, fontSize: '1.8rem' }}>CARRITO</h2>
        <X onClick={onClose} style={{ cursor: 'pointer', opacity: 0.6 }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '30px', paddingRight: '10px' }}>
        {cart.length > 0 ? cart.map(item => (
          <div key={item.id} style={{ display: 'flex', gap: '15px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <img src={item.image} style={{ width: '70px', height: '70px', borderRadius: '10px', objectFit: 'cover' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, marginBottom: '5px' }}>{item.name}</div>
              <div style={{ color: 'var(--primary)', fontWeight: 900 }}>${(Number(item.price || 0) * item.qty).toFixed(2)}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.3)', padding: '5px 12px', borderRadius: '20px' }}>
                  <button onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, qty: Math.max(0, i.qty-1)} : i).filter(i => i.qty > 0))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>-</button>
                  <span style={{ fontWeight: 900, fontSize: '0.9rem' }}>{item.qty}</span>
                  <button onClick={() => {
                    if (item.qty < Number(item.stock)) {
                      setCart(cart.map(i => i.id === item.id ? {...i, qty: i.qty + 1} : i));
                    } else {
                      alert(`Solo hay ${item.stock} unidades disponibles.`);
                    }
                  }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>+</button>
                </div>
                <Trash2 size={16} color="var(--text-gray)" style={{ cursor: 'pointer' }} onClick={() => setCart(cart.filter(i => i.id !== item.id))} />
              </div>
            </div>
          </div>
        )) : (
          <div style={{ textAlign: 'center', marginTop: '50px', color: 'var(--text-gray)' }}>Tu carrito está vacío.</div>
        )}
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '30px' }}>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
          <input value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="¿Tienes un cupón?" className="form-input" style={{ flex: 1 }} />
          <button onClick={applyCoupon} className="btn-primary" style={{ padding: '0 20px' }}>APLICAR</button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-gray)' }}><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
          {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)' }}><span>Descuento ({discount}%)</span><span>-${(subtotal * discount / 100).toFixed(2)}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.8rem', fontWeight: 900, marginTop: '10px' }}>
            <span>TOTAL</span>
            <span>${total.toFixed(2)} <span style={{fontSize: '0.9rem', opacity: 0.5}}>{currency}</span></span>
          </div>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-gray)', marginBottom: '15px', lineHeight: 1.5, textAlign: 'center' }}>
          Al confirmar, se notificará al administrador con los detalles de tu pedido.
        </p>
        <button
          disabled={cart.length === 0 || isPaying}
          onClick={async () => {
            const confirmed = confirm(
              '¿Confirmar compra?\n\nSe enviará un mensaje al administrador con tu pedido, productos, cantidades y cupón (si aplica). Un admin te contactará para completar el pago.'
            );
            if (!confirmed) return;
            setIsPaying(true);
            const ok = await onPurchase(cart, { couponCode: discount > 0 ? couponCode.toUpperCase() : '', discountPercent: discount });
            if (ok) { setCart([]); onClose(); }
            setIsPaying(false);
          }}
          className="btn-primary"
          style={{ width: '100%', padding: '20px', fontSize: '1.2rem', opacity: cart.length === 0 ? 0.5 : 1 }}
        >
          {isPaying ? 'ENVIANDO...' : 'COMPRAR'}
        </button>
      </div>
    </motion.div>
  );
};

// --- FULL ADMIN PANEL ---
const AdminPanel = ({ products, coupons, currency, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('products');
  const [form, setForm] = useState({ name: '', price: '', stock: '', image: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`/api/notifications?t=${Date.now()}`);
      setNotifications(res.data);
    } catch (e) {}
  };

  const handleRefreshAll = () => {
    onRefresh();
    fetchNotifications();
  };

  const saveProduct = async () => {
    if (!form.name || !form.price) return alert("Nombre y Precio son obligatorios");
    try {
      if (editingId) await axios.put(`/api/products/${editingId}`, form);
      else await axios.post('/api/products', form);
      handleRefreshAll();
      setEditingId(null);
      setForm({ name: '', price: '', stock: '', image: '', description: '' });
      alert("Guardado correctamente");
    } catch (e) { alert("Error al guardar"); }
  };

  return (
    <div className="container" style={{ paddingTop: '180px', paddingBottom: '120px' }}>
      <div className="glass" style={{ padding: '40px' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '40px' }}>PANEL DE <span style={{ color: 'var(--primary)' }}>ADMINISTRACIÓN</span></h2>
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('products')} className={activeTab === 'products' ? 'btn-primary' : 'btn-outline'} style={{ padding: '12px 30px' }}>PRODUCTOS</button>
          <button onClick={() => setActiveTab('coupons')} className={activeTab === 'coupons' ? 'btn-primary' : 'btn-outline'} style={{ padding: '12px 30px' }}>CUPONES</button>
          <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'btn-primary' : 'btn-outline'} style={{ padding: '12px 30px' }}>AJUSTES</button>
          <button onClick={() => setActiveTab('notifications')} className={activeTab === 'notifications' ? 'btn-primary' : 'btn-outline'} style={{ padding: '12px 30px', position: 'relative' }}>
            NOTIFICACIONES
            {notifications.filter(n => n.status === 'pending').length > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--primary)', color: 'white', borderRadius: '50%', width: '22px', height: '22px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, boxShadow: '0 0 10px var(--primary)' }}>
                {notifications.filter(n => n.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'settings' && (
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '30px', borderRadius: '15px' }}>
            <h3 style={{ marginBottom: '20px', fontWeight: 800 }}>Configuración de la Tienda</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <label style={{ fontWeight: 600 }}>Moneda de Pago:</label>
              <select 
                value={currency} 
                onChange={async (e) => {
                  const newC = e.target.value;
                  await axios.post('/api/settings', { currency: newC });
                  handleRefreshAll();
                  alert(`Moneda cambiada a ${newC}`);
                }}
                className="form-input"
                style={{ width: '150px', background: 'rgba(0,0,0,0.5)', color: 'white' }}
              >
                <option value="USD">USD (Dólares)</option>
                <option value="MXN">MXN (Pesos)</option>
              </select>
            </div>
            <p style={{ marginTop: '15px', color: 'var(--text-gray)', fontSize: '0.85rem' }}>Este ajuste cambiará la moneda mostrada en toda la tienda.</p>
          </div>
        )}

        {activeTab === 'products' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px', background: 'rgba(255,255,255,0.02)', padding: '30px', borderRadius: '15px' }}>
              <div style={{ gridColumn: 'span 1' }}><label>Nombre</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="form-input" /></div>
              <div style={{ gridColumn: 'span 1' }}><label>Precio ($)</label><input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} className="form-input" /></div>
              <div style={{ gridColumn: 'span 1' }}><label>Stock</label><input type="number" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} className="form-input" /></div>
              <div style={{ gridColumn: 'span 3' }}><label>URL Imagen</label><input value={form.image} onChange={e => setForm({...form, image: e.target.value})} className="form-input" /></div>
              <div style={{ gridColumn: 'span 3' }}><label>Descripción</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="form-input" style={{ height: '100px' }} /></div>
              <div style={{ gridColumn: 'span 3' }}><button onClick={saveProduct} className="btn-primary" style={{ width: '100%', padding: '15px' }}>{editingId ? 'ACTUALIZAR PRODUCTO' : 'CREAR PRODUCTO'}</button></div>
            </div>

            <div style={{ display: 'grid', gap: '15px' }}>
              {products.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <img src={p.image} style={{ width: '50px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                    <div>
                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-gray)' }}>${p.price} - Stock: {p.stock}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    <Edit2 size={20} style={{ cursor: 'pointer', color: 'var(--text-gray)' }} onClick={() => { setEditingId(p.id); setForm(p); }} />
                    <Trash2 size={20} style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={async () => { if(confirm("¿Eliminar producto?")) { await axios.delete(`/api/products/${p.id}`); handleRefreshAll(); } }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'coupons' && <CouponManager coupons={coupons} onRefresh={handleRefreshAll} />}

        {activeTab === 'notifications' && (
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ fontWeight: 900, fontSize: '1.5rem' }}>Notificaciones de Pedidos</h3>
              <button onClick={fetchNotifications} className="btn-outline" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>Actualizar</button>
            </div>
            {notifications.length > 0 ? notifications.map(n => (
              <div key={n.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${n.status === 'pending' ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '15px', padding: '25px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src={n.user?.avatar ? `https://cdn.discordapp.com/avatars/${n.user.id}/${n.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`} style={{ width: '45px', height: '45px', borderRadius: '50%', border: '2px solid var(--primary)' }} />
                    <div>
                      <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>{n.user?.username}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>ID: {n.user?.id} • {new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <span style={{ padding: '6px 15px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800, background: n.status === 'pending' ? 'rgba(255,51,51,0.1)' : 'rgba(51,255,51,0.1)', color: n.status === 'pending' ? 'var(--primary)' : '#33ff33', border: `1px solid ${n.status === 'pending' ? 'var(--primary)' : '#33ff33'}` }}>
                      {n.status === 'pending' ? 'PENDIENTE DE ENTREGA' : 'ENTREGADO'}
                    </span>
                    <Trash2 size={20} style={{ cursor: 'pointer', color: 'var(--text-gray)' }} onClick={async () => {
                      if (confirm("¿Eliminar esta notificación?")) {
                        await axios.delete(`/api/notifications/${n.id}`);
                        fetchNotifications();
                      }
                    }} />
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '15px', marginBottom: '20px' }}>
                  <div style={{ fontWeight: 800, marginBottom: '10px', color: 'var(--text-gray)', fontSize: '0.9rem' }}>PRODUCTOS COMPRADOS:</div>
                  {Array.isArray(n.items) && n.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: idx < n.items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img src={item.image} style={{ width: '35px', height: '35px', borderRadius: '6px', objectFit: 'cover' }} />
                        <span style={{ fontWeight: 700 }}>{item.name}</span>
                      </div>
                      <div style={{ fontWeight: 800 }}>{item.qty} x ${Number(item.price || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    {n.couponCode && <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '4px' }}>Cupón usado: {n.couponCode} (-{n.discountPercent}%)</div>}
                    <div style={{ fontSize: '1.3rem', fontWeight: 900 }}>Total Pagado: ${Number(n.total || 0).toFixed(2)} <span style={{fontSize:'0.8rem', opacity:0.6}}>{n.currency}</span></div>
                  </div>
                  {n.status === 'pending' && (
                    <button
                      onClick={async () => {
                        if (confirm("¿Confirmar que se entregó la compra? Esto descontará el stock automáticamente.")) {
                          try {
                            await axios.post(`/api/notifications/${n.id}/confirm`);
                            alert("¡Entrega confirmada y stock actualizado!");
                            fetchNotifications();
                            onRefresh();
                          } catch (e) {
                            alert(e.response?.data?.error || "Error al confirmar entrega");
                          }
                        }
                      }}
                      className="btn-primary"
                      style={{ padding: '12px 30px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}
                    >
                      <CheckCircle size={20} /> CONFIRMAR ENTREGA (BAJAR STOCK)
                    </button>
                  )}
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-gray)', background: 'rgba(255,255,255,0.01)', borderRadius: '15px' }}>No hay notificaciones de compras.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CouponManager = ({ coupons, onRefresh }) => {
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState('');

  const save = async () => {
    if(!code || !discount) return alert("Completa todos los campos");
    try {
      await axios.post('/api/coupons', { code, discount });
      onRefresh(); setCode(''); setDiscount('');
      alert("Cupón creado");
    } catch (e) { alert("Error al crear cupón"); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '20px', marginBottom: '40px', background: 'rgba(255,255,255,0.02)', padding: '30px', borderRadius: '15px' }}>
        <div style={{ flex: 2 }}><label>Código</label><input value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="form-input" placeholder="EJ: PROMO50" /></div>
        <div style={{ flex: 1 }}><label>Descuento (%)</label><input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="form-input" placeholder="50" /></div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}><button onClick={save} className="btn-primary" style={{ padding: '15px 40px' }}>CREAR CUPÓN</button></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
        {coupons.map(c => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--primary)', borderStyle: 'dashed' }}>
            <div>
              <div style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.2rem' }}>{c.code}</div>
              <div style={{ fontSize: '0.85rem' }}>Dcto: {c.discount}%</div>
            </div>
            <Trash2 size={20} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.2)' }} onClick={async () => { if(confirm("¿Eliminar cupón?")) { await axios.delete(`/api/coupons/${c.id}`); onRefresh(); } }} />
          </div>
        ))}
      </div>
    </div>
  );
};

// --- FULL FOOTER ---
const Footer = () => (
  <footer style={{ padding: '100px 0 50px', background: 'rgba(0,0,0,0.85)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
    <div className="container">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '60px', marginBottom: '60px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '20px' }}>SP4<span style={{ color: 'var(--primary)' }}>CE</span></h2>
          <p style={{ color: 'var(--text-gray)', lineHeight: 1.8 }}>Tu destino número uno para activos digitales de alta calidad. Seguridad, confianza y rapidez en cada clic.</p>
        </div>
        <div>
          <h4 style={{ color: 'var(--primary)', fontWeight: 900, marginBottom: '25px', letterSpacing: '2px' }}>NAVEGACIÓN</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <Link to="/" style={{ color: 'var(--text-gray)', textDecoration: 'none' }}>Inicio</Link>
            <Link to="/productos" style={{ color: 'var(--text-gray)', textDecoration: 'none' }}>Productos</Link>
            <a href="#team" style={{ color: 'var(--text-gray)', textDecoration: 'none' }}>Nuestro Equipo</a>
          </div>
        </div>
        <div>
          <h4 style={{ color: 'var(--primary)', fontWeight: 900, marginBottom: '25px', letterSpacing: '2px' }}>SOPORTE</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <a href="#" style={{ color: 'var(--text-gray)', textDecoration: 'none' }}>Términos y Condiciones</a>
            <a href="#" style={{ color: 'var(--text-gray)', textDecoration: 'none' }}>Preguntas Frecuentes</a>
            <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
              <Mail size={22} style={{ cursor: 'pointer' }}/>
              <MessageCircle size={22} style={{ cursor: 'pointer' }}/>
              <Globe size={22} style={{ cursor: 'pointer' }}/>
            </div>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '40px', textAlign: 'center', fontSize: '0.9rem', color: 'rgba(255,255,255,0.2)' }}>
        © {new Date().getFullYear()} SP4CE Store. Desarrollado con pasión para la comunidad gaming.
      </div>
    </div>
  </footer>
);
