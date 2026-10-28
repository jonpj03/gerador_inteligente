# Smart Dash Studio

Gerador de dashboards 100% front-end (HTML, CSS e JavaScript). Cole uma tabela ou anexe XLSX/XLS/CSV/TXT/JSON, clique em **Gerar dashboards** e personalize, filtre e exporte.

## Publicar no GitHub Pages
1. Crie um repositório e envie todos os arquivos desta pasta para a raiz (`index.html` na raiz).
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.
3. Acesse `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Também funciona abrindo `index.html` localmente. Chart.js, SheetJS, html2canvas e jsPDF são carregados por CDN (jsDelivr), então é preciso conexão.

## Arquivos
- `index.html`, `style.css` — interface
- `app.js` — estado, fluxos, painel, filtros, chat
- `data-parser.js` — leitura de arquivos/texto e detecção de tipos
- `dashboard-engine.js` — perfil dos dados, dashboards e cálculos
- `insights-engine.js` — qualidade dos dados, recomendações e correções
- `render.js` — cards e gráficos · `export-utils.js` — PNG, cópia, PDF, CSV
- `commands.js` — comandos em linguagem natural

## Observações
- A interpretação é **local, por regras**; não há IA generativa integrada. Para integrar um modelo de linguagem, crie um backend seguro (função serverless) que receba o perfil dos dados e devolva comandos para `SDCommands`/`SDEngine`. **Nunca** coloque chaves de API neste código publicado.
- Dados não saem do navegador. Preferências visuais ficam no `localStorage`.
- "Copiar gráfico" depende de HTTPS e suporte do navegador à área de transferência; sem isso, o PNG é baixado.
