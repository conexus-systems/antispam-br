# Design — linguagem visual e identidade

Atualizado em 8 de outubro de 2026 (versão 0.1.2 do app Android). O AntiSpam BR usa a mesma linguagem
visual do Conexus Launcher (Windows 10 Mobile + MeeGo/N9), sem marca, fonte ou asset da Microsoft
ou da Nokia. Só a interface mudou: triagem de chamadas, permissões, dados, chaves de preferência e
fluxos de privacidade continuam os mesmos.

## Identidade

Gerada por `agents/.ai/skills/brand-identity/scripts/render_brand.py` a partir do bloco `brand:` de
`antispam-br` em `agents/apps/fleet.yml` (`style: flat`). Não edite os PNGs à mão; mude o `fleet.yml`
e rode de novo:

```bash
uv run ~/.cursor/skills/brand-identity/scripts/render_brand.py antispam-br --preview /tmp/brand-preview
uv run ~/.cursor/skills/brand-identity/scripts/render_brand.py antispam-br --android-res
```

| Peça | Arquivo |
| --- | --- |
| Ícone legado (48–192 px) | `apps/android/app/src/main/res/mipmap-*/ic_launcher.png` |
| Ícone adaptativo | `mipmap-anydpi-v26/ic_launcher.xml` — fundo `@color/ic_launcher_background`, glifo `mipmap-xxxhdpi/ic_launcher_foreground.png` |
| Camada monocromática (ícones temáticos do Android 13+ e tiles do Conexus) | o mesmo glifo branco do foreground |
| Splash do Android 12+ | ícone adaptativo sobre `#0B0F14` (`values-v31/themes.xml`) |
| Ícone da Play (512) | `apps/android/play/graphics/icon-512.png` |
| Feature graphic (1024×500, sem alpha) | `apps/android/play/graphics/feature-graphic.png` |

Marca: monograma **AS** em Inter Medium (SIL OFL) branco, ocupando ~52% da área visível do ícone,
centrado num quadrado de cor sólida — plano e geométrico como um tile Metro, sem gradiente, escudo ou
telefone. Segue a família Conexus (`agents/.ai/skills/brand-identity/FAMILY.md`) e é gerado só por
`render_brand.py antispam-br --android-res`; o ícone legado mantém cantos de 12%.

### Paleta

| Papel | Cor | Contraste |
| --- | --- | --- |
| Primária / destaque (tiles, pílulas, chips selecionados) | `#DC2626` | branco sobre ela 4,83:1 (AA) |
| Primária escura (tile secundário, avisos, fundo da feature graphic) | `#7F1D1D` | branco 10:1 |
| Destaque claro (erros, tagline) | `#FECACA` | sobre `#7F1D1D` 6,9:1 |
| Fundo do app e splash | `#0B0F14` com 90% sobre o papel de parede | — |
| Superfícies | branco 16% / 27% (como `Ui.SURFACE` do launcher) | — |

A cor de destaque passa por `Accent.forWhiteText` (mesma regra do launcher: escurece em passos de 5%
até o branco atingir 4,5:1). O vermelho da marca já passa, então não houve ajuste.

## Linguagem da interface (Compose)

Tokens e componentes ficam em `apps/android/app/src/main/kotlin/br/antispam/app/ui/theme/`:

- `Metro` / `MetroTheme`: cores, formas (tile 2 dp, cartão 6 dp, pílula 28 dp) e o `ColorScheme`
  escuro do Material 3 com a cor da marca como `primary`.
- `PivotHeader`: nome do app em versalete e seções em minúsculas finas (início, histórico, listas,
  ajustes); a atual em branco com barra de destaque 28×3 dp. As páginas deslizam (`HorizontalPager`).
- `Tile`, `ThinValue`: tiles planos com número fino (spam interrompido, proteção, base, último spam).
- `N9Card`, `Chip`, `ChipRow`: cartões do histórico no estilo Eventos do N9 com ações em chips.
- `Pill`: botões com alvo de toque de 48 dp e pílula visível de 40 dp.
- `AcrylicDialog`: superfície translúcida de 8 dp com contorno; desfoque atrás só no Android 12+ com
  desfoque entre janelas ligado, senão fundo mais opaco. Diálogos do sistema usam
  `@style/AntiSpamDialog` com a mesma superfície.

Acessibilidade: todo alvo tem no mínimo 48 dp; tiles e cartões são um único nó do TalkBack com
descrição completa; o toque longo no cartão do histórico abre os motivos e as mesmas ações ("Ver
motivos", "Não é spam", "Denunciar") ficam como ações personalizadas do TalkBack.

## O que não foi medido

Nenhuma afirmação de memória ou bateria. O APK release (R8) continua com 3,7 MB.
