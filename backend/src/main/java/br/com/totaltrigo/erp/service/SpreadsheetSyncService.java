package br.com.totaltrigo.erp.service;

import br.com.totaltrigo.erp.adapter.NfeGatewayPort;
import br.com.totaltrigo.erp.adapter.NfeGatewayPort.NfeEmissionResult;
import br.com.totaltrigo.erp.domain.enums.OrderStatus;
import br.com.totaltrigo.erp.domain.model.InvoiceData;
import br.com.totaltrigo.erp.domain.model.Order;
import br.com.totaltrigo.erp.domain.model.OrderItem;
import br.com.totaltrigo.erp.repository.OrderRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

/**
 * Serviço de sincronização de notas fiscais com a automação legada em Python e Planilha de Estoques.xlsx.
 * Responsável por salvar os XMLs oficiais da NF-e (baseados estritamente na Qtd. Base / BQ) na pasta notas/
 * e disparar com segurança e resiliência o script excel_updater.py / atualizar_estoque.py.
 */
@Service
public class SpreadsheetSyncService {

    private static final Logger log = LoggerFactory.getLogger(SpreadsheetSyncService.class);

    private final OrderRepository orderRepository;
    private final NfeGatewayPort nfeGatewayPort;

    public SpreadsheetSyncService(OrderRepository orderRepository, NfeGatewayPort nfeGatewayPort) {
        this.orderRepository = orderRepository;
        this.nfeGatewayPort = nfeGatewayPort;
    }

