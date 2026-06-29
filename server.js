const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Tebex - API Headless
const TEBEX_PUBLIC_TOKEN = process.env.TEBEX_PUBLIC_TOKEN;
const TEBEX_PRIVATE_KEY = process.env.TEBEX_PRIVATE_KEY;
const TEBEX_WEBHOOK_SECRET = process.env.TEBEX_WEBHOOK_SECRET;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const TEBEX_API_BASE = "https://headless.tebex.io/api";

// Cache de productos reales de Tebex
let tebexProductsCache = [];
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minuto

// --- Almacenamiento de compras (Compras Recientes + Top Comprador) ---
const DATA_DIR = path.join(__dirname, 'data');
const PURCHASES_FILE = path.join(DATA_DIR, 'purchases.json');
let purchasesCache = [];

function ensureDataDir() {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    } catch (e) {
        console.error('[Data] Error creando directorio data:', e.message);
    }
}

function loadPurchases() {
    try {
        ensureDataDir();
        if (fs.existsSync(PURCHASES_FILE)) {
            const raw = fs.readFileSync(PURCHASES_FILE, 'utf-8');
            purchasesCache = JSON.parse(raw);
            console.log(`[Data] ${purchasesCache.length} compras cargadas desde archivo`);
        }
    } catch (e) {
        console.error('[Data] Error cargando compras:', e.message);
        purchasesCache = [];
    }
}

function savePurchases() {
    try {
        ensureDataDir();
        fs.writeFileSync(PURCHASES_FILE, JSON.stringify(purchasesCache, null, 2), 'utf-8');
    } catch (e) {
        console.error('[Data] Error guardando compras:', e.message);
    }
}

function addPurchase(purchaseData) {
    purchasesCache.unshift(purchaseData);
    if (purchasesCache.length > 200) {
        purchasesCache = purchasesCache.slice(0, 200);
    }
    savePurchases();
}

function getRecentPurchases(limit = 12) {
    return purchasesCache.slice(0, limit);
}

function getTopBuyer() {
    if (purchasesCache.length === 0) return null;
    const totals = {};
    for (const p of purchasesCache) {
        const nick = p.nickname || 'Desconocido';
        if (!totals[nick]) totals[nick] = 0;
        totals[nick] += p.amount || 0;
    }
    let topNick = null;
    let topAmount = 0;
    for (const [nick, total] of Object.entries(totals)) {
        if (total > topAmount) {
            topAmount = total;
            topNick = nick;
        }
    }
    return topNick ? { nickname: topNick, total: topAmount } : null;
}

loadPurchases();

