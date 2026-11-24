(() => {
  const tools = window.SoloKitTools;
  const filterKits = (rows,query='') => {const text=String(query).trim().toLocaleLowerCase('pt-BR');return rows.filter(kit=>`${kit.titulo} ${kit.descricao}`.toLocaleLowerCase('pt-BR').includes(text));};
  let exportsPromise;
  function loadExports() {
    if(window.SoloKitReports)return Promise.resolve(window.SoloKitReports);
    if(!exportsPromise)exportsPromise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='../assets/kit-reports.js?v=20261124-kit-exports';script.onload=()=>resolve(window.SoloKitReports);script.onerror=()=>{exportsPromise=null;script.remove();reject(Error('Não foi possível carregar a exportação dos kits. Tente novamente.'));};document.head.append(script);});
    return exportsPromise;
  }
  const number = value => Number(value).toLocaleString('pt-BR',{maximumFractionDigits:3});
  async function mount({api,workspace,toast,escapeHtml:e,money,readAndResizeImage,isActive}) {
    let selectedProductId='';
    let kits=[], products=[], editing=null, items=[], photo='', removePhoto=false, photoBusy=false, saving=false;
    workspace.innerHTML='<div class="workspace-state">Carregando kits e produtos…</div>';
    try {
      [kits,products]=await Promise.all([api('listKits'),api('listKitProducts')]);
      if (!isActive()) return;
    } catch(error) { if(isActive()) workspace.innerHTML=`<div class="workspace-state">${e(error.message)}</div>`; return; }
    const draft = () => { const form=workspace.querySelector('#kit-form'); return form ? {titulo:form.elements.titulo.value,descricao:form.elements.descricao.value} : {}; };
    function composition() {
      workspace.querySelector('#kit-picker').value=products.find(p=>p.id===selectedProductId)?.nome || '';
      workspace.querySelector('#kit-lines').innerHTML=items.length ? items.map((item,i)=>{
        const p=products.find(p=>p.id===item.produto_id);
        if(!p) return `<div class="kit-line"><b>Produto indisponível: ${e(item.nome || item.produto_id)}</b><button type="button" class="tiny-button danger" data-kit-remove="${i}">Remover</button></div>`;
        const unit=item.unidade_medida || p.unidade_medida || 'un';
        return `<div class="kit-line" data-kit-line="${i}"><div class="kit-line-name"><b>${e(p.nome)}</b><small>Referência: ${number(p.quantidade || 1)} ${e(p.unidade_medida || 'un')} · Custo ${money(p.preco_custo)} · Venda ${money(p.preco_venda)}</small>${p.status !== 'ativo' ? '<small class="kit-error">Produto inativo. Remova ou reative antes de salvar.</small>' : ''}</div><div class="field"><label for="kit-q-${i}">Quantidade no kit</label><input id="kit-q-${i}" type="number" min="0.001" max="1000000" step="0.001" value="${e(item.quantidade)}" data-kit-quantity="${i}" required></div><div class="field"><label for="kit-u-${i}">Unidade</label><select id="kit-u-${i}" data-kit-unit="${i}">${tools.compatible(p.unidade_medida).includes(unit) ? '' : '<option value="" selected disabled>Selecione a unidade atual</option>'}${tools.unitOptions(unit,tools.compatible(p.unidade_medida))}</select></div><div class="kit-line-values"><small>Custo / venda no kit</small><strong id="kit-values-${i}"></strong></div><button type="button" class="tiny-button danger" data-kit-remove="${i}" aria-label="Remover ${e(p.nome)}">Remover</button></div>`;
      }).join('') : '<div class="empty">Adicione os produtos que compõem este kit.</div>';
      workspace.querySelectorAll('[data-kit-quantity]').forEach(input=>input.addEventListener('input',()=>{items[Number(input.dataset.kitQuantity)].quantidade=input.value; totals();}));
      workspace.querySelectorAll('[data-kit-unit]').forEach(input=>input.addEventListener('change',()=>{items[Number(input.dataset.kitUnit)].unidade_medida=input.value; totals();}));
      workspace.querySelectorAll('[data-kit-remove]').forEach(button=>button.addEventListener('click',()=>{items.splice(Number(button.dataset.kitRemove),1);composition();}));
      totals();
    }
    function openProductPicker() {
      const dialog=document.createElement('dialog');dialog.className='user-picker';dialog.setAttribute('aria-labelledby','kit-product-picker-title');
      dialog.innerHTML=`<div class="card-head"><h2 id="kit-product-picker-title">Selecionar produto do kit</h2><button type="button" class="tiny-button" id="kit-picker-close">Fechar</button></div><div class="field"><label for="kit-product-search">Buscar por produto, categoria ou fornecedor</label><input id="kit-product-search" type="search" placeholder="Digite para buscar…"></div><div class="picker-results" id="kit-product-results"></div>`;
      document.body.append(dialog);
      const search=dialog.querySelector('#kit-product-search'),results=dialog.querySelector('#kit-product-results');
      const render=()=>{const query=search.value.trim().toLocaleLowerCase('pt-BR');const found=products.filter(p=>p.status==='ativo' && !items.some(item=>item.produto_id===p.id) && `${p.nome} ${p.categoria} ${p.fornecedor_nome}`.toLocaleLowerCase('pt-BR').includes(query));results.innerHTML=found.length ? found.map(p=>`<button type="button" class="picker-user" data-kit-pick="${e(p.id)}"><span><b>${e(p.nome)}</b><small>${number(p.quantidade || 1)} ${e(p.unidade_medida || 'un')} · ${e(p.fornecedor_nome || p.categoria || '')}</small><small>Custo ${money(p.preco_custo)} · Venda ${money(p.preco_venda)}</small></span><span class="badge">Selecionar</span></button>`).join('') : '<div class="empty">Nenhum produto disponível. Produtos já adicionados não se repetem.</div>';};
      search.oninput=render;results.onclick=event=>{const button=event.target.closest('[data-kit-pick]');if(!button)return;selectedProductId=button.dataset.kitPick;workspace.querySelector('#kit-picker').value=products.find(p=>p.id===selectedProductId).nome;dialog.close();workspace.querySelector('#kit-add-product').focus();};
      dialog.querySelector('#kit-picker-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});render();dialog.showModal();search.focus();
    }
    function totals() {
      if (!workspace.querySelector('#kit-calculation-error')) return;
      let calc={preco_custo:0,preco_venda:0,lucro:0,margem_lucro:0,itens:[]},error='';
      try {if(items.length) calc=tools.calculate(items,products);} catch(err){error=err.message;}
      workspace.querySelector('#kit-calculation-error').textContent=error;
      ['preco_custo','preco_venda','lucro','margem_lucro'].forEach(key=>{workspace.querySelector('#kit-total-'+key).textContent=key === 'margem_lucro' ? number(calc[key])+'%' : money(calc[key]);});
      calc.itens.forEach((line,i)=>{const node=workspace.querySelector('#kit-values-'+i);if(node)node.textContent=money(line.custo)+' / '+money(line.venda);});
      workspace.querySelector('#kit-save').disabled=!!error || !items.length || photoBusy;
    }
    function editor(values={}) {
      workspace.innerHTML=`<div class="users-tabs" role="tablist" aria-label="Cadastro de kits"><button type="button" class="users-tab active" role="tab" aria-selected="true" id="kit-editor-tab">Cadastro / edição</button><button type="button" class="users-tab" role="tab" aria-selected="false" id="kit-records-tab">Registros <span>${kits.length}</span></button></div>
      <section class="content-card"><div class="card-head"><div><h2>${editing ? 'Editar kit' : 'Cadastrar kit'}</h2><p>Monte a composição e confira o custo, a venda e a margem proporcionais às quantidades.</p></div></div>
      <form class="editor" id="kit-form"><div class="field full"><label for="kit-title">Título do kit *</label><input id="kit-title" name="titulo" minlength="2" maxlength="180" value="${e(values.titulo || '')}" placeholder="Ex.: Kit Café com Afeto" required></div>
      <div class="field full"><label for="kit-description">Descrição e orientações de montagem</label><textarea id="kit-description" name="descricao" maxlength="4000" rows="3" placeholder="Descreva a apresentação e os cuidados para montar este kit.">${e(values.descricao || '')}</textarea></div>
      <div class="field full"><label for="kit-photo">Foto do kit</label><div class="product-photo-row"><div id="kit-photo-preview">${photo || editing?.foto_url ? `<img src="${e(photo || editing.foto_url)}" alt="Foto do kit" class="kit-photo-preview">` : '<div class="kit-photo-placeholder">▣</div>'}</div><div><input type="file" id="kit-photo" accept="image/jpeg,image/png,image/webp"><button type="button" id="kit-photo-remove" class="tiny-button danger">Remover foto</button><small class="helper">Imagem salva no Google Drive, na pasta de fotos do projeto.</small></div></div></div>
      <div class="field full"><label for="kit-picker">Produtos que compõem o kit *</label><div class="kit-add"><div class="settings-selector"><input id="kit-picker" placeholder="Clique na lupa para selecionar um produto" readonly><button type="button" class="button" id="kit-find-product" aria-label="Buscar produto"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg></button></div><button type="button" class="button" id="kit-add-product">Adicionar produto</button></div><small class="helper">Use as quantidades da montagem. Ex.: produto cadastrado por 1 kg, kit com 100 g = 10% do preço.</small></div>
      <div class="field full" id="kit-lines"></div><div id="kit-calculation-error" class="field full kit-error" role="status"></div>
      <div class="field full"><div class="kit-totals">${[['preco_custo','Custo total'],['preco_venda','Venda total'],['lucro','Lucro bruto'],['margem_lucro','Margem de lucro']].map(([key,label])=>`<div class="dash-metric-pill"><span>${label}</span><strong id="kit-total-${key}"></strong></div>`).join('')}</div><small class="helper">Margem = (venda − custo) ÷ venda × 100. Frete, impostos e despesas operacionais não estão incluídos. Ao salvar, os preços atuais dos produtos ficam registrados na ficha do kit.</small></div>
      <div class="form-actions"><button type="button" class="button button-secondary" id="kit-clear">Novo kit</button><button class="button" type="submit" id="kit-save">Salvar kit</button></div></form></section>`;
      workspace.querySelector('#kit-records-tab').onclick=()=>{if(photoBusy)return;const current=draft(); records(()=>editor(current));};
      workspace.querySelector('#kit-clear').onclick=()=>{if(photoBusy)return;editing=null;items=[];photo='';removePhoto=false;editor();};
      workspace.querySelector('#kit-find-product').onclick=openProductPicker;
      workspace.querySelector('#kit-add-product').onclick=()=>{
        const p=products.find(p=>p.id === selectedProductId);
        if(!p) {toast('Selecione um produto.',true);return;}
        items.push({produto_id:p.id,quantidade:Number(p.quantidade || 1),unidade_medida:p.unidade_medida || 'un'}); selectedProductId='';composition();
      };
      workspace.querySelector('#kit-photo').onchange=async event=>{
        const file=event.target.files?.[0];if(!file)return;
        photoBusy=true;totals();
        try {photo=await readAndResizeImage(file);removePhoto=false; if(isActive())workspace.querySelector('#kit-photo-preview').innerHTML=`<img src="${e(photo)}" alt="Foto do kit" class="kit-photo-preview">`;}
        catch(error){toast(error.message,true);}finally{photoBusy=false;if(isActive())totals();}
      };
      workspace.querySelector('#kit-photo-remove').onclick=()=>{photo='';removePhoto=true;if(editing)editing={...editing,foto_url:''};workspace.querySelector('#kit-photo').value='';workspace.querySelector('#kit-photo-preview').innerHTML='<div class="kit-photo-placeholder">▣</div>';};
      workspace.querySelector('#kit-form').onsubmit=async event=>{
        event.preventDefault();if(saving || photoBusy || !event.target.reportValidity())return;
        try {
          tools.calculate(items,products);
          saving=true;
          workspace.querySelector('#kit-save').disabled=true;
          const record={...draft(),id:editing?.id || '',expected_updated_at:editing?.atualizado_em || '',itens:items.map(({produto_id,quantidade,unidade_medida})=>({produto_id,quantidade,unidade_medida})),remove_photo:removePhoto};
          if(photo)record.foto_data_url=photo;
          const saved=await api(editing ? 'updateKit' : 'createKit',{record});
          const index=kits.findIndex(kit=>kit.id===saved.id);if(index<0)kits.push(saved);else kits[index]=saved;
          editing=null;items=[];photo='';removePhoto=false;
          if(isActive()){records();toast('Kit salvo com sucesso.');}
        }catch(error){toast(error.message,true);if(isActive() && workspace.querySelector('#kit-save'))totals();}finally{saving=false;}
      };
      composition();
    }
    function records(back=()=>editor()) {
      workspace.innerHTML=`<div class="users-tabs" role="tablist" aria-label="Cadastro de kits"><button type="button" class="users-tab" role="tab" aria-selected="false" id="kit-back">Cadastro / edição</button><button type="button" class="users-tab active" role="tab" aria-selected="true">Registros <span>${kits.length}</span></button></div><section class="content-card"><div class="card-head"><div><h2>Kits cadastrados</h2><p>Fichas de montagem com composição e preços da última gravação.</p></div><div class="toolbar"><div class="product-export-actions"><button type="button" class="tiny-button" id="kits-print">▤ Imprimir / PDF</button><button type="button" class="tiny-button" id="kits-excel">▦ Exportar Excel (.xlsx)</button><input type="search" id="kit-search" aria-label="Buscar kits" placeholder="Buscar kits…"></div></div></div><div id="kit-records"></div></section>`;
      workspace.querySelector('#kit-back').onclick=back;
      for(const [id,kind] of [['kits-print','print'],['kits-excel','xlsx']])workspace.querySelector('#'+id).onclick=async event=>{
        const button=event.currentTarget;button.disabled=true;
        try{const query=workspace.querySelector('#kit-search').value.trim(),found=filterKits(kits,query),reports=await loadExports();await reports[kind](found,{filter:query});}
        catch(error){toast(error.message,true);}finally{button.disabled=false;}
      };
      const render=()=>{
        const query=workspace.querySelector('#kit-search').value.trim().toLocaleLowerCase('pt-BR');
        const found=filterKits(kits,query);
        workspace.querySelector('#kit-records').innerHTML=found.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Kit</th><th>Composição</th><th>Custo total</th><th>Venda total</th><th>Margem</th><th>Ações</th></tr></thead><tbody>${found.map(kit=>`<tr><td><div class="kit-record-title">${kit.foto_url ? `<img src="${e(kit.foto_url)}" alt="" class="table-product-thumb">` : ''}<b>${e(kit.titulo)}</b></div></td><td>${kit.itens.map(item=>`${number(item.quantidade)} ${e(item.unidade_medida)} · ${e(item.nome)}`).join('<br>')}</td><td>${money(kit.preco_custo)}</td><td><b>${money(kit.preco_venda)}</b></td><td>${number(kit.margem_lucro)}%</td><td><div class="row-actions"><button class="tiny-button" data-kit-print="${e(kit.id)}">Imprimir kit</button><button class="tiny-button" data-kit-edit="${e(kit.id)}">Editar</button><button class="tiny-button danger" data-kit-delete="${e(kit.id)}">Excluir</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhum kit encontrado.</div>';
        workspace.querySelectorAll('[data-kit-edit]').forEach(button=>button.onclick=()=>{
          editing=kits.find(kit=>kit.id===button.dataset.kitEdit);
          items=editing.itens.map(item=>({...item}));photo='';removePhoto=false;editor(editing);
        });
        workspace.querySelectorAll('[data-kit-print]').forEach(button=>button.onclick=()=>showPrint(kits.find(kit=>kit.id===button.dataset.kitPrint),{e,money}));
        workspace.querySelectorAll('[data-kit-delete]').forEach(button=>button.onclick=async()=>{
          const kit=kits.find(kit=>kit.id===button.dataset.kitDelete);
          if(!confirm(`Excluir o kit "${kit.titulo}"?`))return;
          button.disabled=true;
          try{await api('deleteKit',{id:kit.id,version:kit.atualizado_em});kits=kits.filter(item=>item.id!==kit.id);if(isActive())records();toast('Kit excluído.');}catch(error){button.disabled=false;toast(error.message,true);}
        });
      };
      workspace.querySelector('#kit-search').oninput=render;render();
    }
    editor();
  }
  function reportHtml(kit,{e,money}) {
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ficha de montagem — ${e(kit.titulo)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#eeebe5;color:#252321;font:14px Arial,sans-serif}.sheet{max-width:1040px;margin:24px auto;background:white;padding:44px}.brand{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #b49a60;padding-bottom:18px}.brand strong{font:32px Georgia,serif;letter-spacing:6px}.eyebrow{color:#8d7541;text-transform:uppercase;font-size:10px;letter-spacing:2px}.hero{display:flex;gap:30px;align-items:center;padding:30px 0}.hero img{width:190px;height:165px;object-fit:cover;border-radius:8px}h1{font:34px Georgia,serif;margin:10px 0}p{line-height:1.6;white-space:pre-wrap}.meta{font-size:11px;color:#756e64}h2{font:23px Georgia,serif;margin-top:24px}table{width:100%;border-collapse:collapse;font-size:12px}thead{display:table-header-group}th{text-align:left;background:#f3f0e9;color:#73603a;font-size:10px;text-transform:uppercase;padding:12px 9px}td{padding:13px 9px;border-bottom:1px solid #e9e5dd;vertical-align:top}tr{break-inside:avoid}td small{display:block;color:#82796a;font-size:10px;margin-top:5px}.num{text-align:right;white-space:nowrap}.totals{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:26px 0}.total{padding:18px 12px;border:1px solid #dfd6c4;border-radius:6px}.total span{display:block;font-size:10px;text-transform:uppercase;color:#82734f;margin-bottom:9px}.total b{font-size:20px}.footer{margin-top:22px;border-top:1px solid #ddd4c3;padding-top:14px;color:#756d62;font-size:10px;line-height:1.6}@page{size:A4 landscape;margin:12mm}@media print{body{background:white}.sheet{margin:0;padding:0;max-width:none}.hero img{width:145px;height:120px}h1{font-size:28px}.totals,.footer{break-inside:avoid}th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}@media(max-width:650px){.sheet{padding:20px;margin:0}.hero{align-items:flex-start;gap:16px}.hero img{width:90px;height:90px}h1{font-size:24px}.totals{grid-template-columns:1fr 1fr}table{font-size:10px}td,th{padding:8px 4px}.brand strong{font-size:24px}}
    </style></head><body><main class="sheet"><header class="brand"><strong>SOLO</strong><span class="eyebrow">Ateliê artesanal · Ficha de montagem</span></header><section class="hero">${kit.foto_url ? `<img src="${e(kit.foto_url)}" alt="${e(kit.titulo)}">` : ''}<div><span class="eyebrow">Composição do kit</span><h1>${e(kit.titulo)}</h1><p>${e(kit.descricao || 'Monte o kit conforme as quantidades relacionadas abaixo.')}</p><div class="meta">Última gravação: ${e(new Date(kit.atualizado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))}</div></div></section><h2>Produtos e quantidades de montagem</h2><table><thead><tr><th>Produto</th><th>Qtd. no kit</th><th>Referência de preço</th><th class="num">Custo referência</th><th class="num">Venda referência</th><th class="num">Custo no kit</th><th class="num">Venda no kit</th></tr></thead><tbody>${kit.itens.map(item=>`<tr><td><b>${e(item.nome)}</b></td><td>${number(item.quantidade)} ${e(item.unidade_medida)}</td><td>${number(item.quantidade_base)} ${e(item.unidade_base)}</td><td class="num">${money(item.preco_custo)}</td><td class="num">${money(item.preco_venda)}</td><td class="num">${money(item.custo)}</td><td class="num">${money(item.venda)}</td></tr>`).join('')}</tbody></table><section class="totals">${[['Custo total',money(kit.preco_custo)],['Venda total',money(kit.preco_venda)],['Lucro bruto',money(kit.lucro)],['Margem de lucro',number(kit.margem_lucro)+'%']].map(([label,value])=>`<div class="total"><span>${label}</span><b>${value}</b></div>`).join('')}</section><footer class="footer">Ficha de montagem de 1 kit · ${kit.itens.length} produtos · Valores proporcionais à quantidade utilizada.<br>Margem = (venda − custo) ÷ venda × 100. Frete, impostos e despesas operacionais não incluídos.<br>Composição e preços registrados na última gravação do kit. Para atualizar os preços, edite e salve novamente.</footer></main></body></html>`;
  }
  function showPrint(kit,format) {
    const dialog=document.createElement('dialog');dialog.className='kit-print-dialog';
    dialog.setAttribute('aria-label','Ficha de montagem do kit');
    dialog.innerHTML='<div class="kit-print-toolbar"><b>Ficha de montagem</b><div><button type="button" class="button" id="kit-print-confirm" disabled>Imprimir / Salvar PDF</button> <button type="button" class="tiny-button" id="kit-print-close">Fechar</button></div></div><iframe title="Relatório do kit"></iframe>';
    document.body.append(dialog);
    const frame=dialog.querySelector('iframe'),print=dialog.querySelector('#kit-print-confirm');
    frame.onload=async()=>{const images=[...frame.contentDocument.images];await Promise.all(images.map(image=>image.complete ? Promise.resolve() : new Promise(resolve=>{image.onload=image.onerror=resolve;setTimeout(resolve,6000);})));print.disabled=false;};
    frame.srcdoc=reportHtml(kit,format);
    print.onclick=()=>{frame.contentWindow.focus();frame.contentWindow.print();};
    dialog.querySelector('#kit-print-close').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  window.SoloKits={mount,reportHtml,filterKits};
})();
