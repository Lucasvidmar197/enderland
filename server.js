const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, set, push, remove, get, child, query, limitToLast } = require('firebase/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCOkYiVzU0wrALPeTBcGNIqK-NhV7QBIVs",
    authDomain: "enderland-7c875.firebaseapp.com",
    databaseURL: "https://enderland-7c875-default-rtdb.firebaseio.com",
    projectId: "enderland-7c875",
    storageBucket: "enderland-7c875.firebasestorage.app",
    messagingSenderId: "90498636412",
    appId: "1:90498636412:web:41081a7ff3693104bb87f9",
    measurementId: "G-HT5SQYX3KQ"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// In-memory token storage (simple demo)
const tokens = new Map();

// Middleware de autenticación mejorado
const authenticate = async (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token || !tokens.has(token)) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    
    // Extender sesión
    const userData = tokens.get(token);
    // Opcional: Validar expiración si quisiéramos
    
    req.user = userData;
    next();
};

// Verificar si es superadmin (polagodd)
const isSuperAdmin = (req, res, next) => {
    if (req.user && req.user.username === 'polagodd') {
        next();
    } else {
        res.status(403).json({ error: 'Requiere privilegios de Super Admin' });
    }
};

// Inicializar usuario polagodd si no existe
async function initSuperAdmin() {
    try {
        const snapshot = await get(child(ref(db), 'admins/polagodd'));
        if (!snapshot.exists()) {
            console.log("Inicializando Super Admin 'polagodd'...");
            const initialHash = crypto.createHash('sha256').update(process.env.ADMIN_PASSWORD || 'lachispa1122').digest('hex');
            await set(ref(db, 'admins/polagodd'), {
                username: 'polagodd',
                passwordHash: initialHash,
                role: 'superadmin'
            });
        }
    } catch (e) {
        console.error("Error inicializando admin:", e);
    }
}
initSuperAdmin();

