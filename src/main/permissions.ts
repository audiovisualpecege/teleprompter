/**
 * Permissões das janelas do programa. Só o que ele usa é concedido:
 *
 * - `local-fonts`: a lista de fontes instaladas no painel de aparência (`queryLocalFonts`).
 * - `media`: o microfone da voz (e os nomes dos microfones em `enumerateDevices`).
 * - `clipboard-sanitized-write`: copiar texto do editor.
 *
 * Todo o resto é negado. As páginas são só as do programa (nenhuma navega para fora).
 */
export const GRANTED_PERMISSIONS: ReadonlySet<string> = new Set(['local-fonts', 'media', 'clipboard-sanitized-write']);

export interface PermissionSession {
  setPermissionRequestHandler(
    handler: ((wc: unknown, permission: string, callback: (granted: boolean) => void) => void) | null,
  ): void;
  setPermissionCheckHandler(handler: ((wc: unknown, permission: string) => boolean) | null): void;
}

export function isGranted(permission: string): boolean {
  return GRANTED_PERMISSIONS.has(permission);
}

export function installPermissions(session: PermissionSession): void {
  session.setPermissionRequestHandler((_wc, permission, callback) => callback(isGranted(permission)));
  session.setPermissionCheckHandler((_wc, permission) => isGranted(permission));
}
