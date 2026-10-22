"use client";

import { MessageCircle } from "lucide-react";
import { linkInstagram, linkMapa, linkTelefone, linkWhatsApp } from "@/lib/contatoLinks";

/**
 * Contato tocável nas fichas (show, venda, orçamento, contato): no celular o
 * artista toca e liga, abre o WhatsApp, o e-mail ou o mapa, em vez de copiar
 * texto. Antes só a ficha do show fazia isso; as outras mostravam texto puro.
 *
 * Sublinhado discreto e área de toque maior (o -my compensa o py, sem mexer
 * no espaçamento das linhas da ficha).
 */
export const LINK_CONTATO =
  "text-primary underline decoration-border-strong underline-offset-2 transition-colors hover:text-brand py-1.5 -my-1.5";

/** "+5541999990000" (liga) e "WhatsApp" (abre a conversa). O telefone guardado
 *  já tem o código do país — ver lib/contatoLinks. */
export function TelefoneLinks({ telefone }: { telefone: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <a href={linkTelefone(telefone)} className={LINK_CONTATO}>
        +{telefone.replace(/\D/g, "")}
      </a>
      <a
        href={linkWhatsApp(telefone)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${LINK_CONTATO} inline-flex items-center gap-1`}
      >
        <MessageCircle size={12} />
        WhatsApp
      </a>
    </span>
  );
}

export function EmailLink({ email }: { email: string }) {
  return (
    <a href={`mailto:${email}`} className={`${LINK_CONTATO} break-all`}>
      {email}
    </a>
  );
}

/** Endereço que abre o mapa (no celular, o app de mapas). */
export function EnderecoLink({ endereco, cidade }: { endereco: string; cidade?: string }) {
  return (
    <a href={linkMapa(endereco, cidade)} target="_blank" rel="noopener noreferrer" className={LINK_CONTATO}>
      {endereco}
    </a>
  );
}

/** Perfil do Instagram; se o texto não é um perfil válido, fica texto. */
export function InstagramLink({ perfil }: { perfil: string }) {
  const href = linkInstagram(perfil);
  if (!href) return <>{perfil}</>;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${LINK_CONTATO} break-all`}>
      {perfil}
    </a>
  );
}
