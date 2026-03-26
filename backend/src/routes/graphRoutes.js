const express = require('express');
const { getGraph } = require('../graph/graphRepository');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { nodes, edges } = await getGraph();
    res.status(200).json({ nodes, edges });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('ServiceUnavailable') || msg.includes('ECONNREFUSED') || msg.includes('connection')) {
      return res.status(503).json({ message: 'Database unreachable.' });
    }
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
