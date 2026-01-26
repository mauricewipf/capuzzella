/**
 * Middleware to require authentication
 * Redirects to login page for HTML requests, returns 401 for API requests
 * 
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireAuth(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  
  // Check if this is an API request
  const isApiRequest = req.originalUrl.startsWith('/api') || 
                       req.originalUrl.startsWith('/publish') ||
                       req.xhr || 
                       req.headers.accept?.includes('application/json');
  
  if (isApiRequest) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Store the URL they were trying to access
  req.session.returnTo = req.originalUrl;
  res.redirect('/auth/login');
}

/**
 * Middleware to enforce password change
 * Redirects to settings page if user must change their generated password
 * Should be applied after requireAuth on routes that should be blocked
 * 
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requirePasswordChanged(req, res, next) {
  if (req.session.mustChangePassword) {
    // Check if this is an API request
    const isApiRequest = req.originalUrl.startsWith('/api') || 
                         req.originalUrl.startsWith('/publish') ||
                         req.xhr || 
                         req.headers.accept?.includes('application/json');
    
    if (isApiRequest) {
      return res.status(403).json({ error: 'You must change your password before accessing this resource' });
    }
    
    return res.redirect('/settings?message=' + encodeURIComponent('Please change your generated password before continuing'));
  }
  
  next();
}

/**
 * Middleware to check if user is authenticated (non-blocking)
 * Sets req.isAuthenticated for use in templates/handlers
 * 
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function checkAuth(req, res, next) {
  req.isAuthenticated = !!req.session.userId;
  req.user = req.session.userId ? {
    id: req.session.userId,
    username: req.session.username
  } : null;
  next();
}
