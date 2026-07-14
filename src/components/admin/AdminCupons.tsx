"use client";

import { useMemo, useState } from "react";
import { Plus, X, Check, Ban, PlayCircle, Pencil, Ticket } from "lucide-react";
import { usePlataforma } from "@/lib/plataforma-context";
import { PLANOS, type PlanoId } from "@/lib/planos";
import type { CupomAdmin } from "@/lib/services/cupons.service";

export default function AdminCupons() {
  const { cupons, carregandoCupons } = usePlataforma();
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<CupomAdmin | null>(null);

  const nomePlano = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of PLANOS) map[p.id] = p.nome;
    return map;
  }, []);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Cupons</h1>
          <p className="text-sm text-muted">
            Cupons de 1º mês grátis — concedem dias fixos num plano específico
          </p>
        </div>
        <button
          onClick={() => setCriando(true)}
          className="btn btn-primary text-sm"
        >
          <Plus size={14} />
          Criar cupom
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/40">
                <Th>Código</Th>
                <Th>Plano-alvo</Th>
                <Th>Dias concedidos</Th>
                <Th>Usos</Th>
                <Th>Validade</Th>
                <Th>Status</Th>
                <Th>Criado em</Th>
                <Th className="w-[1%]"></Th>
              </tr>
            </thead>
            <tbody>
              {cupons.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 hover:bg-elevated/40 transition-colors"
                >
                  <Td>
                    <span className="font-mono font-semibold text-primary tracking-wide">
                      {c.codigo}
                    </span>
                  </Td>
                  <Td className="text-secondary">
                    {nomePlano[c.planoAlvo] ?? c.planoAlvo}
                  </Td>
                  <Td className="tabular-nums text-secondary">
                    {c.diasConcedidos} dias
                  </Td>
                  <Td className="tabular-nums">
                    <span
                      className={
                        c.usosAtuais >= c.limiteUso
                          ? "text-danger font-semibold"
                          : "text-secondary"
                      }
                    >
                      {c.usosAtuais}/{c.limiteUso}
                    </span>
                  </Td>
                  <Td className="text-xs text-secondary tabular-nums">
                    {c.validade
                      ? new Date(c.validade).toLocaleDateString("pt-BR")
                      : "Sem validade"}
                  </Td>
                  <Td>
                    <span
                      className={`badge ${c.ativo ? "badge-success" : "badge-neutral"}`}
                    >
                      {c.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </Td>
                  <Td className="text-xs text-muted tabular-nums">
                    {new Date(c.criadoEm).toLocaleDateString("pt-BR")}
                  </Td>
                  <Td>
                    <button
                      onClick={() => setEditando(c)}
                      className="btn-ghost text-xs inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Pencil size={12} />
                      Editar
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregandoCupons && cupons.length === 0 && (
            <div className="py-12 text-center text-sm text-muted">
              Nenhum cupom criado ainda.
            </div>
          )}
          {carregandoCupons && cupons.length === 0 && (
            <div className="py-12 text-center text-sm text-muted">
              Carregando…
            </div>
          )}
        </div>
      </div>

      {criando && <ModalCriarCupom onClose={() => setCriando(false)} />}
      {editando && (
        <ModalEditarCupom cupom={editando} onClose={() => setEditando(null)} />
      )}
    </div>
  );
}

// ============================================================
// CRIAR
// ============================================================

