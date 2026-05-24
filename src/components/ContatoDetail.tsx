"use client";

import { ArrowLeft, Pencil, Mail, Phone, MapPin, Calendar, Music, Building2, Users, FileText, Banknote, Hash } from "lucide-react";
import PageHeader from "./PageHeader";
import { useContatos } from "@/lib/contatos-context";
import {
  getContratanteStats,
  getCasaStats,
  getCidadeStats,
  getCidadeNome,
  formatBRL,
} from "@/lib/contatos-stats";
import { useShows } from "@/lib/shows-context";
import { useOrcamentos } from "@/lib/orcamentos-context";
import { MODULE_THEMES } from "@/types";
import type { Contratante, Casa, Cidade } from "@/types";

type Selecionado =
  | { tipo: "contratante"; item: Contratante }
  | { tipo: "casa"; item: Casa }
  | { tipo: "cidade"; item: Cidade };

type Props = {
  selecionado: Selecionado;
  onBack: () => void;
  onEdit: () => void;
};

const TIPO_CASA_LABEL: Record<string, string> = {
  club: "Club",
  festival: "Festival",
  "festa-privada": "Festa privada",
  bar: "Bar",
  arena: "Arena",
  outro: "Outro",
};

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  confirmado: { label: "Confirmado", cls: "badge-success" },
  pendente: { label: "Pendente", cls: "badge-danger" },
  logistica: { label: "Logística", cls: "badge-warning" },
};

