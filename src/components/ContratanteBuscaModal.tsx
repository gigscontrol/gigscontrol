"use client";

/**
 * Busca avançada de contratantes — janela com a lista completa + barra de
 * pesquisa + detalhes (telefone, cidade, e-mail). Pra achar o contratante
 * quando não se lembra do nome/número exato.
 */

import { useState } from "react";
import { Search, Check } from "lucide-react";
import Modal from "./Modal";
import type { Contratante, Cidade } from "@/types";

export default function ContratanteBuscaModal({
  isOpen,
  onClose,
  contratantes,
  cidades,
  onSelect,
  selectedId,
}: {
  isOpen: boolean;
  onClose: () => void;
  contratantes: Contratante[];
  cidades: Cidade[];
  onSelect: (id: string) => void;
  selectedId?: string | null;
}) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const soDigitos = query.replace(/\D/g, "");

  const cidadeNome = (id: string) =>
    cidades.find((c) => String(c.id) === String(id))?.nome ?? "";

  const filtrados = contratantes.filter((c) => {
    if (!query) return true;
    return (
      c.nome.toLowerCase().includes(query) ||
      (soDigitos && (c.telefone ?? "").includes(soDigitos)) ||
      (c.email ?? "").toLowerCase().includes(query) ||
      cidadeNome(c.cidadeId).toLowerCase().includes(query)
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Buscar contratante"
      subtitle={`${contratantes.length} ${
        contratantes.length === 1 ? "contato" : "contatos"
      } cadastrados`}
      maxWidth={620}
    >
      <div className="flex flex-col gap-3">
        <div className="campo-input flex items-center gap-2">
          <Search size={15} className="flex-shrink-0 text-muted" />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome, telefone, cidade ou e-mail…"
            className="input flex-1"
          />
        </div>

        <div className="-mx-1 flex max-h-[55vh] flex-col divide-y divide-border overflow-y-auto">
          {filtrados.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted">
              Nenhum contato encontrado.
            </div>
          ) : (
            filtrados.map((c) => {
              const cid = cidadeNome(c.cidadeId);
              const detalhes = [
                c.telefone ? `+${c.telefone}` : null,
                cid || null,
                c.email || null,
              ]
                .filter(Boolean)
                .join("  ·  ");
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="flex items-center gap-3 rounded-md px-1 py-2.5 text-left transition-colors hover:bg-elevated"
                >
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: "var(--module-vendas)" }}
                  >
                    {c.nome.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-primary">
                      {c.nome}
                    </div>
                    {detalhes && (
                      <div className="truncate text-xs text-muted">{detalhes}</div>
                    )}
                  </div>
                  {selectedId === c.id && (
                    <Check
                      size={15}
                      className="flex-shrink-0"
                      style={{ color: "var(--module-vendas)" }}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
