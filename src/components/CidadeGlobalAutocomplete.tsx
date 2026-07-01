"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X, Loader2, ChevronDown, Search, Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { buscarPais, BRASIL, type Country } from "@/lib/data/countries";
import Flag from "./Flag";
import { exemploCidades } from "@/lib/data/exemplos";

/**
 * Autocomplete de cidade GLOBAL: escolhe o país e depois a cidade.
 *  - Brasil  → catálogo IBGE (/api/cidades-br)
 *  - Mundo   → GeoNames (/api/cidades-mundo)
 *
 * Devolve `CidadeEscolhida` com ibgeId (BR) OU geonameId (mundo) +
 * coordenadas. O país fica no estado interno (default = do value ou BR),
 * então os call sites usam só value/onChange — igual o antigo IBGE.
 */

export type CidadeEscolhida = {
  ibgeId?: string;
  geonameId?: string;
  nome: string;
  uf: string;
  pais: string;
  paisNome?: string;
  latitude?: number;
  longitude?: number;
};

type SugestaoBR = { ibgeId: string; nome: string; uf: string };
type SugestaoMundo = {
  nome: string;
  estado: string;
  latitude: number;
  longitude: number;
  geonameId: string;
};

type Props = {
  value: CidadeEscolhida | null;
  onChange: (c: CidadeEscolhida | null) => void;
  placeholder?: string;
  /** "vertical" (padrão) empilha país sobre cidade; "horizontal" põe lado a lado. */
  orientacao?: "vertical" | "horizontal";
};

function paisInicial(value: CidadeEscolhida | null): Country {
  if (value?.pais) {
    const achado = buscarPais(value.pais).find((p) => p.code === value.pais);
    if (achado) return achado;
  }
  return BRASIL;
}

