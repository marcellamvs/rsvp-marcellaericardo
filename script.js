/* =========================================================
   CONFIGURAÇÃO
   Troque API_URL pela URL do seu Apps Script publicado
   (veja o README para o passo a passo de implantação).
========================================================= */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxF9OdJoRlHPpLtm3Ky6PyTewMsd1WQrGCULH7Bl0QIVnYTQwJyUz0y2q6-yxIFo-P0/exec',
  TIMEOUT_MS: 15000,
  MAX_TENTATIVAS_LEITURA: 3,   // 1 chamada original + até 2 retries
  INTERVALO_RETRY_MS: 1000
};

/* Mensagens de erro amigáveis — nunca mostramos erro técnico ao usuário */
const MENSAGENS_ERRO = {
  CONEXAO: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
  TEMPORARIO: 'O sistema está temporariamente indisponível. Tente novamente em alguns instantes.',
  SALVAR: 'Não foi possível registrar sua confirmação. Nenhum dado foi salvo. Tente novamente.',
  CODIGO_INVALIDO: 'Não encontramos esse código de convite. Confira o código informado e tente novamente.'
};

/* Estado da aplicação (em memória, nunca em localStorage/sessionStorage) */
const estado = {
  codigo: '',
  convidados: [],       // [{ nome, comparecera: true|false|null }]
  temRestricao: false,
  restricao: '',
  mensagem: '',
  editando: false,          // true quando já existe confirmação registrada para o código
  dadosPreenchidos: null    // { respostas, temRestricao, restricao, mensagem } vindos do backend
};

/* Cache de elementos usados com frequência, para evitar consultas
   repetidas ao DOM durante a navegação entre telas. */
const dom = {};

/* =========================================================
   INIT
========================================================= */
function init() {
  cachearElementos();

  dom.formCodigo.addEventListener('submit', onSubmitCodigo);
  dom.formConvidados.addEventListener('submit', onSubmitConvidados);
  dom.formDetalhes.addEventListener('submit', onSubmitDetalhes);
  dom.inputCodigo.addEventListener('input', formatarCodigoInput);
  dom.btnVoltarInicio.addEventListener('click', voltarAoInicio);

  document.querySelectorAll('[data-voltar]').forEach((botao) => {
    botao.addEventListener('click', () => trocarTela(Number(botao.dataset.voltar)));
  });

  document.querySelectorAll('input[name="temRestricao"]').forEach((radio) => {
    radio.addEventListener('change', mostrarRestricoes);
  });

  atualizarProgresso(1);

  // Foco automático no campo de código ao abrir a página.
  dom.inputCodigo.focus();

  carregarConfiguracoes();
}

function cachearElementos() {
  dom.loading = document.getElementById('loading');
  dom.toastContainer = document.getElementById('toast-container');

  dom.nomeEvento = document.getElementById('nome-evento');
  dom.dataEvento = document.getElementById('data-evento');
  dom.horarioEvento = document.getElementById('horario-evento');
  dom.linkEndereco = document.getElementById('link-endereco');
  dom.textoPrazo = document.getElementById('texto-prazo');
  dom.btnSiteNoivos = document.getElementById('btn-site-noivos');

  dom.formCodigo = document.getElementById('form-codigo');
  dom.inputCodigo = document.getElementById('input-codigo');
  dom.erroCodigo = document.getElementById('erro-codigo');
  dom.btnConfirmarCodigo = document.getElementById('btn-confirmar-codigo');

  dom.formConvidados = document.getElementById('form-convidados');
  dom.avisoEdicao = document.getElementById('aviso-edicao');
  dom.listaConvidados = document.getElementById('lista-convidados');
  dom.erroConvidados = document.getElementById('erro-convidados');

  dom.formDetalhes = document.getElementById('form-detalhes');
  dom.blocoRestricao = document.getElementById('bloco-restricao');
  dom.blocoRestricaoTexto = document.getElementById('bloco-restricao-texto');
  dom.inputRestricao = document.getElementById('input-restricao');
  dom.inputMensagem = document.getElementById('input-mensagem');
  dom.btnEnviar = document.getElementById('btn-enviar');

  dom.tituloFinal = document.getElementById('titulo-final');
  dom.textoFinal = document.getElementById('texto-final');
  dom.btnVoltarInicio = document.getElementById('btn-voltar-inicio');

  dom.telas = document.querySelectorAll('.tela');
  dom.passosProgresso = document.querySelectorAll('.progress-step');
}

