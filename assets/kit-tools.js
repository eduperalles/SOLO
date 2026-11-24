(() => {
const MEASURE_UNITS_ = {g:['mass',1],kg:['mass',1000],mg:['mass',0.001],l:['volume',1000],ml:['volume',1],un:['unit',1],dz:['unit',12],pct:['package',1],cx:['box',1],m:['length',100],cm:['length',1]};
function calculateKit_(items, products) {
  if (!Array.isArray(items) || !items.length || items.length > 100) throw Error('Adicione de 1 a 100 produtos ao kit.');
  const seen = new Set();
  const cents = value => Math.round((value + Number.EPSILON)*100);
  const lines = items.map(input => {
    const product = products.find(p=>p.id === String(input.produto_id || ''));
    if (!product || product.status !== 'ativo') throw Error('Produto não encontrado ou inativo. Atualize a composição do kit.');
    if (seen.has(product.id)) throw Error('Produto repetido. Ajuste a quantidade na mesma linha.');
    seen.add(product.id);
    const quantidade = Number(String(input.quantidade ?? '').replace(',','.'));
    const unit = String(input.unidade_medida || product.unidade_medida || 'un');
    const baseUnit = product.unidade_medida || 'un';
    const a = MEASURE_UNITS_[unit], b = MEASURE_UNITS_[baseUnit];
    if (!a || !b || a[0] !== b[0]) throw Error('Unidade incompatível com a quantidade cadastrada do produto.');
    const baseQuantity = Number(product.quantidade || 1);
    if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 1000000 || !Number.isFinite(baseQuantity) || baseQuantity <= 0) throw Error('Quantidade inválida na composição do kit.');
    const factor = quantidade*a[1]/(baseQuantity*b[1]);
    const custo = cents(Number(product.preco_custo)*factor)/100;
    const venda = cents(Number(product.preco_venda)*factor)/100;
    if (![custo,venda].every(Number.isFinite) || Math.max(custo,venda) > 99999999) throw Error('Valor da composição excede o limite.');
    return {produto_id:product.id,nome:product.nome,quantidade,unidade_medida:unit,quantidade_base:baseQuantity,unidade_base:baseUnit,preco_custo:Number(product.preco_custo),preco_venda:Number(product.preco_venda),custo,venda};
  });
  const cost = lines.reduce((sum,item)=>sum+cents(item.custo),0)/100;
  const sale = lines.reduce((sum,item)=>sum+cents(item.venda),0)/100;
  const profit = cents(sale-cost)/100;
  return {itens:lines,preco_custo:cost,preco_venda:sale,lucro:profit,margem_lucro:sale > 0 ? Math.round(profit/sale*10000)/100 : 0};
}

  const labels = {g:'Grama (g)',kg:'Quilo (kg)',mg:'Miligrama (mg)',un:'Unidade (un)',dz:'Dúzia (dz)',l:'Litro (l)',ml:'Mililitro (ml)',pct:'Pacote (pct)',cx:'Caixa (cx)',m:'Metro (m)',cm:'Centímetro (cm)'};
  window.SoloKitTools = {
    calculate:calculateKit_,
    compatible:unit=>Object.keys(labels).filter(key=>MEASURE_UNITS_[key][0] === MEASURE_UNITS_[unit || 'un'][0]),
    unitOptions:(selected='un', allowed=Object.keys(labels))=>allowed.map(key=>`<option value="${key}" ${key === selected ? 'selected' : ''}>${labels[key]}</option>`).join('')
  };
})();