export default function CidadeGlobalAutocomplete({
  value,
  onChange,
  placeholder,
  orientacao = "vertical",
}: Props) {
  const t = useT();
  const horizontal = orientacao === "horizontal";
  const [pais, setPais] = useState<Country>(() => paisInicial(value));
  const [input, setInput] = useState(value ? value.nome : "");
  const [open, setOpen] = useState(false);
  const [openPais, setOpenPais] = useState(false);
  const [buscaPais, setBuscaPais] = useState("");
  const [sugestoes, setSugestoes] = useState<CidadeEscolhida[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [indisponivel, setIndisponivel] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const paisRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isBR = pais.code === "BR";
  const exemplos = exemploCidades(pais.code);
  const phCidade = exemplos.length
    ? t("Ex: {c}…", { c: exemplos.join(", ") })
    : t(placeholder ?? "Digite a cidade...");

  useEffect(() => {
    setInput(value ? value.nome : "");
  }, [value]);

  useEffect(() => {
    if (!open && !openPais) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
      if (paisRef.current && !paisRef.current.contains(e.target as Node)) {
        setOpenPais(false);
        setBuscaPais("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, openPais]);

  // Busca cidade (debounce 300ms). BR = IBGE; outros = GeoNames.
  useEffect(() => {
    const termo = input.trim();
    if (value && input === value.nome) return;
    if (termo.length < 2) {
      setSugestoes([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    setIndisponivel(false);
    const ctrl = new AbortController();
    const tmr = setTimeout(async () => {
      try {
        const rota = isBR
          ? `/api/cidades-br?q=${encodeURIComponent(termo)}`
          : `/api/cidades-mundo?country=${pais.code}&q=${encodeURIComponent(termo)}`;
        const res = await fetch(rota, { signal: ctrl.signal, credentials: "include" });
        if (!res.ok) {
          setSugestoes([]);
          return;
        }
        const body = await res.json();
        if (body.indisponivel) {
          setIndisponivel(true);
          setSugestoes([]);
          return;
        }
        if (isBR) {
          const cs = (body.cidades ?? []) as SugestaoBR[];
          setSugestoes(
            cs.map((c) => ({
              ibgeId: c.ibgeId,
              nome: c.nome,
              uf: c.uf,
              pais: "BR",
              paisNome: "Brasil",
            }))
          );
        } else {
          const cs = (body.cidades ?? []) as SugestaoMundo[];
          setSugestoes(
            cs.map((c) => ({
              geonameId: c.geonameId,
              nome: c.nome,
              uf: c.estado,
              pais: pais.code,
              paisNome: pais.name,
              latitude: c.latitude,
              longitude: c.longitude,
            }))
          );
        }
        setHighlight(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setSugestoes([]);
      } finally {
        setBuscando(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(tmr);
    };
  }, [input, isBR, pais.code, pais.name, value]);

  const sugestoesPais = buscarPais(buscaPais).slice(0, 60);

  function selecionar(c: CidadeEscolhida) {
    onChange(c);
    setInput(c.nome);
    setOpen(false);
  }
  function limpar() {
    onChange(null);
    setInput("");
    setSugestoes([]);
    setOpen(true);
    inputRef.current?.focus();
  }
  function trocarPais(p: Country) {
    setPais(p);
    setOpenPais(false);
    setBuscaPais("");
    onChange(null);
    setInput("");
    setSugestoes([]);
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
    <div className={horizontal ? "flex gap-2 items-start" : "flex flex-col gap-2"}>
      {/* Seletor de país */}
      <div ref={paisRef} className={`relative ${horizontal ? "basis-[45%] shrink-0 min-w-0" : ""}`}>
        <button
          type="button"
          onClick={() => setOpenPais((v) => !v)}
          className={`w-full flex items-center gap-2 bg-elevated border rounded-md px-3 py-2 transition-colors ${
            openPais ? "border-border-strong" : "border-border hover:border-border-strong"
          }`}
        >
          <Flag code={pais.code} size={20} className="flex-shrink-0" />
          <span className="text-sm text-primary font-medium flex-1 text-left truncate">
            {pais.name}
          </span>
          <ChevronDown
            size={14}
            className={`text-muted transition-transform ${openPais ? "rotate-180" : ""}`}
          />
        </button>

        {openPais && (
          <div
            className={`absolute top-full mt-1 z-50 bg-surface border border-border rounded-md flex flex-col ${
              horizontal ? "left-0 w-64 max-w-[80vw]" : "left-0 right-0"
            }`}
            style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.6)", maxHeight: 320 }}
          >
            <div className="p-2 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-2.5 py-1.5">
                <Search size={13} className="text-muted flex-shrink-0" />
                <input
                  autoFocus
                  value={buscaPais}
                  onChange={(e) => setBuscaPais(e.target.value)}
                  placeholder={t("Buscar país...")}
                  className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted min-w-0"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {sugestoesPais.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => trocarPais(p)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    p.code === pais.code ? "bg-elevated" : "hover:bg-elevated"
                  }`}
                >
                  <Flag code={p.code} size={20} className="flex-shrink-0" />
                  <span
                    className={`flex-1 text-sm truncate ${
                      p.code === pais.code ? "text-primary font-medium" : "text-secondary"
                    }`}
                  >
                    {p.name}
                  </span>
                  {p.code === pais.code && (
                    <Check size={14} className="text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cidade */}
      <div ref={wrapRef} className={`relative ${horizontal ? "flex-1 min-w-0" : ""}`}>
        <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2 focus-within:border-border-strong transition-colors">
          <MapPin size={14} className="text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setOpen(true);
              if (value) onChange(null);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={phCidade}
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted outline-none min-w-0"
          />
          {buscando && <Loader2 size={14} className="text-muted animate-spin flex-shrink-0" />}
          {input && !buscando && (
            <button
              type="button"
              onClick={limpar}
              className="text-muted hover:text-primary transition-colors flex-shrink-0"
              aria-label={t("Limpar")}
              tabIndex={-1}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {open && sugestoes.length > 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md z-40 max-h-[280px] overflow-y-auto"
            style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}
          >
            {sugestoes.map((c, idx) => (
              <button
                key={`${c.geonameId ?? c.ibgeId ?? c.nome}-${idx}`}
                type="button"
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => selecionar(c)}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  idx === highlight ? "bg-elevated text-primary" : "text-secondary hover:bg-elevated"
                }`}
              >
                <span className="font-medium truncate">{c.nome}</span>
                {c.uf && (
                  <span className="text-xs text-muted flex-shrink-0 truncate max-w-[45%]">
                    {c.uf}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {open && !buscando && input.trim().length >= 2 && sugestoes.length === 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md z-40 px-3 py-3 text-xs text-muted"
            style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}
          >
            {indisponivel
              ? t("Autocomplete mundial indisponível (config. GeoNames).")
              : t("Nenhuma cidade encontrada.")}
          </div>
        )}
      </div>
    </div>
  );
}
