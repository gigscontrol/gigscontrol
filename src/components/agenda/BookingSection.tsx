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
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {booking ? (
            <span
              className={`badge ${
                booking.status === "informado" ? "badge-success" : "badge-warning"
              }`}
            >
              {booking.status === "informado" ? t("Hospedagem informada") : t("Booking solicitado")}
            </span>
          ) : (
            <span className="badge badge-neutral">{t("Sem booking")}</span>
          )}
          {podeEditar && (
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
          )}
        </div>

        {temDados && booking && (
          <div className="flex flex-col gap-1.5 text-sm">
            {booking.hotelNome && (
              <Linha icon={<Hotel size={13} />} bold>
                {booking.hotelNome}
              </Linha>
            )}
            {booking.endereco && <Linha icon={<MapPin size={13} />}>{booking.endereco}</Linha>}
            {(booking.checkin || booking.checkout) && (
              <Linha icon={<CalendarDays size={13} />}>
                {t("Check-in")}: {fmtData(booking.checkin) || "—"} · {t("Check-out")}:{" "}
                {fmtData(booking.checkout) || "—"}
              </Linha>
            )}
            {(booking.quartos || booking.quarto || booking.ocupacao) && (
              <Linha icon={<BedDouble size={13} />}>
                {[
                  booking.quartos ? t("{n} quarto(s)", { n: booking.quartos }) : "",
                  booking.quarto ? `${t("Quarto")} ${booking.quarto}` : "",
                  booking.ocupacao,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Linha>
            )}
            {booking.telefone && <Linha icon={<Phone size={13} />}>{booking.telefone}</Linha>}
            {booking.localizacao && (
              <Linha icon={<MapPin size={13} />}>
                {/^https?:\/\//i.test(booking.localizacao) ? (
                  <a
                    href={booking.localizacao}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-primary break-all"
                  >
                    {booking.localizacao}
                  </a>
                ) : (
                  <span className="break-all">{booking.localizacao}</span>
                )}
              </Linha>
            )}
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className={`badge ${booking.pago ? "badge-success" : "badge-warning"}`}>
                {booking.pago ? t("Hotel pago") : t("Hotel não pago")}
              </span>
              {booking.voucherPath && (
                <button
                  type="button"
                  onClick={() => baixarVoucher(booking.voucherPath as string)}
                  className="btn-ghost text-xs inline-flex items-center gap-1.5"
                >
                  <Download size={13} /> {t("Baixar voucher")}
                </button>
              )}
            </div>
            {booking.observacoes && (
              <Linha icon={<StickyNote size={13} />} subtle>
                {booking.observacoes}
              </Linha>
            )}
            {booking.atualizadoPor && (
              <div className="text-[0.65rem] text-muted mt-1">
                {t("Atualizado por")} {booking.atualizadoPor}
                {booking.atualizadoEm ? ` · ${fmtDataHora(booking.atualizadoEm)}` : ""}
              </div>
            )}
          </div>
        )}
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

function Linha({
  icon,
  bold,
  subtle,
  children,
}: {
  icon: React.ReactNode;
  bold?: boolean;
  subtle?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-start gap-2 ${
        bold ? "text-primary font-semibold" : subtle ? "text-muted" : "text-secondary"
      }`}
    >
      <span className="mt-0.5 text-muted flex-shrink-0">{icon}</span>
      <span className="min-w-0">{children}</span>
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
