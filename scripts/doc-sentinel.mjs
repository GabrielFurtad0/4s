#!/usr/bin/env node
/**
 * TotalTrigo 4S ERP - Doc Sentinel (Agente Autônomo de Documentação)
 *
 * Disparado via Git Hook (post-commit) ou manualmente.
 * Analisa o tamanho e o impacto das mudanças no último commit (frontend e backend).
 *
 * Níveis de Impacto:
 * - Nível 0 (Mínimo / Cosmético, < 25 linhas sem impacto em schemas/APIs): Ignora (Custo 0).
 * - Nível 1 (Médio, 25-100 linhas ou componentes UI): Atualiza docs/CHANGELOG.md.
 * - Nível 2 (Estrutural / Crítico, migrations SQL, modelos, regras em business.ts, rotas):
 *           Atualiza docs/CHANGELOG.md e sinaliza/atualiza docs/REGRAS_DE_NEGOCIO_E_FISCAL.md.
 *
 * Integração com Gemini Flash:
 * - Se GEMINI_API_KEY estiver definida (no ambiente ou em .env), utiliza a API do Gemini Flash
 *   para redigir notas de documentação técnicas e sintéticas.
 * - Caso contrário, utiliza o motor heurístico local offline com 100% de confiabilidade.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// 1. Carrega variáveis de .env se existir (sem dependências externas)
function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length > 0 && !process.env[key.trim()]) {
          process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch (e) {
      // Ignora erro de leitura do .env
    }
  }
}

loadEnv();

function runGit(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return null;
  }
}

async function main() {
  console.log('\n[DocSentinel] 🛡️  Verificando último commit para atualização documental...');

  // 1. Evita loops infinitos de commits de documentação
  const lastCommitMsg = runGit('git log -1 --pretty=%B') || '';
  const lastCommitHash = runGit('git log -1 --pretty=%h') || '';
  const authorName = runGit('git log -1 --pretty=%an') || '';

  if (lastCommitMsg.includes('[skip-doc]') || lastCommitMsg.startsWith('docs(auto):') || lastCommitMsg.startsWith('docs: auto-update')) {
    console.log('[DocSentinel] ⏭️  Commit gerado pelo próprio sentinela ou marcado com [skip-doc]. Nenhuma ação necessária.');
    return;
  }

  // 2. Coleta arquivos alterados no último commit
  const nameStatusRaw = runGit('git diff-tree --no-commit-id --name-status -r HEAD');
  if (!nameStatusRaw) {
    console.log('[DocSentinel] ⚠️  Não foi possível obter a lista de arquivos do commit.');
    return;
  }

  const fileLines = nameStatusRaw.split('\n').filter(Boolean);
  const changedFiles = [];
  for (const line of fileLines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      changedFiles.push({ status: parts[0], path: parts[1] });
    }
  }

  // 3. Filtra apenas arquivos de código (ignora documentação, logs, imagens, builds, locks)
  const ignoredPatterns = [
    /^docs\//,
    /\.md$/i,
    /\.png$/i,
    /\.jpg$/i,
    /\.svg$/i,
    /package-lock\.json$/,
    /\.git\//,
    /\.output\//,
    /target\//,
    /node_modules\//,
    /\.log$/
  ];

  const sourceFiles = changedFiles.filter(f => !ignoredPatterns.some(p => p.test(f.path)));

  if (sourceFiles.length === 0) {
    console.log('[DocSentinel] ℹ️  O commit alterou apenas documentação, mídias ou arquivos auxiliares. Nada a sincronizar.');
    return;
  }

  // 4. Calcula total de linhas alteradas (adições e remoções)
  const numStatRaw = runGit('git diff-tree --no-commit-id --numstat -r HEAD') || '';
  let totalAdded = 0;
  let totalDeleted = 0;
  const sourceStats = [];

  for (const line of numStatRaw.split('\n').filter(Boolean)) {
    const [added, deleted, filePath] = line.trim().split(/\s+/);
    if (!filePath || ignoredPatterns.some(p => p.test(filePath))) continue;

    const addNum = parseInt(added, 10) || 0;
    const delNum = parseInt(deleted, 10) || 0;
    totalAdded += addNum;
    totalDeleted += delNum;
    sourceStats.push({ file: filePath, added: addNum, deleted: delNum });
  }

  const totalLinesChanged = totalAdded + totalDeleted;

  // 5. Detecta se há arquivos de alta criticidade estrutural
  const isStructuralOrCritical = sourceFiles.some(f => {
    const p = f.path;
    return (
      p.endsWith('.sql') ||
      p.includes('domain/model/') ||
      p.includes('business.ts') ||
      p.includes('FocusNfe') ||
      p.includes('FiscalDocument') ||
      p.includes('application') ||
      p.includes('Dockerfile') ||
      p.includes('docker-compose')
    );
  });

  // 6. Define o Nível de Impacto
  let level = 0;
  let levelDescription = '';

  if (totalLinesChanged < 25 && !isStructuralOrCritical) {
    level = 0;
    levelDescription = 'Nível 0 (Mínimo / Cosmético - sem impacto arquitetural)';
  } else if (!isStructuralOrCritical && totalLinesChanged <= 100) {
    level = 1;
    levelDescription = 'Nível 1 (Médio - ajustes de interface ou lógica pontual)';
  } else {
    level = 2;
    levelDescription = 'Nível 2 (Estrutural / Crítico - regras fiscais, domínio, banco ou grande volume)';
  }

  console.log(`[DocSentinel] 📊 Estatísticas: ${sourceFiles.length} arquivos fonte, +${totalAdded}/-${totalDeleted} linhas.`);
  console.log(`[DocSentinel] 🔍 Classificação: ${levelDescription}`);

  if (level === 0) {
    console.log('[DocSentinel] ✅ Mudança pequena/cosmética. Nenhuma alteração documental disparada.');
    return;
  }

  // 7. Gera o resumo da mudança (via Gemini Flash ou Motor Heurístico)
  const diffSnippet = runGit('git diff HEAD~1 HEAD -- "*.java" "*.ts" "*.tsx" "*.sql" "*.yml"') || '';
  const truncatedDiff = diffSnippet.slice(0, 10000); // limita a 10k chars para economia de tokens

  const docSummary = await generateDocSummary({
    hash: lastCommitHash,
    message: lastCommitMsg,
    author: authorName,
    stats: sourceStats,
    level,
    diff: truncatedDiff
  });

  // 8. Atualiza docs/CHANGELOG.md
  updateChangelog(docSummary, lastCommitHash, level);

  // 9. Se for Nível 2, registra alerta no histórico de regras de negócio
  if (level === 2 && sourceFiles.some(f => f.path.includes('business.ts') || f.path.endsWith('.sql') || f.path.includes('domain/model/'))) {
    updateBusinessRulesLog(docSummary, lastCommitHash);
  }

  // 10. Commit automático das alterações documentais
  try {
    const statusDocs = runGit('git status --porcelain docs/');
    if (statusDocs) {
      runGit('git add docs/');
      runGit(`git commit -m "docs(auto): atualizar documentacao conforme commit ${lastCommitHash} [skip-doc]"`);
      console.log(`[DocSentinel] 🎉 Documentação atualizada e commitada com sucesso! (commit docs(auto) [skip-doc])\n`);
    } else {
      console.log('[DocSentinel] ℹ️  Documentação já estava atualizada.\n');
    }
  } catch (err) {
    console.warn('[DocSentinel] ⚠️  Não foi possível commitar a documentação automaticamente:', err.message);
  }
}

/**
 * Gera o texto do resumo usando a API do Gemini Flash se disponível,
 * ou recorre ao motor heurístico local sem custo e sem rede.
 */
