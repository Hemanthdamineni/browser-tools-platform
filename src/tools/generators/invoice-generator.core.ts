export function calculateInvoiceTotal(items: any[], taxRate: number = 0): number {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
  return subtotal * (1 + taxRate / 100);
}

export function formatMoney(amount: number): string {
  return amount.toFixed(2);
}
