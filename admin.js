/* =========================================================
   CONFIGURAÇÃO
   Mesma URL do Apps Script usada pelo site público.
========================================================= */
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxF9OdJoRlHPpLtm3Ky6PyTewMsd1WQrGCULH7Bl0QIVnYTQwJyUz0y2q6-yxIFo-P0/exec',
  TIMEOUT_MS: 15000
};

const MENSAGENS_ERRO = {
  CONEXAO: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet e tente novamente.',
  TEMPORARIO: 'O sistema está temporariamente indisponível. Tente novamente em alguns instantes.',
  LOGIN_INVALIDO: 'Usuário ou senha inválidos.'
};

/* Sessão mantida só em memória — nunca em localStorage/sessionStorage.
   É perdida ao recarregar a página, exigindo login novamente. */
const sessao = {
  usuario: '',
  senha: ''
};

/* Dados brutos vindos do backend + estado dos controles de tabela */
const estado = {
  convidados: [],     // [{ codigo, nome }]
  confirmacoes: [],   // [{ codigo, respostas, restricao, mensagem, dataHora }]
  configuracoes: {},  // { nome_evento, data_evento, horario_evento, data_limite, link_maps, site_noivos, exibir_site_noivos }
  linhas: [],         // dados já cruzados, prontos para exibir
  busca: '',
  filtro: 'todos',
  ordenacao: 'nome'
};

const dom = {};

/* =========================================================
   INIT
========================================================= */
function init() {
  cachearElementos();

  dom.formLogin.addEventListener('submit', onSubmitLogin);
  dom.btnSair.addEventListener('click', sair);
  dom.btnAtualizar.addEventListener('click', atualizarDados);

  dom.abaDashboard.addEventListener('click', () => trocarAba('dashboard'));
  dom.abaConfiguracoes.addEventListener('click', () => trocarAba('configuracoes'));
  dom.formConfiguracoes.addEventListener('submit', onSubmitConfiguracoes);

  dom.inputBusca.addEventListener('input', onMudarControle);
  dom.selectFiltro.addEventListener('change', onMudarControle);
  dom.selectOrdenacao.addEventListener('change', onMudarControle);

  dom.btnExportarCsv.addEventListener('click', exportarCsv);
  dom.btnCopiarPendentes.addEventListener('click', () => copiarPendentes('nome'));
  dom.btnCopiarCodigosPendentes.addEventListener('click', () => copiarPendentes('codigo'));

  dom.inputUsuario.focus();
}

