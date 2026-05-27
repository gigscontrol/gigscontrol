"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X, Loader2 } from "lucide-react";

/**
 * Autocomplete de cidades do Brasil usando o catálogo do IBGE (via
 * proxy server-side em `/api/cidades-br`).
 *
 * Diferente do CityAutocomplete (usado em Contatos), esse é minimalista:
 *  - Só Brasil (artistas residem aqui)
 *  - Sem "criar manual" (catálogo IBGE é canônico)
 *  - Devolve `{ ibgeId, nome, uf }` pronto pra salvar no artista
 *
 * Debounce 300ms pra não martelar o endpoint a cada tecla.
 */

export type CidadeIBGE = {
  ibgeId: string;
  nome: string;
  uf: string;
};

type Props = {
  value: CidadeIBGE | null;
  onChange: (c: CidadeIBGE | null) => void;
  placeholder?: string;
};

export default function CidadeIBGEAutocomplete({
  value,
  onChange,
  placeholder = "Digite a cidade...",
}: Props) {
  const [input, setInput] = useState(value ? `${value.nome} - ${value.uf}` : "");
  const [open, setOpen] = useState(false);
  const [sugestoes, setSugestoes] = useState<CidadeIBGE[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincroniza input quando o value muda externamente (ex.: edição)
  useEffect(() => {
    setInput(value ? `${value.nome} - ${value.uf}` : "");
  }, [value]);

  // Click fora fecha o dropdown
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Debounce: busca 300ms após parar de digitar
  useEffect(() => {
    const termo = input.trim();
    // Se input == "Cidade - UF" do value atual, não busca de novo
    if (value && input === `${value.nome} - ${value.uf}`) return;
    if (termo.length < 2) {
      setSugestoes([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/cidades-br?q=${encodeURIComponent(termo)}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) {
          setSugestoes([]);
          return;
        }
        const body = (await res.json()) as { cidades?: CidadeIBGE[] };
        setSugestoes(body.cidades ?? []);
        setHighlight(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setSugestoes([]);
        }
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [input, value]);

  function selecionar(c: CidadeIBGE) {
    onChange(c);
    setInput(`${c.nome} - ${c.uf}`);
    setOpen(false);
  }

  function limpar() {
    onChange(null);
    setInput("");
    setSugestoes([]);
    setOpen(true);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || sugestoes.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(sugestoes.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selecionar(sugestoes[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
        <MapPin size={14} className="text-muted flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
            // Se já tinha valor, limpa (porque o texto não bate mais)
            if (value) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted outline-none min-w-0"
        />
        {buscando && (
          <Loader2 size={14} className="text-muted animate-spin flex-shrink-0" />
        )}
        {input && !buscando && (
          <button
            type="button"
            onClick={limpar}
            className="text-muted hover:text-primary transition-colors flex-shrink-0"
            aria-label="Limpar"
            tabIndex={-1}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && sugestoes.length > 0 && (
        <div
          className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-xl z-40 max-h-[280px] overflow-y-auto"
          style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}
        >
          {sugestoes.map((c, idx) => {
            const isH = idx === highlight;
            return (
              <button
                key={c.ibgeId}
                type="button"
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => selecionar(c)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  isH ? "bg-elevated text-primary" : "text-secondary hover:bg-elevated"
                }`}
              >
                <span className="font-medium truncate">{c.nome}</span>
                <span className="text-xs text-muted flex-shrink-0">{c.uf}</span>
              </button>
            );
          })}
        </div>
      )}

      {open && !buscando && input.trim().length >= 2 && sugestoes.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-xl z-40 px-3 py-3 text-xs text-muted">
          Nenhuma cidade encontrada.
        </div>
      )}
    </div>
  );
}
