"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Field, TextInput, Select } from "../Field";
import { useContatos } from "@/lib/contatos-context";
import type { Cidade } from "@/types";

const REGIOES: Cidade["regiao"][] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

type Props = {
  initial?: Cidade;
  onSubmit: () => void;
  onCancel: () => void;
};

/**
 * Formulário de cidade.
 *
 * NOVO (sem `initial`): mostra apenas uma mensagem informativa explicando
 * que cidades agora são criadas automaticamente a partir do catálogo
 * nacional do IBGE quando aparecem em orçamento/venda/casa/contratante.
 *
 * EDIÇÃO (com `initial`): permite ajustar nome/UF de cidades legadas
 * (criadas antes da integração IBGE). Cidades novas (com ibge_id) também
 * podem ser editadas — útil pra corrigir grafia ou UF errados.
 */
export default function CidadeForm({ initial, onSubmit, onCancel }: Props) {
  const { updateCidade } = useContatos();

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [estado, setEstado] = useState(initial?.estado ?? "");
  const [regiao, setRegiao] = useState<Cidade["regiao"]>(initial?.regiao ?? "Sudeste");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Modo NOVO: explica que não precisa criar manualmente
  if (!initial) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className="flex items-start gap-3 rounded-md px-4 py-3"
          style={{
            backgroundColor: "rgba(168,85,247,0.08)",
            border: "1px solid rgba(168,85,247,0.2)",
          }}
        >
          <Info size={18} style={{ color: "var(--module-vendas)" }} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm text-secondary leading-relaxed">
            Cidades agora são adicionadas <strong className="text-primary">automaticamente</strong> a
            partir do catálogo nacional do IBGE quando aparecem em um
            orçamento, venda, casa ou contratante.
            <br />
            <br />
            Não precisa criar manualmente — basta usar o autocomplete de
            cidade nos formulários e a cidade fica salva aqui.
          </div>
        </div>
        <div className="flex justify-end pt-2 border-t border-border">
          <button onClick={onCancel} className="btn btn-primary">
            Entendi
          </button>
        </div>
      </div>
    );
  }

  // Modo EDIÇÃO: permite ajustar cidade existente (legada ou IBGE)
  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = "Nome obrigatório";
    if (!estado.trim() || estado.length !== 2) errs.estado = "UF com 2 letras (ex: SP)";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const payload = { nome, estado: estado.toUpperCase(), regiao };
    updateCidade(initial.id, payload)
      .then(() => onSubmit())
      .catch((e) => setErrors({ nome: (e as Error).message }));
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Nome da cidade" required error={errors.nome}>
        <TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="São Paulo" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="UF" required hint="Ex: SP, RJ, MG" error={errors.estado}>
          <TextInput
            value={estado}
            onChange={(e) => setEstado(e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="SP"
          />
        </Field>
        <Field label="Região" required>
          <Select value={regiao} onChange={(e) => setRegiao(e.target.value as Cidade["regiao"])}>
            {REGIOES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onCancel} className="btn btn-secondary">Cancelar</button>
        <button onClick={handleSave} className="btn btn-primary">
          Salvar alterações
        </button>
      </div>
    </div>
  );
}