function cachearElementos() {
  dom.loading = document.getElementById('loading');
  dom.toastContainer = document.getElementById('toast-container');

  dom.telaLogin = document.getElementById('tela-login');
  dom.telaDashboard = document.getElementById('tela-dashboard');

  dom.formLogin = document.getElementById('form-login');
  dom.inputUsuario = document.getElementById('input-usuario');
  dom.inputSenha = document.getElementById('input-senha');
  dom.erroLogin = document.getElementById('erro-login');
  dom.btnEntrar = document.getElementById('btn-entrar');

  dom.btnSair = document.getElementById('btn-sair');
  dom.btnAtualizar = document.getElementById('btn-atualizar');

  dom.abaDashboard = document.getElementById('aba-dashboard');
  dom.abaConfiguracoes = document.getElementById('aba-configuracoes');
  dom.secaoDashboard = document.getElementById('secao-dashboard');
  dom.secaoConfiguracoes = document.getElementById('secao-configuracoes');

  dom.formConfiguracoes = document.getElementById('form-configuracoes');
  dom.configNomeEvento = document.getElementById('config-nome-evento');
  dom.configDataEvento = document.getElementById('config-data-evento');
  dom.configHorarioEvento = document.getElementById('config-horario-evento');
  dom.configLinkMaps = document.getElementById('config-link-maps');
  dom.configDataLimite = document.getElementById('config-data-limite');
  dom.configSiteNoivos = document.getElementById('config-site-noivos');
  dom.configExibirSiteNoivos = document.getElementById('config-exibir-site-noivos');
  dom.mensagemConfiguracoes = document.getElementById('mensagem-configuracoes');
  dom.btnSalvarConfiguracoes = document.getElementById('btn-salvar-configuracoes');

  dom.metricaTotal = document.getElementById('metrica-total');
  dom.metricaConfirmados = document.getElementById('metrica-confirmados');
  dom.metricaAusentes = document.getElementById('metrica-ausentes');
  dom.metricaPendentes = document.getElementById('metrica-pendentes');
  dom.metricaTaxa = document.getElementById('metrica-taxa');
  dom.metricaRestricoes = document.getElementById('metrica-restricoes');
  dom.ultimaAtualizacao = document.getElementById('admin-ultima-atualizacao');

  dom.inputBusca = document.getElementById('input-busca');
  dom.selectFiltro = document.getElementById('select-filtro');
  dom.selectOrdenacao = document.getElementById('select-ordenacao');

  dom.btnExportarCsv = document.getElementById('btn-exportar-csv');
  dom.btnCopiarPendentes = document.getElementById('btn-copiar-pendentes');
  dom.btnCopiarCodigosPendentes = document.getElementById('btn-copiar-codigos-pendentes');

  dom.tabelaCorpo = document.getElementById('admin-tabela-corpo');
  dom.tabelaVazia = document.getElementById('admin-tabela-vazia');
}

/* =========================================================
   LOGIN / LOGOUT
========================================================= */
async function onSubmitLogin(evento) {
  evento.preventDefault();
  limparErro(dom.erroLogin);

  const usuario = dom.inputUsuario.value.trim();
  const senha = dom.inputSenha.value;

  if (!usuario || !senha) {
    mostrarErro(dom.erroLogin, 'Informe usuário e senha.');
    return;
  }

  await executarComFeedback({
    botao: dom.btnEntrar,
    textoCarregando: 'Entrando...',
    acao: async () => {
      const resposta = await chamarBackend('adminEntrar', { usuario, senha });

      if (!resposta.success) {
        mostrarErro(dom.erroLogin, resposta.message || MENSAGENS_ERRO.LOGIN_INVALIDO);
        return;
      }

      sessao.usuario = usuario;
      sessao.senha = senha;

      aplicarDados(resposta.data);
      mostrarDashboard();
    },
    aoFalhar: (mensagem) => mostrarErro(dom.erroLogin, mensagem)
  });
}

function sair() {
  sessao.usuario = '';
  sessao.senha = '';
  estado.convidados = [];
  estado.confirmacoes = [];
  estado.configuracoes = {};
  estado.linhas = [];

  dom.formLogin.reset();
  dom.inputSenha.value = '';
  limparErro(dom.erroLogin);

  dom.formConfiguracoes.reset();
  limparErro(dom.mensagemConfiguracoes);
  trocarAba('dashboard');

  dom.telaDashboard.hidden = true;
  dom.telaLogin.hidden = false;
  dom.inputUsuario.focus();
}

function mostrarDashboard() {
  dom.telaLogin.hidden = true;
  dom.telaDashboard.hidden = false;
  dom.telaDashboard.setAttribute('tabindex', '-1');
  dom.telaDashboard.focus({ preventScroll: true });
}

/* =========================================================
   ABAS (Dashboard / Configurações do Evento)
========================================================= */
function trocarAba(nome) {
  const dashboardAtivo = nome === 'dashboard';

  dom.secaoDashboard.hidden = !dashboardAtivo;
  dom.secaoConfiguracoes.hidden = dashboardAtivo;

  dom.abaDashboard.classList.toggle('aba-ativa', dashboardAtivo);
  dom.abaConfiguracoes.classList.toggle('aba-ativa', !dashboardAtivo);
}

