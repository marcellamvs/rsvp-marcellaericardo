/* =========================================================
   CONFIGURAÇÃO
   Mesma URL do Apps Script usada pelo site de RSVP e pelo painel.
========================================================= */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxF9OdJoRlHPpLtm3Ky6PyTewMsd1WQrGCULH7Bl0QIVnYTQwJyUz0y2q6-yxIFo-P0/exec',
  TIMEOUT_MS: 15000,
  DEBOUNCE_BUSCA_MS: 300
};

const MENSAGENS_ERRO = {
  CONEXAO: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
  TEMPORARIO: 'O sistema está temporariamente indisponível. Tente novamente em alguns instantes.',
  CONVIDADO_OBRIGATORIO: 'Selecione seu nome na lista para continuar.'
};

/* Estado em memória (nunca em localStorage/sessionStorage) */
const estado = {
  presentes: [],       // [{ id, nome, categoria, descricao, imagem, valorSugerido, linkMercadoPago }]
  categorias: [],      // [{ id, nome }]
  categoriaAtiva: 'todos',
  presenteSelecionado: null,   // { id, nome }
  convidadoSelecionado: null,  // { codigo, nome, grupoFamiliar }
  timerBusca: null
};

const dom = {};

/* =========================================================
   INIT
========================================================= */
function init() {
  cachearElementos();

  dom.btnFecharModal.addEventListener('click', fecharModal);
  dom.modalOverlay.addEventListener('click', (evento) => {
    if (evento.target === dom.modalOverlay) fecharModal();
  });

  dom.inputBuscaConvidado.addEventListener('input', onDigitarBusca);
  dom.formPresentear.addEventListener('submit', onSubmitPresentear);

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !dom.modalOverlay.hidden) fecharModal();
  });

  carregarPresentes();
}

function cachearElementos() {
  dom.loading = document.getElementById('loading');
  dom.toastContainer = document.getElementById('toast-container');

  dom.filtroCategorias = document.getElementById('filtro-categorias');
  dom.gradePresentes = document.getElementById('grade-presentes');
  dom.mensagemVazia = document.getElementById('mensagem-vazia');
  dom.mensagemErroCarregamento = document.getElementById('mensagem-erro-carregamento');

  dom.modalOverlay = document.getElementById('modal-presentear');
  dom.btnFecharModal = document.getElementById('btn-fechar-modal');
  dom.modalNomePresente = document.getElementById('modal-nome-presente');

  dom.formPresentear = document.getElementById('form-presentear');
  dom.inputBuscaConvidado = document.getElementById('input-busca-convidado');
  dom.listaSugestoes = document.getElementById('lista-sugestoes');
  dom.erroConvidado = document.getElementById('erro-convidado');
  dom.inputMensagemPresente = document.getElementById('input-mensagem-presente');
  dom.btnContinuarPresente = document.getElementById('btn-continuar-presente');
}

/* =========================================================
   CARREGAR PRESENTES E CATEGORIAS
========================================================= */
async function carregarPresentes() {
  mostrarLoader();

  try {
    const resposta = await chamarBackend('listarPresentesPublico', {});

    if (!resposta.success) {
      dom.mensagemErroCarregamento.hidden = false;
      return;
    }

    estado.presentes = resposta.data.presentes || [];
    estado.categorias = resposta.data.categorias || [];

    renderizarChipsCategoria();
    renderizarPresentes();
  } catch (erro) {
    console.error('[Presentes] Falha ao carregar a lista:', erro);
    dom.mensagemErroCarregamento.hidden = false;
  } finally {
    esconderLoader();
  }
}

function renderizarChipsCategoria() {
  // O chip "Todos" já existe fixo no HTML — só adicionamos os demais.
  estado.categorias.forEach((categoria) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip-categoria';
    chip.dataset.categoria = categoria.nome;
    chip.textContent = categoria.nome;
    chip.addEventListener('click', () => selecionarCategoria(categoria.nome));
    dom.filtroCategorias.appendChild(chip);
  });

  dom.filtroCategorias.querySelector('[data-categoria="todos"]').addEventListener('click', () => selecionarCategoria('todos'));
}

function selecionarCategoria(categoria) {
  estado.categoriaAtiva = categoria;

  dom.filtroCategorias.querySelectorAll('.chip-categoria').forEach((chip) => {
    chip.classList.toggle('chip-ativa', chip.dataset.categoria === categoria);
  });

  renderizarPresentes();
}

