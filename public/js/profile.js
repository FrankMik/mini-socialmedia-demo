const logoutBtn = document.getElementById('logoutBtn');
const profileAvatar = document.getElementById('profileAvatar');
const usernameEl = document.getElementById('username');
const bioEl = document.getElementById('bio');
const updateForm = document.getElementById('updateProfileForm');

// Logout
logoutBtn.addEventListener('click', async () => {
  await fetch('/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login.html';
});

// Profil laden
async function loadProfile() {
  const res = await fetch('/me', { credentials: 'include' });
  if(res.status === 401){
    window.location.href = '/login.html';
    return;
  }
  const user = await res.json();
  usernameEl.textContent = user.username;
  bioEl.textContent = user.bio || '';
  
  // Avatar: Wenn user.avatar_url leer oder null -> fallback
  profileAvatar.src = user.avatar_url && user.avatar_url !== ''
                      ? user.avatar_url
                      : './images/avatar.jpg';

  document.getElementById('bioInput').value = user.bio || '';
}

// Profil aktualisieren
updateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData();
  const file = document.getElementById('avatar').files[0];
  const bio = document.getElementById('bioInput').value;

  if(file) formData.append('avatar', file);
  formData.append('bio', bio);

  const res = await fetch('/updateProfile', {
    method: 'POST',
    body: formData,
    credentials: 'include'
  });

  const text = await res.text();
  alert(text);
  loadProfile();
});

// Initial
loadProfile();