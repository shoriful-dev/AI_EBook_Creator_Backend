const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes.js');
const bookRoutes = require('./routes/bookRoutes.js');
const aiRoutes = require('./routes/aiRoutes.js');
const exportRoutes = require('./routes/exportRoutes.js');
const paymentRoutes = require('./routes/paymentRoutes.js');

const app = express();

// Middleware to handle CORS
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// Connect to the database
connectDB();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static folders for uploads
app.use('/backend/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/payment', paymentRoutes);

// Start the server
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Server is running 🚀');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
