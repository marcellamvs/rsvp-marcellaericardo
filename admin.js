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
  ordenacao: 'nome',

  presentes: [],       // [{ id, nome, categoria, descricao, imagem, valorSugerido, linkMercadoPago, ativo }]
  categorias: [],      // [{ id, nome, ativo }]
  contribuicoes: [],   // [{ id, codigo, nome, grupoFamiliar, presenteId, presente, categoria, mensagem, valorSugerido, data, pagamento, valorRecebido, formaPagamento, observacoes, agradecimentoEnviado }]
  filtroPagamento: 'todos'
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

  dom.abaPresentes.addEventListener('click', () => trocarAba('presentes'));
  dom.abaCategorias.addEventListener('click', () => trocarAba('categorias'));
  dom.abaContribuicoes.addEventListener('click', () => trocarAba('contribuicoes'));

  dom.btnNovoPresente.addEventListener('click', () => abrirModalPresente(null));
  dom.formPresente.addEventListener('submit', onSubmitPresente);

  dom.btnNovaCategoria.addEventListener('click', () => abrirModalCategoria(null));
  dom.formCategoria.addEventListener('submit', onSubmitCategoria);

  dom.selectFiltroPagamento.addEventListener('change', () => renderizarTabelaContribuicoes());
  dom.formContribuicao.addEventListener('submit', onSubmitContribuicao);

  document.querySelectorAll('[data-fechar-modal]').forEach((botao) => {
    botao.addEventListener('click', () => fecharModal(document.getElementById(botao.dataset.fecharModal)));
  });

  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (evento) => {
      if (evento.target === overlay) fecharModal(overlay);
    });
  });

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

  /* ---------- Lista de Presentes: abas e métricas extras ---------- */
  dom.abaPresentes = document.getElementById('aba-presentes');
  dom.abaCategorias = document.getElementById('aba-categorias');
  dom.abaContribuicoes = document.getElementById('aba-contribuicoes');
  dom.secaoPresentes = document.getElementById('secao-presentes');
  dom.secaoCategorias = document.getElementById('secao-categorias');
  dom.secaoContribuicoes = document.getElementById('secao-contribuicoes');

  dom.metricaQtdPresentes = document.getElementById('metrica-qtd-presentes');
  dom.metricaQtdContribuicoes = document.getElementById('metrica-qtd-contribuicoes');
  dom.metricaValorSugeridoTotal = document.getElementById('metrica-valor-sugerido-total');
  dom.metricaValorConfirmadoTotal = document.getElementById('metrica-valor-confirmado-total');
  dom.listaUltimasContribuicoes = document.getElementById('lista-ultimas-contribuicoes');
  dom.ultimasContribuicoesVazia = document.getElementById('ultimas-contribuicoes-vazia');

  /* ---------- Presentes: tabela e modal ---------- */
  dom.btnNovoPresente = document.getElementById('btn-novo-presente');
  dom.tabelaPresentesCorpo = document.getElementById('tabela-presentes-corpo');
  dom.tabelaPresentesVazia = document.getElementById('tabela-presentes-vazia');
  dom.modalPresente = document.getElementById('modal-presente');
  dom.modalPresenteTitulo = document.getElementById('modal-presente-titulo');
  dom.formPresente = document.getElementById('form-presente');
  dom.presenteId = document.getElementById('presente-id');
  dom.presenteNome = document.getElementById('presente-nome');
  dom.presenteCategoria = document.getElementById('presente-categoria');
  dom.listaNomesCategorias = document.getElementById('lista-nomes-categorias');
  dom.presenteDescricao = document.getElementById('presente-descricao');
  dom.presenteImagem = document.getElementById('presente-imagem');
  dom.presenteValor = document.getElementById('presente-valor');
  dom.presenteLink = document.getElementById('presente-link');
  dom.presenteAtivo = document.getElementById('presente-ativo');
  dom.erroPresente = document.getElementById('erro-presente');
  dom.btnSalvarPresente = document.getElementById('btn-salvar-presente');

  /* ---------- Categorias: tabela e modal ---------- */
  dom.btnNovaCategoria = document.getElementById('btn-nova-categoria');
  dom.tabelaCategoriasCorpo = document.getElementById('tabela-categorias-corpo');
  dom.tabelaCategoriasVazia = document.getElementById('tabela-categorias-vazia');
  dom.modalCategoria = document.getElementById('modal-categoria');
  dom.modalCategoriaTitulo = document.getElementById('modal-categoria-titulo');
  dom.formCategoria = document.getElementById('form-categoria');
  dom.categoriaId = document.getElementById('categoria-id');
  dom.categoriaNome = document.getElementById('categoria-nome');
  dom.categoriaAtiva = document.getElementById('categoria-ativa');
  dom.erroCategoria = document.getElementById('erro-categoria');
  dom.btnSalvarCategoria = document.getElementById('btn-salvar-categoria');

  /* ---------- Contribuições: tabela, filtro e modal ---------- */
  dom.selectFiltroPagamento = document.getElementById('select-filtro-pagamento');
  dom.tabelaContribuicoesCorpo = document.getElementById('tabela-contribuicoes-corpo');
  dom.tabelaContribuicoesVazia = document.getElementById('tabela-contribuicoes-vazia');
  dom.modalContribuicao = document.getElementById('modal-contribuicao');
  dom.modalContribuicaoDescricao = document.getElementById('modal-contribuicao-descricao');
  dom.formContribuicao = document.getElementById('form-contribuicao');
  dom.contribuicaoId = document.getElementById('contribuicao-id');
  dom.contribuicaoPagamento = document.getElementById('contribuicao-pagamento');
  dom.contribuicaoValorRecebido = document.getElementById('contribuicao-valor-recebido');
  dom.contribuicaoFormaPagamento = document.getElementById('contribuicao-forma-pagamento');
  dom.contribuicaoObservacoes = document.getElementById('contribuicao-observacoes');
  dom.contribuicaoAgradecimento = document.getElementById('contribuicao-agradecimento');
  dom.btnSalvarContribuicao = document.getElementById('btn-salvar-contribuicao');
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
  estado.presentes = [];
  estado.categorias = [];
  estado.contribuicoes = [];
  estado.filtroPagamento = 'todos';

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
  const secoes = {
    dashboard: dom.secaoDashboard,
    configuracoes: dom.secaoConfiguracoes,
    presentes: dom.secaoPresentes,
    categorias: dom.secaoCategorias,
    contribuicoes: dom.secaoContribuicoes
  };

  const abas = {
    dashboard: dom.abaDashboard,
    configuracoes: dom.abaConfiguracoes,
    presentes: dom.abaPresentes,
    categorias: dom.abaCategorias,
    contribuicoes: dom.abaContribuicoes
  };

  Object.keys(secoes).forEach((chave) => {
    secoes[chave].hidden = chave !== nome;
    abas[chave].classList.toggle('aba-ativa', chave === nome);
    abas[chave].setAttribute('aria-current', chave === nome ? 'page' : 'false');
  });
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

  estado.presentes = data.presentes || [];
  estado.categorias = data.categorias || [];
  estado.contribuicoes = data.contribuicoes || [];
  renderizarMetricasPresentes();
  renderizarUltimasContribuicoes();
  renderizarTabelaPresentes();
  renderizarTabelaCategorias();
  renderizarTabelaContribuicoes();
  preencherDatalistCategorias();
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
   LISTA DE PRESENTES — MÓDULO NOVO
