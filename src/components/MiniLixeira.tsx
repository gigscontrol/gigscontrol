"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, RotateCcw } from "lucide-react";
import Toast from "./Toast";
import { useWorkspace, type TipoLixeira } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";

type Props = {
  /** Categoria que esta mini-lixeira mostra. Shows ficam só na AbaLixeira
   *  completa porque a agenda é visual (calendário), não lista. */
  tipo: Exclude<TipoLixeira, "artista" | "usuario" | "show">;
};

/**
 * Mini-lixeira embutida nas telas dos módulos (Vendas, Orçamentos,
 * Contatos). Mostra os itens do tipo correspondente que estão na
 * lixeira ativa, com botão Restaurar.
 *
 * Regras:
 *  - Só aparece se o usuário é admin (consistente com AbaLixeira).
 *  - Esconde quando não há itens na lixeira do tipo.
 *  - Carrega a lixeira ao montar (e a cada vez que o tipo muda).
 *
 * Artistas e usuários têm mini-lixeiras dedicadas em AbaArtistas/
 * AbaEquipe e não passam por esse componente.
 */
export default function MiniLixeira({ tipo }: Props) {
  const { sessao } = useAuth();
  const {
    lixeiraOrcamentos,
    lixeiraVendas,
    lixeiraContratantes,
    lixeiraCasas,
    lixeiraCidades,
    recarregarLixeira,
    restaurarDaLixeira,
  } = useWorkspace();

  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);
  const [acao, setAcao] = useState<string | null>(null);

  // Carrega a lixeira ao montar — assim depois de remover algo, o item
  // aparece embaixo sem precisar recarregar a página.
  useEffect(() => {
    void recarregarLixeira();
  }, [recarregarLixeira]);

  // Items + label da categoria (sempre calculado pra obedecer a regra
  // dos hooks; o early return de admin acontece depois)
  const dados = useMemo(() => {
    switch (tipo) {
      case "orcamento":
        return {
          label: "Orçamentos",
          itens: lixeiraOrcamentos.map((i) => ({
            id: i.orcamento.id,
            nome: i.orcamento.numero,
            sub: i.orcamento.tipoEvento ?? null,
            iniciais: "OR",
            corAvatar: "var(--module-vendas)",
            diasRestantes: i.diasRestantes,
          })),
        };
      case "venda":
        return {
          label: "Vendas",
          itens: lixeiraVendas.map((i) => ({
            id: i.venda.id,
            nome: i.venda.numero,
            sub: i.venda.nomeEvento ?? null,
            iniciais: "VN",
            corAvatar: "var(--module-vendas)",
            diasRestantes: i.diasRestantes,
          })),
        };
      case "contratante":
        return {
          label: "Contratantes",
          itens: lixeiraContratantes.map((i) => ({
            id: i.contratante.id,
            nome: i.contratante.nome,
            sub: i.contratante.email ?? null,
            iniciais: i.contratante.nome.charAt(0).toUpperCase(),
            corAvatar: "var(--module-contatos)",
            diasRestantes: i.diasRestantes,
          })),
        };
      case "casa":
        return {
          label: "Casas / Eventos",
          itens: lixeiraCasas.map((i) => ({
            id: i.casa.id,
            nome: i.casa.nome,
            sub: null,
            iniciais: i.casa.nome.charAt(0).toUpperCase(),
            corAvatar: "var(--module-contatos)",
            diasRestantes: i.diasRestantes,
          })),
        };
      case "cidade":
        return {
          label: "Cidades",
          itens: lixeiraCidades.map((i) => ({
            id: i.cidade.id,
            nome: `${i.cidade.nome}, ${i.cidade.estado}`,
            sub: null,
            iniciais: i.cidade.nome.charAt(0).toUpperCase(),
            corAvatar: "var(--module-contatos)",
            diasRestantes: i.diasRestantes,
          })),
        };
    }
  }, [
    tipo,
    lixeiraOrcamentos, lixeiraVendas,
    lixeiraContratantes, lixeiraCasas, lixeiraCidades,
  ]);

  // Restrito a admin (mesma regra da AbaLixeira completa)
  const isAdmin = sessao?.usuario?.papel === "admin";
  if (!isAdmin) return null;
  if (dados.itens.length === 0) return null;

  async function aoRestaurar(id: string, nome: string) {
    setAcao(`restaurar-${id}`);
    try {
      await restaurarDaLixeira(tipo, id);
      setToast({ msg: `${nome} restaurado.`, tipo: "sucesso" });
    } catch (e) {
      setToast({ msg: (e as Error).message, tipo: "erro" });
    } finally {
      setAcao(null);
    }
  }

  return (
    <>
      <div className="card p-0 overflow-hidden mt-6">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Trash2 size={14} style={{ color: "var(--module-financeiro)" }} />
            <div className="section-title">
              Na lixeira ({dados.itens.length})
            </div>
          </div>
          <span className="text-xs text-muted">Recuperáveis por 30 dias</span>
        </div>
        <div className="divide-y divide-border">
          {dados.itens.map((item) => {
            const urgente = item.diasRestantes <= 3;
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span
                  className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: item.corAvatar, opacity: 0.6 }}
                >
                  {item.iniciais}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary truncate">
                    {item.nome}
                  </div>
                  {item.sub && (
                    <div className="text-xs text-muted truncate">{item.sub}</div>
                  )}
                  <div
                    className="text-xs font-medium mt-0.5"
                    style={{
                      color: urgente ? "var(--danger)" : "var(--warning)",
                    }}
                  >
                    {item.diasRestantes === 0
                      ? "Expira hoje"
                      : `${item.diasRestantes} dia${item.diasRestantes === 1 ? "" : "s"} restantes`}
                  </div>
                </div>
                <button
                  onClick={() => aoRestaurar(item.id, item.nome)}
                  disabled={acao === `restaurar-${item.id}`}
                  className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1 disabled:opacity-50"
                  style={{ color: "var(--success)" }}
                >
                  <RotateCcw size={13} />
                  Restaurar
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Toast
        open={!!toast}
        mensagem={toast?.msg ?? ""}
        tipo={toast?.tipo ?? "sucesso"}
        onClose={() => setToast(null)}
      />
    </>
  );
}
