"use client";

import { useEffect, useState } from "react";
import { Trash2, RotateCcw, Music, Users } from "lucide-react";
import Toast from "../Toast";
import { useWorkspace } from "@/lib/workspace-context";

/**
 * Aba "Lixeira".
 *
 * Lista artistas e usuários removidos com X dias restantes até serem
 * apagados automaticamente. O admin pode RESTAURAR a qualquer momento.
 *
 * Não há ação de apagar manualmente — a remoção definitiva é exclusiva
 * do job pg_cron `limpar_lixeira_expirada()` que roda 1x/dia e apaga
 * itens com mais de 30 dias.
 */
export default function AbaLixeira() {
  const {
    lixeiraArtistas,
    lixeiraUsuarios,
    carregandoLixeira,
    recarregarLixeira,
    restaurarDaLixeira,
  } = useWorkspace();

  const [toast, setToast] = useState<{ msg: string; tipo: "sucesso" | "erro" } | null>(null);
  const [acao, setAcao] = useState<string | null>(null);

  useEffect(() => {
    void recarregarLixeira();
  }, [recarregarLixeira]);

  async function aoRestaurar(tipo: "artista" | "usuario", id: string, nome: string) {
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

  const totalItens = lixeiraArtistas.length + lixeiraUsuarios.length;

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="card">
        <div className="flex items-center gap-2 mb-1">
          <Trash2 size={16} style={{ color: "var(--module-financeiro)" }} />
          <div className="section-title">Lixeira</div>
        </div>
        <div className="section-subtitle">
          Artistas e usuários removidos ficam aqui por{" "}
          <strong className="text-primary">30 dias</strong> e depois são
          apagados automaticamente. Você pode restaurar a qualquer momento
          durante esse período.
        </div>
      </div>

      {carregandoLixeira ? (
        <div className="card py-12 text-center text-sm text-muted">Carregando...</div>
      ) : totalItens === 0 ? (
        <div className="card py-12 text-center">
          <div className="h-10 w-10 rounded-full bg-elevated flex items-center justify-center mx-auto mb-3">
            <Trash2 size={18} className="text-muted" />
          </div>
          <div className="section-title mb-1">Lixeira vazia</div>
          <div className="section-subtitle">Nada para recuperar no momento.</div>
        </div>
      ) : (
        <>
          {/* Artistas */}
          {lixeiraArtistas.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <Music size={14} style={{ color: "var(--module-vendas)" }} />
                <div className="section-title">Artistas ({lixeiraArtistas.length})</div>
              </div>
              <div className="divide-y divide-border">
                {lixeiraArtistas.map((item) => (
                  <ItemLinha
                    key={item.artista.id}
                    nome={item.artista.name}
                    detalhe={`Cor ${item.artista.color}`}
                    cor={item.artista.color}
                    diasRestantes={item.diasRestantes}
                    onRestaurar={() =>
                      aoRestaurar("artista", item.artista.id, item.artista.name)
                    }
                    acao={acao}
                    id={item.artista.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Usuários */}
          {lixeiraUsuarios.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-border">
                <Users size={14} style={{ color: "var(--module-contatos)" }} />
                <div className="section-title">Usuários ({lixeiraUsuarios.length})</div>
              </div>
              <div className="divide-y divide-border">
                {lixeiraUsuarios.map((item) => (
                  <ItemLinha
                    key={item.usuario.id}
                    nome={item.usuario.nome}
                    detalhe={item.usuario.email}
                    cor="var(--module-contatos)"
                    diasRestantes={item.diasRestantes}
                    onRestaurar={() =>
                      aoRestaurar("usuario", item.usuario.id, item.usuario.nome)
                    }
                    acao={acao}
                    id={item.usuario.id}
                  />
                ))}
              </div>
            </div>
          )}
        </>
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

function ItemLinha({
  nome,
  detalhe,
  cor,
  diasRestantes,
  onRestaurar,
  acao,
  id,
}: {
  nome: string;
  detalhe: string;
  cor: string;
  diasRestantes: number;
  onRestaurar: () => void;
  acao: string | null;
  id: string;
}) {
  const urgente = diasRestantes <= 3;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
        style={{ background: cor, opacity: 0.7 }}
      >
        {nome.charAt(0).toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary truncate">{nome}</div>
        <div className="text-xs text-muted truncate">{detalhe}</div>
      </div>
      <div
        className="text-xs font-semibold flex-shrink-0"
        style={{ color: urgente ? "var(--danger)" : "var(--warning)" }}
      >
        {diasRestantes === 0
          ? "Expira hoje"
          : `${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`}
      </div>
      <button
        onClick={onRestaurar}
        disabled={acao === `restaurar-${id}`}
        className="btn-ghost text-xs inline-flex items-center gap-1 px-2 py-1 disabled:opacity-50"
        style={{ color: "var(--success)" }}
      >
        <RotateCcw size={13} />
        Restaurar
      </button>
    </div>
  );
}
