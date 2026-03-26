// ============================================
// EduEx — Frontend API Helper Layer
// ============================================
// This file provides all API wrappers, auth helpers,
// and UI utilities used across every page.

const API_BASE = window.location.origin;

// ========================
// LOCAL STORAGE HELPERS
// ========================

function getToken() {
  return localStorage.getItem('token');
}

function getStoredUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

function isLoggedIn() {
  return !!getToken() && !!getStoredUser();
}

function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

// ========================
// GENERIC FETCH WRAPPERS
// ========================

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

function authHeaders() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// ========================
// AUTH API
// ========================

async function handleLogin(event) {
  event.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errorDiv = document.getElementById('login-error');

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showAuthError(errorDiv, 'Please fill in all fields');
    return;
  }

  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Logging in...';

    const data = await apiPost('/api/auth/login', { email, password });
    saveAuth(data.token, data.user);
    window.location.href = 'User_Dashboard.html';
  } catch (err) {
    showAuthError(errorDiv, err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Log In <i class="fa-solid fa-arrow-right"></i>';
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const btn = document.getElementById('regBtn');
  const errorDiv = document.getElementById('register-error');

  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;

  if (!name || !email || !password) {
    showAuthError(errorDiv, 'Please fill in all fields');
    return;
  }

  if (password.length < 6) {
    showAuthError(errorDiv, 'Password must be at least 6 characters');
    return;
  }

  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Creating account...';

    const data = await apiPost('/api/auth/register', { name, email, password });
    saveAuth(data.token, data.user);
    window.location.href = 'User_Dashboard.html';
  } catch (err) {
    showAuthError(errorDiv, err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Sign Up <i class="fa-solid fa-arrow-right"></i>';
  }
}

async function getMe() {
  return apiGet('/api/auth/me');
}

// ========================
// USERS API
// ========================

async function getAllUsers() {
  return apiGet('/api/users');
}

async function getUsersBySearch(query) {
  return apiGet(`/api/users?search=${encodeURIComponent(query)}`);
}

async function getUsersBySkill(skill) {
  return apiGet(`/api/users?skill=${encodeURIComponent(skill)}`);
}

async function updateProfile(userId, data) {
  return apiPut(`/api/users/${userId}`, data);
}

async function getMatches() {
  return apiGet('/api/users/matches');
}

// ========================
// SKILL REQUESTS API
// ========================

async function getSkillRequests() {
  return apiGet('/api/skill-requests');
}

async function getSentRequests() {
  return apiGet('/api/skill-requests/sent');
}

async function sendSkillRequest(toUserId, skillOffered, skillWanted) {
  return apiPost('/api/skill-requests', { toUserId, skillOffered, skillWanted });
}

async function respondToRequest(requestId, status) {
  return apiPut(`/api/skill-requests/${requestId}`, { status });
}

// ========================
// MESSAGES API
// ========================

async function getMessages(userId) {
  return apiGet(`/api/messages/${userId}`);
}

async function sendMessageAPI(receiverId, content) {
  return apiPost('/api/messages', { receiverId, content });
}

async function getConversations() {
  return apiGet('/api/conversations');
}

// ========================
// BOT API
// ========================

async function saveBotMessage(sender, content) {
  return apiPost('/api/bot/message', { sender, content });
}

async function getBotHistory() {
  return apiGet('/api/bot/history');
}

async function clearBotHistory() {
  return apiDelete('/api/bot/history');
}

// ========================
// STATS API
// ========================

async function getStats() {
  return apiGet('/api/stats');
}

// ========================
// UI HELPERS
// ========================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'block';
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
}

function switchModal(closeId, openId) {
  closeModal(closeId);
  openModal(openId);
}

function showAuthError(el, message) {
  if (!el) return;
  el.style.display = 'block';
  el.style.color = '#ff4757';
  el.style.background = 'rgba(255, 71, 87, 0.1)';
  el.style.border = '1px solid rgba(255, 71, 87, 0.3)';
  el.style.padding = '10px 15px';
  el.style.borderRadius = '8px';
  el.style.marginBottom = '15px';
  el.style.fontSize = '0.85rem';
  el.textContent = message;
}

function showToast(message, type = 'info') {
  // Remove existing toast if any
  const existing = document.querySelector('.eduex-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'eduex-toast';

  const colors = {
    success: { bg: 'rgba(80, 250, 123, 0.15)', border: '#50fa7b', icon: 'fa-check-circle' },
    error:   { bg: 'rgba(255, 71, 87, 0.15)',   border: '#ff4757', icon: 'fa-exclamation-circle' },
    info:    { bg: 'rgba(139, 92, 246, 0.15)',   border: '#8b5cf6', icon: 'fa-info-circle' }
  };
  const c = colors[type] || colors.info;

  toast.style.cssText = `
    position: fixed; bottom: 30px; right: 30px; z-index: 99999;
    background: ${c.bg}; border: 1px solid ${c.border}; color: white;
    padding: 14px 22px; border-radius: 12px; font-size: 0.9rem;
    display: flex; align-items: center; gap: 10px;
    animation: toastSlideIn 0.35s ease-out;
    backdrop-filter: blur(10px); box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  `;
  toast.innerHTML = `<i class="fa-solid ${c.icon}" style="color: ${c.border}"></i> ${message}`;

  // Inject animation if not present
  if (!document.getElementById('toast-anim-style')) {
    const style = document.createElement('style');
    style.id = 'toast-anim-style';
    style.textContent = `
      @keyframes toastSlideIn {
        from { transform: translateX(100px); opacity: 0; }
        to   { transform: translateX(0);     opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100px)';
    toast.style.transition = 'all 0.35s ease-in';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// Close modals when clicking outside
window.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});

// Auto-redirect logged-in users away from index.html auth modals (optional)
document.addEventListener('DOMContentLoaded', () => {
  // If on index page and logged in, update nav to show dashboard link
  const authButtons = document.querySelector('.auth-buttons');
  if (authButtons && isLoggedIn()) {
    const user = getStoredUser();
    authButtons.innerHTML = `
      <a href="User_Dashboard.html" class="btn-outline" style="text-decoration: none;">
        <i class="fa-solid fa-border-all"></i> Dashboard
      </a>
      <button onclick="logout()" class="btn-primary">
        <i class="fa-solid fa-arrow-right-from-bracket"></i> Logout
      </button>
    `;
  }
});
