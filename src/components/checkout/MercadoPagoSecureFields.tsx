"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import Script from "next/script";
import { Loader2, AlertTriangle, QrCode, CreditCard } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { DadosPixBrick } from "./MercadoPagoBrick";

/**
 * Formulário de cartão 100% NOSSO via MP Secure Fields (mp.fields) — substitui o
 * Payment Brick mantendo o backend do Mercado Pago INTOCADO. Drop-in do
 * `MercadoPagoBrick` (mesma assinatura de props) pra o SeletorGateway.
 *
 * SAQ-A: número do cartão, validade e CVV vivem SÓ dentro dos 3 iframes seguros
 * do MP (mp.fields). O nosso DOM só tem titular, documento, parcelas, emissor e
 * e-mail — NUNCA PAN/CVV.
 *
 * Fluxo cartão:
 *  1. Carrega o SDK v2 (`sdk.mercadopago.com/js/v2`) + `new MercadoPago(pk)`.
 *  2. Monta os 3 secure fields; a borda/fundo/foco/erro ficam no NOSSO container
 *     (via focus/blur/error). O iframe só recebe um `style` casando os tokens.
 *  3. `binChange` → getPaymentMethods (bandeira) + getInstallments (parcelas) +
 *     getIssuers quando o método pedir emissor. Tudo com CACHE por bin.
 *  4. Submit: `mp.fields.createCardToken(...)` → token → POST
 *     /api/checkout/mercadopago com o MESMO shape que o Brick postava.
 *
 * Fluxo PIX: botão separado posta `{ payment_method_id:'pix', payer:{ email } }`
 * (sem token/parcelas) e cai no PixPendente pelos mesmos callbacks.
 *
 * Sem `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY` (ou SDK falhando), dispara
 * `onIndisponivel()` — o pai degrada pro Stripe.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY;

type Props = {
  plano: string;
  ciclo: string;
  /** valor TOTAL em REAIS (o MP pede o amount em unidade da moeda). */
  valor: number;
  email?: string;
  onAprovado: (paymentId: string) => void;
  onPix: (dados: DadosPixBrick) => void;
  onErro: (msg: string) => void;
  /** Env ausente / SDK falhou / public key inválida → o pai degrada. */
  onIndisponivel: () => void;
};

// ── Tipos locais do SDK MP (sem types oficiais no npm; espelha o padrão do Brick).
type SecureField = {
  mount: (id: string) => SecureField;
  unmount: () => void;
  on: (evento: string, cb: (data: SecureFieldEvent) => void) => SecureField;
};
type SecureFieldEvent = {
  field?: string;
  bin?: string;
  errorMessages?: { message: string }[];
};
type IdentificationType = { id: string; name: string };
type PaymentMethod = { id: string; name?: string; additional_info_needed?: string[] };
type Issuer = { id: string | number; name: string };
type PayerCost = {
  installments: number;
  recommended_message: string;
  installment_rate?: number;
};
type MpSecureInstance = {
  fields: {
    create: (
      tipo: "cardNumber" | "expirationDate" | "securityCode",
      opcoes: { placeholder?: string; style?: Record<string, string> }
    ) => SecureField;
    createCardToken: (dados: {
      cardholderName: string;
      identificationType: string;
      identificationNumber: string;
    }) => Promise<{ id: string }>;
  };
  getIdentificationTypes: () => Promise<IdentificationType[]>;
  getPaymentMethods: (args: { bin: string }) => Promise<{ results: PaymentMethod[] }>;
  getInstallments: (args: {
    amount: string;
    bin: string;
    paymentTypeId: string;
  }) => Promise<{ payer_costs: PayerCost[] }[]>;
  getIssuers: (args: {
    paymentMethodId: string;
    bin: string;
  }) => Promise<Issuer[]>;
};
type MpSecureCtor = new (
  publicKey: string,
  options?: { locale?: string }
) => MpSecureInstance;

// A augmentação global `Window.MercadoPago` já vem do MercadoPagoBrick.tsx;
// aqui só lemos o construtor do window com um cast pro nosso shape (o SDK é o
// mesmo, só usamos métodos diferentes — Secure Fields em vez de bricks()).