export default function ContatoDetail({ selecionado, onBack, onEdit }: Props) {
  const accent = MODULE_THEMES.contatos.color;
  const { cidades } = useContatos();
  const { shows } = useShows();
  const { orcamentos } = useOrcamentos();

  return (
    <div className="max-w-[1200px] mx-auto w-full p-6 lg:p-8">
      <button
        onClick={onBack}
        className="btn-ghost mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft size={14} />
        Voltar para Contatos
      </button>

      {selecionado.tipo === "contratante" && (
        <ContratanteDetail item={selecionado.item} accent={accent} onEdit={onEdit} />
      )}
      {selecionado.tipo === "casa" && (
        <CasaDetail item={selecionado.item} accent={accent} onEdit={onEdit} />
      )}
      {selecionado.tipo === "cidade" && (
        <CidadeDetail item={selecionado.item} accent={accent} onEdit={onEdit} />
      )}
    </div>
  );

  function ContratanteDetail({
    item,
    accent,
    onEdit,
  }: {
    item: Contratante;
    accent: string;
    onEdit: () => void;
  }) {
    const stats = getContratanteStats(item.id, shows, orcamentos);
    const showsContratante = shows.filter((s) => s.contratanteId === item.id);
    return (
      <>
        <PageHeader
          title={item.nome}
          subtitle={
            <span className="inline-flex items-center gap-2">
              <Users size={12} /> Contratante · cadastrado em{" "}
              {new Date(item.criadoEm).toLocaleDateString("pt-BR")}
            </span>
          }
          accentColor={accent}
          actions={
            <button onClick={onEdit} className="btn btn-secondary">
              <Pencil size={14} />
              Editar
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <MetricTile label="Orçamentos" value={stats.totalOrcamentos.toString()} accent={accent} icon={<FileText size={14} />} />
          <MetricTile label="Total de shows" value={stats.totalShows.toString()} accent={accent} icon={<Music size={14} />} />
          <MetricTile label="Ticket médio" value={stats.ticketMedio > 0 ? formatBRL(stats.ticketMedio) : "—"} icon={<Hash size={14} />} />
          <MetricTile
            label="Último show"
            value={
              stats.ultimoShow
                ? `Dia ${stats.ultimoShow.dayId} — ${stats.ultimoShow.venue}`
                : "Nenhum ainda"
            }
            icon={<Calendar size={14} />}
            small
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
          {/* Informações */}
          <div className="card">
            <div className="section-title mb-4">Informações</div>
            <div className="flex flex-col gap-3 text-sm">
              <InfoRow icon={<Hash size={13} />} label="Documento" value={item.documento || "—"} />
              <InfoRow icon={<Mail size={13} />} label="E-mail" value={item.email || "—"} mono />
              <InfoRow icon={<Phone size={13} />} label="Telefone" value={item.telefone} />
              <InfoRow icon={<MapPin size={13} />} label="Cidade" value={getCidadeNome(item.cidadeId, cidades)} />
              {item.observacoes && (
                <div className="mt-2 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5">
                    <FileText size={13} />
                    Observações
                  </div>
                  <div className="text-sm text-secondary whitespace-pre-wrap">{item.observacoes}</div>
                </div>
              )}
            </div>
          </div>

          {/* Histórico de shows */}
          <div className="card">
            <div className="section-title mb-4">Histórico de shows</div>
            {showsContratante.length === 0 ? (
              <div className="text-sm text-muted py-6 text-center">
                Este contratante ainda não fechou nenhum show.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {showsContratante.map((show) => {
                  const badge = STATUS_BADGES[show.status];
                  return (
                    <div
                      key={show.id}
                      className="bg-elevated border border-border rounded-md p-3 flex items-center gap-3"
                    >
                      <div className="h-10 w-10 rounded-md bg-surface-2 flex items-center justify-center text-secondary flex-shrink-0">
                        <Music size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-primary">{show.dj}</span>
                          <span className={`badge ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <div className="text-xs text-muted truncate">
                          {show.venue} · {show.location} · Dia {show.dayId} · {show.time}
                        </div>
                      </div>
                      {show.valor && (
                        <div className="text-right">
                          <div className="text-xs text-muted">Valor</div>
                          <div className="text-sm font-semibold tabular-nums">{formatBRL(show.valor)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  function CasaDetail({ item, accent, onEdit }: { item: Casa; accent: string; onEdit: () => void }) {
    const stats = getCasaStats(item.id, shows);
    const showsCasa = shows.filter((s) => s.casaId === item.id);
    return (
      <>
        <PageHeader
          title={item.nome}
          subtitle={
            <span className="inline-flex items-center gap-2">
              <Building2 size={12} /> {TIPO_CASA_LABEL[item.tipo]} ·{" "}
              {getCidadeNome(item.cidadeId, cidades)}
            </span>
          }
          accentColor={accent}
          actions={
            <button onClick={onEdit} className="btn btn-secondary">
              <Pencil size={14} />
              Editar
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <MetricTile label="Total de shows" value={stats.totalShows.toString()} accent={accent} icon={<Music size={14} />} />
          <MetricTile label="Faturamento" value={formatBRL(stats.faturamento)} accent={accent} icon={<Banknote size={14} />} />
          <MetricTile label="Capacidade" value={item.capacidade?.toLocaleString("pt-BR") ?? "—"} icon={<Users size={14} />} />
          <MetricTile label="DJs que tocaram" value={stats.djsQueTocaram.length.toString()} icon={<Music size={14} />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
          <div className="card">
            <div className="section-title mb-4">Informações</div>
            <div className="flex flex-col gap-3 text-sm">
              <InfoRow icon={<Hash size={13} />} label="Tipo" value={TIPO_CASA_LABEL[item.tipo]} />
              <InfoRow icon={<MapPin size={13} />} label="Cidade" value={getCidadeNome(item.cidadeId, cidades)} />
              {item.endereco && <InfoRow icon={<MapPin size={13} />} label="Endereço" value={item.endereco} />}
              {item.contatoResponsavel && (
                <InfoRow icon={<Users size={13} />} label="Responsável" value={item.contatoResponsavel} />
              )}
              {item.telefone && <InfoRow icon={<Phone size={13} />} label="Telefone" value={item.telefone} />}
              {item.observacoes && (
                <div className="mt-2 pt-3 border-t border-border">
                  <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5">
                    <FileText size={13} />
                    Observações
                  </div>
                  <div className="text-sm text-secondary whitespace-pre-wrap">{item.observacoes}</div>
                </div>
              )}
            </div>

            {stats.djsQueTocaram.length > 0 && (
              <div className="mt-5 pt-5 border-t border-border">
                <div className="text-xs text-muted mb-2 uppercase tracking-wider font-semibold">
                  DJs que já tocaram aqui
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.djsQueTocaram.map((dj) => (
                    <span key={dj} className="badge badge-neutral">{dj}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title mb-4">Shows realizados</div>
            {showsCasa.length === 0 ? (
              <div className="text-sm text-muted py-6 text-center">
                Nenhum show registrado nesta casa ainda.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {showsCasa.map((show) => {
                  const badge = STATUS_BADGES[show.status];
                  return (
                    <div key={show.id} className="bg-elevated border border-border rounded-md p-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-surface-2 flex items-center justify-center text-secondary flex-shrink-0">
                        <Music size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-primary">{show.dj}</span>
                          <span className={`badge ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <div className="text-xs text-muted truncate">
                          Dia {show.dayId} · {show.time}
                        </div>
                      </div>
                      {show.valor && (
                        <div className="text-sm font-semibold tabular-nums flex-shrink-0">{formatBRL(show.valor)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  function CidadeDetail({ item, accent, onEdit }: { item: Cidade; accent: string; onEdit: () => void }) {
    const stats = getCidadeStats(item.id, shows);
    const { casas } = useContatos();
    const casasAqui = casas.filter((c) => c.cidadeId === item.id);
    const showsCidade = shows.filter((s) => s.cidadeId === item.id);

    return (
      <>
        <PageHeader
          title={item.nome}
          subtitle={
            <span className="inline-flex items-center gap-2">
              <MapPin size={12} /> {item.estado} · {item.regiao}
            </span>
          }
          accentColor={accent}
          actions={
            <button onClick={onEdit} className="btn btn-secondary">
              <Pencil size={14} />
              Editar
            </button>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          <MetricTile label="Casas cadastradas" value={stats.totalCasas.toString()} accent={accent} icon={<Building2 size={14} />} />
          <MetricTile label="Total de shows" value={stats.totalShows.toString()} accent={accent} icon={<Music size={14} />} />
          <MetricTile label="Faturamento" value={formatBRL(stats.faturamento)} icon={<Banknote size={14} />} />
          <MetricTile
            label="Top DJ"
            value={stats.topDJ ? `${stats.topDJ.nome} (${stats.topDJ.shows})` : "—"}
            icon={<Music size={14} />}
            small
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card">
            <div className="section-title mb-4">Casas nesta cidade</div>
            {casasAqui.length === 0 ? (
              <div className="text-sm text-muted py-6 text-center">Nenhuma casa cadastrada aqui.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {casasAqui.map((c) => (
                  <div key={c.id} className="bg-elevated border border-border rounded-md p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-primary">{c.nome}</div>
                      <div className="text-xs text-muted">{TIPO_CASA_LABEL[c.tipo]}</div>
                    </div>
                    {c.capacidade && (
                      <div className="text-xs text-secondary flex items-center gap-1 flex-shrink-0">
                        <Users size={12} />
                        {c.capacidade.toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="section-title mb-4">Shows nesta cidade</div>
            {showsCidade.length === 0 ? (
              <div className="text-sm text-muted py-6 text-center">Nenhum show realizado aqui ainda.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {showsCidade.map((show) => {
                  const badge = STATUS_BADGES[show.status];
                  return (
                    <div key={show.id} className="bg-elevated border border-border rounded-md p-3 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-md bg-surface-2 flex items-center justify-center text-secondary flex-shrink-0">
                        <Music size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-primary">{show.dj}</span>
                          <span className={`badge ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <div className="text-xs text-muted truncate">
                          {show.venue} · Dia {show.dayId}
                        </div>
                      </div>
                      {show.valor && (
                        <div className="text-sm font-semibold tabular-nums flex-shrink-0">{formatBRL(show.valor)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
}

// ---------- Componentes auxiliares ----------

function MetricTile({
  label,
  value,
  accent,
  icon,
  small,
}: {
  label: string;
  value: string;
  accent?: string;
  icon: React.ReactNode;
  small?: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className="stat-label">{label}</span>
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center"
          style={{
            backgroundColor: accent ? `${accent}15` : "var(--bg-elevated)",
            color: accent ?? "var(--text-secondary)",
          }}
        >
          {icon}
        </div>
      </div>
      <div className={small ? "text-base font-semibold" : "stat-value"}>{value}</div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[0.65rem] uppercase tracking-wider text-muted font-semibold mb-0.5">
          {label}
        </div>
        <div className={`text-sm text-primary break-words ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
    </div>
  );
}
