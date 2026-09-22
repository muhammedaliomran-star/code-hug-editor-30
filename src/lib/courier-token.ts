/**
 * Phase 2 (security review): passwordless courier portals via per-carrier tokens.
 *
 * - Owner shares `/courier?token=<courier_token>` with the courier.
 * - The portal loads ONLY that carrier's board through scoped RPCs —
 *   no session, no UUID enumeration, no other carrier's data.
 * - Token RPCs are NOT in generated types yet (next regen picks them up),
 *   so calls go through a minimal local cast, same as other custom RPCs.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Shipment, ShipmentCarrier, ShipmentStatus } from "@/types";

export interface CourierBoard {
  carrier: ShipmentCarrier;
  shipments: Shipment[];
}

type SnakeCarrier = Record<string, unknown>;
type SnakeShipment = Record<string, unknown>;

const num = (v: unknown, d = 0) => Number((v as number | null) ?? d) || d;
const str = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);

function mapCarrier(r: SnakeCarrier): ShipmentCarrier {
  return {
    id: String(r.id),
    name: String(r.name ?? ""),
    contactPerson: str(r.contact_person),
    phone: str(r.phone),
    email: str(r.email),
    baseCost: num(r.base_cost),
    active: r.active !== false,
    createdAt: String(r.created_at ?? ""),
  };
}

function mapShipment(r: SnakeShipment): Shipment {
  return {
    id: String(r.id),
    invoiceId: str(r.invoice_id),
    carrierId: str(r.carrier_id),
    zoneId: str(r.zone_id),
    trackingNumber: str(r.tracking_number),
    status: (str(r.status) ?? "pending") as ShipmentStatus,
    recipientName: str(r.recipient_name),
    recipientPhone: str(r.recipient_phone),
    deliveryAddress: str(r.delivery_address),
    actualDeliveryDate: str(r.actual_delivery_date),
    processingAt: str(r.processing_at),
    shippedAt: str(r.shipped_at),
    deliveredAt: str(r.delivered_at),
    returnedAt: str(r.returned_at),
    statusUpdatedBy: str(r.status_updated_by),
    shippingCost: num(r.shipping_cost),
    codAmount: num(r.cod_amount),
    collectionStatus: (str(r.collection_status) ?? "uncollected") as Shipment["collectionStatus"],
    collectedAt: str(r.collected_at),
    settledAt: str(r.settled_at),
    weightKg: num(r.weight_kg),
    pieces: num(r.pieces, 1),
    expectedDeliveryDate: str(r.expected_delivery_date),
    notes: str(r.notes),
    createdAt: String(r.created_at ?? ""),
  };
}

/** Read ?token= from the URL (the only credential the portals accept). */
export function getPortalToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = new URLSearchParams(window.location.search).get("token");
  return t && t.trim() ? t.trim() : null;
}

/** Build the shareable portal link for a carrier token. */
export function buildCourierLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/courier?token=${encodeURIComponent(token)}`;
}

/** Generate a fresh 128-bit hex token (client-side, for rotation). */
export function freshCourierToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useCourierBoard(token: string | null) {
  const [board, setBoard] = useState<CourierBoard | null>(null);
  const [loading, setLoading] = useState<boolean>(!!token);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase as any).rpc("get_courier_board", {
        p_token: token,
      });
      if (rpcError) throw rpcError;
      const carrier = mapCarrier((data?.carrier ?? {}) as SnakeCarrier);
      const shipments = Array.isArray(data?.shipments)
        ? (data.shipments as SnakeShipment[]).map(mapShipment)
        : [];
      setBoard({ carrier, shipments });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل لوحة المندوب");
      setBoard(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
    else {
      setBoard(null);
      setLoading(false);
    }
  }, [token, load]);

  const updateStatus = useCallback(
    async (shipmentId: string, status: "delivered" | "returned", reason?: string) => {
      if (!token) throw new Error("لا يوجد رمز دخول");
      const { error: rpcError } = await (supabase as any).rpc("courier_update_shipment", {
        p_token: token,
        p_shipment_id: shipmentId,
        p_status: status,
        p_reason: reason ?? null,
      });
      if (rpcError) throw rpcError;
      await load();
    },
    [token, load],
  );

  return { board, loading, error, refresh: load, updateStatus };
}
