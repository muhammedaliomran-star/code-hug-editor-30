-- Drop Storefront Module: removes all storefront-related tables, enums, and RPCs.
-- This migration decommissions the e-commerce storefront feature entirely.

-- 1. Drop triggers first
DROP TRIGGER IF EXISTS store_order_event_notification ON public.store_order_events;
DROP TRIGGER IF EXISTS store_order_state_guard ON public.store_orders;

-- 2. Drop functions (SECURITY DEFINER)
DROP FUNCTION IF EXISTS public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid, text, text);
DROP FUNCTION IF EXISTS public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid, text);
DROP FUNCTION IF EXISTS public.submit_store_order(uuid, text, text, text, text, text, public.store_order_type, jsonb, uuid);
DROP FUNCTION IF EXISTS public.accept_store_order(uuid);
DROP FUNCTION IF EXISTS public.invoice_store_order(uuid);
DROP FUNCTION IF EXISTS public.invoice_store_order_installment(uuid, numeric, numeric, text, integer);
DROP FUNCTION IF EXISTS public.update_store_order_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.cancel_store_order(uuid, text);
DROP FUNCTION IF EXISTS public.expire_storefront_reservations();
DROP FUNCTION IF EXISTS public.get_public_storefront(text);
DROP FUNCTION IF EXISTS public.get_public_storefront_with_settings(text);
DROP FUNCTION IF EXISTS public.get_public_product(text);
DROP FUNCTION IF EXISTS public.get_public_order_status(text, text);
DROP FUNCTION IF EXISTS public.create_storefront_sale_return(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.reverse_storefront_sale_return(uuid);
DROP FUNCTION IF EXISTS public.notify_storefront_event();
DROP FUNCTION IF EXISTS public.validate_storefront_coupon(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.redeem_storefront_coupon(uuid, text, numeric);
DROP FUNCTION IF EXISTS public.get_storefront_feature_flag(uuid, text);
DROP FUNCTION IF EXISTS public.get_storefront_analytics_summary(uuid, integer);
DROP FUNCTION IF EXISTS public.record_storefront_event(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.assign_storefront_shipment(uuid, uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.update_storefront_shipment_status(uuid, text, text);
DROP FUNCTION IF EXISTS public.get_storefront_payment_config(uuid);
DROP FUNCTION IF EXISTS public.save_storefront_payment_config(text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.record_storefront_payment(uuid, text, text, integer, text, text, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.is_online_payment_enabled(uuid);
DROP FUNCTION IF EXISTS public.guard_store_order_transition() CASCADE;
DROP FUNCTION IF EXISTS public.sync_late_shipment_notifications();

-- 3. Drop tables (children first, then parents)
DROP TABLE IF EXISTS public.storefront_payments CASCADE;
DROP TABLE IF EXISTS public.storefront_payment_config CASCADE;
DROP TABLE IF EXISTS public.storefront_notifications CASCADE;
DROP TABLE IF EXISTS public.storefront_analytics_events CASCADE;
DROP TABLE IF EXISTS public.storefront_domains CASCADE;
DROP TABLE IF EXISTS public.storefront_feature_flags CASCADE;
DROP TABLE IF EXISTS public.storefront_coupons CASCADE;
DROP TABLE IF EXISTS public.store_order_events CASCADE;
DROP TABLE IF EXISTS public.store_order_items CASCADE;
DROP TABLE IF EXISTS public.stock_reservations CASCADE;
DROP TABLE IF EXISTS public.store_orders CASCADE;
DROP TABLE IF EXISTS public.storefront_products CASCADE;
DROP TABLE IF EXISTS public.storefront_categories CASCADE;
DROP TABLE IF EXISTS public.storefronts CASCADE;

-- 4. Drop enums
DROP TYPE IF EXISTS public.store_order_status CASCADE;
DROP TYPE IF EXISTS public.store_order_type CASCADE;
DROP TYPE IF EXISTS public.stock_reservation_status CASCADE;

-- Note: shipment_status and shipping_carriers/shipping_zones/shipments are kept
-- because they are used by the core shipping system independent of the storefront.
