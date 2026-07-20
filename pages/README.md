# Pasta `pages/`

Reservada para páginas adicionais conforme o app crescer além de uma
single-page application, por exemplo:

- `pages/perfil.html` — página de edição de perfil do usuário
- `pages/produto.html` — página de detalhe de um produto/serviço do marketplace
- `pages/admin.html` — painel exclusivo do perfil Administrador
- `pages/politica-privacidade.html` — política de privacidade (LGPD)
- `pages/termos.html` — termos de uso

Hoje toda a navegação principal (Dashboard, Mapa, Alertas, Histórico,
Relatórios, IA, Marketplace) acontece dentro de `index.html` como uma
SPA (Single Page Application), trocando a `<section class="view">`
visível via `js/app.js`. Use esta pasta quando precisar de páginas
verdadeiramente separadas (ex: para SEO de páginas públicas, ou rotas
que não fazem sentido como aba do painel).
