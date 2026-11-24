import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, RECOVERY_SAVE_MS } from '@shared/defaults';
import { UNSAVED_OPTIONS, type DocCommand } from '@shared/ipc';
import { positionAt } from '@shared/motion';
import { createMemFs } from '../fakes/memfs';
import { createTestStore } from '../fakes/store';

const FIX = join(__dirname, '..', 'fixtures');
const TEXT = Array.from({ length: 30 }, (_, i) => `Linha ${i} do roteiro com algumas palavras para ler.`).join('\n');

async function confirmedStore(text = TEXT, memory = true) {
  const t = await createTestStore({ fs: memory ? createMemFs() : undefined });
  await t.store.doc({ op: 'setDraft', text });
  await t.store.doc({ op: 'confirm' });
  return t;
}

const needs = { ok: false, error: { code: 'needs-confirmation', options: UNSAVED_OPTIONS } };

describe('AppStore: rascunho e confirmação', () => {
  it('UT-192 setDraft deixa pending, mantém o texto confirmado e não pede diagramação', async () => {
    const t = await confirmedStore('Texto confirmado.');
    const requests = t.requests.length;
    await t.store.doc({ op: 'setDraft', text: 'novo' });
    expect(t.last().doc).toMatchObject({ draftText: 'novo', confirmedText: 'Texto confirmado.', pending: true });
    expect(t.requests).toHaveLength(requests);
  });

  it('UT-193 setDraft "x" duas vezes deixa o rascunho "x"', async () => {
    const t = await createTestStore();
    await t.store.doc({ op: 'setDraft', text: 'x' });
    await t.store.doc({ op: 'setDraft', text: 'x' });
    expect(t.last().doc.draftText).toBe('x');
  });

  it('UT-194 confirm copia o rascunho, tira o pending e pede diagramação com revision + 1', async () => {
    const t = await createTestStore();
    const rev = t.requests.at(-1)!.revision;
    await t.store.doc({ op: 'setDraft', text: 'Roteiro novo.' });
    expect(await t.store.doc({ op: 'confirm' })).toEqual({ ok: true, value: undefined });
    expect(t.last().doc).toMatchObject({ confirmedText: 'Roteiro novo.', pending: false });
    expect(t.requests.at(-1)).toMatchObject({ revision: rev + 1, text: 'Roteiro novo.' });
  });

  it('UT-195 confirm com rascunho só de espaços devolve empty-text e não muda o confirmado', async () => {
    const t = await confirmedStore('Anterior.');
    await t.store.doc({ op: 'setDraft', text: '  \n ' });
    expect(await t.store.doc({ op: 'confirm' })).toEqual({ ok: false, error: 'empty-text' });
    expect(t.last().doc.confirmedText).toBe('Anterior.');
  });

  it('UT-196 confirm sem mudança não pede diagramação nem emite trecho', async () => {
    const t = await confirmedStore();
    const requests = t.requests.length;
    const segments = t.segments.length;
    await t.store.doc({ op: 'confirm' });
    expect(t.requests).toHaveLength(requests);
    expect(t.segments).toHaveLength(segments);
  });

  it('UT-197 discard devolve o rascunho ao texto confirmado', async () => {
    const t = await confirmedStore('Confirmado.');
    await t.store.doc({ op: 'setDraft', text: 'Rascunho.' });
    await t.store.doc({ op: 'discard' });
    expect(t.last().doc).toMatchObject({ draftText: 'Confirmado.', pending: false });
  });

  it('UT-198 mudar só textColor deixa dirty', async () => {
    const t = await createTestStore();
    expect(t.last().doc.dirty).toBe(false);
    t.store.setAppearance({ textColor: '#FF0000' });
    expect(t.last().doc.dirty).toBe(true);
  });

  it('UT-199 save com edição pendente grava o rascunho, tira o dirty e mantém o pending', async () => {
    const t = await confirmedStore('Confirmado.');
    await t.store.doc({ op: 'setDraft', text: 'Rascunho ainda não confirmado.' });
    t.platform.dialogAnswers.save = 'C:/tmp/a.roteiro';
    await t.store.doc({ op: 'save' });
    expect(t.last().doc).toMatchObject({ dirty: false, pending: true, confirmedText: 'Confirmado.' });
  });

  it.each<DocCommand>([{ op: 'new' }, { op: 'open', path: join(FIX, 'valido.roteiro') }, { op: 'import', path: join(FIX, 'utf8.txt') }, { op: 'close' }])(
    'UT-200 %o com dirty devolve needs-confirmation com Salvar, Não salvar e Cancelar',
    async (cmd) => {
      const t = await confirmedStore('Texto não salvo.');
      const before = t.last().doc;
      expect(await t.store.doc(cmd)).toEqual(needs);
      expect(UNSAVED_OPTIONS).toEqual(['Salvar', 'Não salvar', 'Cancelar']);
      expect(t.last().doc).toEqual(before);
      // "Cancelar" não muda nada.
      expect(await t.store.doc({ ...cmd, unsaved: 'cancel' } as DocCommand)).toEqual({ ok: false, error: 'cancelled' });
      expect(t.last().doc).toEqual(before);
    },
  );

  it('UT-200 fechar o programa com dirty pergunta antes', async () => {
    const t = await confirmedStore('Texto não salvo.');
    let quit = 0;
    t.store.onQuit(() => quit++);
    expect(t.store.requestClose()).toBe(false);
    expect(t.last().prompt).toEqual({ kind: 'unsaved', op: 'close', path: null });
    expect(await t.store.doc({ op: 'close', unsaved: 'discard' })).toEqual({ ok: true, value: undefined });
    expect(quit).toBe(1);
    expect(t.last().prompt).toBeNull();
  });

  it.each<DocCommand>([{ op: 'new' }, { op: 'open', path: join(FIX, 'valido.roteiro') }, { op: 'import', path: join(FIX, 'utf8.txt') }, { op: 'close' }])(
    'UT-201 %o com dirty false segue sem perguntar',
    async (cmd) => {
      const t = await createTestStore();
      expect(t.last().doc.dirty).toBe(false);
      expect(await t.store.doc(cmd)).toEqual({ ok: true, value: undefined });
      expect(t.store.requestClose()).toBe(t.store.dirty === false);
    },
  );

  it('UT-202 "Salvar" que falha com EACCES cancela a ação original e deixa o documento intacto', async () => {
    const fs = createMemFs();
    const t = await createTestStore({ fs });
    await t.store.doc({ op: 'setDraft', text: 'Texto em edição.' });
    await t.store.doc({ op: 'confirm' });
    t.platform.dialogAnswers.save = 'C:/protegida/a.roteiro';
    fs.failWrite.set('C:/protegida', 'EACCES');
    const before = t.last().doc;
    const r = await t.store.doc({ op: 'open', path: join(FIX, 'valido.roteiro'), unsaved: 'save' });
    expect(r).toMatchObject({ ok: false, error: { code: 'permission-denied' } });
    expect(t.last().doc).toEqual(before);
  });

  it('UT-203 o primeiro confirm de um documento novo põe a posição em 0', async () => {
    const t = await createTestStore();
    await t.store.doc({ op: 'setDraft', text: TEXT });
    await t.store.doc({ op: 'confirm' });
    expect(t.segments.at(-1)).toEqual({ kind: 'hold', y: 0 });
  });
});

