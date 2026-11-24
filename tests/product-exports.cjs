const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const ExcelJS=require('../assets/vendor/exceljs-4.4.0.min.js');
global.window={};global.document={currentScript:{src:'https://soloatelie.com.br/assets/product-reports.js'}};require('../assets/product-reports.js');const context={window};
const rows=[{nome:'Queijo Brie',categoria:'Queijos',fornecedor_nome:'Fornecedor teste',quantidade:1,unidade_medida:'kg',preco_custo:80,preco_venda:120,status:'ativo',descricao:'Referência por quilo',foto_url:'https://example.invalid/foto.jpg'},{nome:'=HYPERLINK("https://example.invalid")',quantidade:100,unidade_medida:'g',preco_custo:5,preco_venda:10,status:'inativo',descricao:'Descrição <script>não executar</script>'}];
(async()=>{
 const book=context.window.SoloProductReports.buildWorkbook(ExcelJS,rows,{now:new Date('2026-11-24T12:00:00Z')});const buffer=await book.xlsx.writeBuffer();
 fs.writeFileSync('.verification/products-export-fixture.xlsx',buffer);
 const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(buffer);const sheet=loaded.getWorksheet('Produtos');
 assert.equal(sheet.getCell('F8').value,80);assert.equal(sheet.getCell('G8').value,120);assert.equal(sheet.getCell('H8').value.formula,'G8-F8');assert.equal(sheet.getCell('H8').value.result,40);assert.equal(sheet.getCell('I8').value.result,1/3);
 assert.equal(sheet.getCell('A9').value,rows[1].nome);assert.equal(sheet.getCell('A9').type,3);assert.equal(sheet.getCell('I8').numFmt,'0.00%;[Red](0.00%)');assert.equal(sheet.views[0].ySplit,7);assert.ok(sheet.autoFilter);assert.equal(sheet.getCell('A1').fill.fgColor.argb,'FF28241E');
 const html=context.window.SoloProductReports.printHtml(rows);assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('A4 landscape'));assert.ok(html.includes('1 kg'));assert.ok(html.includes('R$'));
 const panel=fs.readFileSync('assets/panel.js','utf8'),kits=fs.readFileSync('assets/kits.js','utf8');
 assert.ok(panel.includes('dashboard-stats'));assert.ok(panel.includes("statCard('Kits cadastrados'"));assert.ok(panel.includes("statCard('Produtos cadastrados'"));assert.ok(panel.includes('products-print'));assert.ok(panel.includes('products-excel'));
 assert.ok(!kits.includes('<select id="kit-picker">'));assert.ok(kits.includes('kit-product-search'));assert.ok(kits.includes('data-kit-pick'));
 console.log('PASS: product Excel round-trip, numeric values, formula results, formatting, freeze/filter, safe strings; printable product catalogue and dashboard/picker integration.');
})().catch(error=>{console.error(error);process.exitCode=1;});