/* =========================================================
   CONFIGURAÇÕES DO EVENTO
========================================================= */
function preencherFormularioConfiguracoes(config) {
  dom.configNomeEvento.value = config.nome_evento || '';
  dom.configDataEvento.value = config.data_evento || '';
  dom.configHorarioEvento.value = config.horario_evento || '';
  dom.configLinkMaps.value = config.link_maps || '';
  dom.configDataLimite.value = config.data_limite || '';
  dom.configSiteNoivos.value = config.site_noivos || '';
  dom.configExibirSiteNoivos.checked = config.exibir_site_noivos === true || config.exibir_site_noivos === 'true';
}

async function onSubmitConfiguracoes(evento) {
  evento.preventDefault();
  limparErro(dom.mensagemConfiguracoes);

  const configuracoes = {
    nome_evento: dom.configNomeEvento.value.trim(),
    data_evento: dom.configDataEvento.value.trim(),
    horario_evento: dom.configHorarioEvento.value.trim(),
    link_maps: dom.configLinkMaps.value.trim(),
    data_limite: dom.configDataLimite.value,
    site_noivos: dom.configSiteNoivos.value.trim(),
    exibir_site_noivos: dom.configExibirSiteNoivos.checked
  };

  await executarComFeedback({
    botao: dom.btnSalvarConfiguracoes,
    textoCarregando: 'Salvando...',
    acao: async () => {
      const resposta = await chamarBackend('salvarConfiguracoes', {
        usuario: sessao.usuario,
        senha: sessao.senha,
        configuracoes
      });

      if (!resposta.success) {
        mostrarToast(resposta.message || MENSAGENS_ERRO.TEMPORARIO, 'erro');
        return;
      }

      estado.configuracoes = resposta.data || configuracoes;
      preencherFormularioConfiguracoes(estado.configuracoes);
      mostrarErro(dom.mensagemConfiguracoes, 'Configurações salvas com sucesso.');
      mostrarToast('Configurações salvas.', 'sucesso');
    },
    aoFalhar: (mensagem) => mostrarToast(mensagem, 'erro')
  });
}

/* =========================================================
   ATUALIZAR DADOS
========================================================= */
async function atualizarDados() {
  await executarComFeedback({
    botao: dom.btnAtualizar,
    textoCarregando: 'Atualizando...',
    acao: async () => {
      const resposta = await chamarBackend('adminEntrar', {
        usuario: sessao.usuario,
        senha: sessao.senha
      });

      if (!resposta.success) {
        // Sessão pode ter deixado de ser válida (ex.: senha trocada) — volta ao login.
        mostrarToast(resposta.message || MENSAGENS_ERRO.LOGIN_INVALIDO, 'erro');
        sair();
        return;
      }

      // Preserva filtros/busca/ordenação ativos — só os dados são recarregados.
      aplicarDados(resposta.data);
      mostrarToast('Dados atualizados.', 'sucesso');
    },
    aoFalhar: (mensagem) => mostrarToast(mensagem, 'erro')
  });
}

function aplicarDados(data) {
  estado.convidados = data.convidados || [];
  estado.confirmacoes = data.confirmacoes || [];
  estado.configuracoes = data.configuracoes || {};
  estado.linhas = cruzarDados(estado.convidados, estado.confirmacoes);
  renderizarDashboard();
  preencherFormularioConfiguracoes(estado.configuracoes);
}

/* =========================================================
   CRUZAMENTO DE DADOS (Convidados + Confirmações)
========================================================= */
function cruzarDados(convidados, confirmacoes) {
  const confirmacoesPorCodigo = new Map();
  confirmacoes.forEach((confirmacao) => confirmacoesPorCodigo.set(confirmacao.codigo, confirmacao));

  return convidados.map((convidado) => {
    const confirmacao = confirmacoesPorCodigo.get(convidado.codigo);

    if (!confirmacao) {
      return {
        codigo: convidado.codigo,
        nome: convidado.nome,
        status: 'pendente',
        restricao: '',
        mensagem: '',
        dataHora: ''
      };
    }

    const resposta = (confirmacao.respostas || []).find(
      (r) => normalizarTexto(r.nome) === normalizarTexto(convidado.nome)
    );

    const status = !resposta ? 'pendente' : (resposta.compareceu ? 'confirmado' : 'ausente');

    return {
      codigo: convidado.codigo,
      nome: convidado.nome,
      status,
      restricao: confirmacao.restricao || '',
      mensagem: confirmacao.mensagem || '',
      dataHora: confirmacao.dataHora || ''
    };
  });
}