// ── Estilo injetado NOS iframes (só tipografia/cor do texto; a moldura é
// nossa). Lido em runtime (o iframe do MP não enxerga nossas CSS vars) —
// acompanha o tema ativo (claro/escuro) no momento da montagem. Limitação
// aceita: alternar o tema com os campos já montados não retematiza o iframe.
function estiloCampo(): Record<string, string> {
  const estiloRaiz = getComputedStyle(document.documentElement);
  const corVar = (nome: string, fallback: string) =>
    estiloRaiz.getPropertyValue(nome).trim() || fallback;
  return {
    color: corVar("--text-primary", "#F1F3F7"),
    "font-size": "14px",
    "font-family":
      "'Hanken Grotesk', system-ui, -apple-system, sans-serif",
    placeholderColor: corVar("--text-disabled", "#5E6470"),
  };
}

/** Wrapper NOSSO de um secure field: label + moldura reativa (foco/erro). */
function CampoSeguro({
  label,
  containerId,
  focado,
  temErro,
  className = "",
}: {
  label: string;
  containerId: string;
  focado: boolean;
  temErro: boolean;
  className?: string;
}) {
  const borda = temErro
    ? "var(--danger)"
    : focado
    ? "var(--brand)"
    : "var(--border-strong)";
  return (
    <div className={className}>
      <label
        className="block text-xs mb-1"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      {/* O iframe do MP é montado aqui dentro; a moldura é 100% nossa. */}
      <div
        id={containerId}
        style={{
          height: 40,
          background: "var(--bg-main)",
          border: `1px solid ${borda}`,
          borderRadius: "var(--r-control)",
          padding: "0 0.65rem",
          transition: "border-color 0.15s ease",
        }}
      />
    </div>
  );
}

