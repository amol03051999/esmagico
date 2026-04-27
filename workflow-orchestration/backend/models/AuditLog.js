const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String,
    required: true,
    enum: [
      'user.signup',
      'user.login',
      'project.created',
      'project.updated',
      'invite.generated',
      'invite.used',
      'member.joined',
      'task.created',
      'task.updated',
      'task.status_changed',
      'task.deleted',
      'dependency.rejected',
      'task.failed',
      'task.retry',
      'webhook.triggered',
      'webhook.failed'
    ]
  },
  entityType: {
    type: String,
    required: true,
    enum: ['User', 'Project', 'Task', 'Invite', 'Webhook']
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.index({ projectId: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