function normalizarTexto(texto) {
  return String(texto || '').trim().toLowerCase();
}

/* =========================================================
   DASHBOARD (métricas + tabela)
========================================================= */
function renderizarDashboard() {
  renderizarMetricas();
  renderizarTabela();
}

function renderizarMetricas() {
  const total = estado.linhas.length;
  const confirmados = estado.linhas.filter((l) => l.status === 'confirmado').length;
  const ausentes = estado.linhas.filter((l) => l.status === 'ausente').length;
  const pendentes = estado.linhas.filter((l) => l.status === 'pendente').length;
  const taxa = total > 0 ? Math.round((confirmados / total) * 100) : 0;

  const codigosComRestricao = new Set(
    estado.confirmacoes.filter((c) => String(c.restricao || '').trim().length > 0).map((c) => c.codigo)
  );

  dom.metricaTotal.textContent = total;
  dom.metricaConfirmados.textContent = confirmados;
  dom.metricaAusentes.textContent = ausentes;
  dom.metricaPendentes.textContent = pendentes;
  dom.metricaTaxa.textContent = `${taxa}%`;
  dom.metricaRestricoes.textContent = codigosComRestricao.size;

  const ultimaData = estado.confirmacoes
    .map((c) => c.dataHora)
    .filter(Boolean)
    .sort()
    .pop();

  dom.ultimaAtualizacao.textContent = ultimaData
    ? `Última confirmação recebida em ${formatarDataHora(ultimaData)}`
    : 'Nenhuma confirmação recebida ainda.';
}

function renderizarTabela() {
  const linhasFiltradas = filtrarLinhas(estado.linhas);
  const linhasOrdenadas = ordenarLinhas(linhasFiltradas);

  dom.tabelaCorpo.innerHTML = '';
  dom.tabelaVazia.hidden = linhasOrdenadas.length > 0;

  const fragmento = document.createDocumentFragment();

  linhasOrdenadas.forEach((linha) => {
    const tr = document.createElement('tr');

    tr.appendChild(criarCelula(linha.codigo));
    tr.appendChild(criarCelula(linha.nome));
    tr.appendChild(criarCelulaStatus(linha.status));

    tr.appendChild(criarCelula(linha.restricao || '—', 'celula-restricao'));
    tr.appendChild(criarCelula(linha.mensagem || '—', 'celula-mensagem'));
    tr.appendChild(criarCelula(linha.dataHora ? formatarDataHora(linha.dataHora) : '—'));

    fragmento.appendChild(tr);
  });

  dom.tabelaCorpo.appendChild(fragmento);
}

function criarCelula(texto, classe) {
  const td = document.createElement('td');
  td.textContent = texto;
  if (classe) td.className = classe;
  return td;
}

function criarCelulaStatus(status) {
  const td = document.createElement('td');
  const badge = document.createElement('span');

  const rotulos = { confirmado: 'Confirmado', ausente: 'Ausente', pendente: 'Pendente' };
  badge.className = `status-badge status-${status}`;
  badge.textContent = rotulos[status] || status;

  td.appendChild(badge);
  return td;
}

