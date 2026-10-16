export type OrderStatus =
  | 'RASCUNHO_LOCAL'
  | 'AGUARDANDO_REVISAO'
  | 'EM_SEPARACAO'
  | 'FATURADO'
  | 'ENTREGUE'
  | 'CANCELADO';

export type FinancialStatus = 'EM_DIA' | 'BOLETO_VENCIDO';
export type IeIndicator = 'CONTRIBUINTE' | 'ISENTO' | 'NAO_CONTRIBUINTE';
export type PurchaseProfile = 'REVENDA' | 'INDUSTRIALIZACAO' | 'CONSUMO';
export type NfeStatus = 'PENDENTE' | 'PROCESSANDO' | 'AUTORIZADA' | 'REJEITADA' | 'CANCELADA';

export interface ProductStock {
  id: number;
  skuCode: string;
  erpCode: string;
  name: string;
  shortName: string;
  unitOfMeasure: string;
  unitsPerBox: number;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
  currentLandedCost: number;
  baseListPrice: number;
  ncm: string;
  cest: string;
  cBenef: string;
  originCode: number;
  defaultCfopInternal: string;
  defaultCfopInterstate: string;
  estimatedTaxRate: number;
}

export interface TopbarSummary {
  products: ProductStock[];
  pendingNfeQueueCount: number;
}

export interface AgendaCard {
  clientId: number;
  visitId: number | null;
  corporateName: string;
  tradeName: string;
  cnpj: string | null;
  neighborhood: string;
  city: string;
  state: string;
  scheduledTime: string | null;
  visitStatus: string | null;
  reminderNote: string | null;
  daysSinceLastOrder: number;
  averagePurchaseCycleDays: number;
  needsRestockAlert: boolean;
  lastOrderTotal: number;
  financialStatus: FinancialStatus;
  isRegistrationComplete: boolean;
  latestNote: string;
}

export interface SkuPriceMemory {
  productId: number;
  skuCode: string;
  productName: string;
  shortName: string;
  lastPracticedPrice: number;
  agreedStandardPrice: number;
  baseListPrice: number;
  currentLandedCost: number;
  availableStock: number;
  lastOrderDate: string | null;
}

export interface ClientNote {
  id: number;
  formattedDate: string;
  createdAt: string;
  content: string;
}

export interface OrderHistorySummary {
  orderId: number;
  itemsSummary: string;
  metaInfo: string;
  status: OrderStatus;
  nfeNumber: string | null;
  grossTotal: number;
  createdAt: string;
}

export interface Client360 {
  id: number;
  corporateName: string;
  tradeName: string;
  cnpj: string | null;
  stateRegistration: string | null;
  ieIndicator: IeIndicator;
  purchaseProfile: PurchaseProfile;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  ibgeCityCode: string | null;
  fullAddress: string;
  contactName: string;
  phone: string | null;
  defaultPaymentTerms: string;
  averagePurchaseCycleDays: number;
  lastPurchaseDate: string | null;
  daysSinceLastOrder: number;
  lastOrderTotal: number;
  financialStatus: FinancialStatus;
  isRegistrationComplete: boolean;
  skuPrices: SkuPriceMemory[];
  notes: ClientNote[];
  recentOrders: OrderHistorySummary[];
}

export interface OrderItemDetail {
  id: number;
  productId: number;
  skuCode: string;
  erpCode: string;
  productName: string;
  shortName: string;
  ncm: string;
  cfop: string;
  orderedQuantity: number;
  quantity: number;
  orderedUnitPrice: number;
  unitSalePrice: number;
  unitCostSnapshot: number;
  itemSubtotal: number;
  isPromotionalPrice: boolean;
  hasBackofficeAdjustment: boolean;
  productAvailableStock: number;
  productPhysicalStock: number;
}

export interface BackofficeOrder {
  id: number;
  clientId: number;
  clientCorporateName: string;
  clientTradeName: string;
  clientCnpj: string | null;
  clientStateRegistration: string | null;
  clientIeIndicator: IeIndicator;
  clientPurchaseProfile: PurchaseProfile;
  clientStreet: string | null;
  clientNumber: string | null;
  clientNeighborhood: string | null;
  clientCity: string | null;
  clientState: string | null;
  clientZipCode: string | null;
  clientIbgeCityCode: string | null;
  clientRegistrationComplete: boolean;
  clientFinancialStatus: FinancialStatus;
  createdAt: string;
  status: OrderStatus;
  paymentTerms: string;
  deliveryForecast: string;
  notesForInvoiceOrDriver: string | null;
  backofficeAdjustmentNotes: string | null;
  shippingCostEstimate: number;
  originalCommercialTotal: number;
  grossTotal: number;
  totalCmvSnapshot: number;
  estimatedTaxSnapshot: number;
  netProfitSnapshot: number;
  netMarginPercentage: number;
  hasCommercialVsFiscalDifference: boolean;
  nfeStatus: NfeStatus;
  nfeNumber: string | null;
  nfeAccessKey: string | null;
  danfePdfUrl: string | null;
  xmlUrl: string | null;
  sefazRejectionMessage: string | null;
  items: OrderItemDetail[];
}

export interface CnpjLookupResponse {
  cnpj: string;
  corporateName: string;
  tradeName: string;
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  ibgeCityCode: string;
  stateRegistrationSuggestion: string;
  statusMessage: string;
  fromLiveApi: boolean;
}

export interface Romaneio {
  orderId: number;
  orderStatus: string;
  clientName: string;
  contactName: string;
  phone: string | null;
  fullAddress: string;
  neighborhood: string;
  deliveryForecast: string;
  driverNotes: string | null;
  totalSacks: number;
  totalWeightKg: number;
  whatsappFormattedText: string;
  blindItems: Array<{
    skuCode: string;
    productName: string;
    unitOfMeasure: string;
    quantity: number;
    weightKg: number;
  }>;
}

export interface ImportBatchItem {
  id: number;
  product: ProductStock;
  quantityImported: number;
  fobUnitUsd: number;
  calculatedUnitCostBrl: number;
}

export interface ImportBatch {
  id: number;
  batchCode: string;
  arrivalDate: string;
  supplierName: string;
  exchangeRateUsd: number;
  fobTotalUsd: number;
  internationalFreightBrl: number;
  importTaxesBrl: number;
  customsExpensesBrl: number;
  totalLandedCostBrl: number;
  notes: string | null;
  items: ImportBatchItem[];
}
