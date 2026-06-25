"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import {
  Trash2,
  RotateCcw,
  Music,
  Users,
  FileText,
  ShoppingBag,
  Building2,
  MapPin,
  UserCircle,
  CalendarRange,
} from "lucide-react";
import Toast from "../Toast";
import { useWorkspace, type TipoLixeira } from "@/lib/workspace-context";

/**
 * Aba "Lixeira".
 *
 * Lista artistas, usuários, orçamentos, vendas e contatos removidos
 * com X dias restantes até serem apagados automaticamente.
 *
 * Sub-abas internas mostram só as categorias com itens (esconde
 * automaticamente as vazias). Restauração mantém o item por mais 30
 * dias.
 *
 * Não há ação de "apagar definitivamente" — a remoção permanente é
 * exclusiva do job pg_cron `limpar_lixeira_expirada()` que roda 1x/dia.
 */
type SubAba = TipoLixeira | "todos";

const META_SUBABA: Record<
  TipoLixeira,
  { label: string; icon: typeof Music; cor: string }
> = {
  artista:     { label: "Artistas",     icon: Music,         cor: "#3b82f6" },
  usuario:     { label: "Equipe",       icon: Users,         cor: "#f97316" },
  orcamento:   { label: "Orçamentos",   icon: FileText,      cor: "#a855f7" },
  venda:       { label: "Vendas",       icon: ShoppingBag,   cor: "#a855f7" },
  contratante: { label: "Contratantes", icon: UserCircle,    cor: "#f97316" },
  casa:        { label: "Casas",        icon: Building2,     cor: "#f97316" },
  cidade:      { label: "Cidades",      icon: MapPin,        cor: "#f97316" },
  show:        { label: "Shows",        icon: CalendarRange, cor: "#3b82f6" },
};
// Labels are translated at render sites via t(m.label)

