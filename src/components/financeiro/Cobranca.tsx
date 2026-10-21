"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Copy, Info, MessageCircle } from "lucide-react";
import Modal from "../Modal";
import Toast from "../Toast";
import { useVendas } from "@/lib/vendas-context";
import { formatarMoeda } from "@/lib/formatters";
import {
  diasDeAtraso,
  linkCobrancaWhatsApp,
  ordinal,
  textoCobranca,
  tipoCobranca,
  type DadosCobranca,
} from "@/lib/financeiro/cobranca";
import type { Artista, Parcela, Venda } from "@/types";
import { useT } from "@/lib/i18n";

/** A parcela a cobrar, com a venda dona e o artista (pro PIX e o favorecido). */
export type AlvoCobranca = {
  venda: Venda;
  parcela: Parcela;
  indice: number;
  total: number;
  artista?: Artista;
};

function dadosDoAlvo(a: AlvoCobranca): DadosCobranca {
  return {
    contratante: a.venda.contratanteNome ?? "",
    artista: a.artista?.name ?? "",
    evento: a.venda.nomeEvento,
    dataShow: a.venda.dataShow,
    vendaNumero: a.venda.numero,
    indice: a.indice,
    total: a.total,
    valor: formatarMoeda(a.parcela.valor, a.venda.moeda),
    vencimento: a.parcela.dataVencimento,
    pix: a.artista?.pix,
    favorecido: a.artista?.razaoSocial || a.artista?.nomeLegal || a.artista?.name,
    vezesAntes: a.parcela.meta?.cobrancas?.length ?? 0,
  };
}

/**
 * Cobrar pelo WhatsApp: abre a conversa com o texto e REGISTRA a cobrança no
 * log da parcela (canal "whatsapp"); o aviso oferece Desfazer pra quando a
 * pessoa não chegou a enviar. "Outro canal" só registra. `aviso` vai FORA de
 * qualquer Modal (o Toast é position:fixed).
 */
export function useCobranca() {
  const t = useT();
  const { acaoParcela } = useVendas();
  const [aviso, setAviso] = useState<{
    msg: string;
    tipo: "sucesso" | "erro";
    desfazer?: () => void;
  } | null>(null);
  const fechar = useCallback(() => setAviso(null), []);

  const registrar = useCallback(
    async (a: AlvoCobranca, canal: "whatsapp" | "outro") => {
      const falhou = (e: unknown) =>
        setAviso({ msg: (e as Error)?.message || t("Não foi possível registrar a cobrança."), tipo: "erro" });
      try {
        const p = await acaoParcela(a.venda.id, a.parcela.id, {
          registrar_cobranca: true,
          cobranca_canal: canal,
        });
        const em = p.meta?.cobrancas?.[p.meta.cobrancas.length - 1]?.em;
        setAviso({
          msg: canal === "whatsapp" ? t("Cobrança registrada (WhatsApp).") : t("Cobrança registrada."),
          tipo: "sucesso",
          desfazer: em
            ? () => {
                setAviso(null);
                acaoParcela(a.venda.id, a.parcela.id, { desfazer_cobranca: em }).catch(falhou);
              }
            : undefined,
        });
      } catch (e) {
        falhou(e);
      }
    },
    [acaoParcela, t]
  );

  /** Abre o WhatsApp NA HORA do clique (senão o navegador bloqueia) e registra. */
  const enviarWhatsApp = useCallback(
    (a: AlvoCobranca, texto: string) => {
      window.open(linkCobrancaWhatsApp(a.venda.contratanteTelefone, texto), "_blank", "noopener,noreferrer");
      return registrar(a, "whatsapp");
    },
    [registrar]
  );

  const elemento: ReactNode = (
    <Toast
      open={!!aviso}
      mensagem={aviso?.msg ?? ""}
      tipo={aviso?.tipo ?? "sucesso"}
      duracao={aviso?.desfazer ? 8000 : 3000}
      acaoLabel={aviso?.desfazer ? t("Desfazer") : undefined}
      onAcao={aviso?.desfazer}
      onClose={fechar}
    />
  );

  return { enviarWhatsApp, registrarOutroCanal: (a: AlvoCobranca) => registrar(a, "outro"), aviso: elemento };
}

/**
 * Prévia editável da mensagem de cobrança. Usada dentro da ficha da parcela
 * (como os formulários de pagar/cancelar) e no modal aberto pela lista.
 */
