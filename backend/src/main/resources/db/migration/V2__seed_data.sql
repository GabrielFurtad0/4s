-- ============================================================================
-- V2__seed_data.sql
-- Dados Reais da Total Trigo Comércio de Alimentos Ltda + Cenários de Teste
-- ============================================================================

-- 1. OS 3 SKUs OFICIAIS DA TOTAL TRIGO (Códigos 05, 02 e 03 das Notas Fiscais e Planilha)
INSERT INTO products (
    id, sku_code, erp_code, name, short_name, unit_of_measure, units_per_box,
    physical_stock, reserved_stock, current_landed_cost, base_list_price,
    ncm, cest, c_benef, origin_code, default_cfop_internal, default_cfop_interstate, estimated_tax_rate
) VALUES
(1, 'SKU-05', '0000200000001', 'Farinha de Trigo Tipo 1 25Kg', 'Farinha Tipo 1 (25kg)', 'SA', 5,
 2259, 60, 54.00, 85.00,
 '11010010', '1704400', 'SP020390', 2, '5102', '6102', 8.00),

(2, 'SKU-02', 'PA02980502603', 'Farinha de Trigo Pré-Mistura 25Kg', 'Pré-Mistura Francês (25kg)', 'SA', 5,
 1739, 25, 49.50, 78.00,
 '11010010', '1704600', 'SP020390', 1, '5102', '6102', 8.00),

(3, 'SKU-03', '0002960502503', 'Pré-Mistura Pão Doce 25Kg', 'PM Pão Doce (25kg)', 'SA', 5,
 180, 10, 61.00, 92.00,
 '11010010', '1704600', 'SP020390', 1, '5102', '6102', 8.00);

-- 2. LOTE DE IMPORTAÇÃO HISTÓRICO ATIVO
INSERT INTO import_batches (
    id, batch_code, arrival_date, supplier_name, exchange_rate_usd,
    fob_total_usd, international_freight_brl, import_taxes_brl, customs_expenses_brl, total_landed_cost_brl, notes
) VALUES (
    1, 'IMP-2026-09-ARG', '2026-09-25', 'Molinos Río de la Plata (Argentina)', 5.1800,
    24500.00, 14800.00, 19600.00, 6890.00, 168200.00,
    'Lote de Setembro/Outubro - 3 Carretas Puerto Iguazú / Foz do Iguaçu -> Galpão Zona Sul SP'
);

INSERT INTO import_batch_items (batch_id, product_id, quantity_imported, fob_unit_usd, calculated_unit_cost_brl) VALUES
(1, 1, 1500, 8.20, 54.00),
(1, 2, 1200, 7.50, 49.50),
(1, 3, 300, 9.30, 61.00);

-- 3. CLIENTES B2B (Baseados nas NF-e reais da Total Trigo + Protótipo)
INSERT INTO clients (
    id, corporate_name, trade_name, cnpj, state_registration, ie_indicator, purchase_profile,
    zip_code, street, number, complement, neighborhood, city, state, ibge_city_code,
    contact_name, phone, default_payment_terms, average_purchase_cycle_days,
    last_purchase_date, last_order_total, financial_status, is_registration_complete
) VALUES
-- Cliente 1: Visita de Hoje + Alerta de Recompra (22 dias sem comprar, ciclo 20d)
(1, 'PANIFICADORA JARDIM ELIANA LTDA', 'Padaria Jardim Eliana', '68.457.477/0001-34', '161327701113', 'CONTRIBUINTE', 'INDUSTRIALIZACAO',
 '04846-010', 'Avenida Dona Belmira Marin', '4985', '', 'Parque Brasil / Grajaú', 'São Paulo', 'SP', '3550308',
 'Sr. Carlos', '(11) 98812-4410', 'Boleto 28 dias', 20,
 (CURRENT_DATE - 22), 4700.00, 'EM_DIA', TRUE),

-- Cliente 2: Visita de Hoje (Em dia, ciclo 15d)
(2, 'IND COM PANIFICACAO JARDIM MIRIAN LTDA', 'Panificadora Jardim Mirian', '62.136.817/0001-49', '105973105110', 'CONTRIBUINTE', 'INDUSTRIALIZACAO',
 '04424-000', 'Avenida Cupecê', '5500', '', 'Cidade Ademar', 'São Paulo', 'SP', '3550308',
 'Marcos', '(11) 97123-8890', 'Boleto 14/28 dias', 15,
 (CURRENT_DATE - 11), 4100.00, 'EM_DIA', TRUE),

