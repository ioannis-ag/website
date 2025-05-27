from flask import Flask, request, jsonify, session, redirect, url_for
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import os

app = Flask(__name__)
app.secret_key = 'your-secret-key'  # Replace with a secure key in production

# Database setup
def init_db():
    conn = sqlite3.connect('volunteer.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user'
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        location TEXT NOT NULL,
        completed BOOLEAN DEFAULT 0
    )''')
    c.execute('''CREATE TABLE IF NOT EXISTS participations (
        user_id INTEGER,
        event_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (event_id) REFERENCES events(id)
    )''')
    conn.commit()
    conn.close()

# Initialize database
if not os.path.exists('volunteer.db'):
    init_db()

# Helper function to get database connection
def get_db():
    conn = sqlite3.connect('volunteer.db')
    conn.row_factory = sqlite3.Row
    return conn

# Routes
@app.route('/register', methods=['POST'])
def register():
    data = request.form
    username = data.get('username')
    email = data.get('email')
    phone = data.get('phone')
    password = data.get('password')

    if not all([username, email, password]):
        return jsonify({'error': 'Missing required fields'}), 400

    hashed_password = generate_password_hash(password)
    conn = get_db()
    c = conn.cursor()
    try:
        c.execute('INSERT INTO users (username, email, phone, password) VALUES (?, ?, ?, ?)',
                  (username, email, phone, hashed_password))
        conn.commit()
        return jsonify({'message': 'Registration successful'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Username or email already exists'}), 400
    finally:
        conn.close()

@app.route('/login', methods=['POST'])
def login():
    data = request.form
    username = data.get('username')
    password = data.get('password')

    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM users WHERE username = ?', (username,))
    user = c.fetchone()
    conn.close()

    if user and check_password_hash(user['password'], password):
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        return jsonify({'message': 'Login successful', 'redirect': '/profile.html'})
    return jsonify({'error': 'Invalid credentials'}), 401

@app.route('/logout')
def logout():
    session.clear()
    return jsonify({'message': 'Logged out', 'redirect': '/main.html'})

@app.route('/profile', methods=['GET', 'POST'])
def profile():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        data = request.form
        email = data.get('email')
        phone = data.get('phone')
        password = data.get('password')
        c.execute('UPDATE users SET email = ?, phone = ? WHERE id = ?',
                  (email, phone, session['user_id']))
        if password:
            c.execute('UPDATE users SET password = ? WHERE id = ?',
                      (generate_password_hash(password), session['user_id']))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Profile updated'})
    
    c.execute('SELECT username, email, phone FROM users WHERE id = ?', (session['user_id'],))
    user = c.fetchone()
    c.execute('SELECT e.name, e.date, e.location FROM events e JOIN participations p ON e.id = p.event_id WHERE p.user_id = ?', (session['user_id'],))
    activities = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify({'user': dict(user), 'activities': activities})

@app.route('/delete_account', methods=['POST'])
def delete_account():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    c = conn.cursor()
    c.execute('DELETE FROM participations WHERE user_id = ?', (session['user_id'],))
    c.execute('DELETE FROM users WHERE id = ?', (session['user_id'],))
    conn.commit()
    conn.close()
    session.clear()
    return jsonify({'message': 'Account deleted', 'redirect': '/main.html'})

@app.route('/events', methods=['GET', 'POST'])
def events():
    conn = get_db()
    c = conn.cursor()
    if request.method == 'POST':
        if session.get('role') != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        data = request.form
        c.execute('INSERT INTO events (name, date, location) VALUES (?, ?, ?)',
                  (data.get('name'), data.get('date'), data.get('location')))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Event added'})

    c.execute('SELECT * FROM events WHERE completed = 0')
    upcoming = [dict(row) for row in c.fetchall()]
    c.execute('SELECT * FROM events WHERE completed = 1')
    completed = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify({'upcoming': upcoming, 'completed': completed})

@app.route('/participate/<int:event_id>', methods=['POST'])
def participate(event_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT INTO participations (user_id, event_id) VALUES (?, ?)',
              (session['user_id'], event_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Participation recorded'})

@app.route('/leaderboard', methods=['GET'])
def leaderboard():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT u.username, COUNT(p.event_id) as actions, 0 as awards FROM users u LEFT JOIN participations p ON u.id = p.user_id GROUP BY u.id ORDER BY actions DESC')
    leaderboard = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(leaderboard)

@app.route('/admin/users', methods=['GET'])
def admin_users():
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id, username, email, phone, role, (SELECT COUNT(*) FROM participations WHERE user_id = users.id) as participations FROM users')
    users = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(users)

@app.route('/admin/events', methods=['GET'])
def admin_events():
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT e.id, e.name, e.date, e.location, (SELECT GROUP_CONCAT(u.username) FROM users u JOIN participations p ON u.id = p.user_id WHERE p.event_id = e.id) as attendees FROM events e')
    events = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(events)

@app.route('/admin/remove_attendee/<int:event_id>/<int:user_id>', methods=['POST'])
def remove_attendee(event_id, user_id):
    if session.get('role') != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403

    conn = get_db()
    c = conn.cursor()
    c.execute('DELETE FROM participations WHERE user_id = ? AND event_id = ?', (user_id, event_id))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Attendee removed'})

if __name__ == '__main__':
    app.run(debug=True)
