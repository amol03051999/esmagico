const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

const projectMember = async (req, res, next) => {
  const Project = require('../models/Project');
  const projectId = req.params.projectId || req.body.projectId;
  
  if (!projectId) {
    return res.status(400).json({ message: 'Project ID required' });
  }

  try {
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const isMember = project.members.some(
      member => member.user.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({ message: 'Not a member of this project' });
    }

    req.project = project;
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

const projectOwner = async (req, res, next) => {
  const Project = require('../models/Project');
  const projectId = req.params.projectId || req.body.projectId;

  try {
    const project = await Project.findById(projectId);
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized, owner only' });
    }

    req.project = project;
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { protect, projectMember, projectOwner };
