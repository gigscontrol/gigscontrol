"use client";

import { useState } from "react";
import { type NovoAgendaItem } from "@/lib/agenda-items-context";
import type { Artista, AgendaItem } from "@/types";
import Modal from "../Modal";
import InputHora from "../inputs/InputHora";
import InputDataBR from "../inputs/InputDataBR";
import { useT } from "@/lib/i18n";
import { DayCell } from "./calendario";
import { CampoForm, Passageiro, PassageirosField, PassoArtista, VoltarArtista, formatarDataBR, passageirosDe } from "./camposAgenda";

export const TIPOS_TRANSPORTE = ["Executivo", "Van", "Carro", "Ônibus", "Transfer", "Outro"];

/** Form de criação de transporte terrestre (Fase 3, manual). */
export function TransporteFormModal({
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
  const dadosE = (itemEditar?.dados ?? {}) as Record<string, unknown>;
  const strE = (k: string) => (typeof dadosE[k] === "string" ? (dadosE[k] as string) : "");
  const subtitulo = itemEditar
    ? formatarDataBR(itemEditar.data)
    : day
      ? `${t(day.name)} · ${day.date}`
      : "";
  const [artistIds, setArtistIds] = useState<string[]>(itemEditar?.artistIds ?? defaultArtistIds);
  const [dataT, setDataT] = useState(itemEditar?.data ?? day?.dataISO ?? "");
  const [etapa, setEtapa] = useState<1 | 2>(itemEditar ? 2 : 1);
  const [tipo, setTipo] = useState(strE("tipoTransporte") || "Executivo");
  const [empresa, setEmpresa] = useState(strE("empresa"));
  const [motorista, setMotorista] = useState(strE("motorista"));
  const [contato, setContato] = useState(strE("contato"));
  const [origem, setOrigem] = useState(strE("origem"));
  const [destino, setDestino] = useState(strE("destino"));
  const [horario, setHorario] = useState(itemEditar?.horaInicio ?? "");
  const [passageiros, setPassageiros] = useState<Passageiro[]>(passageirosDe(itemEditar));
  const [observacoes, setObservacoes] = useState(itemEditar?.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit() {
    if (salvando) return;
    if (!origem.trim() && !destino.trim() && !empresa.trim()) {
      setErro(t("Informe ao menos a rota ou a empresa."));
      return;
    }
    setSalvando(true);
    setErro(null);
    const rota = origem && destino ? `${origem.trim()}→${destino.trim()}` : "";
    const titulo = [t(tipo), rota].filter(Boolean).join(" · ") || t("Transporte");
    try {
      await onCriar({
        tipo: "transporte",
        titulo,
        data: dataT,
        diaInteiro: false,
        horaInicio: horario || undefined,
        artistIds,
        observacoes: observacoes.trim() || undefined,
        dados: {
          tipoTransporte: tipo,
          empresa: empresa.trim(),
          motorista: motorista.trim(),
          contato: contato.trim(),
          origem: origem.trim(),
          destino: destino.trim(),
          passageiros: passageiros.filter((p) => p.nome.trim()),
        },
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
      title={editando ? t("Editar transporte") : t("Novo transporte terrestre")}
      subtitle={subtitulo}
      maxWidth={480}
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

        <div className="grid grid-cols-2 gap-3">
          <CampoForm label={t("Data")}>
            <InputDataBR
              value={dataT}
              onChange={setDataT}
              className="w-full"
            />
          </CampoForm>
          <CampoForm label={t("Horário")}>
            <InputHora value={horario} onChange={setHorario} accent="var(--brand)" />
          </CampoForm>
        </div>

        <CampoForm label={t("Tipo")}>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="campo-input">
            {TIPOS_TRANSPORTE.map((tp) => (
              <option key={tp} value={tp}>
                {t(tp)}
              </option>
            ))}
          </select>
        </CampoForm>

        <div className="grid grid-cols-2 gap-3">
          <CampoForm label={t("Origem")}>
            <input
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              placeholder={t("Aeroporto, hotel…")}
              className="campo-input"
            />
          </CampoForm>
          <CampoForm label={t("Destino")}>
            <input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder={t("Local do evento…")}
              className="campo-input"
            />
          </CampoForm>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <CampoForm label={t("Empresa")}>
            <input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              className="campo-input"
            />
          </CampoForm>
          <CampoForm label={t("Motorista")}>
            <input
              value={motorista}
              onChange={(e) => setMotorista(e.target.value)}
              className="campo-input"
            />
          </CampoForm>
        </div>

        <CampoForm label={t("Contato do motorista")}>
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            placeholder={t("Telefone/WhatsApp")}
            className="campo-input"
          />
        </CampoForm>

        <PassageirosField value={passageiros} onChange={setPassageiros} />

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
            {salvando ? t("Salvando…") : editando ? t("Salvar alterações") : t("Criar transporte")}
          </button>
        </div>
      </div>
      )}
    </Modal>
  );
}
