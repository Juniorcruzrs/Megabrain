/**
 * AgroSat Brasil — js/firebase.js
 * --------------------------------------------------
 * Camada de integração com Firebase (Auth + Firestore + Storage).
 *
 * Quando AGROSAT_CONFIG.firebaseEnabled === false (padrão),
 * este módulo opera em MODO SIMULADO: guarda dados em localStorage
 * e responde com a mesma assinatura de função que o Firebase real teria,
 * para que o restante do app não precise mudar quando você conectar
 * suas credenciais reais.
 *
 * Para ativar o Firebase real:
 *  1. Crie um projeto em https://console.firebase.google.com
 *  2. Ative Authentication (Google + Email/Senha), Firestore Database e Storage.
 *  3. Preencha js/config.js com as chaves do seu projeto.
 *  4. Mude firebaseEnabled para true.
 *  5. Adicione os SDKs do Firebase no index.html antes deste script:
 *     <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"></script>
 *     <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js"></script>
 *     <script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js"></script>
 *  6. Descomente o bloco REAL abaixo.
 */

const AgroFirebase = (() => {

  const enabled = !!(window.AGROSAT_CONFIG && AGROSAT_CONFIG.firebaseEnabled);
  let currentUser = null;

  // ---------- MODO SIMULADO (padrão) ----------
  const LS_USER = "agrosat_demo_user";
  const LS_DB   = "agrosat_demo_db";

  function readDB(){
    try { return JSON.parse(localStorage.getItem(LS_DB)) || { produtos: [], perfis: {} }; }
    catch { return { produtos: [], perfis: {} }; }
  }
  function writeDB(db){ localStorage.setItem(LS_DB, JSON.stringify(db)); }

  function simulateLoginGoogle(perfil){
    const user = {
      uid: "demo-google-" + Math.random().toString(36).slice(2,8),
      nome: "Usuário Demo",
      email: "demo@agrosat.app",
      perfil: perfil || "proprietario",
      metodo: "google",
      criadoEm: new Date().toISOString()
    };
    localStorage.setItem(LS_USER, JSON.stringify(user));
    currentUser = user;
    return Promise.resolve(user);
  }

  function simulateLoginDoc(doc, perfil){
    const limpo = (doc || "").replace(/\D/g, "");
    if (limpo.length !== 11 && limpo.length !== 14){
      return Promise.reject(new Error("Documento inválido. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)."));
    }
    const user = {
      uid: "demo-doc-" + limpo.slice(0,6),
      documento: limpo,
      tipo: limpo.length === 11 ? "CPF" : "CNPJ",
      perfil: perfil || "proprietario",
      metodo: "documento",
      criadoEm: new Date().toISOString()
    };
    localStorage.setItem(LS_USER, JSON.stringify(user));
    currentUser = user;
    return Promise.resolve(user);
  }

  function logout(){
    localStorage.removeItem(LS_USER);
    currentUser = null;
    return Promise.resolve();
  }

  function getCurrentUser(){
    if (currentUser) return currentUser;
    try { currentUser = JSON.parse(localStorage.getItem(LS_USER)); } catch { currentUser = null; }
    return currentUser;
  }

  function salvarProduto(produto){
    const db = readDB();
    produto.id = "p" + Date.now();
    produto.criadoEm = new Date().toISOString();
    db.produtos.unshift(produto);
    writeDB(db);
    return Promise.resolve(produto);
  }

  function listarProdutos(){
    return Promise.resolve(readDB().produtos);
  }

  /* ---------- BLOCO REAL (Firebase de verdade) ----------
   * Descomente e adapte quando firebaseEnabled = true e os SDKs
   * estiverem incluídos no index.html.
   *
   * let app, auth, db;
   * if (enabled) {
   *   app = firebase.initializeApp(AGROSAT_CONFIG.firebase);
   *   auth = firebase.auth();
   *   db = firebase.firestore();
   * }
   *
   * function loginGoogleReal(){
   *   const provider = new firebase.auth.GoogleAuthProvider();
   *   return auth.signInWithPopup(provider).then(res => res.user);
   * }
   *
   * function salvarProdutoReal(produto){
   *   return db.collection("produtos").add(produto);
   * }
   *
   * function listarProdutosReal(){
   *   return db.collection("produtos").orderBy("criadoEm","desc").get()
   *     .then(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
   * }
   * -------------------------------------------------------- */

  return {
    enabled,
    loginGoogle: simulateLoginGoogle,
    loginDocumento: simulateLoginDoc,
    logout,
    getCurrentUser,
    salvarProduto,
    listarProdutos
  };
})();