export default function AbaLixeira() {
  const t = useT();
  const {
    lixeiraArtistas,
    lixeiraUsuarios,
    lixeiraOrcamentos,
    lixeiraVendas,
    lixeiraContratantes,
    lixeiraCasas,
    lixeiraCidades,
    lixeiraShows,
    carregandoLixeira,
    recarregarLixeira,
    restaurarDaLixeira,
  } = useWorkspace();

  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);
  const [acao, setAcao] = useState<string | null>(null);
  const [subAba, setSubAba] = useState<SubAba>("todos");

  useEffect(() => {
    void recarregarLixeira();
  }, [recarregarLixeira]);

  // Contagem por tipo para exibir nas pílulas e esconder vazias
  const contagens: Record<TipoLixeira, number> = useMemo(
    () => ({
      artista: lixeiraArtistas.length,
      usuario: lixeiraUsuarios.length,
      orcamento: lixeiraOrcamentos.length,
      venda: lixeiraVendas.length,
      contratante: lixeiraContratantes.length,
      casa: lixeiraCasas.length,
      cidade: lixeiraCidades.length,
      show: lixeiraShows.length,
    }),
    [
      lixeiraArtistas, lixeiraUsuarios, lixeiraOrcamentos, lixeiraVendas,
      lixeiraContratantes, lixeiraCasas, lixeiraCidades, lixeiraShows,
    ]
  );

  const totalItens = Object.values(contagens).reduce((a, b) => a + b, 0);

  const subabasComItens = (Object.keys(META_SUBABA) as TipoLixeira[]).filter(
    (tipo) => contagens[tipo] > 0
  );

  async function aoRestaurar(tipo: TipoLixeira, id: string, nome: string) {
    setAcao(`restaurar-${id}`);
    try {
      await restaurarDaLixeira(tipo, id);
      setToast({ msg: t("{nome} restaurado.", { nome }), tipo: "sucesso" });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    } finally {
      setAcao(null);
    }
  }

  function renderLinha(
    key: string,
    tipo: TipoLixeira,
    id: string,
    nome: string,
    sub: string | null,
    diasRestantes: number,
    corAvatar: string,
    iniciais: string
  ) {
    const urgente = diasRestantes <= 3;
    return (
      <div key={key} className="flex items-center gap-3 px-4 py-3">
        <span
          className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: corAvatar, opacity: 0.6 }}
        >
          {iniciais}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-primary truncate">{nome}</div>
          {sub && <div className="text-xs text-muted truncate">{sub}</div>}
          <div
            className="text-xs font-medium mt-0.5"
            style={{ color: urgente ? "var(--danger)" : "var(--warning)" }}
          >
            {diasRestantes === 0
              ? t("Expira hoje")
              : t("{n} dia{s} restantes", { n: diasRestantes, s: diasRestantes === 1 ? "" : "s" })}
          </div>
        </div>
        <button
          onClick={() => aoRestaurar(tipo, id, nome)}
          disabled={acao === `restaurar-${id}`}
          className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1 disabled:opacity-50"
          style={{ color: "var(--success)" }}
        >
          <RotateCcw size={13} />
          {t("Restaurar")}
        </button>
      </div>
    );
  }

  const linhasPorTipo: Record<TipoLixeira, JSX.Element[]> = {
    artista: lixeiraArtistas.map((i) =>
      renderLinha(
        i.artista.id,
        "artista",
        i.artista.id,
        i.artista.name,
        null,
        i.diasRestantes,
        i.artista.color,
        i.artista.name.charAt(0).toUpperCase()
      )
    ),
    usuario: lixeiraUsuarios.map((i) =>
      renderLinha(
        i.usuario.id,
        "usuario",
        i.usuario.id,
        i.usuario.nome,
        i.usuario.email,
        i.diasRestantes,
        "#f97316",
        i.usuario.nome.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()
      )
    ),
    orcamento: lixeiraOrcamentos.map((i) =>
      renderLinha(
        i.orcamento.id,
        "orcamento",
        i.orcamento.id,
        i.orcamento.numero,
        i.orcamento.tipoEvento ?? null,
        i.diasRestantes,
        "#a855f7",
        "OR"
      )
    ),
    venda: lixeiraVendas.map((i) =>
      renderLinha(
        i.venda.id,
        "venda",
        i.venda.id,
        i.venda.numero,
        i.venda.nomeEvento ?? null,
        i.diasRestantes,
        "#a855f7",
        "VN"
      )
    ),
    contratante: lixeiraContratantes.map((i) =>
      renderLinha(
        i.contratante.id,
        "contratante",
        i.contratante.id,
        i.contratante.nome,
        i.contratante.email ?? null,
        i.diasRestantes,
        "#f97316",
        i.contratante.nome.charAt(0).toUpperCase()
      )
    ),
    casa: lixeiraCasas.map((i) =>
      renderLinha(
        i.casa.id,
        "casa",
        i.casa.id,
        i.casa.nome,
        null,
        i.diasRestantes,
        "#f97316",
        i.casa.nome.charAt(0).toUpperCase()
      )
    ),
    cidade: lixeiraCidades.map((i) =>
      renderLinha(
        i.cidade.id,
        "cidade",
        i.cidade.id,
        `${i.cidade.nome}, ${i.cidade.estado}`,
        null,
        i.diasRestantes,
        "#f97316",
        i.cidade.nome.charAt(0).toUpperCase()
      )
    ),
    show: lixeiraShows.map((i) =>
      renderLinha(
        i.show.id,
        "show",
        i.show.id,
        `${i.show.dj} • ${i.show.data ?? "sem data"}`,
        i.show.venue || i.show.location || null,
        i.diasRestantes,
        "#3b82f6",
        "SH"
      )
    ),
  };

  const tiposParaExibir =
    subAba === "todos" ? subabasComItens : ([subAba] as TipoLixeira[]);

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <Trash2 size={16} style={{ color: "#22c55e" }} />
          <div className="section-title">{t("Lixeira")}</div>
        </div>
        <div className="section-subtitle">
          {t("Itens removidos ficam aqui por")}{" "}
          <strong className="text-primary">{t("30 dias")}</strong> {t("e depois são apagados automaticamente. Você pode restaurar a qualquer momento durante esse período.")}
        </div>
      </div>

      {/* Sub-abas */}
      {subabasComItens.length > 0 && (
        <div className="pill-group flex-wrap">
          <button
            type="button"
            className={`pill ${subAba === "todos" ? "active" : ""}`}
            onClick={() => setSubAba("todos")}
          >
            {t("Todos")} ({totalItens})
          </button>
          {subabasComItens.map((tipo) => {
            const m = META_SUBABA[tipo];
            const Icon = m.icon;
            return (
              <button
                key={tipo}
                type="button"
                className={`pill ${subAba === tipo ? "active" : ""}`}
                onClick={() => setSubAba(tipo)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Icon size={12} />
                {t(m.label)} ({contagens[tipo]})
              </button>
            );
          })}
        </div>
      )}

      {/* Conteúdo */}
      {carregandoLixeira ? (
        <div className="card py-12 text-center text-sm text-muted">
          {t("Carregando lixeira...")}
        </div>
      ) : totalItens === 0 ? (
        <div className="card py-12 text-center text-sm text-muted">
          {t("Lixeira vazia.")}
        </div>
      ) : (
        tiposParaExibir.map((tipo) => {
          const m = META_SUBABA[tipo];
          const Icon = m.icon;
          const linhas = linhasPorTipo[tipo];
          if (linhas.length === 0) return null;
          return (
            <div key={tipo} className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Icon size={14} style={{ color: m.cor }} />
                  <div className="section-title">
                    {t(m.label)} ({linhas.length})
                  </div>
                </div>
                <span className="text-xs text-muted">{t("Recuperáveis por 30 dias")}</span>
              </div>
              <div className="divide-y divide-border">{linhas}</div>
            </div>
          );
        })
      )}

      <Toast
        open={!!toast}
        mensagem={toast?.msg ?? ""}
        tipo={toast?.tipo ?? "sucesso"}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
