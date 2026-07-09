"use client";

/**
 * Seção "Perguntas frequentes" (tela 13 do guia): acordeão nativo
 * (<details>), número azul, "+" que vira "−" ao abrir (sem rotação — a haste
 * vertical some via .gcvert), resposta com fade (gcfaqin). Primeira aberta.
 */

import { useT } from "@/lib/i18n";

const PERGUNTAS = [
  {
    q: "Qual a diferença entre mensal e anual?",
    a: "No plano anual você paga uma vez ao ano com um preço por mês mais baixo. No mensal, a cobrança é mês a mês com flexibilidade total.",
  },
  {
    q: 'O que conta como "artista"?',
    a: "Cada DJ, cantor ou MC que você gerencia na plataforma. O plano limita quantos podem estar ativos ao mesmo tempo.",
  },
  {
    q: "Como funciona o limite de usuários?",
    a: "Cada plano inclui 1 admin (você), uma cota de artistas e uma cota de usuários adicionais — produtores, vendedores e financeiro. O total de logins é a soma dos três.",
  },
  {
    q: "Posso trocar de plano depois?",
    a: "Sim. Você pode subir ou descer de plano conforme a operação cresce, respeitando os limites de cada um.",
  },
  {
    q: "Cada pessoa vê tudo?",
    a: "Não. O Admin controla o que cada papel acessa. Artistas, por exemplo, nunca veem dados de outros artistas.",
  },
];

export default function FaqLanding() {
  const t = useT();
  return (
    <section className="border-t border-[rgba(255,255,255,.06)] px-6 pb-[60px] pt-14 sm:px-12">
      <h2 className="mb-[30px] text-center font-display text-[26px] font-extrabold tracking-[-0.02em] text-primary">
        {t("Perguntas frequentes")}
      </h2>

      <div className="mx-auto flex max-w-[760px] flex-col gap-3">
        {PERGUNTAS.map((item, i) => (
          <details
            key={item.q}
            className="gcfaq gcrv rounded-xl border border-[rgba(255,255,255,.08)] bg-[#0E121A]"
            open={i === 0}
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <summary className="flex items-center gap-3.5 px-5 py-[17px]">
              <span className="flex-none font-mono text-[11px] font-bold text-[#5B93FF]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 text-[14.5px] font-bold text-primary">
                {t(item.q)}
              </span>
              <span className="gcplus flex h-[26px] w-[26px] flex-none items-center justify-center rounded-lg border border-[rgba(255,255,255,.12)] bg-surface">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#7DB0FF"
                  strokeWidth="2.4"
                  style={{ width: 13, height: 13 }}
                  aria-hidden
                >
                  <path d="M5 12h14" />
                  <path className="gcvert" d="M12 5v14" />
                </svg>
              </span>
            </summary>
            <div className="gcfaqa pb-[18px] pl-[54px] pr-14 text-[13.5px] leading-[1.6] text-secondary">
              {t(item.a)}
            </div>
          </details>
        ))}
      </div>

      <div className="gcrv mt-[30px] text-center" style={{ transitionDelay: "300ms" }}>
        <div className="mb-3.5 text-[13.5px] text-secondary">
          {t(
            "Ainda com dúvidas? Fale com o time e a gente te ajuda a escolher o plano certo."
          )}
        </div>
        <a
          href="mailto:contato@gigscontrol.com.br"
          className="inline-flex rounded-[10px] border border-[rgba(255,255,255,.14)] bg-surface px-6 py-3 text-[13.5px] font-bold text-primary"
        >
          {t("Fale com a gente")}
        </a>
      </div>
    </section>
  );
}
