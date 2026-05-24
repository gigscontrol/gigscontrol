"use client";

import { useState } from "react";
import { Field, TextInput, TextArea, Select } from "../Field";
import { useContatos } from "@/lib/contatos-context";
import type { Contratante } from "@/types";

type Props = {
  initial?: Contratante;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function ContratanteForm({ initial, onSubmit, onCancel }: Props) {
  const { cidades, addContratante, updateContratante } = useContatos();

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [documento, setDocumento] = useState(initial?.documento ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [telefone, setTelefone] = useState(initial?.telefone ?? "");
  const [cidadeId, setCidadeId] = useState<string>(initial?.cidadeId ?? cidades[0]?.id ?? "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = "Nome obrigatório";
    if (!telefone.trim()) errs.telefone = "Telefone obrigatório";
    if (!cidadeId) errs.cidade = "Selecione uma cidade";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const payload = {
      nome,
      documento: documento || "",
      email: email || "",
      telefone,
      cidadeId,
      observacoes: observacoes || undefined,
    };

    const op = initial ? updateContratante(initial.id, payload) : addContratante(payload);
    op.then(() => onSubmit()).catch((e) => setErrors({ nome: (e as Error).message }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome completo" required error={errors.nome}>
          <TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Marcos Lima" />
        </Field>
        <Field label="Telefone (WhatsApp)" required hint="Com DDD" error={errors.telefone}>
          <TextInput value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
        </Field>
        <Field label="Cidade" required error={errors.cidade}>
          <Select value={cidadeId} onChange={(e) => setCidadeId(e.target.value)}>
            <option value="">Selecione...</option>
            {cidades.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} — {c.estado}</option>
            ))}
          </Select>
        </Field>
        <Field label="E-mail" hint="Necessário ao converter em venda">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@email.com" />
        </Field>
        <Field label="CPF / CNPJ" hint="Necessário ao converter em venda">
          <TextInput value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="000.000.000-00" />
        </Field>
      </div>

      <Field label="Observações" hint="Notas internas">
        <TextArea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Ex: prefere contato via WhatsApp, paga sempre antecipado..."
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onCancel} className="btn btn-secondary">Cancelar</button>
        <button onClick={handleSave} className="btn btn-primary">
          {initial ? "Salvar alterações" : "Cadastrar contratante"}
        </button>
      </div>
    </div>
  );
}
