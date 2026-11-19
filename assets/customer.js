(async () => {
  const token=sessionStorage.getItem('solo_customer_session');
  const leave=()=>{sessionStorage.removeItem('solo_customer_session');location.replace('../login.html?acesso=cliente');};
  if(!token)return leave();
  async function api(action){const response=await fetch(window.SOLO_API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token})});const result=await response.json();if(!result.ok)throw Error(result.message||'Falha ao carregar seus pedidos.');return result.data;}
  document.querySelector('#customer-logout').addEventListener('click',async()=>{try{await api('customerLogout');}catch(_){}leave();});
  const finish=window.SoloLoading?.start('Carregando seus pedidos');
  try {const result=await api('customerOrders');document.querySelector('#customer-name').textContent='Olá, '+result.cliente.nome+'.';window.SoloOrderView.render(document.querySelector('#customer-orders'),result.pedidos);await finish?.();}
  catch(error){await finish?.(false);if(/sessão/i.test(error.message))return leave();document.querySelector('#customer-orders').textContent=error.message;}
})();