function tebexHeaders(extra = {}) {
    const base64 = Buffer.from(`${TEBEX_PUBLIC_TOKEN}:${TEBEX_PRIVATE_KEY}`).toString('base64');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${base64}`,
        ...extra
    };
}

async function fetchTebexProducts() {
    const now = Date.now();
    if (tebexProductsCache.length > 0 && (now - lastFetchTime) < CACHE_TTL) {
        return tebexProductsCache;
    }
    
    try {
        const url = `${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/packages`;
        const res = await fetch(url, { headers: tebexHeaders() });
        
        if (res.ok) {
            const data = await res.json();
            tebexProductsCache = data?.data || [];
            lastFetchTime = now;
            console.log(`[Tebex] Productos sincronizados: ${tebexProductsCache.length}`);
        } else {
            console.error(`[Tebex] Error sincronizando productos: ${res.status}`);
        }
    } catch (e) {
        console.error(`[Tebex] Error fetch productos:`, e.message);
    }
    
    return tebexProductsCache;
}

app.use(cors());

app.use(bodyParser.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

app.use(express.static('.'));

// ============================================================
// API ENDPOINTS
// ============================================================

// 1. Categorías y productos desde Tebex
app.get('/api/tebex/categories', async (req, res) => {
    console.log(`[Tebex] Cargando productos desde Tebex...`);
    try {
        const url = `${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/categories?includePackages=1`;
        const response = await fetch(url, { headers: tebexHeaders() });
        
        console.log(`[Tebex] Status categorías: ${response.status}`);

        if (response.ok) {
            const data = await response.json();
            const hasProducts = data?.data?.some(cat => cat.packages && cat.packages.length > 0);
            
            if (hasProducts) {
                console.log(`[Tebex] Sirviendo ${data.data.length} categorías con productos reales`);
                await fetchTebexProducts();
                return res.json(data);
            } else {
                console.log(`[Tebex] No hay productos configurados en Tebex`);
                return res.json({ data: [], message: "No hay productos disponibles en Tebex. Configúralos en https://creator.tebex.io" });
            }
        }
        
        console.error(`[Tebex] API respondió con error ${response.status}`);
        res.status(502).json({ error: "Error conectando con Tebex", data: [] });
    } catch (e) {
        console.error(`[Tebex] Error categorías:`, e.message);
        res.status(500).json({ error: e.message, data: [] });
    }
});

// 2. Validate coupon — creates temporary basket, applies coupon, returns discount info
app.post('/api/tebex/validate-coupon', async (req, res) => {
    const { coupon, cart } = req.body;
    
    if (!coupon || !coupon.trim()) {
        return res.json({ valid: false, error: "Ingresa un código de cupón" });
    }
    
    if (!cart || cart.length === 0) {
        return res.json({ valid: false, error: "El carrito está vacío" });
    }

    try {
        // 1. Create temporal basket
        const basketRes = await fetch(`${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/baskets`, {
            method: 'POST',
            headers: tebexHeaders(),
            body: JSON.stringify({
                username: 'validator',
                ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '127.0.0.1',
                complete_url: 'http://localhost:3000',
                cancel_url: 'http://localhost:3000'
            })
        });

        if (!basketRes.ok) {
            return res.json({ valid: false, error: "Error conectando con Tebex" });
        }

        const basketData = await basketRes.json();
        const ident = basketData?.data?.ident;
        if (!ident) {
            return res.json({ valid: false, error: "Error creando basket" });
        }

        // 2. Add packages to basket
        for (const item of cart) {
            await fetch(`${TEBEX_API_BASE}/baskets/${ident}/packages`, {
                method: 'POST',
                headers: tebexHeaders(),
                body: JSON.stringify({ package_id: item.id, quantity: item.qty || 1 })
            });
        }

        // 3. Apply coupon
        const coupRes = await fetch(`${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/baskets/${ident}/coupons`, {
            method: 'POST',
            headers: tebexHeaders(),
            body: JSON.stringify({ coupon_code: coupon.trim() })
        });

        if (!coupRes.ok) {
            // Coupon inválido — limpiar basket
            return res.json({ valid: false, error: "❌ Cupón inválido o expirado" });
        }

        // 4. Fetch basket with discount info
        const basketGetRes = await fetch(`${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/baskets/${ident}`, {
            headers: tebexHeaders()
        });

        if (!basketGetRes.ok) {
            return res.json({ valid: false, error: "Error verificando cupón" });
        }

        const basketFull = await basketGetRes.json();
        const basket = basketFull?.data;

        // 5. Calculate discount from package prices vs total price
        let originalTotal = 0;
        for (const pkg of (basket?.packages || [])) {
            originalTotal += (parseFloat(pkg.base_price?.amount || 0) * (pkg.quantity || 1));
        }
        const totalWithDiscount = parseFloat(basket?.total_price || originalTotal);
        const discountAmount = Math.max(0, originalTotal - totalWithDiscount);
        const discountPercent = originalTotal > 0 ? Math.round((discountAmount / originalTotal) * 100) : 0;

        // 6. Delete the temporal basket
        try {
            await fetch(`${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/baskets/${ident}`, {
                method: 'DELETE',
                headers: tebexHeaders()
            });
        } catch (e) {
            // Ignore delete errors
        }

        return res.json({
            valid: true,
            coupon_code: coupon.trim(),
            original_total: originalTotal,
            discount_amount: discountAmount,
            discount_percent: discountPercent,
            total: totalWithDiscount,
            currency: basket?.currency || 'USD'
        });

    } catch (e) {
        console.error('[Tebex] Error validando cupón:', e.message);
        res.json({ valid: false, error: "Error de conexión" });
    }
});

// 3. Checkout
app.post('/api/tebex-checkout', async (req, res) => {
    const { nick, cart, coupon } = req.body;
    console.log(`[Tebex] Checkout para ${nick} con ${cart?.length || 0} items`);

    if (!nick || !cart || cart.length === 0) {
        return res.status(400).json({ error: "Falta nickname o carrito" });
    }

    try {
        const realProducts = await fetchTebexProducts();
        const realProductIds = new Set(realProducts.map(p => p.id));

        for (const item of cart) {
            if (!realProductIds.has(item.id)) {
                console.error(`[Tebex] Producto ID ${item.id} no existe en Tebex`);
                return res.status(400).json({ 
                    error: `El producto "${item.name}" (ID: ${item.id}) no existe en Tebex. Debes crearlo primero en https://creator.tebex.io/ y luego actualizar el servidor.`,
                    invalidProduct: item
                });
            }
        }

        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                         req.connection?.remoteAddress || 
                         '127.0.0.1';

        console.log(`[Tebex] Creando basket...`);
        const basketRes = await fetch(`${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/baskets`, {
            method: 'POST',
            headers: tebexHeaders(),
            body: JSON.stringify({
                username: nick,
                ip_address: clientIp,
                complete_url: req.headers.origin || "http://localhost:3000",
                cancel_url: req.headers.origin || "http://localhost:3000",
                complete_auto_redirect: true
            })
        });

        if (!basketRes.ok) {
            const errText = await basketRes.text();
            console.error(`[Tebex] Error creando basket (${basketRes.status}): ${errText}`);
            return res.status(502).json({ error: "Error creando basket en Tebex" });
        }

        const basketData = await basketRes.json();
        const ident = basketData?.data?.ident;
        
        if (!ident) {
            console.error(`[Tebex] Basket sin ident:`, JSON.stringify(basketData));
            return res.status(502).json({ error: "Basket creado sin ident" });
        }
        
        console.log(`[Tebex] Basket creado: ${ident}`);

        for (const item of cart) {
            console.log(`[Tebex] Agregando paquete ID ${item.id} x${item.qty || 1}`);
            const addRes = await fetch(`${TEBEX_API_BASE}/baskets/${ident}/packages`, {
                method: 'POST',
                headers: tebexHeaders(),
                body: JSON.stringify({ package_id: item.id, quantity: item.qty || 1 })
            });
            
            if (!addRes.ok) {
                const addText = await addRes.text();
                console.error(`[Tebex] Error agregando paquete ${item.id}: ${addText}`);
                return res.status(502).json({ 
                    error: `Error agregando producto "${item.name}" al basket. Verifica que existe en Tebex.`,
                    productId: item.id
                });
            }
            console.log(`[Tebex] Paquete ${item.id} agregado OK`);
        }

        // Aplicar cupón si existe
        if (coupon && coupon.trim()) {
            console.log(`[Tebex] Aplicando cupón: ${coupon}`);
            const coupRes = await fetch(`${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/baskets/${ident}/coupons`, {
                method: 'POST',
                headers: tebexHeaders(),
                body: JSON.stringify({ coupon_code: coupon.trim() })
            });
            if (!coupRes.ok) {
                const errText = await coupRes.text();
                console.error(`[Tebex] Cupón inválido "${coupon}": ${errText}`);
            } else {
                console.log(`[Tebex] Cupón "${coupon}" aplicado OK`);
            }
        }

        // Obtener URL de checkout
        const basketGetRes = await fetch(`${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/baskets/${ident}`, {
            headers: tebexHeaders()
        });
        
        if (basketGetRes.ok) {
            const basketFull = await basketGetRes.json();
            const checkoutUrl = basketFull?.data?.links?.checkout;
            
            if (checkoutUrl) {
                console.log(`[Tebex] URL checkout generada exitosamente`);
                return res.json({ success: true, ident, url: checkoutUrl });
            }
        }

        const manualUrl = `https://checkout.tebex.io/pay/${TEBEX_PUBLIC_TOKEN}?basket=${ident}`;
        console.log(`[Tebex] Usando URL manual: ${manualUrl}`);
        res.json({ success: true, ident, url: manualUrl });
        
    } catch (e) {
        console.error(`[Tebex] Error en checkout:`, e);
        res.status(500).json({ error: e.message });
    }
});

