// backend/heartlandClient.ts
import 'dotenv/config';

const SUBDOMAIN = process.env.HEARTLAND_SUBDOMAIN;
const TOKEN     = process.env.HEARTLAND_API_TOKEN;

if (!SUBDOMAIN || !TOKEN) {
  throw new Error('Missing HEARTLAND_SUBDOMAIN or HEARTLAND_API_TOKEN env var');
}

export const BASE_URL = `https://${SUBDOMAIN}.retail.heartland.us/api`;

/**
 * Generic helper for Heartland API calls using global fetch.
 */
export async function heartlandFetch(
  path: string,
  opts: RequestInit = {}
) {
  const url = `${BASE_URL}${path}`;
  console.log(`Heartland API call: ${url}`, opts);
  const { headers = {}, ...rest } = opts;
  const resp = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...headers as Record<string, string>,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Heartland API ${resp.status} ${resp.statusText}: ${text}`);
  }
  const body = await resp.text();
  console.log(`Heartland API response: ${resp.status} ${resp.statusText}`, body);
  const json = body ? JSON.parse(body) : {};
  return json.results || {}   ;
}

/**
 * Create a new Purchase Order in Heartland.
 * POST /purchasing/orders
 */
export async function createPurchaseOrder(params: {
  public_id: string; // optional public ID for the PO
  vendor_id: number;
  receive_at_location_id: number;
  start_shipments_at?: string;
  end_shipments_at?: string;
  description?: string;
  status?: string;
}): Promise<number> {
  const resp = await fetch(`${BASE_URL}/purchasing/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Heartland create PO failed: ${resp.status} ${text}`);
  }

  const location = resp.headers.get('location');
  if (!location) {
    throw new Error('Missing location header in create PO response');
  }

  const parts = location.split('/');
  return parseInt(parts[parts.length - 1], 10);
}

/**
 * Add a line to an existing Purchase Order.
 * POST /purchasing/orders/{order_id}/lines
 */
export async function addLineToPurchaseOrder(
  orderId: number,
  line: {
    item_id: number;
    qty: number;
    unit_cost: number;
    qty_received?: number;
  }
): Promise<number> {
  const resp = await fetch(
    `${BASE_URL}/purchasing/orders/${orderId}/lines`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...line, order_id: orderId }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Heartland add PO line failed: ${resp.status} ${text}`);
  }

  const location = resp.headers.get('location');
  if (!location) {
    throw new Error('Missing location header in add PO line response');
  }

  const parts = location.split('/');
  return parseInt(parts[parts.length - 1], 10);
}

export async function getHeartlandItemByPublicId(publicId: string) {
  const resp = await heartlandFetch(`/items?public_id=${encodeURIComponent(publicId)}`);
  const foundItems = Array.isArray(resp) ? resp : resp.data || [];
  console.log("Found items:", foundItems);
  if (foundItems.length > 0) {
    return foundItems[0].id;
  } else {
    return null;
  }
}
