# AgroSat Brasil 🛰️🌱

Aplicativo web responsivo de monitoramento territorial agrícola, restrito
ao território brasileiro, com mapa satelital, dados climáticos/solo, IA
analítica e marketplace rural.

## Status atual desta versão

| Módulo | Status |
|---|---|
| Dashboard | ✅ **Funcional** — dados reais de clima (Open-Meteo) |
| Mapa Satelital | ✅ **Funcional** — Leaflet + tiles Esri/OSM, restrito ao Brasil |
| Histórico de Monitoramento | ✅ **Funcional** — dados reais (Open-Meteo Archive), 30 dias |
| Busca por coordenadas | ✅ **Funcional** |
| Busca por endereço | ✅ **Funcional** — geocodificação via Nominatim/OSM |
| Busca por CPF/CNPJ | 🟡 **Demo** — aceita formato válido, não há base real conectada |
| Alertas Climáticos | 🟡 **Demo** — heurística local sobre dados reais |
| Relatórios PDF/Excel | ✅ **Funcional** — geração local no navegador (jsPDF) |
| IA Analítica | 🟡 **Demo** — heurística local, pronta para plugar LLM real |
| Marketplace Rural | 🟡 **Demo** — CRUD local (localStorage), estrutura para Firestore pronta |
| Login Google / CPF-CNPJ | 🟡 **Demo** — simulado, estrutura Firebase Auth pronta |
| Firebase | ⚪ **Não conectado** — preencha `js/config.js` |
| Modo escuro | ✅ Funcional |
| PWA | ✅ Funcional (manifest + service worker) |

Tipo de solo, NDVI e umidade do solo são **estimativas modeladas** a
partir de dados climáticos públicos, já que não existe uma API
gratuita de sensoriamento remoto (NDVI real) com cobertura nacional.
Veja "Próximos passos" para integrar dados reais de satélite.

## Estrutura de pastas

```
/
├─ index.html
├─ manifest.json          → configuração PWA
├─ sw.js                  → service worker (cache offline básico)
├─ css/
│  └─ style.css
├─ js/
│  ├─ config.js           → chaves de API e flags de módulo
│  ├─ firebase.js         → camada de auth/dados (simulada até você conectar)
│  ├─ map.js               → mapa satelital (Leaflet)
│  ├─ ai.js                → IA analítica (heurística local)
│  └─ app.js               → orquestrador principal
├─ assets/                → ícones e imagens
├─ pages/                 → páginas extras (futuro)
└─ database/              → modelo de dados Firestore (documentação)
```

## Como rodar localmente

Como o app usa `fetch()` para APIs externas, abra-o através de um
servidor local (não funciona bem com duplo-clique em `file://`):

```bash
cd agrosat
python3 -m http.server 8080
# depois abra http://localhost:8080
```

## Como conectar o Firebase real

1. Crie um projeto em [console.firebase.google.com](https://console.firebase.google.com).
2. Ative **Authentication** (provedores Google e Email/Senha), **Firestore Database** e **Storage**.
3. Em **Configurações do projeto → Geral**, copie o objeto de configuração do app web.
4. Cole os valores em `js/config.js`, dentro de `AGROSAT_CONFIG.firebase`.
5. Mude `firebaseEnabled` para `true`.
6. Adicione os SDKs do Firebase no `index.html` (antes de `js/firebase.js`):
   ```html
   <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
   <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
   ```
7. Em `js/firebase.js`, descomente o "BLOCO REAL" e troque as funções
   simuladas pelas reais (mesma assinatura, então o resto do app não
   precisa mudar).

## APIs gratuitas já integradas (sem necessidade de chave)

- **Open-Meteo** — previsão do tempo e histórico climático.
- **Nominatim (OpenStreetMap)** — geocodificação de endereço.
- **Esri World Imagery** — tiles de satélite (uso não comercial).
- **OpenStreetMap** — tiles de mapa de ruas.

> Para um NDVI **real** (sensoriamento remoto de satélite, não estimado),
> a próxima integração recomendada é a **Sentinel Hub** (Copernicus/ESA)
> ou o **Google Earth Engine**, ambos com planos gratuitos para volume
> baixo. Isso exigiria um backend leve (Cloud Function) para não expor
> credenciais no frontend.

## Segurança e LGPD

- Dados de CPF/CNPJ devem ser tratados como dados pessoais sensíveis:
  ao conectar uma base real, armazene-os criptografados e nunca em
  texto puro no Firestore sem regras de acesso restritas (ver
  `database/README.md` para regras sugeridas).
- Inclua páginas de **Política de Privacidade** e **Termos de Uso**
  (pasta `pages/`) antes de qualquer coleta real de dados de usuários.
- Implemente consentimento explícito (opt-in) para uso de geolocalização
  e documentos pessoais.
- Defina um responsável pelo tratamento de dados (DPO) conforme a LGPD,
  e um canal de solicitação de exclusão/portabilidade de dados.

## Perfis de usuário

O app já modela 4 perfis (Proprietário, Agricultor, Empresa,
Administrador) na tela de login. A diferenciação de **permissões**
por perfil (ex: Administrador vê painel estatístico global) ainda
precisa ser implementada nas regras do Firestore e na UI condicional —
é o próximo passo natural após conectar o Firebase real.

## Próximos passos sugeridos

1. Conectar Firebase real (Auth + Firestore).
2. Validar CPF/CNPJ com dígito verificador real (algoritmo, não só formato).
3. Integrar fonte real de NDVI (Sentinel Hub / Google Earth Engine).
4. Implementar permissões por perfil (especialmente painel do Administrador).
5. Conectar chat do marketplace ao Firestore em tempo real (`onSnapshot`).
6. Adicionar push notifications reais via Firebase Cloud Messaging.