/* =========================================================
   RENDERIZAR PRESENTES
========================================================= */
function renderizarPresentes() {
  const presentesFiltrados = estado.categoriaAtiva === 'todos'
    ? estado.presentes
    : estado.presentes.filter((presente) => presente.categoria === estado.categoriaAtiva);

  dom.gradePresentes.innerHTML = '';
  dom.mensagemVazia.hidden = presentesFiltrados.length > 0;

  const fragmento = document.createDocumentFragment();
  presentesFiltrados.forEach((presente) => fragmento.appendChild(criarCardPresente(presente)));
  dom.gradePresentes.appendChild(fragmento);
}

function criarCardPresente(presente) {
  const card = document.createElement('article');
  card.className = 'card-presente';

  const imagemWrapper = document.createElement('div');
  imagemWrapper.className = 'imagem-presente-wrapper';

  const imagem = document.createElement('img');
  imagem.className = 'imagem-presente';
  imagem.src = presente.imagem;
  imagem.alt = presente.nome;
  imagem.loading = 'lazy';
  imagem.onerror = () => { imagemWrapper.style.display = 'none'; };
  imagemWrapper.appendChild(imagem);

  const corpo = document.createElement('div');
  corpo.className = 'corpo-presente';

  const categoria = document.createElement('span');
  categoria.className = 'categoria-presente';
  categoria.textContent = presente.categoria;

  const nome = document.createElement('h2');
  nome.className = 'nome-presente';
  nome.textContent = presente.nome;

  const descricao = document.createElement('p');
  descricao.className = 'descricao-presente';
  descricao.textContent = presente.descricao;

  const valor = document.createElement('p');
  valor.className = 'valor-presente';
  valor.textContent = formatarMoeda(presente.valorSugerido);

  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'botao botao-primario botao-presentear';
  botao.textContent = 'Presentear';
  botao.addEventListener('click', () => abrirModal(presente));

  corpo.append(categoria, nome, descricao, valor, botao);
  card.append(imagemWrapper, corpo);

  return card;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* =========================================================
   MODAL "PRESENTEAR"
========================================================= */
function abrirModal(presente) {
  estado.presenteSelecionado = presente;
  estado.convidadoSelecionado = null;

  dom.modalNomePresente.textContent = presente.nome;
  dom.formPresentear.reset();
  dom.btnContinuarPresente.disabled = true;
  limparErro(dom.erroConvidado);
  esconderSugestoes();

  dom.modalOverlay.hidden = false;
  dom.modalOverlay.setAttribute('aria-hidden', 'false');
  dom.inputBuscaConvidado.focus();
}

function fecharModal() {
  dom.modalOverlay.hidden = true;
  dom.modalOverlay.setAttribute('aria-hidden', 'true');
}

/* =========================================================
   AUTOCOMPLETE DE CONVIDADOS
========================================================= */
function onDigitarBusca() {
  estado.convidadoSelecionado = null;
  dom.btnContinuarPresente.disabled = true;
  limparErro(dom.erroConvidado);

  clearTimeout(estado.timerBusca);
  const termo = dom.inputBuscaConvidado.value.trim();

  if (termo.length < 2) {
    esconderSugestoes();
    return;
  }

  estado.timerBusca = setTimeout(() => buscarConvidados(termo), CONFIG.DEBOUNCE_BUSCA_MS);
}

async function buscarConvidados(termo) {
  try {
    const resposta = await chamarBackend('buscarConvidadoPorNome', { termo });
    if (!resposta.success) return;

    renderizarSugestoes(resposta.data.resultados || []);
  } catch (erro) {
    console.error('[Presentes] Falha ao buscar convidado:', erro);
  }
}

function renderizarSugestoes(resultados) {
  dom.listaSugestoes.innerHTML = '';

  if (resultados.length === 0) {
    const item = document.createElement('li');
    item.className = 'sugestao-vazia';
    item.textContent = 'Nenhum convidado encontrado com esse nome.';
    dom.listaSugestoes.appendChild(item);
    dom.listaSugestoes.hidden = false;
    return;
  }

  const fragmento = document.createDocumentFragment();

  resultados.forEach((convidado) => {
    const item = document.createElement('li');
    item.className = 'sugestao-item';
    item.setAttribute('role', 'option');

    const nome = document.createElement('span');
    nome.className = 'sugestao-nome';
    nome.textContent = convidado.nome;

    const grupo = document.createElement('span');
    grupo.className = 'sugestao-grupo';
    grupo.textContent = convidado.grupoFamiliar;

    item.append(nome, grupo);
    item.addEventListener('click', () => selecionarConvidado(convidado));
    fragmento.appendChild(item);
  });

  dom.listaSugestoes.appendChild(fragmento);
  dom.listaSugestoes.hidden = false;
}

function selecionarConvidado(convidado) {
  estado.convidadoSelecionado = convidado;
  dom.inputBuscaConvidado.value = convidado.nome;
  dom.btnContinuarPresente.disabled = false;
  limparErro(dom.erroConvidado);
  esconderSugestoes();
}

function esconderSugestoes() {
  dom.listaSugestoes.hidden = true;
  dom.listaSugestoes.innerHTML = '';
}

/* =========================================================
   ENVIO — REGISTRAR CONTRIBUIÇÃO E REDIRECIONAR
========================================================= */
async function onSubmitPresentear(evento) {
  evento.preventDefault();
  limparErro(dom.erroConvidado);

  if (!estado.convidadoSelecionado) {
    mostrarErro(dom.erroConvidado, MENSAGENS_ERRO.CONVIDADO_OBRIGATORIO);
    return;
  }

  await executarComFeedback({
    botao: dom.btnContinuarPresente,
    textoCarregando: 'Enviando...',
    acao: async () => {
      const resposta = await chamarBackend('registrarContribuicao', {
        codigo: estado.convidadoSelecionado.codigo,
        nome: estado.convidadoSelecionado.nome,
        presenteId: estado.presenteSelecionado.id,
        mensagem: dom.inputMensagemPresente.value.trim()
      });

      if (!resposta.success) {
        mostrarErro(dom.erroConvidado, resposta.message || MENSAGENS_ERRO.TEMPORARIO);
        return;
      }

      const link = resposta.data && resposta.data.linkMercadoPago;

      if (link) {
        window.location.href = link;
      } else {
        mostrarToast('Obrigado! Sua intenção de presentear foi registrada.', 'sucesso');
        fecharModal();
      }
    },
    aoFalhar: (mensagem) => mostrarErro(dom.erroConvidado, mensagem)
  });
}

/* =========================================================
   COMUNICAÇÃO COM O APPS SCRIPT
========================================================= */
async function chamarBackend(action, payload) {
  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort(), CONFIG.TIMEOUT_MS);

  try {
    const resposta = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload }),
      signal: controlador.signal
    });

    if (!resposta.ok) {
      throw new Error('Falha na comunicação com o servidor.');
    }

    return await resposta.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function mensagemAmigavelParaErro(erro) {
  if (erro && erro.name === 'AbortError') return MENSAGENS_ERRO.TEMPORARIO;
  if (erro instanceof TypeError) return MENSAGENS_ERRO.CONEXAO;
  return MENSAGENS_ERRO.TEMPORARIO;
}