describe('AppStore: recuperação, reabrir, importar e aparência', () => {
  it('UT-205 com dirty por 5 s grava recuperacao.json; save o apaga', async () => {
    const fs = createMemFs();
    const t = await createTestStore({ fs });
    const path = join(t.userDataDir, 'recuperacao.json');
    await t.store.doc({ op: 'setDraft', text: 'Rascunho a proteger.' });
    t.clock.advance(RECOVERY_SAVE_MS - 1);
    await t.store.flush();
    expect(fs.files.has(path)).toBe(false);
    t.clock.advance(1);
    await t.store.flush();
    expect(JSON.parse(fs.text(path)).draftText).toBe('Rascunho a proteger.');
    t.platform.dialogAnswers.save = 'C:/tmp/a.roteiro';
    await t.store.doc({ op: 'save' });
    await t.store.flush();
    expect(fs.files.has(path)).toBe(false);
  });

  it('UT-205 o fechamento normal apaga a cópia de recuperação', async () => {
    const fs = createMemFs();
    const t = await createTestStore({ fs });
    const path = join(t.userDataDir, 'recuperacao.json');
    await t.store.doc({ op: 'setDraft', text: 'Rascunho.' });
    t.clock.advance(RECOVERY_SAVE_MS);
    await t.store.flush();
    expect(fs.files.has(path)).toBe(true);
    await t.store.doc({ op: 'close', unsaved: 'discard' });
    await t.store.flush();
    expect(fs.files.has(path)).toBe(false);
  });

  it('UT-206 ao abrir com recuperacao.json, oferece a recuperação; recover restaura o rascunho com dirty', async () => {
    const fs = createMemFs();
    const first = await createTestStore({ fs });
    await first.store.doc({ op: 'setDraft', text: 'Texto que quase se perdeu.' });
    first.clock.advance(RECOVERY_SAVE_MS);
    await first.store.flush();
    first.store.dispose();

    const t = await createTestStore({ fs, userDataDir: first.userDataDir });
    expect(t.last().prompt).toMatchObject({ kind: 'recovery' });
    expect(await t.store.doc({ op: 'recover' })).toEqual({ ok: true, value: undefined });
    expect(t.last().doc).toMatchObject({ draftText: 'Texto que quase se perdeu.', dirty: true });
    expect(t.last().prompt).toBeNull();
  });

  it('UT-207 open do arquivo já aberto pede confirmação com dirty e depois recarrega do disco', async () => {
    const fs = createMemFs();
    const t = await createTestStore({ fs });
    await t.store.doc({ op: 'setDraft', text: 'Versão salva.' });
    t.platform.dialogAnswers.save = 'C:/tmp/a.roteiro';
    await t.store.doc({ op: 'save' });
    // Com dirty false, recarrega direto.
    expect(await t.store.doc({ op: 'open', path: 'C:/tmp/a.roteiro' })).toEqual({ ok: true, value: undefined });
    await t.store.doc({ op: 'setDraft', text: 'Edição não salva.' });
    expect(await t.store.doc({ op: 'open', path: 'C:/tmp/a.roteiro' })).toEqual(needs);
    expect(await t.store.doc({ op: 'open', path: 'C:/tmp/a.roteiro', unsaved: 'discard' })).toEqual({ ok: true, value: undefined });
    expect(t.last().doc).toMatchObject({ draftText: 'Versão salva.', confirmedText: 'Versão salva.', dirty: false });
  });

  it('UT-208 importar troca o rascunho, deixa pending e não muda as saídas', async () => {
    const t = await confirmedStore('Texto no ar.', false);
    const requests = t.requests.length;
    const segments = t.segments.length;
    t.platform.dialogAnswers.save = 'C:/tmp/a.roteiro';
    expect(await t.store.doc({ op: 'import', path: join(FIX, 'utf8.txt'), unsaved: 'discard' })).toEqual({ ok: true, value: undefined });
    expect(t.last().doc).toMatchObject({ draftText: 'Ação\nCoração', confirmedText: 'Texto no ar.', pending: true });
    expect(t.requests).toHaveLength(requests);
    expect(t.segments).toHaveLength(segments);
  });

  it('UT-209 toStart com edição pendente leva a posição a 0 do layout confirmado', async () => {
    const t = await confirmedStore();
    t.store.scroll({ type: 'nudge', dy: 600 });
    t.clock.advance(500);
    await t.store.doc({ op: 'setDraft', text: `${TEXT}\nmais uma linha` });
    t.store.scroll({ type: 'toStart' });
    expect(positionAt(t.store.engine.segment, t.clock.now)).toBe(0);
    expect(t.store.layout?.lines.at(-1)?.text).not.toContain('mais uma linha');
  });

  it('UT-210 new usa a lastAppearance dos ajustes', async () => {
    const t = await createTestStore();
    t.store.setAppearance({ fontSize: 140, align: 'left' });
    await t.store.flush();
    await t.store.doc({ op: 'open', path: join(FIX, 'valido.roteiro'), unsaved: 'discard' });
    expect(t.last().appearance.fontSize).toBe(96);
    await t.store.doc({ op: 'new' });
    expect(t.last().appearance).toMatchObject({ fontSize: 140, align: 'left' });
  });

  it.each([
    [{ fontSize: 10 }, { fontSize: 20 }],
    [{ marginPct: 55 }, { marginPct: 40 }],
    [{ bandPositionPct: 5 }, { bandPositionPct: 10 }],
    [{ fontSize: Number.NaN }, { fontSize: 80 }],
    [{ textColor: 'azul' }, { textColor: '#FFFFFF' }],
  ])('UT-211 cmd:appearance %o aplica %o', async (patch, expected) => {
    const t = await createTestStore();
    expect(t.store.setAppearance(patch)).toMatchObject(expected);
  });

  it('UT-212 a aparência padrão é Archivo, 80, branco, preto, faixa pêssego, normal, centro, 10 e 33', async () => {
    expect(DEFAULT_APPEARANCE).toEqual({
      fontFamily: 'Archivo',
      fontSize: 80,
      textColor: '#FFFFFF',
      backgroundColor: '#000000',
      bandColor: '#FACE9533',
      letterCase: 'normal',
      align: 'center',
      marginPct: 10,
      bandPositionPct: 33,
    });
    const t = await createTestStore();
    expect(t.last().appearance).toEqual(DEFAULT_APPEARANCE);
  });
});
