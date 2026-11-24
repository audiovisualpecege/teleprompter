import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RECOVERY_SAVE_MS } from '@shared/defaults';
import { positionAt } from '@shared/motion';
import { bindStore } from '../../src/main/ipc-main';
import { setupFileOpening, type FileOpeningApp } from '../../src/main/recovery';
import { createIpcBus } from '../fakes/ipc-bus';
import { createTestStore } from '../fakes/store';

const FIX = join(__dirname, '..', 'fixtures');
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'tp-arquivos-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('Arquivos com disco real', () => {
  it('IT-005 importar latin1.txt pela operação cmd:doc deixa os acentos certos e não muda o confirmado', async () => {
    const t = await createTestStore({ userDataDir: dir, init: false, autoLayout: false });
    const bus = createIpcBus();
    bindStore(t.store, bus);
    await t.store.init();
    await bus.invoke('cmd:doc', { op: 'setDraft', text: 'No ar.' });
    await bus.invoke('cmd:doc', { op: 'confirm' });
    t.platform.dialogAnswers.open = [join(FIX, 'latin1.txt')];
    expect(await bus.invoke('cmd:doc', { op: 'import', unsaved: 'discard' })).toEqual({ ok: true, value: undefined });
    expect(bus.control.snapshot?.doc).toMatchObject({
      draftText: 'Ação\nCoração não é ação',
      confirmedText: 'No ar.',
      pending: true,
    });
  });

  it('IT-006 importar com-tabela-e-imagem.docx traz só o corpo e o aviso de itens ignorados', async () => {
    const t = await createTestStore({ userDataDir: dir });
    expect(await t.store.doc({ op: 'import', path: join(FIX, 'com-tabela-e-imagem.docx') })).toEqual({ ok: true, value: undefined });
    expect(t.last().doc.draftText).toBe('Texto antes da tabela.\n\nTexto depois.');
    const notice = t.last().notices.at(-1)!;
    expect(notice.message).toMatch(/1 tabela, 1 imagem e 1 caixa de texto/);
  });

  it.each(['corrompido.docx', 'protegido.docx'])('IT-007 importar %s não muda o documento e avisa', async (name) => {
    const t = await createTestStore({ userDataDir: dir });
    await t.store.doc({ op: 'setDraft', text: 'Roteiro atual.' });
    await t.store.doc({ op: 'confirm' });
    const before = t.last().doc;
    const r = await t.store.doc({ op: 'import', path: join(FIX, name), unsaved: 'discard' });
    expect(r).toMatchObject({ ok: false, error: { code: 'unreadable' } });
    expect(t.last().doc).toEqual(before);
    expect(t.last().notices.at(-1)).toMatchObject({ kind: 'danger', message: 'O arquivo não pôde ser lido' });
    expect(t.logs).toContainEqual({ event: 'file.error', fields: { op: 'import', code: 'unreadable' } });
  });

  it('IT-008 salvar com aparência e abrir num AppStore novo traz texto, aparência e posição 0', async () => {
    const path = join(dir, 'aula.roteiro');
    const a = await createTestStore({ userDataDir: join(dir, 'a') });
    await a.store.doc({ op: 'setDraft', text: 'Bom dia a todos.\n\nHoje vamos falar de luz.' });
    await a.store.doc({ op: 'confirm' });
    a.store.setAppearance({ fontSize: 110, letterCase: 'upper', marginPct: 20, bandColor: '#00FF0055' });
    a.platform.dialogAnswers.save = path;
    expect(await a.store.doc({ op: 'save' })).toEqual({ ok: true, value: undefined });

    const b = await createTestStore({ userDataDir: join(dir, 'b') });
    expect(await b.store.doc({ op: 'open', path })).toEqual({ ok: true, value: undefined });
    expect(b.last().doc).toMatchObject({ draftText: a.last().doc.draftText, confirmedText: a.last().doc.draftText, dirty: false });
    expect(b.last().appearance).toEqual(a.last().appearance);
    expect(positionAt(b.store.engine.segment, b.clock.now)).toBe(0);
    expect(b.store.layout?.lines[0].text).toBe('BOM DIA A TODOS.');
  });

  it('IT-009 salvar numa pasta somente leitura avisa o motivo e mantém dirty e o texto', async () => {
    const ro = join(dir, 'somente-leitura');
    mkdirSync(ro);
    const user = process.env.USERNAME ?? '';
    if (process.platform === 'win32') execFileSync('icacls', [ro, '/deny', `${user}:(OI)(CI)(W,D)`]);
    else chmodSync(ro, 0o555);
    try {
      const t = await createTestStore({ userDataDir: join(dir, 'u') });
      await t.store.doc({ op: 'setDraft', text: 'Texto que não pode se perder.' });
      t.platform.dialogAnswers.save = join(ro, 'aula.roteiro');
      const r = await t.store.doc({ op: 'save' });
      expect(r).toMatchObject({ ok: false, error: { code: 'permission-denied' } });
      expect(t.last().doc).toMatchObject({ dirty: true, draftText: 'Texto que não pode se perder.' });
      expect(t.last().notices.at(-1)?.message).toMatch(/permissão/);
      expect(existsSync(join(ro, 'aula.roteiro'))).toBe(false);
    } finally {
      if (process.platform === 'win32') execFileSync('icacls', [ro, '/remove:d', user]);
      else chmodSync(ro, 0o755);
    }
    expect(readdirSync(ro)).toEqual([]);
  });
});

