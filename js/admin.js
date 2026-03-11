// --- CONFIGURACIÓN GLOBAL ---
const API_URL = null; // Backend eliminado (Serverless Mode)
let authToken = null;
let currentUser = null;
let currentRole = null;
let currentCatalogSnapshot = {};
let couponsCache = {};
let editingCatKey = null;
let editingKitKey = null;

// --- FIREBASE CONFIG ---
const _cA = {
    aK: "AIzaSyCOkYiVzU0wrALPeTBcGNIqK-NhV7QBIVs",
    aD: "enderland-7c875.firebaseapp.com",
    dU: "https://enderland-7c875-default-rtdb.firebaseio.com",
    pI: "enderland-7c875",
    sB: "enderland-7c875.firebasestorage.app",
    mS: "90498636412",
    aI: "1:90498636412:web:41081a7ff3693104bb87f9",
    mI: "G-HT5SQYX3KQ"
};

// Inicializar Firebase si no existe
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp({
        apiKey: _cA.aK,
        authDomain: _cA.aD,
        databaseURL: _cA.dU,
        projectId: _cA.pI,
        storageBucket: _cA.sB,
        messagingSenderId: _cA.mS,
        appId: _cA.aI,
        measurementId: _cA.mI
    });
}

// Inicializar DB globalmente
// Usamos window.db para asegurar acceso global y evitar ReferenceError
window.db = (typeof firebase !== 'undefined') ? firebase.database() : null;

if (!window.db) {
    console.error("CRITICAL: Firebase database not initialized. Check scripts in admin.html");
}

console.log("Admin.js loaded v3.0 - Cache Bust");

// --- FUNCIONES UTILIDAD ---
async function hashStringSHA256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- LOGIN LOGIC ---
async function submitAdminLogin() {
    console.log("Submit Login called");
    const userEl = document.getElementById("admin-user");
    const passEl = document.getElementById("admin-pass");
    const errorEl = document.getElementById("login-error");
    
    if (!window.db) {
        if(errorEl) errorEl.textContent = "Error: Base de datos no disponible";
        return;
    }

    const user = userEl ? userEl.value.trim() : "";
    const pass = passEl ? passEl.value.trim() : "";
    
    if (!user || !pass) {
        if(errorEl) errorEl.textContent = "Completa todos los campos";
        return;
    }

    try {
        const snapshot = await window.db.ref('admins/' + user).once('value');
        
        if (!snapshot.exists()) {
            if(errorEl) errorEl.textContent = "Credenciales inválidas";
            return;
        }

        const adminData = snapshot.val();
        const inputHash = await hashStringSHA256(pass);

        if (inputHash === adminData.passwordHash) {
            console.log("Login success");
            authToken = "serverless-token-" + Date.now();
            currentUser = adminData.username;
            currentRole = adminData.role;
            
            // Ocultar pantalla de login
            const loginScreen = document.getElementById("login-screen");
            if (loginScreen) {
                loginScreen.style.display = "none";
            } else {
                console.error("Element login-screen not found");
            }
            
            // Mostrar dashboard
            const dashboardScreen = document.getElementById("dashboard-screen");
            if (dashboardScreen) {
                dashboardScreen.style.display = "block";
            } else {
                console.error("Element dashboard-screen not found");
            }
            
            // Actualizar nombre de usuario
            const usernameEl = document.getElementById("admin-username");
            if (usernameEl) usernameEl.textContent = currentUser;

            initDashboard();
        } else {
            if(errorEl) errorEl.textContent = "Credenciales inválidas";
        }
    } catch (e) {
        console.error("Login error:", e);
        if(errorEl) errorEl.textContent = "Error de conexión: " + e.message;
    }
}

function logout() {
    authToken = null;
    currentUser = null;
    currentRole = null;
    location.reload();
}