========================================================= */
function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/* ---------- Métricas extras no Dashboard ---------- */
function renderizarMetricasPresentes() {
  const contribuicoesValidas = estado.contribuicoes.filter((c) => c.pagamento !== 'Cancelado');
  const valorSugeridoTotal = contribuicoesValidas.reduce((soma, c) => soma + (c.valorSugerido || 0), 0);
  const valorConfirmadoTotal = estado.contribuicoes
    .filter((c) => c.pagamento === 'Pago')
    .reduce((soma, c) => soma + (c.valorRecebido || 0), 0);

  dom.metricaQtdPresentes.textContent = estado.presentes.length;
  dom.metricaQtdContribuicoes.textContent = estado.contribuicoes.length;
  dom.metricaValorSugeridoTotal.textContent = formatarMoeda(valorSugeridoTotal);
  dom.metricaValorConfirmadoTotal.textContent = formatarMoeda(valorConfirmadoTotal);
}

function renderizarUltimasContribuicoes() {
  const ultimas = [...estado.contribuicoes]
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
    .slice(0, 5);

  dom.listaUltimasContribuicoes.innerHTML = '';
  dom.ultimasContribuicoesVazia.hidden = ultimas.length > 0;

  const fragmento = document.createDocumentFragment();

  ultimas.forEach((contribuicao) => {
    const item = document.createElement('li');
    item.className = 'item-ultima-contribuicao';

    const principal = document.createElement('span');
    principal.className = 'destaque';
    principal.textContent = `${contribuicao.nome} → ${contribuicao.presente}`;

    const detalhe = document.createElement('span');
    detalhe.className = 'detalhe';
    detalhe.textContent = contribuicao.data ? formatarDataHora(contribuicao.data) : '—';

    item.append(principal, detalhe);
    fragmento.appendChild(item);
  });

  dom.listaUltimasContribuicoes.appendChild(fragmento);
}

