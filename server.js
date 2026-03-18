require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { initDB, queryAll, queryOne, runSQL } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'eduex-secret-key-2025';

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false // disable CSP for quick prototype compatibility
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200 // limit each IP to 200 requests per block
});
app.use('/api/', limiter);

// Regular Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Auth middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ========================
// AUTH ROUTES
// ========================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, skills, interests } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = runSQL(
      'INSERT INTO users (name, email, password, skills, interests) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, skills || '', interests || '']
    );

    const token = jwt.sign({ userId: result.lastInsertRowid }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: result.lastInsertRowid, name, email, skills: skills || '', interests: interests || '' }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        skills: user.skills, interests: user.interests, bio: user.bio,
        avatar: user.avatar, github: user.github, linkedin: user.linkedin
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user
app.get('/api/auth/me', authenticate, async (req, res) => {
  const user = await queryOne('SELECT id, name, email, skills, interests, bio, avatar, github, linkedin FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ========================
// USERS ROUTES
// ========================

// List all users (for profiles page)
app.get('/api/users', async (req, res) => {
  const { skill, search } = req.query;
  let query = 'SELECT id, name, email, skills, interests, bio, avatar, github, linkedin FROM users';
  const params = [];

  if (skill) {
    query += ' WHERE skills LIKE ?';
    params.push(`%${skill}%`);
  } else if (search) {
    query += ' WHERE name LIKE ? OR skills LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }

  const users = await queryAll(query, params);
  res.json(users);
});

// Get single user
app.get('/api/users/:id', async (req, res) => {
  const user = await queryOne('SELECT id, name, email, skills, interests, bio, avatar, github, linkedin FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Update user profile
app.put('/api/users/:id', authenticate, async (req, res) => {
  if (req.userId !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Cannot update another user' });
  }
  const { name, skills, interests, bio, github, linkedin } = req.body;
  runSQL(
    'UPDATE users SET name=?, skills=?, interests=?, bio=?, github=?, linkedin=? WHERE id=?',
    [name, skills, interests, bio, github, linkedin, req.userId]
  );

  const user = await queryOne('SELECT id, name, email, skills, interests, bio, avatar, github, linkedin FROM users WHERE id = ?', [req.userId]);
  res.json(user);
});

// Get Suggested Matches
app.get('/api/users/matches', authenticate, async (req, res) => {
  try {
    const me = await queryOne('SELECT skills, interests FROM users WHERE id = ?', [req.userId]);
    if (!me || (!me.skills && !me.interests)) {
      return res.json([]); // No basis for match
    }

    // Very naive matching: anyone whose skills match my interests, OR whose interests match my skills
    const mySkills = me.skills.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const myInterests = me.interests.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    const allUsers = await queryAll('SELECT id, name, email, skills, interests, bio, avatar FROM users WHERE id != ?', [req.userId]);
    
    const matches = allUsers.filter(u => {
      const uSkills = (u.skills || '').toLowerCase();
      const uInterests = (u.interests || '').toLowerCase();
      
      const canTeachMe = myInterests.some(interest => uSkills.includes(interest));
      const wantsToLearnFromMe = mySkills.some(skill => uInterests.includes(skill));
      
      return canTeachMe || wantsToLearnFromMe;
    });

    res.json(matches.slice(0, 5)); // Return top 5 matches
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ========================
// SKILL REQUESTS ROUTES
// ========================

// Send skill swap request
app.post('/api/skill-requests', authenticate, (req, res) => {
  const { toUserId, skillOffered, skillWanted } = req.body;
  if (!toUserId || !skillOffered || !skillWanted) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const result = runSQL(
    'INSERT INTO skill_requests (from_user_id, to_user_id, skill_offered, skill_wanted) VALUES (?, ?, ?, ?)',
    [req.userId, toUserId, skillOffered, skillWanted]
  );

  res.json({ id: result.lastInsertRowid, status: 'pending' });
});

// Get my skill requests (received)
app.get('/api/skill-requests', authenticate, async (req, res) => {
  const requests = await queryAll(`
    SELECT sr.*, u.name as from_name, u.avatar as from_avatar, u.skills as from_skills
    FROM skill_requests sr
    JOIN users u ON sr.from_user_id = u.id
    WHERE sr.to_user_id = ?
    ORDER BY sr.created_at DESC
  `, [req.userId]);
  res.json(requests);
});

// Get sent skill requests
app.get('/api/skill-requests/sent', authenticate, async (req, res) => {
  const requests = await queryAll(`
    SELECT sr.*, u.name as to_name, u.avatar as to_avatar
    FROM skill_requests sr
    JOIN users u ON sr.to_user_id = u.id
    WHERE sr.from_user_id = ?
    ORDER BY sr.created_at DESC
  `, [req.userId]);
  res.json(requests);
});

// Accept/reject skill request
app.put('/api/skill-requests/:id', authenticate, async (req, res) => {
  const { status } = req.body;
  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Status must be accepted or rejected' });
  }

  const request = await queryOne('SELECT * FROM skill_requests WHERE id = ? AND to_user_id = ?', [req.params.id, req.userId]);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  runSQL('UPDATE skill_requests SET status = ? WHERE id = ?', [status, req.params.id]);
  res.json({ success: true, status });
});

// ========================
// MESSAGES ROUTES
// ========================

// Send message
app.post('/api/messages', authenticate, (req, res) => {
  const { receiverId, content } = req.body;
  if (!receiverId || !content) {
    return res.status(400).json({ error: 'Receiver and content are required' });
  }

  const result = runSQL(
    'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)',
    [req.userId, receiverId, content]
  );

  const msgId = result.lastInsertRowid;
  const createdAt = new Date().toISOString();

  // Socket.IO Real-time broadcast
  const io = req.app.get('io');
  const connectedUsers = req.app.get('connectedUsers');
  if (io && connectedUsers) {
    const receiverSocketId = connectedUsers.get(parseInt(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receive_message', {
        id: msgId,
        sender_id: req.userId,
        receiver_id: parseInt(receiverId),
        content,
        created_at: createdAt
      });
    }
  }

  res.json({ id: msgId, created_at: createdAt });
});

// Get conversation with a user
app.get('/api/messages/:userId', authenticate, async (req, res) => {
  const otherUserId = parseInt(req.params.userId);
  const messages = await queryAll(`
    SELECT m.*, 
           s.name as sender_name, s.avatar as sender_avatar,
           r.name as receiver_name
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    JOIN users s ON m.sender_id = s.id
    JOIN users r ON m.receiver_id = r.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?) 
       OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
  `, [req.userId, otherUserId, otherUserId, req.userId]);
  res.json(messages);
});

// Get list of conversations (unique users I've chatted with)
app.get('/api/conversations', authenticate, async (req, res) => {
  const conversations = await queryAll(`
    SELECT DISTINCT 
      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as user_id,
      u.name, u.avatar, u.skills,
      (SELECT content FROM messages 
       WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
       ORDER BY created_at DESC LIMIT 1) as last_message
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
    WHERE m.sender_id = ? OR m.receiver_id = ?
    GROUP BY user_id
    ORDER BY MAX(m.created_at) DESC
  `, [req.userId, req.userId, req.userId, req.userId, req.userId, req.userId]);
  res.json(conversations);
});

// ========================
// STATS ROUTE
// ========================
app.get('/api/stats', async (req, res) => {
  const users = await queryOne('SELECT COUNT(*) as count FROM users');
  const swaps = await queryOne("SELECT COUNT(*) as count FROM skill_requests WHERE status = 'accepted'");
  const pending = await queryOne("SELECT COUNT(*) as count FROM skill_requests WHERE status = 'pending'");
  res.json({
    totalUsers: users?.count || 0,
    completedSwaps: swaps?.count || 0,
    pendingRequests: pending?.count || 0
  });
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ========================
// BOT ROUTES
// ========================

app.post('/api/bot/message', authenticate, (req, res) => {
  const { sender, content } = req.body;
  if (!sender || !content) return res.status(400).json({ error: 'Sender and content required' });

  const result = runSQL(
    'INSERT INTO bot_messages (user_id, sender, content) VALUES (?, ?, ?)',
    [req.userId, sender, content]
  );
  
  res.json({ success: true, id: result.lastInsertRowid });
});

app.get('/api/bot/history', authenticate, async (req, res) => {
  const messages = await queryAll('SELECT sender, content, created_at as time FROM bot_messages WHERE user_id = ? ORDER BY created_at ASC', [req.userId]);
  res.json(messages);
});

app.delete('/api/bot/history', authenticate, (req, res) => {
  runSQL('DELETE FROM bot_messages WHERE user_id = ?', [req.userId]);
  res.json({ success: true });
});

// Initialize database then start server
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const connectedUsers = new Map();

io.on('connection', (socket) => {
  const token = socket.handshake.auth.token;
  if (!token) return socket.disconnect();
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.userId;
    connectedUsers.set(socket.userId, socket.id);
    console.log(`User connected: ${socket.userId}`);
    
    // Broadcast online status
    io.emit('user_status', { userId: socket.userId, status: 'online' });
    
    // Send list of online users
    socket.emit('online_users', Array.from(connectedUsers.keys()));
    
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      connectedUsers.delete(socket.userId);
      io.emit('user_status', { userId: socket.userId, status: 'offline' });
    });
  } catch (err) {
    socket.disconnect();
  }
});

app.set('io', io);
app.set('connectedUsers', connectedUsers);

try {
  initDB();
  server.listen(PORT, () => {
    console.log(`\n🎓 EduEx server running at http://localhost:${PORT}\n`);
  });
} catch (err) {
  console.error(err);
}