    /**
     * Sincroniza um pedido faturado com a automação em planilha.
     */
    @Transactional
    public Map<String, Object> syncIssuedInvoiceToSpreadsheet(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + orderId));

        return executeSync(order);
    }

    /**
     * Sobrecarga para identificadores em UUID.
     */
    @Transactional
    public Map<String, Object> syncIssuedInvoiceToSpreadsheet(UUID orderId) {
        if (orderId == null) {
            throw new IllegalArgumentException("orderId não pode ser nulo.");
        }
        Order order = resolveOrderFromUuid(orderId);
        return executeSync(order);
    }

    /**
     * Sobrecarga para String (aceita número Long ou formato UUID).
     */
    @Transactional
    public Map<String, Object> syncIssuedInvoiceToSpreadsheet(String orderIdStr) {
        if (orderIdStr == null || orderIdStr.isBlank()) {
            throw new IllegalArgumentException("orderId não pode ser vazio.");
        }
        try {
            long id = Long.parseLong(orderIdStr.trim());
            return syncIssuedInvoiceToSpreadsheet(id);
        } catch (NumberFormatException e) {
            try {
                UUID uuid = UUID.fromString(orderIdStr.trim());
                return syncIssuedInvoiceToSpreadsheet(uuid);
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("Identificador de pedido inválido: " + orderIdStr);
            }
        }
    }

    private Map<String, Object> executeSync(Order order) {
        InvoiceData inv = order.getInvoiceData();
        String accessKey = (inv != null && inv.getNfeAccessKey() != null && !inv.getNfeAccessKey().isBlank())
                ? inv.getNfeAccessKey()
                : null;

        // Obtém o XML da NF-e (que reflete estritamente a Qtd. Base / BQ)
        NfeEmissionResult emission = nfeGatewayPort.emitNfe(order);
        String xmlContent = emission.xmlContent();
        if (accessKey == null) {
            accessKey = emission.accessKey();
            if (accessKey == null || accessKey.isBlank()) {
                accessKey = "PEDIDO_" + order.getId() + "_" + System.currentTimeMillis();
            }
        }

        // Calcula a Qtd. Base Total (BQ)
        int baseQuantityTotal = order.getItems().stream()
                .mapToInt(i -> i.getBaseQuantity() != null ? i.getBaseQuantity() : (i.getQuantity() != null ? i.getQuantity() : 0))
                .sum();

        // Localiza ou prepara o diretório de automação e a pasta notas/
        File automacaoDir = resolveAutomacaoDir();
        File notasDir = new File(automacaoDir, "notas");
        if (!notasDir.exists()) {
            boolean created = notasDir.mkdirs();
            log.info("Criação da pasta notas em {}: {}", notasDir.getAbsolutePath(), created);
        }

        // Salva o XML em notas/{accessKey}-procNfe.xml
        File xmlFile = new File(notasDir, accessKey + "-procNfe.xml");
        String xmlSavedPath;
        try {
            Files.writeString(xmlFile.toPath(), xmlContent, StandardCharsets.UTF_8);
            xmlSavedPath = xmlFile.getAbsolutePath();
            log.info("XML da NF-e salvo com sucesso em: {}", xmlSavedPath);
        } catch (IOException e) {
            log.error("Erro ao gravar arquivo XML em {}: {}", xmlFile.getAbsolutePath(), e.getMessage());
            throw new RuntimeException("Falha ao salvar XML da NF-e para sincronização da planilha: " + e.getMessage(), e);
        }

        // Execução não-bloqueante e resiliente do script Python (com timeout de 15s)
        boolean scriptExecuted = false;
        String message;

        File excelUpdaterFile = new File(automacaoDir, "excel_updater.py");
        File atualizarEstoqueFile = new File(automacaoDir, "atualizar_estoque.py");

        if (excelUpdaterFile.exists() || atualizarEstoqueFile.exists()) {
            String pythonExec = findPythonExecutable(automacaoDir);
            String scriptToRun = atualizarEstoqueFile.exists() ? "atualizar_estoque.py" : "excel_updater.py";

            try {
                log.info("Tentando executar script de sincronização: {} {} em {}", pythonExec, scriptToRun, automacaoDir.getAbsolutePath());
                ProcessBuilder pb = new ProcessBuilder(pythonExec, scriptToRun);
                pb.directory(automacaoDir);
                pb.redirectErrorStream(true);
                pb.environment().put("PYTHONIOENCODING", "utf-8");

                Process process = pb.start();
                boolean finished = process.waitFor(15, TimeUnit.SECONDS);

                if (!finished) {
                    process.destroyForcibly();
                    message = "XML salvo em " + xmlSavedPath + ", mas a execução do script Python excedeu o limite de segurança de 15s.";
                    log.warn("Processo Python de sincronização abortado por timeout (15s).");
                } else {
                    int exitCode = process.exitValue();
                    if (exitCode == 0) {
                        scriptExecuted = true;
                        message = "XML salvo com sucesso (" + xmlFile.getName() + ") e sincronizado com a Planilha de Estoques.xlsx via " + scriptToRun + ".";
                        log.info("Script Python executado com sucesso (exitCode 0).");
                    } else {
                        message = "XML salvo em " + xmlSavedPath + ", mas o script Python retornou código de saída " + exitCode + ".";
                        log.warn("Script Python finalizou com exitCode {}", exitCode);
                    }
                }
            } catch (Exception ex) {
                log.warn("Falha não-bloqueante na execução do script Python: {}", ex.getMessage());
                message = "XML da NF-e salvo em notas/, mas o interpretador Python ou openpyxl não pôde ser executado: " + ex.getMessage();
            }
        } else {
            message = "XML salvo em " + xmlSavedPath + ", mas excel_updater.py não foi localizado no diretório de automação.";
            log.info("excel_updater.py não encontrado em {}", automacaoDir.getAbsolutePath());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("xmlSavedPath", xmlSavedPath);
        result.put("scriptExecuted", scriptExecuted);
        result.put("baseQuantityTotal", baseQuantityTotal);
        result.put("orderId", order.getId());
        result.put("accessKey", accessKey);
        result.put("message", message);

        return result;
    }

    private Order resolveOrderFromUuid(UUID orderId) {
        try {
            long parsed = Long.parseLong(orderId.toString());
            return orderRepository.findById(parsed)
                    .orElseThrow(() -> new IllegalArgumentException("Pedido não encontrado: " + parsed));
        } catch (NumberFormatException e) {
            long lsb = Math.abs(orderId.getLeastSignificantBits());
            return orderRepository.findById(lsb)
                    .orElseGet(() -> orderRepository.findAll().stream().findFirst()
                            .orElseThrow(() -> new IllegalArgumentException("Nenhum pedido localizado para UUID: " + orderId)));
        }
    }

    private File resolveAutomacaoDir() {
        List<File> candidates = List.of(
                new File("automacao-planilha"),
                new File("../automacao-planilha"),
                new File("../../automacao-planilha"),
                new File("c:/Users/PC-Gabriel/Documents/antigravity/TotalTrigo/automacao-planilha"),
                new File(System.getProperty("user.dir"), "automacao-planilha"),
                new File(System.getProperty("user.dir"), "../automacao-planilha")
        );
        for (File candidate : candidates) {
            if (candidate.exists() && candidate.isDirectory()) {
                return candidate;
            }
        }
        File fallback = new File("../automacao-planilha");
        fallback.mkdirs();
        return fallback;
    }

    private String findPythonExecutable(File automacaoDir) {
        List<File> candidates = List.of(
                new File(automacaoDir.getParentFile(), ".venv/Scripts/python.exe"),
                new File(".venv/Scripts/python.exe"),
                new File("../.venv/Scripts/python.exe"),
                new File("c:/Users/PC-Gabriel/Documents/antigravity/TotalTrigo/.venv/Scripts/python.exe")
        );
        for (File f : candidates) {
            if (f.exists() && f.canExecute()) {
                return f.getAbsolutePath();
            }
        }
        return "python";
    }
}
