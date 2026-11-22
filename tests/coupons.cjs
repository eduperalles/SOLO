const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {run,context,files,props}=require('./module-access.cjs');

// Mock Cache & Utilities
const cacheValues = new Map();
context.CacheService = {
  getScriptCache: () => ({
    get: key => {
      const row = cacheValues.get(key);
      return row && row.expires > Date.now() ? row.value : null;
    },
    put: (key, value, seconds) => cacheValues.set(key, {value, expires: Date.now() + seconds * 1000}),
    remove: key => cacheValues.delete(key)
  })
};
context.MailApp = { getRemainingDailyQuota: () => 100, sendEmail: () => {} };
context.Utilities.getUuid = () => crypto.randomUUID();
context.Utilities.formatDate = () => new Intl.DateTimeFormat('sv-SE', {timeZone: 'America/Sao_Paulo'}).format(new Date());
context.hostDigest = value => crypto.createHash('sha256').update(String(value)).digest('base64url');
run('digest_=value=>hostDigest(value); setupClients(); setupOrders();');

// 1. Permissões de módulo
assert.equal(run('access_(admin).coupons'), true);
assert.equal(run('access_(operator).coupons'), false);
assert.throws(()=>run("saveCoupon_(operator, {}, 'create')"), /permiss/);

// 2. Leitura inicial vazia
assert.equal(run('readCoupons_().length'), 0);

// 3. Criação de cupom de desconto de R$ 20,00
const couponInput = {
  codigo: 'BEMVINDO20',
  desconto_valor: '20.00',
  valor_minimo: '50.00',
  limite_usos: '1',
  cliente_id: 'cli-1',
  cliente_nome: 'Cliente Especial',
  validade: '2026-12-31',
  status: 'ativo'
};

run(`var input = ${JSON.stringify(couponInput)}; var cupom = saveCoupon_(admin, input, 'create');`);
assert.equal(run('cupom.codigo'), 'BEMVINDO20');
assert.equal(run('cupom.desconto_valor'), '20.00');
assert.equal(run('cupom.valor_minimo'), '50.00');
assert.equal(run('cupom.limite_usos'), '1');
assert.equal(run('cupom.usos_atuais'), '0');
assert.equal(run('cupom.status'), 'ativo');
assert.equal(run('readCoupons_().length'), 1);

// 4. Validação de código duplicado
assert.throws(()=>run(`saveCoupon_(admin, {...input, codigo:'bemvindo20'}, 'create')`), /existe/);

// 5. Validação de Cupom Público (validateCoupon)
// Abaixo do valor mínimo (R$ 40 < R$ 50) -> deve lançar erro
assert.throws(()=>run("validateCoupon_({codigo:'BEMVINDO20', subtotal:40})"), /mínimo/);

// Cupom inexistente -> erro
assert.throws(()=>run("validateCoupon_({codigo:'NAOEXISTE', subtotal:100})"), /não encontrado/);

// Cupom válido com subtotal R$ 80 -> desconto R$ 20 -> total R$ 60
const validation = run("validateCoupon_({codigo:'bemvindo20', subtotal:80})");
assert.equal(validation.valid, true);
assert.equal(validation.codigo, 'BEMVINDO20');
assert.equal(validation.desconto_valor, 20);
assert.equal(validation.total_com_desconto, 60);

// 6. Teste de pedido utilizando o cupom de desconto
const orderRequest = {
  idempotency_key: 'order-coupon-000000000001',
  record: {
    nome: 'Cliente Cupom',
    email: 'cupom@example.invalid',
    whatsapp: '(11) 98888-2233',
    entrega: 'retirada',
    cupom_codigo: 'BEMVINDO20',
    observacoes: 'Pedido com cupom de teste',
    itens: [{id: 103, quantidade: 1, valor_unitario: 98.00}] // SOLO Conexão = R$ 98.00
  }
};

const placed = run(`placeOrder_(${JSON.stringify(orderRequest)})`);
// Total original: R$ 98.00. Desconto: R$ 20.00. Total final com cupom: R$ 78.00!
assert.equal(placed.total, 78);
assert.ok(placed.mensagem.includes('*CUPOM:* BEMVINDO20 (- R$ 20,00)'));
assert.ok(placed.mensagem.includes('TOTAL A PAGAR: R$ 78,00'));

// 7. Cupom com limite de 1 uso agora deve constar como utilizado!
const usedCoupon = run("readCoupons_().find(c => c.codigo === 'BEMVINDO20')");
assert.equal(usedCoupon.usos_atuais, '1');
assert.equal(usedCoupon.status, 'utilizado');

// Tentativa de validar novamente o cupom esgotado deve falhar
assert.throws(()=>run("validateCoupon_({codigo:'BEMVINDO20', subtotal:100})"), /ativo/);

// 8. Atualização e Exclusão de cupom
run(`cupom = saveCoupon_(admin, {...cupom, status:'ativo', limite_usos:'5', expected_updated_at:'${usedCoupon.atualizado_em}'}, 'update');`);
assert.equal(run('cupom.limite_usos'), '5');
assert.equal(run('cupom.status'), 'ativo');

run('deleteCoupon_(admin, cupom.id, cupom.atualizado_em);');
assert.equal(run('readCoupons_().length'), 0);

console.log('PASS: coupons CRUD, code uniqueness, validation with minimum order, order checkout discount and usage limit tracking.');
