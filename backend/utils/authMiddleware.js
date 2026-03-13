export function requireAuth(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  next();
}
