"use client";

import { useState } from "react";
import { type NovoAgendaItem } from "@/lib/agenda-items-context";
import type { Artista, AgendaItem } from "@/types";
import Modal from "../Modal";
import InputHora from "../inputs/InputHora";
import InputDataBR from "../inputs/InputDataBR";
import { useT } from "@/lib/i18n";
import { DayCell } from "./calendario";
import { CampoForm, PassoArtista, VoltarArtista, formatarDataBR } from "./camposAgenda";

/** Form de criação de evento personalizado (Fase 2). */
export function EventoFormModal({
  day,
  artistas,
  defaultArtistIds,
  itemEditar,
  onClose,
  onCriar,
}: {
  day?: DayCell;
  artistas: Artista[];
  defaultArtistIds: string[];
  itemEditar?: AgendaItem;
  onClose: () => void;
  onCriar: (input: NovoAgendaItem) => Promise<void>;
}) {
  const t = useT();
  const editando = !!itemEditar;
  const subtitulo = itemEditar
    ? formatarDataBR(itemEditar.data)
    : day
      ? `${t(day.name)} · ${day.date}`
      : "";
  const [dataEvento, setDataEvento] = useState(itemEditar?.data ?? day?.dataISO ?? "");
  const [titulo, setTitulo] = useState(itemEditar?.titulo ?? "");
  const [artistIds, setArtistIds] = useState<string[]>(itemEditar?.artistIds ?? defaultArtistIds);
  const [diaInteiro, setDiaInteiro] = useState(itemEditar ? itemEditar.diaInteiro : true);
  const [horaInicio, setHoraInicio] = useState(itemEditar?.horaInicio ?? "");
  const [horaFim, setHoraFim] = useState(itemEditar?.horaFim ?? "");
  const [observacoes, setObservacoes] = useState(itemEditar?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<1 | 2>(itemEditar ? 2 : 1);

  async function submit() {
    if (salvando) return;
    if (!titulo.trim()) {
      setErro(t("Informe um título."));
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataEvento)) {
      setErro(t("Informe a data."));
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await onCriar({
        tipo: "evento",
        titulo: titulo.trim(),
        data: dataEvento,
        diaInteiro,
        horaInicio: diaInteiro ? undefined : horaInicio || undefined,
        horaFim: diaInteiro ? undefined : horaFim || undefined,
        artistIds,
        observacoes: observacoes.trim() || undefined,
      });
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editando ? t("Editar evento") : t("Novo evento")}
      subtitle={subtitulo}
      maxWidth={440}
    >
      {etapa === 1 ? (
        <PassoArtista
          artistas={artistas}
          value={artistIds}
          onChange={setArtistIds}
          onCancelar={onClose}
          onContinuar={() => setEtapa(2)}
          cor="var(--brand)"
        />
      ) : (
      <div className="flex flex-col gap-4">
        <VoltarArtista artistas={artistas} ids={artistIds} onVoltar={() => setEtapa(1)} />
        <CampoForm label={t("Título")}>
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={t("Studio, Day Off, Férias…")}
            className="campo-input"
          />
        </CampoForm>

        <CampoForm label={t("Data")}>
          <InputDataBR
            value={dataEvento}
            onChange={setDataEvento}
            className="w-full"
          />
        </CampoForm>

        <CampoForm label={t("Quando")} grupo>
          <div className="flex rounded-md border border-border overflow-hidden text-sm">
            {[
              { v: true, label: t("Dia inteiro") },
              { v: false, label: t("Definir horário") },
            ].map((op, i) => {
              const ativo = diaInteiro === op.v;
              return (
                <button
                  key={op.label}
                  type="button"
                  onClick={() => setDiaInteiro(op.v)}
                  aria-pressed={ativo}
                  className={`flex-1 py-2 font-medium transition-colors ${
                    i === 1 ? "border-l border-border" : ""
                  }`}
                  style={
                    ativo
                      ? {
                          color: "var(--brand)",
                          backgroundColor:
                            "color-mix(in srgb, var(--brand) 16%, transparent)",
                        }
                      : { color: "var(--text-muted)" }
                  }
                >
                  {op.label}
                </button>
              );
            })}
          </div>
        </CampoForm>

        {!diaInteiro && (
          <div className="grid grid-cols-2 gap-3">
            <CampoForm label={t("Início")}>
              <InputHora
                value={horaInicio}
                onChange={setHoraInicio}
                accent="var(--brand)"
              />
            </CampoForm>
            <CampoForm label={t("Fim")}>
              <InputHora
                value={horaFim}
                onChange={setHoraFim}
                accent="var(--brand)"
              />
            </CampoForm>
          </div>
        )}

        <CampoForm label={t("Observações")}>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className="campo-input resize-none"
          />
        </CampoForm>

        {erro && <div className="text-xs text-danger">{erro}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-secondary">
            {t("Cancelar")}
          </button>
          <button
            onClick={submit}
            disabled={salvando}
            className="btn btn-primary disabled:opacity-50"
            style={{ backgroundColor: "var(--brand-solid)", color: "#fff" }}
          >
            {salvando ? t("Salvando…") : editando ? t("Salvar alterações") : t("Criar evento")}
          </button>
        </div>
      </div>
      )}
    </Modal>
  );
}
