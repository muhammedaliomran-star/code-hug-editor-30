import { describe, it, expect } from "vitest";
import {
  calculateShippingCost,
  expectedDeliveryDate,
  shipmentSla,
  FREE_WEIGHT_KG,
  EXTRA_KG_PRICE,
  EXTRA_PIECE_PRICE,
  type PricingInput,
} from "@/lib/shipping-pricing";
import type { Shipment, ShippingZone, ShipmentCarrier } from "@/lib/store";

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: "shp-1", invoiceId: "inv-1", carrierId: "c-1", zoneId: "z-1",
    trackingNumber: "TRK-001", status: "pending", recipientName: "محمد",
    recipientPhone: "01012345678", deliveryAddress: "القاهرة",
    actualDeliveryDate: null, processingAt: null, shippedAt: null,
    deliveredAt: null, returnedAt: null, statusUpdatedBy: null,
    shippingCost: 0, codAmount: 0, collectionStatus: "uncollected",
    collectedAt: null, settledAt: null, weightKg: 2, pieces: 1,
    expectedDeliveryDate: null, notes: null, createdAt: "2026-06-15",
    ...overrides,
  };
}

describe("calculateShippingCost", () => {
  const zone: ShippingZone = {
    id: "z-1", name: "القاهرة", carrierId: "c-1",
    deliveryCost: 50, estimatedDays: 2, createdAt: "2026-01-01",
  };

  it("returns zone base cost with no extras", () => {
    const result = calculateShippingCost({ zone, weightKg: 2, pieces: 1 });
    expect(result.base).toBe(50);
    expect(result.weightExtra).toBe(0);
    expect(result.piecesExtra).toBe(0);
    expect(result.total).toBe(50);
  });

  it("adds extra weight cost", () => {
    const result = calculateShippingCost({ zone, weightKg: 8, pieces: 1 });
    expect(result.weightExtra).toBe(3 * EXTRA_KG_PRICE);
    expect(result.total).toBe(50 + 30);
  });

  it("adds extra pieces cost", () => {
    const result = calculateShippingCost({ zone, weightKg: 1, pieces: 3 });
    expect(result.piecesExtra).toBe(2 * EXTRA_PIECE_PRICE);
    expect(result.total).toBe(50 + 10);
  });

  it("combines weight + pieces", () => {
    const result = calculateShippingCost({ zone, weightKg: 10, pieces: 2 });
    expect(result.total).toBe(50 + 50 + 5);
  });

  it("free weight up to 5kg", () => {
    const result = calculateShippingCost({ zone, weightKg: 5, pieces: 1 });
    expect(result.weightExtra).toBe(0);
  });

  it("carrier base cost when no zone", () => {
    const carrier: ShipmentCarrier = {
      id: "c-1", name: "مندوب", contactPerson: null, phone: null,
      email: null, baseCost: 75, active: true, createdAt: "2026-01-01",
    };
    const result = calculateShippingCost({ carrier, weightKg: 1, pieces: 1 });
    expect(result.base).toBe(75);
  });

  it("handles zero weight and pieces", () => {
    const result = calculateShippingCost({ zone, weightKg: 0, pieces: 0 });
    expect(result.piecesExtra).toBe(0);
    expect(result.total).toBe(50);
  });

  it("handles undefined input", () => {
    const result = calculateShippingCost({});
    expect(result.total).toBe(0);
  });

  it("generates pricing lines", () => {
    const result = calculateShippingCost({ zone, weightKg: 8, pieces: 2 });
    expect(result.lines.length).toBe(3);
  });
});

describe("expectedDeliveryDate", () => {
  it("adds zone estimated days", () => {
    const zone: ShippingZone = {
      id: "z-1", name: "test", carrierId: "c-1",
      deliveryCost: 0, estimatedDays: 5, createdAt: "2026-01-01",
    };
    const result = expectedDeliveryDate("2026-06-15", zone);
    expect(result).toBe("2026-06-20");
  });

  it("defaults to 3 days when no zone", () => {
    const result = expectedDeliveryDate("2026-06-15");
    expect(result).toBe("2026-06-18");
  });

  it("handles Date object input", () => {
    const result = expectedDeliveryDate(new Date("2026-06-15"), { estimatedDays: 2 } as ShippingZone);
    expect(result).toBe("2026-06-17");
  });
});

describe("shipmentSla", () => {
  it("returns closed for delivered shipments", () => {
    const result = shipmentSla(makeShipment({ status: "delivered" }));
    expect(result.state).toBe("closed");
    expect(result.label).toBe("مُغلقة");
  });

  it("returns on_time when expected date is in future", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const result = shipmentSla(makeShipment({
      status: "shipped",
      expectedDeliveryDate: futureDate.toISOString().slice(0, 10),
    }));
    expect(result.state).toBe("on_time");
  });

  it("returns due_today when expected date is today", () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = shipmentSla(makeShipment({ status: "shipped", expectedDeliveryDate: today }));
    expect(result.state).toBe("due_today");
  });

  it("returns late when expected date is past", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const result = shipmentSla(makeShipment({
      status: "pending",
      expectedDeliveryDate: pastDate.toISOString().slice(0, 10),
    }));
    expect(result.state).toBe("late");
    expect(result.daysLate).toBeGreaterThanOrEqual(3);
  });

  it("uses expectedDeliveryDate from shipment if available", () => {
    const result = shipmentSla(makeShipment({
      status: "shipped",
      expectedDeliveryDate: "2099-12-31",
    }));
    expect(result.state).toBe("on_time");
    expect(result.expected).toBe("2099-12-31");
  });
});