describe('Recuperação e abertura por arquivo', () => {
  it('IT-022 depois de 5 s com dirty, uma queda e um AppStore novo oferecem o último rascunho', async () => {
    const a = await createTestStore({ userDataDir: dir });
    await a.store.doc({ op: 'setDraft', text: 'Primeira versão.' });
    a.clock.advance(RECOVERY_SAVE_MS);
    await a.store.doc({ op: 'setDraft', text: 'Última versão antes da queda.' });
    a.clock.advance(RECOVERY_SAVE_MS);
    await a.store.flush();
    // Queda: nada de fechamento normal, o processo some.
    a.store.dispose();

    const b = await createTestStore({ userDataDir: dir });
    expect(b.last().prompt).toMatchObject({ kind: 'recovery' });
    await b.store.doc({ op: 'recover' });
    expect(b.last().doc).toMatchObject({ draftText: 'Última versão antes da queda.', dirty: true });
  });

  it('IT-023 a segunda instância repassa aula.roteiro à primeira, que pergunta e abre; a segunda encerra', async () => {
    const path = join(dir, 'aula.roteiro');
    writeFileSync(path, JSON.stringify({ formato: 'teleprompter-roteiro', versao: 1, texto: 'Aula de hoje.', aparencia: {} }));

    // Trava de instância única compartilhada entre os dois "processos".
    let locked = false;
    const fakeApp = () => {
      const handlers = new Map<string, (...a: unknown[]) => void>();
      let quit = false;
      const app: FileOpeningApp & { emit(ev: string, ...a: unknown[]): void; quitted(): boolean } = {
        requestSingleInstanceLock: () => (locked ? false : (locked = true)),
        quit: () => void (quit = true),
        on: (ev: string, cb: (...a: never[]) => void) => handlers.set(ev, cb as (...a: unknown[]) => void),
        emit: (ev, ...a) => handlers.get(ev)?.(...a),
        quitted: () => quit,
      };
      return app;
    };

    const firstApp = fakeApp();
    const first = setupFileOpening(firstApp, ['teleprompter.exe']);
    const t = await createTestStore({ userDataDir: join(dir, 'u') });
    first.ready((p) => void t.store.openFromSystem(p));
    await t.store.doc({ op: 'setDraft', text: 'Rascunho não salvo.' });

    const secondArgv = ['teleprompter.exe', '--allow-file-access', path];
    const secondApp = fakeApp();
    const second = setupFileOpening(secondApp, secondArgv);
    expect(second.primary).toBe(false);
    expect(secondApp.quitted()).toBe(true);
    // O sistema entrega o argv da segunda à primeira.
    firstApp.emit('second-instance', {}, secondArgv, dir);
    await Promise.resolve();
    expect(t.last().prompt).toEqual({ kind: 'unsaved', op: 'open', path });
    expect(t.last().doc.draftText).toBe('Rascunho não salvo.');
    // A tela responde "Não salvar" e o arquivo abre.
    expect(await t.store.doc({ op: 'open', path, unsaved: 'discard' })).toEqual({ ok: true, value: undefined });
    expect(t.last().doc).toMatchObject({ filePath: path, confirmedText: 'Aula de hoje.', dirty: false });
    expect(t.last().prompt).toBeNull();
    expect(firstApp.quitted()).toBe(false);
  });

  it('IT-023 no Mac o arquivo chega por open-file, mesmo antes de a janela estar pronta', async () => {
    const opened: string[] = [];
    const handlers = new Map<string, (...a: unknown[]) => void>();
    const app: FileOpeningApp = {
      requestSingleInstanceLock: () => true,
      quit: () => undefined,
      on: (ev: string, cb: (...a: never[]) => void) => void handlers.set(ev, cb as (...a: unknown[]) => void),
    };
    const fo = setupFileOpening(app, ['/Applications/Teleprompter.app/Contents/MacOS/Teleprompter']);
    let prevented = false;
    handlers.get('open-file')!({ preventDefault: () => (prevented = true) }, '/Users/equipe/aula.roteiro');
    expect(prevented).toBe(true);
    expect(opened).toEqual([]);
    fo.ready((p) => opened.push(p));
    expect(opened).toEqual(['/Users/equipe/aula.roteiro']);
  });
});
