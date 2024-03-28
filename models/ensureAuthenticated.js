// Import required modules
const passport = require('passport');

// Ensure user is authenticated, otherwise redirect to login page
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Export the function
module.exports = ensureAuthenticated;
