"use client";

import { useState, type ChangeEvent } from "react";
import { Music, Search, FileUp, Pencil } from "lucide-react";
import { type NovoAgendaItem } from "@/lib/agenda-items-context";
import type { Artista, AgendaItem } from "@/types";
import Modal from "../Modal";
import InputHora from "../inputs/InputHora";
import InputDataBR from "../inputs/InputDataBR";
import { useT } from "@/lib/i18n";
import { DayCell } from "./calendario";
import { CampoForm, Passageiro, PassageirosField, PassoArtista, VoltarArtista, formatarDataBR, passageirosDe } from "./camposAgenda";

/** "HH:mm" partida/chegada → duração "3h15" (naive; +24h se chegada no dia seguinte). */
export function calcularDuracao(partida: string, chegada: string): string {
  const p = /^(\d{2}):(\d{2})$/.exec(partida);
  const c = /^(\d{2}):(\d{2})$/.exec(chegada);
  if (!p || !c) return "";
  let min =
    parseInt(c[1], 10) * 60 + parseInt(c[2], 10) - (parseInt(p[1], 10) * 60 + parseInt(p[2], 10));
  if (min < 0) min += 24 * 60;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Form de criação de voo (Fase 3) — manual + autofill opcional (AviationStack). */
/** Card de escolha de modo (visual do "Tipo de orçamento"). */
export function ModoCard({
  ativo,
  onClick,
  icon: Icone,
  titulo,
  desc,
}: {
  ativo: boolean;
  onClick: () => void;
  icon: typeof Music;
  titulo: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg border p-3 transition-colors"
      style={{
        borderColor: ativo ? "var(--brand)" : "var(--border-color)",
        backgroundColor: ativo
          ? "color-mix(in srgb, var(--brand) 10%, transparent)"
          : "transparent",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: "color-mix(in srgb, var(--brand) 16%, transparent)",
            color: "var(--brand)",
          }}
        >
          <Icone size={15} />
        </span>
        <span className="text-sm font-semibold text-primary">{titulo}</span>
      </div>
      <span className="block text-xs text-muted leading-snug">{desc}</span>
    </button>
  );
}

export function VooFormModal({
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
  const voucherPathExistente = strE("voucherPath");
  const [modo, setModo] = useState<"manual" | "pdf">("manual");

  // Form (usado pelo manual E pelo PDF de 1 voo)
  const [dataVoo, setDataVoo] = useState(itemEditar?.data ?? day?.dataISO ?? "");
  const [numeroVoo, setNumeroVoo] = useState(strE("numeroVoo"));
  const [companhia, setCompanhia] = useState(strE("companhia"));
  const [origem, setOrigem] = useState(strE("origem"));
  const [destino, setDestino] = useState(strE("destino"));
  const [partida, setPartida] = useState(strE("partida") || (itemEditar?.horaInicio ?? ""));
  const [chegada, setChegada] = useState(strE("chegada") || (itemEditar?.horaFim ?? ""));
  const [localizador, setLocalizador] = useState(strE("localizador"));
  const [artistIds, setArtistIds] = useState<string[]>(itemEditar?.artistIds ?? defaultArtistIds);
  const [passageiros, setPassageiros] = useState<Passageiro[]>(passageirosDe(itemEditar));
  const [duracao, setDuracao] = useState(strE("duracao"));
  const [bagagem, setBagagem] = useState(strE("bagagem"));
  const [pdfBase64, setPdfBase64] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // PDF
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [lendoPdf, setLendoPdf] = useState(false);
  const [pdfMulti, setPdfMulti] = useState<VooExtraido[] | null>(null);
  const [pdfOk, setPdfOk] = useState(false);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<1 | 2>(1);

  function aplicarVoo(v: VooExtraido) {
    if (v.data) setDataVoo(v.data);
    setNumeroVoo(v.numeroVoo ?? "");
    setCompanhia(v.companhia ?? "");
    setOrigem(v.origem ?? "");
    setDestino(v.destino ?? "");
    setPartida(v.partida ?? "");
    setChegada(v.chegada ?? "");
    setLocalizador(v.localizador ?? "");
    setPassageiros((v.passageiros ?? []).map((n) => ({ nome: n })));
    if (v.duracao) setDuracao(v.duracao);
    if (v.bagagem) setBagagem(v.bagagem);
  }

  async function escolherPdf(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArquivo(file.name);
    setPdfMulti(null);
    setPdfOk(false);
    setPdfMsg(null);
    setLendoPdf(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ""));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      setPdfBase64(base64);
      const res = await fetch("/api/voos/importar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64 }),
      });
      const body = await res.json();
      if (Array.isArray(body.voos)) {
        const achados = body.voos as VooExtraido[];
        if (achados.length === 0) setPdfMsg(t("Nenhum voo encontrado nesse PDF."));
        else if (achados.length === 1) {
          aplicarVoo(achados[0]);
          setPdfOk(true);
        } else setPdfMulti(achados);
      } else if (body.indisponivel) {
        setPdfMsg(
          t("Importação por IA indisponível — configure a chave Anthropic no servidor.")
        );
      } else {
        setPdfMsg(body.erro ?? t("Não consegui ler esse voucher."));
      }
    } catch {
      setPdfMsg(t("Não consegui ler esse voucher."));
    } finally {
      setLendoPdf(false);
    }
  }

  async function buscar() {
    const f = numeroVoo.trim();
    if (!f || buscando) return;
    setBuscando(true);
    setAviso(null);
    try {
      const res = await fetch(`/api/voos/lookup?flight=${encodeURIComponent(f)}`, {
        credentials: "include",
      });
      const body = await res.json();
      if (body.voo) {
        const v = body.voo;
        if (v.companhia) setCompanhia(v.companhia);
        if (v.origem) setOrigem(v.origem);
        if (v.destino) setDestino(v.destino);
        if (v.partida) setPartida(v.partida);
        if (v.chegada) setChegada(v.chegada);
        setAviso(t("Dados do voo de hoje aplicados — confira data e horário."));
      } else if (body.indisponivel) {
        setAviso(t("Busca automática indisponível (sem chave). Preencha manualmente."));
      } else if (body.naoEncontrado) {
        setAviso(t("Voo não encontrado hoje. Preencha manualmente."));
      } else {
        setAviso(body.erro ?? t("Não foi possível buscar agora."));
      }
    } catch {
      setAviso(t("Não foi possível buscar agora."));
    } finally {
      setBuscando(false);
    }
  }

  async function subirVoucher(): Promise<string> {
    if (!pdfBase64) return "";
    try {
      const res = await fetch("/api/voos/voucher", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: pdfBase64 }),
      });
      const b = await res.json();
      return typeof b.path === "string" ? b.path : "";
    } catch {
      return "";
    }
  }

  async function submitUm() {
    if (salvando) return;
    if (!numeroVoo.trim() && !origem.trim() && !destino.trim()) {
      setErro(t("Informe ao menos o número do voo ou a rota."));
      return;
    }
    setSalvando(true);
    setErro(null);
    const rota = origem && destino ? `${origem.toUpperCase()}→${destino.toUpperCase()}` : "";
    const titulo =
      [numeroVoo.trim().toUpperCase(), rota].filter(Boolean).join(" · ") || t("Voo");
    try {
      const voucherPath = (await subirVoucher()) || voucherPathExistente;
      await onCriar({
        tipo: "voo",
        titulo,
        data: dataVoo,
        diaInteiro: false,
        horaInicio: partida || undefined,
        horaFim: chegada || undefined,
        artistIds: artistIds,
        observacoes: observacoes.trim() || undefined,
        dados: {
          numeroVoo: numeroVoo.trim().toUpperCase(),
          companhia: companhia.trim(),
          origem: origem.trim().toUpperCase(),
          destino: destino.trim().toUpperCase(),
          partida,
          chegada,
          duracao: duracao || calcularDuracao(partida, chegada),
          bagagem: bagagem.trim(),
          voucherPath,
          localizador: localizador.trim(),
          passageiros: passageiros.filter((p) => p.nome.trim()),
        },
      });
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  async function submitTodos() {
    if (!pdfMulti || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      const voucherPath = await subirVoucher();
      for (const v of pdfMulti.filter((x) => x.data)) {
        const rota = v.origem && v.destino ? `${v.origem}→${v.destino}` : "";
        const titulo = [v.numeroVoo, rota].filter(Boolean).join(" · ") || t("Voo");
        await onCriar({
          tipo: "voo",
          titulo,
          data: v.data as string,
          diaInteiro: false,
          horaInicio: v.partida || undefined,
          horaFim: v.chegada || undefined,
          artistIds: artistIds,
          dados: {
            numeroVoo: v.numeroVoo ?? "",
            companhia: v.companhia ?? "",
            origem: v.origem ?? "",
            destino: v.destino ?? "",
            partida: v.partida ?? "",
            chegada: v.chegada ?? "",
            duracao: v.duracao || calcularDuracao(v.partida ?? "", v.chegada ?? ""),
            bagagem: v.bagagem ?? "",
            voucherPath,
            localizador: v.localizador ?? "",
            passageiros: (v.passageiros ?? []).map((n) => ({ nome: n })),
          },
        });
      }
      onClose();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  const multiValidos = (pdfMulti ?? []).filter((v) => v.data);
  const mostrarForm = modo === "manual" || (modo === "pdf" && pdfOk);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={editando ? t("Editar voo") : t("Novo voo")}
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
        {!editando && (
          <div className="grid grid-cols-2 gap-3">
            <ModoCard
              ativo={modo === "manual"}
              onClick={() => setModo("manual")}
              icon={Pencil}
              titulo={t("Preencher manual")}
              desc={t("Digitar os dados do voo na mão.")}
            />
            <ModoCard
              ativo={modo === "pdf"}
              onClick={() => setModo("pdf")}
              icon={FileUp}
              titulo={t("Ler de um PDF")}
              desc={t("Sobe o voucher e preenche sozinho.")}
            />
          </div>
        )}

        {modo === "pdf" && (
          <>
            <label className="flex flex-col items-center justify-center gap-1.5 h-20 border border-dashed border-border rounded-md cursor-pointer text-sm text-muted hover:border-border-strong hover:text-secondary transition-colors">
              <FileUp size={18} />
              <span className="truncate max-w-full px-3">
                {nomeArquivo || t("Escolher PDF do voucher")}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={escolherPdf}
              />
            </label>
            {lendoPdf && <div className="text-sm text-muted">{t("Lendo o voucher…")}</div>}
            {pdfMsg && <div className="text-xs text-secondary">{pdfMsg}</div>}
          </>
        )}

        {modo === "pdf" && pdfMulti && (
          <div className="flex flex-col gap-2">
            <div className="stat-label">{t("Voos encontrados")}</div>
            {pdfMulti.map((v, i) => (
              <div key={i} className="rounded-md border border-border p-2.5">
                <div className="text-sm font-medium text-primary">
                  {[v.numeroVoo, v.origem && v.destino ? `${v.origem}→${v.destino}` : ""]
                    .filter(Boolean)
                    .join(" · ") || t("Voo")}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {[
                    v.companhia,
                    v.data ? formatarDataBR(v.data) : "⚠ " + t("sem data"),
                    [v.partida, v.chegada].filter(Boolean).join("–"),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {(v.passageiros?.length ?? 0) > 0 && (
                  <div className="text-xs text-muted mt-0.5">{v.passageiros!.join(", ")}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {mostrarForm && (
          <>
            <CampoForm label={t("Número do voo")}>
              {modo === "manual" ? (
                <div className="flex gap-2">
                  <input
                    value={numeroVoo}
                    onChange={(e) => setNumeroVoo(e.target.value)}
                    placeholder="LA3477"
                    className="campo-input flex-1 uppercase placeholder:normal-case"
                  />
                  <button
                    type="button"
                    onClick={buscar}
                    disabled={buscando || !numeroVoo.trim()}
                    className="btn btn-secondary text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Search size={14} />
                    {buscando ? t("Buscando…") : t("Buscar")}
                  </button>
                </div>
              ) : (
                <input
                  value={numeroVoo}
                  onChange={(e) => setNumeroVoo(e.target.value)}
                  className="campo-input uppercase placeholder:normal-case"
                />
              )}
              {aviso && <div className="text-[0.7rem] text-muted mt-1.5">{aviso}</div>}
            </CampoForm>

            <div className="grid grid-cols-2 gap-3">
              <CampoForm label={t("Data")}>
                <InputDataBR
                  value={dataVoo}
                  onChange={setDataVoo}
                  className="w-full"
                />
              </CampoForm>
              <CampoForm label={t("Companhia")}>
                <input
                  value={companhia}
                  onChange={(e) => setCompanhia(e.target.value)}
                  className="campo-input"
                />
              </CampoForm>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CampoForm label={t("Origem")}>
                <input
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  placeholder="GRU"
                  className="campo-input uppercase placeholder:normal-case"
                />
              </CampoForm>
              <CampoForm label={t("Destino")}>
                <input
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  placeholder="SCL"
                  className="campo-input uppercase placeholder:normal-case"
                />
              </CampoForm>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <CampoForm label={t("Partida")}>
                <InputHora value={partida} onChange={setPartida} accent="var(--brand)" />
              </CampoForm>
              <CampoForm label={t("Chegada")}>
                <InputHora value={chegada} onChange={setChegada} accent="var(--brand)" />
              </CampoForm>
            </div>

            <CampoForm label={t("Localizador (PNR)")}>
              <input
                value={localizador}
                onChange={(e) => setLocalizador(e.target.value)}
                placeholder="ABC123"
                className="campo-input uppercase placeholder:normal-case"
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
          </>
        )}

        {erro && <div className="text-xs text-danger">{erro}</div>}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn btn-secondary">
            {t("Cancelar")}
          </button>
          {modo === "pdf" && pdfMulti
            ? multiValidos.length > 0 && (
                <button
                  onClick={submitTodos}
                  disabled={salvando}
                  className="btn btn-primary disabled:opacity-50"
                  style={{ backgroundColor: "var(--brand-solid)", color: "#fff" }}
                >
                  {salvando ? t("Adicionando…") : t("Adicionar à agenda")}
                </button>
              )
            : mostrarForm && (
                <button
                  onClick={submitUm}
                  disabled={salvando}
                  className="btn btn-primary disabled:opacity-50"
                  style={{ backgroundColor: "var(--brand-solid)", color: "#fff" }}
                >
                  {salvando ? t("Salvando…") : editando ? t("Salvar alterações") : t("Criar voo")}
                </button>
              )}
        </div>
      </div>
      )}
    </Modal>
  );
}

export type VooExtraido = {
  numeroVoo?: string;
  companhia?: string;
  data?: string;
  origem?: string;
  destino?: string;
  partida?: string;
  chegada?: string;
  duracao?: string;
  bagagem?: string;
  localizador?: string;
  passageiros?: string[];
};
