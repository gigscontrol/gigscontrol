/**
 * Mockup do módulo Agência — seção 06 da página /recursos (zigue-zague).
 * Janelinha com avatares da equipe, pills de perfil e matriz de permissões
 * por módulo. 100% estático (sem hooks/props/animação) — decorativo, dados
 * de exemplo fixos.
 */

import {
  Janela,
  SidebarMini,
  LinhaLista,
  ChipFlutuante,
} from "@/components/landing/recursos/MockKit";

/* avatares da fileira — o 2º (ML) é o ativo/selecionado */
const AVATARES = [
  { iniciais: "BR", ativo: false },
  { iniciais: "ML", ativo: true },
  { iniciais: "DL", ativo: false },
];

/* matriz de permissões por módulo (linhas) */
const LINHAS: {
  modulo: string;
  marcado: boolean;
  seg: "VER" | "EDITAR" | null;
}[] = [
  { modulo: "Agenda", marcado: true, seg: "VER" },
  { modulo: "Vendas", marcado: true, seg: "EDITAR" },
  { modulo: "Financeiro", marcado: true, seg: "EDITAR" },
  { modulo: "Contratos", marcado: false, seg: null },
];

/* checkbox 13×13 — marcado (azul + check branco) ou vazio (borda) */
function Checkbox({ marcado }: { marcado: boolean }) {
  if (!marcado) {
    return (
      <span className="h-[13px] w-[13px] flex-none rounded-[4px] border border-[color-mix(in_srgb,var(--text-primary)_18%,transparent)]" />
    );
  }
  return (
    <span className="flex h-[13px] w-[13px] flex-none items-center justify-center rounded-[4px] bg-[var(--brand)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        style={{ width: 9, height: 9 }}
        aria-hidden
      >
        <path d="M5 12l5 5L20 6" />
      </svg>
    </span>
  );
}

/* segmented mini VER/EDITAR — null = apagado (feature desmarcada) */
function Segmented({ ativo }: { ativo: "VER" | "EDITAR" | null }) {
  return (
    <span className="flex flex-none overflow-hidden rounded-[5px] border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)]">
      {(["VER", "EDITAR"] as const).map((op) => (
        <span
          key={op}
          className={`px-1.5 py-[2px] font-mono text-[6.5px] uppercase ${
            ativo === op
              ? "bg-[color-mix(in_srgb,var(--brand)_20%,transparent)] text-[var(--brand-ink)]"
              : "text-[var(--text-label)]"
          }`}
        >
          {op}
        </span>
      ))}
    </span>
  );
}

export default function MockAgencia() {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 top-1/2 w-[420px]"
      style={{ margin: "-170px 0 0 -210px" }}
    >
      <div className="relative">
        <Janela w={380}>
          <SidebarMini ativo="Agência" />
          <div className="min-w-0 flex-1 px-3 py-2.5">
            <div className="text-[12px] font-bold text-primary">Equipe</div>

            {/* fileira de avatares + nome do ativo */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex gap-1.5">
                {AVATARES.map((a) => (
                  <span
                    key={a.iniciais}
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{
                      background: "linear-gradient(135deg, var(--brand), var(--brand-ink))",
                      boxShadow: a.ativo
                        ? "0 0 0 2px var(--bg-surface), 0 0 0 4px var(--brand)"
                        : undefined,
                    }}
                  >
                    {a.iniciais}
                  </span>
                ))}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-primary">
                  Manu Lima
                </span>
                <span className="font-mono text-[7.5px] text-[var(--text-label)]">
                  FINANCEIRO
                </span>
              </div>
            </div>

            {/* pills de perfil */}
            <div className="mt-2.5 flex gap-1.5">
              <span className="rounded-full border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] px-2.5 py-[3px] font-mono text-[7.5px] font-semibold uppercase text-[var(--text-dim)]">
                ADMIN
              </span>
              <span className="rounded-full border border-[color-mix(in_srgb,var(--brand)_55%,transparent)] bg-[var(--brand-weak)] px-2.5 py-[3px] font-mono text-[7.5px] font-semibold uppercase text-[var(--brand-ink)]">
                FINANCEIRO
              </span>
              <span className="rounded-full border border-[color-mix(in_srgb,var(--text-primary)_10%,transparent)] px-2.5 py-[3px] font-mono text-[7.5px] font-semibold uppercase text-[var(--text-dim)]">
                JURÍDICO
              </span>
            </div>

            {/* matriz de permissões */}
            <div className="mt-2.5 flex flex-col gap-[5px]">
              {LINHAS.map((l) => (
                <LinhaLista key={l.modulo}>
                  <span className="min-w-0 flex-1 text-[9.5px] text-[var(--text-soft)]">
                    {l.modulo}
                  </span>
                  <Checkbox marcado={l.marcado} />
                  <Segmented ativo={l.marcado ? l.seg : null} />
                </LinhaLista>
              ))}
            </div>
          </div>
        </Janela>

        <ChipFlutuante
          estilo={{ top: -12, right: -6 }}
          corIcone="var(--brand)"
          icone={
            <>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 018 0v4" />
            </>
          }
          titulo="Permissão atualizada"
          detalhe="DJ Lunar · só Agenda"
        />

        <ChipFlutuante
          estilo={{ bottom: -12, left: -6 }}
          corIcone="var(--brand)"
          icone={
            <>
              <circle cx="9" cy="8" r="3.5" />
              <path d="M3 20c1.4-3.3 3.6-5 6-5s4.6 1.7 6 5" />
              <path d="M18 6v6M15 9h6" />
            </>
          }
          titulo="Novo membro cadastrado"
          detalhe="Rafa Costa · convite enviado"
        />
      </div>
    </div>
  );
}
