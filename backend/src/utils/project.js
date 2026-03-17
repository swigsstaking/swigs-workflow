import mongoose from 'mongoose';
import Project from '../models/Project.js';

/**
 * Verify that a project belongs to a specific user.
 * Returns the project document or null.
 */
export const verifyProjectOwnership = async (projectId, userId) => {
  if (!userId) throw new Error('userId requis pour vérifier l\'appartenance du projet');
  return Project.findOne({ _id: projectId, userId });
};

/**
 * Get all project IDs belonging to a user.
 * Optionally exclude projects with specific status IDs.
 */
export const getUserProjectIds = async (userId, excludeStatuses = []) => {
  if (!userId) return null;
  const query = { userId };
  if (excludeStatuses.length > 0) {
    const statusIds = excludeStatuses
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));
    if (statusIds.length > 0) query.status = { $nin: statusIds };
  }
  const projects = await Project.find(query).select('_id');
  return projects.map(p => p._id);
};

/**
 * Assert that a populated resource belongs to the requesting user.
 * Returns a 403 response object if ownership check fails, or null if OK.
 */
export const assertOwnership = (req, res, entity, userIdPath = 'project.userId') => {
  if (!req.user) return null;
  const parts = userIdPath.split('.');
  let ownerId = entity;
  for (const part of parts) {
    ownerId = ownerId?.[part];
  }
  if (!ownerId) {
    return res.status(403).json({ success: false, error: 'Ce projet n\'a pas de propriétaire assigné' });
  }
  if (ownerId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, error: 'Accès refusé' });
  }
  return null;
};
