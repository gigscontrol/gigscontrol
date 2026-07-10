"use client";

import { useState } from "react";
import {
  Hotel,
  MapPin,
  Phone,
  CalendarDays,
  BedDouble,
  Users,
  Copy,
  Check,
  Upload,
  Download,
  FileText,
  Pencil,
  Send,
  StickyNote,
} from "lucide-react";
import { useT, type Traduzir } from "@/lib/i18n";
import type { BookingShow } from "@/types";

type Props = {
  showId: string;
  booking?: BookingShow;
  podeEditar: boolean;
  onSave: (booking: BookingShow) => Promise<void>;
};

const VAZIO: BookingShow = { status: "informado" };

/** Checklist pronto pra mandar ao contratante pedindo os dados da hospedagem. */
function mensagemSolicitacao(t: Traduzir): string {
  return [
    `*${t("Booking / Hospedagem")}*`,
    "",
    t("Pra organizar a hospedagem, preciso destas informações:"),
    `• ${t("Nome e endereço do hotel")}`,
    `• ${t("Check-in e check-out")}`,
    `• ${t("Número de quartos e ocupação")}`,
    `• ${t("Telefone / contato do hotel")}`,
    `• ${t("Voucher (se já tiver)")}`,
  ].join("\n");
}

const INPUT =
  "w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-primary outline-none focus:border-border-strong";