// --- DASHBOARD INIT ---
function initDashboard() {
    if (!window.db) return;
    
    // Carga inicial
    loadStats();
    loadCatalog();
    loadCoupons();
    // loadVisits(); // ELIMINADO: Ya hay un listener en tiempo real abajo que se encarga de esto.
    loadAdminUsers(); // Cargar lista de admins si es superadmin (o mostrar todos)

    // Listeners en tiempo real
    window.db.ref('visits').limitToLast(50).on('value', snapshot => {
        const data = snapshot.val() || {};
        // Convertir objeto a array y ordenar por timestamp (más reciente primero)
        const visits = Object.values(data).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        console.log(`Admin.js: Procesadas ${visits.length} visitas (Método Object.values).`);
        renderVisits(visits);
    });

    window.db.ref('recent_purchases').limitToLast(100).on('value', () => {
        loadStats(); // Recalcular stats cuando hay nuevas compras
    });
    
    window.db.ref('catalog').on('value', snapshot => {
        currentCatalogSnapshot = snapshot.val() || {};
        renderAdminCatalogList(currentCatalogSnapshot);
    });

    window.db.ref('coupons').on('value', snapshot => {
        couponsCache = snapshot.val() || {};
        renderCouponsList(couponsCache);
    });
}

// --- VISITS TRACKING ---
// Esta función ya no debería usarse automáticamente para evitar conflictos con el listener .on()
function loadVisits() {
    console.warn("loadVisits() llamado manualmente. Preferir listener en tiempo real.");
    window.db.ref('visits').limitToLast(50).once('value').then(snapshot => {
        const data = snapshot.val() || {};
        const visits = Object.values(data).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        renderVisits(visits);
    });
}

