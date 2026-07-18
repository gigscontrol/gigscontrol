"use client";

import { User, Building2, FileText, Home, Phone } from "lucide-react";
import { formatEndereco } from "@/lib/endereco";

/**
 * CHIPS DE "DADOS PARA CONTRATO" — nome civil/legal · razão social · documento
 * (CPF/CNPJ) · endereço · telefone.
 *
 * Extraído do cabeçalho do ARTISTA (AbaArtistas.tsx) pra que a ficha do membro
 * da EQUIPE (AbaEquipe.tsx) mostre exatamente o mesmo bloco, com as mesmas
 * classes, em vez de duplicar o markup. Componente burro: só renderiza o que
 * receber, e não renderiza nada se não houver nenhum campo.
 *
 * NOTA (L4): o cabeçalho do artista ainda tem a cópia inline desse markup —
 * trocá-la por este componente é um follow-up de 1 linha, deixado de fora aqui
 * porque AbaArtistas.tsx é de outro work item neste lote.
 */
export type ChipsPessoaProps = {
  nomeLegal?: string | null;
  razaoSocial?: string | null;
  documentoTipo?: string | null;
  documento?: string | null;
  endereco?: string | null;
  telefone?: string | null;
  className?: string;
};

const CHIP =
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2 py-1 text-xs text-secondary";

export default function ChipsPessoa({
  nomeLegal,
  razaoSocial,
  documentoTipo,
  documento,
  endereco,
  telefone,
  className,
}: ChipsPessoaProps) {
  if (!nomeLegal && !razaoSocial && !documento && !endereco && !telefone) return null;
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className ?? "mt-2.5"}`}>
      {nomeLegal && (
        <span className={CHIP}>
          <User size={11} className="text-muted flex-shrink-0" />
          {nomeLegal}
        </span>
      )}
      {documentoTipo === "cnpj" && razaoSocial && (
        <span className={CHIP}>
          <Building2 size={11} className="text-muted flex-shrink-0" />
          {razaoSocial}
        </span>
      )}
      {documento && (
        <span className={CHIP}>
          <FileText size={11} className="text-muted flex-shrink-0" />
          <span className="text-muted">{documentoTipo === "cnpj" ? "CNPJ" : "CPF"}</span>
          <span className="font-mono">{documento}</span>
        </span>
      )}
      {endereco && (
        <span className={CHIP}>
          <Home size={11} className="text-muted flex-shrink-0" />
          {formatEndereco(endereco)}
        </span>
      )}
      {telefone && (
        <span className={CHIP}>
          <Phone size={11} className="text-muted flex-shrink-0" />
          <span className="font-mono">+{telefone}</span>
        </span>
      )}
    </div>
  );
}
