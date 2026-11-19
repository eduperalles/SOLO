(() => {
  const form=document.querySelector('#customer-login-form'),identifier=document.querySelector('#customer-identifier'),notice=document.querySelector('#customer-notice'),requestButton=document.querySelector('#customer-request'),code=document.querySelector('#customer-code'),verify=document.querySelector('#customer-verify');
  let cooldown;
  function mode(customer) {
    document.querySelector('#login-form').hidden=customer;form.hidden=!customer;
    document.querySelector('#mode-customer').setAttribute('aria-selected',String(customer));document.querySelector('#mode-team').setAttribute('aria-selected',String(!customer));
    document.querySelector('#login-title').textContent=customer?'Meus pedidos':'Acesse o painel';document.querySelector('#login-description').textContent=customer?'Consulte suas encomendas com segurança.':'Entre com sua conta da equipe SOLO.';
  }
  document.querySelector('#mode-customer').addEventListener('click',()=>mode(true));document.querySelector('#mode-team').addEventListener('click',()=>mode(false));mode(new URLSearchParams(location.search).get('acesso')!=='equipe');
  code.addEventListener('input',()=>code.value=code.value.replace(/\D/g,'').slice(0,6));
  code.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();verify.click();}});
  async function api(action,payload) {
    const response=await fetch(window.SOLO_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})});const result=await response.json();if(!result.ok)throw Error(result.message||'Não foi possível conectar.');return result.data;
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!identifier.reportValidity()||requestButton.disabled)return;
    requestButton.disabled=true;notice.textContent='Solicitando código…';
    try {
      const result=await api('requestCustomerCode',{identifier:identifier.value.trim()});notice.textContent=result.message;identifier.readOnly=true;document.querySelector('#customer-code-area').hidden=false;code.focus();
      let remaining=60;requestButton.textContent='Reenviar em '+remaining+'s';clearInterval(cooldown);cooldown=setInterval(()=>{remaining--;requestButton.textContent=remaining>0?'Reenviar em '+remaining+'s':'Reenviar código';if(remaining<=0){clearInterval(cooldown);requestButton.disabled=false;}},1000);
    }catch(error){notice.textContent=error.message;requestButton.disabled=false;}
  });
  verify.addEventListener('click',async()=>{
    code.required=true;if(verify.disabled||!code.reportValidity())return;verify.disabled=true;notice.textContent='Confirmando seu acesso…';
    try {const result=await api('verifyCustomerCode',{identifier:identifier.value.trim(),code:code.value});sessionStorage.setItem('solo_customer_session',result.token);location.assign('cliente/pedidos.html');}catch(error){notice.textContent=error.message;}finally{verify.disabled=false;}
  });
  document.querySelector('#customer-change').addEventListener('click',()=>{clearInterval(cooldown);identifier.readOnly=false;code.required=false;code.value='';document.querySelector('#customer-code-area').hidden=true;requestButton.disabled=false;requestButton.textContent='Receber código por e-mail';notice.textContent='';identifier.focus();});
})();
