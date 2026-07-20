# Pasta `database/`

Esta pasta documenta o **modelo de dados** usado no Firebase Firestore
quando a integração real for ativada (ver `js/config.js` e `js/firebase.js`).

Enquanto `firebaseEnabled = false`, o app simula este mesmo modelo usando
`localStorage` no navegador — então a estrutura abaixo já reflete o que
é salvo hoje em modo demo.

## Coleções

### `usuarios`
```json
{
  "uid": "string",
  "nome": "string",
  "email": "string",
  "documento": "string (CPF ou CNPJ, opcional)",
  "perfil": "proprietario | agricultor | empresa | admin",
  "metodo": "google | documento",
  "criadoEm": "timestamp"
}
```

### `areas_monitoradas`
```json
{
  "id": "string",
  "uid_usuario": "string",
  "label": "string",
  "lat": "number",
  "lng": "number",
  "criadoEm": "timestamp"
}
```

### `produtos` (Marketplace Rural)
```json
{
  "id": "string",
  "uid_vendedor": "string",
  "nome": "string",
  "categoria": "Insumos | Maquinário | Serviços técnicos | Transporte | Sementes e mudas",
  "preco": "number",
  "local": "string",
  "desc": "string",
  "rating": "number",
  "criadoEm": "timestamp"
}
```

### `avaliacoes`
```json
{
  "id": "string",
  "produto_id": "string",
  "uid_avaliador": "string",
  "nota": "number (1-5)",
  "comentario": "string",
  "criadoEm": "timestamp"
}
```

### `mensagens_chat`
```json
{
  "id": "string",
  "conversa_id": "string",
  "uid_remetente": "string",
  "texto": "string",
  "enviadoEm": "timestamp"
}
```

## Regras de segurança (Firestore) — sugestão inicial

Ao ativar o Firebase real, configure regras como:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /produtos/{id} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /usuarios/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Ajuste conforme os perfis (proprietário, agricultor, empresa, administrador)
e os requisitos de LGPD do projeto (ver seção de segurança no README principal).
