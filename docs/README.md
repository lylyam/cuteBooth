# Documentación de CuteBooth

Esta carpeta es la **fuente de verdad** del proyecto. Todo lo que un humano o un
agente necesita saber para trabajar aquí está en `docs/` o en `CLAUDE.md`.

## Índice

| Documento                                                | Qué contiene                                                                                | Quién lo lee                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **[orchestration/KICKOFF.md](orchestration/KICKOFF.md)** | **Empieza aquí.** Briefing autosuficiente: estado, reglas, primer nodo, decisiones abiertas | Quien retoma el proyecto                     |
| [ARCHITECTURE.md](ARCHITECTURE.md)                       | Arquitectura **real** del repo: capas, convenciones, deuda, divergencias con el diseño      | Todos                                        |
| [orchestration/PLAN.md](orchestration/PLAN.md)           | Flota de agentes: roles, MCP, propiedad de ficheros, flujos                                 | Orquestador                                  |
| [orchestration/HANDOFF.md](orchestration/HANDOFF.md)     | Relevo: lo que el orquestador saliente sabía y no estaba escrito. **Caduca**                | orquestador                                  |
| [orchestration/LECCIONES.md](orchestration/LECCIONES.md) | Trampas que ya costaron tiempo. **Léelo antes de tocar código**                             | todos                                        |
| [orchestration/DAG.md](orchestration/DAG.md)             | Grafo de trabajo, camino crítico y estado de cada nodo                                      | Orquestador                                  |
| [orchestration/SETUP.md](orchestration/SETUP.md)         | Qué debe existir en el repo _antes_ de orquestar agentes                                    | Orquestador                                  |
| [design/FIGMA.md](design/FIGMA.md)                       | Mapa del fichero de Figma: fileKey, node IDs, hallazgos, reglas de uso                      | `figma-design-sync`                          |
| [reference/TRIAJE.md](reference/TRIAJE.md)               | Veredicto sobre `Analisis/`: qué se salva y qué se prohíbe                                  | Orquestador                                  |
| [contracts/layouts.md](contracts/layouts.md)             | Geometría de los 3 layouts (extraída de Figma)                                              | `booth-state`, `canvas-media`                |
| [contracts/state.md](contracts/state.md)                 | Forma del estado, las 11 acciones, guards de ruta, persistencia                             | `booth-state`, `ui-composer`, `canvas-media` |
| [contracts/design-tokens.md](contracts/design-tokens.md) | Las 21 custom properties, reglas de mapeo, deuda T1-T8                                      | `figma-design-sync`, `ui-composer`           |
| [contracts/assets.md](contracts/assets.md)               | El arte real del repo, manifiestos, por qué SVG y no PNG                                    | `canvas-media`, `ui-composer`                |
| `../specs/*.md`                                          | Alcance, copy literal, criterio de aceptación y **supuestos** de cada pantalla              | `ui-composer`, `booth-reviewer`              |

## Reglas de carga de contexto

Estas reglas existen por coste. `CLAUDE.md` se inyecta en **todos** los agentes,
así que todo lo que se meta ahí se paga tantas veces como agentes se lancen.

1. **`CLAUDE.md` < 200 líneas.** Es un índice y un conjunto de reglas, no un manual.
2. **Cada agente carga solo su contrato.** `canvas-media` no necesita la tabla de
   tokens; `figma-design-sync` no necesita el reducer.
3. **`Analisis/` está prohibido en contexto de agente.** Son 171 KB (~43k tokens) de
   notas de estudio sobre _otros_ proyectos, en parte desactualizadas. Ver
   [reference/TRIAJE.md](reference/TRIAJE.md).
4. **Los contratos y los specs se mantienen por debajo de ~120 líneas.** Un contrato
   que no cabe de un vistazo no se lee: se hojea, y un agente que hojea inventa.
   Los documentos de `orchestration/` sí pueden ser largos — los lee el orquestador,
   una vez por sesión, no cada agente en cada invocación.

## Convención de estado

Los documentos de `docs/orchestration/` tienen estado vivo (se editan durante el
proyecto). Los de `docs/contracts/` son contratos: cambiarlos es un cambio de API
interno y obliga a revisar a todos sus consumidores, listados en cada contrato.
