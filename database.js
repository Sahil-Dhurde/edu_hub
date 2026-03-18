const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'eduex.db');

let db = null;

function initDB() {
  db = new Database(DB_PATH);
  
  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      skills TEXT DEFAULT '',
      interests TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      avatar TEXT DEFAULT 'assets/SSD.jpg',
      github TEXT DEFAULT '',
      linkedin TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS skill_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      skill_offered TEXT NOT NULL,
      skill_wanted TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bot_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed data — only if no users exist
  const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  const userCount = stmt.get().count;

  if (userCount === 0) {
    const hashedPassword = bcrypt.hashSync('password123', 10);

    const seedUsers = [
      ['Vicky Sharma', 'vicky@eduex.com', hashedPassword, 'HTML & CSS, JavaScript, React', 'Web Development, UI/UX', 'Full-stack web developer passionate about clean code.', 'https://github.com/vicky', 'https://linkedin.com/in/vicky'],
      ['Reena Patel', 'reena@eduex.com', hashedPassword, 'Photoshop, Illustrator, Figma', 'Graphic Design, Branding', 'Creative graphic designer with 3+ years experience.', 'https://github.com/reena', 'https://linkedin.com/in/reena'],
      ['Saurabh Kumar', 'saurabh@eduex.com', hashedPassword, 'Premiere Pro, After Effects, DaVinci', 'Video Editing, Motion Graphics', 'Professional video editor and content creator.', 'https://github.com/saurabh', 'https://linkedin.com/in/saurabh'],
      ['Priya Singh', 'priya@eduex.com', hashedPassword, 'Python, TensorFlow, Pandas', 'Data Science, Machine Learning', 'Data scientist specializing in ML and analytics.', 'https://github.com/priya', 'https://linkedin.com/in/priya'],
      ['Arjun Mehta', 'arjun@eduex.com', hashedPassword, 'Docker, Kubernetes, AWS', 'DevOps, Cloud Computing', 'DevOps engineer automating everything.', 'https://github.com/arjun', 'https://linkedin.com/in/arjun'],
      ['Sneha Joshi', 'sneha@eduex.com', hashedPassword, 'Java, Spring Boot, Hibernate', 'Backend Development, Microservices', 'Java developer building scalable backend systems.', 'https://github.com/sneha', 'https://linkedin.com/in/sneha'],
      ['Rahul Verma', 'rahul@eduex.com', hashedPassword, 'Flutter, Dart, Firebase', 'Mobile App Development', 'Mobile developer creating cross-platform apps.', 'https://github.com/rahul', 'https://linkedin.com/in/rahul'],
      ['Ananya Gupta', 'ananya@eduex.com', hashedPassword, 'SQL, MongoDB, PostgreSQL', 'Database Management, ETL', 'Database architect with optimization expertise.', 'https://github.com/ananya', 'https://linkedin.com/in/ananya'],
      ['Karan Desai', 'karan@eduex.com', hashedPassword, 'Ethical Hacking, Penetration Testing', 'Cybersecurity, Network Security', 'Cybersecurity expert and ethical hacker.', 'https://github.com/karan', 'https://linkedin.com/in/karan'],
      ['Meera Reddy', 'meera@eduex.com', hashedPassword, 'SEO, Google Ads, Social Media', 'Digital Marketing, Content Strategy', 'Digital marketing specialist driving growth.', 'https://github.com/meera', 'https://linkedin.com/in/meera'],
    ];

    const insertUser = db.prepare('INSERT INTO users (name, email, password, skills, interests, bio, github, linkedin) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const user of seedUsers) {
      insertUser.run(...user);
    }

    // Seed skill requests
    const insertReq = db.prepare('INSERT INTO skill_requests (from_user_id, to_user_id, skill_offered, skill_wanted, status) VALUES (?, ?, ?, ?, ?)');
    insertReq.run(2, 1, 'Graphic Design', 'Web Development', 'pending');
    insertReq.run(3, 1, 'Video Editing', 'JavaScript', 'pending');
    insertReq.run(4, 2, 'Python', 'Photoshop', 'accepted');

    // Seed messages
    const insertMsg = db.prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)');
    insertMsg.run(1, 2, 'Hey Reena! I saw your design portfolio, it looks amazing!');
    insertMsg.run(2, 1, 'Thanks Vicky! I love your web projects too. Want to swap skills?');
    insertMsg.run(1, 2, 'Absolutely! I can teach you React if you help me with Figma.');
    insertMsg.run(3, 1, "Hello! What's today's session about?");
    insertMsg.run(1, 3, "Hi Saurabh! Let's work on video transitions today.");

    console.log('✅ Database seeded with sample data');
  }

  return db;
}

function getDB() {
  if (!db) initDB();
  return db;
}

// Helper functions tailored for better-sqlite3
async function queryAll(sql, params = []) {
  if (!db) initDB();
  return db.prepare(sql).all(params);
}

async function queryMany(sql, params = []) {
  return queryAll(sql, params);
}

async function queryOne(sql, params = []) {
  if (!db) initDB();
  const row = db.prepare(sql).get(params);
  return row || null;
}

function runSQL(sql, params = []) {
  if (!db) initDB();
  const info = db.prepare(sql).run(params);
  return { lastInsertRowid: info.lastInsertRowid };
}

module.exports = { initDB, getDB, queryAll, queryOne, runSQL, queryMany };
