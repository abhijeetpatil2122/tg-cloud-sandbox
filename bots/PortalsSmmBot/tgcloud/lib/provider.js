import { db, fetch } from 'sdk';
import { desc, eq } from 'sdk/db';
import { PROVIDER } from './config.js';
import { providerServices } from '../schema.js';

function telegramService(item) {
  // Supplier feeds may expose the platform in different fields.
  const searchable = [
    item?.social_network,
    item?.platform,
    item?.category,
    item?.name,
    item?.description,
  ].filter(value => typeof value === 'string' && value.trim()).join(' ');
  return /\btelegram\b|\btg\b/i.test(searchable);
}

function providerFlag(value) {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

async function requestProvider(action, extra = {}) {
  if (!PROVIDER.apiKey || PROVIDER.apiKey.length < 12) {
    throw new Error('Provider configuration is incomplete.');
  }
  const response = await fetch(PROVIDER.endpoint, {
    method: 'POST',
    body: fetch.body.form({
      key: PROVIDER.apiKey,
      action,
      ...extra,
    }),
  });
  if (!response.ok) throw new Error('Provider request failed.');
  const result = await response.json();
  if (result && !Array.isArray(result) && result.error) {
    throw new Error('Provider rejected the request.');
  }
  return result;
}

export async function checkProviderBalance() {
  const result = await requestProvider('balance');
  const balance = Number(result?.balance);
  if (!Number.isFinite(balance) || typeof result?.currency !== 'string') {
    throw new Error('Provider returned an unexpected balance response.');
  }
  return { balance, currency: result.currency };
}

export async function syncTelegramServices() {
  const result = await requestProvider('services');
  if (!Array.isArray(result)) throw new Error('Provider returned an unexpected service list.');

  const imported = [];
  for (const item of result) {
    const serviceId = Number(item?.service);
    const minQty = Number(item?.min);
    const maxQty = Number(item?.max);
    const rate = String(item?.rate ?? '');
    if (
      !Number.isSafeInteger(serviceId) || serviceId <= 0 ||
      !Number.isSafeInteger(minQty) || minQty < 0 ||
      !Number.isSafeInteger(maxQty) || maxQty < minQty ||
      !/^\d+(?:\.\d+)?$/.test(rate) ||
      !telegramService(item)
    ) continue;

    const record = {
      serviceId,
      name: String(item.name || 'Telegram service').slice(0, 160),
      type: String(item.type || 'Default').slice(0, 80),
      category: String(item.category || 'Telegram').slice(0, 120),
      rate,
      minQty,
      maxQty,
      refill: providerFlag(item.refill),
      cancel: providerFlag(item.cancel),
      isTelegram: true,
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(providerServices).values(record)
      .onConflictDoUpdate({
        target: providerServices.serviceId,
        set: {
          name: record.name,
          type: record.type,
          category: record.category,
          rate: record.rate,
          minQty: record.minQty,
          maxQty: record.maxQty,
          refill: record.refill,
          cancel: record.cancel,
          isTelegram: true,
          lastSyncedAt: record.lastSyncedAt,
          updatedAt: record.updatedAt,
        },
      }).run();
    imported.push(serviceId);
  }
  const categoriesSeen = [...new Set(result
    .map(item => String(item?.category || item?.social_network || item?.platform || '').trim())
    .filter(Boolean))].slice(0, 8);
  const serviceExamples = result.slice(0, 6)
    .map(item => String(item?.name || '').trim())
    .filter(Boolean);
  return {
    providerTotal: result.length,
    telegramImported: imported.length,
    categoriesSeen,
    serviceExamples,
  };
}

export async function listTelegramServices(enabledOnly = false) {
  const rows = await db.select().from(providerServices)
    .where(enabledOnly
      ? eq(providerServices.enabled, true)
      : eq(providerServices.isTelegram, true))
    .orderBy(desc(providerServices.enabled), providerServices.category, providerServices.serviceId)
    .all();
  return enabledOnly ? rows : rows.filter(item => item.isTelegram);
}

export async function setTelegramServicePrice(serviceId, points) {
  const amount = Number(points);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Price must be a positive whole number.');
  const item = await db.select().from(providerServices)
    .where(eq(providerServices.serviceId, Number(serviceId))).get();
  if (!item || !item.isTelegram) throw new Error('Telegram service not found.');
  await db.update(providerServices)
    .set({ customerPrice: amount, updatedAt: new Date() })
    .where(eq(providerServices.serviceId, Number(serviceId)))
    .run();
}

export async function setTelegramServiceEnabled(serviceId, enabled) {
  const item = await db.select().from(providerServices)
    .where(eq(providerServices.serviceId, Number(serviceId))).get();
  if (!item || !item.isTelegram) throw new Error('Telegram service not found.');
  if (enabled && (!Number.isSafeInteger(Number(item.customerPrice)) || Number(item.customerPrice) <= 0)) {
    throw new Error('Set a customer price before enabling this service.');
  }
  await db.update(providerServices)
    .set({ enabled: Boolean(enabled), updatedAt: new Date() })
    .where(eq(providerServices.serviceId, Number(serviceId)))
    .run();
}
