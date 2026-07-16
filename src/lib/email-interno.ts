/**
 * Helper CLIENT-SAFE do e-mail "fake" interno.
 *
 * Membros (artista/equipe) que ainda não cadastraram um e-mail próprio
 * nascem com um e-mail determinístico `{username}@interno.gigscontrol.app`
 * (ver `montarEmailFake` em `artistas.service.ts`, server-side). Esse
 * e-mail é só placeholder pro Supabase Auth aceitar criar a conta — nunca
 * recebe nada e NÃO deve ser exibido ao usuário.
 *
 * Este módulo é puro (sem imports server-only), então pode ser importado
 * tanto por componentes cliente (Topbar) quanto por rotas de servidor. A
 * constante é duplicada de propósito em `artistas.service.ts`
 * (`emailEhInternoFake`) para não arriscar puxar código server-only pro
 * bundle do cliente — mantenha as duas em sincronia.
 */
export const SUFIXO_EMAIL_INTERNO = "@interno.gigscontrol.app";

/** true = o e-mail é o fake interno (não mostrar ao usuário). */
export function ehEmailInterno(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(SUFIXO_EMAIL_INTERNO);
}

/**
 * Extrai o handle de login (username) de um e-mail fake interno — o fake é
 * sempre `{username}@interno.gigscontrol.app`, então basta o que vem antes
 * do `@`. Só faz sentido chamar quando `ehEmailInterno(email)` é true.
 */
export function handleDoEmailInterno(email: string): string {
  return email.split("@")[0];
}
