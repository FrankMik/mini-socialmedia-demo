const form = document.getElementById('loginForm');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if(res.ok) {
        window.location.href = '/profile.html';
        // window.location.href = 'feed.html';
      } else {
        alert(await res.text());
      }
    });