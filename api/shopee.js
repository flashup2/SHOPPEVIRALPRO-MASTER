// api/shopee.js — Vercel Serverless Function
const crypto = require('crypto');

const APP_ID      = '18341840528';
const SECRET      = 'TQQACKSDJ4QUYI2HPNBBA5IWTSFVUCA3';
const SHOPEE_BASE = 'https://open-api.affiliate.shopee.com.br/graphql';

function generateSign(timestamp, payload) {
  // Formato correto Shopee Affiliate: SHA256(APP_ID + timestamp + payload + SECRET)
  const base = APP_ID + timestamp + payload + SECRET;
  return crypto.createHash('sha256').update(base).digest('hex');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const {
    action,
    keyword  = 'achados',
    limit    = '20',
    sortType = '2',
    url,
  } = req.query;

  if (action === 'generate_link' && !url) {
    return res.status(400).json({ error: 'Parâmetro "url" é obrigatório para generate_link' });
  }

  const queries = {
    search: {
      query: `{ productOfferV2(listType: 0, sortType: ${Number(sortType)}, limit: ${Number(limit)}, keyword: "${keyword}") { nodes { itemId shopId productName priceMin priceMax commissionRate commission sales imageUrl videoUrl shopName offerLink productLink } pageInfo { hasNextPage endCursor } } }`
    },
    generate_link: {
      query: `{ generateShortLink(input: { originUrl: "${url}", subId: "videx" }) { shortLink longLink } }`
    },
  };

  const body = queries[action];
  if (!body) return res.status(400).json({ error: `Ação inválida: ${action}` });

  const payload   = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sign      = generateSign(timestamp, payload);

  try {
    const upstream = await fetch(SHOPEE_BASE, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `SHA256 Credential=${APP_ID},Timestamp=${timestamp},Signature=${sign}`,
      },
      body: payload,
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Erro interno', detail: err.message });
  }
};