// --- ENDPOINTS DE AUTENTICACIÓN ---

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Datos incompletos' });

    try {
        const snapshot = await get(child(ref(db), `admins/${username}`));
        if (!snapshot.exists()) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const adminData = snapshot.val();
        const inputHash = crypto.createHash('sha256').update(password).digest('hex');

        if (inputHash === adminData.passwordHash) {
            const token = crypto.randomBytes(32).toString('hex');
            tokens.set(token, { username: adminData.username, role: adminData.role });
            res.json({ success: true, token, username: adminData.username, role: adminData.role });
        } else {
            res.status(401).json({ error: 'Credenciales inválidas' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Error interno' });
    }
});

// --- GESTIÓN DE ADMINS (SOLO POLAGODD) ---

app.post('/api/admin/users', authenticate, isSuperAdmin, async (req, res) => {
    const { newUsername, newPassword } = req.body;
    if (!newUsername || !newPassword) return res.status(400).json({ error: 'Datos incompletos' });

    try {
        const hash = crypto.createHash('sha256').update(newPassword).digest('hex');
        await set(ref(db, `admins/${newUsername}`), {
            username: newUsername,
            passwordHash: hash,
            role: 'admin'
        });
        res.json({ success: true, message: `Admin ${newUsername} creado.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/users', authenticate, isSuperAdmin, async (req, res) => {
    try {
        const snapshot = await get(child(ref(db), 'admins'));
        const admins = [];
        snapshot.forEach(child => {
            admins.push({ username: child.key, role: child.val().role });
        });
        res.json({ admins });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/users/:username', authenticate, isSuperAdmin, async (req, res) => {
    const { username } = req.params;
    if (username === 'polagodd') return res.status(400).json({ error: 'No se puede eliminar al Super Admin' });

    try {
        await remove(ref(db, `admins/${username}`));
        res.json({ success: true, message: 'Admin eliminado' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- ENDPOINTS DE GESTIÓN (REUTILIZADOS) ---

app.get('/api/catalog', async (req, res) => {
    try {
        const snapshot = await get(child(ref(db), 'catalog'));
        res.json(snapshot.val() || {});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/catalog/category', authenticate, async (req, res) => {
    const { key, name } = req.body;
    try {
        await set(ref(db, `catalog/${key}/name`), name);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/catalog/category/:key', authenticate, async (req, res) => {
    const { key } = req.params;
    try {
        await remove(ref(db, `catalog/${key}`));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/catalog/kit', authenticate, async (req, res) => {
    const { catKey, kitKey, kitData } = req.body;
    try {
        if (kitKey) await set(ref(db, `catalog/${catKey}/kits/${kitKey}`), kitData);
        else await push(ref(db, `catalog/${catKey}/kits`), kitData);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/catalog/kit/:catKey/:kitKey', authenticate, async (req, res) => {
    const { catKey, kitKey } = req.params;
    try {
        await remove(ref(db, `catalog/${catKey}/kits/${kitKey}`));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/coupons', authenticate, async (req, res) => {
    try {
        const snapshot = await get(child(ref(db), 'coupons'));
        res.json(snapshot.val() || {});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/admin/coupons', authenticate, async (req, res) => {
    const { code, percent, maxUses } = req.body;
    if (!code || !percent) {
        return res.status(400).json({ error: 'Code and percent required' });
    }
    try {
        await set(child(ref(db), `coupons/${code}`), {
            percent,
            maxUses: maxUses ? parseInt(maxUses) : null,
            uses: 0,
            createdAt: Date.now()
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/admin/coupons/:code', authenticate, async (req, res) => {
    const { code } = req.params;
    try {
        await remove(ref(db, `coupons/${code}`));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/stats', authenticate, async (req, res) => {
    try {
        const snapshot = await get(child(ref(db), 'recent_purchases'));
        res.json(snapshot.val() || {});
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- VISITAS (TRACKING) ---

app.post('/api/visit', async (req, res) => {
    try {
        // console.log("DEBUG SERVER: Petición recibida en /api/visit");
        // console.log("Body:", req.body);
        
        const { username, ip, country, city, countryCode } = req.body;
        
        if (!username) {
            // console.log("DEBUG SERVER: Falta username");
            return res.status(400).json({ error: 'Username required' });
        }
        
        const visitData = {
            username,
            ip: ip || 'unknown',
            country: country || 'Unknown',
            city: city || 'Unknown',
            countryCode: countryCode || 'UNK',
            timestamp: Date.now()
        };
        
        // Guardar en 'visits'
        const newVisitRef = push(ref(db, 'visits'));
        await set(newVisitRef, visitData);
        // console.log("DEBUG SERVER: Visita guardada OK:", visitData);
        
        res.json({ success: true });
    } catch (e) {
        console.error("SERVER ERROR:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/admin/visits', authenticate, async (req, res) => {
    try {
        // Obtener últimas 50 visitas
        // Firebase Realtime DB ordena por clave (timestamp-ish en push IDs), así que limitToLast funciona bien.
        const snapshot = await get(query(ref(db, 'visits'), limitToLast(50)));
        const visits = [];
        snapshot.forEach(child => {
            visits.unshift(child.val()); // Unshift para que las más nuevas queden primero en el array
        });
        res.json(visits);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/purchase', async (req, res) => {
    const order = req.body;
    if (!order) return res.status(400).json({ error: 'No order data' });

    try {
        // Validar y consumir cupón si existe
        if (order.couponCode) {
            // console.log(`Procesando cupón: ${order.couponCode}`);
            const couponRef = child(ref(db), `coupons/${order.couponCode}`);
            const couponSnap = await get(couponRef);
            
            if (couponSnap.exists()) {
                const couponData = couponSnap.val();
                // console.log(`Datos cupón:`, couponData);
                
                // Verificar límite de usos
                if (couponData.maxUses && (couponData.uses || 0) >= couponData.maxUses) {
                    // console.log(`Cupón agotado. Usos: ${couponData.uses}, Max: ${couponData.maxUses}`);
                    return res.status(400).json({ error: 'Este cupón ya alcanzó su límite de usos.' });
                }

                // Incrementar uso (transacción simple)
                const newUses = (couponData.uses || 0) + 1;
                // console.log(`Incrementando usos a: ${newUses}`);
                await set(child(couponRef, 'uses'), newUses);
            } else {
                // console.log(`Cupón no existe en DB: ${order.couponCode}`);
            }
        } else {
            // console.log("Orden sin cupón");
        }

        // Guardar compra
        order.createdAt = Date.now(); // Asegurar timestamp del servidor
        await push(ref(db, 'recent_purchases'), order);

        // Guardar IP order para límite de compras por IP (anti-spam)
        if (order.ip) {
            // Limpiar puntos para usar como key
            const ipKey = order.ip.replace(/\./g, '_');
            await push(child(ref(db), `ip_orders/${ipKey}`), {
                timestamp: Date.now(),
                amount: order.totalFinal
            });
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Error procesando compra:", e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
