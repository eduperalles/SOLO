(() => {
  let busy = false;
  const field = id => document.getElementById(id);
  const digits = value => String(value || '').replace(/\D/g, '');
  const phoneMask = value => {
    const raw = digits(value).slice(0,11);
    if (raw.length <= 2) return raw;
    return '(' + raw.slice(0,2) + ') ' + raw.slice(2,raw.length > 10 ? 7 : 6) + (raw.length > (raw.length > 10 ? 7 : 6) ? '-' + raw.slice(raw.length > 10 ? 7 : 6) : '');
  };
  field('clientPhone')?.addEventListener('input', event => event.target.value = phoneMask(event.target.value));
  field('clientCep')?.addEventListener('input', event => { const value=digits(event.target.value).slice(0,8); event.target.value=value.length > 5 ? value.slice(0,5)+'-'+value.slice(5) : value; });
  field('clientEmail')?.addEventListener('blur', event => event.target.value=event.target.value.trim().toLowerCase());
  let dialog;
  function showProgress() {
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.className='order-progress';
      dialog.setAttribute('aria-labelledby','order-progress-title');
      dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
      document.body.append(dialog);
    }
    dialog.innerHTML='<p class="order-kicker">SOLO ATELIÊ</p><h2 id="order-progress-title">Salvando pedido</h2><p id="order-progress-text" role="status">Estamos preparando tudo com carinho. Aguarde a confirmação antes de enviar pelo WhatsApp.</p><div class="order-progress-track" role="progressbar" aria-label="Salvando pedido" aria-valuemin="0" aria-valuemax="100" aria-valuenow="8"><span style="width:8%"></span></div><b class="order-progress-percent">8%</b><div id="order-progress-actions"></div>';
    if (!dialog.open) dialog.showModal();
    let value=8;
    const paint = next => { value=next; dialog.querySelector('[role="progressbar"]').setAttribute('aria-valuenow',String(value));dialog.querySelector('.order-progress-track span').style.width=value+'%';dialog.querySelector('.order-progress-percent').textContent=value+'%'; };
    const timer=setInterval(()=>paint(Math.min(94,value+Math.max(1,Math.round((94-value)*.08)))),200);
    return success => {clearInterval(timer);if(success)paint(100);};
  }
  async function attemptKey(record) {
    const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(record)));
    const fingerprint=Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
    const prior=JSON.parse(localStorage.getItem('solo_order_attempt') || 'null');
    if (prior?.fingerprint===fingerprint && prior.key) return prior.key;
    const key=crypto.randomUUID(); localStorage.setItem('solo_order_attempt',JSON.stringify({fingerprint,key}));return key;
  }
  async function place(record, onSaved) {
    if (busy) return;
    for (const id of ['clientName','clientEmail','clientPhone']) if (!field(id)?.reportValidity()) return;
    record.whatsapp=digits(record.whatsapp); record.cep=digits(record.cep);record.email=record.email.trim().toLowerCase();
    if (!/^\d{10,11}$/.test(record.whatsapp)) { field('clientPhone').setCustomValidity('Informe o WhatsApp com DDD, com 10 ou 11 números.');field('clientPhone').reportValidity();field('clientPhone').setCustomValidity('');return; }
    if (!record.entrega || record.entrega==='entrega' && (!record.endereco.trim() || !/^\d{8}$/.test(record.cep))) { alert('Selecione a forma de entrega e, para delivery, informe endereço e CEP completos.');return; }
    busy=true; const finish=showProgress();
    try {
      const idempotency_key=await attemptKey(record);
      const response=await fetch(window.SOLO_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'placeOrder',record,idempotency_key})});
      const result=await response.json(); if(!result.ok)throw Error(result.message || 'Não foi possível salvar seu pedido.');
      finish(true); localStorage.removeItem('solo_order_attempt'); onSaved?.(result.data);
      field('order-progress-title').textContent='Pedido salvo com carinho!';
      field('order-progress-text').textContent='Seu pedido '+result.data.numero+' foi registrado. Agora envie os detalhes para a loja no WhatsApp para confirmar a encomenda e o frete.';
      const actions=field('order-progress-actions');
      const link=document.createElement('a');link.className='order-action';link.href=result.data.whatsapp_url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Enviar pedido pelo WhatsApp';actions.append(link);
      const history=document.createElement('a');history.href='login.html?acesso=cliente';history.textContent='Acessar meus pedidos';actions.append(history);
      const close=document.createElement('button');close.type='button';close.textContent='Continuar no site';close.addEventListener('click',()=>dialog.close());actions.append(close);
      window.open(result.data.whatsapp_url,'_blank','noopener,noreferrer');
    } catch(error) {
      finish(false);field('order-progress-title').textContent='Vamos tentar novamente?';
      field('order-progress-text').textContent=(error.message || 'Não conseguimos confirmar a gravação.')+' Seu carrinho foi mantido. Tente de novo; a mesma tentativa não duplica o pedido.';
      const button=document.createElement('button');button.type='button';button.className='order-action';button.textContent='Voltar ao pedido';button.addEventListener('click',()=>dialog.close());field('order-progress-actions').append(button);
    } finally {busy=false;}
  }
  window.SoloCheckout={place};
})();