/* =========================================================
   CONFIGURAÇÕES INSTITUCIONAIS
   Carregadas do painel administrativo — nada fica fixo no HTML.
   Se a chamada falhar, os textos padrão já presentes no HTML
   permanecem visíveis (degradação suave).
========================================================= */
async function carregarConfiguracoes() {
  try {
    const resposta = await chamarBackend('obterConfiguracoes', {}, { permiteRetry: true });

    if (!resposta.success) return;

    aplicarConfiguracoes(resposta.data);
  } catch (erro) {
    console.error('[RSVP] Falha ao carregar configurações institucionais:', erro);
  }
}

function aplicarConfiguracoes(config) {
  if (config.nome_evento) dom.nomeEvento.textContent = config.nome_evento;
  if (config.data_evento) dom.dataEvento.textContent = config.data_evento;
  if (config.horario_evento) dom.horarioEvento.textContent = config.horario_evento;
  if (config.link_maps) dom.linkEndereco.href = config.link_maps;

  if (config.data_limite) {
    dom.textoPrazo.textContent = `Confirme sua presença até ${formatarDataLimite(config.data_limite)}`;
  }

  const exibirSiteNoivos = config.exibir_site_noivos === true || config.exibir_site_noivos === 'true';
  if (exibirSiteNoivos && config.site_noivos) {
    dom.btnSiteNoivos.href = config.site_noivos;
    dom.btnSiteNoivos.hidden = false;
  } else {
    dom.btnSiteNoivos.hidden = true;
  }
}

/**
 * Formata uma data no padrão "YYYY-MM-DD" (vinda do campo de data do
 * painel administrativo) para "DD/MM/AAAA", sem depender de fuso
 * horário (evita o erro clássico de "um dia a menos").
 * @param {string} dataIso
 * @return {string}
 */
