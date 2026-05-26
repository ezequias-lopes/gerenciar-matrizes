"use client";

import React, { useState, useMemo, useTransition, useEffect } from 'react';
import {
  Users,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Hash,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Database,
  Filter
} from 'lucide-react';
import { adicionarUsuarioAction, atualizarPosicaoAction, obterDadosIniciais, removerUsuarioAction } from '@/lib/actions';

import PlanilhaAtribuicoes from './components/Planilha'

// ==========================================
// SEÇÃO DE SINALIZAÇÃO / DEFINIÇÕES DE TIPOS
// ==========================================

export interface Usuario {
  id: string;
  nome: string;
  setor?: string;
}

export interface PosicaoMatriz {
  numero: number;
  usuarioId: string | null;
}

export default function App() {
  // Estado para controlar se a lista de usuários está aberta (fechada por padrão)
  const [usuariosExpandido, setUsuariosExpandido] = useState(false);

  // Controle de Transição do React para indicar carregamento das Server Actions
  const [isPending, startTransition] = useTransition();

  // Estados locais sincronizados via Actions
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [posicoes, setPosicoes] = useState<PosicaoMatriz[]>([]);
  const [novoUsuarioNome, setNovoUsuarioNome] = useState('');
  const [mensagemFeedback, setMensagemFeedback] = useState<{ texto: string; tipo: 'sucesso' | 'erro' | 'info' } | null>(null);

  const [filtroUsuario, setFiltroUsuario] = useState<string>('todos');

  // Helper de feedback temporário
  const mostrarFeedback = (texto: string, tipo: 'sucesso' | 'erro' | 'info') => {
    setMensagemFeedback({ texto, tipo });
    setTimeout(() => setMensagemFeedback(null), 4000);
  };

  useEffect(() => {
    startTransition(async () => {
      try {
        const db = await obterDadosIniciais();

        const usuariosPadrao = db.usuarios || [
          { id: '1', nome: 'Dados Não Carregados' },
        ];

        const posicoesPadrao: PosicaoMatriz[] = Array.from(
          { length: 67 },
          (_, i) => {
            return (
              db.posicoes.find(p => p.numero === i) || {
                numero: i + 1,
                usuarioId: null
              }
            );
          }
        ).filter(n => n.numero != 0);

        setUsuarios(ordenarUsuariosAlfabeticamente(usuariosPadrao));
        setPosicoes(posicoesPadrao);

      } catch (err) {
        mostrarFeedback('Falha ao salvar o usuário no banco de dados.', 'erro');
      }
    });
  }, []);

  // Persistência local utilitária para manter dados ao atualizar a página do preview


  // 1. Adicionar Usuário (Chama a Server Action no Servidor)
  const handleAdicionarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    const nomeLimpo = novoUsuarioNome.trim();
    if (!nomeLimpo) {
      mostrarFeedback('Por favor, introduza um nome válido.', 'erro');
      return;
    }

    if (usuarios.some(u => u.nome.toLowerCase() === nomeLimpo.toLowerCase())) {
      mostrarFeedback('Este usuário já existe!', 'erro');
      return;
    }

    // Executa a transição da Action assíncrona
    startTransition(async () => {
      try {
        // Aqui você chamará a Server Action real importada:
        const novoUser = await adicionarUsuarioAction(nomeLimpo);
        const novosUsuarios = [...usuarios, novoUser];

        setUsuarios(novosUsuarios);
        setNovoUsuarioNome('');
        mostrarFeedback(`Usuário "${nomeLimpo}" adicionado e salvo com sucesso!`, 'sucesso');
      } catch (err) {
        mostrarFeedback('Falha ao salvar o usuário no banco de dados.', 'erro');
      }
    });
  };

  // 2. Remover Usuário (Chama a Server Action e atualiza as posições afetadas)
  const handleRemoverUsuario = (id: string, nome: string) => {
    startTransition(async () => {
      try {
        await removerUsuarioAction(id);

        const novosUsuarios = usuarios.filter(u => u.id !== id);
        const novasPosicoes = posicoes.map(p => p.usuarioId === id ? { ...p, usuarioId: null } : p);

        setUsuarios(novosUsuarios);
        setPosicoes(novasPosicoes);

        mostrarFeedback(`Usuário "${nome}" removido do banco.`, 'info');
      } catch (err) {
        mostrarFeedback('Erro ao sincronizar remoção no banco.', 'erro');
      }
    });
  };

  // 3. Atualizar Posição na Tabela (Chama a Server Action individualmente por slot)
  const handleAlterarPosicao = (numeroPosicao: number, usuarioIdSelecionado: string) => {
    const destinoId = usuarioIdSelecionado === 'livre' ? null : usuarioIdSelecionado;

    startTransition(async () => {
      try {
        await atualizarPosicaoAction(numeroPosicao, destinoId);

        const novasPosicoes = posicoes.map(p =>
          p.numero === numeroPosicao ? { ...p, usuarioId: destinoId } : p
        );

        setPosicoes(novasPosicoes);
        mostrarFeedback(`Posição ${numeroPosicao} atualizada no banco.`, 'sucesso');
      } catch (err) {
        mostrarFeedback('Erro ao atualizar posição no banco de dados.', 'erro');
      }
    });
  };

