export function requireAuth(req, res, next) {
  if (!req.session?.githubAccessToken) {
    return res.status(401).json({ error: 'Not authenticated. Connect GitHub first.' });
  }
  next();
}