export default function BookingSection({ showId, booking, podeEditar, onSave }: Props) {
  const t = useT();
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<BookingShow>(booking ?? VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [subindo, setSubindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const set = <K extends keyof BookingShow>(k: K, v: BookingShow[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function solicitar() {
    try {
      await navigator.clipboard.writeText(mensagemSolicitacao(t));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* clipboard indisponível */
    }
    // Marca "solicitado" se ainda não há registro (não sobrescreve dados já informados).
    if (!booking) {
      setSalvando(true);
      try {
        await onSave({ status: "solicitado" });
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setSalvando(false);
      }
    }
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onSave({ ...form, status: "informado" });
      setEditando(false);
    } catch (e) {
      setErro((e as Error).message ?? t("Falha ao salvar."));
    } finally {
      setSalvando(false);
    }
  }

  async function subirVoucher(file: File) {
    setSubindo(true);
    setErro(null);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(new Error(t("Falha ao ler o arquivo.")));
        fr.readAsDataURL(file);
      });
      const res = await fetch(`/api/shows/${showId}/booking-voucher`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: b64 }),
      });
      const body = (await res.json().catch(() => ({}))) as { path?: string; erro?: string };
      if (!res.ok) throw new Error(body.erro ?? `HTTP ${res.status}`);
      set("voucherPath", body.path);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSubindo(false);
    }
  }

  async function baixarVoucher(path: string) {
    setErro(null);
    try {
      const res = await fetch(
        `/api/shows/${showId}/booking-voucher?path=${encodeURIComponent(path)}`,
        { credentials: "include" }
      );
      const body = (await res.json().catch(() => ({}))) as { url?: string; erro?: string };
      if (!res.ok || !body.url) throw new Error(body.erro ?? t("Falha ao baixar."));
      window.open(body.url, "_blank");
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  // ---------- VISÃO (não editando) ----------
  if (!editando) {
    const temDados = !!booking && booking.status === "informado";

    const acoes = podeEditar && (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={solicitar}
          disabled={salvando}
          className="btn-ghost text-xs inline-flex items-center gap-1.5"
        >
          {copiado ? <Check size={13} /> : <Send size={13} />}
          {copiado ? t("Copiado!") : t("Solicitar ao contratante")}
        </button>
        <button
          type="button"
          onClick={() => {
            setForm(booking ?? VAZIO);
            setEditando(true);
          }}
          className="btn btn-secondary text-xs inline-flex items-center gap-1.5"
        >
          <Pencil size={13} />
          {temDados ? t("Editar") : t("Registrar hospedagem")}
        </button>
      </div>
    );

    // Estado vazio (sem hospedagem informada) — bloco pontilhado enxuto.
    if (!booking || booking.status !== "informado") {
      return (
        <div className="flex flex-col items-center text-center gap-3 py-5 px-3 rounded-lg border border-dashed border-border bg-elevated">
          <div
            className="h-11 w-11 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "var(--surface)" }}
          >
            <Hotel size={20} className="text-muted" />
          </div>
          <div>
            <div className="text-sm font-medium text-primary">
              {booking ? t("Booking solicitado ao contratante") : t("Nenhuma hospedagem registrada")}
            </div>
            <div className="text-xs text-muted mt-0.5">
              {t("Solicite os dados ao contratante ou registre você mesmo.")}
            </div>
          </div>
          {acoes}
          {erro && <div className="text-xs text-danger">{erro}</div>}
        </div>
      );
    }

    // Estado com dados — cartão do hotel + grade de infos.
    const b = booking;
    const celulas = [
      { icon: <CalendarDays size={12} />, label: t("Check-in"), value: fmtData(b.checkin) },
      { icon: <CalendarDays size={12} />, label: t("Check-out"), value: fmtData(b.checkout) },
      {
        icon: <BedDouble size={12} />,
        label: t("Quartos"),
        value: [b.quartos ? `${b.quartos}` : "", b.quarto ? `nº ${b.quarto}` : ""]
          .filter(Boolean)
          .join(" · "),
      },
      { icon: <Users size={12} />, label: t("Ocupação"), value: b.ocupacao ?? "" },
      { icon: <Phone size={12} />, label: t("Telefone"), value: b.telefone ?? "" },
    ].filter((c) => c.value);
    const temMapa = !!b.localizacao && /^https?:\/\//i.test(b.localizacao);

    return (
      <div className="flex flex-col gap-3">
        {/* Cartão do hotel */}
        <div className="rounded-lg border border-border bg-elevated overflow-hidden">
          <div
            className="p-3 flex items-start justify-between gap-3"
            style={{ borderLeft: "3px solid var(--brand)" }}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: "var(--surface)", color: "var(--brand)" }}
              >
                <Hotel size={17} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-primary truncate">
                  {b.hotelNome || t("Hotel")}
                </div>
                {b.endereco && (
                  <div className="text-xs text-muted flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="flex-shrink-0" />
                    <span className="truncate">{b.endereco}</span>
                  </div>
                )}
              </div>
            </div>
            <span className={`badge flex-shrink-0 ${b.pago ? "badge-success" : "badge-warning"}`}>
              {b.pago ? t("Hotel pago") : t("Hotel não pago")}
            </span>
          </div>

          {celulas.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border border-t border-border">
              {celulas.map((c) => (
                <div key={c.label} className="bg-elevated p-2.5 min-w-0">
                  <div className="text-[0.6rem] uppercase tracking-wide text-muted inline-flex items-center gap-1">
                    {c.icon}
                    {c.label}
                  </div>
                  <div className="text-sm text-primary mt-0.5 truncate">{c.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ações rápidas: mapa + voucher */}
        {(temMapa || b.voucherPath) && (
          <div className="flex items-center gap-2 flex-wrap">
            {temMapa && (
              <a
                href={b.localizacao}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost text-xs inline-flex items-center gap-1.5"
              >
                <MapPin size={13} /> {t("Ver no mapa")}
              </a>
            )}
            {b.voucherPath && (
              <button
                type="button"
                onClick={() => baixarVoucher(b.voucherPath as string)}
                className="btn-ghost text-xs inline-flex items-center gap-1.5"
              >
                <Download size={13} /> {t("Baixar voucher")}
              </button>
            )}
          </div>
        )}

        {b.observacoes && (
          <div className="text-xs text-secondary bg-elevated border border-border rounded-md p-2.5 flex items-start gap-2">
            <StickyNote size={13} className="text-muted flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap min-w-0">{b.observacoes}</span>
          </div>
        )}

        {/* Rodapé: status + autoria + ações */}
        <div className="flex items-center justify-between gap-2 flex-wrap border-t border-border pt-2.5">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="badge badge-success">{t("Hospedagem informada")}</span>
            {b.atualizadoPor && (
              <span className="text-[0.65rem] text-muted truncate">
                {t("Atualizado por")} {b.atualizadoPor}
                {b.atualizadoEm ? ` · ${fmtDataHora(b.atualizadoEm)}` : ""}
              </span>
            )}
          </div>
          {acoes}
        </div>
        {erro && <div className="text-xs text-danger">{erro}</div>}
      </div>
    );
  }

  // ---------- EDIÇÃO ----------
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <CampoInput label={t("Nome do hotel")} value={form.hotelNome} onChange={(v) => set("hotelNome", v)} />
        <CampoInput label={t("Telefone / contato")} value={form.telefone} onChange={(v) => set("telefone", v)} />
        <div className="sm:col-span-2">
          <CampoInput label={t("Endereço")} value={form.endereco} onChange={(v) => set("endereco", v)} />
        </div>
        <div className="sm:col-span-2">
          <CampoInput
            label={t("Localização (link do mapa)")}
            value={form.localizacao}
            onChange={(v) => set("localizacao", v)}
            placeholder="https://maps.google.com/…"
          />
        </div>
        <div>
          <label className="stat-label block mb-1">{t("Check-in")}</label>
          <input type="date" className={INPUT} value={form.checkin ?? ""} onChange={(e) => set("checkin", e.target.value)} />
        </div>
        <div>
          <label className="stat-label block mb-1">{t("Check-out")}</label>
          <input type="date" className={INPUT} value={form.checkout ?? ""} onChange={(e) => set("checkout", e.target.value)} />
        </div>
        <div>
          <label className="stat-label block mb-1">{t("Nº de quartos")}</label>
          <input
            type="number"
            min={0}
            className={INPUT}
            value={form.quartos ?? ""}
            onChange={(e) => set("quartos", e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <CampoInput label={t("Nº do quarto")} value={form.quarto} onChange={(v) => set("quarto", v)} />
        <div className="sm:col-span-2">
          <CampoInput
            label={t("Ocupação (quem fica onde)")}
            value={form.ocupacao}
            onChange={(v) => set("ocupacao", v)}
          />
        </div>
      </div>

      {/* Pago + voucher */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-t border-border pt-3">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={!!form.pago}
            onChange={(e) => set("pago", e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} /> {t("Hotel já está pago")}
          </span>
        </label>
        <div className="flex items-center gap-2">
          {form.voucherPath && (
            <span className="text-xs text-success inline-flex items-center gap-1">
              <FileText size={13} /> {t("Voucher anexado")}
            </span>
          )}
          <label className="btn btn-secondary text-xs inline-flex items-center gap-1.5 cursor-pointer">
            {subindo ? (
              t("Enviando…")
            ) : (
              <>
                <Upload size={13} /> {form.voucherPath ? t("Trocar voucher") : t("Anexar voucher (PDF)")}
              </>
            )}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={subindo}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subirVoucher(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div>
        <label className="stat-label block mb-1">{t("Observações")}</label>
        <textarea
          rows={2}
          className={`${INPUT} resize-none`}
          value={form.observacoes ?? ""}
          onChange={(e) => set("observacoes", e.target.value)}
        />
      </div>

      {erro && <div className="text-xs text-danger">{erro}</div>}

      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => setEditando(false)} disabled={salvando} className="btn-ghost text-sm">
          {t("Cancelar")}
        </button>
        <button type="button" onClick={salvar} disabled={salvando} className="btn btn-primary text-sm">
          {salvando ? t("Salvando…") : t("Salvar hospedagem")}
        </button>
      </div>
    </div>
  );
}

// ---------- Auxiliares ----------

function CampoInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="stat-label block mb-1">{label}</label>
      <input
        type="text"
        className={INPUT}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function fmtData(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