/* ---------- Presentes: tabela ---------- */
function renderizarTabelaPresentes() {
  dom.tabelaPresentesCorpo.innerHTML = '';
  dom.tabelaPresentesVazia.hidden = estado.presentes.length > 0;

  const fragmento = document.createDocumentFragment();

  estado.presentes.forEach((presente) => {
    const tr = document.createElement('tr');

    tr.appendChild(criarCelula(presente.nome));
    tr.appendChild(criarCelula(presente.categoria));
    tr.appendChild(criarCelula(formatarMoeda(presente.valorSugerido)));

    const tdAtivo = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = presente.ativo ? 'badge-ativo' : 'badge-inativo';
    badge.textContent = presente.ativo ? 'Ativo' : 'Inativo';
    tdAtivo.appendChild(badge);
    tr.appendChild(tdAtivo);

    tr.appendChild(criarCelulaAcoesPresente(presente));

    fragmento.appendChild(tr);
  });

  dom.tabelaPresentesCorpo.appendChild(fragmento);
}

function criarCelulaAcoesPresente(presente) {
  const td = document.createElement('td');
  const container = document.createElement('div');
  container.className = 'acoes-tabela';

  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'botao-acao-tabela';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', () => abrirModalPresente(presente));

  const btnExcluir = document.createElement('button');
  btnExcluir.type = 'button';
  btnExcluir.className = 'botao-acao-tabela acao-excluir';
  btnExcluir.textContent = 'Excluir';
  btnExcluir.addEventListener('click', () => confirmarExclusaoPresente(presente));

  container.append(btnEditar, btnExcluir);
  td.appendChild(container);
  return td;
}

/* ---------- Presentes: modal (criar/editar) ---------- */
function abrirModalPresente(presente) {
  dom.formPresente.reset();
  limparErro(dom.erroPresente);

  dom.modalPresenteTitulo.textContent = presente ? 'Editar presente' : 'Adicionar presente';
  dom.presenteId.value = presente ? presente.id : '';
  dom.presenteNome.value = presente ? presente.nome : '';
  dom.presenteCategoria.value = presente ? presente.categoria : '';
  dom.presenteDescricao.value = presente ? presente.descricao : '';
  dom.presenteImagem.value = presente ? presente.imagem : '';
  dom.presenteValor.value = presente ? presente.valorSugerido : '';
  dom.presenteLink.value = presente ? presente.linkMercadoPago : '';
  dom.presenteAtivo.checked = presente ? presente.ativo : true;

  abrirModal(dom.modalPresente);
  dom.presenteNome.focus();
}

