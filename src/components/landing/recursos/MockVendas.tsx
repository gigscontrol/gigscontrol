/**
 * Mockup do módulo Vendas — seção 02 da página /recursos (zigue-zague).
 * Janelinha com funil de métricas + orçamentos recentes. 100% estático
 * (sem hooks/props/animação) — decorativo, dados de exemplo fixos.
 */

import {
  Janela,
  SidebarMini,
  TileMetrica,
  LinhaLista,
  BadgeMono,
  ChipFlutuante,
} from "@/components/landing/recursos/MockKit";

export default function MockVendas() {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 top-1/2 w-[420px]"
      style={{ margin: "-165px 0 0 -210px" }}
    >
      <div className="relative">
        <Janela w={380}>
          <SidebarMini ativo="Vendas" />
          <div className="min-w-0 flex-1 px-3 py-2.5">
            <div className="text-[12px] font-bold text-primary">Vendas</div>

            {/* 4 tiles de métrica */}
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <TileMetrica
                rotulo="ORÇAMENTOS"
                valor="32"
                cor="var(--brand-ink)"
                sub="6 aguardando"
              />
              <TileMetrica rotulo="VENDAS FECHADAS" valor="21" cor="var(--success-ink)" />
              <TileMetrica rotulo="EM NEGOCIAÇÃO" valor="8" cor="var(--warning-ink)" />
              <TileMetrica rotulo="PERDIDOS" valor="3" cor="var(--danger)" />
            </div>

            {/* orçamentos recentes */}
            <div className="mt-2.5 font-mono text-[7px] font-semibold tracking-[.1em] text-[var(--text-label)]">
              ORÇAMENTOS RECENTES
            </div>
            <div className="mt-1.5 flex flex-col gap-[5px]">
              <LinhaLista>
                <span className="flex-none font-mono text-[8.5px] text-muted">
                  #0148
                </span>
                <span className="min-w-0 flex-1 truncate text-[9.5px] text-[var(--text-soft)]">
                  Maninhoo — Florianópolis
                </span>
                <BadgeMono tom="info">ENVIADO</BadgeMono>
              </LinhaLista>
              <LinhaLista>
                <span className="flex-none font-mono text-[8.5px] text-muted">
                  #0147
                </span>
                <span className="min-w-0 flex-1 truncate text-[9.5px] text-[var(--text-soft)]">
                  DJ Lunar — Rio de Janeiro
                </span>
                <BadgeMono tom="success">FECHADO</BadgeMono>
              </LinhaLista>
              <LinhaLista>
                <span className="flex-none font-mono text-[8.5px] text-muted">
                  #0146
                </span>
                <span className="min-w-0 flex-1 truncate text-[9.5px] text-[var(--text-soft)]">
                  Maninhoo — Belo Horizonte
                </span>
                <BadgeMono tom="warning">NEGOCIANDO</BadgeMono>
              </LinhaLista>
            </div>
          </div>
        </Janela>

        <ChipFlutuante
          estilo={{ top: -12, right: -8 }}
          corIcone="var(--brand)"
          icone={<path d="M5 12h14M13 6l6 6-6 6" />}
          titulo="Orçamento → Venda"
          detalhe="1 clique · direto pra agenda"
        />

        <ChipFlutuante
          estilo={{ bottom: -12, left: -6 }}
          corIcone="var(--brand)"
          icone={
            <>
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4z" />
            </>
          }
          titulo="Novo orçamento enviado"
          detalhe="#0148 · Maninhoo"
        />
      </div>
    </div>
  );
}
