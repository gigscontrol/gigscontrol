"use client";

import { useState } from "react";
import { Field, TextInput, Select } from "../Field";
import { useContatos } from "@/lib/contatos-context";
import type { Cidade } from "@/types";

const REGIOES: Cidade["regiao"][] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

type Props = {
  initial?: Cidade;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function CidadeForm({ initial, onSubmit, onCancel }: Props) {
  const { addCidade, updateCidade } = useContatos();

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [estado, setEstado] = useState(initial?.estado ?? "");
  const [regiao, setRegiao] = useState<Cidade["regiao"]>(initial?.regiao ?? "Sudeste");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = "Nome obrigatório";
    if (!estado.trim() || estado.length !== 2) errs.estado = "UF com 2 letras (ex: SP)";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // O `regiao` é derivado do `estado` no servidor (mapper). Aqui a UI
    // mantém o campo só pra preencher o filtro local enquanto os dados
    // não voltam da API.
    const payload = { nome, estado: estado.toUpperCase(), regiao };

    const op = initial ? updateCidade(initial.id, payload) : addCidade(payload);
    op.then(() => onSubmit()).catch((e) => setErrors({ nome: (e as Error).message }));
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
          {initial ? "Salvar alterações" : "Cadastrar cidade"}
        </button>
      </div>
    </div>
  );
}