async function onSubmitPresente(evento) {
  evento.preventDefault();
  limparErro(dom.erroPresente);

  const nome = dom.presenteNome.value.trim();
  const categoria = dom.presenteCategoria.value.trim();

  if (!nome || !categoria) {
    mostrarErro(dom.erroPresente, 'Informe nome e categoria do presente.');
    return;
  }

  await executarComFeedback({
    botao: dom.btnSalvarPresente,
    textoCarregando: 'Salvando...',
    acao: async () => {
      const resposta = await chamarBackend('salvarPresente', {
        usuario: sessao.usuario,
        senha: sessao.senha,
        presente: {
          id: dom.presenteId.value || undefined,
          nome,
          categoria,
          descricao: dom.presenteDescricao.value.trim(),
          imagem: dom.presenteImagem.value.trim(),
          valorSugerido: Number(dom.presenteValor.value) || 0,
          linkMercadoPago: dom.presenteLink.value.trim(),
          ativo: dom.presenteAtivo.checked
        }
      });

      if (!resposta.success) {
        mostrarErro(dom.erroPresente, resposta.message || MENSAGENS_ERRO.TEMPORARIO);
        return;
      }

      estado.presentes = resposta.data || [];
      renderizarTabelaPresentes();
      renderizarMetricasPresentes();
      preencherDatalistCategorias();
      fecharModal(dom.modalPresente);
      mostrarToast('Presente salvo.', 'sucesso');
    },
    aoFalhar: (mensagem) => mostrarErro(dom.erroPresente, mensagem)
  });
}

function confirmarExclusaoPresente(presente) {
  const confirmado = window.confirm(`Excluir o presente "${presente.nome}"? Esta ação não pode ser desfeita.`);
  if (confirmado) excluirPresenteRemoto(presente.id);
}

async function excluirPresenteRemoto(id) {
  mostrarLoader();

  try {
    const resposta = await chamarBackend('excluirPresente', {
      usuario: sessao.usuario,
      senha: sessao.senha,
      id
    });

    if (!resposta.success) {
      mostrarToast(resposta.message || MENSAGENS_ERRO.TEMPORARIO, 'erro');
      return;
    }

    estado.presentes = resposta.data || [];
    renderizarTabelaPresentes();
    renderizarMetricasPresentes();
    mostrarToast('Presente excluído.', 'sucesso');
  } catch (erro) {
    console.error('[Admin] Falha ao excluir presente:', erro);
    mostrarToast(mensagemAmigavelParaErro(erro), 'erro');
  } finally {
    esconderLoader();
  }
}

/* ---------- Categorias: tabela ---------- */
function renderizarTabelaCategorias() {
  dom.tabelaCategoriasCorpo.innerHTML = '';
  dom.tabelaCategoriasVazia.hidden = estado.categorias.length > 0;

  const fragmento = document.createDocumentFragment();

  estado.categorias.forEach((categoria) => {
    const tr = document.createElement('tr');
    tr.appendChild(criarCelula(categoria.nome));

    const tdAtivo = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = categoria.ativo ? 'badge-ativo' : 'badge-inativo';
    badge.textContent = categoria.ativo ? 'Ativa' : 'Inativa';
    tdAtivo.appendChild(badge);
    tr.appendChild(tdAtivo);

    tr.appendChild(criarCelulaAcoesCategoria(categoria));
    fragmento.appendChild(tr);
  });

  dom.tabelaCategoriasCorpo.appendChild(fragmento);
}

function criarCelulaAcoesCategoria(categoria) {
  const td = document.createElement('td');
  const container = document.createElement('div');
  container.className = 'acoes-tabela';

  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'botao-acao-tabela';
  btnEditar.textContent = 'Editar';
  btnEditar.addEventListener('click', () => abrirModalCategoria(categoria));

  const btnExcluir = document.createElement('button');
  btnExcluir.type = 'button';
  btnExcluir.className = 'botao-acao-tabela acao-excluir';
  btnExcluir.textContent = 'Excluir';
  btnExcluir.addEventListener('click', () => confirmarExclusaoCategoria(categoria));

  container.append(btnEditar, btnExcluir);
  td.appendChild(container);
  return td;
}

function preencherDatalistCategorias() {
  dom.listaNomesCategorias.innerHTML = '';
  estado.categorias.forEach((categoria) => {
    const option = document.createElement('option');
    option.value = categoria.nome;
    dom.listaNomesCategorias.appendChild(option);
  });
}