const ordenarUsuariosAlfabeticamente = (lista: Usuario[]) => {
  return [...lista].sort((a, b) =>
    a.nome.localeCompare(b.nome, 'pt-BR', {
      sensitivity: 'base'
    })
  );
};

  // --- REGRAS DE NEGÓCIO E DETECÇÃO DE CONFLITO EM TEMPO REAL ---

  const contagemPorUsuario = useMemo(() => {
    const contagem: Record<string, number> = {};
    usuarios.forEach(u => { contagem[u.id] = 0; });
    posicoes.forEach(p => {
      if (p.usuarioId && contagem[p.usuarioId] !== undefined) {
        contagem[p.usuarioId]++;
      }
    });
    return contagem;
  }, [usuarios, posicoes]);

  const usuariosEmConflito = useMemo(() => {
    const conflitos = new Set<string>();
    Object.entries(contagemPorUsuario).forEach(([id, qtd]) => {
      if (qtd > 1) conflitos.add(id);
    });
    return conflitos;
  }, [contagemPorUsuario]);

  const totalAtribuidas = posicoes.filter(p => p.usuarioId !== null).length;
  const totalLivres = posicoes.filter(p => p.usuarioId === null).length;
  const totalConflitos = Array.from(usuariosEmConflito).length;
  const temAlgumConflito = totalConflitos > 0;

  const posicoesFiltradas = useMemo(() => {
    return posicoes.filter(pos => {
      if (filtroUsuario === 'todos') {
        return true;
      }
      if (filtroUsuario === 'livres') {
        return pos.usuarioId === null;
      }
      // Filtra pelo id específico do usuário
      return pos.usuarioId === filtroUsuario;
    });
  }, [posicoes, filtroUsuario]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans antialiased pb-12">

      {/* Cabeçalho Simplificado (Apenas o Título) */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
              M
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Controle de Matriz
              </h1>
            </div>
          </div>

          {/* Indicador visual de carregamento de Server Action */}
          {isPending && (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-xs text-blue-600 font-medium animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
              <span>Sincronizando Banco...</span>
            </div>
          )}
        </div>
      </header>

      {/* Mensagem Flutuante de Sucesso / Erro */}
      {mensagemFeedback && (
        <div className="fixed bottom-5 right-5 z-50 transition-all duration-300">
          <div className={`px-4 py-3 rounded-xl shadow-lg border flex items-center gap-2 text-sm font-medium ${mensagemFeedback.tipo === 'sucesso' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
            mensagemFeedback.tipo === 'erro' ? 'bg-rose-50 border-rose-200 text-rose-800' :
              'bg-sky-50 border-sky-200 text-sky-800'
            }`}>
            {mensagemFeedback.tipo === 'sucesso' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
            {mensagemFeedback.tipo === 'erro' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
            <span>{mensagemFeedback.texto}</span>
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* COLUNA ESQUERDA: LISTA DE USUÁRIOS (FECHADA POR PADRÃO) */}
          <div className="lg:col-span-4 space-y-4">

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
              {/* Cabeçalho do Card Expansível */}
              <button
                onClick={() => setUsuariosExpandido(!usuariosExpandido)}
                className="w-full flex justify-between items-center focus:outline-hidden group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-50 text-slate-600 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      Usuários
                      <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                        {usuarios.length}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">Clique para {usuariosExpandido ? 'fechar' : 'gerenciar'}</p>
                  </div>
                </div>
                <div>
                  {usuariosExpandido ? (
                    <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  )}
                </div>
              </button>

              {/* Corpo Expansível */}
              {usuariosExpandido && (
                <div className="mt-5 pt-4 border-t border-slate-100 space-y-4 animate-fadeIn">

                  {/* Formulário de Adicionar */}
                  <form onSubmit={handleAdicionarUsuario} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nome do usuário..."
                      value={novoUsuarioNome}
                      onChange={(e) => setNovoUsuarioNome(e.target.value)}
                      disabled={isPending}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors flex items-center gap-1 shrink-0 shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </button>
                  </form>

                  {/* Lista de Usuários cadastrados */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {usuarios.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs border-2 border-dashed border-slate-100 rounded-xl">
                        Nenhum usuário cadastrado.
                      </div>
                    ) : (
                      usuarios.map((user) => {
                        const totalPosicoesUser = contagemPorUsuario[user.id] || 0;
                        const emConflito = usuariosEmConflito.has(user.id);

                        return (
                          <div
                            key={user.id}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${emConflito
                              ? 'bg-rose-50/70 border-rose-100 text-rose-900'
                              : 'bg-slate-50/70 border-slate-100 text-slate-800'
                              }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${emConflito ? 'bg-rose-500 text-white' : 'bg-blue-600 text-white'
                                }`}>
                                {user.nome.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-sm truncate">{user.nome}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${emConflito
                                ? 'bg-rose-100 text-rose-700'
                                : totalPosicoesUser > 0
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'bg-slate-200/60 text-slate-500'
                                }`}>
                                {totalPosicoesUser} {totalPosicoesUser === 1 ? 'pos' : 'pos'}
                              </span>
                              <button
                                onClick={() => handleRemoverUsuario(user.id, user.nome)}
                                disabled={isPending}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors disabled:opacity-50"
                                title="Remover usuário"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {!usuariosExpandido && (
              <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 font-medium flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500 shrink-0" />
                <span>Gerenciador de usuários fechado. Toque para gerenciar.</span>
              </div>
            )}
          </div>

          {/* COLUNA DIREITA: TABELA DE MATRIZES */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">

              {/* Cabeçalho da Tabela */}
              <div className="p-5 border-b border-slate-100 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Tabela de Matrizes</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Posições 0 — 67</p>
                  </div>

                  {/* Badges de Contagem de Atribuições */}
                  <div className="grid grid-cols-3 gap-2 border border-slate-100 rounded-xl p-1 bg-slate-50/50 text-center max-w-sm shrink-0">
                    <div className="px-3 py-1.5">
                      <div className="text-base font-bold text-slate-900">{totalAtribuidas}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Atribuídas</div>
                    </div>
                    <div className="px-3 py-1.5 border-x border-slate-200">
                      <div className="text-base font-bold text-slate-600">{totalLivres}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Livres</div>
                    </div>
                    <div className="px-3 py-1.5">
                      <div className={`text-base font-bold ${temAlgumConflito ? 'text-rose-600' : 'text-slate-400'}`}>
                        {totalConflitos}
                      </div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Conflitos</div>
                    </div>
                  </div>
                </div>

                {/* FILTRO DE PESQUISA */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <span>Filtrar tabela:</span>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full">
                    {/* Botão para Todos */}
                    <button
                      onClick={() => setFiltroUsuario('todos')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${filtroUsuario === 'todos'
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                    >
                      Todos ({posicoes.length})
                    </button>

                    {/* Botão para Livres */}
                    <button
                      onClick={() => setFiltroUsuario('livres')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${filtroUsuario === 'livres'
                        ? 'bg-slate-700 border-slate-700 text-white'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                    >
                      Livres ({totalLivres})
                    </button>

                    {/* Dropdown de Filtragem por Usuário Específico */}
                    <div className="relative">
                      <select
                        value={['todos', 'livres'].includes(filtroUsuario) ? 'selecionar' : filtroUsuario}
                        onChange={(e) => {
                          if (e.target.value !== 'selecionar') {
                            setFiltroUsuario(e.target.value);
                          }
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all ${!['todos', 'livres'].includes(filtroUsuario)
                          ? 'border-blue-600 text-blue-700 font-bold'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                      >
                        <option value="selecionar" disabled>Filtrar por Usuário...</option>
                        {usuarios.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.nome} ({contagemPorUsuario[u.id] || 0})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Botão para limpar filtro rápido quando um usuário está selecionado */}
                    {!['todos', 'livres'].includes(filtroUsuario) && (
                      <button
                        onClick={() => setFiltroUsuario('todos')}
                        className="p-1.5 text-xs rounded-lg hover:bg-slate-100 text-rose-500 font-semibold flex items-center gap-1 transition-colors"
                        title="Limpar filtro de usuário"
                      >
                        <X className="w-3.5 h-3.5" />
                        Limpar
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* Tabela Interativa de Posições */}
              <div className="overflow-x-auto">
                <div className="max-h-[500px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                        <th className="py-3 px-6 w-24">Posição</th>
                        <th className="py-3 px-6">Usuário</th>
                        <th className="py-3 px-6 w-32">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {posicoesFiltradas.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-12 text-center text-slate-400 text-sm font-medium">
                            Nenhuma posição corresponde ao filtro selecionado.
                          </td>
                        </tr>
                      ) : (
                        posicoesFiltradas.map((pos) => {
                          const estaLivre = pos.usuarioId === null;
                          const emConflito = !estaLivre && usuariosEmConflito.has(pos.usuarioId!);
                          const estaAtribuidaUnica = !estaLivre && !emConflito;

                          let corLinha = 'hover:bg-slate-50/80';
                          if (emConflito) {
                            corLinha = 'bg-rose-50/60 hover:bg-rose-50 text-rose-900';
                          } else if (estaAtribuidaUnica) {
                            corLinha = 'bg-emerald-50/50 hover:bg-emerald-50 text-slate-800';
                          }

                          return (
                            <tr
                              key={pos.numero}
                              className={`transition-colors text-sm ${corLinha}`}
                            >
                              {/* Posição */}
                              <td className="py-3.5 px-6 font-semibold">
                                <span className={`inline-flex items-center gap-1 ${emConflito ? 'text-rose-700' : estaAtribuidaUnica ? 'text-emerald-700' : 'text-slate-600'
                                  }`}>
                                  <Hash className="w-3.5 h-3.5 opacity-60" />
                                  {pos.numero}
                                </span>
                              </td>

                              {/* Seletor */}
                              <td className="py-3.5 px-6">
                                <select
                                  value={pos.usuarioId || 'livre'}
                                  disabled={isPending}
                                  onChange={(e) => handleAlterarPosicao(pos.numero, e.target.value)}
                                  className={`w-full max-w-xs bg-white border rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 transition-all ${emConflito
                                    ? 'border-rose-300 text-rose-800 focus:border-rose-500'
                                    : estaAtribuidaUnica
                                      ? 'border-emerald-200 text-emerald-800 focus:border-emerald-500'
                                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                                    }`}
                                >
                                  <option value="livre">VAZIO</option>
                                  {usuarios.map(u => (
                                    <option key={u.id} value={u.id}>{u.nome}</option>
                                  ))}
                                </select>
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-6">
                                {estaLivre && (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200/50">
                                    Livre
                                  </span>
                                )}
                                {estaAtribuidaUnica && (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200/50">
                                    OK
                                  </span>
                                )}
                                {emConflito && (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200/50 animate-pulse">
                                    Conflito
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rodapé da tabela */}
              <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-center text-xs text-slate-400 font-medium">
                Mostrando {posicoesFiltradas.length} de {posicoes.length} posições.
              </div>

            </div>
          </div>

        </div>

        
        {/* INSTÂNCIA DO COMPONENTE DE PLANILHA EXTRAÍDO */}
        <PlanilhaAtribuicoes 
          usuarios={usuarios} 
          posicoes={posicoes} 
          mostrarFeedback={mostrarFeedback} 
        />
      </main>
    </div>
  );
}