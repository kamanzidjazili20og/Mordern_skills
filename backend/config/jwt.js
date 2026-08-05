require('dotenv').config();

module.exports = {
    secret: process.env.JWT_SECRET || 'modern-skills-dev-secret-change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
};