/* ---------- Categorias: modal (criar/editar) ---------- */
function abrirModalCategoria(categoria) {
  dom.formCategoria.reset();
  limparErro(dom.erroCategoria);

  dom.modalCategoriaTitulo.textContent = categoria ? 'Editar categoria' : 'Adicionar categoria';
  dom.categoriaId.value = categoria ? categoria.id : '';
  dom.categoriaNome.value = categoria ? categoria.nome : '';
  dom.categoriaAtiva.checked = categoria ? categoria.ativo : true;

  abrirModal(dom.modalCategoria);
  dom.categoriaNome.focus();
}

async function onSubmitCategoria(evento) {
  evento.preventDefault();
  limparErro(dom.erroCategoria);

  const nome = dom.categoriaNome.value.trim();
  if (!nome) {
    mostrarErro(dom.erroCategoria, 'Informe o nome da categoria.');
    return;
  }

  await executarComFeedback({
    botao: dom.btnSalvarCategoria,
    textoCarregando: 'Salvando...',
    acao: async () => {
      const resposta = await chamarBackend('salvarCategoria', {
        usuario: sessao.usuario,
        senha: sessao.senha,
        categoria: {
          id: dom.categoriaId.value || undefined,
          nome,
          ativo: dom.categoriaAtiva.checked
        }
      });

      if (!resposta.success) {
        mostrarErro(dom.erroCategoria, resposta.message || MENSAGENS_ERRO.TEMPORARIO);
        return;
      }

      estado.categorias = resposta.data || [];
      renderizarTabelaCategorias();
      preencherDatalistCategorias();
      fecharModal(dom.modalCategoria);
      mostrarToast('Categoria salva.', 'sucesso');
    },
    aoFalhar: (mensagem) => mostrarErro(dom.erroCategoria, mensagem)
  });
}

function confirmarExclusaoCategoria(categoria) {
  const confirmado = window.confirm(`Excluir a categoria "${categoria.nome}"? Presentes já cadastrados nessa categoria não serão alterados.`);
  if (confirmado) excluirCategoriaRemota(categoria.id);
}

async function excluirCategoriaRemota(id) {
  mostrarLoader();

  try {
    const resposta = await chamarBackend('excluirCategoria', {
      usuario: sessao.usuario,
      senha: sessao.senha,
      id
    });

    if (!resposta.success) {
      mostrarToast(resposta.message || MENSAGENS_ERRO.TEMPORARIO, 'erro');
      return;
    }

    estado.categorias = resposta.data || [];
    renderizarTabelaCategorias();
    preencherDatalistCategorias();
    mostrarToast('Categoria excluída.', 'sucesso');
  } catch (erro) {
    console.error('[Admin] Falha ao excluir categoria:', erro);
    mostrarToast(mensagemAmigavelParaErro(erro), 'erro');
  } finally {
    esconderLoader();
  }
}

