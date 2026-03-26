const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/graph', require('./routes/graphRoutes'));
app.use('/query', require('./routes/queryRoutes'));

// Central error middleware
app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;
  res.status(status).json({ message: err.message || 'Internal server error.' });
});

module.exports = app;
