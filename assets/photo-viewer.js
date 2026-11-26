(() => {
  'use strict';
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-photo-preview]');
    if (!trigger || document.querySelector('.photo-viewer[open]')) return;
    const thumbnail = trigger.querySelector('img');
    if (!thumbnail?.src) return;

    const dialog = document.createElement('dialog');
    dialog.className = 'photo-viewer';
    dialog.setAttribute('aria-labelledby', 'photo-viewer-title');
    dialog.innerHTML = '<div class="photo-viewer-toolbar"><h2 id="photo-viewer-title"></h2><button type="button" class="tiny-button" autofocus>Fechar</button></div><div class="photo-viewer-content"><img><p role="status" hidden>Não foi possível carregar a foto.</p></div>';
    const title = trigger.dataset.photoTitle || 'Foto ampliada';
    dialog.querySelector('h2').textContent = title;
    const image = dialog.querySelector('img');
    image.alt = `Foto de ${title}`;
    image.onerror = () => {
      image.hidden = true;
      dialog.querySelector('[role="status"]').hidden = false;
    };
    image.src = thumbnail.currentSrc || thumbnail.src;
    dialog.querySelector('button').onclick = () => dialog.close();
    dialog.addEventListener('close', () => dialog.remove(), {once: true});
    document.body.append(dialog);
    dialog.showModal();
  });
})();