// 4. Productos reales de Tebex
app.get('/api/tebex/products', async (req, res) => {
    const products = await fetchTebexProducts();
    res.json({ data: products });
});

// 5. Compras recientes
app.get('/api/tebex/recent-purchases', (req, res) => {
    const limit = parseInt(req.query.limit) || 12;
    const purchases = getRecentPurchases(limit);
    res.json({ data: purchases });
});

// 6. Top comprador
app.get('/api/tebex/top-buyer', (req, res) => {
    const top = getTopBuyer();
    res.json({ data: top });
});

// ============================================================
// WEBHOOK DE TEBEX
// ============================================================
app.post('/api/tebex-webhook', async (req, res) => {
    try {
        const signatureHeader = req.headers['x-signature'];
        const rawBody = req.rawBody;

        if (TEBEX_WEBHOOK_SECRET && signatureHeader && rawBody) {
            const bodyHash = crypto.createHash('sha256').update(rawBody.toString('utf-8')).digest('hex');
            const expectedSignature = crypto.createHmac('sha256', TEBEX_WEBHOOK_SECRET).update(bodyHash).digest('hex');

            if (expectedSignature !== signatureHeader) {
                console.error(`[Tebex Webhook] ❌ Firma inválida. Esperada: ${expectedSignature}, Recibida: ${signatureHeader}`);
                return res.status(401).json({ error: 'Invalid signature' });
            }
        } else if (TEBEX_WEBHOOK_SECRET && !signatureHeader) {
            console.warn('[Tebex Webhook] ⚠️ No se recibió header X-Signature, pero hay secret configurado. Se omitirá verificación.');
        }

        const webhook = req.body;
        const { id, type, subject } = webhook;

        console.log(`[Tebex Webhook] 📨 Recibido: ${type} (ID: ${id})`);

        if (type === 'validation.webhook') {
            console.log(`[Tebex Webhook] ✅ Respondiendo validación con ID: ${id}`);
            return res.status(200).json({ id });
        }

        if (type === 'payment.completed') {
            const transactionId = subject?.transaction_id || 'N/A';
            const pricePaid = subject?.price_paid?.amount || 0;
            const currency = subject?.price_paid?.currency || 'USD';
            const paymentMethod = subject?.payment_method?.name || 'Desconocido';
            const customer = subject?.customer || {};
            const nick = customer?.username?.username || customer?.username || customer?.first_name || 'Desconocido';
            const email = customer?.email || '';
            const country = customer?.country || '';
            const products = subject?.products || [];

            console.log(`[Tebex Webhook] 💰 Pago completado! ${nick} - $${pricePaid} ${currency} (${transactionId})`);

            const productNames = products.map(p => p.name).join(', ');
            const totalAmount = Number(pricePaid);
            addPurchase({
                nickname: nick,
                email: email,
                transactionId: transactionId,
                products: productNames,
                productList: products.map(p => ({
                    name: p.name,
                    quantity: p.quantity,
                    price: Number(p.paid_price?.amount || 0)
                })),
                amount: totalAmount,
                currency: currency,
                method: paymentMethod,
                country: country,
                timestamp: Date.now()
            });
            console.log(`[Tebex Webhook] 💾 Compra registrada: ${nick} - $${totalAmount}`);

            // Construir embed para Discord
            const embed = {
                title: '✅ ¡Nueva Compra!',
                color: 0x00ff00,
                thumbnail: { url: 'https://i.postimg.cc/pTZRVs1F/93db69b6-6f32-44ef-9e5a-ae199feadaa0.jpg' },
                fields: [
                    { name: '👤 Jugador', value: `\`${nick}\``, inline: true },
                    { name: '💳 Transacción', value: `\`${transactionId}\``, inline: true },
                    { name: '💰 Total Pagado', value: `**$${Number(pricePaid).toFixed(2)} ${currency}**`, inline: true },
                    { name: '💳 Método de Pago', value: paymentMethod, inline: true },
                    { name: '🌍 País', value: country || 'Desconocido', inline: true },
                    { name: '📧 Email', value: email || 'No disponible', inline: true },
                    { name: '📦 Productos Comprados', value: products.map(p => `**${p.name}** x${p.quantity} — $${Number(p.paid_price?.amount || 0).toFixed(2)}`).join('\n') || 'N/A' }
                ],
                footer: {
                    text: 'Enderland Survival OP • Tebex',
                    icon_url: 'https://i.postimg.cc/pTZRVs1F/93db69b6-6f32-44ef-9e5a-ae199feadaa0.jpg'
                },
                timestamp: new Date().toISOString()
            };

            if (DISCORD_WEBHOOK_URL) {
                try {
                    const discordRes = await fetch(DISCORD_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: 'Enderland Tienda',
                            avatar_url: 'https://i.postimg.cc/pTZRVs1F/93db69b6-6f32-44ef-9e5a-ae199feadaa0.jpg',
                            embeds: [embed]
                        })
                    });

                    if (discordRes.ok) {
                        console.log(`[Tebex Webhook] ✅ Notificación enviada a Discord`);
                    } else {
                        console.error(`[Tebex Webhook] ❌ Error enviando a Discord: ${discordRes.status}`);
                    }
                } catch (discordErr) {
                    console.error(`[Tebex Webhook] ❌ Error de conexión a Discord:`, discordErr.message);
                }
            } else {
                console.warn('[Tebex Webhook] ⚠️ DISCORD_WEBHOOK_URL no configurado');
            }

            return res.status(200).json({ received: true });
        }

        console.log(`[Tebex Webhook] ℹ️ Tipo ignorado: ${type}`);
        res.status(200).json({ received: true });

    } catch (e) {
        console.error(`[Tebex Webhook] ❌ Error procesando webhook:`, e);
        res.status(500).json({ error: 'Internal error' });
    }
});

// Para Vercel
if (process.env.VERCEL) {
    module.exports = app;
} else {
    app.listen(PORT, () => {
        console.log(`🚀 Enderland Survival OP Backend en http://localhost:${PORT}`);
        fetchTebexProducts();
    });
}