-- Cliente 3: Visita de Hoje + Alerta de Recompra + Boleto Vencido
(3, 'NOVA BELFORT PAES E DOCES LTDA EPP', 'Atacado & Padaria Nova Belfort', '12.049.732/0001-55', '147247208119', 'CONTRIBUINTE', 'REVENDA',
 '04676-110', 'Rua Santana', '668', 'Galpão B', 'Vila São Pedro / Sabará', 'São Paulo', 'SP', '3550308',
 'Fernanda', '(11) 99450-1122', 'Boleto 28 dias', 20,
 (CURRENT_DATE - 35), 12300.00, 'BOLETO_VENCIDO', TRUE),

-- Cliente 4: Radar de Recompra (42 dias sem comprar, ciclo 25d)
(4, 'ANTONIO ALVES DA CRUZ PAES E DOCES ME', 'Panificadora Alves da Cruz', '08.714.521/0001-12', '149621700115', 'CONTRIBUINTE', 'INDUSTRIALIZACAO',
 '04883-255', 'Rua Henrique Roschel Criste', '53', '', 'Jardim dos Álamos / Parelheiros', 'São Paulo', 'SP', '3550308',
 'Roberto', '(11) 98234-5566', 'Pix na Entrega', 25,
 (CURRENT_DATE - 42), 3850.00, 'EM_DIA', TRUE),

-- Cliente 5: Cadastro Rápido na Rua pelo Pai (INCOMPLETO FISCALMENTE - para testar semáforo e BrasilAPI no Backoffice!)
(5, 'PADARIA E CONFEITARIA SOL MAIOR (CADASTRO RUA)', 'Padaria Sol Maior Jabaquara', '48.936.777/0001-99', NULL, 'CONTRIBUINTE', 'INDUSTRIALIZACAO',
 NULL, 'Av. Rodrigues Montemor (Anotado na rua)', '919', NULL, 'Jabaquara', 'São Paulo', 'SP', NULL,
 'Sr. Joaquim', '(11) 96543-2109', 'Boleto 21 dias', 15,
 (CURRENT_DATE - 5), 1680.00, 'EM_DIA', FALSE),

-- Cliente 6: Radar de Recompra no Campo Belo
(6, 'PANIFICADORA E CONFEITARIA NOVA PRESIDENTE LTDA', 'Nova Presidente', '61.191.532/0001-48', '105312697117', 'CONTRIBUINTE', 'INDUSTRIALIZACAO',
 '04624-002', 'Rua Estêvão Baião', '798', '', 'Campo Belo', 'São Paulo', 'SP', '3550308',
 'Dona Helena', '(11) 99111-3344', 'Boleto 28 dias', 18,
 (CURRENT_DATE - 26), 2610.00, 'EM_DIA', TRUE);

-- 4. MEMÓRIA DE PREÇO POR CLIENTE (ClientSkuPrice)
-- Cliente 1 (Jardim Eliana)
INSERT INTO client_sku_prices (client_id, product_id, last_practiced_price, agreed_standard_price, last_order_date) VALUES
(1, 1, 79.00, 79.00, (CURRENT_DATE - 22)),
(1, 2, 75.00, 75.00, (CURRENT_DATE - 22)),
(1, 3, 88.00, 88.00, (CURRENT_DATE - 45)),
-- Cliente 2 (Jardim Mirian)
(2, 1, 82.00, 82.00, (CURRENT_DATE - 11)),
(2, 2, 76.00, 76.00, (CURRENT_DATE - 11)),
(2, 3, 90.00, 90.00, (CURRENT_DATE - 30)),
-- Cliente 3 (Nova Belfort - compra volume alto, preço menor)
(3, 1, 80.00, 82.00, (CURRENT_DATE - 35)),
(3, 2, 74.00, 75.00, (CURRENT_DATE - 35)),
(3, 3, 86.00, 88.00, (CURRENT_DATE - 35)),
-- Cliente 4 (Alves da Cruz)
(4, 1, 83.00, 83.00, (CURRENT_DATE - 42)),
(4, 2, 78.00, 78.00, (CURRENT_DATE - 42)),
(4, 3, 90.00, 90.00, (CURRENT_DATE - 42)),
-- Cliente 5 (Sol Maior - Cadastro rápido na rua)
(5, 1, 84.00, 84.00, (CURRENT_DATE - 5)),
(5, 2, 77.00, 77.00, (CURRENT_DATE - 5)),
(5, 3, 90.00, 90.00, (CURRENT_DATE - 5)),
-- Cliente 6 (Nova Presidente)
(6, 1, 87.00, 87.00, (CURRENT_DATE - 26)),
(6, 2, 79.00, 79.00, (CURRENT_DATE - 26)),
(6, 3, 92.00, 92.00, (CURRENT_DATE - 26));

