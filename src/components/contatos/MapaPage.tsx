"use client";

import PageHeader from "../PageHeader";
import MapaDobras from "./MapaDobras";
import { useT } from "@/lib/i18n";
import { MODULE_THEMES } from "@/types";

const ACCENT = MODULE_THEMES.contatos.color;

/**
 * Submenu dedicado "Mapa" — reusa o Mapa de Dobras (busca por raio) em tela
 * cheia. Puxa os dados do contexto (todos os contatos com coordenadas).
 */
export default function MapaPage() {
  const t = useT();
  return (
    <div className="max-w-[1400px] mx-auto w-full p-6 lg:p-8">
      <PageHeader
        title={t("Mapa")}
        subtitle={t("Contratantes, casas e cidades no mapa — busca por raio")}
        accentColor={ACCENT}
      />
      <MapaDobras />
    </div>
  );
}
