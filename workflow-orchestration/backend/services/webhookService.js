const axios = require('axios');
const WebhookLog = require('../models/WebhookLog');
const Project = require('../models/Project');
const { logAudit } = require('./auditService');

const triggerWebhook = async (projectId, event, payload) => {
  const project = await Project.findById(projectId);
  
  if (!project?.webhookConfig?.isActive || !project.webhookConfig.url) {
    return;
  }

  const { url, secret, events } = project.webhookConfig;

  // Check if this event is configured
  if (events && events.length > 0 && !events.includes(event)) {
    return;
  }

  const webhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    projectId: projectId.toString(),
    data: payload
  };

  let attempts = 0;
  let success = false;
  let lastError = null;
  let response = null;

  while (attempts < 3 && !success) {
    attempts++;
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (secret) {
        const crypto = require('crypto');
        const signature = crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(webhookPayload))
          .digest('hex');
        headers['X-Webhook-Signature'] = signature;
      }

      const res = await axios.post(url, webhookPayload, {
        headers,
        timeout: 10000
      });

      response = {
        statusCode: res.status,
        body: res.data
      };
      success = true;
    } catch (error) {
      lastError = error.message;
      response = {
        statusCode: error.response?.status,
        body: error.response?.data
      };
      
      if (attempts < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  // Log the webhook delivery
  await WebhookLog.create({
    project: projectId,
    event,
    url,
    payload: webhookPayload,
    response,
    success,
    attempts,
    error: lastError
  });

  // Audit log
  await logAudit({
    action: success ? 'webhook.triggered' : 'webhook.failed',
    entityType: 'Webhook',
    projectId,
    metadata: { event, attempts, success }
  });

  return { success, attempts };
};

module.exports = { triggerWebhook };