-- 5. CADERNO DE ANOTAÇÕES DO CLIENTE (ClientNote)
INSERT INTO client_notes (client_id, created_at, content) VALUES
(1, (CURRENT_TIMESTAMP - INTERVAL '3' HOUR), 'Pediu para levar amostra da Pré-Mistura Pão Doce 25Kg na visita de hoje.'),
(1, (CURRENT_TIMESTAMP - INTERVAL '22' DAY), 'Prefere entrega no período da manhã pelos nossos funcionários antes das 10h.'),
(2, (CURRENT_TIMESTAMP - INTERVAL '11' DAY), 'Comprador Marcos só atende fornecedores na padaria até às 11h30.'),
(3, (CURRENT_TIMESTAMP - INTERVAL '35' DAY), 'Compra em volume alto (150 sacos de Tipo 1). Verificar baixa do boleto antes de liberar novo pedido.'),
(4, (CURRENT_TIMESTAMP - INTERVAL '42' DAY), 'Cliente estratégico em Parelheiros, ligar ou passar lá pois passou do ciclo de 25 dias.'),
(5, (CURRENT_TIMESTAMP - INTERVAL '1' DAY), 'Cliente novo prospectado pelo pai no Jabaquara. Gabriel: puxar CNPJ 48.936.777/0001-99 na BrasilAPI antes de emitir a NF-e!'),
(6, (CURRENT_TIMESTAMP - INTERVAL '26' DAY), 'Dona Helena pediu para avisar no WhatsApp 1h antes do caminhão encostar.');

-- 6. AGENDA DE VISITAS DO DIA (VisitSchedule)
INSERT INTO visit_schedules (client_id, scheduled_date, scheduled_time, reminder_note, status) VALUES
(1, CURRENT_DATE, '09:30', 'Levar amostra PM Pão Doce e fechar reposição de Farinha Tipo 1', 'PENDENTE'),
(2, CURRENT_DATE, '11:00', 'Atendimento até 11h30 com Marcos — checar estoque da Pré-Mistura', 'PENDENTE'),
(3, CURRENT_DATE, '14:30', 'Cobrar boleto em aberto e negociar lote grande de 100+ sacos', 'PENDENTE'),
(5, CURRENT_DATE, '16:15', 'Passar para confirmar primeiro pedido fechado ontem', 'REALIZADA');

-- 7. PEDIDOS HISTÓRICOS FATURADOS + PEDIDOS NA FILA PRÉ-NOTA (AGUARDANDO_REVISAO)
-- Pedido #1 (Histórico Faturado - NF-e #12926 - Panificadora Jardim Eliana)
INSERT INTO orders (
    id, client_id, created_at, status, payment_terms, delivery_forecast,
    notes_for_invoice_or_driver, backoffice_adjustment_notes, shipping_cost_estimate,
    original_commercial_total, gross_total, total_cmv_snapshot, estimated_tax_snapshot,
    net_profit_snapshot, net_margin_percentage,
    nfe_status, nfe_number, nfe_access_key, danfe_pdf_url, xml_url
) VALUES (
    1, 1, (CURRENT_TIMESTAMP - INTERVAL '22' DAY), 'FATURADO', 'Boleto 28 dias', 'Manhã',
    'REDUCAO DE 7% ANEXO III ARTIGO 3 DO RICMS', NULL, 45.00,
    3080.00, 3080.00, 2070.00, 246.40, 718.60, 23.33,
    'AUTORIZADA', '12926', '35261009265201000195550010000129261300056781',
    '/api/backoffice/orders/1/danfe', '/api/backoffice/orders/1/xml'
);

INSERT INTO order_items (order_id, product_id, ordered_quantity, quantity, ordered_unit_price, unit_sale_price, unit_cost_snapshot, is_promotional_price) VALUES
(1, 1, 20, 20, 79.00, 79.00, 54.00, FALSE),
(1, 2, 20, 20, 75.00, 75.00, 49.50, FALSE);

