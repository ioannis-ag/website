const betterDb = require('better-sqlite3')('model/volunteerData.sqlite');

module.exports = {
  register: function({ username, email, phone, password }, callback) {
    const query = 'INSERT INTO users (username, email, phone, password) VALUES (?, ?, ?, ?)';
    const stmt = betterDb.prepare(query);
    try {
      stmt.run(username, email, phone, password);
      callback(null, { message: 'User registered' });
    } catch (err) {
      callback(err, null);
    }
  },
  login: function({ username }, callback) {
    const query = 'SELECT * FROM users WHERE username = ?';
    const stmt = betterDb.prepare(query);
    try {
      const user = stmt.get(username);
      callback(null, user);
    } catch (err) {
      callback(err, null);
    }
  },
  getProfile: function(userId, callback) {
    const userQuery = 'SELECT username, email, phone, role FROM users WHERE id = ?';
    const activityQuery = 'SELECT e.name, e.date, e.location FROM events e JOIN participations p ON e.id = p.event_id WHERE p.user_id = ?';
    try {
      const user = betterDb.prepare(userQuery).get(userId);
      const activities = betterDb.prepare(activityQuery).all(userId);
      callback(null, { user, activities });
    } catch (err) {
      callback(err, null);
    }
  },
  updateProfile: function(userId, { email, phone, password }, callback) {
    let query = 'UPDATE users SET email = ?, phone = ?';
    const params = [email, phone];
    if (password) {
      query += ', password = ?';
      params.push(password);
    }
    query += ' WHERE id = ?';
    params.push(userId);
    const stmt = betterDb.prepare(query);
    try {
      stmt.run(...params);
      callback(null, { message: 'Profile updated' });
    } catch (err) {
      callback(err, null);
    }
  },
  deleteAccount: function(userId, callback) {
    const deleteParticipations = 'DELETE FROM participations WHERE user_id = ?';
    const deleteUser = 'DELETE FROM users WHERE id = ?';
    try {
      betterDb.prepare(deleteParticipations).run(userId);
      betterDb.prepare(deleteUser).run(userId);
      callback(null, { message: 'Account deleted' });
    } catch (err) {
      callback(err, null);
    }
  },
  getEvents: function (userId, callback) {
    try {
      const updateCompletedQuery = `UPDATE events SET completed = 1 WHERE date < DATE('now')`;
      betterDb.prepare(updateCompletedQuery).run();
  
      const eventQuery = `
        SELECT 
          e.id, e.name, e.date, e.location, e.description, e.completed, e.image,
          GROUP_CONCAT(p.user_id) AS participants
        FROM events e
        LEFT JOIN participations p ON e.id = p.event_id
        GROUP BY e.id
      `;
  
      const events = betterDb.prepare(eventQuery).all();
  
      const parsedEvents = events.map(event => {
        const participantIds = event.participants
          ? event.participants.split(',').map(id => parseInt(id))
          : [];
  
        return {
          ...event,
          participants: participantIds,
          joined: userId ? (participantIds.includes(userId) ? 1 : 0) : 0
        };
      });
  
      callback(null, parsedEvents);
    } catch (err) {
      callback(err, null);
    }
  },
  addEvent: function({ name, date, location, description, image }, callback) {
    const query = 'INSERT INTO events (name, date, location, description, image) VALUES (?, ?, ?, ?, ?)';
    const stmt = betterDb.prepare(query);
    try {
      stmt.run(name, date, location, description, image);
      callback(null, { message: 'Event added' });
    } catch (err) {
      callback(err, null);
    }
  },
  getEventById: function (id, callback) {
    try {
      const stmt = betterDb.prepare('SELECT * FROM events WHERE id = ?');
      const event = stmt.get(id);
      callback(null, event);
    } catch (err) {
      callback(err);
    }
  },
  updateEventById: function (id, { name, date, location, description, image }, callback) {
    try {
      const stmt = betterDb.prepare(`
        UPDATE events
        SET name = ?, date = ?, location = ?, description = ?, image = ?
        WHERE id = ?
      `);
      stmt.run(name, date, location, description, image, id);
      callback(null, { success: true });
    } catch (err) {
      callback(err);
    }
  },
  deleteEvent: function(eventId, callback) {
    const deleteParticipations = 'DELETE FROM participations WHERE event_id = ?';
    const deleteEvent = 'DELETE FROM events WHERE id = ?';
    try {
      betterDb.prepare(deleteParticipations).run(eventId);
      betterDb.prepare(deleteEvent).run(eventId);
      callback(null, { message: 'Event deleted' });
    } catch (err) {
      callback(err, null);
    }
  },
  participate: function(userId, eventId, callback) {
    try {
      const checkQuery = 'SELECT 1 FROM participations WHERE user_id = ? AND event_id = ?';
      const exists = betterDb.prepare(checkQuery).get(userId, eventId);
  
      if (exists) {
        return callback(new Error('User already participating'), null);
      }
  
      const insertQuery = 'INSERT INTO participations (user_id, event_id) VALUES (?, ?)';
      betterDb.prepare(insertQuery).run(userId, eventId);
      callback(null, { message: 'Participation recorded' });
    } catch (err) {
      callback(err, null);
    }
  },
  cancelParticipation: function(userId, eventId, callback) {
    const query = 'DELETE FROM participations WHERE user_id = ? AND event_id = ?';
    const stmt = betterDb.prepare(query);
    try {
      stmt.run(userId, eventId);
      callback(null, { message: 'Canceled participation' });
    } catch (err) {
      callback(err, null);
    }
  },
  getLeaderboard: function(callback) {
    try {
      betterDb.prepare("UPDATE events SET completed = 1 WHERE date < DATE('now')").run();
  
      const query = `
        SELECT 
          u.username,
          u.role,
          IFNULL(event_stats.actions, 0) AS actions,
          IFNULL(event_stats.badges, 0) AS badges
        FROM users u
        LEFT JOIN (
          SELECT 
            p.user_id,
            COUNT(CASE WHEN e.completed = 1 THEN 1 ELSE NULL END) AS actions,
            COUNT(CASE WHEN e.completed = 1 THEN 1 ELSE NULL END) AS badges
          FROM participations p
          JOIN events e ON e.id = p.event_id
          GROUP BY p.user_id
        ) AS event_stats ON u.id = event_stats.user_id
        ORDER BY actions DESC
      `;
  
      const results = betterDb.prepare(query).all();
      callback(null, results);
    } catch (err) {
      callback(err, null);
    }
  },
  getUsers: function(callback) {
    const query = `
      SELECT u.id, u.username, u.email, u.role, COUNT(p.event_id) as participations
      FROM users u 
      LEFT JOIN participations p ON u.id = p.user_id 
      GROUP BY u.id`;
    try {
      const users = betterDb.prepare(query).all();
      callback(null, users);
    } catch (err) {
      callback(err, null);
    }
  },
  getAdminEvents: function(callback) {
    const query = `
    SELECT e.id, e.name, e.date, e.location, e.description, e.image,
           GROUP_CONCAT(u.username) as attendees
    FROM events e 
    LEFT JOIN participations p ON e.id = p.event_id
    LEFT JOIN users u ON p.user_id = u.id
    GROUP BY e.id`;
  try {
    const events = betterDb.prepare(query).all();
    callback(null, events);
  } catch (err) {
    callback(err, null);
  }
  },
  toggleUserRole: function(userId, callback) {
    try {
      const current = betterDb.prepare('SELECT role FROM users WHERE id = ?').get(userId);
      if (!current) return callback(new Error('User not found'));
  
      const newRole = current.role === 'admin' ? 'user' : 'admin';
      betterDb.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId);
      callback(null, { message: 'Role changed' });
    } catch (err) {
      callback(err, null);
    }
  },
  removeAttendee: function(userId, eventId, callback) {
    const query = 'DELETE FROM participations WHERE user_id = ? AND event_id = ?';
    const stmt = betterDb.prepare(query);
    try {
      const result = stmt.run(Number(userId), Number(eventId));
      if (result.changes === 0) {
        return callback(new Error('No attendee found to remove'), null);
      }
      callback(null, { message: 'Attendee removed' });
    } catch (err) {
      callback(err, null);
    }
  }
};
