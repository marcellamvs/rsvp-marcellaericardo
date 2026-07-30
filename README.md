# RSVP — Jantar de Noivado de Marcella & Ricardo

Microsite de confirmação de presença + painel administrativo. Front-end estático (HTML/CSS/JS puro) hospedado no GitHub Pages, back-end em Google Apps Script, dados na Google Sheets.

```
/
├── index.html          (site público — convidados confirmam presença)
├── style.css           (design system compartilhado por site público e admin)
├── script.js           (lógica do site público)
├── admin.html          (painel administrativo)
├── admin.css           (estilos específicos do painel)
├── admin.js            (lógica do painel administrativo)
├── google/
│   └── Code.gs
├── assets/
│   ├── logo-patinhos.png       (adicione o seu arquivo aqui)
│   ├── favicon.png             (adicione o seu arquivo aqui)
│   └── compartilhamento.jpg    (adicione o seu arquivo aqui)
└── README.md
```

---

## 1. Criar a planilha no Google Sheets

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma planilha nova. Dê o nome que preferir (ex: "RSVP — Jantar de Noivado").
2. Renomeie a primeira aba para **`Convidados`** e preencha assim (linha 1 é o cabeçalho):

   | Código | Nome |
   |---|---|
   | MR4827 | Marcella Souza |
   | MR4827 | Ricardo Mainente |
   | MR0001 | João |

   Cada linha é **um convidado**. Convidados do mesmo convite repetem o mesmo código.

3. Crie uma segunda aba chamada **`Confirmações`** com o cabeçalho:

   | Código | Respostas | Restrição alimentar | Mensagem | Data/Hora |
   |---|---|---|---|---|

   Essa aba é preenchida automaticamente pelo sistema — não edite as linhas manualmente enquanto o site estiver no ar.

4. Não é necessário criar a aba **`Configurações`** manualmente — o Apps Script cria essa aba sozinho (com os valores padrão) na primeira vez que for necessário. É nela que ficam salvas as informações editadas em **Configurações do Evento**, no painel administrativo (veja a seção 6).

---

## 2. Publicar o Apps Script

1. Na planilha, vá em **Extensões → Apps Script**.
2. Apague o conteúdo do arquivo `Code.gs` que abrir e cole o conteúdo do arquivo `google/Code.gs` deste projeto.
3. Salve (ícone de disquete ou `Ctrl+S`).
4. Clique em **Implantar → Nova implantação**.
5. Em "Selecionar tipo", escolha **App da Web**.
6. Configure:
   - **Executar como:** Eu (sua conta)
   - **Quem pode acessar:** Qualquer pessoa
7. Clique em **Implantar** e autorize as permissões solicitadas (é a sua própria planilha, então é seguro aceitar).
8. Copie a **URL do app da Web** gerada — algo como:
   `https://script.google.com/macros/s/AKfycb.../exec`

> Sempre que você editar o `Code.gs`, use **Implantar → Gerenciar implantações → editar (ícone de lápis) → Nova versão → Implantar** para que as mudanças entrem no ar. Publicar uma "nova implantação" do zero gera uma URL diferente e quebra o link do site — nesse caso, atualize a URL em **`script.js` e em `admin.js`**.

---

## 3. Conectar o front-end ao back-end

A URL do Apps Script já está configurada tanto em `script.js` quanto em `admin.js`:

```js
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxF9OdJoRlHPpLtm3Ky6PyTewMsd1WQrGCULH7Bl0QIVnYTQwJyUz0y2q6-yxIFo-P0/exec',
  ...
};
```

Só troque esse valor (nos dois arquivos) se você publicar uma **nova implantação** do Apps Script.

---

## 4. Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (pode ser público ou privado, desde que o GitHub Pages esteja disponível no seu plano).
2. Envie todos os arquivos deste projeto para o repositório: `index.html`, `style.css`, `script.js`, `admin.html`, `admin.css`, `admin.js`, a pasta `assets/` com suas imagens, e a pasta `google/` (só para referência — não é usada pelo site publicado).
3. No repositório, vá em **Settings → Pages**.
4. Em "Source", selecione a branch principal (`main`) e a pasta `/root`.
5. Salve. Em alguns minutos o GitHub mostrará a URL pública do site, algo como:
   `https://seu-usuario.github.io/nome-do-repositorio/`
