'use client';

import { useEffect, useMemo, useState } from "react";
import { PosicaoMatriz, Usuario } from "../Dashboard";
import { Download, FileSpreadsheet, Search, X } from "lucide-react";

interface PlanilhaAtribuicoesProps {
  usuarios: Usuario[];
  posicoes: PosicaoMatriz[];
  mostrarFeedback: (texto: string, tipo: 'sucesso' | 'erro' | 'info') => void;
}

export default function PlanilhaAtribuicoes({ usuarios, posicoes, mostrarFeedback }: PlanilhaAtribuicoesProps) {
  const [buscaPlanilha, setBuscaPlanilha] = useState('');

  // Geração e ordenação dos dados para exibição nas 3 colunas (Funcionário, Setor, Matriz)
  const linhasPlanilha = useMemo(() => {
    const linhas: { nome: string; setor: string; posicao: string }[] = [];

    // 1. Mapeia estritamente todas as posições da matriz de 0 a 64 em ordem numérica crescente
    const posicoesOrdenadas = [...posicoes].sort((a, b) => a.numero - b.numero);

    posicoesOrdenadas.forEach(pos => {
      const user = pos.usuarioId ? usuarios.find(u => u.id === pos.usuarioId) : null;
      linhas.push({
        nome: user ? user.nome : "", // Se não houver funcionário, fica vazio
        setor: user?.setor || '',
        posicao: String(pos.numero).padStart(2, '0') // Exibe apenas o número formatado com padStart
      });
    });

    // 2. Mapeia e adiciona no final os usuários cadastrados que NÃO possuem nenhuma posição atribuída
    const usuariosSemMatriz = usuarios
      .filter(user => !posicoes.some(p => p.usuarioId === user.id))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    usuariosSemMatriz.forEach(user => {
      linhas.push({
        nome: user.nome,
        setor: user?.setor || '',
        posicao: "" // Sem matriz -> Deixa vazio
      });
    });

    // Filtro de pesquisa opcional por texto na planilha
    if (buscaPlanilha.trim()) {
      const busca = buscaPlanilha.toLowerCase();
      return linhas.filter(l =>
        l.nome.toLowerCase().includes(busca) ||
        l.posicao.toLowerCase().includes(busca)
      );
    }

    return linhas;
  }, [usuarios, posicoes, buscaPlanilha]);

  const handleExportarXLSX = () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
    <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
      <Worksheet ss:Name="Matriz">
        <Table>
          <Row>
            <Cell><Data ss:Type="String">Funcionário</Data></Cell>
            <Cell><Data ss:Type="String">Setor</Data></Cell>
            <Cell><Data ss:Type="String">Matriz</Data></Cell>
          </Row>
          ${linhasPlanilha.map(l => `
          <Row>
            <Cell><Data ss:Type="String">${l.nome}</Data></Cell>
            <Cell><Data ss:Type="String">${l.setor}</Data></Cell>
            <Cell><Data ss:Type="String">${l.posicao}</Data></Cell>
          </Row>`).join("")}
        </Table>
      </Worksheet>
    </Workbook>`;

    const agora = new Date();

    // Formato brasileiro com horário de Brasília
    const dataBrasil = agora.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour12: false // Opcional: usa formato 24 horas
    });

    const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `controle_matriz_${dataBrasil}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarFeedback("Arquivo Excel gerado com sucesso!", "sucesso");
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Cabeçalho da Planilha */}
      <div className="p-6 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-950">Planilha de Matrizes</h2>
            <p className="text-xs text-slate-500">Mapeamento estruturado de usuário/matriz</p>
          </div>
        </div>

        {/* Ações da Planilha */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* Barra de Pesquisa Rápida na Planilha */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar na planilha..."
              value={buscaPlanilha}
              onChange={(e) => setBuscaPlanilha(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-hidden"
            />
            {buscaPlanilha && (
              <button
                onClick={() => setBuscaPlanilha('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Botão de Exportar para XLSX */}
          <button
            onClick={handleExportarXLSX}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs shrink-0 cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            Exportar para XLSX
          </button>
        </div>
      </div>

      {/* Tabela do Tipo Planilha - 3 Colunas Exatas (Funcionário, Setor, Matriz) */}
      <div className="overflow-x-auto">
        <div className="max-h-[350px] overflow-y-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-100/85 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10">
                <th className="py-2.5 px-6 w-1/3">Funcionário</th>
                <th className="py-2.5 px-6 w-1/3">Setor</th>
                <th className="py-2.5 px-6 w-1/3">Matriz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {linhasPlanilha.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-slate-400 font-sans">
                    Nenhum registro encontrado na planilha.
                  </td>
                </tr>
              ) : (
                linhasPlanilha.map((linha, index) => (
                  <tr
                    key={`${linha.nome}-${linha.posicao}-${index}`}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    {/* Coluna 1: Funcionário */}
                    <td className="py-2.5 px-6 font-semibold font-sans text-slate-900 truncate">
                      {linha.nome}
                    </td>

                    {/* Coluna 2: Setor */}
                    <td className="py-2.5 px-6 font-sans text-slate-400">
                      {linha.setor}
                    </td>

                    {/* Coluna 3: Matriz */}
                    <td className="py-2.5 px-6 font-semibold text-slate-600 font-sans">
                      {linha.posicao}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rodapé informativo */}
      <div className="bg-slate-50 px-6 py-3 flex justify-center items-center gap-2 text-xs text-slate-500 font-medium">
        <span>
          Total de registros listados: <strong className="text-slate-800">{linhasPlanilha.length}</strong>
        </span>
      </div>
    </div>
  );
}