function ModalCriarCupom({ onClose }: { onClose: () => void }) {
  const { criarCupom } = usePlataforma();
  const [codigo, setCodigo] = useState("");
  const [planoAlvo, setPlanoAlvo] = useState<PlanoId>(PLANOS[0].id);
  const [limiteUso, setLimiteUso] = useState("100");
  const [validade, setValidade] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (salvando) return;
    setErro(null);

    const codigoLimpo = codigo.trim();
    const limite = parseInt(limiteUso, 10);
    if (!codigoLimpo) {
      setErro("Informe um código.");
      return;
    }
    if (!Number.isInteger(limite) || limite <= 0) {
      setErro("Limite de uso precisa ser um número inteiro maior que zero.");
      return;
    }

    setSalvando(true);
    try {
      await criarCupom({
        codigo: codigoLimpo,
        planoAlvo,
        limiteUso: limite,
        validade: validade ? new Date(validade + "T23:59:59").toISOString() : null,
      });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao criar cupom.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--overlay-scrim)" }}
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg w-full max-w-[440px] overflow-hidden"
        style={{ boxShadow: "0 24px 60px var(--shadow-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Ticket size={16} style={{ color: "var(--brand)" }} />
            <div className="section-title">Criar cupom</div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          <Campo label="Código">
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              placeholder="EX: PRIMEIRO30"
              className="campo-input font-mono tracking-wide uppercase"
              maxLength={64}
            />
          </Campo>

          <Campo label="Plano-alvo">
            <select
              value={planoAlvo}
              onChange={(e) => setPlanoAlvo(e.target.value as PlanoId)}
              className="campo-input"
            >
              {PLANOS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Limite de uso">
            <input
              type="number"
              min={1}
              step={1}
              value={limiteUso}
              onChange={(e) => setLimiteUso(e.target.value)}
              className="campo-input tabular-nums"
            />
          </Campo>

          <Campo label="Validade (opcional)">
            <input
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
              className="campo-input tabular-nums"
            />
          </Campo>

          <div className="bg-elevated/40 border border-border rounded-md p-3 text-xs text-secondary">
            Concede sempre <strong className="text-primary">30 dias</strong> de
            acesso ao plano escolhido, no primeiro resgate por workspace. Vale
            para os dois ciclos de cobrança.
          </div>

          {erro && (
            <div
              className="text-xs rounded-md px-3 py-2"
              style={{ color: "var(--danger-ink)", backgroundColor: "var(--danger-weak)" }}
            >
              {erro}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary text-sm">
            Cancelar
          </button>
          <button
            onClick={() => void salvar()}
            disabled={salvando}
            className="btn btn-primary text-sm disabled:opacity-50"
          >
            <Check size={14} />
            {salvando ? "Salvando…" : "Criar cupom"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EDITAR (ativar/desativar, limite, validade)
// ============================================================

function ModalEditarCupom({
  cupom,
  onClose,
}: {
  cupom: CupomAdmin;
  onClose: () => void;
}) {
  const { alterarCupom } = usePlataforma();
  const [limiteUso, setLimiteUso] = useState(String(cupom.limiteUso));
  const [validade, setValidade] = useState(
    cupom.validade ? cupom.validade.slice(0, 10) : ""
  );
  const [salvando, setSalvando] = useState<"limite" | "validade" | "status" | null>(
    null
  );
  const [erro, setErro] = useState<string | null>(null);

  async function salvarLimite() {
    const limite = parseInt(limiteUso, 10);
    if (!Number.isInteger(limite) || limite <= 0) {
      setErro("Limite de uso precisa ser um número inteiro maior que zero.");
      return;
    }
    setErro(null);
    setSalvando("limite");
    try {
      await alterarCupom(cupom.id, { limiteUso: limite });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao atualizar limite.");
    } finally {
      setSalvando(null);
    }
  }

  async function salvarValidade() {
    setErro(null);
    setSalvando("validade");
    try {
      await alterarCupom(cupom.id, {
        validade: validade ? new Date(validade + "T23:59:59").toISOString() : null,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao atualizar validade.");
    } finally {
      setSalvando(null);
    }
  }

  async function alternarStatus() {
    setErro(null);
    setSalvando("status");
    try {
      await alterarCupom(cupom.id, { ativo: !cupom.ativo });
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao atualizar status.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "var(--overlay-scrim)" }}
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-lg w-full max-w-[440px] overflow-hidden"
        style={{ boxShadow: "0 24px 60px var(--shadow-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
          <div>
            <div className="section-title font-mono">{cupom.codigo}</div>
            <div className="text-xs text-muted mt-0.5">
              {cupom.usosAtuais}/{cupom.limiteUso} usos · {cupom.diasConcedidos} dias
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
          <div>
            <div className="stat-label mb-2">Status</div>
            <button
              onClick={() => void alternarStatus()}
              disabled={salvando === "status"}
              className="flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                borderColor: cupom.ativo ? "var(--danger)" : "var(--success)",
                backgroundColor: cupom.ativo
                  ? "var(--danger-weak)"
                  : "var(--success-weak)",
                color: cupom.ativo ? "var(--danger-ink)" : "var(--success-ink)",
              }}
            >
              {cupom.ativo ? <Ban size={14} /> : <PlayCircle size={14} />}
              {salvando === "status"
                ? "…"
                : cupom.ativo
                  ? "Desativar cupom"
                  : "Reativar cupom"}
            </button>
            <p className="text-xs text-muted mt-2">
              Desativar tira o cupom de circulação sem apagar o histórico de
              usos.
            </p>
          </div>

          <div>
            <div className="stat-label mb-2">Limite de uso</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={cupom.usosAtuais || 1}
                step={1}
                value={limiteUso}
                onChange={(e) => setLimiteUso(e.target.value)}
                className="campo-input tabular-nums flex-1"
              />
              <button
                onClick={() => void salvarLimite()}
                disabled={
                  salvando === "limite" || limiteUso === String(cupom.limiteUso)
                }
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                {salvando === "limite" ? "…" : "Salvar"}
              </button>
            </div>
          </div>

          <div>
            <div className="stat-label mb-2">Validade</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                className="campo-input tabular-nums flex-1"
              />
              <button
                onClick={() => void salvarValidade()}
                disabled={
                  salvando === "validade" ||
                  validade === (cupom.validade ? cupom.validade.slice(0, 10) : "")
                }
                className="btn btn-secondary text-sm disabled:opacity-50"
              >
                {salvando === "validade" ? "…" : "Salvar"}
              </button>
            </div>
            <p className="text-xs text-muted mt-2">
              Deixe em branco para o cupom não ter data de expiração.
            </p>
          </div>

          {erro && (
            <div
              className="text-xs rounded-md px-3 py-2"
              style={{ color: "var(--danger-ink)", backgroundColor: "var(--danger-weak)" }}
            >
              {erro}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="btn btn-primary text-sm">
            Concluir
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
