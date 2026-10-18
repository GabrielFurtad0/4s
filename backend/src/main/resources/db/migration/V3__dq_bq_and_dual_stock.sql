-- ============================================================================
-- V3__dq_bq_and_dual_stock.sql
-- Separação entre Qtd. Expedição (DQ) e Qtd. Base (BQ), Saldo Base (base_stock)
-- e Frete R$ 4,00/saca entregue
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS base_stock INT NOT NULL DEFAULT 0;
UPDATE products SET base_stock = physical_stock WHERE base_stock = 0;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS dispatch_quantity INT NOT NULL DEFAULT 0;
UPDATE order_items
SET dispatch_quantity = CASE WHEN ordered_quantity > 0 THEN ordered_quantity ELSE quantity END
WHERE dispatch_quantity = 0;

-- Atualiza os pedidos iniciais com a regra oficial de frete R$ 4,00 por saca entregue (DQ)
-- Pedido #1: 40 sacas (DQ=40, BQ=40), Receita=3080.00, CMV=2070.00, Imposto(8% BQ)=246.40, Frete=160.00 -> Lucro=603.60 (19.60%)
UPDATE orders
SET shipping_cost_estimate = 160.00,
    net_profit_snapshot = 603.60,
    net_margin_percentage = 19.60
WHERE id = 1;

-- Pedido #2: 50 sacas (DQ=50, BQ=50), Receita=4100.00, CMV=2700.00, Imposto(8% BQ)=328.00, Frete=200.00 -> Lucro=872.00 (21.27%)
UPDATE orders
SET shipping_cost_estimate = 200.00,
    net_profit_snapshot = 872.00,
    net_margin_percentage = 21.27
WHERE id = 2;

-- Pedido #3: 55 sacas (DQ=55, BQ=55), Receita=4420.00, CMV=2902.50, Imposto(8% BQ)=353.60, Frete=220.00 -> Lucro=943.90 (21.36%)
UPDATE orders
SET shipping_cost_estimate = 220.00,
    net_profit_snapshot = 943.90,
    net_margin_percentage = 21.36
WHERE id = 3;

-- Pedido #4: 40 sacas (DQ=40, BQ=40), Receita=3350.00, CMV=2185.00, Imposto(8% BQ)=268.00, Frete=160.00 -> Lucro=737.00 (22.00%)
UPDATE orders
SET shipping_cost_estimate = 160.00,
    net_profit_snapshot = 737.00,
    net_margin_percentage = 22.00
WHERE id = 4;
