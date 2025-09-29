(function() {
  function setActive() {
    const here = location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('[data-nav]').forEach(a => {
      const target = (a.getAttribute('href') || '').split('/').pop();
      if ((!target && here === 'index.html') || target === here) {
        a.setAttribute('aria-current','page');
      } else {
        a.removeAttribute('aria-current');
      }
    });
  }
  window.addEventListener('DOMContentLoaded', setActive);
})();
