"use client";

import { useEffect, useId, useState, useRef, type ReactNode } from "react";
import {
  Music,
  Calendar,
  Plus,
  Plane,
  Car,
  Trash2,
  X,
  Check,
  ArrowLeft,
} from "lucide-react";
import type { Artista, AgendaItem } from "@/types";
import InputDataBR from "../inputs/InputDataBR";
import { useT } from "@/lib/i18n";
import { corComoTexto } from "@/lib/contraste";

export const META_TIPO: Record<AgendaItem["tipo"], { label: string; icon: typeof Music; cor: string }> = {
  evento: { label: "Evento", icon: Calendar, cor: "var(--brand)" },
  voo: { label: "Voo", icon: Plane, cor: "var(--brand)" },
  transporte: { label: "Transporte", icon: Car, cor: "var(--brand)" },
};

// A agenda usa o mesmo formatador do resto do painel (segue a preferência
// DD/MM × MM/DD). Antes havia aqui um homônimo que ignorava a preferência.
export { formatarDataBR } from "@/lib/formatters";

/** Nomes dos artistas (juntos) a partir dos ids; undefined se vazio. */
export function labelArtistas(ids: string[], artistas: Artista[]): string | undefined {
  if (!ids.length) return undefined;
  const nomes = ids
    .map((id) => artistas.find((a) => a.id === id)?.name)
    .filter(Boolean) as string[];
  return nomes.length ? nomes.join(", ") : undefined;
}

/** Card compacto de um item da agenda (evento/voo/transporte) no dia. */
export function AgendaItemCard({
  item,
  artistaLabel,
  onClick,
}: {
  item: AgendaItem;
  artistaLabel?: string;
  onClick: () => void;
}) {
  const t = useT();
  const meta = META_TIPO[item.tipo];
  const Icone = meta.icon;
  const horario = item.diaInteiro
    ? t("Dia inteiro")
    : [item.horaInicio, item.horaFim].filter(Boolean).join("–");
  const sub = [horario, artistaLabel].filter(Boolean).join(" · ");
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left mb-1.5 rounded-md border p-2 transition-colors hover:border-border-strong"
      style={{
        borderColor: "var(--border-color)",
        backgroundColor: `color-mix(in srgb, ${meta.cor} 8%, transparent)`,
      }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Icone size={12} style={{ color: meta.cor, flexShrink: 0 }} />
        <span className="text-xs font-medium text-primary truncate">
          {item.titulo || t(meta.label)}
        </span>
      </div>
      {sub && <div className="text-[0.6875rem] text-muted mt-0.5 truncate">{sub}</div>}
    </button>
  );
}

/**
 * Campo rotulado do form. O `<label>` ENVOLVE o campo — antes era irmão, sem
 * ligação, e o leitor de tela anunciava o campo sem nome.
 *
 * `grupo`: conteúdo com vários controles (chips, botões segmentados, lista
 * de passageiros) — vira um grupo nomeado. Um `<label>` em volta de botões
 * faria o clique no rótulo acionar o 1º botão.
 */
