const mongoose = require('mongoose');

const taskVersionSchema = new mongoose.Schema({
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  versionNumber: {
    type: Number,
    required: true
  },
  title: String,
  description: String,
  priority: Number,
  estimatedHours: Number,
  status: String,
  dependencies: [mongoose.Schema.Types.ObjectId],
  resourceTag: String,
  maxRetries: Number,
  retryCount: Number,
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  changeType: {
    type: String,
    enum: ['created', 'updated', 'status_change', 'retry'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

taskVersionSchema.index({ task: 1, versionNumber: -1 });

module.exports = mongoose.model('TaskVersion', taskVersionSchema);
