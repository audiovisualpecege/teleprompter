/**
 * Importação de `.docx` com leitura própria do XML (TechSpec, "Importação"; US-003).
 *
 * - Entram só os parágrafos do corpo (`w:p`), fora de tabelas e caixas de texto,
 *   separados por uma linha em branco.
 * - Revisões aceitas: o texto de `w:ins` entra; `w:del` e `w:delText` ficam de fora.
 * - Tabelas, imagens e caixas de texto são contadas para o aviso de itens ignorados.
 * - Zip inválido (inclusive arquivo protegido por senha, que é um contêiner OLE):
 *   `unreadable`. Documento sem texto: `no-text-content`.
 */
import { DOMParser, type Element, type Node } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { err, ok, type FileError, type Result } from '@shared/types';

export interface IgnoredItems {
  tables: number;
  images: number;
  textboxes: number;
}

export interface DocxImport {
  text: string;
  ignored: IgnoredItems;
}

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const ELEMENT_NODE = 1;

const isW = (n: Node, name: string): boolean =>
  n.nodeType === ELEMENT_NODE && (n as Element).localName === name && (n as Element).namespaceURI === W;
const local = (n: Node): string => (n.nodeType === ELEMENT_NODE ? ((n as Element).localName ?? '') : '');

function children(n: Node): Node[] {
  const out: Node[] = [];
  for (let c = n.firstChild; c; c = c.nextSibling) out.push(c);
  return out;
}

/** Procura um descendente pelo nome local, sem entrar em `mc:Fallback`. */
function contains(n: Node, name: string): boolean {
  const stack = children(n);
  while (stack.length) {
    const c = stack.pop()!;
    if (c.nodeType !== ELEMENT_NODE || local(c) === 'Fallback') continue;
    if (local(c) === name) return true;
    stack.push(...children(c));
  }
  return false;
}

export async function importDocx(bytes: Uint8Array): Promise<Result<DocxImport, FileError>> {
  let xml: string;
  try {
    const zip = await JSZip.loadAsync(bytes);
    const entry = zip.file('word/document.xml');
    if (!entry) return err({ code: 'unreadable' });
    xml = await entry.async('string');
  } catch {
    return err({ code: 'unreadable' });
  }

  let body: Node | null = null;
  try {
    const doc = new DOMParser({ onError: () => undefined }).parseFromString(xml, 'text/xml');
    const root = doc.documentElement;
    body = root ? (children(root).find((c) => isW(c, 'body')) ?? null) : null;
  } catch {
    return err({ code: 'unreadable' });
  }
  if (!body) return err({ code: 'unreadable' });

  const ignored: IgnoredItems = { tables: 0, images: 0, textboxes: 0 };
  const paragraphs: string[] = [];

  /** Texto de um parágrafo, contando o que fica de fora. */
  const paragraphText = (p: Node): string => {
    let out = '';
    const walk = (n: Node): void => {
      for (const c of children(n)) {
        if (c.nodeType !== ELEMENT_NODE) continue;
        const name = local(c);
        if (name === 'Fallback') continue; // a mesma figura repetida para programas antigos
        if (name === 'drawing' || name === 'pict' || name === 'object') {
          if (contains(c, 'txbxContent')) ignored.textboxes++;
          else ignored.images++;
          continue;
        }
        if (name === 'txbxContent') {
          ignored.textboxes++;
          continue;
        }
        if (name === 'del' || name === 'delText' || name === 'instrText' || name === 'moveFrom') continue;
        if (isW(c, 't')) out += c.textContent ?? '';
        else if (isW(c, 'tab')) out += '\t';
        else if (isW(c, 'br') || isW(c, 'cr')) out += '\n';
        else walk(c);
      }
    };
    walk(p);
    return out;
  };

  /** Percorre o corpo: parágrafos entram, tabelas são contadas e puladas. */
  const block = (n: Node): void => {
    for (const c of children(n)) {
      if (c.nodeType !== ELEMENT_NODE) continue;
      if (isW(c, 'p')) {
        const t = paragraphText(c).replace(/[ \t]+$/g, '');
        if (t.trim() !== '') paragraphs.push(t);
      } else if (isW(c, 'tbl')) {
        ignored.tables++;
      } else if (isW(c, 'sectPr') || isW(c, 'del') || isW(c, 'moveFrom')) {
        continue;
      } else {
        block(c); // w:sdt, w:sdtContent, w:ins, w:customXml...
      }
    }
  };
  block(body);

  if (paragraphs.length === 0) return err({ code: 'no-text-content' });
  return ok({ text: paragraphs.join('\n\n'), ignored });
}

/** Aviso de itens ignorados, ou `null` quando nada foi ignorado. */
export function ignoredMessage(ignored: IgnoredItems): string | null {
  const parts: string[] = [];
  const n = (count: number, one: string, many: string): void => {
    if (count > 0) parts.push(`${count} ${count === 1 ? one : many}`);
  };
  n(ignored.tables, 'tabela', 'tabelas');
  n(ignored.images, 'imagem', 'imagens');
  n(ignored.textboxes, 'caixa de texto', 'caixas de texto');
  if (parts.length === 0) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`;
  return `Tabelas, imagens e caixas de texto foram ignoradas. Só o texto corrido foi importado (ficaram de fora: ${list})`;
}
