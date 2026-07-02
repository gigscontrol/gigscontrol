"use client";

import { useState } from "react";
import { Pencil, X, Check, Plus, Trash2, Star } from "lucide-react";
import { usePlataforma } from "@/lib/plataforma-context";
import { formatarPreco, type Plano } from "@/lib/planos";

export default function AdminPlanos() {
  const { planos, assinaturas, atualizarPlano } = usePlataforma();
  const [editando, setEditando] = useState<Plano | null>(null);

  function clientesNoPlano(planoId: string) {
    return assinaturas.filter((a) => a.plano === planoId).length;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Planos</h1>
        <p className="text-sm text-muted">
          Catálogo de planos, preços e limites da plataforma
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/40">
                <Th>Plano</Th>
                <Th>Preço mensal</Th>
                <Th>Preço anual</Th>
                <Th>Limites</Th>
                <Th>Clientes</Th>
                <Th className="w-[1%]"></Th>
              </tr>
            </thead>
            <tbody>
              {planos.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors"
                >
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-primary">{p.nome}</span>
                      {p.destaque && (
                        <Star
                          size={12}
                          fill="var(--brand)"
                          style={{ color: "var(--brand)" }}
                        />
                      )}
                    </div>
                    <div className="text-xs text-muted">{p.tagline}</div>
                  </Td>
                  <Td className="tabular-nums font-semibold">
                    {formatarPreco(p.precoMensal)}
                  </Td>
                  <Td className="tabular-nums">
                    {formatarPreco(p.precoAnual / 12)}
                    <span className="text-xs text-muted">/mês</span>
                  </Td>
                  <Td className="text-xs text-secondary">
                    {p.maxArtistas} artistas
                    <br />
                    {p.maxUsuariosAdicionais} adicionais
                  </Td>
                  <Td className="tabular-nums text-secondary">
                    {clientesNoPlano(p.id)}
                  </Td>
                  <Td>
                    <button
                      onClick={() => setEditando(p)}
                      className="btn-ghost text-xs inline-flex items-center gap-1"
                    >
                      <Pencil size={12} />
                      Editar
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted mt-3">
        A criação de novos planos e a integração de pagamento (Stripe / PIX /
        boleto) entram em uma fase futura. Aqui você ajusta os planos existentes.
      </p>

      {editando && (
        <ModalEditarPlano
          plano={editando}
          onClose={() => setEditando(null)}
          onSalvar={(patch) => {
            atualizarPlano(editando.id, patch);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function ModalEditarPlano({
  plano,
  onClose,
  onSalvar,
}: {
  plano: Plano;
  onClose: () => void;
  onSalvar: (patch: Partial<Plano>) => void;
}) {
  const [nome, setNome] = useState(plano.nome);
  const [tagline, setTagline] = useState(plano.tagline);
  const [precoMensal, setPrecoMensal] = useState(String(plano.precoMensal));
  const [precoAnual, setPrecoAnual] = useState(String(plano.precoAnual));
  const [maxArtistas, setMaxArtistas] = useState(String(plano.maxArtistas));
  const [maxUsuarios, setMaxUsuarios] = useState(String(plano.maxUsuariosAdicionais));
  const [destaque, setDestaque] = useState(!!plano.destaque);
  const [recursos, setRecursos] = useState<string[]>(plano.recursos);

  function salvar() {
    onSalvar({
      nome: nome.trim() || plano.nome,
      tagline: tagline.trim(),
      precoMensal: parseFloat(precoMensal.replace(",", ".")) || plano.precoMensal,
      precoAnual:
        parseFloat(precoAnual.replace(",", ".")) || plano.precoAnual,
      maxArtistas: parseInt(maxArtistas) || plano.maxArtistas,
      maxUsuariosAdicionais: parseInt(maxUsuarios) || plano.maxUsuariosAdicionais,
      destaque,
      recursos: recursos.filter((r) => r.trim()),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg w-full max-w-[500px] overflow-hidden"
        style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
          <div className="section-title">Editar plano — {plano.nome}</div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {/* Nome + tagline */}
          <Campo label="Nome do plano">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="campo-input"
            />
          </Campo>
          <Campo label="Descrição curta">
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="campo-input"
            />
          </Campo>

          {/* Preços */}
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Preço mensal (R$)">
              <input
                type="number"
                step="0.01"
                value={precoMensal}
                onChange={(e) => setPrecoMensal(e.target.value)}
                className="campo-input tabular-nums"
              />
            </Campo>
            <Campo label="Preço anual (R$/mês)">
              <input
                type="number"
                step="0.01"
                value={precoAnual}
                onChange={(e) => setPrecoAnual(e.target.value)}
                className="campo-input tabular-nums"
              />
            </Campo>
          </div>

          {/* Limites */}
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Máx. artistas">
              <input
                type="number"
                value={maxArtistas}
                onChange={(e) => setMaxArtistas(e.target.value)}
                className="campo-input tabular-nums"
              />
            </Campo>
            <Campo label="Máx. usuários adicionais">
              <input
                type="number"
                value={maxUsuarios}
                onChange={(e) => setMaxUsuarios(e.target.value)}
                className="campo-input tabular-nums"
              />
            </Campo>
          </div>

          {/* Destaque */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <button
              type="button"
              onClick={() => setDestaque((v) => !v)}
              className="h-5 w-5 rounded border flex items-center justify-center transition-colors"
              style={{
                borderColor: destaque
                  ? "var(--brand)"
                  : "var(--border-strong)",
                backgroundColor: destaque ? "var(--brand)" : "transparent",
              }}
            >
              {destaque && <Check size={13} className="text-white" />}
            </button>
            <span className="text-sm text-secondary">
              Marcar como &quot;Mais popular&quot; na página de planos
            </span>
          </label>

          {/* Recursos */}
          <div>
            <div className="stat-label mb-2">Recursos listados</div>
            <div className="flex flex-col gap-1.5">
              {recursos.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    value={r}
                    onChange={(e) => {
                      const novo = [...recursos];
                      novo[idx] = e.target.value;
                      setRecursos(novo);
                    }}
                    className="campo-input flex-1"
                  />
                  <button
                    onClick={() => setRecursos(recursos.filter((_, i) => i !== idx))}
                    className="btn-ghost p-1.5 rounded"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setRecursos([...recursos, ""])}
              className="btn btn-secondary text-xs mt-2"
            >
              <Plus size={12} />
              Adicionar recurso
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary text-sm">
            Cancelar
          </button>
          <button onClick={salvar} className="btn btn-primary text-sm">
            <Check size={14} />
            Salvar alterações
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-secondary">{label}</span>
      {children}
    </label>
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
