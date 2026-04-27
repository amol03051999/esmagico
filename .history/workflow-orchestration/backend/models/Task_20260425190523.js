const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  priority: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  estimatedHours: {
    type: Number,
    min: 0,
    default: 1
  },
  status: {
    type: String,
    enum: ['Pending', 'Running', 'Completed', 'Failed', 'Blocked'],
    default: 'Pending'
  },
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  resourceTag: {
    type: String,
    trim: true,
    default: 'default'
  },
  maxRetries: {
    type: Number,
    min: 0,
    default: 3
  },
  retryCount: {
    type: Number,
    min: 0,
    default: 0
  },
  versionNumber: {
    type: Number,
    default: 1
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

taskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ project: 1, resourceTag: 1 });

module.exports = mongoose.model('Task', taskSchema);
