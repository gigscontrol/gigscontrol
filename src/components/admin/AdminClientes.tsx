"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowLeft,
  Building2,
  CreditCard,
  CalendarClock,
  CalendarCheck2,
  FileText,
  Users,
  DollarSign,
  Eye,
  Mail,
  Clock,
  TrendingUp,
} from "lucide-react";
import { usePlataforma } from "@/lib/plataforma-context";
import { useAuth } from "@/lib/auth-context";
import {
  LABELS_STATUS_ASSINATURA,
  LABELS_STATUS_USUARIO,
  getUsoWorkspace,
  type Assinatura,
} from "@/lib/plataforma";
import { LABELS_PAPEL } from "@/lib/permissoes";
import { getPlano, precoPorMes, formatarPreco } from "@/lib/planos";

export default function AdminClientes() {
  const { assinaturas, usuarios } = usePlataforma();
  const [search, setSearch] = useState("");
  const [clienteAberto, setClienteAberto] = useState<string | null>(null);

  // Cada "cliente" = um workspace, representado pelo seu Admin (quem paga)
  const clientes = useMemo(() => {
    return assinaturas
      .map((a) => {
        const admin = usuarios.find(
          (u) => u.workspaceId === a.workspaceId && u.papel === "admin"
        );
        return { assinatura: a, admin };
      })
      .filter((c) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const hay = [
          c.assinatura.nomeWorkspace,
          c.assinatura.responsavel,
          c.assinatura.email,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [assinaturas, usuarios, search]);

  // Detalhe de um cliente
  if (clienteAberto) {
    return (
      <DetalheCliente
        workspaceId={clienteAberto}
        onVoltar={() => setClienteAberto(null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Clientes</h1>
        <p className="text-sm text-muted">
          Cada cliente é o administrador que assina e paga um plano
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-1.5 max-w-md">
            <Search size={14} className="text-muted flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, responsável ou e-mail..."
              className="input text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/40">
                <Th>Cliente</Th>
                <Th>Plano</Th>
                <Th>Próximo pagamento</Th>
                <Th>Status</Th>
                <Th className="w-[1%]"></Th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(({ assinatura, admin }) => {
                const plano = getPlano(assinatura.plano);
                const st = LABELS_STATUS_ASSINATURA[assinatura.status];
                return (
                  <tr
                    key={assinatura.workspaceId}
                    onClick={() => setClienteAberto(assinatura.workspaceId)}
                    className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors cursor-pointer"
                  >
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-9 w-9 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ backgroundColor: "var(--module-vendas)" }}
                        >
                          {assinatura.nomeWorkspace.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-primary truncate">
                            {assinatura.nomeWorkspace}
                          </div>
                          <div className="text-xs text-muted truncate">
                            {assinatura.responsavel} · {assinatura.email}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="text-secondary">{plano.nome}</div>
                      <div className="text-xs text-muted capitalize">
                        {assinatura.ciclo}
                      </div>
                    </Td>
                    <Td className="text-secondary tabular-nums text-xs">
                      {new Date(
                        assinatura.proximaCobranca + "T12:00:00"
                      ).toLocaleDateString("pt-BR")}
                    </Td>
                    <Td>
                      <span className={`badge ${st.badge}`}>{st.label}</span>
                    </Td>
                    <Td>
                      <span className="btn-ghost text-xs inline-flex items-center gap-1 whitespace-nowrap">
                        Ver detalhes
                      </span>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {clientes.length === 0 && (
            <div className="py-12 text-center text-sm text-muted">
              Nenhum cliente encontrado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DETALHE DO CLIENTE
// ============================================================

function DetalheCliente({
  workspaceId,
  onVoltar,
}: {
  workspaceId: string;
  onVoltar: () => void;
}) {
  const router = useRouter();
  const { assinaturas, usuarios } = usePlataforma();
  const { entrarComoVisitante } = useAuth();

  const assinatura = assinaturas.find((a) => a.workspaceId === workspaceId);
  const uso = getUsoWorkspace(workspaceId);
  const equipe = usuarios.filter((u) => u.workspaceId === workspaceId);

  if (!assinatura) {
    return (
      <div>
        <button onClick={onVoltar} className="btn btn-secondary text-sm mb-4">
          <ArrowLeft size={14} />
          Voltar
        </button>
        <div className="card text-center py-10 text-muted text-sm">
          Cliente não encontrado.
        </div>
      </div>
    );
  }

  const plano = getPlano(assinatura.plano);
  const st = LABELS_STATUS_ASSINATURA[assinatura.status];

  function visualizarDashboard() {
    entrarComoVisitante({
      id: assinatura!.workspaceId,
      nome: assinatura!.nomeWorkspace,
      plano: assinatura!.plano,
      slug: "",
      criadoEm: assinatura!.inicioEm,
    });
    router.push("/app");
  }

  return (
    <div>
      {/* Voltar */}
      <button
        onClick={onVoltar}
        className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors mb-4"
      >
        <ArrowLeft size={13} />
        Voltar para clientes
      </button>

      {/* Cabeçalho do cliente */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="h-14 w-14 rounded-lg flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
              style={{ backgroundColor: "var(--module-vendas)" }}
            >
              {assinatura.nomeWorkspace.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold">{assinatura.nomeWorkspace}</h1>
                <span className={`badge ${st.badge}`}>{st.label}</span>
              </div>
              <div className="text-sm text-muted">
                {assinatura.responsavel}
              </div>
              <div className="text-xs text-muted inline-flex items-center gap-1 mt-0.5">
                <Mail size={11} />
                {assinatura.email}
              </div>
            </div>
          </div>

          <button
            onClick={visualizarDashboard}
            className="btn btn-primary text-sm"
            style={{ backgroundColor: "var(--module-vendas)", color: "#fff" }}
          >
            <Eye size={15} />
            Visualizar dashboard
          </button>
        </div>
      </div>

      {/* Assinatura / pagamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <InfoCard
          icon={<CreditCard size={16} />}
          label="Plano atual"
          value={plano.nome}
          sub={`${assinatura.ciclo} · ${formatarPreco(
            precoPorMes(plano, assinatura.ciclo)
          )}/mês`}
          color="var(--module-vendas)"
        />
        <InfoCard
          icon={<CalendarCheck2 size={16} />}
          label="Último pagamento"
          value={
            uso
              ? new Date(uso.ultimoPagamento + "T12:00:00").toLocaleDateString(
                  "pt-BR"
                )
              : "—"
          }
          sub={
            uso && uso.valorUltimoPagamento > 0
              ? formatarPreco(uso.valorUltimoPagamento)
              : "Sem cobrança"
          }
          color="var(--module-financeiro)"
        />
        <InfoCard
          icon={<CalendarClock size={16} />}
          label="Próximo pagamento"
          value={new Date(
            assinatura.proximaCobranca + "T12:00:00"
          ).toLocaleDateString("pt-BR")}
          sub={
            assinatura.status === "ativa"
              ? "Cobrança programada"
              : "Assinatura " + st.label.toLowerCase()
          }
          color="var(--module-agenda)"
        />
        <InfoCard
          icon={<Clock size={16} />}
          label="Cliente desde"
          value={new Date(assinatura.inicioEm + "T12:00:00").toLocaleDateString(
            "pt-BR"
          )}
          sub={`Workspace ${assinatura.workspaceId}`}
          color="var(--module-contatos)"
        />
      </div>

      {/* Uso da dashboard */}
      <div className="card mb-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} style={{ color: "var(--module-vendas)" }} />
          <div className="section-title">Atividade na dashboard</div>
        </div>
        {uso ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <UsoStat
              icon={<CalendarCheck2 size={15} />}
              label="Shows"
              value={uso.shows}
            />
            <UsoStat
              icon={<FileText size={15} />}
              label="Orçamentos"
              value={uso.orcamentos}
            />
            <UsoStat
              icon={<FileText size={15} />}
              label="Vendas"
              value={uso.vendas}
            />
            <UsoStat
              icon={<Users size={15} />}
              label="Contratantes"
              value={uso.contratantes}
            />
            <UsoStat
              icon={<Building2 size={15} />}
              label="Casas"
              value={uso.casas}
            />
            <UsoStat
              icon={<DollarSign size={15} />}
              label="Faturamento"
              value={formatarPreco(uso.faturamento)}
              destaque
            />
          </div>
        ) : (
          <div className="text-sm text-muted">
            Sem dados de uso para este cliente.
          </div>
        )}
      </div>

      {/* Equipe — usuários criados pelo cliente */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: "var(--module-contatos)" }} />
            <div className="section-title">
              Equipe do cliente ({equipe.length})
            </div>
          </div>
          <div className="text-xs text-muted">
            Limite do plano: {plano.maxUsuariosAdicionais} adicionais ·{" "}
            {plano.maxArtistas} artistas
          </div>
        </div>

        {equipe.length === 0 ? (
          <div className="text-sm text-muted">
            Este cliente ainda não criou usuários.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {equipe.map((u) => {
              const papel = LABELS_PAPEL[u.papel];
              const stU = LABELS_STATUS_USUARIO[u.status];
              return (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-2.5 rounded-md border border-border bg-elevated"
                >
                  <span
                    className="h-8 w-8 rounded-full flex items-center justify-center text-[0.65rem] font-bold text-white flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${papel.cor}, ${papel.cor}99)`,
                    }}
                  >
                    {u.nome
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary truncate">
                      {u.nome}
                      {u.papel === "admin" && (
                        <span className="text-xs text-muted ml-1.5">
                          (dono da conta)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate">{u.email}</div>
                  </div>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0"
                    style={{
                      backgroundColor: `${papel.cor}22`,
                      color: papel.cor,
                    }}
                  >
                    {papel.nome}
                  </span>
                  <span className={`badge ${stU.badge} flex-shrink-0`}>
                    {stU.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="h-8 w-8 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
        <span className="stat-label">{label}</span>
      </div>
      <div className="text-base font-bold text-primary">{value}</div>
      <div className="text-xs text-muted mt-0.5">{sub}</div>
    </div>
  );
}

function UsoStat({
  icon,
  label,
  value,
  destaque,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  destaque?: boolean;
}) {
  return (
    <div
      className="rounded-md border border-border p-3"
      style={{
        backgroundColor: destaque
          ? "rgba(34,197,94,0.06)"
          : "var(--bg-elevated)",
      }}
    >
      <div className="flex items-center gap-1.5 text-muted mb-1">
        {icon}
        <span className="text-[0.65rem] uppercase tracking-wide">{label}</span>
      </div>
      <div
        className="text-lg font-bold tabular-nums"
        style={{ color: destaque ? "var(--success)" : "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-left px-4 py-3 stat-label font-semibold whitespace-nowrap ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-middle ${className}`}>{children}</td>;
}
