const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: 'your-secret-key', resave: false, saveUninitialized: false }));
app.use(express.static('public'));

const db = new Database('./model/volunteerData.sqlite');

const hashedAdminPassword = '$2b$10$9JHqoVydFZEIPy9c5Wa3debb/dRGDs8JtDK4/JsbTpQPgYFG4vuJK';
db.prepare(`
  INSERT INTO users (username, email, phone, password, role)
  SELECT ?, ?, ?, ?, ?
  WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE username = ?
  )
`).run(
  'admin',
  'admin@example.com',
  '',
  hashedAdminPassword,
  'admin',
  'admin'
);

const routes = require('./routes/index');
app.use('/', routes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
