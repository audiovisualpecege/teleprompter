/**
 * Gera as fixtures de arquivo de `tests/fixtures/` (TechSpec, "Abordagem de testes").
 * Os arquivos gerados ficam no git; rode de novo só para recriá-los:
 *   node scripts/gerar-fixtures.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests', 'fixtures');
mkdirSync(out, { recursive: true });
const put = (name, data) => writeFileSync(join(out, name), data);

/* ---------- .txt ---------- */
put('utf8.txt', Buffer.from('Ação\nCoração', 'utf8'));
// "Ação" e "Coração não é ação" em Windows-1252, com quebra de linha do Windows.
put('latin1.txt', Buffer.concat([Buffer.from([0x41, 0xe7, 0xe3, 0x6f, 0x0d, 0x0a]), Buffer.from('Coração não é ação', 'latin1')]));
put('vazio.txt', Buffer.alloc(0));
put('so-espacos.txt', Buffer.from('   \r\n\t \n  ', 'utf8'));
// PNG renomeado para .txt: começa com a assinatura PNG e tem bytes NUL.
put(
  'imagem.txt',
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]),
);

/* ---------- .docx ---------- */
const W_NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" ' +
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
  'xmlns:v="urn:schemas-microsoft-com:vml" mc:Ignorable="wps"';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const p = (text) => `<w:p><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
const image = (id) =>
  `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="952500" cy="952500"/><wp:docPr id="${id}" name="Imagem ${id}"/>` +
  '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>' +
  '<pic:blipFill><a:blip r:embed="rIdImg"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
const textbox = (text) =>
  '<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><wp:docPr id="9" name="Caixa de texto"/>' +
  '<a:graphic><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:txbx>' +
  `<w:txbxContent>${p(text)}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice>` +
  `<mc:Fallback><w:pict><v:shape><v:textbox><w:txbxContent>${p(text)}</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback>` +
  '</mc:AlternateContent></w:r></w:p>';
const table = (cells) => `<w:tbl><w:tblPr/><w:tr>${cells.map((c) => `<w:tc>${p(c)}</w:tc>`).join('')}</w:tr></w:tbl>`;

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

async function docx(bodyXml, withImage = false) {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
  );
  zip.file(
    'word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      (withImage
        ? '<Relationship Id="rIdImg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>'
        : '') +
      '</Relationships>',
  );
  if (withImage) zip.file('word/media/image1.png', PNG_1PX);
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W_NS}><w:body>${bodyXml}<w:sectPr/></w:body></w:document>`,
  );
  // Data fixa nas entradas do zip: gerar de novo dá os mesmos bytes.
  for (const f of Object.values(zip.files)) f.date = new Date('2026-01-01T00:00:00Z');
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

put('tres-paragrafos.docx', await docx(p('Primeiro parágrafo.') + p('Segundo parágrafo.') + p('Terceiro parágrafo.')));
put(
  'com-tabela-e-imagem.docx',
  await docx(
    p('Texto antes da tabela.') + table(['Célula A', 'Célula B']) + image(1) + textbox('Texto da caixa') + p('Texto depois.'),
    true,
  ),
);
put(
  'revisoes.docx',
  await docx(
    '<w:p><w:r><w:t xml:space="preserve">Texto </w:t></w:r>' +
      '<w:ins w:id="1" w:author="Equipe"><w:r><w:t>novo</w:t></w:r></w:ins>' +
      '<w:del w:id="2" w:author="Equipe"><w:r><w:delText>velho</w:delText></w:r></w:del>' +
      '<w:r><w:t xml:space="preserve"> no fim.</w:t></w:r></w:p>',
  ),
);
put('so-imagens.docx', await docx(image(1) + image(2), true));
const good = await docx(p('Este arquivo vai ser cortado no meio.'));
put('corrompido.docx', good.subarray(0, Math.floor(good.length / 2)));
// Arquivo protegido por senha: contêiner OLE (Compound File), não um zip.
const ole = Buffer.alloc(1536, 0);
Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(ole, 0);
Buffer.from('EncryptedPackage', 'utf16le').copy(ole, 1024);
put('protegido.docx', ole);

/* ---------- .roteiro ---------- */
const aparencia = {
  fontFamily: 'Archivo',
  fontSize: 96,
  textColor: '#FFFF00',
  backgroundColor: '#101010',
  bandColor: '#FACE9533',
  letterCase: 'upper',
  align: 'left',
  marginPct: 15,
  bandPositionPct: 40,
};
const json = (o) => `${JSON.stringify(o, null, 2)}\n`;
put('valido.roteiro', json({ formato: 'teleprompter-roteiro', versao: 1, texto: 'Bom dia.\n\nEste é o roteiro.', aparencia }));
put(
  'versao-nova.roteiro',
  json({
    formato: 'teleprompter-roteiro',
    versao: 2,
    texto: 'Texto da versão nova.',
    aparencia: { ...aparencia, sombra: true },
    capitulos: [],
  }),
);
put('fonte-grande.roteiro', json({ formato: 'teleprompter-roteiro', versao: 1, texto: 'Grande.', aparencia: { fontSize: 999 } }));
put('outro-formato.roteiro', json({ formato: 'outro-programa', versao: 1, texto: 'x' }));
put('nao-json.roteiro', 'isto não é JSON {');
console.log('Fixtures geradas em', out);
