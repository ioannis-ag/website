document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('main-nav');
  const loginLink = document.getElementById('login-link');

  fetch('/profile')
    .then(response => response.json())
    .then(data => {
      if (!data.error) {
        loginLink.textContent = 'Αποσύνδεση';
        loginLink.href = '/logout';
        const profileLink = document.createElement('a');
        profileLink.href = '/profile.html';
        profileLink.textContent = 'Προφίλ';
        nav.insertBefore(profileLink, loginLink);
        if (data.user.role === 'admin') {
          const adminLink = document.createElement('a');
          adminLink.href = '/admin.html';
          adminLink.textContent = 'Διαχειριστής';
          nav.insertBefore(adminLink, loginLink);
        }
      }
    });
});
