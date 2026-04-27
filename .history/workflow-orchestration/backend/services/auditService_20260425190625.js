const AuditLog = require('../models/AuditLog');

const logAudit = async ({ actor, action, entityType, entityId, projectId, metadata }) => {
  try {
    await AuditLog.create({
      actor,
      action,
      entityType,
      entityId,
      projectId,
      metadata
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
};

module.exports = { logAudit };