async function generateDocSummary({ hash, message, author, stats, level, diff }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      console.log('[DocSentinel] 🤖 Solicitando síntese documental à API do Gemini Flash...');
      const prompt = `Você é o Sentinel de Documentação Técnica do sistema TotalTrigo 4S ERP.
Analise o commit e o diff a seguir e gere um resumo conciso (em Markdown) para o CHANGELOG da empresa.

Regras Estritas:
1. Nomenclatura Discreta: Use exclusivamente "dispatchQuantity" (DQ / Qtd. Expedição) e "baseQuantity" (BQ / Qtd. Base). NUNCA use termos fiscais vulgares.
2. Seja direto e objetivo (máximo 4 bullets). Destaque o que mudou no frontend ou backend e o impacto operacional.
3. Não use floreios ou introduções. Apenas os tópicos em formato Markdown.

Dados do Commit:
- Hash: ${hash}
- Mensagem: ${message}
- Nível de Impacto: ${level}
- Arquivos modificados: ${stats.map(s => `${s.file} (+${s.added}/-${s.deleted})`).join(', ')}

Diff resumido:
\`\`\`diff
${diff.slice(0, 4000)}
\`\`\`
`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500,
          }
        })
      });

      if (response.ok) {
        const json = await response.json();
        const candidateText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidateText && candidateText.trim()) {
          console.log('[DocSentinel] ✨ Síntese gerada com sucesso via Gemini Flash.');
          return candidateText.trim();
        }
      } else {
        console.warn(`[DocSentinel] ⚠️  API Gemini retornou status ${response.status}. Usando motor heurístico.`);
      }
    } catch (e) {
      console.warn('[DocSentinel] ⚠️  Falha na requisição Gemini Flash:', e.message, '. Usando motor heurístico.');
    }
  } else {
    console.log('[DocSentinel] 💡 GEMINI_API_KEY não encontrada no ambiente/.env. Utilizando síntese heurística local (R$ 0,00).');
  }

  // Motor Heurístico Local (Offline / Gratuito)
  const bullets = [];
  bullets.push(`- **Escopo**: ${message.split('\n')[0]}`);
  
  const topFiles = stats.slice(0, 3).map(s => `\`${path.basename(s.file)}\``).join(', ');
  bullets.push(`- **Componentes afetados**: ${topFiles}${stats.length > 3 ? ` e mais ${stats.length - 3} arquivo(s)` : ''}.`);

  const hasBackend = stats.some(s => s.file.startsWith('backend/'));
  const hasFrontend = stats.some(s => s.file.startsWith('frontend/'));
  if (hasBackend && hasFrontend) {
    bullets.push(`- **Camadas**: Integração Full-Stack (Backend API Spring Boot + Frontend React/TanStack).`);
  } else if (hasBackend) {
    bullets.push(`- **Camada**: Backend Spring Boot / Banco de Dados.`);
  } else if (hasFrontend) {
    bullets.push(`- **Camada**: Interface do Usuário / Frontend TanStack Start.`);
  }

  return bullets.join('\n');
}

