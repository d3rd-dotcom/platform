import Stripe from 'stripe';

/**
 * Server-side Stripe client for VIP Membership card payments.
 *
 * Requires STRIPE_SECRET_KEY. The webhook route additionally needs
 * STRIPE_WEBHOOK_SECRET, and the client needs NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
 */

let stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripe = new Stripe(key, {
      apiVersion: '2026-04-22.dahlia',
      typescript: true,
    });
  }
  return stripe;
}

/** Lifetime VIP Membership price: $888, charged once. */
export const MEMBERSHIP_PRICE_CENTS = 88800;

/** Recurring Member access: $20 per month. */
export const MONTHLY_MEMBERSHIP_PRICE_CENTS = 2000;
