const mongoose = require('mongoose');

const AuthSchema = new mongoose.Schema({
  role: { type: String, required: true, unique: true }, // 'admin', 'user', 'assistant'
  username: { type: String, required: true },
  password: { type: String, required: true }
});

const TransactionSchema = new mongoose.Schema({
  id: { type: String, required: true }, // UUID from client or server
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['collection', 'expense', 'loan'], required: true },
  image: { type: String }, // Base64
  date: { type: String, required: true },
  description: { type: String }
});

const EventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  isDeleted: { type: Boolean, default: false },
  transactions: [TransactionSchema]
});

const RequestSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  description: { type: String },
  timestamp: { type: String },
  requestedBy: { type: String },
  isRead: { type: Boolean, default: false }
});

module.exports = {
  Auth: mongoose.model('Auth', AuthSchema),
  Event: mongoose.model('Event', EventSchema),
  Request: mongoose.model('Request', RequestSchema)
};