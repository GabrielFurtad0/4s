package br.com.totaltrigo.erp.dto;

import br.com.totaltrigo.erp.domain.enums.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class ApiDtos {

    public record ProductStockDto(
            Long id,
            String skuCode,
            String erpCode,
            String name,
            String shortName,
            String unitOfMeasure,
            Integer unitsPerBox,
            Integer physicalStock,
            Integer reservedStock,
            Integer availableStock,
            Integer baseStock,
            BigDecimal currentLandedCost,
            BigDecimal baseListPrice,
            String ncm,
            String cest,
            String cBenef,
            Integer originCode,
            String defaultCfopInternal,
            String defaultCfopInterstate,
            BigDecimal estimatedTaxRate
    ) {}

    public record AgendaCardDto(
            Long clientId,
            Long visitId,
            String corporateName,
            String tradeName,
            String cnpj,
            String neighborhood,
            String city,
            String state,
            String scheduledTime,
            String visitStatus,
            String reminderNote,
            long daysSinceLastOrder,
            Integer averagePurchaseCycleDays,
            boolean needsRestockAlert,
            BigDecimal lastOrderTotal,
            FinancialStatus financialStatus,
            boolean isRegistrationComplete,
            String latestNote
    ) {}

    public record SkuPriceMemoryDto(
            Long productId,
            String skuCode,
            String productName,
            String shortName,
            BigDecimal lastPracticedPrice,
            BigDecimal agreedStandardPrice,
            BigDecimal baseListPrice,
            BigDecimal currentLandedCost,
            Integer availableStock,
            LocalDate lastOrderDate
    ) {}

    public record ClientNoteDto(
            Long id,
            String formattedDate,
            LocalDateTime createdAt,
            String content
    ) {}

    public record OrderHistorySummaryDto(
            Long orderId,
            String itemsSummary,
            String metaInfo,
            OrderStatus status,
            String nfeNumber,
            BigDecimal grossTotal,
            LocalDateTime createdAt
    ) {}

    public record Client360Dto(
            Long id,
            String corporateName,
            String tradeName,
            String cnpj,
            String stateRegistration,
            IeIndicator ieIndicator,
            PurchaseProfile purchaseProfile,
            String zipCode,
            String street,
            String number,
            String complement,
            String neighborhood,
            String city,
            String state,
            String ibgeCityCode,
            String fullAddress,
            String contactName,
            String phone,
            String defaultPaymentTerms,
            Integer averagePurchaseCycleDays,
            LocalDate lastPurchaseDate,
            long daysSinceLastOrder,
            BigDecimal lastOrderTotal,
            FinancialStatus financialStatus,
            boolean isRegistrationComplete,
            List<SkuPriceMemoryDto> skuPrices,
            List<ClientNoteDto> notes,
            List<OrderHistorySummaryDto> recentOrders
    ) {}

    public record CreateVisitRequest(
            Long clientId,
            String quickClientName,
            String quickCnpj,
            String quickNeighborhood,
            String quickContactName,
            String quickPhone,
            @NotBlank String scheduledTime,
            String reminderNote
    ) {}

    public record AddNoteRequest(
            @NotBlank String content
    ) {}

    public record OrderItemRequest(
            @NotNull Long productId,
            Integer quantity,
            Integer dispatchQuantity,
            Integer baseQuantity,
            @NotNull BigDecimal unitSalePrice,
            boolean isPromotionalPrice
    ) {
        public int resolvedDispatchQuantity() {
            if (dispatchQuantity != null) return dispatchQuantity;
            return quantity != null ? quantity : 0;
        }

        public int resolvedBaseQuantity() {
            if (baseQuantity != null) return baseQuantity;
            if (quantity != null) return quantity;
            return resolvedDispatchQuantity();
        }
    }

    public record CreateOrderRequest(
            @NotNull Long clientId,
            @NotBlank String paymentTerms,
            String deliveryForecast,
            String notesForInvoiceOrDriver,
            BigDecimal shippingCostEstimate,
            @NotEmpty List<OrderItemRequest> items
    ) {}

    public record OrderItemDetailDto(
            Long id,
            Long productId,
            String skuCode,
            String erpCode,
            String productName,
            String shortName,
            String ncm,
            String cfop,
            Integer orderedQuantity,
            Integer dispatchQuantity,
            Integer baseQuantity,
            Integer quantity,
            BigDecimal orderedUnitPrice,
            BigDecimal unitSalePrice,
            BigDecimal unitCostSnapshot,
            BigDecimal itemSubtotal,
            boolean isPromotionalPrice,
            boolean hasBackofficeAdjustment,
            Integer productAvailableStock,
            Integer productPhysicalStock,
            Integer productBaseStock
    ) {}

    public record BackofficeOrderDto(
            Long id,
            Long clientId,
            String clientCorporateName,
            String clientTradeName,
            String clientCnpj,
            String clientStateRegistration,
            IeIndicator clientIeIndicator,
            PurchaseProfile clientPurchaseProfile,
            String clientStreet,
            String clientNumber,
            String clientNeighborhood,
            String clientCity,
            String clientState,
            String clientZipCode,
            String clientIbgeCityCode,
            boolean clientRegistrationComplete,
            FinancialStatus clientFinancialStatus,
            LocalDateTime createdAt,
            OrderStatus status,
            String paymentTerms,
            String deliveryForecast,
            String notesForInvoiceOrDriver,
            String backofficeAdjustmentNotes,
            BigDecimal shippingCostEstimate,
            BigDecimal originalCommercialTotal,
            BigDecimal grossTotal,
            BigDecimal totalCmvSnapshot,
            BigDecimal estimatedTaxSnapshot,
            BigDecimal netProfitSnapshot,
            BigDecimal netMarginPercentage,
            boolean hasCommercialVsFiscalDifference,
            NfeStatus nfeStatus,
            String nfeNumber,
            String nfeAccessKey,
            String danfePdfUrl,
            String xmlUrl,
            String sefazRejectionMessage,
            List<OrderItemDetailDto> items
    ) {}

    public record ReviewOrderItemUpdateDto(
            @NotNull Long productId,
            Integer quantity,
            Integer dispatchQuantity,
            Integer baseQuantity,
            @NotNull BigDecimal unitSalePrice
    ) {
        public int resolvedDispatchQuantity() {
            if (dispatchQuantity != null) return dispatchQuantity;
            return quantity != null ? quantity : 0;
        }

        public int resolvedBaseQuantity() {
            if (baseQuantity != null) return baseQuantity;
            if (quantity != null) return quantity;
            return resolvedDispatchQuantity();
        }
    }

    public record ReviewOrderRequest(
            @NotBlank String paymentTerms,
            String deliveryForecast,
            String notesForInvoiceOrDriver,
            String backofficeAdjustmentNotes,
            BigDecimal shippingCostEstimate,
            String clientCorporateName,
            String clientCnpj,
            String clientStateRegistration,
            IeIndicator clientIeIndicator,
            String clientZipCode,
            String clientStreet,
            String clientNumber,
            String clientNeighborhood,
            String clientCity,
            String clientState,
            String clientIbgeCityCode,
            @NotEmpty List<ReviewOrderItemUpdateDto> items
    ) {}

    public record CnpjLookupResponseDto(
            String cnpj,
            String corporateName,
            String tradeName,
            String zipCode,
            String street,
            String number,
            String complement,
            String neighborhood,
            String city,
            String state,
            String ibgeCityCode,
            String stateRegistrationSuggestion,
            String statusMessage,
            boolean fromLiveApi
    ) {}

    public record RomaneioDto(
            Long orderId,
            String orderStatus,
            String clientName,
            String contactName,
            String phone,
            String fullAddress,
            String neighborhood,
            String deliveryForecast,
            String driverNotes,
            int totalSacks,
            int totalWeightKg,
            String whatsappFormattedText,
            List<Map<String, Object>> blindItems
    ) {}

    public record ImportBatchItemRequest(
            @NotNull Long productId,
            @NotNull Integer quantityImported,
            @NotNull BigDecimal fobUnitUsd
    ) {}

    public record CreateImportBatchRequest(
            @NotBlank String batchCode,
            LocalDate arrivalDate,
            String supplierName,
            @NotNull BigDecimal exchangeRateUsd,
            @NotNull BigDecimal internationalFreightBrl,
            @NotNull BigDecimal importTaxesBrl,
            @NotNull BigDecimal customsExpensesBrl,
            String notes,
            @NotEmpty List<ImportBatchItemRequest> items
    ) {}

    public record ReceivableTitleDto(
            Long id,
            Long orderId,
            Long clientId,
            String clientName,
            String documentNumber,
            Integer installmentNumber,
            Integer totalInstallments,
            BigDecimal amountBq,
            LocalDate dueDate,
            String status,
            LocalDateTime paidAt,
            String notes,
            LocalDateTime createdAt
    ) {}

    public record AuditLogDto(
            Long id,
            String actorName,
            String actorRole,
            String actionType,
            String targetEntity,
            String targetId,
            String summary,
            LocalDateTime createdAt
    ) {}

    public record SkuTurnoverDto(
            Long productId,
            String skuCode,
            String name,
            Integer physicalStock,
            Integer baseStock,
            int sacksSoldDq,
            BigDecimal currentLandedCost,
            BigDecimal baseListPrice
    ) {}

    public record ExecutiveSummaryDto(
            BigDecimal grossRevenueReal,
            BigDecimal netProfitReal,
            BigDecimal averageMarginReal,
            int sacksDispatchedDq,
            int sacksBaseBq,
            BigDecimal totalReceivableBq,
            BigDecimal totalPaidBq,
            BigDecimal totalOverdueBq,
            BigDecimal stockValuationCost,
            BigDecimal stockValuationSale,
            List<SkuTurnoverDto> turnoverBySku,
            List<Map<String, Object>> monthlyEvolution
    ) {}

    public record ClientManagementDto(
            Long id,
            String corporateName,
            String tradeName,
            String cnpj,
            String stateRegistration,
            IeIndicator ieIndicator,
            PurchaseProfile purchaseProfile,
            String zipCode,
            String street,
            String number,
            String complement,
            String neighborhood,
            String city,
            String state,
            String ibgeCityCode,
            String contactName,
            String phone,
            String defaultPaymentTerms,
            Integer averagePurchaseCycleDays,
            FinancialStatus financialStatus,
            boolean isRegistrationComplete
    ) {}

    public record ProductUpdateDto(
            String name,
            String shortName,
            BigDecimal baseListPrice,
            BigDecimal currentLandedCost,
            Integer physicalStock,
            Integer baseStock,
            String ncm,
            String cest,
            String cBenef,
            BigDecimal estimatedTaxRate
    ) {}

    public record UpdateClientSkuPriceRequest(
            @NotNull Long clientId,
            @NotNull Long productId,
            @NotNull BigDecimal agreedPrice
    ) {}

    public record XmlClientImportResult(
            int totalFilesProcessed,
            int clientsCreated,
            int clientsUpdated,
            int pricesUpdated,
            List<String> importedClientNames,
            List<String> warnings,
            String message
    ) {}

    public record AppUserDto(
            Long id,
            String name,
            String email,
            String roleProfile,
            String allowedMode,
            Boolean active,
            String googleEmail,
            LocalDateTime lastLoginAt,
            LocalDateTime createdAt
    ) {}

    public record LoginRequest(
            @NotBlank String email,
            @NotBlank String password
    ) {}

    public record GoogleAuthRequest(
            String credential,
            String email,
            String name
    ) {}

    public record AuthResponse(
            String token,
            AppUserDto user
    ) {}

    public record SaveAppUserRequest(
            @NotBlank String name,
            @NotBlank String email,
            String password,
            String roleProfile,
            String allowedMode,
            Boolean active,
            String googleEmail
    ) {}
}

