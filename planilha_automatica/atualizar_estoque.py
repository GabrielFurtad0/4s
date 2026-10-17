import os
import sys

# Garante suporte a UTF-8 no Windows
if sys.platform == "win32":
    try:
        if sys.stdout.encoding.lower() != "utf-8":
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if sys.stderr.encoding.lower() != "utf-8":
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import json
import glob
from pathlib import Path
from typing import List, Dict, Any
from collections import defaultdict

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
import openpyxl

from nfe_parser import parse_nfe_xml
from excel_updater import (
    criar_backup,
    mapear_aba_produto,
    analisar_bloco_mes_ativo,
    inserir_lancamento_saida,
    criar_cabecalho_novo_mes,
    normalizar_nf
)
from zip_manager import verificar_e_extrair_zips

console = Console(legacy_windows=False)
CONFIG_FILE = "config.json"

def carregar_config() -> Dict[str, Any]:
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "caminho_planilha": "Planilha de Estoques.xlsx",
        "pasta_notas": "notas",
        "pasta_backups": "backups",
        "pastas_zips": ["zips", "notas", "."],
        "mapeamento_abas": [
            {
                "aba": "FARINHA DE TRIGO",
                "codigos": ["05", "5"],
                "palavras_chave": ["tipo 1", "tipo1", "farinha de trigo tipo 1"]
            },
            {
                "aba": "PRE MISTURA",
                "codigos": ["02", "2"],
                "palavras_chave": ["pre mistura", "pré mistura"],
                "palavras_excluidas": ["doce", "pao doce", "pão doce"]
            },
            {
                "aba": "PM PAO DOCE",
                "codigos": ["03", "3"],
                "palavras_chave": ["pao doce", "pão doce"]
            }
        ]
    }

