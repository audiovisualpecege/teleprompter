/**
 * Worker do Vosk (ADR-007): o mesmo código WebAssembly do vosk-browser, mas carregado de
 * um arquivo do programa em vez de um blob. Assim o Worker não herda a política de
 * conteúdo da janela de controle, e ela não precisa liberar unsafe-eval para o embind.
 * Fala o protocolo de mensagens do vosk-browser (load, create, audioChunk, remove).
 */
import 'virtual:vosk-worker';
