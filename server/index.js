const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Auth, Event, Request } = require('./models'); // Ensure './models' path is correct

const app = express();

// Use environment variable for MONGO_URI (recommended)
// CRITICAL FIX: Use process.env for MONGO_URI and remove hardcoded PORT.
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://user:user123@cluster0.peqqawg.mongodb.net/';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Database Connection
let isDbConnected = false;
let isSeeded = false; // Add state to ensure seeding only happens once per cold start

const connectDB = async () => {
  // Check connection state to prevent unnecessary reconnections on warm start
  if (mongoose.connection.readyState === 1) {
    isDbConnected = true;
    return;
  }
  
  try {
    await mongoose.connect(MONGO_URI);
    isDbConnected = true;
    console.log('Connected to MongoDB');

    // Only seed the first time a connection is established after cold start
    if (!isSeeded) {
      await seedAuth();
      isSeeded = true;
    }

  } catch (err) {
    isDbConnected = false;
    console.error('MongoDB connection error:', err);
    // CRITICAL FIX: Removed setTimeout() to prevent Vercel process from hanging/timing out.
  }
};

mongoose.connection.on('disconnected', () => {
  isDbConnected = false;
  console.log('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  isDbConnected = true;
  console.log('MongoDB reconnected');
});

// Call connectDB globally so Vercel can attempt connection on cold start. 
connectDB(); 

// Seed Initial Data
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
  if (!isDbConnected || mongoose.connection.readyState !== 1) {
    // Re-attempt connection synchronously (blocking) for the current request
    connectDB()
      .then(() => {
        if (!isDbConnected) {
           return res.status(503).json({ error: 'Database disconnected' });
        }
        next();
      })
      .catch(() => {
        return res.status(503).json({ error: 'Database disconnected' });
      });
  } else {
    next();
  }
};

app.use('/api', checkDbConnection); // Only apply to API routes

// --- Routes (All routes remain unchanged) ---

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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
  res.status(404).json({ error: 'API Endpoint Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// CRITICAL FIX: Export the app instance for Vercel's Serverless Function runtime.
module.exports = app;