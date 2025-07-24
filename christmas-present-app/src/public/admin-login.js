async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(pwd) {
  for (const entry of hashedPasswords) {
    const computed = await sha256(pwd + entry.salt);
    if (computed === entry.hash) {
      return true;
    }
  }
  return false;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('password').value;
    if (await verifyPassword(pwd)) {
      sessionStorage.setItem('adminAuthed', '1');
      window.location.href = 'admin.html';
    } else {
      alert('Invalid password.');
    }
  });
});
