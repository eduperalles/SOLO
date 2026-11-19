(() => {
  const form = document.querySelector('#login-form');
  if (!form) return;
  const notice = document.querySelector('#notice');
  const submit = form.querySelector('button[type="submit"]');
  const toggle = form.querySelector('[data-password-toggle]');
  const password = form.querySelector('#password');

  if (new URLSearchParams(location.search).get('acesso') === 'equipe' && sessionStorage.getItem('solo_session')) location.replace('admin/dashboard.html');
  toggle.addEventListener('click', () => {
    const visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    toggle.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    notice.textContent = '';
    if (submit.disabled || !form.reportValidity()) return;
    if (!window.SOLO_API_URL) {
      notice.textContent = 'O serviço administrativo ainda não foi publicado.';
      return;
    }
    submit.disabled = true;
    submit.classList.add('is-loading');
    const finishLoading = window.SoloLoading?.start('Entrando no painel');
    try {
      const response = await fetch(window.SOLO_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'login', email: form.email.value.trim(), password: password.value })
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.message || 'Não foi possível entrar.');
      sessionStorage.setItem('solo_session', result.data.token);
      sessionStorage.setItem('solo_user', JSON.stringify(result.data.user));
      await finishLoading?.();
      location.assign('admin/dashboard.html');
    } catch (error) {
      await finishLoading?.(false);
      notice.textContent = error.message || 'Não foi possível conectar ao serviço.';
    } finally {
      submit.disabled = false;
      submit.classList.remove('is-loading');
    }
  });
})();
