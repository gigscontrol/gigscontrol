"use client";

import { useEffect, useState } from "react";
import { ArrowRight, UserCog } from "lucide-react";
import Modal from "./Modal";
import { useT } from "@/lib/i18n";

export type CampoDivergente = "nome" | "email" | "endereco" | "telefone";

export type Divergencia = {
  campo: CampoDivergente;
  /** Rótulo já traduzido (o chamador conhece o contexto). */
  rotulo: string;
  /** Valor que está no cadastro hoje. */
  atual: string;
  /** Valor digitado agora. */
  novo: string;
};

/**
 * Popup de divergência do contato (D2). Aparece quando o telefone casa com um
 * contratante já cadastrado mas algum dado digitado difere do cadastro.
 *
 * - Atualizar contato → grava só os campos marcados.
 * - Manter como está → não grava nada (a venda/orçamento segue com o snapshot
 *   do que foi digitado; o cadastro vence).
 * - Fechar (X / clique-fora / ESC) → mesmo efeito de "Manter": nunca trava o
 *   fluxo esperando resposta.
 *
 * DOCUMENTO NUNCA ENTRA AQUI (D3): ele acumula no histórico, não conflita.
 *
 * `cego`: o contato foi reencontrado pelo /existe, que enxerga o workspace
 * INTEIRO ignorando a visibilidade derivada. Nesse caso o usuário não tem
 * permissão de ver o cadastro, então o popup mostra QUE o campo diverge, sem
 * imprimir o valor atual (senão o fluxo vira um leitor de e-mail/endereço
 * alheio: basta digitar um telefone e um valor qualquer).
 */
export default function DivergenciaContatoModal({
  aberto,
  nomeContato,
  divergencias,
  cego = false,
  onConfirmar,
  onManter,
  onFechar,
}: {
  aberto: boolean;
  nomeContato: string;
  divergencias: Divergencia[];
  cego?: boolean;
  onConfirmar: (camposEscolhidos: string[]) => void;
  onManter: () => void;
  onFechar: () => void;
}) {
  const t = useT();
  const [escolhidos, setEscolhidos] = useState<string[]>(() =>
    divergencias.map((d) => d.campo)
  );

  // Abriu com um conjunto novo de campos → todos nascem marcados.
  const chave = divergencias.map((d) => d.campo).join("|");
  useEffect(() => {
    setEscolhidos(chave ? chave.split("|") : []);
  }, [chave, aberto]);

  if (!aberto || divergencias.length === 0) return null;

  function alternar(campo: string) {
    setEscolhidos((prev) =>
      prev.includes(campo) ? prev.filter((c) => c !== campo) : [...prev, campo]
    );
  }

  return (
    <Modal
      isOpen
      onClose={onFechar}
      title={t("Esse contato já está cadastrado")}
      subtitle={t("Alguns dados digitados são diferentes do cadastro de {nome}.", {
        nome: nomeContato,
      })}
      maxWidth={520}
    >
      <div className="flex items-start gap-3 mb-4">
        <span
          className="flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: "color-mix(in srgb, var(--info) 12%, transparent)",
            color: "var(--info)",
          }}
        >
          <UserCog size={18} />
        </span>
        <p className="text-sm text-secondary leading-relaxed">
          {t("Escolha o que deve ser atualizado no contato. O que ficar desmarcado continua como está no cadastro.")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {divergencias.map((d) => {
          const marcado = escolhidos.includes(d.campo);
          return (
            <label
              key={d.campo}
              className={`flex items-start gap-3 py-2.5 px-3 rounded-md border cursor-pointer transition-colors ${
                marcado ? "border-border-strong bg-elevated" : "border-border"
              }`}
            >
              <input
                type="checkbox"
                checked={marcado}
                onChange={() => alternar(d.campo)}
                className="mt-1 flex-shrink-0"
                style={{ accentColor: "var(--info)" }}
              />
              <span className="flex-1 min-w-0">
                <span className="block stat-label mb-1">{d.rotulo}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted line-through break-all">
                    {cego ? t("(valor do cadastro)") : d.atual || t("(vazio)")}
                  </span>
                  <ArrowRight size={13} className="text-muted flex-shrink-0" />
                  <span className="text-primary font-semibold break-all">
                    {d.novo || t("(vazio)")}
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2 flex-wrap mt-5">
        <button onClick={onManter} className="btn btn-secondary text-sm">
          {t("Manter como está")}
        </button>
        <button
          onClick={() => onConfirmar(escolhidos)}
          disabled={escolhidos.length === 0}
          className="btn btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {t("Atualizar contato")}
        </button>
      </div>
    </Modal>
  );
}
