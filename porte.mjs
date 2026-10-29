// Estima quantos credores são pequenas empresas: sorteia CNPJs de credores.json e consulta
// o porte na BrasilAPI (dados públicos da Receita). Guarda tudo em porte-cache.json.
// Uso: node porte.mjs [tamanho da amostra] [semente]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const AQUI = import.meta.dirname;
const TAMANHO = Number(process.argv[2] ?? 400);
let semente = Number(process.argv[3] ?? 2026) >>> 0;
const sortear = () => {
  semente = (semente + 0x6d2b79f5) >>> 0;
  let t = Math.imul(semente ^ (semente >>> 15), semente | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

const credores = JSON.parse(readFileSync(join(AQUI, 'credores.json'), 'utf8'));
const arquivoCache = join(AQUI, 'porte-cache.json');
const cache = existsSync(arquivoCache) ? JSON.parse(readFileSync(arquivoCache, 'utf8')) : {};

// Embaralha (Fisher–Yates com semente) e pega os primeiros.
const lista = [...credores];
for (let i = lista.length - 1; i > 0; i -= 1) {
  const j = Math.floor(sortear() * (i + 1));
  [lista[i], lista[j]] = [lista[j], lista[i]];
}
const amostra = lista.slice(0, TAMANHO);

for (const [n, c] of amostra.entries()) {
  if (cache[c.doc]) continue;
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      // Sem User-Agent a BrasilAPI responde 403 ao fetch do Node.
      const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c.doc}`, {
        headers: { 'User-Agent': 'pesquisa-ordem-cronologica/0.1 (estudo de dados publicos)', Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });
      if (r.status === 404) {
        cache[c.doc] = { porte: 'NAO ENCONTRADO' };
        break;
      }
      if (r.status === 429) {
        await esperar(15_000 * tentativa);
        continue;
      }
      if (!r.ok) {
        console.log(`CNPJ ${c.doc}: HTTP ${r.status}`);
        await esperar(5000 * tentativa);
        continue;
      }
      const d = await r.json();
      cache[c.doc] = { porte: d.porte ?? d.descricao_porte ?? '?', mei: Boolean(d.opcao_pelo_mei), simples: Boolean(d.opcao_pelo_simples), situacao: d.descricao_situacao_cadastral, cnae: d.cnae_fiscal_descricao };
      break;
    } catch (erro) {
      console.log(`CNPJ ${c.doc}: ${erro.message}`);
      await esperar(5000 * tentativa);
    }
  }
  if (n % 25 === 0) {
    writeFileSync(arquivoCache, JSON.stringify(cache));
    console.log(`${n + 1}/${amostra.length}`);
  }
  await esperar(700);
}
writeFileSync(arquivoCache, JSON.stringify(cache));

// Resultado
const classificar = (p) => {
  if (!p) return 'sem dado';
  if (p.mei) return 'MEI';
  if (/MICRO/i.test(p.porte)) return 'Microempresa';
  if (/PEQUENO/i.test(p.porte)) return 'Pequeno porte';
  if (/DEMAIS/i.test(p.porte)) return 'Demais (média/grande)';
  return 'sem dado';
};
function resumo(grupo, titulo) {
  const cont = {};
  for (const c of grupo) {
    const k = classificar(cache[c.doc]);
    cont[k] = (cont[k] ?? 0) + 1;
  }
  const validos = grupo.filter((c) => classificar(cache[c.doc]) !== 'sem dado').length;
  const pequenos = (cont.MEI ?? 0) + (cont.Microempresa ?? 0) + (cont['Pequeno porte'] ?? 0);
  const p = pequenos / (validos || 1);
  const margem = 1.96 * Math.sqrt((p * (1 - p)) / (validos || 1));
  console.log(`\n${titulo} (${grupo.length} na amostra, ${validos} com porte):`);
  for (const [k, v] of Object.entries(cont).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
  console.log(`  Pequenos (MEI + micro + pequeno porte): ${(100 * p).toFixed(1)}% ± ${(100 * margem).toFixed(1)} p.p. (95%)`);
}
resumo(amostra, 'Todos os credores CNPJ');
resumo(amostra.filter((c) => c.atrasado), 'Credores com algum pagamento >30 dias após a liquidação');