6. O site público fica em `.../index.html` e o painel administrativo em `.../admin.html`.

> O painel fica acessível para qualquer pessoa que souber a URL — a proteção é a senha de login, verificada no Apps Script. Se quiser uma camada extra, publique em um repositório **privado** (GitHub Pages funciona em repositórios privados nos planos pagos do GitHub).

---

## 5. Adicionar as imagens

Coloque os três arquivos abaixo dentro da pasta `assets/` (os nomes precisam ser exatamente esses, ou troque os caminhos correspondentes em `index.html`):

| Arquivo | Onde é usado |
|---|---|
| `assets/logo-patinhos.png` | Logo no topo do site público |
| `assets/favicon.png` | Ícone da aba do navegador (site público e admin) |
| `assets/compartilhamento.jpg` | Imagem exibida ao compartilhar o link (Open Graph / Twitter Card) — recomendado 1200×630px |

Enquanto esses arquivos não existirem, o site funciona normalmente — o navegador simplesmente não mostra o ícone/imagem correspondente.

---

## 6. Painel administrativo

Acesse `admin.html` publicado (ex: `https://seu-usuario.github.io/nome-do-repositorio/admin.html`).

**Credenciais padrão:**
- Usuário: `admin`
- Senha: `MR2026@`

A senha **nunca fica no front-end** — o `admin.js` envia usuário e senha para o Apps Script a cada ação, e o `Code.gs` confere contra um hash SHA-256 guardado no backend. A sessão do painel também não é salva no navegador (nem `localStorage`, nem `sessionStorage`): ao recarregar a página, é preciso fazer login novamente.

### Como trocar a senha do admin

1. Escolha a nova senha.
2. Gere o hash SHA-256 dela (qualquer gerador confiável de hash SHA-256 online, ou via terminal: `echo -n "SuaNovaSenha" | shasum -a 256`).
3. Em `google/Code.gs`, troque o valor de `ADMIN_SENHA_HASH` pelo hash gerado.
4. Reimplante o Apps Script (**Implantar → Gerenciar implantações → Nova versão**).

### O que o painel mostra

O painel tem duas abas:

**Dashboard:**
- **Métricas:** total de convidados, confirmados, ausentes, pendentes, taxa de confirmação e quantidade de convites com restrição alimentar.
- **Tabela:** cruza automaticamente as abas `Convidados` e `Confirmações`, mostrando código, nome, status, restrição alimentar, mensagem e última atualização de cada convidado.
- **Pesquisa** por nome ou código, **filtros** por status e **ordenação** por nome/código/status/data.
- **Exportar CSV** (respeita os filtros e a ordenação atuais), **copiar pendentes** (nomes) e **copiar códigos pendentes** (útil para reenviar lembretes só a quem falta responder).
- **Atualizar dados** busca a planilha novamente sem perder os filtros que você já tinha selecionado.

**Configurações do Evento:**
- Edite nome do evento, data, horário, link do endereço, data limite para confirmação e link do site dos noivos — sem mexer em código.
- O switch "Exibir botão..." controla se o botão "Acessar o site dos noivos" aparece no site público.
- Ao clicar em **Salvar configurações**, os dados são gravados na aba `Configurações` da planilha (criada automaticamente na primeira vez que o sistema precisar dela) e o site público passa a usá-los na próxima vez que alguém abrir a página.

---

## 7. Como alterar convidados

Tudo é feito direto na aba **Convidados** da planilha — não é necessário mexer em código:

- **Adicionar convidado:** insira uma nova linha com o código do convite e o nome.
- **Remover convidado:** apague a linha correspondente.
- **Trocar o código de um convite:** edite a coluna "Código" de todas as linhas daquele convite (lembre de manter o mesmo código em todas as linhas do mesmo grupo).

As mudanças valem imediatamente, sem precisar reimplantar o Apps Script.

---

## 8. Como alterar textos

Os textos ficam direto no `index.html`:

- **Frase de abertura, texto do convite, mensagens finais:** procure o texto correspondente dentro das seções `TELA 01` a `TELA 04` e edite diretamente.
- **Mensagens da tela final (presença confirmada / ausência):** ficam em `script.js`, na função `gerarMensagemFinal()`.
- **Placeholder do campo de código:** atributo `placeholder` do `<input id="input-codigo">`.