export function CampoForm({
  label,
  children,
  grupo = false,
}: {
  label: string;
  children: ReactNode;
  grupo?: boolean;
}) {
  const id = useId();
  if (grupo) {
    return (
      <div role="group" aria-labelledby={id} className="flex flex-col gap-1.5">
        <span id={id} className="text-xs font-medium text-muted">
          {label}
        </span>
        {children}
      </div>
    );
  }
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Seleção múltipla de artistas em chips (cor do artista quando ativo). Reusado por
 *  Evento (label "Artistas") e Voo (label "Passageiros"). Exportado pra bancada
 *  dev (src/app/dev) e reuso futuro. */
export function SeletorArtistas({
  artistas,
  value,
  onChange,
  label,
  hintVazio,
}: {
  artistas: Artista[];
  value: string[];
  onChange: (ids: string[]) => void;
  label: string;
  hintVazio?: string;
}) {
  const t = useT();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [aberto]);
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const selecionados = artistas.filter((a) => value.includes(a.id));
  const q = busca.trim().toLowerCase();
  const filtrados = q ? artistas.filter((a) => a.name.toLowerCase().includes(q)) : artistas;
  return (
    <CampoForm label={label} grupo>
      <div className="relative" ref={ref}>
        {selecionados.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selecionados.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border"
                style={{
                  borderColor: a.color,
                  backgroundColor: `color-mix(in srgb, ${a.color} 16%, transparent)`,
                  color: corComoTexto(a.color),
                }}
              >
                {a.name}
                <button type="button" onClick={() => toggle(a.id)} aria-label={t("Remover")}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        <input aria-label={t("Buscar artista")}
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          placeholder={t("Buscar artista…")}
          className="campo-input w-full"
        />
        {/* Lista NO FLUXO, não em overlay (fix 28/08/2026): este seletor vive
            dentro de Modal, cuja área de conteúdo tem overflow-y-auto — um
            dropdown absoluto era CORTADO pela rolagem do modal e "comia" o
            formulário. Expandindo no fluxo, o modal cresce/rola naturalmente
            e a lista tem o próprio scroll. Vale pros 3 forms (Evento, Voo,
            Transporte), que reusam este componente. */}
        {aberto && (
          <div className="mt-1 max-h-52 overflow-y-auto bg-elevated border border-border rounded-lg">
            {filtrados.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted">{t("Nenhum artista")}</div>
            ) : (
              filtrados.map((a) => {
                const ativo = value.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(a.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface transition-colors"
                  >
                    <span
                      className="h-4 w-4 rounded border flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: ativo ? a.color : "var(--border-strong)",
                        backgroundColor: ativo ? a.color : "transparent",
                      }}
                    >
                      {ativo && <Check size={11} color="#fff" />}
                    </span>
                    <span
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: a.color }}
                    />
                    <span className="text-primary truncate">{a.name}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      {value.length === 0 && hintVazio && (
        <div className="text-[0.7rem] text-muted mt-1.5">{hintVazio}</div>
      )}
    </CampoForm>
  );
}

/** Passo 1 dos forms de item: "pra qual artista?" antes do formulário. */
export function PassoArtista({
  artistas,
  value,
  onChange,
  onCancelar,
  onContinuar,
  cor,
}: {
  artistas: Artista[];
  value: string[];
  onChange: (ids: string[]) => void;
  onCancelar: () => void;
  onContinuar: () => void;
  cor: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-4">
      <SeletorArtistas
        artistas={artistas}
        value={value}
        onChange={onChange}
        label={t("Para qual artista?")}
        hintVazio={t("Nenhum selecionado = vale para todos os artistas")}
      />
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancelar} className="btn btn-secondary">
          {t("Cancelar")}
        </button>
        <button
          onClick={onContinuar}
          className="btn btn-primary"
          style={{ backgroundColor: cor, color: "#fff" }}
        >
          {t("Continuar")}
        </button>
      </div>
    </div>
  );
}

/** Cabeçalho da etapa 2: mostra pra quem é o item + volta pra trocar o artista. */
export function VoltarArtista({
  artistas,
  ids,
  onVoltar,
}: {
  artistas: Artista[];
  ids: string[];
  onVoltar: () => void;
}) {
  const t = useT();
  const resumo = labelArtistas(ids, artistas) ?? t("Todos os artistas");
  return (
    <button
      type="button"
      onClick={onVoltar}
      className="self-start inline-flex items-center gap-1.5 text-sm text-muted hover:text-secondary transition-colors"
    >
      <ArrowLeft size={14} />
      <span className="truncate max-w-[16rem]">{resumo}</span>
    </button>
  );
}

export type Passageiro = {
  nome: string;
  nascimento?: string;
  bagagemExtra?: boolean;
};

/** Passageiros guardados (array de objeto OU string) → array do form. */
export function passageirosDe(item?: AgendaItem): Passageiro[] {
  const arr = item?.dados?.passageiros;
  if (!Array.isArray(arr)) return [];
  return arr.map((p) => (typeof p === "string" ? { nome: p } : (p as Passageiro)));
}

/** Lista repetível de passageiros (nome obrigatório; nascimento/bagagem opcionais). */
export function PassageirosField({
  value,
  onChange,
}: {
  value: Passageiro[];
  onChange: (p: Passageiro[]) => void;
}) {
  const t = useT();
  const setP = (i: number, patch: Partial<Passageiro>) =>
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  return (
    <CampoForm label={t("Passageiros")} grupo>
      <div className="flex flex-col gap-2">
        {value.map((p, i) => (
          <div key={i} className="rounded-md border border-border p-2.5 flex flex-col gap-2">
            <div className="flex gap-2 items-center">
              <input aria-label={t("Nome do passageiro")}
                value={p.nome}
                onChange={(e) => setP(i, { nome: e.target.value })}
                placeholder={t("Nome completo")}
                className="campo-input flex-1"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="alvo-toque text-muted hover:text-danger p-1"
                aria-label={t("Remover")}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-stretch gap-2">
              <InputDataBR
                value={p.nascimento ?? ""}
                onChange={(iso) => setP(i, { nascimento: iso })}
                className="flex-1"
                title={t("Nascimento")}
                aria-label={t("Nascimento")}
              />
              <button
                type="button"
                onClick={() => setP(i, { bagagemExtra: !p.bagagemExtra })}
                aria-pressed={!!p.bagagemExtra}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors"
                style={
                  p.bagagemExtra
                    ? {
                        color: "var(--brand)",
                        borderColor: "color-mix(in srgb, var(--brand) 45%, transparent)",
                        backgroundColor:
                          "color-mix(in srgb, var(--brand) 16%, transparent)",
                      }
                    : { color: "var(--text-muted)", borderColor: "var(--border-color)" }
                }
              >
                <Check size={13} style={{ opacity: p.bagagemExtra ? 1 : 0.35 }} />
                {t("Bagagem extra")}
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...value, { nome: "" }])}
          className="flex items-center justify-center gap-1.5 h-9 border border-dashed border-border rounded-md text-sm text-muted hover:text-secondary hover:border-border-strong transition-colors"
        >
          <Plus size={14} /> {t("Adicionar passageiro")}
        </button>
      </div>
    </CampoForm>
  );
}
