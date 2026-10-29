// Mede atraso, pagamentos fora da ordem e fila parada a partir de dados/*.json.
// Uso: node analisar.mjs [data de referência AAAA-MM-DD]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = join(import.meta.dirname, 'dados');
const HOJE = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const DIA = 86_400_000;
const dias = (de, ate) => Math.round((Date.parse(ate) - Date.parse(de)) / DIA);

function mediana(v) {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
function percentil(v, p) {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor((p / 100) * o.length))];
}
const pct = (a, b) => (b ? (100 * a) / b : 0);

// "12.345.678/0001-90 - NOME" -> { doc: '12345678000190', nome, tipo: 'CNPJ'|'CPF'|'?' }
export function lerFornecedor(texto) {
  const m = /^\s*([\d.\-/*]+)\s*-\s*(.*)$/.exec(String(texto ?? ''));
  const doc = (m?.[1] ?? '').replace(/\D/g, '');
  const tipo = doc.length === 14 ? 'CNPJ' : doc.length === 11 ? 'CPF' : '?';
  return { doc, nome: (m?.[2] ?? String(texto ?? '')).trim(), tipo };
}

// Quebras de ordem numa fila (mesmo tipo de contrato e mesma fonte de recurso).
// B "furou" se alguma nota A liquidada antes (L_A < L_B) foi paga depois (P_A > P_B).
// A foi "passada para trás" se alguma B liquidada depois foi paga antes dela.
function quebrasNaFila(itens, folgaDias) {
  const v = itens
    .filter((i) => i.L && i.P)
    .map((i) => ({ ...i, l: Date.parse(i.L), p: Date.parse(i.P) }))
    .sort((a, b) => a.l - b.l);
  const furou = new Set();
  const passado = new Set();
  // Máximo de P entre as liquidadas estritamente antes de cada data de liquidação.
  let maxAntes = -Infinity;
  for (let i = 0; i < v.length; ) {
    let j = i;
    while (j < v.length && v[j].l === v[i].l) j += 1;
    for (let k = i; k < j; k += 1) if (maxAntes - v[k].p >= folgaDias * DIA) furou.add(v[k]);
    for (let k = i; k < j; k += 1) maxAntes = Math.max(maxAntes, v[k].p);
    i = j;
  }
  // Mínimo de P entre as liquidadas estritamente depois.
  let minDepois = Infinity;
  for (let i = v.length - 1; i >= 0; ) {
    let j = i;
    while (j >= 0 && v[j].l === v[i].l) j -= 1;
    for (let k = i; k > j; k -= 1) if (v[k].p - minDepois >= folgaDias * DIA) passado.add(v[k]);
    for (let k = i; k > j; k -= 1) minDepois = Math.min(minDepois, v[k].p);
    i = j;
  }
  return { avaliados: v.length, furou: [...furou], passado: [...passado] };
}

const linhas = [];
const geral = { pagos: 0, comVenc: 0, atrasados: 0, atrasos: [], valorPago: 0, valorAtrasado: 0, avaliados: 0, furou1: 0, furou7: 0, passado7: 0, valorFurou7: 0, fila: 0, filaValor: 0, filaIdades: [] };
const credores = new Map(); // doc -> { tipo, nome, cidades:Set, valor, atrasado }

for (const arquivo of readdirSync(PASTA).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(join(PASTA, arquivo), 'utf8'));
  const c = { cidade: d.nome.replace(/^(PREFEITURA (DO )?MUNICIPAL DE|PREFEITURA DO MUNICIPIO DE|MUNICIPIO DE)\s+/i, ''), uf: d.uf, pagos: 0, comVenc: 0, atrasados: 0, atrasos: [], valorPago: 0, avaliados: 0, furou1: 0, furou7: 0, passado7: 0, fila: 0, filaValor: 0, filaIdades: [] };

  for (const [tipo, itens] of Object.entries(d.pagos)) {
    const filas = new Map();
    for (const it of itens) {
      const valor = Number(it.valor) || 0;
      c.pagos += 1;
      c.valorPago += valor;
      const P = it.data;
      const V = it.dataVencimento;
      const f = lerFornecedor(it.fornecedor);
      const cred = credores.get(f.doc) ?? { tipo: f.tipo, nome: f.nome, cidades: new Set(), valor: 0, atrasado: false };
      cred.cidades.add(c.cidade);
      cred.valor += valor;
      credores.set(f.doc, cred);
      // Prazo de pagamento: da liquidação (quando a prefeitura reconhece a dívida) até o pagamento.
      // O vencimento quase nunca vem preenchido, por isso não serve de base.
      if (P && it.dataLiquidacao) {
        c.comVenc += 1;
        const a = dias(it.dataLiquidacao, P);
        c.atrasos.push(Math.max(a, 0));
        if (a > 30) {
          c.atrasados += 1;
          geral.valorAtrasado += valor;
          cred.atrasado = true;
        }
      }
      const chave = `${tipo}|${it.fonteRecurso}`;
      if (!filas.has(chave)) filas.set(chave, []);
      filas.get(chave).push({ L: it.dataLiquidacao, P, valor });
    }
    for (const fila of filas.values()) {
      const q1 = quebrasNaFila(fila, 1);
      const q7 = quebrasNaFila(fila, 7);
      c.avaliados += q1.avaliados;
      c.furou1 += q1.furou.length;
      c.furou7 += q7.furou.length;
      c.passado7 += q7.passado.length;
      geral.valorFurou7 += q7.furou.reduce((s, i) => s + i.valor, 0);
    }
  }

  for (const it of d.aptos) {
    c.fila += 1;
    c.filaValor += Number(it.valor) || 0;
    // Na fila de aptos, o campo data é a liquidação (o dataLiquidacao vem vazio).
    const base = it.dataLiquidacao ?? it.data;
    if (base) c.filaIdades.push(dias(base, HOJE));
  }

  for (const k of ['pagos', 'comVenc', 'atrasados', 'valorPago', 'avaliados', 'furou1', 'furou7', 'passado7', 'fila', 'filaValor']) geral[k] += c[k];
  geral.atrasos.push(...c.atrasos);
  geral.filaIdades.push(...c.filaIdades);
  linhas.push(c);
}

const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
linhas.sort((a, b) => b.pagos - a.pagos);
console.log(`Referência: ${HOJE}. Pagamentos de 2026 por data de pagamento.\n`);
console.log('Cidade | UF | Pagamentos | Pagos com mais de 30 dias | Mediana liquidação→pagamento (dias) | Furaram a fila (≥7 dias) | Fila agora | Mediana de espera na fila (dias)');
for (const c of linhas) {
  console.log(
    [c.cidade, c.uf, c.pagos, `${pct(c.atrasados, c.comVenc).toFixed(0)}%`, mediana(c.atrasos) ?? '-', `${pct(c.furou7, c.avaliados).toFixed(1)}%`, `${c.fila} (${brl(c.filaValor)})`, mediana(c.filaIdades) ?? '-'].join(' | '),
  );
}
const cnpjs = [...credores.entries()].filter(([, v]) => v.tipo === 'CNPJ');
const cpfs = [...credores.values()].filter((v) => v.tipo === 'CPF').length;
console.log('\nGERAL');
console.log(`Pagamentos: ${geral.pagos} (${brl(geral.valorPago)}); com vencimento informado: ${geral.comVenc}`);
console.log(`Pagos mais de 30 dias depois da liquidação: ${geral.atrasados} (${pct(geral.atrasados, geral.comVenc).toFixed(1)}%), somando ${brl(geral.valorAtrasado)}`);
console.log(`Liquidação→pagamento: mediana ${mediana(geral.atrasos)} dias, média ${(geral.atrasos.reduce((s, x) => s + x, 0) / (geral.atrasos.length || 1)).toFixed(1)}, 90% até ${percentil(geral.atrasos, 90)}, 99% até ${percentil(geral.atrasos, 99)} dias`);
console.log(`Furaram a fila: ${pct(geral.furou1, geral.avaliados).toFixed(1)}% com folga de 1 dia; ${pct(geral.furou7, geral.avaliados).toFixed(1)}% com folga de 7 dias (${brl(geral.valorFurou7)})`);
console.log(`Passados para trás (≥7 dias): ${pct(geral.passado7, geral.avaliados).toFixed(1)}% dos pagamentos`);
console.log(`Fila parada agora: ${geral.fila} notas (${brl(geral.filaValor)}); espera mediana ${mediana(geral.filaIdades)} dias; com mais de 60 dias: ${geral.filaIdades.filter((x) => x > 60).length}`);
console.log(`Credores distintos: ${credores.size} (${cnpjs.length} CNPJ, ${cpfs} CPF); CNPJs com algum pagamento >30 dias após a liquidação: ${cnpjs.filter(([, v]) => v.atrasado).length}`);

writeFileSync(
  join(import.meta.dirname, 'credores.json'),
  JSON.stringify(cnpjs.map(([doc, v]) => ({ doc, nome: v.nome, cidades: [...v.cidades], valor: Math.round(v.valor), atrasado: v.atrasado }))),
);
writeFileSync(join(import.meta.dirname, 'resumo.json'), JSON.stringify({ HOJE, geral: { ...geral, atrasos: undefined, filaIdades: undefined }, linhas: linhas.map((c) => ({ ...c, atrasos: undefined, filaIdades: undefined, medianaAtraso: mediana(c.atrasos), medianaFila: mediana(c.filaIdades) })) }, null, 1));
