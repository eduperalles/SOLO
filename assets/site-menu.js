(() => {
  const API = window.SOLO_API_URL || '';

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  let currentCards = [];

  document.addEventListener('DOMContentLoaded', () => {
    initSiteMenu();
  });

  async function initSiteMenu() {
    if (!API) return;
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify({action: 'getSiteMenuData'})
      });
      const result = await response.json();
      if (!result || !result.ok || !result.data) return;
      const {config, cards} = result.data;

      if (!config || !config.ativo || !cards || !cards.length) return;

      currentCards = cards;

      const menuTitle = config.menu_titulo || 'Opção';
      const navItem = document.getElementById('nav-item-custom');
      const navLink = document.getElementById('nav-link-custom');
      const mobileNavItem = document.getElementById('mobile-nav-item-custom');
      const mobileNavLink = document.getElementById('mobile-nav-link-custom');
      const section = document.getElementById('custom-section');
      const sectionTitle = document.getElementById('custom-section-title');
      const sectionSubtitle = document.getElementById('custom-section-subtitle');

      if (navItem && navLink) {
        navLink.textContent = menuTitle;
        navItem.style.display = '';
      }
      if (mobileNavItem && mobileNavLink) {
        mobileNavLink.textContent = menuTitle;
        mobileNavItem.style.display = '';
      }
      if (section && sectionTitle) {
        sectionTitle.textContent = config.secao_titulo || menuTitle;
        if (sectionSubtitle) sectionSubtitle.textContent = config.secao_subtitulo || '';
        section.style.display = '';
      }

      renderCards(cards);
    } catch (err) {
      console.error('Falha ao carregar seção dinâmica do menu:', err);
    }
  }

  function renderCards(cards) {
    const container = document.getElementById('custom-cards-container');
    if (!container) return;

    container.innerHTML = cards.map((card, cardIdx) => {
      const photos = Array.isArray(card.photos) && card.photos.length ? card.photos : [{url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80'}];
      const hasMultiple = photos.length > 1;

      return `
        <article class="dynamic-card" data-card-index="${cardIdx}">
          <div class="dynamic-card-media" id="card-media-${cardIdx}">
            <img src="${escapeHtml(photos[0].url)}" alt="${escapeHtml(card.titulo)}" class="dynamic-card-img" id="card-img-${cardIdx}" loading="lazy">
            ${hasMultiple ? `
              <button type="button" class="dynamic-card-nav-btn prev" data-card-nav="${cardIdx}" data-dir="-1" aria-label="Foto anterior">&#10094;</button>
              <button type="button" class="dynamic-card-nav-btn next" data-card-nav="${cardIdx}" data-dir="1" aria-label="Próxima foto">&#10095;</button>
              <div class="dynamic-card-dots" id="card-dots-${cardIdx}">
                ${photos.map((_, pIdx) => `<span class="dynamic-card-dot ${pIdx === 0 ? 'active' : ''}" data-card-dot="${cardIdx}" data-photo-index="${pIdx}"></span>`).join('')}
              </div>
            ` : ''}
          </div>
          <div class="dynamic-card-body">
            <h3>${escapeHtml(card.titulo)}</h3>
            <p>${escapeHtml(card.descricao)}</p>
            <button class="btn-budget" type="button" data-budget-id="${escapeHtml(card.id)}" data-budget-title="${escapeHtml(card.titulo)}">Solicite um orçamento</button>
          </div>
        </article>
      `;
    }).join('');

    // Event listeners para carrossel de fotos
    container.querySelectorAll('[data-card-nav]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const cardIdx = Number(btn.dataset.cardNav);
        const dir = Number(btn.dataset.dir);
        navigateCardPhoto(cardIdx, dir);
      });
    });

    container.querySelectorAll('[data-card-dot]').forEach(dot => {
      dot.addEventListener('click', e => {
        e.stopPropagation();
        const cardIdx = Number(dot.dataset.cardDot);
        const photoIdx = Number(dot.dataset.photoIndex);
        setCardPhoto(cardIdx, photoIdx);
      });
    });

    // Event listeners para abrir modal de orçamento
    container.querySelectorAll('[data-budget-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        openBudgetModal(btn.dataset.budgetId, btn.dataset.budgetTitle);
      });
    });
  }

  const cardPhotoIndexes = new Map();

  function navigateCardPhoto(cardIdx, dir) {
    const card = currentCards[cardIdx];
    if (!card || !card.photos || card.photos.length <= 1) return;
    let current = cardPhotoIndexes.get(cardIdx) || 0;
    current = (current + dir + card.photos.length) % card.photos.length;
    setCardPhoto(cardIdx, current);
  }

  function setCardPhoto(cardIdx, photoIdx) {
    const card = currentCards[cardIdx];
    if (!card || !card.photos || !card.photos[photoIdx]) return;
    cardPhotoIndexes.set(cardIdx, photoIdx);
    const img = document.getElementById(`card-img-${cardIdx}`);
    if (img) img.src = card.photos[photoIdx].url;

    const dots = document.querySelectorAll(`[data-card-dot="${cardIdx}"]`);
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === photoIdx);
    });
  }

  // --- MODAL DE ORÇAMENTO ---
  window.openBudgetModal = function(cardId, cardTitle) {
    const modal = document.getElementById('budgetModal');
    const inputId = document.getElementById('budgetCardId');
    const inputTitle = document.getElementById('budgetCardTitle');
    const modalTitle = document.getElementById('budgetModalTitle');
    const statusMsg = document.getElementById('budgetStatusMsg');
    const form = document.getElementById('budgetForm');

    if (!modal) return;

    if (inputId) inputId.value = cardId || '';
    if (inputTitle) inputTitle.value = cardTitle || 'Opção';
    if (modalTitle) modalTitle.textContent = cardTitle ? `Solicitar Orçamento — ${cardTitle}` : 'Solicite um Orçamento';
    if (statusMsg) {
      statusMsg.textContent = '';
      statusMsg.style.color = '';
    }
    if (form) form.reset();

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.getElementById('budgetNome')?.focus();
  };

  window.closeBudgetModal = function() {
    const modal = document.getElementById('budgetModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
  };

  window.handleBudgetSubmit = async function(event) {
    event.preventDefault();
    const form = document.getElementById('budgetForm');
    const submitBtn = document.getElementById('budgetSubmitBtn');
    const statusMsg = document.getElementById('budgetStatusMsg');
    if (!form || !submitBtn) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando solicitação…';
    if (statusMsg) {
      statusMsg.textContent = 'Gravando solicitação e preparando WhatsApp…';
      statusMsg.style.color = 'var(--accent-gold)';
    }

    const formData = new FormData(form);
    const record = {
      card_id: formData.get('card_id'),
      card_titulo: formData.get('card_titulo'),
      nome: formData.get('nome'),
      email: formData.get('email'),
      whatsapp: formData.get('whatsapp'),
      cidade: formData.get('cidade'),
      data_evento: formData.get('data_evento'),
      convidados: formData.get('convidados'),
      observacoes: formData.get('observacoes')
    };

    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify({action: 'submitBudgetRequest', record})
      });
      const result = await response.json();

      if (!result.ok) throw new Error(result.message || 'Falha ao registrar orçamento.');

      if (statusMsg) {
        statusMsg.textContent = 'Solicitação enviada com sucesso! Redirecionando para o WhatsApp…';
        statusMsg.style.color = 'var(--success)';
      }

      if (result.data && result.data.whatsapp_url) {
        window.open(result.data.whatsapp_url, '_blank');
      }

      setTimeout(() => {
        closeBudgetModal();
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar Solicitação';
      }, 2400);

    } catch (err) {
      if (statusMsg) {
        statusMsg.textContent = err.message;
        statusMsg.style.color = 'var(--danger)';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar Solicitação';
    }
  };

  // Fechar modal ao clicar fora
  window.addEventListener('click', e => {
    const modal = document.getElementById('budgetModal');
    if (e.target === modal) closeBudgetModal();
  });
})();
