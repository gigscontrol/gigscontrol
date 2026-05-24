"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, X, Plus, ChevronDown, Search, Check, Loader2 } from "lucide-react";
import {
  buscarCidades,
  carregarCidadesBR,
  normalizar,
  type CidadeBR,
} from "@/lib/data/cidades-br";
import { useContatos } from "@/lib/contatos-context";
import { buscarPais, type Country } from "@/lib/data/countries";
import Flag from "./Flag";

export type CidadeSelecionada = {
  id?: string;
  nome: string;
  uf: string;
  regiao: CidadeBR["regiao"];
  pais: string;
  paisNome: string;
};

type Props = {
  value: CidadeSelecionada | null;
  onChange: (c: CidadeSelecionada | null) => void;
  country: Country;
  onCountryChange: (c: Country) => void;
  error?: string;
};

export default function CityAutocomplete({
  value,
  onChange,
  country,
  onCountryChange,
  error,
}: Props) {
  const { cidades: cidadesUsuario } = useContatos();
  const [input, setInput] = useState(value ? value.nome : "");
  const [ufManual, setUfManual] = useState(value?.uf ?? "");
  const [open, setOpen] = useState(false);
  const [openCountry, setOpenCountry] = useState(false);
  const [searchCountry, setSearchCountry] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [carregandoIBGE, setCarregandoIBGE] = useState(false);
  // Tick para re-renderizar quando a base do IBGE termina de carregar
  const [, forceUpdate] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isBR = country.code === "BR";

  // Carrega cidades do IBGE quando entra em modo BR
  useEffect(() => {
    if (!isBR) return;
    let mounted = true;
    setCarregandoIBGE(true);
    carregarCidadesBR().then(() => {
      if (mounted) {
        setCarregandoIBGE(false);
        forceUpdate((n) => n + 1);
      }
    });
    return () => {
      mounted = false;
    };
  }, [isBR]);

  useEffect(() => {
    setInput(value ? value.nome : "");
    setUfManual(value?.uf ?? "");
  }, [value]);

  useEffect(() => {
    if (!open && !openCountry) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setOpenCountry(false);
        setSearchCountry("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, openCountry]);

  const sugestoes = useMemo<CidadeSelecionada[]>(() => {
    if (!isBR) return [];
    const q = normalizar(input);
    if (q.length < 2) return [];

    const doUsuario: CidadeSelecionada[] = cidadesUsuario
      .filter((c) => normalizar(c.nome).includes(q))
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        uf: c.estado,
        regiao: c.regiao,
        pais: "BR",
        paisNome: "Brasil",
      }));

    const offline = buscarCidades(input, 12);

    const seen = new Set<string>();
    const out: CidadeSelecionada[] = [];
    for (const c of doUsuario) {
      const k = `${normalizar(c.nome)}|${c.uf}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(c);
      }
    }
    for (const c of offline) {
      const k = `${normalizar(c.nome)}|${c.uf}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ nome: c.nome, uf: c.uf, regiao: c.regiao, pais: "BR", paisNome: "Brasil" });
      }
    }
    return out.slice(0, 12);
  }, [input, cidadesUsuario, isBR, carregandoIBGE]);

  useEffect(() => setHighlight(0), [sugestoes.length]);

  const sugestoesPais = useMemo(
    () => buscarPais(searchCountry).slice(0, 60),
    [searchCountry]
  );

  function selecionar(c: CidadeSelecionada) {
    onChange(c);
    setInput(c.nome);
    setOpen(false);
  }

  function criarManual() {
    if (input.trim().length < 2) return;
    if (isBR) {
      onChange({
        nome: input.trim(),
        uf: "",
        regiao: "Sudeste",
        pais: "BR",
        paisNome: "Brasil",
      });
    }
    setOpen(false);
  }

  function limpar() {
    onChange(null);
    setInput("");
    setUfManual("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !isBR) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(sugestoes.length, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight < sugestoes.length) selecionar(sugestoes[highlight]);
      else if (input.trim().length >= 2) criarManual();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function atualizarManual(novoNome: string, novoUf: string) {
    if (!novoNome.trim()) {
      onChange(null);
      return;
    }
    onChange({
      nome: novoNome.trim(),
      uf: novoUf.trim().toUpperCase(),
      regiao: "Sudeste",
      pais: country.code,
      paisNome: country.name,
    });
  }

  const podeCadastrarManual =
    isBR && input.trim().length >= 2 && sugestoes.length === 0 && !carregandoIBGE;

  return (
    <div className="flex flex-col gap-3">
      {/* Seletor de país */}
      <div ref={countryRef} className="relative">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-secondary">País</span>
          <button
            type="button"
            onClick={() => setOpenCountry((v) => !v)}
            className={`
              flex items-center gap-2 bg-elevated border rounded-md px-3 py-2 transition-colors
              ${openCountry ? "border-border-strong" : "border-border hover:border-border-hover"}
            `}
          >
            <span className="text-xl leading-none flex-shrink-0">{country.flag}</span>
            <span className="text-sm text-primary font-medium flex-1 text-left">
              {country.name}
            </span>
            <span className="text-xs text-muted tabular-nums">+{country.ddi}</span>
            <ChevronDown
              size={14}
              className={`text-muted transition-transform ${openCountry ? "rotate-180" : ""}`}
            />
          </button>
        </label>

        {openCountry && (
          <div
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-surface border border-border rounded-md shadow-xl flex flex-col"
            style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.6)", maxHeight: 380 }}
          >
            <div className="p-2 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2 bg-elevated border border-border rounded-md px-3 py-2">
                <Search size={14} className="text-muted flex-shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchCountry}
                  onChange={(e) => setSearchCountry(e.target.value)}
                  placeholder="Buscar país..."
                  className="flex-1 bg-transparent outline-none text-sm text-primary placeholder:text-muted min-w-0"
                />
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {sugestoesPais.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted">Nenhum país</div>
              ) : (
                sugestoesPais.map((p) => {
                  const isActive = p.code === country.code;
                  return (
                    <button
                      key={p.code}
                      type="button"
                      onClick={() => {
                        onCountryChange(p);
                        setOpenCountry(false);
                        setSearchCountry("");
                        onChange(null);
                        setInput("");
                        setUfManual("");
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                        isActive ? "bg-elevated" : "hover:bg-elevated"
                      }`}
                    >
                      <span className="text-xl leading-none flex-shrink-0">{p.flag}</span>
                      <span
                        className={`flex-1 text-sm truncate font-medium ${
                          isActive ? "text-primary" : "text-secondary"
                        }`}
                      >
                        {p.name}
                      </span>
                      <span className="text-xs tabular-nums text-muted">+{p.ddi}</span>
                      {isActive && <Check size={14} className="text-primary flex-shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cidade */}
      {isBR ? (
        <div ref={wrapRef} className="relative">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-secondary">
              Cidade <span className="text-danger">*</span>
            </span>
            <div
              className={`
                flex items-center gap-2 bg-elevated border rounded-md px-3 py-2 transition-colors
                ${error ? "border-danger" : "border-border focus-within:border-border-strong"}
              `}
            >
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
                placeholder="Digite a cidade..."
                autoComplete="off"
                className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted outline-none min-w-0"
              />
              {carregandoIBGE && input.length >= 2 && (
                <Loader2 size={14} className="text-muted animate-spin flex-shrink-0" />
              )}
              {input && !carregandoIBGE && (
                <button
                  type="button"
                  onClick={limpar}
                  className="text-muted hover:text-primary transition-colors flex-shrink-0"
                  aria-label="Limpar"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </label>

          {error && <p className="text-xs text-danger mt-1">{error}</p>}

          {value && !open && (
            <p className="text-xs text-muted mt-1">
              {value.uf ? (
                <>
                  {value.uf} · {value.regiao}
                  {value.id !== undefined && " · já cadastrada"}
                </>
              ) : (
                <span className="text-warning">UF a definir</span>
              )}
            </p>
          )}

          {open && (sugestoes.length > 0 || podeCadastrarManual || carregandoIBGE) && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-xl z-40 max-h-[320px] overflow-y-auto"
              style={{ boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}
            >
              {sugestoes.map((c, idx) => {
                const isH = idx === highlight;
                return (
                  <button
                    key={`${c.nome}-${c.uf}-${idx}`}
                    type="button"
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => selecionar(c)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                      isH ? "bg-elevated text-primary" : "text-secondary hover:bg-elevated"
                    }`}
                  >
                    <span className="font-medium truncate">{c.nome}</span>
                    <span className="text-xs text-muted flex-shrink-0">
                      {c.id !== undefined && "★ "}
                      {c.uf} · {c.regiao}
                    </span>
                  </button>
                );
              })}

              {carregandoIBGE && sugestoes.length === 0 && input.length >= 2 && (
                <div className="flex items-center justify-center gap-2 p-3 text-xs text-muted">
                  <Loader2 size={12} className="animate-spin" />
                  Buscando municípios no IBGE...
                </div>
              )}

              {podeCadastrarManual && (
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(sugestoes.length)}
                  onClick={criarManual}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors border-t border-border ${
                    highlight === sugestoes.length
                      ? "bg-elevated text-primary"
                      : "text-secondary hover:bg-elevated"
                  }`}
                >
                  <Plus size={13} className="text-muted" />
                  <span>
                    Usar &quot;<span className="font-semibold text-primary">{input.trim()}</span>&quot; como nova cidade
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        // País não-BR: input manual
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1.5 col-span-2">
            <span className="text-xs font-medium text-secondary">
              Cidade <span className="text-danger">*</span>
            </span>
            <div
              className={`
                flex items-center gap-2 bg-elevated border rounded-md px-3 py-2 transition-colors
                ${error ? "border-danger" : "border-border focus-within:border-border-strong"}
              `}
            >
              <MapPin size={14} className="text-muted flex-shrink-0" />
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  atualizarManual(e.target.value, ufManual);
                }}
                placeholder={`Cidade em ${country.name}`}
                className="flex-1 bg-transparent text-sm text-primary placeholder:text-muted outline-none min-w-0"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-secondary">Estado/Província</span>
            <input
              type="text"
              value={ufManual}
              onChange={(e) => {
                setUfManual(e.target.value);
                atualizarManual(input, e.target.value);
              }}
              placeholder="Opcional"
              className="bg-elevated border border-border rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted outline-none focus:border-border-strong"
            />
          </label>
          {error && <p className="text-xs text-danger col-span-3">{error}</p>}
        </div>
      )}
    </div>
  );
}