function formatarDataLimite(dataIso) {
  const partes = String(dataIso).split('-');
  if (partes.length !== 3) return dataIso;

  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

/* =========================================================
   TELA 1 — CÓDIGO
========================================================= */
function formatarCodigoInput(evento) {
  const valorLimpo = evento.target.value
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
  evento.target.value = valorLimpo;
}

async function onSubmitCodigo(evento) {
  evento.preventDefault();
  const codigo = dom.inputCodigo.value.trim();

  limparErro(dom.erroCodigo);

  if (!codigo) {
    mostrarErro(dom.erroCodigo, 'Digite o código do seu convite.');
    return;
  }

  await executarComFeedback({
    botao: dom.btnConfirmarCodigo,
    textoCarregando: 'Validando...',
    acao: async () => {
      const resposta = await buscarConvidados(codigo);

      if (!resposta.success) {
        mostrarErro(dom.erroCodigo, resposta.message || MENSAGENS_ERRO.CODIGO_INVALIDO);
        return;
      }

      estado.codigo = codigo;
      estado.convidados = resposta.data.convidados.map((nome) => ({
        nome,
        comparecera: null
      }));
      estado.editando = Boolean(resposta.data.confirmacaoExistente);
      estado.dadosPreenchidos = resposta.data.dadosConfirmacao || null;

      renderizarConvidados();
      dom.avisoEdicao.hidden = !estado.editando;

      if (estado.dadosPreenchidos) {
        preencherDadosExistentes(estado.dadosPreenchidos);
      }

      trocarTela(2);
    },
    aoFalhar: (mensagem) => mostrarErro(dom.erroCodigo, mensagem)
  });
}

/* =========================================================
   TELA 2 — CONVIDADOS
========================================================= */
function renderizarConvidados() {
  dom.listaConvidados.innerHTML = '';

  const fragmento = document.createDocumentFragment();

  estado.convidados.forEach((convidado, indice) => {
    const card = document.createElement('div');
    card.className = 'card-convidado';

    const nome = document.createElement('p');
    nome.className = 'nome-convidado';
    nome.textContent = convidado.nome;

    const respostaAnterior = obterRespostaAnterior(convidado.nome);
    if (respostaAnterior) {
      convidado.comparecera = respostaAnterior.compareceu;
    }

    const opcoes = document.createElement('div');
    opcoes.className = 'opcoes-radio';
    opcoes.setAttribute('role', 'radiogroup');
    opcoes.setAttribute('aria-label', `Presença de ${convidado.nome}`);
    opcoes.innerHTML = `
      <label class="radio-item">
        <input type="radio" name="convidado-${indice}" value="sim" ${respostaAnterior && respostaAnterior.compareceu ? 'checked' : ''}>
        <span class="radio-visual"></span>
        <span>Comparecerei</span>
      </label>
      <label class="radio-item">
        <input type="radio" name="convidado-${indice}" value="nao" ${respostaAnterior && respostaAnterior.compareceu === false ? 'checked' : ''}>
        <span class="radio-visual"></span>
        <span>Não poderei comparecer</span>
      </label>
    `;

    card.appendChild(nome);
    card.appendChild(opcoes);
    fragmento.appendChild(card);
  });

  dom.listaConvidados.appendChild(fragmento);
}

/**
 * Procura, nos dados de uma confirmação existente, a resposta anterior
 * de um convidado específico pelo nome.
 * @param {string} nome
 * @return {{nome: string, compareceu: boolean}|null}
 */
function obterRespostaAnterior(nome) {
  if (!estado.dadosPreenchidos) return null;
  const respostas = estado.dadosPreenchidos.respostas || [];
  return respostas.find((r) => normalizarTexto(r.nome) === normalizarTexto(nome)) || null;
}

function normalizarTexto(texto) {
  return String(texto || '').trim().toLowerCase();
}

/**
 * Pré-preenche os campos de restrição alimentar e mensagem (tela 3)
 * com os dados de uma confirmação já existente.
 * @param {{temRestricao: boolean, restricao: string, mensagem: string}} dados
 */
function preencherDadosExistentes(dados) {
  dom.inputMensagem.value = dados.mensagem || '';

  const radioSim = document.querySelector('input[name="temRestricao"][value="sim"]');
  const radioNao = document.querySelector('input[name="temRestricao"][value="nao"]');

  if (dados.temRestricao) {
    radioSim.checked = true;
    dom.inputRestricao.value = dados.restricao || '';
    dom.blocoRestricaoTexto.hidden = false;
  } else {
    radioNao.checked = true;
    dom.inputRestricao.value = '';
    dom.blocoRestricaoTexto.hidden = true;
  }
}

function onSubmitConvidados(evento) {
  evento.preventDefault();
  limparErro(dom.erroConvidados);

  if (!validarFormularioConvidados()) {
    mostrarErro(dom.erroConvidados, 'Responda a presença de todos os convidados para continuar.');
    return;
  }

  const algumConfirmado = estado.convidados.some((c) => c.comparecera === true);
  dom.blocoRestricao.hidden = !algumConfirmado;
  trocarTela(3);
}

function validarFormularioConvidados() {
  let todosResponderam = true;

  estado.convidados.forEach((convidado, indice) => {
    const selecionado = document.querySelector(`input[name="convidado-${indice}"]:checked`);
    if (!selecionado) {
      todosResponderam = false;
      return;
    }
    convidado.comparecera = selecionado.value === 'sim';
  });

  return todosResponderam;
}

/* =========================================================
   TELA 3 — RESTRIÇÃO E MENSAGEM
========================================================= */
function mostrarRestricoes() {
  const sim = document.querySelector('input[name="temRestricao"]:checked').value === 'sim';
  dom.blocoRestricaoTexto.hidden = !sim;
}

function onSubmitDetalhes(evento) {
  evento.preventDefault();

  const blocoRestricaoVisivel = !dom.blocoRestricao.hidden;
  if (blocoRestricaoVisivel) {
    const temRestricao = document.querySelector('input[name="temRestricao"]:checked').value === 'sim';
    estado.temRestricao = temRestricao;
    estado.restricao = temRestricao ? dom.inputRestricao.value.trim() : '';
  } else {
    estado.temRestricao = false;
    estado.restricao = '';
  }

  estado.mensagem = dom.inputMensagem.value.trim();

  enviarConfirmacao();
}

/* =========================================================
   TELA 4 — AGRADECIMENTO / AUSÊNCIA
========================================================= */
async function enviarConfirmacao() {
  await executarComFeedback({
    botao: dom.btnEnviar,
    textoCarregando: 'Enviando...',
    acao: async () => {
      const resposta = await salvarConfirmacao();

      if (!resposta.success) {
        mostrarToast(resposta.message || MENSAGENS_ERRO.SALVAR, 'erro');
        return;
      }

      const mensagemFinal = gerarMensagemFinal();
      dom.tituloFinal.textContent = mensagemFinal.titulo;
      dom.textoFinal.textContent = mensagemFinal.texto;

      trocarTela(4);
    },
    aoFalhar: (mensagem) => mostrarToast(mensagem, 'erro'),
    mensagemFalhaPadrao: MENSAGENS_ERRO.SALVAR
  });
}

function gerarMensagemFinal() {
  const algumConfirmado = estado.convidados.some((c) => c.comparecera === true);

  if (algumConfirmado) {
    return {
      titulo: 'Presença confirmada!',
      texto: 'Marcella e Ricardo agradecem sua confirmação. Estamos muito felizes por compartilhar esse momento com você. Nos vemos em breve!'
    };
  }

  return {
    titulo: 'Sentiremos sua falta.',
    texto: 'Obrigado por nos avisar. Esperamos encontrá-lo em uma próxima oportunidade.'
  };
}

function voltarAoInicio() {
  estado.codigo = '';
  estado.convidados = [];
  estado.temRestricao = false;
  estado.restricao = '';
  estado.mensagem = '';
  estado.editando = false;
  estado.dadosPreenchidos = null;

  dom.formCodigo.reset();
  dom.formConvidados.reset();
  dom.formDetalhes.reset();
  dom.listaConvidados.innerHTML = '';
  dom.avisoEdicao.hidden = true;
  dom.blocoRestricao.hidden = true;
  dom.blocoRestricaoTexto.hidden = true;
  limparErro(dom.erroCodigo);
  limparErro(dom.erroConvidados);

  trocarTela(1);
  dom.inputCodigo.focus();
}

/* =========================================================
   COMUNICAÇÃO COM O APPS SCRIPT
   Uma única função de transporte (POST + text/plain) evita
   o preflight de CORS em requisições simples.
========================================================= */
async function executarRequisicao(action, payload) {
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

/**
 * Camada de transporte com retry automático.
 * Só reenvia a requisição para falhas de rede/timeout (erros transitórios) —
 * nunca em cima de uma resposta já recebida do servidor, e nunca para
 * ações de escrita (evita duplicar dados). Ver `salvarConfirmacao`.
 */
async function chamarBackend(action, payload, { permiteRetry = false } = {}) {
  const maxTentativas = permiteRetry ? CONFIG.MAX_TENTATIVAS_LEITURA : 1;
  let ultimoErro;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      return await executarRequisicao(action, payload);
    } catch (erro) {
      ultimoErro = erro;
      const aindaPodeTentar = tentativa < maxTentativas && erroEhTransitorio(erro);
      if (!aindaPodeTentar) break;
      await pausar(CONFIG.INTERVALO_RETRY_MS);
    }
  }

  throw ultimoErro;
}