def main():
    console.print(Panel.fit(
        "[bold cyan]📦 ATUALIZADOR AUTOMÁTICO DE PLANILHA DE ESTOQUE (NF-e)[/bold cyan]\n"
        "[dim]Extração de ZIPs, leitura de XMLs e atualização direta de estoque no Excel[/dim]",
        border_style="cyan"
    ))

    config = carregar_config()
    caminho_planilha = config.get("caminho_planilha", "Planilha de Estoques.xlsx")
    pasta_notas = config.get("pasta_notas", "notas")
    pasta_backups = config.get("pasta_backups", "backups")
    pastas_zips = config.get("pastas_zips", ["zips", "notas", "."])
    regras_mapeamento = config.get("mapeamento_abas", [])

    # ETAPA 1: Verificação e Extração Automática de novos arquivos ZIP
    console.print("[dim]Verificando novos arquivos .zip para extração...[/dim]")
    zips_extraidos, arquivos_novos_zip = verificar_e_extrair_zips(
        pastas_busca=pastas_zips,
        pasta_destino=pasta_notas,
        caminho_historico=os.path.join(pasta_backups, "zips_processados.json")
    )

    if zips_extraidos:
        msg_zips = ""
        for z in zips_extraidos:
            if "erro" in z:
                msg_zips += f" • [red]{z['arquivo']}[/red]: Erro na extração ({z['erro']})\n"
            else:
                msg_zips += f" • [bold green]{z['arquivo']}[/bold green]: [cyan]{z['total_arquivos']}[/cyan] arquivo(s) extraído(s)\n"
        console.print(Panel(
            msg_zips.strip(),
            title="📦 Novos Arquivos ZIP Extraídos para 'notas/'",
            border_style="green"
        ))
    else:
        console.print("ℹ️ [dim]Nenhum novo arquivo .zip pendente de extração.[/dim]\n")

    if not os.path.exists(caminho_planilha):
        console.print(f"[bold red]❌ Arquivo de planilha não encontrado:[/bold red] [yellow]{caminho_planilha}[/yellow]")
        console.print("[dim]Certifique-se de que a planilha está na mesma pasta ou atualize o caminho no config.json.[/dim]")
        sys.exit(1)

    # ETAPA 2: Localização e leitura de XMLs
    padroes = [
        os.path.join(pasta_notas, "**", "*.xml"),
        os.path.join(pasta_notas, "**", "*.XML"),
        os.path.join(pasta_notas, "*.xml"),
        os.path.join(pasta_notas, "*.XML")
    ]
    arquivos_xml = []
    for p in padroes:
        arquivos_xml.extend(glob.glob(p, recursive=True))
    arquivos_xml = sorted(list(dict.fromkeys(arquivos_xml)))

    if not arquivos_xml:
        console.print(f"[yellow]⚠️ Nenhum arquivo .xml encontrado na pasta:[/yellow] [bold]{pasta_notas}[/bold]")
        console.print("[dim]Coloque os arquivos XML ou ZIPs na pasta configurada e execute o script novamente.[/dim]")
        return

    console.print(f"📄 Localizados [bold green]{len(arquivos_xml)}[/bold green] arquivo(s) XML na pasta [bold cyan]'{pasta_notas}'[/bold cyan].")

    # Lê todos os XMLs e agrupa por mês
    console.print("[dim]Analisando arquivos XML...[/dim]")
    notas_por_mes = defaultdict(list)
    erros_iniciais = []

    for arq in arquivos_xml:
        dados = parse_nfe_xml(arq)
        if not dados or "erro" in dados:
            erros_iniciais.append({"arquivo": os.path.basename(arq), "erro": dados.get("erro") if dados else "XML inválido"})
            continue
        chave_mes = (dados.get("mes_nome", "Desconhecido"), dados.get("ano", 2026))
        notas_por_mes[chave_mes].append(dados)

    # ETAPA 3: Determina qual mês processar
    # Se houver múltiplos meses em 'notas/', prioriza o mês das novas notas extraídas ou o mais recente
    meses_disponiveis = sorted(notas_por_mes.keys(), key=lambda x: (x[1] or 0, x[0]), reverse=True)
    if len(meses_disponiveis) > 1:
        mes_selecionado = meses_disponiveis[0]
        resumo_meses = ", ".join([f"{m}/{a} ({len(notas_por_mes[(m, a)])} notas)" for m, a in meses_disponiveis])
        console.print(f"ℹ️ [yellow]Notas de múltiplos meses encontradas:[/yellow] {resumo_meses}")
        console.print(f"➡️ [bold cyan]Processando automaticamente o lote mais recente: {mes_selecionado[0]} ({mes_selecionado[1]})[/bold cyan]\n")
    else:
        mes_selecionado = meses_disponiveis[0]

    notas_processadas = notas_por_mes[mes_selecionado]
    nome_mes_alvo, ano_alvo = mes_selecionado

    # Abre a planilha Excel
    try:
        wb = openpyxl.load_workbook(caminho_planilha)
    except Exception as e:
        console.print(f"[bold red]❌ Erro ao abrir a planilha Excel:[/bold red] {e}")
        console.print("[dim]Verifique se a planilha não está aberta e travada em outro programa.[/dim]")
        sys.exit(1)

    # Analisa o mês ativo em cada uma das abas necessárias
    abas_necessarias = ["FARINHA DE TRIGO", "PRE MISTURA", "PM PAO DOCE"]
    info_abas = {}

    for nome_aba in abas_necessarias:
        if nome_aba not in wb.sheetnames:
            console.print(f"[bold red]❌ A aba '{nome_aba}' não foi encontrada na planilha![/bold red]")
            sys.exit(1)
        ws = wb[nome_aba]
        try:
            info_abas[nome_aba] = analisar_bloco_mes_ativo(ws)
        except Exception as e:
            console.print(f"[bold red]❌ Erro ao analisar a aba '{nome_aba}':[/bold red] {e}")
            sys.exit(1)

    # ETAPA 4: Validação e Criação Automática de Mês se necessário
    meses_abas = {info_abas[a]["nome_mes"] for a in abas_necessarias}

    if nome_mes_alvo not in meses_abas:
        console.print(Panel(
            f"[bold yellow]⚠️ NOVO MÊS DETECTADO: {nome_mes_alvo.upper()} ({ano_alvo})[/bold yellow]\n\n"
            f"• Mês das notas fiscais: [bold cyan]{nome_mes_alvo} ({ano_alvo})[/bold cyan]\n"
            f"• Último mês cadastrado na planilha: [bold magenta]{', '.join(meses_abas)}[/bold magenta]\n\n"
            f"O cabeçalho de [bold]{nome_mes_alvo}[/bold] ainda não existe na planilha.\n"
            f"O script pode criá-lo automaticamente nas 3 abas, preservando formatações,\n"
            f"títulos e transportando o saldo final do mês anterior.",
            title="Abertura de Mês",
            border_style="yellow"
        ))

        # Pergunta ao usuário se deseja criar automaticamente
        try:
            resposta = input(f"Deseja que o script crie o cabeçalho de {nome_mes_alvo} automaticamente? (S/N) [padrão: S]: ").strip().lower()
        except EOFError:
            resposta = "s"

        if resposta in ["s", "sim", "y", "yes", ""]:
            console.print(f"\n[cyan]Criando cabeçalho de {nome_mes_alvo} nas 3 abas...[/cyan]")
            # Cria backup preventivo
            caminho_backup = criar_backup(caminho_planilha, pasta_backups)
            console.print(f"🔒 [green]Backup criado antes de abrir o novo mês:[/green] [dim]{caminho_backup}[/dim]")

            for nome_aba in abas_necessarias:
                ws = wb[nome_aba]
                linha_criada = criar_cabecalho_novo_mes(ws, nome_mes_alvo, ano=ano_alvo or 2026)
                console.print(f"  ✓ Aba [bold]{nome_aba}[/bold]: cabeçalho criado na linha {linha_criada}")
                # Atualiza info_abas
                info_abas[nome_aba] = analisar_bloco_mes_ativo(ws)
            console.print(f"🎉 [bold green]Cabeçalhos de {nome_mes_alvo} criados com sucesso![/bold green]\n")
        else:
            console.print(f"\n[yellow]Execução interrompida a pedido do usuário.[/yellow]\n"
                          f"Crie o cabeçalho de {nome_mes_alvo} manualmente no Excel e execute o script novamente.")
            sys.exit(0)
    else:
        # Se o mês já existe, cria o backup preventivo padrão antes dos lançamentos
        try:
            caminho_backup = criar_backup(caminho_planilha, pasta_backups)
            console.print(f"🔒 [green]Backup criado com sucesso:[/green] [dim]{caminho_backup}[/dim]\n")
        except Exception as e:
            console.print(f"[bold red]❌ Erro ao criar backup da planilha:[/bold red] {e}")
            sys.exit(1)

    # ETAPA 5: Lançamento das notas fiscais
    tabela_resultado = Table(title=f"Detalhamento dos Lançamentos - {nome_mes_alvo}/{ano_alvo}", show_lines=True)
    tabela_resultado.add_column("Arquivo", style="dim", no_wrap=True)
    tabela_resultado.add_column("NF", style="bold cyan")
    tabela_resultado.add_column("Data", style="blue")
    tabela_resultado.add_column("Produto", style="magenta")
    tabela_resultado.add_column("Qtd", justify="right")
    tabela_resultado.add_column("Vlr. Unit", justify="right")
    tabela_resultado.add_column("Aba Destino", style="yellow")
    tabela_resultado.add_column("Linha", justify="center")
    tabela_resultado.add_column("Status", style="bold")

    itens_adicionados = 0
    itens_duplicados = 0
    itens_sem_aba = 0
    erros_leitura = len(erros_iniciais)

    for err in erros_iniciais:
        tabela_resultado.add_row(err["arquivo"], "-", "-", "-", "-", "-", "-", "-", f"[red]{err['erro']}[/red]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TimeElapsedColumn(),
        console=console
    ) as progress:
        task = progress.add_task(f"[cyan]Atualizando saídas de {nome_mes_alvo}...", total=len(notas_processadas))

        for nota in notas_processadas:
            nome_arq = nota.get("arquivo", "")
            progress.update(task, description=f"[cyan]Processando: {nome_arq}")

            if "erro" in nota:
                tabela_resultado.add_row(nome_arq, "-", "-", "-", "-", "-", "-", "-", f"[red]{nota['erro']}[/red]")
                erros_leitura += 1
                progress.advance(task)
                continue

            numero_nf = nota.get("numero_nf", "")
            norm_nf = normalizar_nf(numero_nf)
            data_obj = nota.get("data_obj")
            data_str = nota.get("data_emissao", "")
            produtos = nota.get("produtos", [])

            if not produtos:
                tabela_resultado.add_row(nome_arq, numero_nf, data_str, "-", "-", "-", "-", "-", "[yellow]Sem produtos[/yellow]")
                progress.advance(task)
                continue

            # Mapeia cada produto para sua aba
            abas_da_nota = {}
            for prod in produtos:
                aba_dest = mapear_aba_produto(prod, regras_mapeamento)
                abas_da_nota[prod["descricao"]] = aba_dest

            for prod in produtos:
                nome_prod = prod.get("descricao", "")
                qtd = prod.get("quantidade", 0.0)
                v_unit = prod.get("valor_unitario", 0.0)
                aba_destino = abas_da_nota.get(nome_prod)

                if not aba_destino:
                    tabela_resultado.add_row(
                        nome_arq, numero_nf, data_str, nome_prod, f"{qtd:g}", f"R$ {v_unit:.2f}",
                        "Nenhuma", "-", "[red]Aba não identificada[/red]"
                    )
                    itens_sem_aba += 1
                    continue

                info = info_abas[aba_destino]
                ws = wb[aba_destino]

                # Prevenção de duplicidade: a NF já existia na aba?
                if norm_nf in info["nfs_existentes"]:
                    tabela_resultado.add_row(
                        nome_arq, numero_nf, data_str, nome_prod, f"{qtd:g}", f"R$ {v_unit:.2f}",
                        aba_destino, "-", "[yellow]Duplicada (já lançada)[/yellow]"
                    )
                    itens_duplicados += 1
                    continue

                # Determina a linha correta e insere
                linha_alvo = info["proxima_linha"]
                linha_modelo = info["linha_modelo"]

                inserir_lancamento_saida(
                    ws=ws,
                    linha_alvo=linha_alvo,
                    data_obj=data_obj,
                    numero_nf=numero_nf,
                    valor_unitario=v_unit,
                    quantidade=qtd,
                    linha_modelo=linha_modelo
                )

                # Atualiza ponteiro para o próximo item
                info["linha_modelo"] = linha_alvo
                info["proxima_linha"] += 1

                tabela_resultado.add_row(
                    nome_arq, numero_nf, data_str, nome_prod, f"{qtd:g}", f"R$ {v_unit:.2f}",
                    aba_destino, str(linha_alvo), "[green]✓ Lançado com sucesso[/green]"
                )
                itens_adicionados += 1

            # Após processar todos os itens da nota, registra a NF como existente para evitar reprocessamento
            for prod in produtos:
                aba_dest = abas_da_nota.get(prod["descricao"])
                if aba_dest and norm_nf not in info_abas[aba_dest]["nfs_existentes"]:
                    info_abas[aba_dest]["nfs_existentes"].add(norm_nf)

            progress.advance(task)

    console.print(tabela_resultado)

    # Salva a planilha se houve novos lançamentos
    if itens_adicionados > 0:
        try:
            wb.save(caminho_planilha)
            console.print(f"\n💾 [bold green]Planilha atualizada e salva com sucesso:[/bold green] [underline]{caminho_planilha}[/underline]")
        except Exception as e:
            console.print(f"\n[bold red]❌ Erro ao salvar a planilha Excel (verifique se ela está aberta):[/bold red] {e}")
    else:
        console.print("\nℹ️ [dim]Nenhum novo lançamento realizado. A planilha foi mantida intacta.[/dim]")

    resumo_msg = (
        f"[bold]Lote processado:[/bold] {nome_mes_alvo}/{ano_alvo}\n"
        f"[bold]Notas fiscais analisadas:[/bold] {len(notas_processadas)}\n"
        f"[bold green]Itens lançados com sucesso:[/bold green] {itens_adicionados}\n"
        f"[bold yellow]Itens duplicados (ignorados):[/bold yellow] {itens_duplicados}\n"
    )
    if itens_sem_aba > 0:
        resumo_msg += f"[bold red]Itens sem aba correspondente:[/bold red] {itens_sem_aba}\n"
    if erros_leitura > 0:
        resumo_msg += f"[bold red]Arquivos com erro de leitura:[/bold red] {erros_leitura}\n"

    console.print(Panel(resumo_msg.strip(), title="📊 Resumo da Execução", border_style="green" if itens_adicionados > 0 else "yellow"))

if __name__ == "__main__":
    main()
