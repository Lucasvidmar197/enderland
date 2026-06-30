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

// Dominios permitidos
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());

// Cache de productos reales de Tebex
let tebexProductsCache = [];
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minuto

// --- Rate Limiting simple en memoria ---
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMITS = {
    checkout: 5,
    coupon: 10,
    general: 60
};

function getRateLimitKey(req, type) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.connection?.remoteAddress || 'unknown';
    return `${ip}:${type}`;
}

function checkRateLimit(req, type) {
    const key = getRateLimitKey(req, type);
    const now = Date.now();
    const limit = RATE_LIMITS[type] || RATE_LIMITS.general;

    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }

    const entry = rateLimitMap.get(key);
    if (now > entry.resetAt) {
        entry.count = 1;
        entry.resetAt = now + RATE_LIMIT_WINDOW;
        return true;
    }

    if (entry.count >= limit) {
        return false;
    }

    entry.count++;
    return true;
}

// Limpiar rate limit map cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap) {
        if (now > entry.resetAt) {
            rateLimitMap.delete(key);
        }
    }
}, 300000);

// --- Validación de inputs ---
function isValidMinecraftNick(nick) {
    if (!nick || typeof nick !== 'string') return false;
    return /^[a-zA-Z0-9_]{3,16}$/.test(nick);
}

function isValidCartItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (!Number.isInteger(item.id) || item.id <= 0) return false;
    if (item.qty !== undefined && (!Number.isInteger(item.qty) || item.qty <= 0 || item.qty > 100)) return false;
    return true;
}

function sanitizeString(str, maxLen = 100) {
    if (!str || typeof str !== 'string') return '';
    return str.slice(0, maxLen).replace(/[<>"'&]/g, '');
}

// --- Almacenamiento de compras en memoria (no persistente, solo para la sesión) ---
let recentPurchases = [];

function addPurchase(purchaseData) {
    recentPurchases.unshift(purchaseData);
    if (recentPurchases.length > 100) {
        recentPurchases = recentPurchases.slice(0, 100);
    }
}

function getRecentPurchases(count = 12) {
    return recentPurchases.slice(0, count);
}

function getTopBuyer() {
    if (recentPurchases.length === 0) return null;
    const totals = {};
    for (const p of recentPurchases) {
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

// --- CORS ---
app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
            return callback(null, true);
        }
        callback(new Error('No permitido por CORS'));
    },
    credentials: true
}));