/* ---------- Contribuições: tabela e filtro ---------- */
function renderizarTabelaContribuicoes() {
  const filtro = dom.selectFiltroPagamento.value;
  const contribuicoesFiltradas = filtro === 'todos'
    ? estado.contribuicoes
    : estado.contribuicoes.filter((c) => c.pagamento === filtro);

  dom.tabelaContribuicoesCorpo.innerHTML = '';
  dom.tabelaContribuicoesVazia.hidden = contribuicoesFiltradas.length > 0;

  const fragmento = document.createDocumentFragment();

  contribuicoesFiltradas.forEach((contribuicao) => {
    const tr = document.createElement('tr');

    tr.appendChild(criarCelula(contribuicao.nome));
    tr.appendChild(criarCelula(contribuicao.grupoFamiliar || '—', 'celula-mensagem'));
    tr.appendChild(criarCelula(contribuicao.presente));
    tr.appendChild(criarCelula(contribuicao.mensagem || '—', 'celula-mensagem'));
    tr.appendChild(criarCelula(formatarMoeda(contribuicao.valorSugerido)));

    const tdPagamento = document.createElement('td');
    const badge = document.createElement('span');
    const classesPagamento = {
      Pago: 'status-badge status-confirmado',
      Cancelado: 'status-badge status-ausente',
      Pendente: 'status-badge status-pendente'
    };
    badge.className = classesPagamento[contribuicao.pagamento] || 'status-badge status-pendente';
    badge.textContent = contribuicao.pagamento;
    tdPagamento.appendChild(badge);
    tr.appendChild(tdPagamento);

    tr.appendChild(criarCelula(contribuicao.valorRecebido ? formatarMoeda(contribuicao.valorRecebido) : '—'));
    tr.appendChild(criarCelula(contribuicao.data ? formatarDataHora(contribuicao.data) : '—'));
    tr.appendChild(criarCelula(contribuicao.agradecimentoEnviado ? 'Sim' : 'Não'));

    tr.appendChild(criarCelulaAcoesContribuicao(contribuicao));

    fragmento.appendChild(tr);
  });

  dom.tabelaContribuicoesCorpo.appendChild(fragmento);
}

function criarCelulaAcoesContribuicao(contribuicao) {
  const td = document.createElement('td');
  const btnEditar = document.createElement('button');
  btnEditar.type = 'button';
  btnEditar.className = 'botao-acao-tabela';
  btnEditar.textContent = 'Atualizar';
  btnEditar.addEventListener('click', () => abrirModalContribuicao(contribuicao));
  td.appendChild(btnEditar);
  return td;
}

/* ---------- Contribuições: modal de pagamento ---------- */
function abrirModalContribuicao(contribuicao) {
  dom.formContribuicao.reset();

  dom.modalContribuicaoDescricao.textContent = `${contribuicao.nome} — ${contribuicao.presente}`;
  dom.contribuicaoId.value = contribuicao.id;
  dom.contribuicaoPagamento.value = contribuicao.pagamento || 'Pendente';
  dom.contribuicaoValorRecebido.value = contribuicao.valorRecebido || '';
  dom.contribuicaoFormaPagamento.value = contribuicao.formaPagamento || '';
  dom.contribuicaoObservacoes.value = contribuicao.observacoes || '';
  dom.contribuicaoAgradecimento.checked = Boolean(contribuicao.agradecimentoEnviado);

  abrirModal(dom.modalContribuicao);
}

async function onSubmitContribuicao(evento) {
  evento.preventDefault();

  await executarComFeedback({
    botao: dom.btnSalvarContribuicao,
    textoCarregando: 'Salvando...',
    acao: async () => {
      const resposta = await chamarBackend('atualizarContribuicao', {
        usuario: sessao.usuario,
        senha: sessao.senha,
        contribuicao: {
          id: dom.contribuicaoId.value,
          pagamento: dom.contribuicaoPagamento.value,
          valorRecebido: Number(dom.contribuicaoValorRecebido.value) || 0,
          formaPagamento: dom.contribuicaoFormaPagamento.value.trim(),
          observacoes: dom.contribuicaoObservacoes.value.trim(),
          agradecimentoEnviado: dom.contribuicaoAgradecimento.checked
        }
      });

      if (!resposta.success) {
        mostrarToast(resposta.message || MENSAGENS_ERRO.TEMPORARIO, 'erro');
        return;
      }

      estado.contribuicoes = resposta.data || [];
      renderizarTabelaContribuicoes();
      renderizarMetricasPresentes();
      renderizarUltimasContribuicoes();
      fecharModal(dom.modalContribuicao);
      mostrarToast('Contribuição atualizada.', 'sucesso');
    },
    aoFalhar: (mensagem) => mostrarToast(mensagem, 'erro')
  });
}

/* ---------- Utilitário genérico de modal ---------- */
function abrirModal(elementoOverlay) {
  elementoOverlay.hidden = false;
  elementoOverlay.setAttribute('aria-hidden', 'false');
}

function fecharModal(elementoOverlay) {
  elementoOverlay.hidden = true;
  elementoOverlay.setAttribute('aria-hidden', 'true');
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