function renderVisits(visits) {
    const tbody = document.getElementById("admin-visits-list");
    if (!tbody) return;
    
    tbody.innerHTML = ""; // Limpiar antes de dibujar

    if (!visits || visits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#666;">Sin visitas recientes</td></tr>';
        return;
    }

    visits.forEach(v => {
        // Validación de datos
        const username = v.username || "Invitado";
        const city = v.city || "Unknown";
        const country = v.country || "Unknown";
        const countryCode = (v.countryCode && v.countryCode !== 'UNK') ? v.countryCode.toLowerCase() : null;
        const timestamp = v.timestamp || Date.now();

        const tr = document.createElement("tr");
        
        // Estilos CSS ya manejan el hover y background, aquí solo estructura
        
        // 1. Columna Jugador (Avatar Circular + Nombre)
        const headUrl = `https://minotar.net/helm/${username}/64.png`; // Mejor calidad
        const playerCell = `
            <td style="display: flex; align-items: center; gap: 12px; color: #fff; font-weight: 500;">
                <img src="${headUrl}" class="player-avatar" onerror="this.src='https://minotar.net/helm/Steve/64.png'">
                <span>${username}</span>
            </td>
        `;
        
        // 2. Columna Ubicación (Badge)
        let locationContent = `<span style="color: #666;">Desconocida</span>`;
        if (countryCode) {
            const flagUrl = `https://flagcdn.com/24x18/${countryCode}.png`;
            locationContent = `
                <div class="country-badge">
                    <img src="${flagUrl}" class="country-flag">
                    <span>${city}, ${country}</span>
                </div>
            `;
        }
        const locationCell = `<td>${locationContent}</td>`;
        
        // 3. Columna Hora (Formato relativo o limpio)
        const date = new Date(timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        // Calcular tiempo relativo si es reciente (ej: "Hace 2 min")
        const diffMin = Math.floor((Date.now() - timestamp) / 60000);
        let timeDisplay = timeStr;
        let timeColor = "#888";
        
        if (diffMin < 1) {
            timeDisplay = "Ahora mismo";
            timeColor = "var(--success)";
        } else if (diffMin < 60) {
            timeDisplay = `Hace ${diffMin} min`;
        }

        const timeCell = `<td style="color: ${timeColor}; font-size: 0.85rem; font-weight: 500;">${timeDisplay}</td>`;

        tr.innerHTML = playerCell + locationCell + timeCell;
        tbody.appendChild(tr);
    });
}

// --- ADMIN USERS MANAGEMENT ---
function loadAdminUsers() {
    window.db.ref('admins').once('value').then(snapshot => {
        const admins = snapshot.val() || {};
        const list = document.getElementById("admin-users-list");
        if (!list) return;
        list.innerHTML = "";
        
        Object.values(admins).forEach(admin => {
            const div = document.createElement("div");
            div.style.borderBottom = "1px solid #333";
            div.style.padding = "5px 0";
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            
            let badge = admin.role === 'superadmin' ? ' <span style="color:#ffd700;">★</span>' : '';
            div.innerHTML = `<span>${admin.username}${badge}</span>`;
            
            // Solo permitir borrar si soy superadmin y no es polagodd
            if (currentRole === 'superadmin' && admin.username !== 'polagodd') {
                const btn = document.createElement("button");
                btn.className = "admin-btn";
                btn.style.background = "#ff4747";
                btn.style.padding = "2px 6px";
                btn.style.fontSize = "0.7rem";
                btn.textContent = "X";
                btn.onclick = () => deleteAdminUser(admin.username);
                div.appendChild(btn);
            }
            list.appendChild(div);
        });

        // Mostrar panel de gestión SOLO para 'polagodd' (case-insensitive)
        const userCard = document.getElementById("user-management-card");
        if (userCard) {
            // Verificar estrictamente el usuario actual
            if (currentUser && currentUser.toLowerCase() === 'polagodd') {
                userCard.style.display = "block"; 
            } else {
                userCard.style.display = "none";
            }
        }
    });
}

async function createAdminUser() {
    const user = document.getElementById("new-admin-user").value.trim();
    const pass = document.getElementById("new-admin-pass").value.trim();
    
    if (!user || !pass) {
        alert("Completa usuario y contraseña.");
        return;
    }
    
    // Validar si ya existe
    const snap = await window.db.ref('admins/' + user).once('value');
    if (snap.exists()) {
        alert("El usuario ya existe.");
        return;
    }

    const hash = await hashStringSHA256(pass);
    await window.db.ref('admins/' + user).set({
        username: user,
        passwordHash: hash,
        role: 'admin'
    });
    
    alert("Admin creado.");
    document.getElementById("new-admin-user").value = "";
    document.getElementById("new-admin-pass").value = "";
    loadAdminUsers();
}

function deleteAdminUser(username) {
    if (!confirm(`¿Eliminar al administrador ${username}?`)) return;
    window.db.ref('admins/' + username).remove()
        .then(() => loadAdminUsers())
        .catch(e => alert("Error: " + e.message));
}

// --- CATALOG MANAGEMENT ---
function loadCatalog() {
    // Ya manejado por el listener .on()
    window.db.ref('catalog').once('value').then(snap => {
        currentCatalogSnapshot = snap.val() || {};
        renderAdminCatalogList(currentCatalogSnapshot);
    });
}

function renderAdminCatalogList(catalog) {
    const container = document.getElementById("admin-catalog-list");
    if (!container) return;
    container.innerHTML = "";

    const entries = Object.entries(catalog || {});
    if (entries.length === 0) {
        container.innerHTML = '<div style="color:#777;">No hay categorías.</div>';
        return;
    }

    entries.forEach(([catKey, cat]) => {
        const catDiv = document.createElement("div");
        catDiv.style.marginBottom = "6px";
        const name = cat && cat.name ? cat.name : catKey;

        let html = `<div><strong>${name}</strong> <small style="color:#777;">(${catKey})</small>
            <button class="admin-btn" style="padding:4px 8px; font-size:0.7rem; margin-left:6px;" onclick="renameCategory('${catKey}')">Renombrar</button>
            <button class="admin-btn" style="padding:4px 8px; font-size:0.7rem; margin-left:4px; background:#ff4747;" onclick="deleteCategory('${catKey}')">Borrar</button>
        </div>`;

        const kits = (cat && cat.kits) ? Object.entries(cat.kits) : [];
        if (kits.length > 0) {
            html += `<div style="margin-left:10px; margin-top:3px;">`;
            kits.forEach(([kitKey, kit]) => {
                const kitName = kit && (kit.displayName || kit.name) ? (kit.displayName || kit.name) : kitKey;
                html += `<div style="margin-bottom:2px;">- ${kitName}
                    <button class="admin-btn" style="padding:3px 6px; font-size:0.65rem; margin-left:4px;" onclick="startEditKit('${catKey}','${kitKey}')">Editar</button>
                    <button class="admin-btn" style="padding:3px 6px; font-size:0.65rem; margin-left:2px; background:#ff4747;" onclick="deleteKit('${catKey}','${kitKey}')">Borrar</button>
                </div>`;
            });
            html += `</div>`;
        }

        catDiv.innerHTML = html;
        container.appendChild(catDiv);
    });
}

async function saveNewKit() {
    const catNameEl = document.getElementById("admin-category-name");
    const catKeyEl = document.getElementById("admin-category-key");
    const nameEl = document.getElementById("admin-kit-name");
    const imgEl = document.getElementById("admin-kit-image");
    const priceEl = document.getElementById("admin-kit-price");
    const descEl = document.getElementById("admin-kit-description");
    const statusEl = document.getElementById("admin-kit-status");

    if (!catNameEl || !catKeyEl || !nameEl || !priceEl || !descEl || !statusEl) return;

    let catKey = (catKeyEl.value || "").trim();
    const catName = (catNameEl.value || "").trim();
    const kitName = (nameEl.value || "").trim();
    const price = parseFloat(priceEl.value || "0");
    const img = (imgEl.value || "").trim();
    const benefits = (descEl.value || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (!catKey || !catName || !kitName || !price) {
        statusEl.style.color = "#ff5555";
        statusEl.textContent = "Completa categoría, nombre y precio.";
        return;
    }

    const kitDataToSave = {
        name: kitName,
        displayName: kitName,
        cartName: kitName,
        imageUrl: img,
        price: price,
        benefits: benefits
    };

    try {
        // 1. Guardar/Actualizar Categoría
        await window.db.ref(`catalog/${catKey}/name`).set(catName);

        // 2. Guardar Kit
        // Si estamos editando y cambiamos la categoría, deberíamos borrar el viejo, pero por simplicidad asumimos misma cat o nueva.
        const targetKitKey = (editingCatKey && editingKitKey) ? editingKitKey : kitName.replace(/\s+/g, '_').toLowerCase();
        
        await window.db.ref(`catalog/${catKey}/kits/${targetKitKey}`).set(kitDataToSave);

        statusEl.style.color = "#00ff88";
        statusEl.textContent = "Kit guardado.";
        
        if (!editingKitKey) {
            // Limpiar si es nuevo
            nameEl.value = "";
            imgEl.value = "";
            priceEl.value = "";
            descEl.value = "";
        }
        editingCatKey = null;
        editingKitKey = null;
        
    } catch (e) {
        console.error(e);
        statusEl.style.color = "#ff5555";
        statusEl.textContent = "Error: " + e.message;
    }
}

function startEditKit(catKey, kitKey) {
    const cat = currentCatalogSnapshot && currentCatalogSnapshot[catKey];
    if (!cat || !cat.kits || !cat.kits[kitKey]) return;
    const kit = cat.kits[kitKey];

    document.getElementById("admin-category-name").value = cat.name || catKey;
    document.getElementById("admin-category-key").value = catKey;
    document.getElementById("admin-kit-name").value = kit.displayName || kit.name || "";
    document.getElementById("admin-kit-image").value = kit.imageUrl || "";
    document.getElementById("admin-kit-price").value = kit.price || "";
    document.getElementById("admin-kit-description").value = (kit.benefits || []).join("\n");

    editingCatKey = catKey;
    editingKitKey = kitKey;
    
    const statusEl = document.getElementById("admin-kit-status");
    statusEl.style.color = "#ffd700";
    statusEl.textContent = "Editando kit existente...";
}

function renameCategory(catKey) {
    const cat = currentCatalogSnapshot && currentCatalogSnapshot[catKey];
    const currentName = cat && cat.name ? cat.name : catKey;
    const newName = prompt("Nuevo nombre:", currentName);
    if (!newName) return;
    
    window.db.ref(`catalog/${catKey}/name`).set(newName);
}

function deleteCategory(catKey) {
    if (!confirm("¿Eliminar categoría y sus kits?")) return;
    window.db.ref(`catalog/${catKey}`).remove();
}

function deleteKit(catKey, kitKey) {
    if (!confirm("¿Eliminar kit?")) return;
    window.db.ref(`catalog/${catKey}/kits/${kitKey}`).remove();
}

// --- COUPONS ---
function loadCoupons() {
    // Manejado por listener .on()
    window.db.ref('coupons').once('value').then(snap => {
        couponsCache = snap.val() || {};
        renderCouponsList(couponsCache);
    });
}

function renderCouponsList(coupons) {
    const container = document.getElementById("admin-coupons-list");
    if (!container) return;
    container.innerHTML = "";
    const entries = Object.entries(coupons || {});
    if (entries.length === 0) {
        container.innerHTML = '<div style="color:#777;">Sin cupones.</div>';
        return;
    }
    entries.forEach(([code, data]) => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.style.marginBottom = "3px";
        
        const usesInfo = (data.maxUses !== null && data.maxUses !== undefined) 
            ? `<span style="color:#ffcc00; font-size:0.7rem; margin-left:5px;">(${data.uses || 0}/${data.maxUses})</span>` 
            : "";
        
        const label = document.createElement("span");
        label.innerHTML = `${code} → ${data.percent || 0}% ${usesInfo}`;
        
        const btn = document.createElement("button");
        btn.className = "admin-btn";
        btn.style.padding = "3px 6px";
        btn.style.fontSize = "0.65rem";
        btn.style.background = "#ff4747";
        btn.textContent = "Borrar";
        btn.onclick = () => deleteCoupon(code);
        
        row.appendChild(label);
        row.appendChild(btn);
        container.appendChild(row);
    });
}

function saveCoupon() {
    const codeEl = document.getElementById("admin-coupon-code");
    const percentEl = document.getElementById("admin-coupon-percent");
    const maxUsesEl = document.getElementById("admin-coupon-max");
    const statusEl = document.getElementById("admin-coupon-status");
    if (!codeEl || !percentEl || !statusEl) return;

    const rawCode = (codeEl.value || "").trim();
    const percent = parseInt(percentEl.value || "0", 10);
    let maxUses = null;
    if (maxUsesEl && maxUsesEl.value.trim() !== "") {
        maxUses = parseInt(maxUsesEl.value, 10);
    }

    if (!rawCode || !percent || percent <= 0) {
        statusEl.style.color = "#ff5555";
        statusEl.textContent = "Ingresa código y % válido.";
        return;
    }
    const code = rawCode.toUpperCase();
    
    window.db.ref(`coupons/${code}`).set({
        percent,
        maxUses: maxUses,
        uses: 0,
        createdAt: Date.now()
    }).then(() => {
        statusEl.style.color = "#00ff88";
        statusEl.textContent = "Cupón guardado.";
        codeEl.value = "";
        percentEl.value = "";
        if(maxUsesEl) maxUsesEl.value = "";
    }).catch(e => {
        statusEl.style.color = "#ff5555";
        statusEl.textContent = "Error: " + e.message;
    });
}

function deleteCoupon(code) {
    if (!confirm(`¿Borrar cupón ${code}?`)) return;
    window.db.ref(`coupons/${code}`).remove();
}

// --- STATS ---
function loadStats() {
    window.db.ref('recent_purchases').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        let total = 0;
        const couponCount = {};
        const productCount = {};

        Object.values(data).forEach(order => {
            if (!order) return;
            const amount = order.totalFinal || order.total || 0;
            total += parseFloat(amount) || 0;

            if (order.couponCode) {
                couponCount[order.couponCode] = (couponCount[order.couponCode] || 0) + 1;
            }

            (order.items || []).forEach(item => {
                const name = item.name || item.productName;
                if (!name) return;
                productCount[name] = (productCount[name] || 0) + 1;
            });
        });

        const totalEl = document.getElementById("stat-total");
        const couponEl = document.getElementById("stat-top-coupon");
        const topProductsEl = document.getElementById("stat-top-products");
        if (totalEl) totalEl.textContent = total.toFixed(2);

        if (couponEl) {
            const entries = Object.entries(couponCount);
            if (entries.length === 0) {
                couponEl.textContent = "Sin datos";
            } else {
                entries.sort((a, b) => b[1] - a[1]);
                couponEl.textContent = `${entries[0][0]} (${entries[0][1]} usos)`;
            }
        }

        if (topProductsEl) {
            topProductsEl.innerHTML = "";
            const entries = Object.entries(productCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
            entries.forEach(([name, count]) => {
                const li = document.createElement("li");
                li.textContent = `${name} (${count})`;
                topProductsEl.appendChild(li);
            });
            if (entries.length === 0) {
                const li = document.createElement("li");
                li.textContent = "Sin datos";
                topProductsEl.appendChild(li);
            }
        }
    }).catch(e => console.error("Stats error:", e));
}