/* =========================================================
   FEEDBACK DE CARREGAMENTO (mesmo padrão do site de RSVP)
========================================================= */
async function executarComFeedback({ botao, textoCarregando, acao, aoFalhar }) {
  if (botao.disabled) return;

  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoCarregando;
  mostrarLoader();

  try {
    await acao();
  } catch (erro) {
    console.error('[Presentes] Falha na comunicação com o backend:', erro);
    aoFalhar(mensagemAmigavelParaErro(erro));
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
    esconderLoader();
  }
}

/* =========================================================
   UTILITÁRIOS DE UI
========================================================= */
function mostrarErro(elemento, texto) {
  elemento.textContent = texto;
}

function limparErro(elemento) {
  elemento.textContent = '';
}

function mostrarToast(texto, tipo) {
  const toast = document.createElement('div');
  toast.className = `toast ${tipo === 'erro' ? 'toast-erro' : 'toast-sucesso'}`;
  toast.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  toast.textContent = texto;
  dom.toastContainer.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

function mostrarLoader() {
  dom.loading.classList.add('visivel');
  dom.loading.setAttribute('aria-hidden', 'false');
}

function esconderLoader() {
  dom.loading.classList.remove('visivel');
  dom.loading.setAttribute('aria-hidden', 'true');
}

/* =========================================================
   START
========================================================= */
document.addEventListener('DOMContentLoaded', init);
