"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "./prisma";

interface Usuario {
  id: string;
  nome: string;
}

interface PosicaoMatriz {
  numero: number;
  usuarioId: string | null;
}

/**
 * Procura todos os utilizadores e posições de matriz no MongoDB.
 * Ideal para ser chamado diretamente no Server Component para o carregamento inicial.
 */
export async function obterDadosIniciais() {
  try {
    const usuariosDb = await prisma.usuario.findMany();
    const posicoesDb = await prisma.posicao.findMany({
      orderBy: { numero: "asc" },
    });


    // Mapeia os dados obtidos do MongoDB para as interfaces do frontend
    const usuarios: Usuario[] = usuariosDb

    // Garante que todas as 65 posições (0 a 64) estejam representadas
    const posicoesMap = new Map(posicoesDb.map((p: { numero: number, usuarioId: string | null }) => [p.numero, p.usuarioId]));
    const posicoes: PosicaoMatriz[] = [];

    for (let i = 0; i <= 68; i++) {
      posicoes.push({
        numero: i,
        usuarioId: posicoesMap.get(i) as string || null,
      });
    }

    return { usuarios, posicoes };
  } catch (error) {
    console.error("Erro ao obter dados iniciais do banco:", error);
    throw new Error("Erro ao carregar dados do servidor.");
  }
}

/**
 * Adiciona um novo utilizador no MongoDB utilizando o Prisma.
 */
export async function adicionarUsuarioAction(nome: string): Promise<Usuario> {
  try {
    const novoUsuario = await prisma.usuario.create({
      data: {
        nome: nome.trim(),
      },
    });

    // Revalida o caminho para atualizar todos os Server Components que dependem destes dados
    revalidatePath("/");

    return {
      id: novoUsuario.id,
      nome: novoUsuario.nome,
    };
  } catch (error) {
    console.error("Erro ao adicionar utilizador no banco:", error);
    throw new Error("Não foi possível criar o utilizador.");
  }
}

/**
 * Remove um utilizador do MongoDB e limpa automaticamente todas as suas atribuições na matriz.
 */
export async function removerUsuarioAction(id: string): Promise<boolean> {
  try {
    // Usamos uma transação para garantir consistência e segurança na eliminação
    await prisma.$transaction([
      // 1. Remove a referência do utilizador em todas as posições
      prisma.posicao.updateMany({
        where: { usuarioId: id },
        data: { usuarioId: null },
      }),
      // 2. Remove o utilizador
      prisma.usuario.delete({
        where: { id },
      }),
    ]);

    revalidatePath("/");
    return true;
  } catch (error) {
    console.error("Erro ao remover utilizador no banco:", error);
    throw new Error("Falha ao eliminar o utilizador.");
  }
}

/**
 * Atualiza ou insere o estado de ocupação de uma determinada posição da matriz (0 a 64).
 */
export async function atualizarPosicaoAction(
  numero: number,
  usuarioId: string | null
): Promise<boolean> {
  try {
    // Upsert garante que se a posição não existir no banco, ela é criada instantaneamente
    await prisma.posicao.upsert({
      where: { numero },
      update: { usuarioId },
      create: { numero, usuarioId },
    });

    revalidatePath("/");
    return true;
  } catch (error) {
    console.error(`Erro ao atualizar posição ${numero} no banco:`, error);
    throw new Error("Erro ao salvar posição.");
  }
}