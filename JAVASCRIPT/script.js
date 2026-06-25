// Configuração de Conexão com a Nuvem
const SUPABASE_URL = 'COLE_AQUI_A_SUA_URL_DO_SUPABASE';
const SUPABASE_KEY = 'COLE_AQUI_A_SUA_CHAVE_ANON_PUBLIC';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let tarefas = [];
let filtroAtual = 'todas';
let termoBusca = '';

const inputTarefa = document.getElementById('nova-tarefa');
const selectLocal = document.getElementById('local-tarefa');
const inputEquipe = document.getElementById('equipe-tarefa');
const selectPrioridade = document.getElementById('prioridade-tarefa');
const inputBusca = document.getElementById('busca-tarefa');
const btnAdicionar = document.getElementById('btn-adicionar');
const btnImprimir = document.getElementById('btn-imprimir');
const listaTarefas = document.getElementById('lista-tarefas');
const botoesFiltro = document.querySelectorAll('.btn-filtro');
const relogio = document.getElementById('relogio-digital');
const toast = document.getElementById('toast');
let toastTimeout;

// Relógio em Tempo Real (Atrasado 3 minutos para compensar o PC)
setInterval(() => {
    const agora = new Date();
    agora.setMinutes(agora.getMinutes() - 3);
    relogio.textContent = agora.toLocaleTimeString('pt-BR');
}, 1000);

function mostrarNotificacao(mensagem, tipo) {
    clearTimeout(toastTimeout);
    toast.textContent = mensagem;
    toast.className = `toast show ${tipo}`;
    toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function atualizarEstatisticas() {
    document.getElementById('stat-total').textContent = tarefas.length;
    document.getElementById('stat-alta').textContent = tarefas.filter(t => !t.concluida && t.prioridade === 'Emergência').length;
    document.getElementById('stat-resolvidas').textContent = tarefas.filter(t => t.concluida).length;
}

function obterDataHoraAtual() {
    const data = new Date();
    data.setMinutes(data.getMinutes() - 3);
    return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
}

// BUSCAR DADOS DA NUVEM (SELECT)
async function carregarOcorrencias() {
    const { data, error } = await _supabase
        .from('ocorrencias')
        .select('*')
        .order('id', { ascending: false });

    if (error) {
        mostrarNotificacao('Erro ao conectar com o banco de dados.', 'error');
        console.error(error);
    } else {
        tarefas = data || [];
        renderizarTarefas();
    }
}

// GRAVAR NA NUVEM (INSERT)
async function adicionarTarefa() {
    const texto = inputTarefa.value.trim();
    
    if (texto === '') {
        mostrarNotificacao('ERRO: Preencha a descrição da ocorrência.', 'error');
        return;
    }

    const novaTarefa = {
        codigo: 'REG-' + Math.floor(Math.random() * 9000 + 1000),
        texto: texto,
        local: selectLocal.value,
        equipe: inputEquipe.value.trim() || 'Não Atribuída',
        prioridade: selectPrioridade.value,
        concluida: false,
        dataCriacao: obterDataHoraAtual()
    };

    const { error } = await _supabase
        .from('ocorrencias')
        .insert([novaTarefa]);

    if (error) {
        mostrarNotificacao('Erro ao salvar na nuvem.', 'error');
    } else {
        inputTarefa.value = '';
        inputEquipe.value = '';
        selectLocal.value = 'Sem Local';
        mostrarNotificacao('Registro gravado na nuvem com sucesso.', 'success');
        await carregarOcorrencias();
    }
}

// ATUALIZAR STATUS NA NUVEM (UPDATE)
async function alternarStatus(id, statusAtual) {
    const { error } = await _supabase
        .from('ocorrencias')
        .update({ concluida: !statusAtual })
        .eq('id', id);

    if (error) {
        mostrarNotificacao('Erro ao atualizar status.', 'error');
    } else {
        await carregarOcorrencias();
    }
}

// DELETAR NA NUVEM (DELETE)
async function excluirTarefa(id) {
    if(confirm('Atenção: Excluir um registro de segurança não é recomendado. Deseja prosseguir?')) {
        const { error } = await _supabase
            .from('ocorrencias')
            .delete()
            .eq('id', id);

        if (error) {
            mostrarNotificacao('Erro ao excluir registro.', 'error');
        } else {
            mostrarNotificacao('Registro expurgado da nuvem.', 'error');
            await carregarOcorrencias();
        }
    }
}

function aplicarFiltroAbas(botao) {
    botoesFiltro.forEach(b => b.classList.remove('ativo'));
    botao.classList.add('ativo');
    filtroAtual = botao.getAttribute('data-filtro');
    renderizarTarefas();
}

function renderizarTarefas() {
    listaTarefas.innerHTML = '';

    let filtradas = tarefas.filter(tarefa => {
        if (filtroAtual === 'pendentes') return !tarefa.concluida;
        if (filtroAtual === 'concluidas') return tarefa.concluida;
        return true;
    });

    if (termoBusca !== '') {
        filtradas = filtradas.filter(tarefa => 
            tarefa.texto.toLowerCase().includes(termoBusca.toLowerCase()) ||
            tarefa.codigo.toLowerCase().includes(termoBusca.toLowerCase()) ||
            tarefa.equipe.toLowerCase().includes(termoBusca.toLowerCase())
        );
    }

    if (filtradas.length === 0) {
        listaTarefas.innerHTML = '<p style="text-align:center; color:#475569; margin-top:20px; font-family:monospace;">Nenhum registro encontrado no log.</p>';
    } else {
        filtradas.forEach(tarefa => {
            const li = document.createElement('li');
            if (tarefa.concluida) li.classList.add('concluida');
            if (!tarefa.concluida && tarefa.prioridade === 'Emergência') li.classList.add('emergencia');

            let formatPrioridade = tarefa.prioridade.toLowerCase().replace('ç', 'c').replace('ê', 'e');

            li.innerHTML = `
                <div class="info-tarefa">
                    <div class="cabecalho-registro">
                        <span>${tarefa.dataCriacao}</span>
                        <span>|</span>
                        <span>${tarefa.codigo}</span>
                    </div>
                    <span class="texto-tarefa">${tarefa.texto}</span>
                    <div class="badges">
                        <span class="badge bg-${formatPrioridade}">${tarefa.prioridade}</span>
                        ${tarefa.local !== 'Sem Local' ? `<span class="badge bg-local">📍 ${tarefa.local}</span>` : ''}
                        <span class="badge bg-equipe">📻 ${tarefa.equipe}</span>
                    </div>
                </div>
                <div class="acoes">
                    <button class="btn-concluir" onclick="alternarStatus(${tarefa.id}, ${tarefa.concluida})" title="Alterar Status">
                        ${tarefa.concluida ? 'REABRIR' : 'RESOLVIDO'}
                    </button>
                    <button class="btn-excluir" onclick="excluirTarefa(${tarefa.id})" title="Expurgar">X</button>
                </div>
            `;
            listaTarefas.appendChild(li);
        });
    }
    atualizarEstatisticas();
}

btnAdicionar.addEventListener('click', adicionarTarefa);

inputTarefa.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') adicionarTarefa();
});

inputBusca.addEventListener('input', (e) => {
    termoBusca = e.target.value;
    renderizarTarefas();
});

botoesFiltro.forEach(botao => {
    botao.addEventListener('click', () => aplicarFiltroAbas(botao));
});

btnImprimir.addEventListener('click', () => {
    window.print();
});

// Inicialização trazendo os dados da nuvem na abertura da página
carregarOcorrencias();