export default function MercadoPagoSecureFields({
  plano,
  ciclo,
  valor,
  email,
  onAprovado,
  onPix,
  onErro,
  onIndisponivel,
}: Props) {
  const t = useT();

  // ids únicos e válidos pros containers dos iframes.
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, "");
  const idNumero = `mp-sf-num-${uid}`;
  const idValidade = `mp-sf-exp-${uid}`;
  const idCvv = `mp-sf-cvv-${uid}`;

  const [sdkPronto, setSdkPronto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [erroFatal, setErroFatal] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  // Cartão ou PIX — o toggle fica no topo desta seção do Mercado Pago.
  const [metodo, setMetodo] = useState<"cartao" | "pix">("cartao");
  // Parcelamento SÓ no anual (mensal e Stripe são 1x). Não anunciamos parcelas.
  const mostrarParcelas = ciclo === "anual";

  // Campos NOSSOS (fora dos iframes).
  const [cardholderName, setCardholderName] = useState("");
  const [emailPagador, setEmailPagador] = useState(email ?? "");
  const [tiposDoc, setTiposDoc] = useState<IdentificationType[]>([]);
  const [tipoDoc, setTipoDoc] = useState("");
  const [numeroDoc, setNumeroDoc] = useState("");

  // Derivados do bin (bandeira, parcelas, emissor).
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [precisaEmissor, setPrecisaEmissor] = useState(false);
  const [emissores, setEmissores] = useState<Issuer[]>([]);
  const [issuerId, setIssuerId] = useState<string>("");
  const [parcelas, setParcelas] = useState<PayerCost[]>([]);
  const [parcelaSel, setParcelaSel] = useState<number>(1);

  // Validade dos 3 secure fields (habilita o botão).
  const [numeroValido, setNumeroValido] = useState(false);
  const [validadeValida, setValidadeValida] = useState(false);
  const [cvvValido, setCvvValido] = useState(false);

  // Foco/erro por campo pra moldura reativa.
  const [foco, setFoco] = useState({ numero: false, validade: false, cvv: false });
  const [erroCampo, setErroCampo] = useState({
    numero: false,
    validade: false,
    cvv: false,
  });

  const mpRef = useRef<MpSecureInstance | null>(null);
  // Cache do último bin consultado — evita rechamar getPaymentMethods/
  // getInstallments/getIssuers pro mesmo bin (o binChange dispara a cada dígito).
  const binRef = useRef<string | null>(null);

  // Callbacks/valores voláteis pro submit não fechar sobre versões velhas.
  const cbRef = useRef({ plano, ciclo, onAprovado, onPix, onErro, t });
  cbRef.current = { plano, ciclo, onAprovado, onPix, onErro, t };

  // Sem public key → indisponível na hora (o pai degrada pro Stripe).
  useEffect(() => {
    if (!PUBLIC_KEY) onIndisponivel();
  }, [onIndisponivel]);

  // ── Recalcula bandeira/parcelas/emissor pro bin (com cache). Idempotente por bin.
  const atualizarPorBin = useCallback(
    async (bin: string | undefined) => {
      const mp = mpRef.current;
      if (!mp) return;
      const binLimpo = (bin ?? "").slice(0, 6);
      if (binLimpo.length < 6) {
        // bin curto/apagado → limpa derivados e o cache.
        binRef.current = null;
        setPaymentMethodId(null);
        setPrecisaEmissor(false);
        setEmissores([]);
        setIssuerId("");
        setParcelas([]);
        setParcelaSel(1);
        return;
      }
      if (binRef.current === binLimpo) return; // mesmo bin — não rechama.
      binRef.current = binLimpo;

      try {
        const { results } = await mp.getPaymentMethods({ bin: binLimpo });
        if (binRef.current !== binLimpo) return; // bin mudou durante o await.
        const metodo = results?.[0];
        if (!metodo) {
          setPaymentMethodId(null);
          setParcelas([]);
          return;
        }
        setPaymentMethodId(metodo.id);
        const pedeEmissor = !!metodo.additional_info_needed?.includes("issuer_id");
        setPrecisaEmissor(pedeEmissor);

        // Parcelas (até 12x) — lê payer_costs.
        const inst = await mp.getInstallments({
          amount: String(valor),
          bin: binLimpo,
          paymentTypeId: "credit_card",
        });
        if (binRef.current !== binLimpo) return;
        const custos = (inst?.[0]?.payer_costs ?? [])
          .filter((c) => c.installments <= 12)
          .sort((a, b) => a.installments - b.installments);
        setParcelas(custos);
        setParcelaSel(custos[0]?.installments ?? 1);

        // Emissor (só quando o método pede).
        if (pedeEmissor) {
          const iss = await mp.getIssuers({
            paymentMethodId: metodo.id,
            bin: binLimpo,
          });
          if (binRef.current !== binLimpo) return;
          setEmissores(iss ?? []);
          setIssuerId(iss?.[0]?.id != null ? String(iss[0].id) : "");
        } else {
          setEmissores([]);
          setIssuerId("");
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[MercadoPagoSecureFields] bin", (e as Error).message);
      }
    },
    [valor]
  );

  // ── Monta o SDK + os 3 secure fields quando o script carrega.
  useEffect(() => {
    if (!PUBLIC_KEY || !sdkPronto) return;

    let ativo = true;
    const campos: SecureField[] = [];

    (async () => {
      // O SDK v2 expõe um só construtor; o cast troca a "view" bricks()→fields.
      const Ctor = window.MercadoPago as unknown as MpSecureCtor | undefined;
      if (!Ctor) {
        onIndisponivel();
        return;
      }
      try {
        const mp = new Ctor(PUBLIC_KEY, { locale: "pt-BR" });
        mpRef.current = mp;
        const estiloCampoAtual = estiloCampo();

        // Tipos de documento (popula o select de documento).
        try {
          const tipos = await mp.getIdentificationTypes();
          if (ativo && tipos?.length) {
            setTiposDoc(tipos);
            setTipoDoc((atual) => atual || tipos[0].id);
          }
        } catch {
          /* sem tipos — o backend ainda aceita sem identification */
        }

        // Número do cartão.
        const fNum = mp.fields
          .create("cardNumber", {
            placeholder: "0000 0000 0000 0000",
            style: estiloCampoAtual,
          })
          .mount(idNumero);
        fNum
          .on("focus", () => ativo && setFoco((f) => ({ ...f, numero: true })))
          .on("blur", () => ativo && setFoco((f) => ({ ...f, numero: false })))
          .on("validityChange", (d) => {
            if (!ativo) return;
            setNumeroValido(!(d.errorMessages && d.errorMessages.length > 0));
          })
          .on("error", (d) => {
            if (!ativo) return;
            setErroCampo((e) => ({
              ...e,
              numero: !!(d.errorMessages && d.errorMessages.length > 0),
            }));
          })
          .on("binChange", (d) => {
            void atualizarPorBin(d.bin);
          });
        campos.push(fNum);

        // Validade.
        const fExp = mp.fields
          .create("expirationDate", {
            placeholder: "MM/AA",
            style: estiloCampoAtual,
          })
          .mount(idValidade);
        fExp
          .on("focus", () => ativo && setFoco((f) => ({ ...f, validade: true })))
          .on("blur", () => ativo && setFoco((f) => ({ ...f, validade: false })))
          .on("validityChange", (d) => {
            if (!ativo) return;
            setValidadeValida(!(d.errorMessages && d.errorMessages.length > 0));
          })
          .on("error", (d) => {
            if (!ativo) return;
            setErroCampo((e) => ({
              ...e,
              validade: !!(d.errorMessages && d.errorMessages.length > 0),
            }));
          });
        campos.push(fExp);

        // CVV.
        const fCvv = mp.fields
          .create("securityCode", {
            placeholder: "CVV",
            style: estiloCampoAtual,
          })
          .mount(idCvv);
        fCvv
          .on("focus", () => ativo && setFoco((f) => ({ ...f, cvv: true })))
          .on("blur", () => ativo && setFoco((f) => ({ ...f, cvv: false })))
          .on("validityChange", (d) => {
            if (!ativo) return;
            setCvvValido(!(d.errorMessages && d.errorMessages.length > 0));
          })
          .on("error", (d) => {
            if (!ativo) return;
            setErroCampo((e) => ({
              ...e,
              cvv: !!(d.errorMessages && d.errorMessages.length > 0),
            }));
          });
        campos.push(fCvv);

        if (ativo) setMontado(true);
      } catch (e) {
        if (!ativo) return;
        onIndisponivel();
        // eslint-disable-next-line no-console
        console.error(
          "[MercadoPagoSecureFields] init falhou",
          (e as Error).message
        );
      }
    })();

    return () => {
      ativo = false;
      for (const c of campos) {
        try {
          c.unmount();
        } catch {
          /* já desmontado — ignora */
        }
      }
      mpRef.current = null;
      binRef.current = null;
    };
  }, [sdkPronto, idNumero, idValidade, idCvv, onIndisponivel, atualizarPorBin]);

  const camposSegurosOk = numeroValido && validadeValida && cvvValido;
  const podePagarCartao =
    camposSegurosOk &&
    cardholderName.trim().length > 0 &&
    numeroDoc.trim().length > 0 &&
    !!paymentMethodId &&
    (!precisaEmissor || issuerId.length > 0) &&
    !processando;

  // ── Trata a resposta do backend IGUAL o MercadoPagoBrick.
  const tratarResposta = useCallback(async (res: Response) => {
    const c = cbRef.current;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      c.onErro((body.erro as string) ?? c.t("Falha ao processar o pagamento."));
      return;
    }
    const status = body.status as string;
    const paymentId = String(body.paymentId ?? "");
    if (status === "approved") {
      c.onAprovado(paymentId);
    } else if (status === "pending" && body.qrCodeBase64) {
      c.onPix({
        paymentId,
        qrCode: (body.qrCode as string) ?? null,
        qrCodeBase64: (body.qrCodeBase64 as string) ?? null,
        ticketUrl: (body.ticketUrl as string) ?? null,
      });
    } else if (status === "in_process" || status === "pending") {
      c.onErro(c.t("Pagamento em análise. Tente outro cartão."));
    } else {
      c.onErro((body.statusDetail as string) ?? c.t("Pagamento recusado."));
    }
  }, []);

  // ── Submit do cartão: tokeniza no browser (SAQ-A) → POST no shape do Brick.
  const pagarCartao = useCallback(async () => {
    const mp = mpRef.current;
    const c = cbRef.current;
    if (!mp || !paymentMethodId) return;
    setProcessando(true);
    try {
      const { id: token } = await mp.fields.createCardToken({
        cardholderName: cardholderName.trim(),
        identificationType: tipoDoc,
        identificationNumber: numeroDoc.trim(),
      });
      const formData = {
        token,
        installments: Number(parcelaSel),
        payment_method_id: paymentMethodId,
        ...(precisaEmissor && issuerId ? { issuer_id: issuerId } : {}),
        payer: {
          email: emailPagador.trim(),
          identification: { type: tipoDoc, number: numeroDoc.trim() },
        },
      };
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: c.plano, ciclo: c.ciclo, formData }),
      });
      await tratarResposta(res);
    } catch (e) {
      c.onErro((e as Error).message ?? c.t("Falha ao processar o pagamento."));
    } finally {
      setProcessando(false);
    }
  }, [
    paymentMethodId,
    cardholderName,
    tipoDoc,
    numeroDoc,
    parcelaSel,
    precisaEmissor,
    issuerId,
    emailPagador,
    tratarResposta,
  ]);

  // ── PIX: sem token/parcelas — só payment_method_id + payer.email.
  const pagarPix = useCallback(async () => {
    const c = cbRef.current;
    setProcessando(true);
    try {
      const formData = {
        payment_method_id: "pix",
        payer: { email: emailPagador.trim() },
      };
      const res = await fetch("/api/checkout/mercadopago", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: c.plano, ciclo: c.ciclo, formData }),
      });
      await tratarResposta(res);
    } catch (e) {
      c.onErro((e as Error).message ?? c.t("Falha ao processar o pagamento."));
    } finally {
      setProcessando(false);
    }
  }, [emailPagador, tratarResposta]);

  if (!PUBLIC_KEY) return null;

  if (erroFatal) {
    return (
      <div
        className="flex items-center gap-2 text-xs rounded-md px-3 py-2"
        style={{
          backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
          color: "var(--danger)",
          border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
        }}
      >
        <AlertTriangle size={12} className="flex-shrink-0" />
        {erroFatal}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* SDK v2 do Mercado Pago (liberado no CSP: sdk.mercadopago.com). */}
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onReady={() => setSdkPronto(true)}
        onLoad={() => setSdkPronto(true)}
        onError={() => {
          setErroFatal(t("Não foi possível carregar o pagamento."));
          onIndisponivel();
        }}
      />

      {/* Toggle Cartão | PIX (dentro da seção do Mercado Pago). */}
      <div className="mb-4 inline-flex items-center gap-1 bg-surface border border-border rounded-full p-1 w-full">
        <button
          type="button"
          onClick={() => setMetodo("cartao")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full transition-colors ${
            metodo === "cartao"
              ? "bg-elevated text-primary"
              : "text-muted hover:text-secondary"
          }`}
        >
          <CreditCard size={13} />
          {t("Cartão")}
        </button>
        <button
          type="button"
          onClick={() => setMetodo("pix")}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full transition-colors ${
            metodo === "pix"
              ? "bg-elevated text-primary"
              : "text-muted hover:text-secondary"
          }`}
        >
          <QrCode size={13} />
          {t("PIX")}
        </button>
      </div>

      {/* CARTÃO — os containers dos iframes ficam SEMPRE no DOM (mp.fields
          precisa deles); quando PIX, só escondemos com `hidden` pra não
          desmontar e quebrar os secure fields. */}
      <div className={metodo === "cartao" ? "" : "hidden"}>
      {!montado && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" />
          {t("Carregando o pagamento seguro...")}
        </div>
      )}

      {/* Mantém os containers no DOM sempre (o mount do MP precisa deles); só
          escondemos até montar pra não mostrar caixas vazias. */}
      <div className={montado ? "flex flex-col gap-3" : "hidden"}>
        <CampoSeguro
          label={t("Número do cartão")}
          containerId={idNumero}
          focado={foco.numero}
          temErro={erroCampo.numero}
        />

        {paymentMethodId && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("Bandeira detectada: {bandeira}", { bandeira: paymentMethodId })}
          </p>
        )}

        <div className="flex gap-3">
          <CampoSeguro
            label={t("Validade")}
            containerId={idValidade}
            focado={foco.validade}
            temErro={erroCampo.validade}
            className="flex-1"
          />
          <CampoSeguro
            label={t("Código de segurança")}
            containerId={idCvv}
            focado={foco.cvv}
            temErro={erroCampo.cvv}
            className="flex-1"
          />
        </div>

        <div>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("Nome no cartão")}
          </label>
          <input
            type="text"
            className="campo-input"
            value={cardholderName}
            onChange={(e) => setCardholderName(e.target.value)}
            placeholder={t("Como está impresso no cartão")}
            autoComplete="cc-name"
          />
        </div>

        <div className="flex gap-3">
          <div style={{ width: 130 }}>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("Documento")}
            </label>
            <select
              className="campo-input"
              value={tipoDoc}
              onChange={(e) => setTipoDoc(e.target.value)}
            >
              {tiposDoc.map((td) => (
                <option key={td.id} value={td.id}>
                  {td.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("Número do documento")}
            </label>
            <input
              type="text"
              inputMode="numeric"
              className="campo-input"
              value={numeroDoc}
              onChange={(e) => setNumeroDoc(e.target.value)}
              placeholder="000.000.000-00"
            />
          </div>
        </div>

        {precisaEmissor && emissores.length > 0 && (
          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("Banco emissor")}
            </label>
            <select
              className="campo-input"
              value={issuerId}
              onChange={(e) => setIssuerId(e.target.value)}
            >
              {emissores.map((iss) => (
                <option key={String(iss.id)} value={String(iss.id)}>
                  {iss.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {mostrarParcelas && (
          <SelectParcelas
            parcelas={parcelas}
            valor={parcelaSel}
            onChange={setParcelaSel}
            label={t("Parcelas")}
          />
        )}

        <div>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("E-mail")}
          </label>
          <input
            type="email"
            className="campo-input"
            value={emailPagador}
            onChange={(e) => setEmailPagador(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
          />
        </div>

        <button
          type="button"
          onClick={pagarCartao}
          disabled={!podePagarCartao}
          className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-control w-full mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processando && <Loader2 size={14} className="animate-spin" />}
          {t("Pagar com cartão")}
        </button>
      </div>
      </div>

      {/* PIX — sem cartão/parcelas, só e-mail pro QR Code. */}
      {metodo === "pix" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("Pague na hora com PIX. Geramos um QR Code pra você escanear.")}
          </p>
          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("E-mail")}
            </label>
            <input
              type="email"
              className="campo-input"
              value={emailPagador}
              onChange={(e) => setEmailPagador(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
            />
          </div>
          <button
            type="button"
            onClick={pagarPix}
            disabled={processando || emailPagador.trim().length === 0}
            className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm rounded-control w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processando && <Loader2 size={14} className="animate-spin" />}
            <QrCode size={14} />
            {t("Gerar código PIX")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Select NOSSO de parcelas — mostra o recommended_message do MP (ex: "3x de R$…"). */
function SelectParcelas({
  parcelas,
  valor,
  onChange,
  label,
}: {
  parcelas: PayerCost[];
  valor: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div>
      <label
        className="block text-xs mb-1"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </label>
      <select
        className="campo-input"
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={parcelas.length === 0}
      >
        {parcelas.length === 0 ? (
          <option value={1}>1x</option>
        ) : (
          parcelas.map((p) => (
            <option key={p.installments} value={p.installments}>
              {p.recommended_message}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