/**
 * Atualiza o arquivo docs/CHANGELOG.md
 */
function updateChangelog(summaryText, commitHash, level) {
  const changelogPath = path.join(ROOT_DIR, 'docs', 'CHANGELOG.md');
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const badge = level === 2 ? '🔴 Estrutural / Crítico' : '🟡 Médio / Feature';

  const entry = `\n### [${commitHash}] — ${dateStr} às ${timeStr} (${badge})\n\n${summaryText}\n`;

  if (!fs.existsSync(changelogPath)) {
    const initialContent = `# 📜 Histórico de Alterações (CHANGELOG) — TotalTrigo 4S ERP\n\nRegistro automatizado e sincronizado pelo **Doc Sentinel** a cada commit relevante no repositório.\n\n---\n`;
    fs.writeFileSync(changelogPath, initialContent + entry, 'utf8');
  } else {
    const existing = fs.readFileSync(changelogPath, 'utf8');
    const headerMarker = '---\n';
    const splitIndex = existing.indexOf(headerMarker);
    if (splitIndex !== -1) {
      const top = existing.slice(0, splitIndex + headerMarker.length);
      const rest = existing.slice(splitIndex + headerMarker.length);
      fs.writeFileSync(changelogPath, top + entry + rest, 'utf8');
    } else {
      fs.writeFileSync(changelogPath, existing + '\n' + entry, 'utf8');
    }
  }
}

/**
 * Registra nota no histórico de regras de negócio caso afete o domínio
 */
function updateBusinessRulesLog(summaryText, commitHash) {
  const rulesPath = path.join(ROOT_DIR, 'docs', 'REGRAS_DE_NEGOCIO_E_FISCAL.md');
  if (!fs.existsSync(rulesPath)) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');

  const note = `\n> [!NOTE] Atualização Automática (${dateStr} · Commit \`${commitHash}\`):\n> Modificações estruturais registradas no domínio/banco. Consulte o [CHANGELOG](file:///docs/CHANGELOG.md) para detalhes.\n`;

  try {
    const content = fs.readFileSync(rulesPath, 'utf8');
    if (!content.includes(commitHash)) {
      fs.appendFileSync(rulesPath, note, 'utf8');
    }
  } catch (err) {
    // Ignora
  }
}

main().catch(err => {
  console.error('[DocSentinel] ❌ Erro inesperado na execução:', err);
  process.exit(0); // Não bloqueia o commit caso haja erro no sentinela
});
