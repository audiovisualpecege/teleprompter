// Gera as fixtures SINTÉTICAS de voz em tests/fixtures/voz/sintetica/, com a voz pt-BR
// do Windows (scripts/voz-sintetica.ps1). Servem para exercitar os motores e o
// alinhador de ponta a ponta enquanto as gravações reais da equipe não chegam; não
// servem para calibrar as constantes (uma voz sintética é limpa e regular demais).
//
// Cada fixture tem o WAV (16 kHz mono) e um JSON com o roteiro, a origem e as marcas
// de cada palavra lida: índice do token do roteiro, início e fim em ms. O fim da palavra
// é o último trecho de 10 ms com som antes do início da palavra seguinte.
//
// Uso (só no Windows com a voz Maria pt-BR): node scripts/gerar-voz-sintetica.mjs
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'tests', 'fixtures', 'voz');
const outDir = join(dir, 'sintetica');
const roteiro = readFileSync(join(dir, 'roteiro.txt'), 'utf8');
const words = roteiro.match(/\S+/g);

const IMPROVISO_LONGO =
  'Deixa eu contar uma coisa rápida que aconteceu ontem no set. A luz caiu bem no meio da cena, ' +
  'todo mundo ficou parado no escuro, e o diretor começou a rir sem parar. Depois de alguns minutos ' +
  'a energia voltou e seguimos o trabalho normalmente, mas foi um susto engraçado, que ninguém ' +
  'esperava numa terça feira tão tranquila.';
const IMPROVISO_CURTO = 'Só um parêntese, essa parte a gente pode cortar depois na edição, tudo bem.';

/** Cada cenário é uma lista de trechos: palavras do roteiro [de, até) ou improviso. */
const CENARIOS = {
  'leitura-continua': [{ de: 0, ate: 112 }],
  'trecho-pulado': [{ de: 0, ate: 42 }, { de: 77, ate: 112 }],
  improviso: [{ de: 0, ate: 25 }, { improviso: IMPROVISO_LONGO }, { de: 25, ate: 112 }],
  'leitura-com-improviso': [{ de: 0, ate: 59 }, { improviso: IMPROVISO_CURTO }, { de: 59, ate: 112 }],
};

function readWav(path) {
  const b = readFileSync(path);
  let off = 12;
  let fmt = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22) };
    if (id === 'data') {
      if (!fmt || fmt.channels !== 1 || fmt.bits !== 16) throw new Error('WAV precisa ser mono de 16 bits');
      const n = size / 2;
      const samples = new Float32Array(n);
      for (let i = 0; i < n; i++) samples[i] = b.readInt16LE(off + 8 + i * 2) / 32768;
      return { rate: fmt.rate, samples };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error('WAV sem dados');
}

function endOfSound(samples, rate, fromMs, toMs) {
  const frame = Math.round(rate / 100);
  let end = fromMs;
  for (let ms = fromMs; ms + 10 <= toMs; ms += 10) {
    const s = Math.round((ms / 1000) * rate);
    let acc = 0;
    for (let i = s; i < s + frame && i < samples.length; i++) acc += samples[i] * samples[i];
    if (Math.sqrt(acc / frame) > 0.01) end = ms + 10;
  }
  return end;
}

const tmp = mkdtempSync(join(tmpdir(), 'tp-voz-'));
try {
  for (const [nome, trechos] of Object.entries(CENARIOS)) {
    // Texto falado e, para cada caractere de início de palavra, o token do roteiro (ou null).
    let falado = '';
    const inicioParaToken = new Map();
    const improviso = [];
    for (const t of trechos) {
      if (t.improviso) {
        improviso.push(falado.length);
        falado += `${t.improviso} `;
        improviso.push(falado.length);
        continue;
      }
      for (let i = t.de; i < t.ate; i++) {
        inicioParaToken.set(falado.length, i);
        falado += `${words[i]} `;
      }
      // Pausa de parágrafo entre os trechos.
      falado = `${falado.trimEnd()}\n\n`;
    }
    const txt = join(tmp, `${nome}.txt`);
    const wav = join(outDir, `${nome}.wav`);
    const marcasTmp = join(tmp, `${nome}.marcas.json`);
    writeFileSync(txt, falado, 'utf8');
    const r = spawnSync(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'voz-sintetica.ps1'),
        '-TextoArquivo', txt, '-Saida', wav, '-Marcas', marcasTmp],
      { stdio: 'inherit' },
    );
    if (r.status !== 0) throw new Error(`A voz sintética falhou em ${nome}`);
    const sapi = JSON.parse(readFileSync(marcasTmp, 'utf8').replace(/^﻿/, ''));
    const { rate, samples } = readWav(wav);
    const totalMs = Math.round((samples.length / rate) * 1000);
    const marcas = [];
    const faladas = sapi.palavras;
    for (let k = 0; k < faladas.length; k++) {
      const p = faladas[k];
      const proximo = k + 1 < faladas.length ? faladas[k + 1].inicioMs : totalMs;
      const fimMs = endOfSound(samples, rate, p.inicioMs, proximo);
      const token = inicioParaToken.has(p.caractere) ? inicioParaToken.get(p.caractere) : null;
      marcas.push({ palavra: p.texto, token, inicioMs: p.inicioMs, fimMs });
    }
    const json = {
      origem: 'sintetica',
      voz: sapi.voz,
      aviso: 'Voz sintética: serve para exercitar o pipeline, não para calibrar.',
      roteiro: 'roteiro.txt',
      duracaoMs: totalMs,
      marcas,
    };
    writeFileSync(join(outDir, `${nome}.json`), `${JSON.stringify(json, null, 2)}\n`);
    console.log(`${nome}: ${(totalMs / 1000).toFixed(1)} s, ${marcas.filter((m) => m.token !== null).length} palavras do roteiro`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
