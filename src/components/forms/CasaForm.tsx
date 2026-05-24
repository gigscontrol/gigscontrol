"use client";

import { useState } from "react";
import { Field, TextInput, TextArea, Select } from "../Field";
import { useContatos } from "@/lib/contatos-context";
import type { Casa, TipoCasa } from "@/types";

const TIPOS: { value: TipoCasa; label: string }[] = [
  { value: "club", label: "Club / Boate" },
  { value: "festival", label: "Festival" },
  { value: "festa-privada", label: "Festa privada" },
  { value: "bar", label: "Bar / Pub" },
  { value: "arena", label: "Arena / Estádio" },
  { value: "outro", label: "Outro" },
];

type Props = {
  initial?: Casa;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function CasaForm({ initial, onSubmit, onCancel }: Props) {
  const { cidades, addCasa, updateCasa } = useContatos();

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [tipo, setTipo] = useState<TipoCasa>(initial?.tipo ?? "club");
  const [cidadeId, setCidadeId] = useState<string>(initial?.cidadeId ?? cidades[0]?.id ?? "");
  const [capacidade, setCapacidade] = useState<string>(initial?.capacidade?.toString() ?? "");
  const [endereco, setEndereco] = useState(initial?.endereco ?? "");
  const [contatoResponsavel, setContatoResponsavel] = useState(initial?.contatoResponsavel ?? "");
  const [telefone, setTelefone] = useState(initial?.telefone ?? "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = "Nome obrigatório";
    if (!cidadeId) errs.cidade = "Selecione uma cidade";
    if (capacidade && isNaN(Number(capacidade))) errs.capacidade = "Capacidade deve ser número";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const payload = {
      nome,
      tipo,
      cidadeId,
      capacidade: capacidade ? Number(capacidade) : undefined,
      endereco: endereco || undefined,
      contatoResponsavel: contatoResponsavel || undefined,
      telefone: telefone || undefined,
      observacoes: observacoes || undefined,
    };

    const op = initial ? updateCasa(initial.id, payload) : addCasa(payload);
    op.then(() => onSubmit()).catch((e) => setErrors({ nome: (e as Error).message }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome" required error={errors.nome}>
          <TextInput value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Club Laroc" />
        </Field>
        <Field label="Tipo" required>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCasa)}>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Cidade" required error={errors.cidade}>
          <Select value={cidadeId} onChange={(e) => setCidadeId(e.target.value)}>
            <option value="">Selecione...</option>
            {cidades.map((c) => (
              <option key={c.id} value={c.id}>{c.nome} — {c.estado}</option>
            ))}
          </Select>
        </Field>
        <Field label="Capacidade" hint="Quantidade de pessoas" error={errors.capacidade}>
          <TextInput
            type="number"
            value={capacidade}
            onChange={(e) => setCapacidade(e.target.value)}
            placeholder="1200"
            min={0}
          />
        </Field>
        <Field label="Contato responsável">
          <TextInput value={contatoResponsavel} onChange={(e) => setContatoResponsavel(e.target.value)} placeholder="Renata Souza" />
        </Field>
        <Field label="Telefone">
          <TextInput value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
        </Field>
      </div>

      <Field label="Endereço">
        <TextInput value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número — Bairro" />
      </Field>

      <Field label="Observações">
        <TextArea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Notas internas sobre a casa, política do local, etc." />
      </Field>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button onClick={onCancel} className="btn btn-secondary">Cancelar</button>
        <button onClick={handleSave} className="btn btn-primary">
          {initial ? "Salvar alterações" : "Cadastrar casa"}
        </button>
      </div>
    </div>
  );
}
