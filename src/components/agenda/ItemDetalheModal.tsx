"use client";

import { useState } from "react";
import { Trash2, Pencil, Download } from "lucide-react";
import type { Artista, AgendaItem } from "@/types";
import Modal from "../Modal";
import { useT } from "@/lib/i18n";
import { META_TIPO, Passageiro, formatarDataBR } from "./camposAgenda";

/** Linha rótulo/valor pro detalhe. */
export function LinhaDetalhe({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted flex-shrink-0">{rotulo}</span>
      <span className="text-primary text-right">{valor}</span>
    </div>
  );
}

/**
 * Normaliza a franquia de bagagem pra exibição como "Bagagem extra":
 * - "" quando o voucher não fala de bagagem (esconde a linha);
 * - `labelNao` (ex: "Não") quando é só bagagem de mão / sem mala despachada;
 * - o texto original quando há bagagem despachada de fato ("2x 32kg").
 */
export function formatarBagagemExtra(raw: string, labelNao: string): string {
  const s = raw.trim();
  if (!s) return "";
  const low = s.toLowerCase();
  // Tem bagagem despachada de fato (peso/quantidade)?
  if (/\d\s*(kg|quilo|mala|peç|pec|piece|pc\b|x\s)/.test(low)) return s;
  // Frases que indicam ausência de bagagem despachada.
  if (/(sem mala|sem baga|s[oó]\s|apenas|somente|de m[aã]o|carry.?on|hand luggage|no checked|nenhum|n[aã]o)/.test(low)) {
    return labelNao;
  }
  return s;
}

/**
 * Cabeçalho do detalhe: o(s) artista(s) do item em destaque, no mesmo estilo
 * "coloridinho" dos cards de show da agenda (barrinha colorida na lateral).
 */
export function CabecalhoArtistas({ artistas }: { artistas: Artista[] }) {
  if (artistas.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {artistas.map((a) => (
        <div
          key={a.id}
          className="inline-flex items-center gap-2 bg-surface-2 border border-border rounded-md pl-2.5 pr-3 py-1.5"
          style={{ borderLeft: `3px solid ${a.color}` }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: a.color }}
          />
          <span className="text-sm font-bold text-primary">{a.name}</span>
        </div>
      ))}
    </div>
  );
}