app.use(bodyParser.json({
    limit: '1mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Solo servir estáticos en desarrollo local (en Vercel los sirve el CDN)
if (!process.env.VERCEL) {
    app.use(express.static('.'));
}

// ============================================================
// API ENDPOINTS
// ============================================================

// 1. Categorías y productos desde Tebex
app.get('/api/tebex/categories', async (req, res) => {
    if (!checkRateLimit(req, 'general')) {
        return res.status(429).json({ error: "Demasiadas peticiones. Intenta de nuevo en un momento." });
    }

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
        res.status(502).json({ error: "Error conectando con la tienda", data: [] });
    } catch (e) {
        console.error(`[Tebex] Error categorías:`, e.message);
        res.status(500).json({ error: "Error interno del servidor", data: [] });
    }
});

// 2. Validate coupon
app.post('/api/tebex/validate-coupon', async (req, res) => {
    if (!checkRateLimit(req, 'coupon')) {
        return res.status(429).json({ valid: false, error: "Demasiados intentos. Espera un momento." });
    }

    const { coupon, cart } = req.body;
    
    if (!coupon || typeof coupon !== 'string' || !coupon.trim()) {
        return res.json({ valid: false, error: "Ingresa un código de cupón" });
    }

    const sanitizedCoupon = sanitizeString(coupon.trim(), 50);
    
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
        return res.json({ valid: false, error: "El carrito está vacío" });
    }

    for (const item of cart) {
        if (!isValidCartItem(item)) {
            return res.json({ valid: false, error: "Carrito inválido" });
        }
    }

    try {
        // 1. Create temporal basket
        const basketRes = await fetch(`${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/baskets`, {
            method: 'POST',
            headers: tebexHeaders(),
            body: JSON.stringify({
                complete_url: ALLOWED_ORIGINS[0] || 'http://localhost:3000',
                cancel_url: ALLOWED_ORIGINS[0] || 'http://localhost:3000'
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
            body: JSON.stringify({ coupon_code: sanitizedCoupon })
        });

        if (!coupRes.ok) {
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

        let originalTotal = 0;
        for (const pkg of (basket?.packages || [])) {
            const inBasket = pkg?.in_basket;
            const price = parseFloat(inBasket?.price || pkg?.base_price || 0);
            const qty = inBasket?.quantity || 1;
            originalTotal += (price * qty);
        }
        const totalWithDiscount = parseFloat(basket?.total_price || originalTotal);
        const discountAmount = Math.max(0, originalTotal - totalWithDiscount);
        const discountPercent = originalTotal > 0 ? Math.round((discountAmount / originalTotal) * 100) : 0;

        return res.json({
            valid: true,
            coupon_code: sanitizedCoupon,
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

// 3. Checkout — CON SOPORTE PARA REGALO (gift)
app.post('/api/tebex-checkout', async (req, res) => {
    if (!checkRateLimit(req, 'checkout')) {
        return res.status(429).json({ error: "Demasiados intentos de compra. Espera un momento." });
    }

    const { nick, cart, coupon, giftNickname } = req.body;
    console.log(`[Tebex] Checkout para ${nick} con ${cart?.length || 0} items${giftNickname ? ` (regalo para ${giftNickname})` : ''}`);

    // Validar nickname del comprador
    if (!nick || !isValidMinecraftNick(nick)) {
        return res.status(400).json({ error: "Nickname inválido. Debe ser 3-16 caracteres alfanuméricos." });
    }

    // Validar carrito
    if (!cart || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({ error: "El carrito está vacío" });
    }

    if (cart.length > 20) {
        return res.status(400).json({ error: "Demasiados items en el carrito" });
    }

    for (const item of cart) {
        if (!isValidCartItem(item)) {
            return res.status(400).json({ error: "Carrito contiene items inválidos" });
        }
    }

    // Validar gift nickname si se proporciona
    if (giftNickname && !isValidMinecraftNick(giftNickname)) {
        return res.status(400).json({ error: "El nickname del destinatario es inválido. Debe ser 3-16 caracteres alfanuméricos." });
    }

    // No se puede regalar a uno mismo
    if (giftNickname && giftNickname.toLowerCase() === nick.toLowerCase()) {
        return res.status(400).json({ error: "No puedes regalarte productos a ti mismo." });
    }

    try {
        const realProducts = await fetchTebexProducts();
        const realProductIds = new Set(realProducts.map(p => p.id));
        const realProductsMap = new Map(realProducts.map(p => [p.id, p]));

        for (const item of cart) {
            if (!realProductIds.has(item.id)) {
                console.error(`[Tebex] Producto ID ${item.id} no existe en Tebex`);
                return res.status(400).json({ 
                    error: `El producto "${sanitizeString(item.name)}" no está disponible actualmente.`
                });
            }
            if (giftNickname) {
                const product = realProductsMap.get(item.id);
                if (product && product.disable_gifting) {
                    return res.status(400).json({
                        error: `El producto "${sanitizeString(product.name)}" no puede ser regalado.`
                    });
                }
            }
        }

        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                         req.connection?.remoteAddress || 
                         '127.0.0.1';

        // Si es un regalo, el basket se crea con el nick del DESTINATARIO
        const basketUsername = giftNickname || nick;

        console.log(`[Tebex] Creando basket para ${basketUsername}...`);
        const basketRes = await fetch(`${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/baskets`, {
            method: 'POST',
            headers: tebexHeaders(),
            body: JSON.stringify({
                username: basketUsername,
                ip_address: clientIp,
                complete_url: ALLOWED_ORIGINS[0] || "http://localhost:3000",
                cancel_url: ALLOWED_ORIGINS[0] || "http://localhost:3000",
                complete_auto_redirect: true,
                custom: giftNickname ? { gift_from: nick, gift_to: giftNickname } : { buyer: nick }
            })
        });

        if (!basketRes.ok) {
            const errText = await basketRes.text();
            console.error(`[Tebex] Error creando basket (${basketRes.status}): ${errText}`);
            return res.status(502).json({ error: "Error al procesar la compra. Intenta de nuevo." });
        }

        const basketData = await basketRes.json();
        const ident = basketData?.data?.ident;
        
        if (!ident) {
            console.error(`[Tebex] Basket sin ident:`, JSON.stringify(basketData));
            return res.status(502).json({ error: "Error al procesar la compra. Intenta de nuevo." });
        }
        
        console.log(`[Tebex] Basket creado: ${ident}`);

        // Agregar paquetes al basket
        for (const item of cart) {
            console.log(`[Tebex] Agregando paquete ID ${item.id} x${item.qty || 1}${giftNickname ? ` (regalo para ${giftNickname})` : ''}`);
            
            const packageBody = { 
                package_id: item.id, 
                quantity: item.qty || 1 
            };

            if (giftNickname) {
                packageBody.gift_username = giftNickname;
            }

            const addRes = await fetch(`${TEBEX_API_BASE}/baskets/${ident}/packages`, {
                method: 'POST',
                headers: tebexHeaders(),
                body: JSON.stringify(packageBody)
            });
            
            if (!addRes.ok) {
                const addText = await addRes.text();
                console.error(`[Tebex] Error agregando paquete ${item.id}: ${addText}`);
                return res.status(502).json({ 
                    error: `Error agregando producto al carrito. Intenta de nuevo.`
                });
            }
            console.log(`[Tebex] Paquete ${item.id} agregado OK`);
        }

        // Aplicar cupón si existe
        if (coupon && typeof coupon === 'string' && coupon.trim()) {
            const sanitizedCoupon = sanitizeString(coupon.trim(), 50);
            console.log(`[Tebex] Aplicando cupón: ${sanitizedCoupon}`);
            const coupRes = await fetch(`${TEBEX_API_BASE}/accounts/${TEBEX_PUBLIC_TOKEN}/baskets/${ident}/coupons`, {
                method: 'POST',
                headers: tebexHeaders(),
                body: JSON.stringify({ coupon_code: sanitizedCoupon })
            });
            if (!coupRes.ok) {
                console.error(`[Tebex] Cupón inválido "${sanitizedCoupon}"`);
            } else {
                console.log(`[Tebex] Cupón "${sanitizedCoupon}" aplicado OK`);
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

        const manualUrl = `https://checkout.tebex.io/checkout/${ident}`;
        console.log(`[Tebex] Usando URL de checkout: ${manualUrl}`);
        res.json({ success: true, ident, url: manualUrl });
        
    } catch (e) {
        console.error(`[Tebex] Error en checkout:`, e.message);
        res.status(500).json({ error: "Error interno. Intenta de nuevo más tarde." });
    }
});

// 4. Productos reales de Tebex
app.get('/api/tebex/products', async (req, res) => {
    if (!checkRateLimit(req, 'general')) {
        return res.status(429).json({ error: "Demasiadas peticiones." });
    }
    const products = await fetchTebexProducts();
    res.json({ data: products });
});

// 5. Compras recientes (en memoria, se llena con webhooks)
app.get('/api/tebex/recent-purchases', async (req, res) => {
    if (!checkRateLimit(req, 'general')) {
        return res.status(429).json({ error: "Demasiadas peticiones." });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);
    const purchases = getRecentPurchases(limit);
    res.json({ data: purchases });
});

// 6. Top comprador (en memoria)
app.get('/api/tebex/top-buyer', async (req, res) => {
    if (!checkRateLimit(req, 'general')) {
        return res.status(429).json({ error: "Demasiadas peticiones." });
    }
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

        // VERIFICACIÓN ESTRICTA: si hay secret configurado, SIEMPRE verificar firma
        if (TEBEX_WEBHOOK_SECRET) {
            if (!signatureHeader) {
                console.error('[Tebex Webhook] ❌ Falta header X-Signature. Rechazando.');
                return res.status(401).json({ error: 'Missing signature' });
            }
            
            if (!rawBody) {
                console.error('[Tebex Webhook] ❌ Sin body raw para verificar firma.');
                return res.status(401).json({ error: 'Cannot verify signature' });
            }

            const bodyHash = crypto.createHash('sha256').update(rawBody.toString('utf-8')).digest('hex');
            const expectedSignature = crypto.createHmac('sha256', TEBEX_WEBHOOK_SECRET).update(bodyHash).digest('hex');

            if (expectedSignature !== signatureHeader) {
                console.error(`[Tebex Webhook] ❌ Firma inválida.`);
                return res.status(401).json({ error: 'Invalid signature' });
            }
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
            
            // Guardar en memoria
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

            // Notificación a Discord
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
        console.error(`[Tebex Webhook] ❌ Error procesando webhook:`, e.message);
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