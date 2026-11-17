export type OrderSource = "demo" | "storefront";
export type OrderStatus = "completed" | "pending" | "cancelled";
export type SalesFilter = "all" | OrderSource;

export interface OrderLineSnapshot {
  productId: string;
  name: string;
  categorySlug: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface OrderRecord {
  id: string;
  source: OrderSource;
  status: OrderStatus;
  customerId: string;
  customerName: string;
  currency: "EUR";
  items: OrderLineSnapshot[];
  totalCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesSummary {
  filter: SalesFilter;
  orderCount: number;
  completedCount: number;
  pendingCount: number;
  cancelledCount: number;
  revenueCents: number;
  averageOrderValueCents: number;
  sourceTotals: { demo: number; storefront: number };
  monthly: { month: string; label: string; revenueCents: number; completedOrders: number }[];
  topProducts: { productId: string; name: string; quantity: number; revenueCents: number }[];
  recentOrders: {
    id: string;
    source: OrderSource;
    status: OrderStatus;
    customerName: string;
    itemCount: number;
    createdAt: string;
    totalCents: number;
  }[];
  recordedAt: string;
}

const sources = new Set<OrderSource>(["demo", "storefront"]);
const statuses = new Set<OrderStatus>(["completed", "pending", "cancelled"]);

export function isOrderRecord(raw: unknown): raw is OrderRecord {
  if (!raw || typeof raw !== "object") return false;
  const value = raw as Partial<OrderRecord>;
  return (
    typeof value.id === "string" && value.id.length > 0 &&
    sources.has(value.source as OrderSource) &&
    statuses.has(value.status as OrderStatus) &&
    typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) &&
    typeof value.customerName === "string" &&
    value.currency === "EUR" &&
    Number.isSafeInteger(value.totalCents) && value.totalCents! >= 0 &&
    Array.isArray(value.items) && value.items.every(item =>
      item && typeof item.productId === "string" &&
      typeof item.name === "string" &&
      Number.isSafeInteger(item.unitPriceCents) && item.unitPriceCents >= 0 &&
      Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
      Number.isSafeInteger(item.lineTotalCents) &&
      item.lineTotalCents === item.unitPriceCents * item.quantity
    ) &&
    value.items.reduce((sum, item) => sum + item.lineTotalCents, 0) === value.totalCents
  );
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function recentMonths(now: Date, count = 6): { month: string; label: string }[] {
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1));
    return { month: monthKey(d), label: d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }) };
  });
}

export function summarizeSales(raw: unknown[], filter: SalesFilter = "all", now = new Date()): SalesSummary {
  const valid = raw.filter(isOrderRecord);
  const sourceTotals = {
    demo: valid.filter(item => item.source === "demo").length,
    storefront: valid.filter(item => item.source === "storefront").length,
  };
  const orders = filter === "all" ? valid : valid.filter(item => item.source === filter);
  const completed = orders.filter(item => item.status === "completed");
  const revenueCents = completed.reduce((sum, item) => sum + item.totalCents, 0);
  const months = recentMonths(now).map(item => ({ ...item, revenueCents: 0, completedOrders: 0 }));
  const byMonth = new Map(months.map(item => [item.month, item]));
  const productTotals = new Map<string, { productId: string; name: string; quantity: number; revenueCents: number }>();

  for (const order of completed) {
    const month = byMonth.get(order.createdAt.slice(0, 7));
    if (month) {
      month.revenueCents += order.totalCents;
      month.completedOrders += 1;
    }
    for (const item of order.items) {
      const previous = productTotals.get(item.productId) ?? {
        productId: item.productId, name: item.name, quantity: 0, revenueCents: 0,
      };
      previous.quantity += item.quantity;
      previous.revenueCents += item.lineTotalCents;
      productTotals.set(item.productId, previous);
    }
  }

  return {
    filter,
    orderCount: orders.length,
    completedCount: completed.length,
    pendingCount: orders.filter(item => item.status === "pending").length,
    cancelledCount: orders.filter(item => item.status === "cancelled").length,
    revenueCents,
    averageOrderValueCents: completed.length ? Math.round(revenueCents / completed.length) : 0,
    sourceTotals,
    monthly: months,
    topProducts: [...productTotals.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)).slice(0, 5),
    recentOrders: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 8).map(order => ({
      id: order.id,
      source: order.source,
      status: order.status,
      customerName: order.customerName,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt,
      totalCents: order.totalCents,
    })),
    recordedAt: now.toISOString(),
  };
}
