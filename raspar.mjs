// Baixa a ordem cronológica de pagamentos (pagos) e os aptos a pagamento (fila atual)
// das prefeituras que usam o portal da Elotech. Dados públicos (Lei 14.133, art. 141, §3º).
// Uso: node raspar.mjs cidades.txt [exercicio]
// cidades.txt: uma linha por cidade, "subdominio|idEntidade|nome|UF".
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [arquivoCidades, exercicio = '2026'] = process.argv.slice(2);
const PASTA = join(import.meta.dirname, 'dados');
const PAUSA_MS = 600; // educação com o servidor da prefeitura
const TIPOS = ['fornecimentoBens', 'locacoes', 'prestacaoServicos', 'obras'];
const FIM = new Date().toISOString().slice(0, 10);

mkdirSync(PASTA, { recursive: true });
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function pegar(url, cabecalhos, tentativas = 3) {
  for (let i = 1; i <= tentativas; i += 1) {
    try {
      const r = await fetch(url, {
        headers: { ...cabecalhos, Accept: 'application/json', 'User-Agent': 'pesquisa-ordem-cronologica/0.1 (estudo de dados publicos)' },
        signal: AbortSignal.timeout(90_000),
      });
      if (r.ok) return await r.json();
      if (r.status < 500) throw new Error(`HTTP ${r.status}`);
    } catch (erro) {
      if (i === tentativas) throw erro;
    }
    await esperar(3000 * i);
  }
  return null;
}

async function todasAsPaginas(base, caminho, parametros, cabecalhos) {
  const itens = [];
  for (let pagina = 0; ; pagina += 1) {
    const q = new URLSearchParams({ ...parametros, page: String(pagina), size: '500' });
    const d = await pegar(`${base}/api/liquidacoes/${caminho}?${q}`, cabecalhos);
    itens.push(...(d?.content ?? []));
    await esperar(PAUSA_MS);
    if (!d || d.last || !d.content?.length) break;
  }
  return itens;
}

const cidades = readFileSync(arquivoCidades, 'utf8').trim().split(/\r?\n/).map((l) => l.split('|'));
for (const [sub, entidade, nome, uf] of cidades) {
  const destino = join(PASTA, `${sub}-${exercicio}.json`);
  if (existsSync(destino)) {
    console.log(`já baixado: ${nome}`);
    continue;
  }
  const base = `https://${sub}.oxy.elotech.com.br/portaltransparencia-api`;
  const cabecalhos = { entidade, exercicio };
  const inicio = Date.now();
  try {
    const pagos = {};
    for (const tipo of TIPOS) {
      pagos[tipo] = await todasAsPaginas(base, 'ordem-cronologica-pagamentos', { entidade, tipoContrato: tipo, dataInicial: `${exercicio}-01-01`, dataFinal: FIM }, cabecalhos);
    }
    const aptos = await todasAsPaginas(base, 'aptos-pagamentos', { entidade }, cabecalhos);
    writeFileSync(destino, JSON.stringify({ sub, entidade, nome, uf, exercicio, baixadoEm: new Date().toISOString(), pagos, aptos }));
    const total = Object.values(pagos).reduce((s, l) => s + l.length, 0);
    console.log(`${nome} (${uf}): ${total} pagamentos, ${aptos.length} na fila, ${((Date.now() - inicio) / 1000).toFixed(0)} s`);
  } catch (erro) {
    console.log(`FALHOU ${nome}: ${erro.message}`);
  }
}
