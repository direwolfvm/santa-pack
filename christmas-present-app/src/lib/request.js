function getBearerToken(req) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

function requireText(value, field, { maxLength = 120 } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    const error = new Error(`${field} is required`);
    error.status = 400;
    throw error;
  }
  if (value.trim().length > maxLength) {
    const error = new Error(`${field} must be ${maxLength} characters or fewer`);
    error.status = 400;
    throw error;
  }
  return value.trim();
}

async function getAuthenticatedUser(supabase, req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data.user;
}

async function getRole(supabase, userId) {
  const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  return data?.role || null;
}

async function canManageFamily(supabase, userId, role, familyId) {
  if (role === 'admin') return true;
  if (role !== 'manager' || !familyId) return false;
  const { data, error } = await supabase
    .from('person')
    .select('id')
    .eq('user_profile', userId)
    .eq('family', familyId)
    .maybeSingle();
  return !error && Boolean(data);
}

module.exports = { getBearerToken, requireText, getAuthenticatedUser, getRole, canManageFamily };
