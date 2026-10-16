package br.com.totaltrigo.erp.adapter;

import br.com.totaltrigo.erp.domain.model.Order;

public interface NfeGatewayPort {

    record NfeEmissionResult(
            boolean authorized,
            String nfeNumber,
            String accessKey,
            String protocolNumber,
            String statusMessage,
            String xmlContent
    ) {}

    NfeEmissionResult emitNfe(Order order);
}