/** Linhas específicas de um voo (a partir do `dados` do item). */
export function DetalheVoo({ dados }: { dados?: Record<string, unknown> }) {
  const t = useT();
  const [baixando, setBaixando] = useState(false);
  const d = (dados ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const rota = str("origem") && str("destino") ? `${str("origem")} → ${str("destino")}` : "";
  const voucherPath = str("voucherPath");
  const bagagemExtra = formatarBagagemExtra(str("bagagem"), t("Não"));
  const passageiros: Passageiro[] = Array.isArray(d.passageiros)
    ? (d.passageiros as Passageiro[])
    : str("passageiros")
      ? str("passageiros")
          .split(", ")
          .filter(Boolean)
          .map((nome) => ({ nome }))
      : [];

  async function baixarVoucher() {
    if (!voucherPath || baixando) return;
    setBaixando(true);
    try {
      const res = await fetch(
        `/api/voos/voucher?path=${encodeURIComponent(voucherPath)}`,
        { credentials: "include" }
      );
      const b = await res.json();
      if (b?.url) window.open(b.url, "_blank", "noopener");
    } catch {
      // silencioso — download é secundário
    } finally {
      setBaixando(false);
    }
  }

  return (
    <>
      {str("companhia") && <LinhaDetalhe rotulo={t("Companhia")} valor={str("companhia")} />}
      {rota && <LinhaDetalhe rotulo={t("Rota")} valor={rota} />}
      {bagagemExtra && <LinhaDetalhe rotulo={t("Bagagem extra")} valor={bagagemExtra} />}
      {str("localizador") && (
        <LinhaDetalhe rotulo={t("Localizador (PNR)")} valor={str("localizador")} />
      )}
      {passageiros.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t("Passageiros")}</span>
          {passageiros.map((p, i) => (
            <div key={i} className="text-sm text-primary font-medium leading-snug">
              {p.nome}
              {(p.nascimento || p.bagagemExtra) && (
                <span className="text-xs text-muted">
                  {" · "}
                  {[
                    p.nascimento && formatarDataBR(p.nascimento),
                    p.bagagemExtra && t("bagagem extra"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {voucherPath && (
        <button
          type="button"
          onClick={baixarVoucher}
          disabled={baixando}
          className="btn btn-secondary self-start inline-flex items-center gap-1.5 text-sm disabled:opacity-50"
        >
          <Download size={14} />
          {baixando ? t("Baixando…") : t("Baixar voucher")}
        </button>
      )}
    </>
  );
}

/** Linhas específicas de um transporte terrestre. */
export function DetalheTransporte({ dados }: { dados?: Record<string, unknown> }) {
  const t = useT();
  const d = (dados ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const rota = str("origem") && str("destino") ? `${str("origem")} → ${str("destino")}` : "";
  const contato = [str("motorista"), str("contato")].filter(Boolean).join(" · ");
  const passageiros: Passageiro[] = Array.isArray(d.passageiros)
    ? (d.passageiros as Passageiro[])
    : [];
  return (
    <>
      {str("tipoTransporte") && <LinhaDetalhe rotulo={t("Tipo")} valor={t(str("tipoTransporte"))} />}
      {rota && <LinhaDetalhe rotulo={t("Rota")} valor={rota} />}
      {str("empresa") && <LinhaDetalhe rotulo={t("Empresa")} valor={str("empresa")} />}
      {contato && <LinhaDetalhe rotulo={t("Motorista")} valor={contato} />}
      {passageiros.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted">{t("Passageiros")}</span>
          {passageiros.map((p, i) => (
            <div key={i} className="text-sm text-primary font-medium leading-snug">
              {p.nome}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** Detalhe de um item + excluir (Fase 2: sem edição). */
export function ItemDetalheModal({
  item,
  artistasDoItem,
  podeUI,
  onClose,
  onEditar,
  onExcluir,
}: {
  item: AgendaItem;
  artistasDoItem: Artista[];
  podeUI: (artistaId: string | null, chave: string) => boolean;
  onClose: () => void;
  onEditar: () => void;
  onExcluir: () => Promise<void>;
}) {
  const t = useT();
  const [excluindo, setExcluindo] = useState(false);
  const meta = META_TIPO[item.tipo];
  const podeEditar = item.artistIds.length
    ? item.artistIds.some(
        (id) => podeUI(id, "agenda.editar") || podeUI(id, "agenda.editar_todos")
      )
    : podeUI(null, "agenda.editar_todos");
  const podeExcluir = item.artistIds.length
    ? item.artistIds.some(
        (id) => podeUI(id, "agenda.excluir") || podeUI(id, "agenda.excluir_todos")
      )
    : podeUI(null, "agenda.excluir_todos");
  const horario = item.diaInteiro
    ? t("Dia inteiro")
    : [item.horaInicio, item.horaFim].filter(Boolean).join(" – ") || "—";
  const dur =
    item.tipo === "voo" && typeof item.dados?.duracao === "string"
      ? (item.dados.duracao as string)
      : "";

  async function excluir() {
    if (excluindo) return;
    setExcluindo(true);
    try {
      await onExcluir();
    } catch {
      setExcluindo(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={item.titulo || t(meta.label)}
      subtitle={t(meta.label)}
      maxWidth={400}
    >
      <div className="flex flex-col gap-3">
        <CabecalhoArtistas artistas={artistasDoItem} />
        {item.tipo === "voo" ? (
          <>
            <LinhaDetalhe rotulo={t("Data")} valor={formatarDataBR(item.data)} />
            {item.horaInicio && <LinhaDetalhe rotulo={t("Partida")} valor={item.horaInicio} />}
            {item.horaFim && <LinhaDetalhe rotulo={t("Chegada")} valor={item.horaFim} />}
            {dur && <LinhaDetalhe rotulo={t("Tempo de voo")} valor={dur} />}
          </>
        ) : (
          <LinhaDetalhe
            rotulo={t("Quando")}
            valor={`${formatarDataBR(item.data)} · ${horario}${dur ? ` · ${dur}` : ""}`}
          />
        )}
        {item.tipo === "voo" && <DetalheVoo dados={item.dados} />}
        {item.tipo === "transporte" && <DetalheTransporte dados={item.dados} />}
        {item.observacoes && <LinhaDetalhe rotulo={t("Observações")} valor={item.observacoes} />}
        {item.tipo === "voo" && (
          <div className="text-micro text-muted pt-2 border-t border-border">
            ⚠ {t("Confira no site da companhia (pelo localizador) se o horário não mudou.")}
          </div>
        )}
        <div className="flex justify-between pt-2">
          <button
            onClick={onEditar}
            disabled={!podeEditar}
            title={!podeEditar ? t("Você não tem permissão para isso.") : undefined}
            className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Pencil size={14} />
            {t("Editar")}
          </button>
          <button
            onClick={excluir}
            disabled={excluindo || !podeExcluir}
            title={!podeExcluir ? t("Você não tem permissão para isso.") : undefined}
            className="btn btn-danger-outline text-sm"
          >
            <Trash2 size={14} />
            {excluindo ? t("Excluindo…") : t("Excluir")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
