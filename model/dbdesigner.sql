CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user'
);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT,
  image TEXT,
  completed BOOLEAN DEFAULT 0
);

CREATE TABLE participations (
  user_id INTEGER,
  event_id INTEGER,
  PRIMARY KEY (user_id, event_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

INSERT INTO users (username, email, phone, password, role) VALUES (
  'admin',
  'admin@example.com',
  '',
  '$2b$10$9JHqoVydFZEIPy9c5Wa3debb/dRGDs8JtDK4/JsbTpQPgYFG4vuJK',
  'admin'
);

INSERT INTO events (name, date, location, description, image) VALUES (
  'Beach Cleanup',
  '2025-06-15',
  'Patras Beach',
  'Join us for a beach cleanup and help protect the environment!',
  '/images/beach.jpg'
);
