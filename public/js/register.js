const form = document.getElementById('registerForm');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const res = await fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if(res.ok) {
        alert('Registrierung erfolgreich! Du wirst weitergeleitet.');
        window.location.href = 'login.html';
      } else {
        alert(await res.text());
      }
    });