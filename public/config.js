// Configuração do cliente. É o único arquivo que você edita ao publicar o site.
//
// server: endereço do servidor de jogo (o `server.py`).
//   ""                                  → o mesmo endereço de onde o site foi aberto (rede local: python3 server.py)
//   "cti-bombers.onrender.com"          → servidor hospedado (usa wss:// automaticamente se o site for https)
//   "wss://cti-bombers.fly.dev"         → endereço completo, também vale
//   "192.168.0.10:8000"                 → servidor na rede local, com a porta
//
// Para testar sem editar este arquivo, abra o site com ?server=ENDEREÇO na URL.
window.CTI_CONFIG = {
  server: "",
};