function formatarDataHora(isoString) {
  try {
    return new Date(isoString).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch (erro) {
    return isoString;
  }
}

/* =========================================================
   FILTROS, BUSCA E ORDENAÇÃO
========================================================= */
function onMudarControle() {
  estado.busca = dom.inputBusca.value;
  estado.filtro = dom.selectFiltro.value;
  estado.ordenacao = dom.selectOrdenacao.value;
  renderizarTabela();
}

function filtrarLinhas(linhas) {
  const termoBusca = normalizarTexto(estado.busca);

  return linhas.filter((linha) => {
    const combinaBusca = !termoBusca
      || normalizarTexto(linha.nome).includes(termoBusca)
      || normalizarTexto(linha.codigo).includes(termoBusca);

    if (!combinaBusca) return false;

    switch (estado.filtro) {
      case 'confirmados': return linha.status === 'confirmado';
      case 'ausentes': return linha.status === 'ausente';
      case 'pendentes': return linha.status === 'pendente';
      case 'restricao': return String(linha.restricao || '').trim().length > 0;
      default: return true;
    }
  });
}

function ordenarLinhas(linhas) {
  const copia = [...linhas];

  const comparadores = {
    nome: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
    codigo: (a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'),
    status: (a, b) => a.status.localeCompare(b.status, 'pt-BR'),
    data: (a, b) => String(a.dataHora).localeCompare(String(b.dataHora))
  };

  const comparador = comparadores[estado.ordenacao] || comparadores.nome;
  return copia.sort(comparador);
}

/* =========================================================
   AÇÕES EXTRAS (exportar, copiar)
========================================================= */
function exportarCsv() {
  const linhas = ordenarLinhas(filtrarLinhas(estado.linhas));

  if (linhas.length === 0) {
    mostrarToast('Não há dados para exportar com os filtros atuais.', 'erro');
    return;
  }

  const cabecalho = ['Código', 'Nome', 'Status', 'Restrição alimentar', 'Mensagem', 'Última atualização'];
  const rotulos = { confirmado: 'Confirmado', ausente: 'Ausente', pendente: 'Pendente' };

  const linhasCsv = linhas.map((linha) => [
    linha.codigo,
    linha.nome,
    rotulos[linha.status] || linha.status,
    linha.restricao,
    linha.mensagem,
    linha.dataHora ? formatarDataHora(linha.dataHora) : ''
  ]);

  const csv = [cabecalho, ...linhasCsv]
    .map((colunas) => colunas.map(escaparCampoCsv).join(';'))
    .join('\r\n');

  baixarArquivo(csv, 'confirmacoes-rsvp.csv', 'text/csv;charset=utf-8;');
  mostrarToast('CSV exportado.', 'sucesso');
}

function escaparCampoCsv(valor) {
  const texto = String(valor ?? '').replace(/"/g, '""');
  return `"${texto}"`;
}

function baixarArquivo(conteudo, nomeArquivo, tipoMime) {
  const bom = '\uFEFF'; // garante acentuação correta ao abrir no Excel
  const blob = new Blob([bom + conteudo], { type: tipoMime });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

async function copiarPendentes(campo) {
  const pendentes = estado.linhas.filter((linha) => linha.status === 'pendente');

  if (pendentes.length === 0) {
    mostrarToast('Não há convidados pendentes.', 'sucesso');
    return;
  }

  const valores = campo === 'codigo'
    ? [...new Set(pendentes.map((linha) => linha.codigo))]
    : pendentes.map((linha) => linha.nome);

  const texto = valores.join('\n');

  try {
    await navigator.clipboard.writeText(texto);
    mostrarToast(
      campo === 'codigo' ? 'Códigos pendentes copiados.' : 'Nomes pendentes copiados.',
      'sucesso'
    );
  } catch (erro) {
    console.error('[Admin] Falha ao copiar para a área de transferência:', erro);
    mostrarToast('Não foi possível copiar. Tente selecionar e copiar manualmente.', 'erro');
  }
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
   FEEDBACK DE CARREGAMENTO (mesmo padrão do site público)
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
    console.error('[Admin] Falha na comunicação com o backend:', erro);
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
