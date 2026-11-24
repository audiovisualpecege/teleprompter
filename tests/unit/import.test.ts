import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { fileErrorMessage } from '@shared/file-errors';
import { importDocx } from '../../src/main/import-docx';
import { importTxt } from '../../src/main/import-txt';
import { IMPORT_FILTERS, ScriptFiles } from '../../src/main/script-files';
import { createMemFs } from '../fakes/memfs';
import { createFakePlatform } from '../fakes/platform';
import { createTestStore } from '../fakes/store';

const FIX = join(__dirname, '..', 'fixtures');
const fixture = (name: string): Uint8Array => readFileSync(join(FIX, name));
const bytes = (...b: number[]): Uint8Array => new Uint8Array(b);

describe('import-txt', () => {
  it('UT-176 .txt UTF-8 "Ação\\nCoração" é importado igual', () => {
    expect(importTxt(fixture('utf8.txt'))).toEqual({ ok: true, value: { text: 'Ação\nCoração' } });
  });

  it('UT-177 .txt Windows-1252 com os bytes 41 E7 E3 6F é importado como "Ação"', () => {
    expect(importTxt(bytes(0x41, 0xe7, 0xe3, 0x6f))).toEqual({ ok: true, value: { text: 'Ação' } });
  });

  it.each(['vazio.txt', 'so-espacos.txt'])('UT-178 %s devolve empty com "O arquivo está vazio"', (name) => {
    const r = importTxt(fixture(name));
    expect(r).toEqual({ ok: false, error: { code: 'empty' } });
    expect(fileErrorMessage('empty')).toBe('O arquivo está vazio');
  });

  it('UT-179 um PNG renomeado para .txt devolve not-text', () => {
    expect(importTxt(fixture('imagem.txt'))).toMatchObject({ ok: false, error: { code: 'not-text' } });
    // Muitos caracteres de controle, sem NUL, também não é texto.
    expect(importTxt(bytes(0x01, 0x02, 0x03, 0x41, 0x42))).toMatchObject({ ok: false, error: { code: 'not-text' } });
  });

  it.each([
    ['EACCES', 'permission-denied'],
    ['ENOENT', 'not-found'],
  ])('UT-180 %s na leitura devolve %s, com o motivo na mensagem', async (errno, code) => {
    const fs = createMemFs();
    fs.failRead.set('C:/rede/roteiro.txt', errno);
    const files = new ScriptFiles({ dialog: createFakePlatform().dialog, fs });
    const r = await files.importFile('C:/rede/roteiro.txt');
    expect(r).toMatchObject({ ok: false, error: { code } });
    const msg = fileErrorMessage(code as 'not-found');
    expect(msg).toMatch(code === 'permission-denied' ? /permissão/ : /não foi encontrado|indisponível/);
  });

  it('UT-181 "a\\r\\nb\\rc" é importado como "a\\nb\\nc"', () => {
    const r = importTxt(new TextEncoder().encode('a\r\nb\rc'));
    expect(r).toEqual({ ok: true, value: { text: 'a\nb\nc' } });
  });

  it('UTF-16 com marca (o "Unicode" do Bloco de Notas) também é texto', () => {
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('Ação', 'utf16le')]);
    expect(importTxt(utf16)).toEqual({ ok: true, value: { text: 'Ação' } });
  });
});

describe('import-docx', () => {
  it('UT-182 três parágrafos viram três parágrafos separados por linha em branco', async () => {
    const r = await importDocx(fixture('tres-paragrafos.docx'));
    expect(r).toEqual({
      ok: true,
      value: {
        text: 'Primeiro parágrafo.\n\nSegundo parágrafo.\n\nTerceiro parágrafo.',
        ignored: { tables: 0, images: 0, textboxes: 0 },
      },
    });
  });

  it('UT-183 tabela, imagem e caixa de texto ficam de fora e são contadas', async () => {
    const r = await importDocx(fixture('com-tabela-e-imagem.docx'));
    expect(r).toEqual({
      ok: true,
      value: { text: 'Texto antes da tabela.\n\nTexto depois.', ignored: { tables: 1, images: 1, textboxes: 1 } },
    });
  });

  it('UT-184 zip truncado devolve unreadable', async () => {
    expect(await importDocx(fixture('corrompido.docx'))).toMatchObject({ ok: false, error: { code: 'unreadable' } });
  });

  it('UT-185 .docx protegido por senha (contêiner OLE) devolve unreadable', async () => {
    expect(await importDocx(fixture('protegido.docx'))).toMatchObject({ ok: false, error: { code: 'unreadable' } });
  });

  it('UT-186 .docx só com imagens devolve no-text-content com a mensagem certa', async () => {
    expect(await importDocx(fixture('so-imagens.docx'))).toMatchObject({ ok: false, error: { code: 'no-text-content' } });
    expect(fileErrorMessage('no-text-content')).toBe('O arquivo não tem texto para importar');
  });

  it('UT-187 w:ins "novo" entra e w:del "velho" fica de fora', async () => {
    const r = await importDocx(fixture('revisoes.docx'));
    expect(r.ok && r.value.text).toBe('Texto novo no fim.');
    expect(r.ok && r.value.text).not.toContain('velho');
  });

  it.each(['roteiro.pdf', 'roteiro.doc', 'roteiro.odt'])('UT-188 importar %s devolve unsupported-format', async (name) => {
    const files = new ScriptFiles({ dialog: createFakePlatform().dialog, fs: createMemFs({ [`C:/x/${name}`]: 'x' }) });
    expect(await files.importFile(`C:/x/${name}`)).toMatchObject({ ok: false, error: { code: 'unsupported-format' } });
  });

  it('UT-189 um .docx de 500 páginas importa todos os parágrafos', async () => {
    const n = 15_000; // ~30 parágrafos por página
    const body = Array.from(
      { length: n },
      (_, i) => `<w:p><w:r><w:t>Parágrafo ${i + 1} do roteiro longo, com algumas palavras.</w:t></w:r></w:p>`,
    ).join('');
    const zip = new JSZip();
    zip.file(
      'word/document.xml',
      `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    );
    const data = await zip.generateAsync({ type: 'uint8array' });
    const r = await importDocx(data);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paras = r.value.text.split('\n\n');
    expect(paras).toHaveLength(n);
    expect(paras.at(-1)).toBe(`Parágrafo ${n} do roteiro longo, com algumas palavras.`);
  }, 30_000);

  it('UT-190 o seletor de importação é chamado com o filtro de .txt e .docx', async () => {
    expect(IMPORT_FILTERS).toEqual([{ name: 'Texto', extensions: ['txt', 'docx'] }]);
    const t = await createTestStore();
    await t.store.doc({ op: 'import' });
    expect(t.platform.dialogCalls).toHaveLength(1);
    expect(t.platform.dialogCalls[0].options.filters).toEqual([{ name: 'Texto', extensions: ['txt', 'docx'] }]);
  });

  it('UT-191 o seletor cancelado devolve cancelled e o documento não muda', async () => {
    const t = await createTestStore();
    await t.store.doc({ op: 'setDraft', text: 'Texto atual.' });
    await t.store.doc({ op: 'confirm' });
    t.platform.dialogAnswers.save = 'C:/tmp/x.roteiro';
    const before = t.last().doc;
    t.platform.dialogAnswers.open = null;
    expect(await t.store.doc({ op: 'import', unsaved: 'discard' })).toEqual({ ok: false, error: 'cancelled' });
    expect(t.last().doc).toEqual(before);
  });
});
