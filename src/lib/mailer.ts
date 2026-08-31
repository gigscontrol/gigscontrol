/**
 * E-mail transacional — Resend via HTTPS puro (sem SDK, zero dependência).
 *
 * Envs:
 *   RESEND_API_KEY  — chave re_... (resend.com; plano grátis 100/dia)
 *   MAIL_FROM       — remetente verificado (default onboarding@resend.dev,
 *                     que o Resend aceita SEM domínio verificado, com o aviso
 *                     "via resend.dev" — troque pelo seu domínio em produção).
 *
 * Sem RESEND_API_KEY o mailer fica indisponível: quem chama trata (a rota de
 * OTP responde 503 com mensagem clara em vez de fingir que enviou).
 */

export function mailerConfigurado(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function enviarEmail(params: {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Mailer não configurado (RESEND_API_KEY ausente).");
  const from = process.env.MAIL_FROM || "GIGS CONTROL <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.para],
      subject: params.assunto,
      text: params.texto,
      ...(params.html ? { html: params.html } : {}),
    }),
  });
  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Falha ao enviar e-mail (${res.status}): ${corpo.slice(0, 200)}`);
  }
}
