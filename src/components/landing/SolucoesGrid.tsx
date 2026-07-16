"use client";

/**
 * Seção "Soluções" (tela 13 do guia): grade 3×2 com reveal on-scroll em
 * cascata (gcsolc + transition-delay) e hover lift (translateY -5px + glow
 * azul). Número 01–05 gigante e sutil no canto; o 6º card é o CTA.
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useT } from "@/lib/i18n";

const ICONES: Record<string, React.ReactNode> = {
  vendas: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </>
  ),
  agenda: (
    <>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M8 3v4M16 3v4M4 11h16" />
    </>
  ),
  financeiro: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  contratos: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M10 13h5M10 16h5" />
    </>
  ),
  equipe: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c1.2-3 3.5-4.5 6-4.5s4.8 1.5 6 4.5" />
      <path d="M15.5 5.5a3 3 0 0 1 0 5" />
      <path d="M17 14.6c1.7.7 3 2 4 4.4" />
    </>
  ),
};

const SOLUCOES = [
  {
    icone: "vendas",
    nome: "Vendas",
    chamada: "A Gigs Control automatiza sua operação de vendas.",
    texto:
      "Crie e envie orçamentos em poucos segundos. Quando a proposta é aprovada, a plataforma gera automaticamente todas as informações para o fechamento da negociação e transforma a venda em um show na agenda. Menos trabalho manual, mais agilidade e nenhuma oportunidade perdida.",
  },
  {
    icone: "agenda",
    nome: "Agenda",
    chamada: "Descubra a disponibilidade dos seus artistas em segundos.",
    texto:
      "Compartilhe com seus clientes todas as datas disponíveis dos seus artistas com apenas um clique. Sem consultar agendas manualmente ou perder tempo procurando datas. Respostas mais rápidas e mais oportunidades de fechar novos shows.",
  },
  {
    icone: "financeiro",
    nome: "Financeiro",
    chamada: "Controle absoluto sobre cada recebimento.",
    texto:
      "Acompanhe cachês, vencimentos e pagamentos em tempo real. Receba lembretes automáticos, registre pagamentos, atrasos e cancelamentos, e mantenha toda a gestão financeira organizada em um único lugar.",
  },
  {
    icone: "contratos",
    nome: "Contratos",
    chamada: "Contratos profissionais prontos em minutos.",
    texto:
      "Crie modelos personalizados e gere contratos automaticamente para cada negociação. Envie para assinatura digital diretamente pela Gigs Control, sem plataformas externas, sem custos adicionais e com praticidade para todos os envolvidos.",
  },
  {
    icone: "equipe",
    nome: "Artistas e Equipe",
    chamada: "Permissões inteligentes para cada usuário.",
    texto:
      "Defina exatamente o que artistas, produtores e colaboradores podem visualizar ou editar. Personalize os acessos individualmente e mantenha sua operação segura, organizada e sob total controle.",
  },
];

export default function SolucoesGrid() {
  const t = useT();
  return (
    <section
      id="solucoes"
      className="flex scroll-mt-[72px] flex-col justify-center border-t border-[var(--hairline)] px-6 pb-[60px] pt-14 sm:px-12 lg:min-h-[calc(100dvh-72px)] lg:py-10"
    >
      <h2 className="gcrv mb-9 text-center font-display text-[30px] font-extrabold tracking-[-0.02em] text-primary md:text-[34px]">
        {t("Soluções")}
      </h2>

      <div className="mx-auto grid max-w-[1044px] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SOLUCOES.map((s, i) => (
          <div
            key={s.nome}
            className="gcsolc relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--mock-window)] px-6 py-[26px]"
            style={{ transitionDelay: `${i * 70}ms` }}
          >
            {/* fio de luz no topo */}
            <div
              className="absolute left-0 top-0 h-0.5 w-[46%]"
              style={{
                background:
                  "linear-gradient(90deg, var(--brand), rgba(61,123,255,0))",
              }}
            />
            {/* número gigante sutil */}
            <span className="absolute right-5 top-4 font-display text-[34px] font-extrabold leading-none text-[color-mix(in_srgb,var(--brand)_12%,transparent)]">
              {String(i + 1).padStart(2, "0")}
            </span>

            <div className="mb-3.5 flex items-center gap-3">
              <span
                className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--brand)_30%,transparent)] bg-[color-mix(in_srgb,var(--brand)_13%,transparent)]"
                style={{ boxShadow: "0 0 18px -8px color-mix(in srgb, var(--brand) 70%, transparent)" }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--brand-ink)"
                  strokeWidth="1.8"
                  style={{ width: 20, height: 20, flex: "none" }}
                  aria-hidden
                >
                  {ICONES[s.icone]}
                </svg>
              </span>
              <span className="font-display text-[19px] font-extrabold tracking-[-0.01em] text-primary">
                {t(s.nome)}
              </span>
            </div>
            <div className="mb-2 text-sm font-semibold leading-[1.45] text-[var(--text-soft)]">
              {t(s.chamada)}
            </div>
            <div className="text-[13px] leading-[1.6] text-[var(--text-body)]">
              {t(s.texto)}
            </div>
          </div>
        ))}

        {/* 6º card: CTA */}
        <div
          className="gcsolc relative flex flex-col justify-center gap-3.5 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--brand)_35%,transparent)] px-6 py-[26px]"
          style={{
            transitionDelay: "350ms",
            background:
              "radial-gradient(120% 120% at 20% 0%, color-mix(in srgb, var(--brand) 22%, transparent), color-mix(in srgb, var(--mock-window) 90%, transparent) 60%), var(--mock-window)",
          }}
        >
          <div className="font-display text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-primary">
            {t("Tudo isso num só painel.")}
          </div>
          <div className="text-[13px] leading-[1.55] text-secondary">
            {t(
              "Seis módulos que conversam entre si, do primeiro contato ao cachê na conta."
            )}
          </div>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 self-start rounded px-5 py-3 text-sm font-bold text-white"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {t("Começar agora")}
            <ArrowRight size={15} strokeWidth={2.2} />
          </Link>
        </div>
      </div>
    </section>
  );
}
