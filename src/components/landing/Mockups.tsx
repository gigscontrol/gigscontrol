"use client";

/**
 * Mockups das telas do GIGS CONTROL — representações estilizadas usadas
 * na landing page para mostrar como o produto é.
 *
 * São feitos com HTML/CSS (não são prints reais). Quando você tiver as
 * capturas de tela reais da dashboard, basta substituir cada componente
 * por uma <img src="/prints/agenda.png" .../> que a moldura (BrowserFrame)
 * continua funcionando igual.
 */

const COR = {
  agenda: "#3b82f6",
  vendas: "#a855f7",
  financeiro: "#22c55e",
  contratos: "#14b8a6",
  contatos: "#f97316",
};

/* Barra lateral simplificada, comum a todos os mockups */
function MiniSidebar({ ativo }: { ativo: keyof typeof COR }) {
  const itens: Array<{ k: keyof typeof COR; label: string }> = [
    { k: "agenda", label: "Agenda" },
    { k: "vendas", label: "Vendas" },
    { k: "financeiro", label: "Financeiro" },
    { k: "contratos", label: "Contratos" },
    { k: "contatos", label: "Contatos" },
  ];
  return (
    <div className="w-28 sm:w-36 border-r border-border bg-surface flex-shrink-0 py-3 px-2 hidden sm:block">
      <div className="flex items-center gap-1.5 px-1.5 mb-4">
        <div
          className="h-5 w-5 rounded flex items-center justify-center text-[0.6rem] font-bold text-white"
          style={{ backgroundColor: COR.vendas }}
        >
          G
        </div>
        <span className="text-[0.65rem] font-bold">
          GIGS<span className="text-muted"> CONTROL</span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {itens.map((it) => {
          const on = it.k === ativo;
          return (
            <div
              key={it.k}
              className="flex items-center gap-1.5 px-1.5 py-1.5 rounded text-[0.65rem]"
              style={{
                backgroundColor: on ? "var(--bg-elevated)" : "transparent",
                color: on ? "var(--text-primary)" : "var(--text-muted)",
                fontWeight: on ? 600 : 400,
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: on ? COR[it.k] : "var(--border-strong)" }}
              />
              {it.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Cartãozinho de estatística */
function MiniStat({
  label,
  valor,
  cor,
}: {
  label: string;
  valor: string;
  cor: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-2 flex-1 min-w-0">
      <div className="text-[0.55rem] text-muted uppercase tracking-wide truncate">
        {label}
      </div>
      <div className="text-sm font-bold tabular-nums" style={{ color: cor }}>
        {valor}
      </div>
    </div>
  );
}

/* ============================================================
   MOCKUP — Painel principal (hero)
   ============================================================ */
export function MockDashboard() {
  return (
    <div className="flex h-[300px] sm:h-[380px] text-left">
      <MiniSidebar ativo="agenda" />
      <div className="flex-1 p-3 sm:p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold">Visão geral</div>
            <div className="text-[0.6rem] text-muted">
              Resumo da operação
            </div>
          </div>
          <div
            className="h-6 w-16 rounded text-[0.6rem] flex items-center justify-center text-white font-semibold"
            style={{ backgroundColor: COR.vendas }}
          >
            + Novo
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <MiniStat label="Shows no mês" valor="24" cor={COR.agenda} />
          <MiniStat label="Orçamentos" valor="18" cor={COR.vendas} />
          <MiniStat label="A receber" valor="R$ 86k" cor={COR.financeiro} />
          <MiniStat label="Contratantes" valor="42" cor={COR.contatos} />
        </div>

        {/* Gráfico fake */}
        <div className="rounded-md border border-border bg-surface p-3 mb-3">
          <div className="text-[0.6rem] text-muted mb-2">
            Faturamento por mês
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {[40, 65, 50, 80, 60, 95, 70, 88].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t"
                style={{
                  height: `${h}%`,
                  backgroundColor: COR.vendas,
                  opacity: 0.35 + (h / 100) * 0.65,
                }}
              />
            ))}
          </div>
        </div>

        {/* Lista fake */}
        <div className="rounded-md border border-border bg-surface p-2">
          {["Show — CZ · São Paulo", "Orçamento — Dudu · Curitiba"].map(
            (t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-1.5 border-b border-border/50 last:border-0"
              >
                <span
                  className="h-5 w-5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: i === 0 ? COR.agenda : COR.vendas }}
                />
                <div className="text-[0.65rem] text-secondary truncate">
                  {t}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MOCKUP — Agenda de Shows
   ============================================================ */
export function MockAgenda() {
  const dias = Array.from({ length: 35 }, (_, i) => i - 2);
  const comShow: Record<number, string> = {
    3: COR.agenda,
    8: COR.vendas,
    12: COR.agenda,
    17: COR.financeiro,
    18: COR.agenda,
    24: COR.vendas,
    29: COR.agenda,
  };
  return (
    <div className="flex h-[300px] sm:h-[360px] text-left">
      <MiniSidebar ativo="agenda" />
      <div className="flex-1 p-3 sm:p-4 overflow-hidden">
        <div className="text-sm font-bold mb-0.5">Agenda de Shows</div>
        <div className="text-[0.6rem] text-muted mb-3">Maio de 2026</div>

        {/* Cabeçalho dos dias */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
            <div
              key={i}
              className="text-[0.55rem] text-muted text-center font-medium"
            >
              {d}
            </div>
          ))}
        </div>
        {/* Grade do calendário */}
        <div className="grid grid-cols-7 gap-1">
          {dias.map((d, i) => {
            const valido = d >= 1 && d <= 31;
            const cor = comShow[d];
            return (
              <div
                key={i}
                className="aspect-square rounded border flex flex-col items-center justify-center"
                style={{
                  borderColor: "var(--border-color)",
                  backgroundColor: valido
                    ? "var(--bg-surface)"
                    : "transparent",
                }}
              >
                {valido && (
                  <>
                    <span className="text-[0.55rem] text-secondary">{d}</span>
                    {cor && (
                      <span
                        className="h-1 w-1 rounded-full mt-0.5"
                        style={{ backgroundColor: cor }}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MOCKUP — Vendas / Orçamentos
   ============================================================ */
export function MockVendas() {
  const linhas = [
    { ev: "Festival Verão", dj: "CZ", v: "R$ 12.000", st: "Aceito", c: COR.financeiro },
    { ev: "Casamento Premium", dj: "Dudu", v: "R$ 8.500", st: "Enviado", c: COR.vendas },
    { ev: "Aniversário 30", dj: "Maninho", v: "R$ 6.000", st: "Aceito", c: COR.financeiro },
    { ev: "Formatura Med", dj: "Blackdrumm", v: "R$ 15.000", st: "Pendente", c: "var(--text-muted)" },
    { ev: "Réveillon Club", dj: "CZ", v: "R$ 20.000", st: "Aceito", c: COR.financeiro },
  ];
  return (
    <div className="flex h-[300px] sm:h-[360px] text-left">
      <MiniSidebar ativo="vendas" />
      <div className="flex-1 p-3 sm:p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold">Histórico de Orçamentos</div>
            <div className="text-[0.6rem] text-muted">18 orçamentos</div>
          </div>
          <div
            className="h-6 px-2 rounded text-[0.6rem] flex items-center text-white font-semibold"
            style={{ backgroundColor: COR.vendas }}
          >
            + Orçamento
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface overflow-hidden">
          {linhas.map((l, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2.5 py-2 border-b border-border/60 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[0.65rem] font-medium text-primary truncate">
                  {l.ev}
                </div>
                <div className="text-[0.55rem] text-muted">{l.dj}</div>
              </div>
              <div className="text-[0.65rem] tabular-nums text-secondary font-semibold">
                {l.v}
              </div>
              <span
                className="text-[0.55rem] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${l.c}22`, color: l.c }}
              >
                {l.st}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MOCKUP — Financeiro
   ============================================================ */
export function MockFinanceiro() {
  const parcelas = [
    { ev: "Festival Verão — 1/2", venc: "10/05", st: "Pago", c: COR.financeiro },
    { ev: "Casamento Premium", venc: "15/05", st: "Pago", c: COR.financeiro },
    { ev: "Réveillon Club — 1/3", venc: "20/05", st: "Pendente", c: COR.agenda },
    { ev: "Aniversário 30", venc: "02/05", st: "Atrasado", c: "#ef4444" },
    { ev: "Formatura Med — 2/2", venc: "28/05", st: "Pendente", c: COR.agenda },
  ];
  return (
    <div className="flex h-[300px] sm:h-[360px] text-left">
      <MiniSidebar ativo="financeiro" />
      <div className="flex-1 p-3 sm:p-4 overflow-hidden">
        <div className="text-sm font-bold mb-0.5">Controle de Pagamentos</div>
        <div className="text-[0.6rem] text-muted mb-3">Maio de 2026</div>

        <div className="flex gap-2 mb-3">
          <MiniStat label="Recebido" valor="R$ 20,5k" cor={COR.financeiro} />
          <MiniStat label="A receber" valor="R$ 35k" cor={COR.agenda} />
          <MiniStat label="Atrasado" valor="R$ 6k" cor="#ef4444" />
        </div>

        <div className="rounded-md border border-border bg-surface overflow-hidden">
          {parcelas.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2.5 py-2 border-b border-border/60 last:border-0"
            >
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.c }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[0.65rem] font-medium text-primary truncate">
                  {p.ev}
                </div>
              </div>
              <div className="text-[0.55rem] text-muted">venc. {p.venc}</div>
              <span
                className="text-[0.55rem] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: `${p.c}22`, color: p.c }}
              >
                {p.st}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MOCKUP — Contratos / Assinatura
   ============================================================ */
function MiniCheck({ cor }: { cor: string }) {
  return (
    <span
      className="h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `${cor}22`, color: cor }}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

export function MockContratos() {
  const sig = [
    { nome: "Studio Eventos", papel: "Contratante" },
    { nome: "DJ CZ", papel: "Contratado" },
  ];
  return (
    <div className="flex h-[300px] sm:h-[360px] text-left">
      <MiniSidebar ativo="contratos" />
      <div className="flex-1 p-3 sm:p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold">Contrato CTR-0001</div>
            <div className="text-[0.6rem] text-muted">Festival Verão · DJ CZ</div>
          </div>
          <span
            className="h-6 px-2 rounded text-[0.6rem] flex items-center text-white font-semibold"
            style={{ backgroundColor: COR.contratos }}
          >
            Assinado
          </span>
        </div>

        <div className="flex gap-3">
          {/* Folha do contrato (representa a A4) */}
          <div className="flex-1 rounded-md border border-border bg-white p-2.5 hidden sm:block">
            <div
              className="text-[0.6rem] font-bold text-center mb-2"
              style={{ color: "#0f172a" }}
            >
              CONTRATO DE SHOW
            </div>
            {[100, 92, 96, 72, 88].map((w, i) => (
              <div
                key={i}
                className="h-1 rounded mb-1.5"
                style={{ width: `${w}%`, backgroundColor: "#e2e8f0" }}
              />
            ))}
            <div className="flex gap-3 mt-4">
              {["Contratante", "Contratado"].map((p) => (
                <div key={p} className="flex-1">
                  <div className="h-px bg-[#cbd5e1] mb-1" />
                  <div
                    className="text-[0.45rem] text-center"
                    style={{ color: "#64748b" }}
                  >
                    {p}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Painel de assinaturas */}
          <div className="w-full sm:w-44 flex-shrink-0">
            <div className="text-[0.55rem] text-muted mb-1.5 uppercase tracking-wide">
              Assinaturas
            </div>
            <div className="flex flex-col gap-1.5">
              {sig.map((s, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border bg-surface p-1.5 flex items-center gap-1.5"
                >
                  <MiniCheck cor={COR.financeiro} />
                  <div className="min-w-0">
                    <div className="text-[0.6rem] font-medium text-primary truncate">
                      {s.nome}
                    </div>
                    <div
                      className="text-[0.5rem]"
                      style={{ color: COR.financeiro }}
                    >
                      {s.papel} · assinado
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-md border border-border bg-surface p-1.5 flex items-center gap-1.5">
              <MiniCheck cor={COR.contratos} />
              <div className="min-w-0">
                <div className="text-[0.6rem] font-medium text-primary">
                  Verificação
                </div>
                <div
                  className="text-[0.5rem]"
                  style={{ color: COR.contratos }}
                >
                  Selfie + facial
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
