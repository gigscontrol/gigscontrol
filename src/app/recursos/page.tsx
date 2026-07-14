"use client";

// Página /recursos — vitrine dos 6 módulos (tela 13 do guia).
// Copy verbatim do dono; cards espelham o SolucoesGrid da landing.
// Sem hero próprio: a página abre direto na seção 01 (Agenda), cujo título é o
// h1 da página; ritmo/margem espelham as seções do /inicio.

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import LandingNav from "@/components/landing/LandingNav";
import FooterLanding from "@/components/landing/FooterLanding";
import { BadgeSecao } from "@/components/landing/blocos";
import "@/components/landing/redesign.css";
import { useT } from "@/lib/i18n";
import MockAgenda from "@/components/landing/recursos/MockAgenda";
import MockVendas from "@/components/landing/recursos/MockVendas";
import MockFinanceiro from "@/components/landing/recursos/MockFinanceiro";
import MockContratos from "@/components/landing/recursos/MockContratos";
import MockContatos from "@/components/landing/recursos/MockContatos";
import MockAgencia from "@/components/landing/recursos/MockAgencia";

// Módulos na ordem do dono (Agenda 01 … Agência 06). Texto verbatim.
const MODULOS = [
  {
    nome: "Agenda",
    texto:
      "Centralize toda a operação dos seus shows em um único lugar. Tenha acesso rápido aos horários, contatos do contratante, localização, passagens aéreas, reservas de hotel, riders técnico, de camarim e efeitos especiais, além das datas e formas de pagamento. Tudo organizado para que nenhum detalhe passe despercebido.",
  },
  {
    nome: "Vendas",
    texto:
      "Crie orçamentos profissionais em poucos segundos e acompanhe todo o histórico de negociações. Quando uma proposta for aprovada, transforme o orçamento em uma venda completa com apenas um clique, enviando automaticamente todas as informações para a agenda do artista.",
  },
  {
    nome: "Financeiro",
    texto:
      "Tenha controle total sobre os recebimentos do seu casting. Acompanhe valores, formas de pagamento, vencimentos, parcelas e pagamentos pendentes em um único painel, evitando atrasos e garantindo uma gestão financeira muito mais organizada.",
  },
  {
    nome: "Contratos",
    texto:
      "Automatize a criação de contratos utilizando modelos personalizados. Vincule um contrato diretamente à venda, gere documentos completos em poucos segundos e envie para assinatura digital, reduzindo burocracia e agilizando o fechamento dos seus eventos.",
  },
  {
    nome: "Contatos",
    texto:
      "Construa um banco de dados inteligente com todos os contratantes, produtores, casas de shows e clientes interessados. Encontre qualquer contato em segundos utilizando filtros por região, cidade ou histórico de negociações, facilitando novas vendas e o relacionamento com seus clientes.",
  },
  {
    nome: "Agência",
    texto:
      "Gerencie toda a sua equipe com total controle de permissões. Defina exatamente o que cada usuário pode visualizar ou editar, organize artistas e colaboradores e mantenha sua operação segura, profissional e totalmente centralizada.",
  },
];

// Bullets + mockup por módulo (chaveado pelo nome). Os bullets são trechos
// LITERAIS dos parágrafos do dono (viram chaves i18n — §4). Cada Mock é a
// vitrine estática do módulo (importada de recursos/*).
const EXTRAS: Record<
  string,
  { bullets: string[]; Mock: React.ComponentType }
> = {
  Agenda: {
    bullets: [
      "horários, contatos do contratante, localização",
      "passagens aéreas, reservas de hotel",
      "riders técnico, de camarim e efeitos especiais",
    ],
    Mock: MockAgenda,
  },
  Vendas: {
    bullets: [
      "orçamentos profissionais em poucos segundos",
      "histórico de negociações",
      "transforme o orçamento em uma venda completa com apenas um clique",
    ],
    Mock: MockVendas,
  },
  Financeiro: {
    bullets: [
      "valores, formas de pagamento",
      "vencimentos, parcelas",
      "pagamentos pendentes",
    ],
    Mock: MockFinanceiro,
  },
  Contratos: {
    bullets: [
      "modelos personalizados",
      "vincule um contrato diretamente à venda",
      "assinatura digital",
    ],
    Mock: MockContratos,
  },
  Contatos: {
    bullets: [
      "contratantes, produtores, casas de shows",
      "filtros por região, cidade",
      "histórico de negociações",
    ],
    Mock: MockContatos,
  },
  Agência: {
    bullets: [
      "total controle de permissões",
      "o que cada usuário pode visualizar ou editar",
      "organize artistas e colaboradores",
    ],
    Mock: MockAgencia,
  },
};

// Liga cada módulo (nome/texto verbatim) aos seus bullets e Mock.
const SECOES = MODULOS.map((m) => ({
  nome: m.nome,
  texto: m.texto,
  bullets: EXTRAS[m.nome].bullets,
  Mock: EXTRAS[m.nome].Mock,
}));

