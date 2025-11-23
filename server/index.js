const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// Ensure './models' path is correct relative to this file
const { Auth, Event, Request } = require('./models'); 

const app = express();

// --- CRITICAL SERVERLESS OPTIMIZATION ---
// 1. Use process.env.MONGO_URI for deployment security.
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://user:user123@cluster0.peqqawg.mongodb.net/';
// 2. Cache the DB connection promise/object for reuse across warm starts.
let cachedDb = null; 
let isSeeded = false; // Flag to ensure seeding runs only once per cold start

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database Connection Logic optimized for Serverless
const connectDB = async () => {
    // Check if the connection is already cached and ready
    if (cachedDb && mongoose.connection.readyState === 1) {
        console.log('Using cached MongoDB connection.');
        return; // Connection is good, exit early
    }

    try {
        // Establish a new connection and cache it
        const db = await mongoose.connect(MONGO_URI);
        cachedDb = db.connection; 
        console.log('Established new MongoDB connection.');

        // Only run seedAuth() once on the first successful connection (cold start)
        if (!isSeeded) {
            await seedAuth();
            isSeeded = true;
            console.log('Initial data seeding complete.');
        }
    } catch (err) {
        // Clear cache and re-throw error for the caller to handle (e.g., return 503)
        cachedDb = null;
        console.error('MongoDB connection error:', err);
        throw new Error('Database connection failed.'); 
    }
};

// Seed Initial Data (Remains the same)
const seedAuth = async () => {
    try {
        const admin = await Auth.findOne({ role: 'admin' });
        if (!admin) await Auth.create({ role: 'admin', username: 'Raiha Iman', password: 'admin' });
        
        const user = await Auth.findOne({ role: 'user' });
        if (!user) await Auth.create({ role: 'user', username: 'user', password: 'password' });

        const assistant = await Auth.findOne({ role: 'assistant' });
        if (!assistant) await Auth.create({ role: 'assistant', username: 'assi', password: 'assi' });
    } catch (e) {
        console.log("Seeding error", e);
    }
};

// Middleware to ensure DB connection is active for every request
const checkDbConnection = (req, res, next) => {
    // Attempt connection on every request. If cached, this is a very fast check.
    connectDB()
      .then(() => next())
      .catch((error) => {
        // If connectDB fails, return 503 Service Unavailable
        return res.status(503).json({ error: error.message || 'Database disconnected' });
      });
};

app.use('/api', checkDbConnection); // Apply DB check to all API routes

// --- Routes ---

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await Auth.findOne({ username, password });
    if (user) {
      res.json({ success: true, role: user.role });
    } else {
      res.json({ success: false, error: 'Invalid credentials' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/credentials', async (req, res) => {
  try {
    const admin = await Auth.findOne({ role: 'admin' });
    const user = await Auth.findOne({ role: 'user' });
    const assistant = await Auth.findOne({ role: 'assistant' });
    res.json({
      adminUsername: admin?.username || 'Admin',
      userUsername: user?.username || 'User',
      assistantUsername: assistant?.username || 'Assistant'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/auth/update', async (req, res) => {
  const { role, username, password } = req.body;
  try {
    const update = { username };
    if (password) update.password = password;
    await Auth.findOneAndUpdate({ role }, update);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/reset-admin', async (req, res) => {
  const { confirmedUsername, newPassword } = req.body;
  try {
    const admin = await Auth.findOne({ role: 'admin', username: confirmedUsername });
    if (admin) {
      admin.password = newPassword;
      await admin.save();
      res.json({ success: true });
    } else {
      res.json({ success: false });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Events
app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find({ isDeleted: false });
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/events/deleted', async (req, res) => {
  try {
    const events = await Event.find({ isDeleted: true });
    res.json(events);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id });
    res.json(event);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const event = await Event.create(req.body);
    res.json(event);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/events/:id/delete', async (req, res) => {
  try {
    await Event.findOneAndUpdate({ id: req.params.id }, { isDeleted: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/events/:id/restore', async (req, res) => {
  try {
    await Event.findOneAndUpdate({ id: req.params.id }, { isDeleted: false });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await Event.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Transactions
app.post('/api/events/:id/transactions', async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    event.transactions.push(req.body);
    await event.save();
    res.json(req.body);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/events/:id/transactions/:txId', async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const idx = event.transactions.findIndex(t => t.id === req.params.txId);
    if (idx !== -1) {
      // Use toObject() for safety before merging updates
      event.transactions[idx] = { ...event.transactions[idx].toObject(), ...req.body };
      await event.save();
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/events/:id/transactions/:txId', async (req, res) => {
  try {
    const event = await Event.findOne({ id: req.params.id });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    event.transactions = event.transactions.filter(t => t.id !== req.params.txId);
    await event.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Requests
app.get('/api/requests', async (req, res) => {
  try {
    const requests = await Request.find({});
    res.json(requests);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/requests', async (req, res) => {
  try {
    const request = await Request.create(req.body);
    res.json(request);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/requests/:id', async (req, res) => {
  try {
    await Request.findOneAndUpdate({ id: req.params.id }, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/requests/:id', async (req, res) => {
  try {
    await Request.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/requests/mark-read', async (req, res) => {
  try {
    await Request.updateMany({}, { isRead: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Handle 404 (Ensure JSON response)
app.use((req, res) => {
  // This will only handle 404s for the API routes, not the frontend
  res.status(404).json({ error: 'API Endpoint Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// CRITICAL FIX: Export the app instance for Vercel's Serverless Function runtime.
module.exports = app;