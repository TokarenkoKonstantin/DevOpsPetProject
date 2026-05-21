import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const getProductIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes('iphone') || n.includes('phone')) return '📱';
  if (n.includes('macbook') || n.includes('laptop')) return '💻';
  if (n.includes('airpod') || n.includes('ear')) return '🎧';
  if (n.includes('watch')) return '⌚';
  if (n.includes('ipad') || n.includes('tablet')) return '📱';
  if (n.includes('tv') || n.includes('display')) return '🖥️';
  return '📦';
};

const GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
  'linear-gradient(135deg, #10b981 0%, #0ea5e9 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
];

const parseJWT = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return {};
  }
};

function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
      ))}
    </div>
  );
}

function AuthModal({ onClose, onSuccess, addToast }) {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === 'login') {
        const res = await fetch('/api/users/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        if (!res.ok) throw new Error('Invalid email or password');
        const data = await res.json();
        const payload = parseJWT(data.access_token);
        onSuccess({ token: data.access_token, email: form.email, id: payload.user_id });
        addToast('Welcome back!', 'success');
      } else {
        const res = await fetch('/api/users/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error('Registration failed. User may already exist.');
        addToast('Account created! Please sign in.', 'success');
        setTab('login');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-tabs">
            <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>Sign In</button>
            <button className={tab === 'register' ? 'active' : ''} onClick={() => setTab('register')}>Register</button>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Email</label>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          </div>
          {tab === 'register' && (
            <div className="form-group">
              <label>Username</label>
              <input type="text" placeholder="username" value={form.username} onChange={set('username')} required />
            </div>
          )}
          <div className="form-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Loading...' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

function CartSidebar({ cart, onClose, onRemove, onQuantityChange, user, onCheckout }) {
  const total = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);

  return (
    <div className="cart-overlay" onClick={onClose}>
      <div className="cart-sidebar" onClick={e => e.stopPropagation()}>
        <div className="cart-header">
          <h2>🛒 Cart ({cart.reduce((s, i) => s + i.quantity, 0)})</h2>
          <button onClick={onClose}>✕</button>
        </div>
        {cart.length === 0 ? (
          <div className="cart-empty">
            <div>🛍️</div>
            <p>Your cart is empty</p>
            <span>Add some products to get started</span>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cart.map(item => (
                <div key={item.product.id} className="cart-item">
                  <div className="cart-item-icon">{getProductIcon(item.product.name)}</div>
                  <div className="cart-item-info">
                    <div className="cart-item-name">{item.product.name}</div>
                    <div className="cart-item-price">${(item.product.price * item.quantity).toFixed(2)}</div>
                  </div>
                  <div className="cart-item-controls">
                    <button onClick={() => onQuantityChange(item.product.id, item.quantity - 1)}>−</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => onQuantityChange(item.product.id, item.quantity + 1)}>+</button>
                  </div>
                  <button className="cart-item-remove" onClick={() => onRemove(item.product.id)}>🗑️</button>
                </div>
              ))}
            </div>
            <div className="cart-footer">
              <div className="cart-total">
                <span>Total</span>
                <span>${total.toFixed(2)}</span>
              </div>
              <button className="btn-primary btn-checkout" onClick={onCheckout}>
                {user ? 'Checkout' : 'Sign In to Checkout'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProductCard({ product, index, onAddToCart }) {
  return (
    <div className="product-card">
      <div className="product-card-image" style={{ background: GRADIENTS[index % GRADIENTS.length] }}>
        <span className="product-icon">{getProductIcon(product.name)}</span>
        <div className="product-stock-badge">
          {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
        </div>
      </div>
      <div className="product-card-body">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-description">{product.description}</p>
        <div className="product-footer">
          <span className="product-price">${product.price.toFixed(2)}</span>
          <button
            className="btn-add-cart"
            onClick={() => onAddToCart(product)}
            disabled={product.stock === 0}
          >
            {product.stock > 0 ? 'Add to Cart' : 'Sold Out'}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrdersPage({ orders, loading }) {
  const statusClass = (s) => ({ pending: 'status-pending', shipped: 'status-shipped', delivered: 'status-delivered', cancelled: 'status-cancelled' }[s] || 'status-pending');

  if (loading) return <div className="loading"><div className="spinner" />Loading orders...</div>;

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1>Order History</h1>
        <p className="page-subtitle">{orders.length} order{orders.length !== 1 ? 's' : ''} total</p>
      </div>
      {orders.length === 0 ? (
        <div className="empty-state">
          <div>📦</div>
          <p>No orders yet</p>
          <span>Place your first order to see it here</span>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-header">
                <div className="order-id">Order #{order.id}</div>
                <span className={`order-status ${statusClass(order.status)}`}>{order.status}</span>
              </div>
              <div className="order-details">
                <div className="order-detail-item">
                  <span className="detail-label">Customer ID</span>
                  <span>#{order.user_id}</span>
                </div>
                <div className="order-detail-item">
                  <span className="detail-label">Products</span>
                  <span>{Array.isArray(order.product_ids) ? order.product_ids.join(', ') : order.product_ids}</span>
                </div>
                <div className="order-detail-item">
                  <span className="detail-label">Total</span>
                  <span className="order-total">${Number(order.total_amount).toFixed(2)}</span>
                </div>
              </div>
              {order.created_at && (
                <div className="order-date">
                  {new Date(order.created_at).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [health, setHealth] = useState({});
  const [cart, setCart] = useState([]);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cs_user')); } catch { return null; }
  });
  const [view, setView] = useState('products');
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    const load = async () => {
      const h = {};
      try {
        const [pr, or, ur] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/orders'),
          fetch('/api/users'),
        ]);
        if (pr.ok) setProducts(await pr.json());
        if (or.ok) setOrders(await or.json());
        h.products = pr.ok;
        h.orders = or.ok;
        h.users = ur.ok;
      } catch {
        h.products = false; h.orders = false; h.users = false;
      } finally {
        setHealth(h);
        setLoading(false);
      }
    };
    load();
  }, []);

  const addToCart = (product) => {
    setCart(p => {
      const ex = p.find(i => i.product.id === product.id);
      if (ex) return p.map(i => i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...p, { product, quantity: 1 }];
    });
    addToast(`${product.name} added to cart`, 'success');
  };

  const removeFromCart = (id) => setCart(p => p.filter(i => i.product.id !== id));

  const changeQty = (id, qty) => {
    if (qty <= 0) { removeFromCart(id); return; }
    setCart(p => p.map(i => i.product.id === id ? { ...i, quantity: qty } : i));
  };

  const handleCheckout = async () => {
    if (!user) { setCartOpen(false); setAuthOpen(true); return; }
    try {
      const total = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
      const product_ids = cart.flatMap(i => Array(i.quantity).fill(i.product.id));
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id || 1, product_ids, total_amount: total, status: 'pending' }),
      });
      if (!res.ok) throw new Error('Order failed');
      const order = await res.json();
      setOrders(p => [order, ...p]);
      setCart([]);
      setCartOpen(false);
      addToast(`Order #${order.id} placed! 🎉`, 'success');
      setView('orders');
    } catch {
      addToast('Checkout failed. Please try again.', 'error');
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('cs_user', JSON.stringify(userData));
    setAuthOpen(false);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('cs_user');
    addToast('Signed out', 'info');
  };

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="app">
      <Toast toasts={toasts} />

      <header className="header">
        <div className="header-inner">
          <div className="logo" onClick={() => setView('products')}>
            <span className="logo-icon">⚡</span>
            <span className="logo-text">CloudShop</span>
          </div>
          <nav className="nav">
            <button className={`nav-link${view === 'products' ? ' active' : ''}`} onClick={() => setView('products')}>
              Products
            </button>
            <button className={`nav-link${view === 'orders' ? ' active' : ''}`} onClick={() => setView('orders')}>
              Orders {orders.length > 0 && <span className="nav-badge">{orders.length}</span>}
            </button>
          </nav>
          <div className="header-actions">
            <button className="cart-btn" onClick={() => setCartOpen(true)}>
              🛒
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>
            {user ? (
              <div className="user-menu">
                <div className="user-avatar">{user.email?.[0]?.toUpperCase()}</div>
                <span className="user-name">{user.email?.split('@')[0]}</span>
                <button className="btn-logout" onClick={handleLogout}>Sign out</button>
              </div>
            ) : (
              <button className="btn-login" onClick={() => setAuthOpen(true)}>Sign In</button>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        {view === 'products' && (
          <div className="products-page">
            <div className="page-header">
              <h1>Featured Products</h1>
              <p className="page-subtitle">Premium tech, delivered to your door</p>
            </div>
            {loading ? (
              <div className="loading-grid">
                {[1, 2, 3].map(i => <div key={i} className="product-card-skeleton" />)}
              </div>
            ) : (
              <div className="products-grid">
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} onAddToCart={addToCart} />
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'orders' && <OrdersPage orders={orders} loading={loading} />}
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-brand">☁️ CloudShop — Kubernetes Native</span>
          <div className="health-indicators">
            {[['products', 'Products'], ['orders', 'Orders'], ['users', 'Users']].map(([k, label]) => (
              <span key={k} className={`health-dot ${health[k] ? 'up' : 'down'}`}>{label}</span>
            ))}
          </div>
        </div>
      </footer>

      {cartOpen && (
        <CartSidebar
          cart={cart}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onQuantityChange={changeQty}
          user={user}
          onCheckout={handleCheckout}
        />
      )}

      {authOpen && (
        <AuthModal
          onClose={() => setAuthOpen(false)}
          onSuccess={handleLogin}
          addToast={addToast}
        />
      )}
    </div>
  );
}
