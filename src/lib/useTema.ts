"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hook do tema claro/escuro. Padrão = ESCURO (ausência do atributo
 * data-theme no <html>). O claro é `html[data-theme="light"]`, persistido em
 * localStorage["gc-theme"]. O atributo já vem setado antes da hidratação pelo
 * script no-flash do layout — aqui só lemos o estado atual e alternamos.
 */
export type Tema = "dark" | "light";

function lerTemaAtual(): Tema {
  if (typeof window === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

function aplicarNoDom(tema: Tema) {
  const el = document.documentElement;
  if (tema === "light") el.setAttribute("data-theme", "light");
  else el.removeAttribute("data-theme");
}

export function useTema() {
  // Estado inicial SEMPRE "dark" (= o que o servidor renderiza). Ler o
  // atributo real do <html> direto no useState causaria hydration mismatch
  // quando o tema é claro (script no-flash seta o atributo ANTES da
  // hidratação): o servidor manda o ícone Sol, o cliente renderizaria Lua,
  // o React descartaria o HTML do servidor e re-renderizaria o documento —
  // APAGANDO o data-theme do <html> (bug real observado: claro revertia pro
  // escuro em todo reload). Sincronizamos com o DOM depois do mount.
  const [tema, setTema] = useState<Tema>("dark");

  useEffect(() => {
    setTema(lerTemaAtual());
  }, []);

  const alternar = useCallback(() => {
    setTema((atual) => {
      const novo: Tema = atual === "dark" ? "light" : "dark";
      aplicarNoDom(novo);
      try {
        localStorage.setItem("gc-theme", novo);
      } catch {
        /* localStorage indisponível (modo privado etc.) — ignora */
      }
      return novo;
    });
  }, []);

  // Sincroniza entre abas: outra aba trocou o tema → reflete aqui.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "gc-theme") return;
      const novo: Tema = e.newValue === "light" ? "light" : "dark";
      aplicarNoDom(novo);
      setTema(novo);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { tema, alternar };
}
