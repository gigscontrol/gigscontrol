/**
 * Injeta um bloco JSON-LD (schema.org) no HTML. Componente server — o objeto
 * vira <script type="application/ld+json"> via dangerouslySetInnerHTML.
 * Texto PT fixo (não passa por t()): dados estruturados são para máquinas.
 */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