// Uma seção de módulo do zigue-zague. par (índice 0,2,4) = texto à ESQUERDA /
// visual à DIREITA; ímpar inverte via lg:order. DOM copy→visual; no mobile
// order-* inverte (visual em cima), desktop preserva via lg:order-*. Reveals
// de fora pra dentro (gcrv-l / gcrv-r).
function SecaoModulo({
  indice,
  nome,
  texto,
  bullets,
  Mock,
}: {
  indice: number;
  nome: string;
  texto: string;
  bullets: string[];
  Mock: React.ComponentType;
}) {
  const t = useT();
  const par = indice % 2 === 0;
  // 1ª seção vira o h1 da página (sem hero); demais ficam h2.
  const Titulo = (indice === 0 ? "h1" : "h2") as "h1" | "h2";
  return (
    <section
      className={`grid items-center gap-6 px-6 py-[64px] sm:px-12 lg:py-[88px] ${
        par ? "lg:grid-cols-[1.05fr_1fr]" : "lg:grid-cols-[1fr_1.05fr]"
      } ${indice > 0 ? "border-t border-[var(--hairline)]" : ""}`}
      style={{
        background: par
          ? "radial-gradient(70% 90% at 78% 30%, var(--glow-section), var(--glow-fade) 60%)"
          : "radial-gradient(70% 90% at 22% 30%, var(--glow-section), var(--glow-fade) 60%)",
      }}
    >
      {/* COPY */}
      <div
        className={`${
          par ? "gcrv-l order-2 lg:order-none" : "gcrv-r order-2 lg:order-2"
        } flex flex-col justify-center`}
      >
        <div
          className={`flex flex-col gap-[18px] ${
            par ? "lg:ml-auto" : ""
          } lg:max-w-[470px]`}
        >
          {/* badge da seção (sem o chip de ícone — igual ao /inicio) */}
          <BadgeSecao>
            {`0${indice + 1} · `}
            {t(nome)}
          </BadgeSecao>

          <Titulo className="font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] md:text-[34px] xl:text-[38px]">
            {t(nome)}
          </Titulo>
          <p className="max-w-[470px] text-[15px] leading-[1.6] text-secondary xl:text-base">
            {t(texto)}
          </p>
          <ul className="flex flex-col gap-2">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 text-[13px] leading-[1.5] text-secondary"
              >
                <Check
                  size={14}
                  strokeWidth={2.2}
                  className="mt-[2px] flex-none"
                  style={{ color: "#5B93FF" }}
                />
                {t(b)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* VISUAL */}
      <div
        aria-hidden
        className={`${
          par ? "gcrv-r order-1 lg:order-none" : "gcrv-l order-1 lg:order-1"
        } relative min-h-[440px] overflow-hidden max-md:min-h-[380px]`}
        style={{ transitionDelay: "120ms" }}
      >
        <div className="gcvis-scale absolute inset-0">
          <Mock />
        </div>
      </div>
    </section>
  );
}

export default function RecursosPage() {
  const t = useT();

  // Reveals on-scroll — mesmo observer da landing (LandingRedesign).
  useEffect(() => {
    const els = document.querySelectorAll(
      ".gcrv, .gcrv-l, .gcrv-r, .gcrv-s, .gcsolc"
    );
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            e.target.classList.add("gcin");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-main text-primary">
      <LandingNav />

      {/* SEIS MÓDULOS — seções zigue-zague (copy + mockup estático). Sem hero:
          a seção 01 abre a página e seu título é o h1 (ver SecaoModulo). */}
      <div id="modulos" className="scroll-mt-[72px]">
        {SECOES.map((s, i) => (
          <SecaoModulo key={s.nome} indice={i} {...s} />
        ))}
      </div>

      {/* CTA FINAL — espelho do 6º card do SolucoesGrid, como faixa */}
      <section className="px-6 pb-[72px] sm:px-12">
        <div
          className="gcrv mx-auto flex max-w-[1044px] flex-col items-center gap-3.5 overflow-hidden rounded-2xl border border-[rgba(61,123,255,.35)] px-6 py-10 text-center"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--brand) 22%, transparent), color-mix(in srgb, var(--mock-window) 90%, transparent) 60%), var(--mock-window)",
          }}
        >
          <div className="font-display text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-primary md:text-[26px]">
            {t("Tudo isso num só painel.")}
          </div>
          <div className="max-w-[440px] text-[13px] leading-[1.55] text-secondary">
            {t(
              "Seis módulos que conversam entre si, do primeiro contato ao cachê na conta."
            )}
          </div>
          <Link
            href="/signup"
            className="mt-1 inline-flex items-center gap-2 rounded-[10px] px-5 py-3 text-sm font-bold text-white"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {t("Começar agora")}
            <ArrowRight size={15} strokeWidth={2.2} />
          </Link>
        </div>
      </section>

      <FooterLanding />
    </div>
  );
}
