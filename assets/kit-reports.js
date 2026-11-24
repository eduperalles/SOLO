(() => {
  const base=new URL('.',document.currentScript.src);
  const e=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);
  let library;
  function excel() {
    if(window.ExcelJS)return Promise.resolve(window.ExcelJS);
    if(!library)library=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=new URL('vendor/exceljs-4.4.0.min.js',base).href;script.onload=()=>resolve(window.ExcelJS);script.onerror=()=>{library=null;script.remove();reject(Error('Não foi possível carregar o exportador Excel. Tente novamente.'));};document.head.append(script);});
    return library;
  }
  function printHtml(kits,{filter='',now=new Date()}={}) {
    const format={e,money};
    const sample=window.SoloKits.reportHtml(kits[0] || {titulo:'Nenhum kit encontrado',descricao:'Nenhum kit corresponde à busca.',itens:[],atualizado_em:now.toISOString(),preco_custo:0,preco_venda:0,lucro:0,margem_lucro:0},format);
    const css=sample.match(/<style>([\s\S]*?)<\/style>/)[1];
    const pages=kits.map((kit,index)=>`<section class="kit-export-page"><div class="export-context">${e(filter ? 'Busca: '+filter : 'Todos os kits')} · Ficha ${index+1} de ${kits.length}</div>${window.SoloKits.reportHtml(kit,format).match(/<main[\s\S]*?<\/main>/)[0]}</section>`).join('');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SOLO — Kits e fichas de montagem</title><style>${css}.kit-export-page{break-after:page}.kit-export-page:last-child{break-after:auto}.export-context{max-width:1040px;margin:20px auto 0;padding:0 44px;color:#82734f;font:11px Arial,sans-serif}@media print{.export-context{margin:0 0 12px;padding:0}.sheet{margin:0}.kit-export-page+.kit-export-page{padding-top:0}}</style></head><body>${pages || '<main class="sheet"><header class="brand"><strong>SOLO</strong><span class="eyebrow">Kits</span></header><h1>Nenhum kit encontrado</h1><p>'+e(filter ? 'Busca: '+filter : 'Nenhum kit cadastrado.')+'</p></main>'}</body></html>`;
  }
  function print(kits,options) {
    const dialog=document.createElement('dialog');dialog.className='export-dialog';dialog.setAttribute('aria-label','Relatório de kits');
    dialog.innerHTML='<div class="export-toolbar"><b>Kits e fichas de montagem</b><div><button type="button" class="button" data-kit-export-print disabled>Imprimir / Salvar PDF</button> <button type="button" class="tiny-button" data-kit-export-close>Fechar</button></div></div><iframe title="Kits para impressão"></iframe>';
    document.body.append(dialog);const frame=dialog.querySelector('iframe'),button=dialog.querySelector('[data-kit-export-print]');
    frame.onload=async()=>{await Promise.all([...frame.contentDocument.images].map(image=>image.complete ? Promise.resolve() : new Promise(resolve=>{image.onload=image.onerror=resolve;setTimeout(resolve,6000);})));button.disabled=false;};frame.srcdoc=printHtml(kits,options);
    button.onclick=()=>{frame.contentWindow.focus();frame.contentWindow.print();};dialog.querySelector('[data-kit-export-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  const currency='"R$" #,##0.00;[Red]("R$" #,##0.00)';
  function sheetTemplate(book,name,headers,widths,{filter,now}) {
    const sheet=book.addWorksheet(name,{views:[{state:'frozen',ySplit:7,xSplit:1,showGridLines:false}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
    sheet.columns=widths.map(width=>({width}));const last=String.fromCharCode(64+headers.length);
    sheet.mergeCells(`A1:${last}1`);sheet.getCell('A1').value='SOLO  |  '+(name==='Kits' ? 'KITS E FICHAS DE MONTAGEM' : 'COMPOSIÇÃO DOS KITS');sheet.getCell('A1').font={name:'Aptos Display',size:22,bold:true,color:{argb:'FFFFFFFF'}};sheet.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF28241E'}};sheet.getCell('A1').alignment={vertical:'middle',indent:1};sheet.getRow(1).height=49;
    sheet.mergeCells(`A2:${last}2`);sheet.getCell('A2').value='Ateliê artesanal · Preços e composição da última gravação de cada kit';sheet.getCell('A2').font={name:'Aptos',size:12,color:{argb:'FF8D7541'}};sheet.getRow(2).height=25;
    sheet.mergeCells(`A3:${last}3`);sheet.getCell('A3').value=`Emitido em ${now.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})} · ${filter ? 'Busca: '+filter : 'Todos os kits'} · Fonte: cadastro de kits SOLO`;sheet.getCell('A3').font={name:'Aptos',size:10,color:{argb:'FF776F63'}};sheet.getRow(3).height=24;
    sheet.mergeCells(`A5:${last}5`);sheet.getCell('A5').fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF2ECE0'}};sheet.getCell('A5').font={name:'Aptos',size:13,bold:true,color:{argb:'FF776039'}};sheet.getCell('A5').alignment={vertical:'middle',indent:1};sheet.getRow(5).height=34;
    sheet.getRow(7).values=headers;sheet.getRow(7).height=38;sheet.getRow(7).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF9A814C'}};cell.font={name:'Aptos',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={vertical:'middle',wrapText:true};});
    sheet.headerFooter.oddFooter='&LSOLO Ateliê&R Página &P de &N';sheet.pageSetup.printTitlesRow='7:7';
    return sheet;
  }
  function styleRow(sheet,r,currencies=[],percentages=[]) {
    sheet.getRow(r).height=38;sheet.getRow(r).eachCell(cell=>{cell.font={name:'Aptos',size:11,color:{argb:'FF28241E'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:r%2 ? 'FFF7F4ED' : 'FFFFFFFF'}};cell.alignment={vertical:'middle',wrapText:true};cell.border={bottom:{style:'hair',color:{argb:'FFE2DCCF'}}};});
    currencies.forEach(col=>{sheet.getCell(col+r).numFmt=currency;sheet.getCell(col+r).alignment={horizontal:'right',vertical:'middle'};});percentages.forEach(col=>sheet.getCell(col+r).numFmt='0.00%;[Red](0.00%)');
  }
  function finishSheet(sheet,last,end,note) {
    sheet.autoFilter={from:'A7',to:`${last}${Math.max(7,end)}`};const r=Math.max(7,end)+3;sheet.mergeCells(`A${r}:${last}${r}`);sheet.getCell('A'+r).value=note;sheet.getCell('A'+r).font={name:'Aptos',size:10,color:{argb:'FF776F63'}};sheet.getCell('A'+r).alignment={wrapText:true};sheet.getRow(r).height=35;sheet.pageSetup.printArea=`A1:${last}${r}`;
  }
  function buildWorkbook(ExcelJS,kits,{filter='',now=new Date()}={}) {
    const book=new ExcelJS.Workbook();book.creator='SOLO Ateliê';book.created=now;book.modified=now;book.calcProperties.fullCalcOnLoad=true;
    const summary=sheetTemplate(book,'Kits',['Kit','Descrição','Produtos','Custo total (R$)','Venda total (R$)','Lucro bruto (R$)','Margem (%)','Última gravação'],[34,55,12,20,20,20,16,25],{filter,now});
    const detail=sheetTemplate(book,'Composição',['Kit','Produto','Qtd. no kit','Unidade','Qtd. referência','Unidade referência','Custo referência (R$)','Venda referência (R$)','Proporção utilizada','Custo no kit (R$)','Venda no kit (R$)','Lucro bruto (R$)','Margem (%)'],[32,32,15,12,17,16,20,20,20,20,20,20,16],{filter,now});
    const lines=kits.reduce((sum,kit)=>sum+kit.itens.length,0);summary.getCell('A5').value=`KITS   ${kits.length}       |       ITENS NA COMPOSIÇÃO   ${lines}`;detail.getCell('A5').value=`COMPOSIÇÃO DE ${kits.length} KITS       |       ${lines} ITENS`;
    const scale={g:1,kg:1000,mg:0.001,l:1000,ml:1,un:1,dz:12,pct:1,cx:1,m:100,cm:1};let r=8;
    kits.forEach((kit,index)=>{
      const first=r;
      kit.itens.forEach(item=>{
        const ratio=Number(item.quantidade)*scale[item.unidade_medida]/(Number(item.quantidade_base)*scale[item.unidade_base]);const profit=Math.round((item.venda-item.custo)*100)/100;
        detail.getRow(r).values=[String(kit.titulo),String(item.nome),Number(item.quantidade),String(item.unidade_medida),Number(item.quantidade_base),String(item.unidade_base),Number(item.preco_custo),Number(item.preco_venda),{formula:`C${r}*${scale[item.unidade_medida]}/(E${r}*${scale[item.unidade_base]})`,result:ratio},{formula:`ROUND(G${r}*I${r},2)`,result:Number(item.custo)},{formula:`ROUND(H${r}*I${r},2)`,result:Number(item.venda)},{formula:`ROUND(K${r}-J${r},2)`,result:profit},{formula:`IFERROR(L${r}/K${r},0)`,result:item.venda ? profit/item.venda : 0}];
        styleRow(detail,r,['G','H','J','K','L'],['M']);for(const col of ['C','E','I'])detail.getCell(col+r).numFmt='0.#####';r++;
      });
      const s=index+8,last=r-1,hasItems=last>=first;
      summary.getRow(s).values=[String(kit.titulo),String(kit.descricao || ''),kit.itens.length,{formula:hasItems ? `SUM('Composição'!J${first}:J${last})` : '0',result:Number(kit.preco_custo)},{formula:hasItems ? `SUM('Composição'!K${first}:K${last})` : '0',result:Number(kit.preco_venda)},{formula:`ROUND(E${s}-D${s},2)`,result:Number(kit.lucro)},{formula:`IFERROR(F${s}/E${s},0)`,result:kit.preco_venda ? Number(kit.lucro)/Number(kit.preco_venda) : 0},new Date(kit.atualizado_em).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})];
      styleRow(summary,s,['D','E','F'],['G']);summary.getRow(s).height=Math.max(38,Math.min(120,Math.ceil(String(kit.descricao || '').length/60)*15));
    });
    finishSheet(summary,'H',kits.length+7,'Valores para montar uma unidade de cada kit. Consulte a aba Composição para quantidades e preços de referência. Frete, impostos e despesas operacionais não incluídos.');
    finishSheet(detail,'M',r-1,'Proporção utilizada = quantidade do kit ÷ quantidade de referência, após conversão de unidades compatíveis. Os preços são os registrados na última gravação do kit.');
    return book;
  }
  async function xlsx(kits,options={}) {
    const ExcelJS=await excel(),book=buildWorkbook(ExcelJS,kits,options),buffer=await book.xlsx.writeBuffer();const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='SOLO-Kits-'+new Date().toISOString().slice(0,10)+'.xlsx';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  window.SoloKitReports={print,printHtml,xlsx,buildWorkbook};
})();