export function PreviaCobranca({
  alvo,
  podeRegistrar,
  onEnviar,
  onCancelar,
}: {
  alvo: AlvoCobranca;
  podeRegistrar: boolean;
  onEnviar: (texto: string) => void;
  onCancelar: () => void;
}) {
  const t = useT();
  const hoje = useMemo(() => new Date(), []);
  const dados = useMemo(() => dadosDoAlvo(alvo), [alvo]);
  const [texto, setTexto] = useState(() => textoCobranca(dados, hoje));
  const [copiado, setCopiado] = useState(false);
  // Outra parcela (ou nova cobrança registrada) → recomeça do texto pronto.
  // Chave estável: o objeto `alvo` é remontado a cada render de quem chama, e
  // resetar por ele apagaria o que a pessoa está digitando.
  const chave = `${alvo.parcela.id}:${dados.vezesAntes}`;
  useEffect(() => {
    setTexto(textoCobranca(dados, hoje));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const tipo = tipoCobranca(dados, hoje);
  const selo =
    tipo === "lembrete"
      ? t("Lembrete")
      : t("{n} cobrança", { n: ordinal(dados.vezesAntes + 1) });
  const telefone = alvo.venda.contratanteTelefone?.replace(/\D/g, "");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o texto segue na caixa */
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-secondary">
          {t("Para")} <strong className="text-primary">{alvo.venda.contratanteNome || "—"}</strong>
          {telefone ? ` · +${telefone}` : ` · ${t("sem telefone: você escolhe o contato no WhatsApp")}`}
        </span>
        <span className={`badge ${tipo === "lembrete" ? "badge-info" : "badge-warning"}`}>{selo}</span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">{t("Mensagem (dá pra ajustar antes de enviar)")}</span>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={13}
          className="campo-input resize-y leading-relaxed"
        />
        <span className="text-xs text-muted">
          {t("*Asteriscos* viram negrito no WhatsApp. O texto muda sozinho: 1ª cobrança é um lembrete gentil; da 2ª em diante, mais direto.")}
        </span>
      </label>

      {!alvo.artista?.pix && (
        <div className="text-xs" style={{ color: "var(--warning)" }}>
          {t("{artista} sem chave PIX cadastrada: a mensagem vai sem PIX.", { artista: alvo.artista?.name ?? t("O artista") })}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md bg-surface-2 p-3 text-xs text-secondary">
        <Info size={14} className="mt-px flex-shrink-0 text-muted" />
        <span>
          {t("Ao abrir o WhatsApp, a cobrança fica registrada (hoje, por você, no WhatsApp). Se não chegou a enviar, dá pra desfazer no aviso.")}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onCancelar} className="btn btn-secondary text-sm">
          {t("Voltar")}
        </button>
        <button type="button" onClick={copiar} className="btn btn-secondary text-sm inline-flex items-center gap-1.5">
          <Copy size={14} />
          {copiado ? t("Copiado") : t("Copiar texto")}
        </button>
        <button
          type="button"
          onClick={() => onEnviar(texto)}
          disabled={!podeRegistrar || !texto.trim()}
          title={!podeRegistrar ? t("Você não tem permissão para isso.") : undefined}
          className="btn text-sm inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "var(--success-solid)", color: "#fff" }}
        >
          <MessageCircle size={14} />
          {t("Abrir WhatsApp e registrar")}
        </button>
      </div>
    </div>
  );
}

/** A prévia num modal próprio — aberta pelo botão "Cobrar" da lista. */
export function CobrarParcelaModal({
  alvo,
  podeRegistrar,
  onEnviar,
  onFechar,
}: {
  alvo: AlvoCobranca | null;
  podeRegistrar: boolean;
  onEnviar: (alvo: AlvoCobranca, texto: string) => void;
  onFechar: () => void;
}) {
  const t = useT();
  if (!alvo) return null;
  const dias = diasDeAtraso(alvo.parcela.dataVencimento, new Date());
  const situacao =
    dias > 0
      ? t("atrasada há {n} dias", { n: dias })
      : dias === 0
      ? t("vence hoje")
      : t("vence em {n} dias", { n: -dias });
  return (
    <Modal
      isOpen
      onClose={onFechar}
      title={t("Cobrar {nome}", { nome: alvo.venda.contratanteNome || alvo.venda.numero })}
      subtitle={`${t("Parcela {i}/{n}", { i: alvo.indice, n: alvo.total })} · ${alvo.venda.numero} · ${formatarMoeda(alvo.parcela.valor, alvo.venda.moeda)} · ${situacao}`}
      maxWidth={600}
    >
      <PreviaCobranca
        alvo={alvo}
        podeRegistrar={podeRegistrar}
        onCancelar={onFechar}
        onEnviar={(texto) => {
          onEnviar(alvo, texto);
          onFechar();
        }}
      />
    </Modal>
  );
}

