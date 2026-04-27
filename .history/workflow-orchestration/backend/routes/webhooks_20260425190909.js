const express = require('express');
const router = express.Router();
const WebhookLog = require('../models/WebhookLog');
const { protect, projectMember } = require('../middleware/auth');

// @route   GET /api/webhooks/project/:projectId/logs
// @desc    Get webhook logs for a project
// @access  Private (members only)
router.get('/project/:projectId/logs', protect, projectMember, async (req, res) => {
  try {
    const logs = await WebhookLog.find({ project: req.params.projectId })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
