"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  History,
  ShoppingBag,
  FileText,
  Wallet,
  Music,
  Users,
  Palette,
  Trash2,
  CalendarRange,
  UserCircle,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-context";
import type {
  HistoricoAcao,
  ModuloHistorico,
} from "@/lib/mappers/historico";

type Periodo = "tudo" | "24h" | "7d" | "30d";

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: "24h", label: "24 horas" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
  { id: "tudo", label: "Tudo" },
];

const MODULOS: {
  id: ModuloHistorico | "todos";
  label: string;
  icon: typeof History;
  cor: string;
}[] = [
  { id: "todos", label: "Todos", icon: History, cor: "var(--text-secondary)" },
  { id: "venda", label: "Vendas", icon: ShoppingBag, cor: "var(--module-vendas)" },
  { id: "orcamento", label: "Orçamentos", icon: FileText, cor: "var(--module-vendas)" },
  { id: "parcela", label: "Parcelas", icon: Wallet, cor: "var(--module-financeiro)" },
  { id: "artista", label: "Artistas", icon: Music, cor: "var(--module-agenda)" },
  { id: "equipe", label: "Equipe", icon: Users, cor: "var(--module-contatos)" },
  { id: "lixeira", label: "Lixeira", icon: Trash2, cor: "var(--text-muted)" },
  { id: "aparencia", label: "Aparência", icon: Palette, cor: "var(--module-vendas)" },
];

const LIMIT = 50;

export default function AbaHistorico() {
  const { carregarHistorico } = useWorkspace();
  const [itens, setItens] = useState<HistoricoAcao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modulo, setModulo] = useState<ModuloHistorico | "todos">("todos");
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [offset, setOffset] = useState(0);
  const [temMais, setTemMais] = useState(false);

  const carregar = useCallback(
    async (resetar: boolean) => {
      setCarregando(true);
      setErro(null);
      try {
        const novoOffset = resetar ? 0 : offset;
        const novos = await carregarHistorico({
          modulo: modulo === "todos" ? undefined : modulo,
          periodo: periodo === "tudo" ? undefined : periodo,
          limit: LIMIT,
          offset: novoOffset,
        });
        setItens((prev) => (resetar ? novos : [...prev, ...novos]));
        setOffset(novoOffset + novos.length);
        setTemMais(novos.length === LIMIT);
      } catch (e) {
        setErro((e as Error).message);
      } finally {
        setCarregando(false);
      }
    },
    [carregarHistorico, modulo, periodo, offset]
  );

  // Recarrega quando filtros mudam
  useEffect(() => {
    void carregar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulo, periodo]);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Cabeçalho */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <History size={16} style={{ color: "var(--module-vendas)" }} />
          <div className="section-title">Histórico de ações</div>
        </div>
        <div className="section-subtitle">
          Trilha de auditoria do workspace — quem fez o quê e quando. Visível
          apenas para o admin.
        </div>
      </div>

      {/* Filtros */}
      <div className="card flex flex-col gap-3">
        <div>
          <div className="text-[0.65rem] uppercase tracking-wider font-semibold text-muted mb-1.5">
            Período
          </div>
          <div className="pill-group flex-wrap">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                className={`pill ${periodo === p.id ? "active" : ""}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[0.65rem] uppercase tracking-wider font-semibold text-muted mb-1.5">
            Módulo
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MODULOS.map((m) => {
              const Icon = m.icon;
              const sel = modulo === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setModulo(m.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    backgroundColor: sel ? `${m.cor}22` : "var(--bg-elevated)",
                    color: sel ? m.cor : "var(--text-muted)",
                    boxShadow: sel ? `0 0 0 1px ${m.cor}` : "none",
                  }}
                >
                  <Icon size={12} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="card p-0 overflow-hidden">
        {carregando && itens.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">Carregando...</div>
        ) : erro ? (
          <div className="py-12 text-center text-sm" style={{ color: "var(--danger)" }}>
            {erro}
          </div>
        ) : itens.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted">
            Nenhuma ação registrada no período/módulo selecionado.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {itens.map((item) => (
              <LinhaAcao key={item.id} item={item} />
            ))}
          </div>
        )}

        {temMais && !carregando && (
          <div className="p-3 border-t border-border text-center">
            <button
              onClick={() => carregar(false)}
              className="btn btn-secondary text-xs"
            >
              Carregar mais
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Linha de ação
// ============================================================

function LinhaAcao({ item }: { item: HistoricoAcao }) {
  const moduloInfo = useMemo(
    () => MODULOS.find((m) => m.id === item.modulo) ?? MODULOS[0],
    [item.modulo]
  );
  const Icon = moduloInfo.icon;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${moduloInfo.cor}1c`, color: moduloInfo.cor }}
      >
        <Icon size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-primary">{item.descricao}</div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
          <UserCircle size={11} />
          <span className="truncate">
            {item.actorNome ?? item.actorEmail ?? "Sistema"}
          </span>
          <span>·</span>
          <CalendarRange size={11} />
          <span>{formatarTempoRelativo(item.criadoEm)}</span>
        </div>
      </div>
    </div>
  );
}

function formatarTempoRelativo(iso: string): string {
  const data = new Date(iso);
  const diffMs = Date.now() - data.getTime();
  const minutos = Math.floor(diffMs / 60000);
  if (minutos < 1) return "agora há pouco";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `há ${dias} dia${dias === 1 ? "" : "s"}`;
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
