import { type ReactNode } from "react";

/**
 * Renderizador de markdown LEVE e SEGURO — devolve nós React (NUNCA innerHTML),
 * então não há vetor de XSS. Suporta negrito, itálico, código, listas com "- ",
 * links [texto](url) e links soltos — SEMPRE e SÓ com esquema http(s), fechando
 * o "javascript:" que a auditoria pegou.
 */

// Um único regex com alternativas por prioridade. Os grupos de URL exigem
// http(s):// — logo javascript:/data: nunca viram link (caem como texto puro).
// Montado via new RegExp (string) pra não engasgar o parser com backtick/barra.
const INLINE = new RegExp(
  "(\\*\\*([^*]+)\\*\\*)" + // **negrito**
    "|(`([^`]+)`)" + // `código`
    "|(\\*([^*\\n]+)\\*)" + // *itálico*
    "|(_([^_\\n]+)_)" + // _itálico_
    "|(\\[([^\\]]+)\\]\\((https?://[^\\s)]+)\\))" + // [texto](url)
    "|(https?://[^\\s]+)", // link solto
  "g"
);

function inline(texto: string, keyBase: string): ReactNode[] {
  const nos: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(texto)) !== null) {
    if (m.index > last) nos.push(texto.slice(last, m.index));
    const key = `${keyBase}-${i++}`;
    if (m[2] !== undefined) {
      nos.push(<strong key={key}>{m[2]}</strong>);
    } else if (m[4] !== undefined) {
      nos.push(
        <code key={key} className="px-1 py-0.5 rounded bg-elevated text-xs">
          {m[4]}
        </code>
      );
    } else if (m[6] !== undefined) {
      nos.push(<em key={key}>{m[6]}</em>);
    } else if (m[8] !== undefined) {
      nos.push(<em key={key}>{m[8]}</em>);
    } else if (m[10] !== undefined && m[11] !== undefined) {
      nos.push(
        <a
          key={key}
          href={m[11]}
          target="_blank"
          rel="noreferrer"
          className="underline break-all"
          style={{ color: "var(--info)" }}
        >
          {m[10]}
        </a>
      );
    } else if (m[12] !== undefined) {
      nos.push(
        <a
          key={key}
          href={m[12]}
          target="_blank"
          rel="noreferrer"
          className="underline break-all"
          style={{ color: "var(--info)" }}
        >
          {m[12]}
        </a>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < texto.length) nos.push(texto.slice(last));
  return nos;
}

export function renderMarkdownSeguro(texto: string): ReactNode {
  const linhas = (texto ?? "").split("\n");
  const blocos: ReactNode[] = [];
  let lista: ReactNode[] = [];
  const flush = (k: string) => {
    if (lista.length) {
      blocos.push(
        <ul key={`ul-${k}`} className="list-disc pl-5 my-1 space-y-0.5">
          {lista}
        </ul>
      );
      lista = [];
    }
  };
  linhas.forEach((linha, idx) => {
    const li = linha.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      lista.push(<li key={`li-${idx}`}>{inline(li[1], `li${idx}`)}</li>);
      return;
    }
    flush(String(idx));
    if (linha.trim() === "") {
      blocos.push(<div key={`sp-${idx}`} className="h-2" />);
      return;
    }
    blocos.push(
      <p key={`p-${idx}`} className="my-0.5">
        {inline(linha, `p${idx}`)}
      </p>
    );
  });
  flush("end");
  return <div className="text-sm leading-relaxed break-words">{blocos}</div>;
}
