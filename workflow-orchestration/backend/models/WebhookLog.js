const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  event: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed
  },
  response: {
    statusCode: Number,
    body: mongoose.Schema.Types.Mixed
  },
  success: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 1
  },
  error: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

webhookLogSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