---

## 9. Como alterar a data, horário, prazo e o link do site dos noivos

Essas informações **não ficam mais fixas no `index.html`** — são editadas em **Configurações do Evento**, dentro do painel administrativo (veja a seção 6):

- Nome do evento, data, horário
- Link "Ver endereço e orientações"
- Data limite para confirmação
- Link do site dos noivos + se o botão "Acessar o site dos noivos" aparece ou não no site

Ao salvar, o site público carrega esses valores automaticamente na próxima vez que alguém abrir a página — não é necessário editar código nem reimplantar nada. Se a comunicação com o Apps Script falhar por algum motivo, o site mostra os valores padrão como reserva, para nunca ficar com informação em branco.

---

## 10. Como alterar as cores

Todas as cores são **variáveis CSS** no topo do arquivo `style.css`, dentro de `:root` — usadas tanto pelo site público quanto pelo painel administrativo:

```css
:root {
  --color-creme: #FFF5EC;
  --color-vinho: #610018;
  --color-azul: #B9C9E3;
  ...
}
```

Troque os valores hexadecimais e todo o projeto se atualiza — não é necessário mexer em `admin.css` nem em nenhum outro lugar.

---

## Observação sobre as fontes

O briefing pedia **Cinzel** e **General Sans**. **General Sans** não está disponível no Google Fonts (é uma fonte da Fontshare). Para manter o projeto 100% funcional sem dependências extras, foi usada uma alternativa do Google Fonts com a mesma personalidade sóbria e geométrica:

- **Cinzel** — mantida como pedido (títulos).
- **Jost** — no lugar de General Sans (texto corrido).

A fonte decorativa cursiva (usada antes na frase de abertura e na assinatura) foi removida do projeto, como solicitado — esses textos agora usam Cinzel/Jost com itálico e espaçamento, mantendo a elegância sem depender de uma fonte cursiva externa.

Se você tiver os arquivos `.woff2` de General Sans, é possível trocá-la via `@font-face` no topo do `style.css` — me avise se quiser ajuda com isso depois.

---

## Testando localmente antes de publicar

Você pode abrir o `index.html` ou o `admin.html` direto no navegador para conferir o visual, mas a comunicação com o Apps Script **só funciona depois que o site estiver publicado** — navegadores bloqueiam `fetch()` para origens `file://`. Para testar o fluxo completo:

- Sirva a pasta com um servidor local (`python3 -m http.server 8000`, ou a extensão "Live Server" do VS Code), ou
- Publique direto no GitHub Pages, mesmo em um repositório privado ou de testes.

---

## Resiliência e tratamento de erros

Todas as chamadas ao Apps Script (site público e admin) têm:

- **Timeout de 15 segundos** — se o servidor não responder, a operação é cancelada e o usuário recebe uma mensagem amigável.
- **Retry automático (até 2 tentativas, ~1s de intervalo)** apenas para leituras (buscar convidados, carregar o painel) — nunca para o envio da confirmação, para não haver risco de duplicidade.
- **Mensagens sempre amigáveis** — nenhum erro técnico chega até o convidado ou ao admin; detalhes ficam só no console do navegador (F12), para depuração.
- Loading e botões **sempre são restaurados** ao final de qualquer chamada, mesmo em caso de falha — nunca travam a interface.

---

## Suporte rápido a problemas comuns

- **"Código não encontrado" mesmo com o código certo:** confira se não há espaços extras na coluna "Código" da planilha, e se o nome da aba é exatamente `Convidados`.
- **Nada acontece ao clicar em "Confirmar presença":** abra o Console do navegador (F12) e veja se há erro de CORS ou de URL — confirme que `API_URL` em `script.js` está correta e termina em `/exec`.
- **Confirmação duplicada na planilha:** não deve acontecer — o sistema sempre procura uma confirmação existente pelo código antes de gravar, e um lock no Apps Script impede duplicidade mesmo em cliques simultâneos. Se notar duplicidade, verifique se o nome da aba `Confirmações` está exatamente assim, com o acento.
- **"Usuário ou senha inválidos" no admin mesmo com a senha certa:** confirme que não há espaço extra digitado, e que o `ADMIN_SENHA_HASH` em `Code.gs` corresponde de fato à senha que você está usando (veja a seção 6 para gerar o hash corretamente).
