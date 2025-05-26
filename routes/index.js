const express = require('express');
const router = express.Router();
const database = require('../controllers/database');
const bcrypt = require('bcrypt');

const isAuthenticated = (req, res, next) => {
  if (req.session.userId) return next();
  res.status(401).json({ error: 'Please log in' });
};

const isAdmin = (req, res, next) => {
  if (req.session.role === 'admin') return next();
  res.status(403).json({ error: 'Admin access required' });
};

router.post('/register', async (req, res) => {
  const { username, email, phone, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    database.register({ username, email, phone, password: hashedPassword }, (err, result) => {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ message: 'Registration successful' });
    });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  database.login({ username }, async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Invalid credentials' });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ message: 'Login successful' });
  });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/main.html');
  });
});

router.get('/profile', isAuthenticated, (req, res) => {
  database.getProfile(req.session.userId, (err, data) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(data);
  });
});

router.post('/profile', isAuthenticated, async (req, res) => {
  const { email, phone, password } = req.body;
  const updates = { email, phone };
  if (password) updates.password = await bcrypt.hash(password, 10);
  database.updateProfile(req.session.userId, updates, (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Profile updated' });
  });
});

router.post('/delete_account', isAuthenticated, (req, res) => {
  database.deleteAccount(req.session.userId, (err) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    req.session.destroy();
    res.json({ message: 'Account deleted' });
  });
});

router.get('/events', (req, res) => {
  database.getEvents(req.session.userId, (err, events) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    const upcoming = events.filter(e => !e.completed);
    const completed = events.filter(e => e.completed);
    res.json({ upcoming, completed });
  });
});

router.post('/events', isAuthenticated, isAdmin, (req, res) => {
  const { name, date, location } = req.body;
  database.addEvent({ name, date, location }, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Event added' });
  });
});

router.post('/participate/:event_id', isAuthenticated, (req, res) => {
  const eventId = req.params.event_id;
  database.participate(req.session.userId, eventId, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Participation recorded' });
  });
});

router.post('/cancel_participation/:event_id', isAuthenticated, (req, res) => {
  const eventId = req.params.event_id;
  database.cancelParticipation(req.session.userId, eventId, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Συμμετοχή ακυρώθηκε.' });
  });
});

router.get('/leaderboard', (req, res) => {
  database.getLeaderboard((err, results) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(results);
  });
});

router.get('/admin/users', isAuthenticated, isAdmin, (req, res) => {
  database.getUsers((err, users) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(users);
  });
});

router.post('/admin/delete_user/:user_id', isAuthenticated, isAdmin, (req, res) => {
  const userId = req.params.user_id;
  database.deleteAccount(userId, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete user' });
    res.json({ message: 'User deleted' });
  });
});

router.get('/admin/events', isAuthenticated, isAdmin, (req, res) => {
  database.getAdminEvents((err, events) => {
    if (err) return res.status(500).json({ error: 'Server error' });
    res.json(events);
  });
});

router.post('/admin/remove_attendee/:event_id/:user_id', isAuthenticated, isAdmin, (req, res) => {
  const { event_id, user_id } = req.params;
  database.removeAttendee(user_id, event_id, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Attendee removed' });
  });
});

router.post('/admin/delete_event/:event_id', isAuthenticated, isAdmin, (req, res) => {
  const eventId = req.params.event_id;
  database.deleteEvent(eventId, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Event deleted' });
  });
});

router.post('/admin/toggle_role/:user_id', isAuthenticated, isAdmin, (req, res) => {
  const userId = req.params.user_id;
  database.toggleUserRole(userId, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ message: 'Role updated' });
  });
});

router.get('/admin.html', isAuthenticated, isAdmin, (req, res) => {
  res.sendFile('admin.html', { root: './public' });
});

router.post('/contact', (req, res) => {
  const { name, email, message } = req.body;

  console.log(`
    [Contact Form Submission]
    To: support@volunteer.gr
    From: ${name} <${email}>
    Message: ${message}
  `);

  res.json({ message: 'Το μήνυμά σας εστάλη στο support@volunteer.gr!' });
});

module.exports = router;
