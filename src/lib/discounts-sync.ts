/**
 * مزامنة الخصومات والعروض والكوبونات مع قاعدة البيانات السحابية.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PromoCoupon, QuantityTierOffer, BundleComboOffer, LoyaltyConfig } from "@/lib/discounts";

const table = (name: string) => (supabase.from as any)(name);

async function uid(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/* ==================== Push Functions ==================== */

export async function pushCoupon(coupon: PromoCoupon): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("promo_coupons").upsert({
    id: coupon.id,
    user_id,
    code: coupon.code,
    title: coupon.title,
    discount_type: coupon.discountType,
    discount_value: coupon.discountValue,
    min_order_value: coupon.minOrderValue,
    max_usage: coupon.maxUsage,
    used_count: coupon.usedCount,
    starts_at: coupon.startsAt,
    ends_at: coupon.endsAt,
    active: coupon.active,
    customer_eligibility: coupon.customerEligibility,
    notes: coupon.notes || null,
    is_loyalty_reward: coupon.isLoyaltyReward || false,
    customer_id: coupon.customerId || null,
  });
}

export async function removeCoupon(id: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("promo_coupons").delete().eq("user_id", user_id).eq("id", id);
}

export async function pushQtyOffer(offer: QuantityTierOffer): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("qty_offers").upsert({
    id: offer.id,
    user_id,
    title: offer.title,
    min_quantity: offer.minQuantity,
    discount_percentage: offer.discountPercentage,
    active: offer.active,
    notes: offer.notes || null,
  }, { onConflict: "id" });
}

export async function removeQtyOffer(id: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("qty_offers").delete().eq("user_id", user_id).eq("id", id);
}

export async function pushBundle(bundle: BundleComboOffer): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("bundles").upsert({
    id: bundle.id,
    user_id,
    title: bundle.title,
    item_keywords: bundle.itemKeywords,
    discount_amount: bundle.discountAmount,
    active: bundle.active,
    notes: bundle.notes || null,
  }, { onConflict: "id" });
}

export async function removeBundle(id: string): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("bundles").delete().eq("user_id", user_id).eq("id", id);
}

export async function pushLoyaltyConfig(config: LoyaltyConfig): Promise<void> {
  const user_id = await uid();
  if (!user_id) return;
  await table("loyalty_config").upsert({
    user_id,
    points_per_100_egp: config.pointsPer100Egp,
    point_value_egp: config.pointValueEgp,
    min_points_to_redeem: config.minPointsToRedeem,
    enabled: config.enabled,
  }, { onConflict: "user_id" });
}

/* ==================== Pull Function ==================== */

export async function pullDiscountsFromCloud(): Promise<boolean> {
  const user_id = await uid();
  if (!user_id) return false;

  const [couponsRes, qtyRes, bundleRes, loyaltyRes] = await Promise.all([
    table("promo_coupons").select("*").eq("user_id", user_id),
    table("qty_offers").select("*").eq("user_id", user_id),
    table("bundles").select("*").eq("user_id", user_id),
    table("loyalty_config").select("*").eq("user_id", user_id).maybeSingle(),
  ]);

  const mod = await import("@/lib/discounts");

  // Restore coupons
  if (!couponsRes.error && Array.isArray(couponsRes.data) && couponsRes.data.length > 0) {
    const coupons: PromoCoupon[] = couponsRes.data.map((r: any) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      discountType: r.discount_type,
      discountValue: Number(r.discount_value),
      minOrderValue: Number(r.min_order_value || 0),
      maxUsage: r.max_usage,
      usedCount: Number(r.used_count || 0),
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      active: r.active,
      customerEligibility: r.customer_eligibility || "all",
      notes: r.notes,
      createdAt: r.created_at,
      isLoyaltyReward: r.is_loyalty_reward || false,
      customerId: r.customer_id,
    }));
    localStorage.setItem("segilly_promo_coupons_v1", JSON.stringify(coupons));
  }

  // Restore qty offers
  if (!qtyRes.error && Array.isArray(qtyRes.data) && qtyRes.data.length > 0) {
    const offers: QuantityTierOffer[] = qtyRes.data.map((r: any) => ({
      id: r.id,
      title: r.title,
      minQuantity: Number(r.min_quantity),
      discountPercentage: Number(r.discount_percentage),
      active: r.active,
      notes: r.notes,
    }));
    localStorage.setItem("segilly_qty_offers_v1", JSON.stringify(offers));
  }

  // Restore bundles
  if (!bundleRes.error && Array.isArray(bundleRes.data) && bundleRes.data.length > 0) {
    const bundles: BundleComboOffer[] = bundleRes.data.map((r: any) => ({
      id: r.id,
      title: r.title,
      itemKeywords: r.item_keywords || [],
      discountAmount: Number(r.discount_amount),
      active: r.active,
      notes: r.notes,
    }));
    localStorage.setItem("segilly_bundles_v1", JSON.stringify(bundles));
  }

  // Restore loyalty config
  if (!loyaltyRes.error && loyaltyRes.data) {
    const cfg: LoyaltyConfig = {
      enabled: loyaltyRes.data.enabled,
      pointsPer100Egp: Number(loyaltyRes.data.points_per_100_egp || 2),
      pointValueEgp: Number(loyaltyRes.data.point_value_egp || 1),
      minPointsToRedeem: Number(loyaltyRes.data.min_points_to_redeem || 25),
    };
    localStorage.setItem("segilly_loyalty_config_v1", JSON.stringify(cfg));
  }

  return true;
}