-- Pedido #2 (Histórico Faturado - NF-e #12928 - Jardim Mirian)
INSERT INTO orders (
    id, client_id, created_at, status, payment_terms, delivery_forecast,
    notes_for_invoice_or_driver, backoffice_adjustment_notes, shipping_cost_estimate,
    original_commercial_total, gross_total, total_cmv_snapshot, estimated_tax_snapshot,
    net_profit_snapshot, net_margin_percentage,
    nfe_status, nfe_number, nfe_access_key, danfe_pdf_url, xml_url
) VALUES (
    2, 2, (CURRENT_TIMESTAMP - INTERVAL '11' DAY), 'FATURADO', 'Boleto 14/28 dias', 'Manhã',
    'REDUCAO DE 7% ANEXO III ARTIGO 3 DO RICMS', NULL, 45.00,
    4100.00, 4100.00, 2700.00, 328.00, 1027.00, 25.05,
    'AUTORIZADA', '12928', '35261009265201000195550010000129281300056808',
    '/api/backoffice/orders/2/danfe', '/api/backoffice/orders/2/xml'
);

INSERT INTO order_items (order_id, product_id, ordered_quantity, quantity, ordered_unit_price, unit_sale_price, unit_cost_snapshot, is_promotional_price) VALUES
(2, 1, 50, 50, 82.00, 82.00, 54.00, FALSE);

-- Pedido #3 (AGUARDANDO_REVISAO na Mesa do Gabriel - Cliente Completo Fiscalmente)
-- Reserva: 40x SKU-1 + 15x SKU-2
INSERT INTO orders (
    id, client_id, created_at, status, payment_terms, delivery_forecast,
    notes_for_invoice_or_driver, backoffice_adjustment_notes, shipping_cost_estimate,
    original_commercial_total, gross_total, total_cmv_snapshot, estimated_tax_snapshot,
    net_profit_snapshot, net_margin_percentage, nfe_status
) VALUES (
    3, 2, (CURRENT_TIMESTAMP - INTERVAL '45' MINUTE), 'AGUARDANDO_REVISAO', 'Boleto 14/28 dias', 'Amanhã (Manhã)',
    'Entregar antes das 10h30. Cliente pediu para conferir se vai faturar tudo na mesma nota.', NULL, 45.00,
    4420.00, 4420.00, 2902.50, 353.60, 1118.90, 25.31, 'PENDENTE'
);

INSERT INTO order_items (order_id, product_id, ordered_quantity, quantity, ordered_unit_price, unit_sale_price, unit_cost_snapshot, is_promotional_price) VALUES
(3, 1, 40, 40, 82.00, 82.00, 54.00, FALSE),
(3, 2, 15, 15, 76.00, 76.00, 49.50, FALSE);

-- Pedido #4 (AGUARDANDO_REVISAO na Mesa do Gabriel - Cliente Cadastro Rápido Rua sem IE/IBGE completos!)
-- Reserva: 20x SKU-1 + 10x SKU-2 + 10x SKU-3
INSERT INTO orders (
    id, client_id, created_at, status, payment_terms, delivery_forecast,
    notes_for_invoice_or_driver, backoffice_adjustment_notes, shipping_cost_estimate,
    original_commercial_total, gross_total, total_cmv_snapshot, estimated_tax_snapshot,
    net_profit_snapshot, net_margin_percentage, nfe_status
) VALUES (
    4, 5, (CURRENT_TIMESTAMP - INTERVAL '15' MINUTE), 'AGUARDANDO_REVISAO', 'Boleto 21 dias', 'Amanhã (Tarde)',
    'Cliente novo no Jabaquara! Favor puxar dados completos do CNPJ 48.936.777/0001-99 antes de emitir NF-e.', NULL, 45.00,
    3350.00, 3350.00, 2185.00, 268.00, 852.00, 25.43, 'PENDENTE'
);

INSERT INTO order_items (order_id, product_id, ordered_quantity, quantity, ordered_unit_price, unit_sale_price, unit_cost_snapshot, is_promotional_price) VALUES
(4, 1, 20, 20, 84.00, 84.00, 54.00, FALSE),
(4, 2, 10, 10, 77.00, 77.00, 49.50, FALSE),
(4, 3, 10, 10, 90.00, 90.00, 61.00, FALSE);

-- Ajusta sequences para próximos inserts
ALTER TABLE products ALTER COLUMN id RESTART WITH 4;
ALTER TABLE import_batches ALTER COLUMN id RESTART WITH 2;
ALTER TABLE clients ALTER COLUMN id RESTART WITH 7;
ALTER TABLE orders ALTER COLUMN id RESTART WITH 5;