function erroEhTransitorio(erro) {
  return erro.name === 'AbortError' || erro instanceof TypeError;
}

function pausar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mensagemAmigavelParaErro(erro) {
  if (erro && erro.name === 'AbortError') return MENSAGENS_ERRO.TEMPORARIO;
  if (erro instanceof TypeError) return MENSAGENS_ERRO.CONEXAO;
  return MENSAGENS_ERRO.TEMPORARIO;
}

async function buscarConvidados(codigo) {
  // Leitura simples e idempotente: pode tentar novamente com segurança.
  return chamarBackend('buscarConvidados', { codigo }, { permiteRetry: true });
}

async function salvarConfirmacao() {
  // Escrita: nunca reenviada automaticamente, para não arriscar duplicidade.
  return chamarBackend('salvarConfirmacao', {
    codigo: estado.codigo,
    respostas: estado.convidados.map((c) => ({
      nome: c.nome,
      compareceu: c.comparecera
    })),
    temRestricao: estado.temRestricao,
    restricao: estado.restricao,
    mensagem: estado.mensagem
  }, { permiteRetry: false });
}

/* =========================================================
   FEEDBACK DE CARREGAMENTO (loading + botão + erros)
   Centraliza o padrão comum a toda chamada ao backend:
   desabilita o botão, troca o texto, mostra o loader global,
   impede clique duplo e sempre restaura tudo ao final —
   mesmo em caso de erro.
========================================================= */
async function executarComFeedback({ botao, textoCarregando, acao, aoFalhar, mensagemFalhaPadrao }) {
  if (botao.disabled) return; // impede clique duplo

  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoCarregando;
  mostrarLoader();

  try {
    await acao();
  } catch (erro) {
    console.error('[RSVP] Falha na comunicação com o backend:', erro);
    const mensagem = mensagemAmigavelParaErro(erro) || mensagemFalhaPadrao;
    aoFalhar(mensagem);
  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
    esconderLoader();
  }
}

/* =========================================================
   UTILITÁRIOS DE UI
========================================================= */
function trocarTela(numero) {
  let telaAtiva = null;

  dom.telas.forEach((tela) => {
    const ativa = Number(tela.dataset.tela) === numero;
    tela.classList.toggle('tela-ativa', ativa);
    if (ativa) telaAtiva = tela;
  });

  atualizarProgresso(numero);
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Move o foco para o início da nova tela, sem alterar o layout —
  // importante para navegação por teclado e leitores de tela.
  if (telaAtiva) {
    telaAtiva.setAttribute('tabindex', '-1');
    telaAtiva.focus({ preventScroll: true });
  }
}

function atualizarProgresso(numero) {
  dom.passosProgresso.forEach((passo) => {
    passo.classList.toggle('ativo', Number(passo.dataset.step) <= numero);
  });
}

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
