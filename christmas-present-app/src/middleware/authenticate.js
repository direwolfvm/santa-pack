const supabase = require('../db/supabaseClient');

module.exports = async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.replace('Bearer', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Invalid Authorization header' });
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  const user = data.user;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();
  req.user = { id: user.id, role: profile?.role || 'user' };
  next();
};
