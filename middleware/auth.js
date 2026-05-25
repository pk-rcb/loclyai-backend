import jwt from 'jsonwebtoken';

/**
 * Middleware: verifies the access token from Authorization header.
 * Attaches decoded user info to req.user.
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) {
    return res.status(401).json({ error: 'Access token required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired access token.' });
  }
}

/**
 * Middleware: restricts access to specific user types.
 * Use after authenticateToken.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.type)) {
      return res.status(403).json({ error: 'Access denied. Insufficient role.' });
    }
    next();
  };
}
