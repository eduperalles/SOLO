(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = value => Number(value).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const date = value => new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
  function render(container, orders, options={}) {
    container.innerHTML=`<section class="content-card"><div class="card-head"><div><h2>${options.admin ? 'Pedidos do site' : 'Meus pedidos'}</h2><p>${orders.length} pedidos · Frete e confirmação combinados com a loja.</p></div><div class="toolbar"><input type="search" id="orders-search" aria-label="Buscar pedidos" placeholder="Buscar pedidos…"></div></div><div id="orders-list"></div></section>`;
    const list=container.querySelector('#orders-list');
    const paint = query => {
      const visible=orders.filter(order=>`${order.numero} ${order.nome} ${order.email} ${order.whatsapp} ${order.itens.map(item=>item.nome).join(' ')}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
      list.innerHTML=visible.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Pedido</th>${options.admin?'<th>Cliente</th>':''}<th>Data</th><th>Total</th><th>Pagamento</th><th>Situação</th><th>Ações</th></tr></thead><tbody>${visible.map(order=>`<tr><td><b>${escape(order.numero)}</b></td>${options.admin?`<td>${escape(order.nome)}<small class="order-contact">${escape(order.email)} · ${escape(order.whatsapp)}</small></td>`:''}<td>${escape(date(order.criado_em))}</td><td>${money(order.total)}</td><td><span class="badge ${order.pagamento==='pago'?'':'inactive'}">${order.pagamento==='pago'?'Pago':'Em aberto'}</span></td><td>${order.status==='recebido'?'Aguardando confirmação':order.status==='excluindo'?'Exclusão pendente':'Gravação pendente'}</td><td><button class="tiny-button" type="button" data-order-detail="${escape(order.id)}">Ver pedido</button>${options.admin&&order.status!=='recebido'&&order.status!=='excluindo'?` <button class="tiny-button" type="button" data-order-retry="${escape(order.id)}">Concluir gravação</button>`:''}${options.admin?` <button class="tiny-button danger" type="button" data-order-delete="${escape(order.id)}">Excluir</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Nenhum pedido encontrado.</div>';
    };
    container.querySelector('#orders-search').addEventListener('input',event=>paint(event.target.value.trim()));
    list.addEventListener('click',async event=>{
      const detail=event.target.closest('[data-order-detail]'); const retry=event.target.closest('[data-order-retry]'); const remove=event.target.closest('[data-order-delete]');
      if(retry && options.onRetry){retry.disabled=true;try{await options.onRetry(retry.dataset.orderRetry);}finally{retry.disabled=false;}return;}
      if(remove && options.onDelete){const order=orders.find(item=>item.id===remove.dataset.orderDelete);if(!order)return;remove.disabled=true;try{await options.onDelete(order);}finally{remove.disabled=false;}return;}
      if(!detail)return;
      const order=orders.find(item=>item.id===detail.dataset.orderDetail);if(!order)return;
      const dialog=document.createElement('dialog');dialog.className='order-detail';dialog.setAttribute('aria-labelledby','order-detail-title');
      dialog.innerHTML=`<div class="card-head"><div><h2 id="order-detail-title">${escape(order.numero)}</h2><p>${escape(date(order.criado_em))} · ${order.pagamento==='pago'?'Pago':'Em aberto'}</p></div><button class="tiny-button" type="button">Fechar</button></div><pre class="order-message"></pre>`;
      dialog.querySelector('pre').textContent=order.mensagem;
      dialog.querySelector('button').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
    });
    const initialQuery=String(options.query || '');container.querySelector('#orders-search').value=initialQuery;paint(initialQuery);
  }
  window.SoloOrderView={render};
})();
