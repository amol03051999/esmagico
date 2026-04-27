const jwt = require('jsonwebtoken');

const INVITE_SECRET = process.env.INVITE_SECRET || 'invite-secret-key';
const INVITE_EXPIRY = 30 * 60; // 30 minutes in seconds

const generateInviteToken = (projectId, createdBy) => {
  const payload = {
    projectId: projectId.toString(),
    createdBy: createdBy.toString(),
    type: 'project_invite'
  };
  
  return jwt.sign(payload, INVITE_SECRET, { expiresIn: INVITE_EXPIRY });
};

const verifyInviteToken = (token) => {
  try {
    const decoded = jwt.verify(token, INVITE_SECRET);
    if (decoded.type !== 'project_invite') {
      return { valid: false, error: 'Invalid token type' };
    }
    return { valid: true, data: decoded };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'Invite token has expired' };
    }
    return { valid: false, error: 'Invalid invite token' };
  }
};

module.exports = { generateInviteToken, verifyInviteToken };
