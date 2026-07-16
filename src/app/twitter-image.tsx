/**
 * Imagem do Twitter/X — reaproveita 1:1 a arte da Open Graph (mesmo 1200×630).
 *
 * `runtime`/`size`/`contentType` precisam ser LITERAIS neste arquivo (o Next
 * analisa estaticamente a config do segmento — reexport não é reconhecido e
 * cai no runtime default, que quebra no Windows). Só o componente é reusado.
 */
export { default } from "./opengraph-image";

export const runtime = "edge";
export const alt =
  "Gigs Control — Sistema de gestão para agências de artistas e DJs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
