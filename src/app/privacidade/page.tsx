import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Placeholder de Política de Privacidade.
 *
 * Substitua pelo texto definitivo (revisado por advogado / encarregado
 * de LGPD). Cobre o básico para a v1 do app.
 */
export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-main text-primary">
      <nav className="border-b border-border">
        <div className="max-w-[800px] mx-auto flex items-center justify-between px-6 h-16">
          <Link href="/" className="flex items-center gap-2">
            <div
              className="rounded-md flex items-center justify-center font-bold text-white h-7 w-7 text-sm"
              style={{ backgroundColor: "var(--module-vendas)" }}
            >
              G
            </div>
            <span className="font-bold tracking-tight text-base">
              GIGS<span className="text-muted"> CONTROL</span>
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary transition-colors"
          >
            <ArrowLeft size={13} />
            Voltar ao site
          </Link>
        </div>
      </nav>

      <article className="max-w-[800px] mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Política de Privacidade
        </h1>
        <p className="text-xs text-muted mb-8">
          Última atualização: 26 de maio de 2026
        </p>

        <Secao titulo="1. Dados que coletamos">
          Coletamos: nome, e-mail e telefone (do cadastro), nome da agência,
          dados de pagamento (processados por gateway parceiro), e o conteúdo
          que você cadastra na plataforma (shows, vendas, contatos, etc).
        </Secao>

        <Secao titulo="2. Como usamos">
          Os dados são usados exclusivamente para: prestar o serviço,
          processar pagamentos, enviar avisos operacionais, dar suporte. Não
          vendemos nem compartilhamos dados pessoais com terceiros para fins
          de marketing.
        </Secao>

        <Secao titulo="3. Onde os dados ficam">
          Hospedados em provedores que cumprem a LGPD e o GDPR — Supabase
          (banco e auth) e Vercel (frontend). Dados ficam em data centers no
          Brasil ou EUA, com criptografia em trânsito e em repouso.
        </Secao>

        <Secao titulo="4. Compartilhamento">
          Não compartilhamos dados pessoais com terceiros, exceto:
          processadores de pagamento (Stripe / Mercado Pago — quando
          integrarmos), ou por exigência legal.
        </Secao>

        <Secao titulo="5. Seus direitos (LGPD)">
          Você pode, a qualquer momento: acessar seus dados, corrigir,
          exportar, ou solicitar exclusão. Use as Configurações da conta ou
          escreva pra{" "}
          <a href="mailto:contato@gigscontrol.com.br" className="text-primary underline">
            contato@gigscontrol.com.br
          </a>
          .
        </Secao>

        <Secao titulo="6. Retenção">
          Mantemos os dados enquanto sua conta estiver ativa. Após o
          cancelamento: 30 dias na lixeira recuperável, 180 dias em backup,
          depois remoção definitiva.
        </Secao>

        <Secao titulo="7. Cookies">
          Usamos apenas cookies essenciais (sessão de login). Nada de
          tracking de terceiros, analytics invasivo, ou publicidade.
        </Secao>

        <Secao titulo="8. Encarregado de proteção de dados (DPO)">
          Email para assuntos de privacidade:{" "}
          <a href="mailto:contato@gigscontrol.com.br" className="text-primary underline">
            contato@gigscontrol.com.br
          </a>
        </Secao>
      </article>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-primary mb-2">{titulo}</h2>
      <p className="text-sm text-secondary leading-relaxed">{children}</p>
    </section>
  );
}
