// api/shopee.js — Vercel Serverless Function
const crypto = require('crypto');

const APP_ID      = '18341840528';
const SECRET      = 'TQQACKSDJ4QUYI2HPNBBA5IWTSFVUCA3';
const SHOPEE_BASE = 'https://open-api.affiliate.shopee.com.br/graphql';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, keyword = 'achados', limit = '20', sortType = '2', url } = req.query;

  if (action === 'generate_link' && !url) {
    return res.status(400).json({ error: '"url" obrigatório' });
  }

  let queryStr;
  if (action === 'search') {
    queryStr = `{\n  productOfferV2(listType: 0, sortType: ${Number(sortType)}, limit: ${Number(limit)}, keyword: "${keyword}") {\n    nodes {\n      itemId\n      shopId\n      productName\n      priceMin\n      priceMax\n      commissionRate\n      commission\n      sales\n      imageUrl\n      videoUrl\n      shopName\n      offerLink\n      productLink\n    }\n    pageInfo {\n      hasNextPage\n      endCursor\n    }\n  }\n}`;
  } else if (action === 'generate_link') {
    queryStr = `{\n  generateShortLink(input: { originUrl: "${url}", subId: "videx" }) {\n    shortLink\n    longLink\n  }\n}`;
  } else {
    return res.status(400).json({ error: `Ação inválida: ${action}` });
  }

  // Payload: JSON com \n literais dentro da string query (como no exemplo da doc)
  const payload = JSON.stringify({ query: queryStr });

  const timestamp = String(Math.floor(Date.now() / 1000));

  // factor = AppId + Timestamp + Payload + Secret (doc oficial)
  const factor = APP_ID + timestamp + payload + SECRET;
  const sign   = crypto.createHash('sha256').update(factor).digest('hex');

  // Header exato da doc: SHA256 Credential=${AppId}, Timestamp=${Timestamp}, Signature=${signature}
  const authHeader = `SHA256 Credential=${APP_ID}, Timestamp=${timestamp}, Signature=${sign}`;

  try {
    const upstream = await fetch(SHOPEE_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
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
