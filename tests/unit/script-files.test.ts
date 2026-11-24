import { join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '@shared/defaults';
import { ScriptFiles } from '../../src/main/script-files';
import { createMemFs, type MemFs } from '../fakes/memfs';
import { createFakePlatform } from '../fakes/platform';
import { createTestStore } from '../fakes/store';

const FIX = join(__dirname, '..', 'fixtures');
const A = 'C:/tmp/a.roteiro';
const B = 'C:/tmp/b.roteiro';

async function editedStore(fs: MemFs = createMemFs()) {
  const t = await createTestStore({ fs });
  await t.store.doc({ op: 'setDraft', text: 'Olá, estúdio.\n\nSegundo parágrafo.' });
  t.store.setAppearance({ fontSize: 120, textColor: '#FFFF00' });
  return { ...t, fs };
}

describe('ScriptFiles: salvar', () => {
  it('UT-164 save sem caminho usa o seletor e grava formato, versão 1, rascunho e aparência', async () => {
    const t = await editedStore();
    t.platform.dialogAnswers.save = A;
    expect(await t.store.doc({ op: 'save' })).toEqual({ ok: true, value: undefined });
    expect(t.platform.dialogCalls).toHaveLength(1);
    const file = JSON.parse(t.fs.text(A));
    expect(file).toEqual({
      formato: 'teleprompter-roteiro',
      versao: 1,
      texto: 'Olá, estúdio.\n\nSegundo parágrafo.',
      aparencia: { ...DEFAULT_APPEARANCE, fontSize: 120, textColor: '#FFFF00' },
    });
    expect(t.last().doc).toMatchObject({ filePath: A, dirty: false });
  });

  it('UT-165 save com o caminho já definido grava sem chamar o seletor', async () => {
    const t = await editedStore();
    t.platform.dialogAnswers.save = A;
    await t.store.doc({ op: 'save' });
    await t.store.doc({ op: 'setDraft', text: 'Outro texto.' });
    t.platform.dialogCalls.length = 0;
    await t.store.doc({ op: 'save' });
    expect(t.platform.dialogCalls).toEqual([]);
    expect(JSON.parse(t.fs.text(A)).texto).toBe('Outro texto.');
  });

  it('UT-166 saveAs grava em b.roteiro e atualiza o filePath', async () => {
    const t = await editedStore();
    t.platform.dialogAnswers.save = A;
    await t.store.doc({ op: 'save' });
    t.platform.dialogAnswers.save = B;
    expect((await t.store.doc({ op: 'saveAs' })).ok).toBe(true);
    expect(t.fs.files.has(normalize(B))).toBe(true);
    expect(t.last().doc.filePath).toBe(B);
  });

  it.each([
    ['EACCES', 'permission-denied'],
    ['EPERM', 'permission-denied'],
    ['ENOSPC', 'disk-full'],
  ])('UT-167/UT-168 gravação com %s devolve %s e o documento continua com dirty', async (errno, code) => {
    const t = await editedStore();
    t.platform.dialogAnswers.save = A;
    t.fs.failWrite.set('C:/tmp', errno);
    const r = await t.store.doc({ op: 'save' });
    expect(r).toMatchObject({ ok: false, error: { code } });
    expect(t.last().doc).toMatchObject({ dirty: true, draftText: 'Olá, estúdio.\n\nSegundo parágrafo.' });
    expect(t.last().notices.at(-1)?.kind).toBe('danger');
    expect(t.logs).toContainEqual({ event: 'file.error', fields: { op: 'save', code } });
  });

  it('UT-169 gravação com a pasta inexistente (ENOENT) chama o seletor de novo local', async () => {
    const t = await editedStore();
    t.platform.dialogAnswers.save = A;
    await t.store.doc({ op: 'save' });
    t.fs.dirs.add('C:/novo'); // C:/tmp sumiu
    t.platform.dialogAnswers.save = 'C:/novo/a.roteiro';
    t.platform.dialogCalls.length = 0;
    await t.store.doc({ op: 'setDraft', text: 'Texto depois de mover.' });
    expect((await t.store.doc({ op: 'save' })).ok).toBe(true);
    expect(t.platform.dialogCalls).toHaveLength(1);
    expect(t.last().doc.filePath).toBe('C:/novo/a.roteiro');
    expect(JSON.parse(t.fs.text('C:/novo/a.roteiro')).texto).toBe('Texto depois de mover.');
  });

  it('UT-170 gravação com EINVAL devolve invalid-name e nenhum arquivo é criado', async () => {
    const t = await editedStore();
    t.platform.dialogAnswers.save = 'C:/tmp/a?b.roteiro';
    t.fs.failWrite.set('C:/tmp', 'EINVAL');
    const r = await t.store.doc({ op: 'save' });
    expect(r).toMatchObject({ ok: false, error: { code: 'invalid-name' } });
    expect([...t.fs.files.keys()].filter((k) => k.includes('tmp'))).toEqual([]);
  });

  it('UT-171 dois save seguidos produzem os mesmos bytes', async () => {
    const t = await editedStore();
    t.platform.dialogAnswers.save = A;
    await t.store.doc({ op: 'save' });
    const first = t.fs.files.get(normalize(A))!;
    await t.store.doc({ op: 'save' });
    const second = t.fs.files.get(normalize(A))!;
    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
  });

  it('a gravação segura não deixa temporário para trás', async () => {
    const t = await editedStore();
    t.platform.dialogAnswers.save = A;
    await t.store.doc({ op: 'save' });
    expect([...t.fs.files.keys()].filter((k) => k.endsWith('.tmp'))).toEqual([]);
  });
});

describe('ScriptFiles: abrir', () => {
  const files = new ScriptFiles({ dialog: createFakePlatform().dialog });

  it('UT-172 open de um .roteiro válido devolve o texto e a aparência gravados', async () => {
    const r = await files.read(join(FIX, 'valido.roteiro'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.text).toBe('Bom dia.\n\nEste é o roteiro.');
    expect(r.value.appearance).toEqual({
      fontFamily: 'Archivo',
      fontSize: 96,
      textColor: '#FFFF00',
      backgroundColor: '#101010',
      bandColor: '#FACE9533',
      letterCase: 'upper',
      align: 'left',
      marginPct: 15,
      bandPositionPct: 40,
    });
    expect(r.value.warnings).toEqual([]);
  });

  it.each(['outro-formato.roteiro', 'nao-json.roteiro', 'imagem.txt'])(
    'UT-173 open de %s devolve invalid-roteiro',
    async (name) => {
      const r = await files.read(join(FIX, name));
      expect(r).toMatchObject({ ok: false, error: { code: 'invalid-roteiro' } });
    },
  );

  it('UT-174 open com versao 2 e campos desconhecidos devolve texto, aparência conhecida e newer-version', async () => {
    const r = await files.read(join(FIX, 'versao-nova.roteiro'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.text).toBe('Texto da versão nova.');
    expect(r.value.appearance.fontSize).toBe(96);
    expect(r.value.appearance).not.toHaveProperty('sombra');
    expect(r.value.warnings).toEqual(['newer-version']);

    const t = await createTestStore();
    expect((await t.store.doc({ op: 'open', path: join(FIX, 'versao-nova.roteiro') })).ok).toBe(true);
    expect(t.last().notices.at(-1)).toMatchObject({ kind: 'warning' });
    expect(t.last().notices.at(-1)?.message).toMatch(/versão mais nova/);
  });

  it('UT-175 open com fontSize 999 aplica 200', async () => {
    const r = await files.read(join(FIX, 'fonte-grande.roteiro'));
    expect(r.ok && r.value.appearance.fontSize).toBe(200);
    expect(r.ok && r.value.appearance.textColor).toBe(DEFAULT_APPEARANCE.textColor);
  });
});
