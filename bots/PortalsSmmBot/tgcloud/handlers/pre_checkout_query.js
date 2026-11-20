import { api } from 'sdk';
import { validatePreCheckout } from '../lib/payments.js';

export default async function handlePreCheckoutQuery(query) {
  if (!query?.id) return;
  try {
    await validatePreCheckout(query);
  } catch (error) {
    console.error('Pre-checkout handler failed:', error?.description || error?.stack || error);
    try {
      await api.answerPreCheckoutQuery({
        pre_checkout_query_id: query.id,
        ok: false,
        error_message: 'We could not verify this invoice. Please create a new deposit.',
      });
    } catch (answerError) {
      console.error('Pre-checkout rejection failed:', answerError?.description || answerError);
    }
  }
}
