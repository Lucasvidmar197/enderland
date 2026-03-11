        // --- PROTECCIÓN DE SEGURIDAD Y OFUSCACIÓN ---
        (function() {
            // Bloqueo de Clic Derecho
            document.addEventListener('contextmenu', e => e.preventDefault());

            // Anti-Debugger / Detección de Consola
            let devtoolsOpen = false;
            const threshold = 160;
            setInterval(() => {
                const widthThreshold = window.outerWidth - window.innerWidth > threshold;
                const heightThreshold = window.outerHeight - window.innerHeight > threshold;
                if (widthThreshold || heightThreshold) {
                    if (!devtoolsOpen) {
                        devtoolsOpen = true;
                        console.clear();
                        const user = typeof globalUser !== 'undefined' ? globalUser : 'Invitado';
                        if (typeof logSystem === 'function') {
                            logSystem('security_alert', 'POSIBLE INTENTO DE INSPECCIÓN - Usuario: ' + user);
                        }
                    }
                } else {
                    devtoolsOpen = false;
                }
            }, 1000);

            // Generación de Token de Sesión (Session Key)
            window._sK = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        })();

        // --- FIREBASE CONFIG (OFUSCADA) ---
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

        // Variable global para la base de datos con manejo de errores
        let db = null;

        try {
            if (typeof firebase !== 'undefined') {
                if (!firebase.apps.length) {
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
                db = firebase.database();
            } else {
                console.warn("Firebase SDK no detectado. Modo Offline activado.");
            }
        } catch (e) {
            console.error("Error inicializando Firebase:", e);
        }
        

        // ------------------------------------------------------------------
        // Frontend integration notice
        // The visual/UI components originally implemented in `js/cosas.js`
        // have been consolidated into this file. This includes the catalog
        // rendering (rangos, kits, imágenes, botones interactivos, etc.).
        // The AI chat widget (icono, comportamiento) and all existing logic
        // remain untouched; only presentation code was merged.
        // `js/cosas.js` has been removed as it's no longer required.
        // ------------------------------------------------------------------

        // --- REFERENCIAS A FIREBASE ---
        let dbRefs = {};
        
        function initFirebaseRefs() {
            if (typeof firebase === 'undefined' || !db) {
                console.warn("Firebase no inicializado. Funciones en tiempo real desactivadas.");
                return;
            }
            dbRefs = {
                catalog: db.ref('catalog'),
                offers: db.ref('offers'),
                coupons: db.ref('coupons'),
                recentPurchases: db.ref('recent_purchases'),
                ipOrders: db.ref('ip_orders'),
                systemLogs: db.ref('system_logs')
            };
        }

        // Init immediately
        initFirebaseRefs();
        
        // Render Static Products immediately (Fallback)
        document.addEventListener("DOMContentLoaded", () => {
            renderStaticProducts();
        });

        function renderStaticProducts() {
            // Helper para obtener el grid dentro de una sección por ID
            const getGrid = (id) => {
                const parent = document.getElementById(id);
                return parent ? parent.querySelector('.grid') || parent.querySelector('.products-grid') : null;
            };

            // Contenedores de Rangos
            const semiRanks = getGrid("semi-anarquico");
            const vanillaRanks = getGrid("vanilla-rangos");
            const arenaRanks = getGrid("arena-rangos");

            // Contenedores de Kits
            const kitsContainer = getGrid("kits-container");

            // Renderizado de Rangos
            if (semiRanks) renderCards(semiRanks, staticRanks.filter(r => r.name.includes("(Semi)")));
            if (vanillaRanks) renderCards(vanillaRanks, staticRanks.filter(r => r.name.includes("(Vanilla)")));
            if (arenaRanks) renderCards(arenaRanks, staticRanks.filter(r => r.name.includes("(Arena PVP)")));

            // Renderizado de Kits
            if (kitsContainer) renderCards(kitsContainer, staticKits);
        }

        function renderCards(container, items) {
            if (!container || items.length === 0) return;
            container.innerHTML = ""; // Limpiar contenido previo

            items.forEach(item => {
                const card = document.createElement("div");
                card.className = "glass-panel product-card";
                if (item.id) card.id = item.id;
                
                // Logic for Rank vs Kit
                const isRank = item.priceM !== undefined;
                
                let priceHtml = "";
                if (isRank) {
                    priceHtml = `
                        <div class="card-price">
                            $<span class="amount" data-m="${item.priceM.toFixed(2)}" data-p="${item.priceP.toFixed(2)}">${item.priceM.toFixed(2)}</span>
                            <span style="font-size:0.8rem; color:var(--text-muted);">USD</span>
                        </div>
                        <div class="price-switcher-container" style="display:flex; align-items:center; justify-content:center; gap:12px; margin-bottom:15px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.1);">
                            <span style="font-size:0.75rem; font-weight:700; color:${!isPermanent ? 'var(--primary)' : '#888'}; transition: 0.3s;">MES</span>
                            <label class="switch" style="position:relative; display:inline-block; width:46px; height:24px;">
                                <input type="checkbox" onchange="togglePrice(this)" ${isPermanent ? 'checked' : ''} style="opacity:0; width:0; height:0;">
                                <span class="slider round" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:rgba(168, 85, 247, 0.2); transition:.4s; border-radius:34px; border: 1px solid var(--primary); display:block;">
                                    <span class="knob" style="position:absolute; content:''; height:16px; width:16px; left:4px; bottom:3px; background-color:white; transition:.4s; border-radius:50%; box-shadow: 0 0 10px var(--primary-glow); transform: ${isPermanent ? 'translateX(20px)' : 'translateX(0)'}; display:block;"></span>
                                </span>
                            </label>
                            <span style="font-size:0.75rem; font-weight:700; color:${isPermanent ? 'var(--primary)' : '#888'}; transition: 0.3s;">PERM</span>
                        </div>
                    `;
                } else {
                    priceHtml = `<div class="card-price">$${item.price.toFixed(2)} <span style="font-size:0.8rem; color:var(--text-muted);">USD</span></div>`;
                }

                const imgHtml = item.img ? `<img src="${item.img}" alt="${item.display}">` : `<i class="fas fa-box-open" style="font-size:3rem; color:var(--secondary);"></i>`;
                const btnText = isRank ? "Ver Beneficios" : "Ver Contenido";
                
                let featuresHtml = "";
                if (isRank && item.features) {
                    featuresHtml = `<ul style="list-style:none; padding:0; margin: 10px 0; text-align:left; font-size:0.8rem; color:#ccc;">
                        ${item.features.slice(0, 3).map(f => `<li style="margin-bottom:4px;"><i class="fas fa-check-circle" style="color:var(--primary); margin-right:6px;"></i>${f}</li>`).join('')}
                        <li style="color:var(--text-muted); font-style:italic; margin-top:5px;">Y mucho más...</li>
                    </ul>`;
                }

                card.innerHTML = `
                    <div class="card-header">
                        ${imgHtml}
                    </div>
                    <div class="card-body">
                        <h3 class="card-title">${item.display}</h3>
                        ${priceHtml}
                        ${featuresHtml}
                        <div class="card-desc">
                            <button class="glass-btn" style="width:100%; margin-bottom:10px; font-size:0.8rem;" onclick="showKitDetails('${item.id}', true)">
                                <i class="fas fa-eye"></i> ${btnText}
                            </button>
                        </div>
                        <div class="card-actions">
                            <button class="btn-add-cart" onclick="addToCart('${item.name}', this)">
                                <i class="fas fa-shopping-cart"></i> AÑADIR
                            </button>
                        </div>
                    </div>
                `;
                container.appendChild(card);
            });
        }

        const API_URL = null; // Backend eliminado para GitHub Pages
        let authToken = null;

        const WEBHOOK_URL = "https://discord.com/api/webhooks/1471400851862982751/lLxuD7WDa8KB-EjmASttayGws8vrCVzNev6lrZZaqMQ8VyvwLgIIe0X69z_VUYjIJjtt";

        (function() {
            var STORAGE_KEY = "enderland_cookie_consent_v2";
            var banner = document.getElementById("cookie-consent-banner");
            var acceptBtn = document.getElementById("cookie-accept-btn");
            var rejectBtn = document.getElementById("cookie-reject-btn");
            var termsLink = document.getElementById("cookie-terms-link");
            var resetBtn = document.getElementById("cookie-reset-btn");

            function updateConsent(status) {
                if (typeof gtag !== "function") return;
                if (status === "granted") {
                    gtag("consent", "update", {
                        analytics_storage: "granted",
                        ad_storage: "granted",
                        ad_user_data: "granted",
                        ad_personalization: "granted"
                    });
                } else {
                    gtag("consent", "update", {
                        analytics_storage: "denied",
                        ad_storage: "denied",
                        ad_user_data: "denied",
                        ad_personalization: "denied"
                    });
                }
            }

            function hideBanner() {
                if (!banner) return;
                banner.classList.remove("visible");
            }

            function showBanner() {
                if (!banner) return;
                setTimeout(function() {
                    banner.classList.add("visible");
                }, 1500);
            }

            function handleAccept() {
                localStorage.setItem(STORAGE_KEY, "accepted");
                updateConsent("granted");
                hideBanner();
            }

            function handleReject() {
                localStorage.setItem(STORAGE_KEY, "rejected");
                updateConsent("denied");
                hideBanner();
            }

            function openPrivacyModal() {
                var modal = document.getElementById("privacy-modal");
                if (!modal) return;
                modal.style.display = "flex";
            }

            function handleReset() {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }

            function initCookieBanner() {
                if (!banner || !acceptBtn || !rejectBtn) return;
                var stored = localStorage.getItem(STORAGE_KEY);

                if (stored === "accepted") {
                    updateConsent("granted");
                    hideBanner();
                } else if (stored === "rejected") {
                    updateConsent("denied");
                    hideBanner();
                } else {
                    showBanner();
                }

                acceptBtn.addEventListener("click", handleAccept);
                rejectBtn.addEventListener("click", handleReject);

                if (termsLink) {
                    termsLink.addEventListener("click", function(e) {
                        e.preventDefault();
                        openPrivacyModal();
                    });
                }

                if (resetBtn) {
                    resetBtn.addEventListener("click", function(e) {
                        e.preventDefault();
                        handleReset();
                    });
                }
            }

            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", initCookieBanner);
            } else {
                initCookieBanner();
            }
        })();

        // Precios oficiales para validación de seguridad (Cybersecurity Expert mode)
        const OFFICIAL_PRICES = {
            "Rango Cobre (Semi)": { "Mensual": 1.50, "Permanente": 2.50 },
            "Rango Hierro (Semi)": { "Mensual": 2.50, "Permanente": 4.00 },
            "Rango Oro (Semi)": { "Mensual": 4.00, "Permanente": 6.50 },
            "Rango Diamante (Semi)": { "Mensual": 6.00, "Permanente": 9.50 },
            "Rango Esmeralda (Semi)": { "Mensual": 8.00, "Permanente": 12.50 },
            "Rango Netherite (Semi)": { "Mensual": 10.00, "Permanente": 16.00 },
            "Rango Aprendiz (Vanilla)": { "Mensual": 1.00, "Permanente": 1.60 },
            "Rango Explorador (Vanilla)": { "Mensual": 2.50, "Permanente": 4.00 },
            "Rango Guerrero (Vanilla)": { "Mensual": 4.00, "Permanente": 6.50 },
            "Rango Épico (Vanilla)": { "Mensual": 6.00, "Permanente": 9.50 },
            "Rango Héroe (Vanilla)": { "Mensual": 8.00, "Permanente": 12.50 },
            "Rango Leyenda (Vanilla)": { "Mensual": 10.00, "Permanente": 16.00 },
            "Rango Gladiador (Arena PVP)": { "Mensual": 5.00, "Permanente": 8.00 },
            "Rango Veterano (Arena PVP)": { "Mensual": 8.00, "Permanente": 12.50 },
            "Rango Warlord (Arena PVP)": { "Mensual": 10.00, "Permanente": 16.00 },
            "Kit Pociones": 1.00,
            "Kit Comida": 1.50,
            "Kit Intoxicado (Vanilla)": 20.00,
            "Kit Walter White (Arena PVP)": 2.00,
            "Desbaneo 1 Día": 2.00,
            "Desbaneo 3 Días": 3.00,
            "Desbaneo 1 Semana": 5.00,
            "Desbaneo 1 Mes": 8.00,
            "Desbaneo Permanente": 15.00
        };

        const STATIC_PRODUCT_NAMES = [
            "Rango Cobre (Semi)", "Rango Hierro (Semi)", "Rango Oro (Semi)", "Rango Diamante (Semi)",
            "Rango Esmeralda (Semi)", "Rango Netherite (Semi)",
            "Rango Aprendiz (Vanilla)", "Rango Explorador (Vanilla)", "Rango Guerrero (Vanilla)",
            "Rango Épico (Vanilla)", "Rango Héroe (Vanilla)", "Rango Leyenda (Vanilla)",
            "Rango Gladiador (Arena PVP)", "Rango Veterano (Arena PVP)", "Rango Warlord (Arena PVP)",
            "Kit Pociones", "Kit Comida",
            "Kit Intoxicado (Vanilla)",
            "Kit Walter White (Arena PVP)"
        ];

        async function hashStringSHA512(str) {
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest("SHA-512", data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        }

        async function initFirebaseRealtime() {
            if (!dbRefs.recentPurchases || !dbRefs.coupons || !dbRefs.catalog) return;

            // Social proof: toasts en tiempo real
            dbRefs.recentPurchases.limitToLast(5).on('child_added', snap => {
                const order = snap.val();
                if (!order) return;
                // Sólo toasts de compras recientes (últimos 30s)
                const now = Date.now();
                if (order.createdAt && (now - order.createdAt) <= 30000) {
                    showPurchaseToast(order);
                }
            });

            // Cupones (Cache para validación local en carrito)
            dbRefs.coupons.on('value', snap => {
                couponsCache = snap.val() || {};
            });

            // Render catálogo dinámico + menú lateral
            dbRefs.catalog.on('value', snapshot => {
                const catalog = snapshot.val() || {};
                currentCatalogSnapshot = catalog || {};
                renderDynamicCatalog(catalog);
                updateDynamicSidebar(catalog);
            });
        }



        const CATEGORY_GRID_MAP = {
            "semi-rangos": "#semi-anarquico .grid",
            "vanilla-rangos": "#vanilla-rangos .grid",
            "semi-kits": "#semi-kits .grid",
            "vanilla-kits": "#vanilla-kits .grid"
        };

        function renderDynamicCatalog(catalog) {
            // Inyecta los kits dinámicos directamente en los .grid de las secciones originales
            Object.entries(CATEGORY_GRID_MAP).forEach(([catKey, selector]) => {
                const grid = document.querySelector(selector);
                if (!grid) return;

                // Guardar HTML estático original una sola vez
                if (!grid.dataset.staticHtml) {
                    grid.dataset.staticHtml = grid.innerHTML;
                }

                const cat = (catalog || {})[catKey];
                const kits = cat && cat.kits ? Object.values(cat.kits) : [];

                if (!cat || kits.length === 0) {
                    // Si no hay categoría o no tiene kits, restaurar diseño original
                    grid.innerHTML = grid.dataset.staticHtml;
                    return;
                }

                // Renderizar sólo desde Firebase para esta categoría
                grid.innerHTML = "";
                kits.forEach(kit => {
                    if (!kit) return;
                        const kitId = kit.id || kit.name.replace(/\s+/g, '-').toLowerCase();
                    const card = document.createElement("div");
                    card.id = kitId; // Asignar el ID a la tarjeta para que el chatbot pueda navegar a ella
                        card.className = "glass-panel product-card";
                    const imgHtml = kit.imageUrl ? `
                        <div class="kit-image-container">
                            <img src="${kit.imageUrl}" alt="${kit.name}" class="kit-image">
                        </div>` : "";
                    const cartName = kit.cartName || kit.displayName || kit.name;
                    const price = parseFloat(kit.price || 0);
                    card.innerHTML = `
                        ${imgHtml}
                            <div class="card-body">
                                <h3 class="card-title">${kit.displayName || kit.name}</h3>
                                <div class="card-price">$<span class="amount" data-m="${price.toFixed(2)}" data-p="${price.toFixed(2)}">${price.toFixed(2)}</span> <span style="font-size:0.8rem; color:var(--text-muted);">USD</span></div>
                                <div class="card-desc">
                                    <button class="glass-btn" style="width:100%; margin-bottom:10px; font-size:0.8rem;" onclick="showKitDetails('${kitId}', false)">
                                        <i class="fas fa-eye"></i> Ver Contenido
                                    </button>
                                </div>
                                <div class="card-actions">
                                    <button class="btn-add-cart" onclick="addToCart('${cartName}', this)">Añadir</button>
                                </div>
                        </div>
                    `;
                    grid.appendChild(card);
                });
            });
        }

        function updateDynamicSidebar(catalog) {
            const sidebar = document.querySelector(".sidebar");
            if (!sidebar) return;
            let container = document.getElementById("dynamic-nav-container");
            if (!container) {
                container = document.createElement("div");
                container.id = "dynamic-nav-container";
                sidebar.appendChild(container);
            }
            container.innerHTML = "";

            const entries = Object.entries(catalog || {}).filter(([catKey]) => CATEGORY_GRID_MAP[catKey]);
            if (entries.length === 0) return;

            const title = document.createElement("div");
            title.className = "nav-category-title";
            title.textContent = "CATÁLOGO DINÁMICO";
            container.appendChild(title);

            entries.forEach(([catKey, cat]) => {
                const name = cat && cat.name ? cat.name : catKey;
                const selector = CATEGORY_GRID_MAP[catKey];
                const targetSection = selector ? selector.split(" ")[0] : null;
                const link = document.createElement("a");
                link.href = targetSection || "#";
                link.className = "nav-item";
                link.textContent = name;
                container.appendChild(link);
            });
        }



        // --- DATA ---
        // STATIC PRODUCTS ARRAY (FALLBACK/DEFAULT)
        const staticRanks = [
            // SEMI
            { id: 'r-cobre', name: 'Rango Cobre (Semi)', display: 'Rango Cobre', priceM: 1.50, priceP: 2.50, img: 'https://i.postimg.cc/PxFZp50K/cobre.png', features: ['Prefijo [COBRE]', '5 Sethomes', '/hat', 'Kit Cobre: Armadura de hierro Full (Prot I, Irromp III, Reparación), Espada (Filo I, Irromp II), Pico (Eficiencia I), Hacha (Eficiencia III) y Pala (Eficiencia II).'] },
            { id: 'r-hierro', name: 'Rango Hierro (Semi)', display: 'Rango Hierro', priceM: 2.50, priceP: 4.00, img: 'https://i.postimg.cc/HkCM7KPJ/hierro.png', features: ['Todo lo de Cobre', '8 Sethomes', '/workbench (mesa virtual)', 'Kit Hierro: Armadura de hierro Full (Prot II, Irromp III, Reparación), Espada (Filo III, Irromp III, Reparación), Herramientas de hierro y Arco (Poder II, Irromp III).'] },
            { id: 'r-oro', name: 'Rango Oro (Semi)', display: 'Rango Oro', priceM: 4.00, priceP: 6.50, img: 'https://i.postimg.cc/3NvykCX8/oro.png', features: ['Todo lo de Hierro', '12 Sethomes', '/enderchest (cofre virtual)', 'Kit Oro: Armadura de diamante Full (Prot II, Irromp III, Reparación), Espada (Filo IV), Pico (Fortuna III, Eficiencia IV), Hacha (Eficiencia V) y Arco (Poder III).'] },
            { id: 'r-diamante', name: 'Rango Diamante (Semi)', display: 'Rango Diamante', priceM: 6.00, priceP: 9.50, img: 'https://i.postimg.cc/bYsBw65V/diamante.png', features: ['Todo lo de Oro', '/back al morir', 'Tp instantáneo', 'Kit Diamante: Armadura de diamante Full (Prot IV, Irromp III, Reparación), Elytras (Irromp III), Espada (Filo V, Aspecto Ígneo II), Pico (Fortuna III), Hacha y Pala (Eficiencia V) y Arco (Poder III, Llama).'] },
            { id: 'r-esmeralda', name: 'Rango Esmeralda (Semi)', display: 'Rango Esmeralda', priceM: 8.00, priceP: 12.50, img: 'https://i.postimg.cc/rwLngqpX/esmeralda.png', features: ['Todo lo de Diamante', '40 Sethomes', '/feed', '/near', 'Kit Esmeralda: Armadura de diamante Full (Prot IV, Respiración III, Caída de Pluma IV, Irromp III, Reparación), Elytras (Irromp III, Reparación), Herramientas Full y Arco (Poder III, Llama, Reparación).'] },
            { id: 'r-netherite', name: 'Rango Netherite (Semi)', display: 'Rango Netherite', priceM: 10.00, priceP: 16.00, img: 'https://i.postimg.cc/pdss28Y3/netherita.png', features: ['Todo lo anterior', '100 Sethomes', '/repair', 'Fly en Lobby', '/nick', 'Kit Netherite: Armadura de Netherite Full (Prot III, Respiración III, Vel. Alma III, Irromp III, Reparación), Elytras (Prot IV), Espada de Netherite (Filo IV, Botín III), Herramientas de Netherite y Arco (Poder III, Llama, Empuje II).'] },
            
            // VANILLA
            { id: 'r-aprendiz', name: 'Rango Aprendiz (Vanilla)', display: 'Rango Aprendiz', priceM: 1.00, priceP: 1.60, img: 'https://i.postimg.cc/pLX8PSGr/Captura-de-pantalla-2026-02-02-203107.png', features: ['5 Sethomes', '/tpahere (traer jugadores)', '/hat', 'Kit Aprendiz: Armadura y herramientas de hierro (Prot I, Filo I, Eficiencia I, Poder I).'] },
            { id: 'r-explorador', name: 'Rango Explorador (Vanilla)', display: 'Rango Explorador', priceM: 2.50, priceP: 4.00, img: 'https://i.postimg.cc/bv42Hwz1/explorador.png', features: ['Todo lo de Aprendiz', '8 Sethomes', '/workbench virtual', 'Kit Explorador: Armadura de hierro (Prot III), Espada (Filo III), Pico (Fortuna II, Eficiencia III) y Arco (Poder II).'] },
            { id: 'r-guerrero', name: 'Rango Guerrero (Vanilla)', display: 'Rango Guerrero', priceM: 4.00, priceP: 6.50, img: 'https://i.postimg.cc/L5pYwQg4/Captura-de-pantalla-2026-02-02-203142.png', features: ['Todo lo de Explorador', '12 Sethomes', '/enderchest virtual', 'Kit Guerrero: Armadura de diamante (Prot I), Espada de hierro (Filo V), Pico de hierro (Eficiencia V) y herramientas de diamante.'] },
            { id: 'r-epico', name: 'Rango Épico (Vanilla)', display: 'Rango Épico', priceM: 6.00, priceP: 9.50, img: 'https://i.postimg.cc/CMGfk09n/Captura-de-pantalla-2026-02-02-203155.png', features: ['Todo lo de Guerrero', '20 Sethomes', '/back (volver a muerte)', 'Kit Épico: Armadura de diamante (Prot II, Irromp III, Reparación), Espada y Herramientas de diamante (Filo III, Eficiencia III, Reparación).'] },
            { id: 'r-heroe', name: 'Rango Héroe (Vanilla)', display: 'Rango Héroe', priceM: 8.00, priceP: 12.50, img: 'https://i.postimg.cc/4xSKsxHF/Captura-de-pantalla-2026-02-02-203208.png', features: ['Todo lo de Épico', '40 Sethomes', '/feed (saciar hambre)', 'Kit Héroe: Armadura de diamante (Prot III, Irromp III, Reparación), Espada (Filo IV, Aspecto Ígneo I), Pico (Fortuna III, Eficiencia IV) y Arco (Poder IV, Fuego).'] },
            { id: 'r-leyenda', name: 'Rango Leyenda (Vanilla)', display: 'Rango Leyenda', priceM: 10.00, priceP: 16.00, img: 'https://i.postimg.cc/Kzn4P7qp/Captura-de-pantalla-2026-02-02-203235.png', features: ['Todo lo anterior', '100 Sethomes', '/repair', '/fly en Lobby', 'Chat de Colores', 'Kit Leyenda: Armadura de diamante (Prot IV, Respiración III, Caída Pluma IV, Irromp III, Reparación), Espada (Filo V, Aspecto Ígneo II, Empuje II), Pico (Fortuna III, Eficiencia V) y Arco (Poder V, Fuego).'] },

            // ARENA PVP
            { id: 'r-gladiador', name: 'Rango Gladiador (Arena PVP)', display: 'Rango Gladiador', priceM: 5.00, priceP: 8.00, img: 'https://i.postimg.cc/2jKNxRpy/Captura-de-pantalla-2026-02-16-184732.png', features: ['Prefix [GLADIADOR]', 'Multiplicador XP x1.5', 'Efectos de Partículas', 'Kit Gladiador'] },
            { id: 'r-veterano', name: 'Rango Veterano (Arena PVP)', display: 'Rango Veterano', priceM: 8.00, priceP: 12.50, img: 'https://i.postimg.cc/gk9F7CsH/Captura-de-pantalla-2026-02-16-184753.png', features: ['Prefix [VETERANO]', 'Multiplicador XP x2.0', 'Acceso a Capas Custom', 'Kit Veterano'] },
            { id: 'r-warlord', name: 'Rango Warlord (Arena PVP)', display: 'Rango Warlord', priceM: 10.00, priceP: 16.00, img: 'https://i.postimg.cc/g02fRmz4/Captura-de-pantalla-2026-02-16-184805.png', features: ['Prefix [WARLORD]', 'Multiplicador XP x3.0', 'Acceso a Pets Cosméticas', 'Kit Warlord'] }
        ];

        const staticKits = [
            { id: 'k-intoxicado', name: 'Kit Intoxicado (Vanilla)', display: 'Kit Intoxicado', price: 20.00, img: 'https://i.postimg.cc/mkBk8cKS/Captura-de-pantalla-2026-02-02-203219.png' },
            { id: 'k-pociones', name: 'Kit Pociones', display: 'Kit Pociones', price: 1.00, img: 'https://i.postimg.cc/dk3KgK2Y/image.png' },
            { id: 'k-comida', name: 'Kit Comida', display: 'Kit Comida', price: 1.50, img: 'https://i.postimg.cc/G4jw2pzr/image.png' }
        ];

        const kitImages = {
            'r-cobre': 'https://i.postimg.cc/PxFZp50K/cobre.png',
            'r-hierro': 'https://i.postimg.cc/HkCM7KPJ/hierro.png',
            'r-oro': 'https://i.postimg.cc/3NvykCX8/oro.png',
            'r-diamante': 'https://i.postimg.cc/bYsBw65V/diamante.png',
            'r-esmeralda': 'https://i.postimg.cc/rwLngqpX/esmeralda.png',
            'r-netherite': 'https://i.postimg.cc/pdss28Y3/netherita.png',
            'r-aprendiz': 'https://i.postimg.cc/pLX8PSGr/Captura-de-pantalla-2026-02-02-203107.png',
            'r-explorador': 'https://i.postimg.cc/bv42Hwz1/explorador.png',
            'r-guerrero': 'https://i.postimg.cc/L5pYwQg4/Captura-de-pantalla-2026-02-02-203142.png',
            'r-epico': 'https://i.postimg.cc/CMGfk09n/Captura-de-pantalla-2026-02-02-203155.png',
            'r-heroe': 'https://i.postimg.cc/4xSKsxHF/Captura-de-pantalla-2026-02-02-203208.png',
            'r-leyenda': 'https://i.postimg.cc/Kzn4P7qp/Captura-de-pantalla-2026-02-02-203235.png',
            'k-intoxicado': 'https://i.postimg.cc/mkBk8cKS/Captura-de-pantalla-2026-02-02-203219.png',
            'k-pociones': 'https://i.postimg.cc/dk3KgK2Y/image.png',
            'k-comida': 'https://i.postimg.cc/G4jw2pzr/image.png',
            'r-gladiador': 'https://i.postimg.cc/2jKNxRpy/Captura-de-pantalla-2026-02-16-184732.png',
            'r-veterano': 'https://i.postimg.cc/gk9F7CsH/Captura-de-pantalla-2026-02-16-184753.png',
            'r-warlord': 'https://i.postimg.cc/g02fRmz4/Captura-de-pantalla-2026-02-16-184805.png'
        };

        const kitData = {
            'r-cobre': `
<li><strong>Casco de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III, Reparación</span></li>
<li><strong>Pechera de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III, Reparación</span></li>
<li><strong>Pantalones de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III, Reparación</span></li>
<li><strong>Botas de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III, Reparación</span></li>
<li><strong>Espada de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo I, Irrompibilidad II</span></li>
<li><strong>Pico de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia I, Irrompibilidad II</span></li>
<li><strong>Hacha de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia III, Irrompibilidad II</span></li>
<li><strong>Pala de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia II, Irrompibilidad II</span></li>`,
            
            'r-hierro': `
<li><strong>Casco de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Pechera de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Pantalones de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Botas de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Espada de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo III, Irrompibilidad III, Reparación</span></li>
<li><strong>Pico de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia III, Irrompibilidad III, Reparación</span></li>
<li><strong>Hacha de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Pala de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia III, Irrompibilidad III, Reparación</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder II, Irrompibilidad III</span></li>`,
            
            'r-oro': `
<li><strong>Casco de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Pechera de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Pantalones de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Botas de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Espada de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo IV, Irrompibilidad III</span></li>
<li><strong>Pico de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Fortuna III, Eficiencia IV</span></li>
<li><strong>Hacha de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia V</span></li>
<li><strong>Pala de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia IV</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder III</span></li>`,
            
            'r-diamante': `
<li><strong>Casco de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Pechera de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Pantalones de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Botas de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Elytras</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Irrompibilidad III</span></li>
<li><strong>Espada de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo V, Aspecto ígneo II, Irrompibilidad III</span></li>
<li><strong>Pico de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Fortuna III, Eficiencia IV, Irrompibilidad III</span></li>
<li><strong>Hacha de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia V, Irrompibilidad III</span></li>
<li><strong>Pala de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia V, Irrompibilidad III</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder III, Llama</span></li>`,
            
            'r-esmeralda': `
<li><strong>Casco de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Prot IV, Respiración III, Afinidad Acuática, Irromp III, Reparación</span></li>
<li><strong>Pechera de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Pantalones de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Botas de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Prot IV, Caída de Pluma IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Elytras</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Irrompibilidad III, Reparación</span></li>
<li><strong>Espada de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo V, Aspecto ígneo II, Empuje II, Irromp III, Reparación</span></li>
<li><strong>Pico de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Fortuna III, Eficiencia V, Irromp III, Reparación</span></li>
<li><strong>Hacha de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia V, Irrompibilidad III, Reparación</span></li>
<li><strong>Pala de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia V, Irrompibilidad III, Reparación</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder III, Llama, Reparación</span></li>`,
            
            'r-netherite': `
<li><strong>Casco de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Prot III, Respiración III, Afinidad Acuática, Irromp III, Reparación</span></li>
<li><strong>Pechera de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección III, Irrompibilidad III, Reparación</span></li>
<li><strong>Pantalones de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección III, Irrompibilidad III, Reparación</span></li>
<li><strong>Botas de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Prot III, Caída Pluma IV, Vel. Alma III, Irromp III, Reparación</span></li>
<li><strong>Elytras</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Espada de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo IV, Empuje II, Botín III, Irrompibilidad III, Reparación</span></li>
<li><strong>Pico de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Fortuna III, Eficiencia IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Hacha de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Pala de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder III, Llama, Empuje II, Reparación</span></li>`,
            
            'r-aprendiz': `
<li><strong>Casco de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III</span></li>
<li><strong>Pechera de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III</span></li>
<li><strong>Pantalones de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III</span></li>
<li><strong>Espada de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo I, Irrompibilidad III</span></li>
<li><strong>Pico de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia I, Irrompibilidad III</span></li>
<li><strong>Pala de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia I, Irrompibilidad III</span></li>
<li><strong>Hacha de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia I, Irrompibilidad III</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder I, Irrompibilidad III</span></li>`,
            
            'r-explorador': `
<li><strong>Casco de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección III, Irrompibilidad III</span></li>
<li><strong>Pechera de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección III, Irrompibilidad III</span></li>
<li><strong>Pantalones de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección III, Irrompibilidad III</span></li>
<li><strong>Botas de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección III, Irrompibilidad III</span></li>
<li><strong>Espada de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo III, Irrompibilidad III</span></li>
<li><strong>Pico de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Fortuna II, Eficiencia III, Irrompibilidad III</span></li>
<li><strong>Hacha de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia III, Irrompibilidad III</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder II</span></li>`,
            
            'r-guerrero': `
<li><strong>Casco de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III</span></li>
<li><strong>Pechera de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III</span></li>
<li><strong>Pantalones de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III</span></li>
<li><strong>Botas de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección I, Irrompibilidad III</span></li>
<li><strong>Espada de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo V, Irrompibilidad III</span></li>
<li><strong>Pico de Hierro</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia V, Irrompibilidad III</span></li>
<li><strong>Hacha de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia III, Irrompibilidad III</span></li>
<li><strong>Pala de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia III, Irrompibilidad III</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder II, Irrompibilidad III</span></li>`,
            
            'r-epico': `
<li><strong>Casco de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Pechera de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Pantalones de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Botas de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección II, Irrompibilidad III, Reparación</span></li>
<li><strong>Espada de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo III, Irrompibilidad III, Reparación</span></li>
<li><strong>Pico de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia III, Irrompibilidad III, Reparación</span></li>
<li><strong>Hacha de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia III, Irrompibilidad III, Reparación</span></li>
<li><strong>Pala de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia III, Irrompibilidad III, Reparación</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder II, Irrompibilidad III, Reparación</span></li>`,
            
            'r-heroe': `
<li><strong>Casco de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección III, Irrompibilidad III, Reparación</span></li>
<li><strong>Pechera de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección III, Irrompibilidad III, Reparación</span></li>
<li><strong>Pantalones de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección III, Irrompibilidad III, Reparación</span></li>
<li><strong>Botas de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección III, Irrompibilidad III, Reparación</span></li>
<li><strong>Espada de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo IV, Aspecto Ígneo I, Irrompibilidad III, Reparación</span></li>
<li><strong>Pico de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Fortuna III, Eficiencia IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Hacha de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Pala de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder IV, Fuego, Irrompibilidad III</span></li>`,
            
            'r-leyenda': `
<li><strong>Casco de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Prot IV, Irromp III, Afinidad Acuática, Reparación, Respiración III</span></li>
<li><strong>Pechera de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Pantalones de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Botas de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Prot IV, Caída Pluma IV, Vel. Alma III, Irromp III, Reparación</span></li>
<li><strong>Espada de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo V, Aspecto Ígneo II, Empuje II, Irromp III, Reparación</span></li>
<li><strong>Pico de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Fortuna III, Eficiencia V, Irrompibilidad III, Reparación</span></li>
<li><strong>Pala de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia V, Irrompibilidad III, Reparación</span></li>
<li><strong>Hacha de Diamante</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia V, Irrompibilidad III, Reparación</span></li>
<li><strong>Arco</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Poder V, Fuego, Irrompibilidad III</span></li>`,
            
            'k-intoxicado': `
<li><strong>Casco de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Prot IV, Irromp III, Afinidad Acuática, Reparación, Respiración III</span></li>
<li><strong>Pechera de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Pantalones de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Protección IV, Irrompibilidad III, Reparación</span></li>
<li><strong>Botas de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Prot IV, Caída Pluma IV, Vel. Alma III, Irromp III, Reparación</span></li>
<li><strong>Espada de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Filo V, Aspecto Ígneo II, Empuje II, Irromp III, Reparación</span></li>
<li><strong>Pico de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Fortuna III, Eficiencia V, Irrompibilidad III, Reparación</span></li>
<li><strong>Pala de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia V, Irrompibilidad III, Reparación</span></li>
<li><strong>Hacha de Netherite</strong><br><span style="color:var(--text-muted); font-size:0.9em;">Eficiencia V, Irrompibilidad III, Reparación</span></li>`,
            'r-gladiador': `<li><strong>Casco de Diamante</strong><span>Protección III, Durabilidad III</span></li><li><strong>Pechera de Diamante</strong><span>Protección III, Durabilidad III</span></li><li><strong>Pantalones de Diamante</strong><span>Protección III, Durabilidad III</span></li><li><strong>Botas de Diamante</strong><span>Protección III, Durabilidad III</span></li><li><strong>Espada de Diamante</strong><span>Filo IV, Aspecto Ardiente II, Durabilidad III</span></li><li><strong>Escudo</strong><span>Durabilidad I</span></li><li><strong>Hacha de Diamante</strong><span>Filo IV, Durabilidad III</span></li><li><strong>Arco</strong><span>Poder IV, Fuego, Retroceso II, Durabilidad III</span></li><li><strong>Flechas</strong><span>64</span></li><li><strong>Zanahorias doradas</strong><span>32</span></li><li><strong>Manzanas doradas</strong><span>32</span></li>`,
            'r-veterano': `<li><strong>Casco de Nederita</strong><span>Protección IV, Durabilidad III, Reparación</span></li><li><strong>Pechera de Diamante</strong><span>Protección IV, Durabilidad III</span></li><li><strong>Pantalones de Diamante</strong><span>Protección IV, Durabilidad III</span></li><li><strong>Botas de Nederita</strong><span>Protección IV, Durabilidad III, Reparación</span></li><li><strong>Espada de Diamante</strong><span>Filo IV, Aspecto Ardiente II, Durabilidad III</span></li><li><strong>Hacha de Diamante</strong><span>Filo V, Durabilidad III</span></li><li><strong>Escudo</strong><span>Durabilidad II</span></li><li><strong>Arco</strong><span>Poder IV, Fuego, Retroceso II, Durabilidad III</span></li><li><strong>Flechas</strong><span>64</span></li><li><strong>Manzana dorada encantada</strong><span>1</span></li><li><strong>Zanahorias doradas</strong><span>64</span></li><li><strong>Manzanas doradas</strong><span>32</span></li><li><strong>Botellas de experiencia</strong><span>16</span></li>`,
            'r-warlord': `<li><strong>Casco de Nederita</strong><span>Protección IV, Durabilidad III, Reparación</span></li><li><strong>Pechera de Nederita</strong><span>Protección IV, Durabilidad III, Reparación</span></li><li><strong>Pantalones de Nederita</strong><span>Protección IV, Durabilidad III, Reparación</span></li><li><strong>Botas de Nederita</strong><span>Protección IV, Durabilidad III, Reparación</span></li><li><strong>Espada de Nederita</strong><span>Filo V, Aspecto Ardiente II, Durabilidad III, Reparación</span></li><li><strong>Hacha de Nederita</strong><span>Filo V, Durabilidad III, Reparación</span></li><li><strong>Escudo</strong><span>Durabilidad III, Reparación</span></li><li><strong>Arco</strong><span>Poder V, Retroceso II, Durabilidad III, Reparación</span></li><li><strong>Flechas</strong><span>64</span></li><li><strong>Zanahorias doradas</strong><span>64</span></li><li><strong>Manzanas doradas</strong><span>64</span></li><li><strong>Manzanas doradas encantadas</strong><span>3</span></li><li><strong>Tótem de inmortalidad</strong><span>1</span></li><li><strong>Poción arrojadiza de Fuerza (3:00)</strong><span>1</span></li><li><strong>Botellas de experiencia</strong><span>64</span></li>`,
            'k-pociones': `
<li><strong>Curación Instantánea II</strong><br><span style="color:var(--text-muted); font-size:0.9em;">10 unidades arrojadizas</span></li>
<li><strong>Invisibilidad (8:00)</strong><br><span style="color:var(--text-muted); font-size:0.9em;">7 unidades arrojadizas</span></li>
<li><strong>Velocidad II (1:30)</strong><br><span style="color:var(--text-muted); font-size:0.9em;">4 unidades arrojadizas</span></li>
<li><strong>Fuerza II (1:30)</strong><br><span style="color:var(--text-muted); font-size:0.9em;">6 unidades arrojadizas</span></li>`,
            
            'k-comida': `
<li><strong>Manzanas Doradas</strong><br><span style="color:var(--text-muted); font-size:0.9em;">6 Stacks (384 unidades)</span></li>
<li><strong>Manzanas Encantadas (Notch)</strong><br><span style="color:var(--text-muted); font-size:0.9em;">3 Stacks (192 unidades)</span></li>
<li><strong>Chuletas de Cerdo y Papas Cocidas</strong><br><span style="color:var(--text-muted); font-size:0.9em;">6 Stacks de cada una</span></li>
<li><strong>Polvo de Hueso</strong><br><span style="color:var(--text-muted); font-size:0.9em;">3 Stacks</span></li>`
        };

        const faqData = {
            'buy': { title: "¿Cómo comprar?", text: "Selecciona el paquete que desees y añádelo al carrito. Al finalizar, haz clic en 'Generar Pedido'. Se copiará un texto en tu portapapeles. Ve a nuestro Discord, abre un ticket de compra y pega ese mensaje para que un administrador procese tu pago." },
            'discord': { title: "¿Cómo unirme al Discord?", text: "Puedes unirte haciendo clic en el botón 'Discord' en el menú lateral o en el botón azul 'Entrar a Discord' en la sección de bienvenida." },
            'payment': { title: "¿Métodos de pago?", text: "Aceptamos diversos métodos de pago dependiendo de tu país (PayPal, Criptomonedas, Transferencia Bancaria, etc.). Todos los detalles se coordinan directamente en el ticket de soporte." },
            'security': { title: "¿Es seguro?", text: "Totalmente. Todas las compras son gestionadas manualmente por los dueños del servidor (Polagodd y Chimii) para garantizar que recibas tus ítems sin problemas." }
        };

        // --- GLOBAL VARS ---
        let globalUser = "Invitado"; // Inicializada por defecto
        let skinViewer = null;
        let cart = [];
        let isPermanent = false;
        let currentClientIP = null;
        let currentCatalogSnapshot = {};
        let editingCatKey = null;
        let editingKitKey = null;
        let couponsCache = {};
        let appliedCouponCode = null;
        let appliedDiscountPercent = 0;

        // --- DESBANEO LOGIC ---
        function updateUnbanPrice() {
            const select = document.getElementById("unban-duration");
            const priceDisplay = document.getElementById("unban-display-price");
            if (!select || !priceDisplay) return;
            const option = select.options[select.selectedIndex];
            const price = option.getAttribute("data-price");
            priceDisplay.textContent = price;
        }

        function addUnbanToCart() {
            const userInput = document.getElementById("unban-user");
            const platformSelect = document.getElementById("unban-platform");
            const durationSelect = document.getElementById("unban-duration");
            
            if (!userInput || !platformSelect || !durationSelect) return;

            const user = userInput.value.trim() || globalUser;
            const platform = platformSelect.value;
            const durationOption = durationSelect.options[durationSelect.selectedIndex];
            const price = parseFloat(durationOption.getAttribute("data-price"));
            const durationText = durationOption.text.split('(')[0].trim(); // "1 Día", "Permanente", etc.

            // Nombre único para el carrito y validación
            // Mapeamos durationText a las claves de OFFICIAL_PRICES
            let officialKey = `Desbaneo ${durationText}`;
            
            // Ajuste manual para coincidir con OFFICIAL_PRICES si el texto varía
            // En el HTML puse: "1 Día ($2.00 USD)" -> split -> "1 Día" -> "Desbaneo 1 Día"
            // "Permanente ($10.00 USD)" -> split -> "Permanente" -> "Desbaneo Permanente"

            const itemName = `Desbaneo ${platform} - ${user} (${durationText})`;
            
            // Hack para que la validación de precio funcione:
            // Usaremos una propiedad oculta o modificaremos checkout para entender este item especial.
            // O mejor, registramos el nombre exacto en el carrito pero usamos un "type" especial.

            cart.push({
                name: itemName,
                price: price,
                type: "Desbaneo",
                officialKey: `Desbaneo ${durationText}` // Para validación
            });
            
            updateCartUI();
            alert("Desbaneo añadido al carrito");
        }

        // --- FUNCIONES SISTEMA ---
        function updateSkin() {
            const nick = document.getElementById("nick-input").value;
            const preview = document.getElementById("avatar-preview");
            const url = nick.length > 0 ? `https://minotar.net/helm/${nick}/100.png` : `https://minotar.net/helm/Steve/100.png`;
            preview.style.backgroundImage = `url('${url}')`;
        }

        function submitLogin() {
            // console.log("SubmitLogin llamado");
            const input = document.getElementById("nick-input");
            const val = input.value.trim();
            if(val === "") {
                input.style.borderColor = "red";
                setTimeout(() => input.style.borderColor = "#333", 1000);
                return;
            }
            globalUser = val; 
            // console.log("Usuario global:", globalUser);
            
            // Registrar visita (tracking)
            registerVisit(globalUser).catch(() => {});

            document.getElementById("login-overlay").style.opacity = "0";
            setTimeout(() => {
                document.getElementById("login-overlay").style.display = "none";
                document.getElementById("terms-overlay").style.display = "flex";
                setTimeout(() => document.getElementById("terms-overlay").style.opacity = "1", 50);
            }, 500);
        }

async function registerVisit(username) {
    try {
        let data = { ip: 'unknown', country_name: 'Unknown', city: 'Unknown', country_code: 'UNK' };
        try {
            const response = await fetch('https://ipapi.co/json/');
            data = await response.json();
        } catch(err) {}
        
        const visitData = {
            username: username,
            ip: data.ip || 'unknown',
            country: data.country_name || 'Unknown',
            city: data.city || 'Unknown',
            countryCode: data.country_code || 'UNK',
            timestamp: Date.now()
        };

        const targetDb = db;
        if (!targetDb) return;

        // --- ESTA ES LA LÍNEA QUE DEBES BORRAR O COMENTAR ---
        // console.log("Escribiendo visita en:", targetDb.ref('visits').toString()); 
        
        await targetDb.ref('visits').push(visitData);
    } catch (e) {
        // También podrías quitar este console.error si quieres silencio total
        // console.error("Error guardando visita:", e);
    }
}

        // --- AUTO-TRACKING AL CARGAR ---
        // Se intenta ejecutar inmediatamente si ya cargó, o espera al load

        function enterShop() {
            document.getElementById("sidebar-username").innerText = globalUser;
            document.getElementById("sidebar-avatar").style.backgroundImage = `url('https://minotar.net/helm/${globalUser}/40.png')`;
            document.getElementById("cart-username").innerText = globalUser;
            document.getElementById("terms-overlay").style.opacity = "0";
            setTimeout(() => document.getElementById("terms-overlay").style.display = "none", 500);
            
            // Iniciar widget del servidor al entrar
            fetchServerStatus();
            setInterval(fetchServerStatus, 60000); 
            
            // Iniciar lógica de Firebase (ofertas, catálogo, toasts)
            initFirebaseRealtime();
        }

        function resetNavigation() {
            document.getElementById('scroll-container').scrollTop = 0;
            document.querySelectorAll('.submenu').forEach(el => el.classList.remove('show'));
            document.querySelectorAll('.submenu-toggle').forEach(el => el.classList.remove('open'));
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            document.getElementById('btn-inicio').classList.add('active');
        }

        // --- CARRITO ---
        function openCart() { 
            const m = document.getElementById("cart-modal");
            m.style.display = "flex";
            setTimeout(() => m.style.opacity = "1", 10);
        }
        function closeModal(id) {
            const modal = document.getElementById(id);
            if (modal) modal.style.display = "none";
        }
        function addToCart(name, btn) {
            // Fix: Usar selector correcto (.product-card)
            const card = btn.closest('.product-card') || btn.closest('.card');
            
            let price = 0;
            // Intentar obtener precio del DOM (.amount) o de los datos estáticos
            const amountEl = card ? card.querySelector('.amount') : null;
            
            if (amountEl) {
                price = parseFloat(amountEl.innerText);
            } else {
                // Fallback: Buscar en arrays de datos por nombre
                const rankItem = staticRanks.find(r => r.name === name);
                const kitItem = staticKits.find(k => k.name === name);
                
                if (rankItem) price = isPermanent ? rankItem.priceP : rankItem.priceM;
                else if (kitItem) price = kitItem.price;
                else {
                    // Último recurso: Scrapeo simple
                    const priceText = card ? (card.querySelector('.card-price')?.innerText || "0") : "0";
                    price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;
                }
            }

            let type = (name.includes("Rango") || name.includes("Rank")) ? (isPermanent ? "Permanente" : "Mensual") : "Paquete";

            cart.push({ name, price, type });
            updateCartUI();
            
            const originalText = btn.innerText;
            btn.innerText = "¡Listo!";
            btn.style.borderColor = "var(--success)";
            setTimeout(() => { btn.innerText = originalText; btn.style.borderColor = "var(--primary)"; }, 1000);
        }

        function addUnbanToCart() {
            const userInput = document.getElementById("unban-user");
            const platformSelect = document.getElementById("unban-platform");
            const durationSelect = document.getElementById("unban-duration");
            
            if (!userInput || !platformSelect || !durationSelect) return;

            const user = userInput.value.trim() || globalUser;
            const platform = platformSelect.value;
            const durationOption = durationSelect.options[durationSelect.selectedIndex];
            const price = parseFloat(durationOption.getAttribute("data-price"));
            
            // Texto del option: "1 Día ($2.00 USD)" -> split("(") -> ["1 Día ", "$2.00 USD)"] -> trim -> "1 Día"
            let durationText = durationOption.text.split('(')[0].trim();
            
            // Construir la key oficial para validación
            // OFFICIAL_PRICES tiene keys como "Desbaneo 1 Día"
            let officialKey = `Desbaneo ${durationText}`;

            const itemName = `Desbaneo ${platform} - ${user} (${durationText})`;

            cart.push({
                name: itemName,
                price: price,
                type: "Desbaneo",
                officialKey: officialKey 
            });
            
            updateCartUI();
            alert(`Desbaneo para ${user} añadido al carrito.`);
        }

        function removeFromCart(index) { cart.splice(index, 1); updateCartUI(); }

        function updateCartUI() {
            document.getElementById("cart-count").innerText = cart.length;
            const container = document.getElementById("cart-items-container");
            let subtotal = 0;
            let discountableSubtotal = 0;
            
            if(cart.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666;">Vacío</p>';
            } else {
                container.innerHTML = "";
                cart.forEach((item, index) => {
                    subtotal += item.price;
                    if (item.type !== "Desbaneo") {
                        discountableSubtotal += item.price;
                    }
                    container.innerHTML += `
                        <div class="cart-item">
                            <div>${item.name} <small>(${item.type})</small></div>
                            <div>$${item.price.toFixed(2)} <i class="fas fa-trash" style="color:#ff5555; cursor:pointer; margin-left:10px;" onclick="removeFromCart(${index})"></i></div>
                        </div>`;
                });
            }

            let total = subtotal;
            if (appliedDiscountPercent > 0) {
                const discountAmount = discountableSubtotal * (appliedDiscountPercent / 100);
                total = subtotal - discountAmount;
            }
            document.getElementById("cart-total-price").innerText = total.toFixed(2);
        }

        function toggleGiftInput() {
            const isGift = document.getElementById("is-gift").checked;
            document.getElementById("gift-nickname").style.display = isGift ? "block" : "none";
        }

        function applyCouponFromCart() {
            const input = document.getElementById("cart-coupon-input");
            const statusEl = document.getElementById("cart-coupon-status");
            if (!input || !statusEl) return;
            // Sanitización del cupón: solo alfanumérico
            const rawCode = (input.value || "").trim().replace(/[^a-zA-Z0-9]/g, '');
            input.value = rawCode; // Reflejar sanitización en el input

            if (!rawCode) {
                appliedCouponCode = null;
                appliedDiscountPercent = 0;
                statusEl.style.color = "#888";
                statusEl.textContent = "Sin cupón aplicado.";
                updateCartUI();
                return;
            }
            const code = rawCode.toUpperCase();
            const coupon = couponsCache && couponsCache[code];
            if (!coupon || !coupon.percent) {
                appliedCouponCode = null;
                appliedDiscountPercent = 0;
                statusEl.style.color = "#ff5555";
                statusEl.textContent = "Cupón inválido.";
            } else if (coupon.maxUses && (coupon.uses || 0) >= coupon.maxUses) {
                appliedCouponCode = null;
                appliedDiscountPercent = 0;
                statusEl.style.color = "#ff5555";
                statusEl.textContent = "Cupón agotado.";
            } else {
                appliedCouponCode = code;
                appliedDiscountPercent = parseInt(coupon.percent, 10) || 0;
                statusEl.style.color = "#00ff88";
                statusEl.textContent = `Cupón aplicado: -${appliedDiscountPercent}%`;
            }
            updateCartUI();
        }

        async function checkout() {
            // Verificación de Integridad de Sesión (Session Key)
            if (!window._sK) {
                logSystem('security_alert', 'INTENTO DE ACCESO DIRECTO A CHECKOUT - Usuario: ' + (globalUser || 'Invitado'));
                alert("Error de seguridad: Sesión inválida.");
                return;
            }

            if (cart.length === 0) { alert("Carrito vacío"); return; }

            const isGift = document.getElementById("is-gift").checked;
            const giftNick = (document.getElementById("gift-nickname").value || "").trim().replace(/[^a-zA-Z0-9_]/g, '');
            const currentUser = globalUser || "Invitado";
            const discordInput = document.getElementById("discord-user-input");
            const discordUser = (discordInput.value || "").trim();

            if (!discordUser) {
                discordInput.classList.add('input-error');
                setTimeout(() => {
                    discordInput.classList.remove('input-error');
                }, 600);
                return;
            }

            if (isGift && !giftNick) {
                alert("Por favor, ingresa el Nickname del destinatario (solo alfanumérico).");
                return;
            }

            // --- Obtener IP con checkout blindado (fallback 0.0.0.0) ---
            let resolvedIP = "0.0.0.0";
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 4000);
                const ipResp = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
                clearTimeout(timeoutId);
                const ipData = await ipResp.json();
                if (ipData && ipData.ip) resolvedIP = ipData.ip;
            } catch (e) {
                console.warn("No se pudo obtener IP pública, usando 0.0.0.0", e);
                try {
                    await logSystem("error", "Fallo obteniendo IP pública; usando 0.0.0.0", { error: (e && e.message) || String(e) });
                } catch (_) {}
            }
            currentClientIP = resolvedIP;

            const canOrder = await checkAntiSpam(currentClientIP);
            if (!canOrder) {
                alert("Has realizado demasiados pedidos recientemente. Intenta nuevamente en unos minutos.");
                return;
            }

            // --- Construir información de carrito (CON VALIDACIÓN DE SEGURIDAD) ---
            const items = [];
            let totalBase = 0;
            let totalFinal = 0;
            let discountableTotal = 0;

            cart.forEach(i => {
                let officialPrice = 0;

                // 1. Intentar buscar en precios estáticos
                if (OFFICIAL_PRICES[i.name]) {
                    const priceData = OFFICIAL_PRICES[i.name];
                    if (typeof priceData === 'object') {
                        // Es un rango (Mensual/Permanente)
                        officialPrice = priceData[i.type] || 0;
                    } else {
                        // Es un kit estático
                        officialPrice = priceData;
                    }
                } 
                // 1.5 Buscar si es un item especial de desbaneo
                else if (i.type === "Desbaneo" && i.officialKey && OFFICIAL_PRICES[i.officialKey]) {
                    officialPrice = OFFICIAL_PRICES[i.officialKey];
                }
                // 2. Si no es estático, buscar en el catálogo dinámico de Firebase
                else if (currentCatalogSnapshot) {
                    const kits = Object.values(currentCatalogSnapshot);
                    const dbKit = kits.find(k => k && k.displayName === i.name);
                    if (dbKit) {
                        officialPrice = parseFloat(dbKit.price) || 0;
                    }
                }

                // VALIDACIÓN DE FRAUDE: Comparar precio detectado en HTML (i.price) con el oficial
                const detectedPrice = parseFloat(i.price);
                if (Math.abs(detectedPrice - officialPrice) > 0.01) {
                    console.error("ALERTA DE SEGURIDAD: Discrepancia de precio detectada.", {
                        producto: i.name,
                        detectado: detectedPrice,
                        oficial: officialPrice
                    });
                    logSystem("security_alert", 'POSIBLE INTENTO DE MANIPULACIÓN DE PRECIOS - Usuario: ' + currentUser, {
                        producto: i.name,
                        precioHTML: detectedPrice,
                        precioOficial: officialPrice,
                        ip: currentClientIP
                    });
                }

                // USAR SIEMPRE EL PRECIO OFICIAL PARA EL CÁLCULO
                totalBase += officialPrice;
                totalFinal += officialPrice;
                
                if (i.type !== "Desbaneo") {
                    discountableTotal += officialPrice;
                }

                items.push({
                    name: i.name,
                    type: i.type,
                    basePrice: officialPrice,
                    finalPrice: officialPrice,
                    hasOffer: false
                });
            });

            // --- Aplicar cupón al total final (si hay) ANTES de enviar a Discord ---
            if (appliedDiscountPercent > 0 && appliedCouponCode) {
                const discountAmount = discountableTotal * (appliedDiscountPercent / 100);
                totalFinal = totalFinal - discountAmount;
                
                // Actualizar precio final de items individuales para el desglose (proporcional)
                items.forEach(item => {
                    if (item.type !== "Desbaneo") {
                        item.finalPrice = item.basePrice * (1 - appliedDiscountPercent / 100);
                    }
                });
            }

            const order = {
                user: currentUser,
                discord: discordUser,
                isGift,
                giftNick: isGift ? giftNick : null,
                items,
                totalBase,
                totalFinal,
                couponCode: appliedCouponCode || null,
                couponPercent: appliedDiscountPercent || 0,
                ip: currentClientIP,
                createdAt: Date.now()
            };
            
            // console.log("Enviando orden:", order);

            // --- Persistencia en Firebase (obligatoria) ---
            let savedToFirebase = false;
            try {
                const newRef = dbRefs.recentPurchases.push();
                await newRef.set(order);

                const ipKey = (order.ip || "0.0.0.0").replace(/\./g, '_');
                const ipRef = dbRefs.ipOrders.child(ipKey).push();
                await ipRef.set({ createdAt: order.createdAt });
                savedToFirebase = true;
            } catch (e) {
                console.error("Error guardando pedido en Firebase:", e);
                try {
                    await logSystem("error", "Fallo guardando pedido en Firebase", { error: (e && e.message) || String(e) });
                } catch (_) {}
            }

            // --- Enviar compra al backend (POST /api/purchase) REEMPLAZADO POR LOGICA SERVERLESS ---
            try {
                // 1. Validar y descontar cupón con transacción atómica
                if (order.couponCode) {
                    console.log("Procesando cupón:", order.couponCode);
                    const couponRef = db.ref('coupons/' + order.couponCode);
                    const transactionResult = await couponRef.transaction((currentData) => {
                        if (!currentData) return; // Cupón no existe
                        // Si maxUses existe y usos >= maxUses, abortar
                        if (currentData.maxUses !== undefined && currentData.maxUses !== null) {
                             const max = parseInt(currentData.maxUses, 10);
                             const current = parseInt(currentData.uses || 0, 10);
                             if (current >= max) {
                                 return; // Abortar transacción (devuelve undefined)
                             }
                        }
                        // Incrementar usos
                        return { ...currentData, uses: (currentData.uses || 0) + 1 };
                    });

                    if (!transactionResult.committed) {
                        throw new Error("El cupón ha alcanzado su límite de usos o ya no es válido.");
                    }
                    console.log("Cupón aplicado y descontado con éxito.");
                }

                // 2. Guardar compra en recent_purchases
                // Ya se hizo arriba en el bloque "Persistencia en Firebase", pero aseguramos que sea la fuente de verdad.
                // Si llegamos aquí, el cupón se descontó correctamente.
                
                savedToFirebase = true;
            } catch (e) {
                console.error("Fallo procesando compra (Serverless):", e);
                savedToFirebase = false;
                alert(`Error al procesar el pedido: ${e.message}`);
                return; // Detener checkout
            }

            // --- Webhook de Discord (aún en frontend por ahora) ---
            try {
                await sendDiscordWebhook(order);
            } catch (e) {
                console.error("Error en webhook (ignorando para no romper checkout):", e);
                try {
                    await logSystem("error", "Fallo enviando webhook de Discord", { error: (e && e.message) || String(e) });
                } catch (_) {}
            }

            // --- Mensaje para el jugador + portapapeles (SIEMPRE se intenta) ---
            let msg = "";
            if (isGift) {
                msg = `¡Hola! Quiero realizar una compra para REGALAR.\n👤 De: ${currentUser}\n🎁 Para: ${giftNick}\n--------------------------------\n`;
            } else {
                msg = `¡Hola! Quiero realizar una compra.\n👤 Usuario: ${currentUser}\n--------------------------------\n`;
            }
            items.forEach(i => {
                msg += `• ${i.name} [[${i.type}]] - $${i.finalPrice.toFixed(2)}\n`;
            });
            msg += `--------------------------------\n💰 TOTAL: $${totalFinal.toFixed(2)} USD\n`;
            if (appliedDiscountPercent > 0 && appliedCouponCode) {
                msg += `Descuento: ${appliedCouponCode} - ${appliedDiscountPercent}% desc.\n`;
            }
            msg += `He leído y acepto los Términos y Condiciones.\nEspero instrucciones de pago.`;

            let clipboardOk = true;
            try {
                await navigator.clipboard.writeText(msg);
            } catch (e) {
                clipboardOk = false;
                console.error("No se pudo copiar al portapapeles:", e);
            }

            // --- Feedback final al jugador ---
            if (!savedToFirebase) {
                alert("Tu pedido se generó, pero hubo un problema al registrarlo en el sistema. El detalle fue copiado (si es posible), pégalo en tu ticket y avisa al staff.");
                return;
            }

            // Reproducir sonido justo antes del alert de éxito
            try {
                const successSound = new Audio("https://www.myinstants.com/media/sounds/apple-pay-45496.mp3.");
                successSound.play().catch(() => {});
            } catch (e) {
                console.warn("No se pudo reproducir el sonido de éxito:", e);
            }

            startDiscordRedirectCountdown(5, clipboardOk);
        }

        async function checkAntiSpam(ip) {
            if (!ip) return true;
            const ipKey = ip.replace(/\./g, '_');
            const snap = await dbRefs.ipOrders.child(ipKey).once("value");
            const data = snap.val() || {};
            const now = Date.now();
            const FIVE_MIN = 5 * 60 * 1000;
            const recent = Object.values(data).filter(o => o && (now - o.createdAt) <= FIVE_MIN);
            return recent.length < 3;
        }

        async function sendDiscordWebhook(order) {
            const url = WEBHOOK_URL;
            if (!url) return;
            try {
                const createdAt = new Date(order.createdAt || Date.now());
                const codeTick = "\u0060";
                const lines = (order.items || []).map(i => {
                    const price = (i.finalPrice || 0).toFixed(2);
                    return "> **• " + i.name + "** (" + i.type + ") - " + codeTick + "$" + price + " USD" + codeTick;
                }).join("\\n");
                const hasCoupon = order.couponCode && order.couponPercent > 0;
                const couponText = hasCoupon
                    ? codeTick + order.couponCode + codeTick + " (-" + order.couponPercent + "%)"
                    : "Ninguno";
                const playerValue = codeTick + "Nickname" + codeTick + " " + (order.user || "Desconocido");
                const giftValue = order.isGift
                    ? "✅ Sí (" + (order.giftNick || "-") + ")"
                    : "❌ No";
                const totalValue = "**$" + (order.totalFinal || 0).toFixed(2) + " USD**";
                const ipValue = "||" + (order.ip || "0.0.0.0") + "||";
                const body = {
                    content: "🔔 **¡Nuevo pedido pendiente de pago!**",
                    embeds: [
                        {
                            title: "🛒 DETALLES DEL PEDIDO - ENDERLAND",
                            color: 10289151,
                            fields: [
                                { name: "👤 Jugador", value: playerValue, inline: true },
                                { name: "🎁 Es regalo", value: giftValue, inline: true },
                                { name: "💰 Total a Pagar", value: totalValue, inline: true },
                                { name: "🎟️ Cupón Aplicado", value: couponText, inline: true },
                                { name: "📦 Paquetes Seleccionados", value: lines || "-", inline: false },
                                { name: "🌐 IP del Cliente", value: ipValue, inline: false }
                            ],
                            footer: { text: `Enderland Store | ${createdAt.toLocaleString()}` },
                            timestamp: createdAt.toISOString()
                        }
                    ]
                };
                await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body)
                });
            } catch (e) {
                console.error("Error enviando webhook:", e);
                try {
                    await logSystem("error", "Fallo enviando webhook de Discord", { error: (e && e.message) || String(e) });
                } catch (_) {}
            }
        }

        function showPurchaseToast(order) {
            const container = document.getElementById("toast-container");
            if (!container || !order || !order.items) return;

            const who = order.user || order.username || "Un jugador";
            const firstItem = order.items[0];
            const what = firstItem ? firstItem.name || firstItem.productName || "un paquete" : "un paquete";

            const toast = document.createElement("div");
            toast.className = "toast";
            toast.innerHTML = `
                <span class="toast-icon"><i class="fas fa-shopping-basket"></i></span>
                <span><strong>${who}</strong> acaba de comprar <strong>${what}</strong>.</span>
            `;
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = "0";
                toast.style.transform = "translateX(-10px)";
                setTimeout(() => toast.remove(), 300);
            }, 6000);
        }

        async function logSystem(level, message, context) {
            // Logging client-side only for security
            console[level === "error" ? "error" : "log"](`[System] ${message}`, context || "");
        }

        function startDiscordRedirectCountdown(seconds, clipboardOk) {
            const container = document.getElementById("toast-container");
            if (!container) return;
            const toast = document.createElement("div");
            toast.className = "toast";
            const baseMsg = clipboardOk
                ? "Pedido copiado con éxito. Abre ticket en el servidor de Discord, direccionando en"
                : "Pedido generado. Abre ticket en el servidor de Discord, direccionando en";
            let s = seconds;
            toast.innerHTML = `<span class="toast-icon"><i class="fas fa-bell"></i></span><span>${baseMsg} ${s}</span>`;
            container.appendChild(toast);
            const iv = setInterval(() => {
                s -= 1;
                toast.innerHTML = `<span class="toast-icon"><i class="fas fa-bell"></i></span><span>${baseMsg} ${s}</span>`;
                if (s <= 0) {
                    clearInterval(iv);
                    setTimeout(() => toast.remove(), 1000);
                    window.open("https://discord.gg/wmS4Ztg8Af", "_blank");
                    window.open("https://discord.gg/wmS4Ztg8Af", "_blank");
                }
            }, 1000);
        }


        // --- PRECIOS ---
        function togglePrice(sender) {
            if (!sender) return;
            
            isPermanent = sender.checked;

            // Sincronizar visualmente todos los interruptores de la tienda
            document.querySelectorAll('.price-switcher-container').forEach(container => {
                const checkbox = container.querySelector('input[type="checkbox"]');
                const knob = container.querySelector('.knob'); // The moving part
                // Select only the 'MES' and 'PERM' text labels, excluding the slider and knob spans
                const textSpans = Array.from(container.querySelectorAll('span')).filter(s => s.textContent === 'MES' || s.textContent === 'PERM');

                if (checkbox) checkbox.checked = isPermanent;
                
                // El primer span es "MES", el último es "PERM"
                if (textSpans.length >= 2) {
                    textSpans[0].style.color = !isPermanent ? 'var(--primary)' : '#888';
                    textSpans[1].style.color = isPermanent ? 'var(--primary)' : '#888';
                }
                
                if (knob) {
                    knob.style.transform = isPermanent ? 'translateX(22px)' : 'translateX(0)';
                }
            });

            // Actualizar los números de los precios en las tarjetas
            document.querySelectorAll(".amount").forEach(el => {
                const m = el.getAttribute("data-m");
                const p = el.getAttribute("data-p");
                if (m && p) el.innerText = isPermanent ? p : m;
            });

            // Resetear carrito para evitar discrepancias de precio
            if(cart.length > 0) { cart = []; updateCartUI(); }
        }

        // --- MODALES EXTRA ---
        function showKitDetails(kitKey, isStatic = true) {
            const modal = document.getElementById("kit-modal");
            const listContainer = document.getElementById("kit-modal-list");
            const title = document.getElementById("kit-modal-title");
            const img = document.getElementById("kit-modal-img");

            if (!modal || !listContainer || !title || !img) return;

            let item = null;
            let imageSrc = null;
            let contentHtml = "<li><i class='fas fa-info-circle'></i> Detalles no disponibles.</li>";

            if (isStatic) {
                const rankItem = staticRanks.find(r => r.id === kitKey);
                const kitItem = staticKits.find(k => k.id === kitKey);
                item = rankItem || kitItem;
            } else if (currentCatalogSnapshot) {
                // Lógica para kits dinámicos de Firebase
                const allKits = Object.values(currentCatalogSnapshot).flatMap(cat => Object.values(cat.kits || {}));
                const dynKit = allKits.find(k => (k.id || k.name.replace(/\s+/g, '-').toLowerCase()) === kitKey);
                if (dynKit) {
                    item = { 
                        display: dynKit.displayName || dynKit.name,
                        benefits: dynKit.benefits || [],
                        img: dynKit.imageUrl,
                        isDynamic: true
                    };
                }
            }

            if (!item) {
                title.innerText = "ERROR";
                listContainer.innerHTML = "<li>No se pudo encontrar el artículo.</li>";
                img.style.display = "none";
                modal.style.display = "flex";
                setTimeout(() => modal.style.opacity = "1", 10);
                return;
            }

            title.innerText = item.display ? item.display.toUpperCase() : "DETALLES";

            if (item.isDynamic) {
                contentHtml = item.benefits.map(b => `<li><i class="fas fa-check" style="color:var(--success); margin-right:10px;"></i>${b}</li>`).join('');
                if (!contentHtml) contentHtml = "<li>No hay beneficios detallados.</li>";
            } else if (item.features) { // Static Rank
                contentHtml = item.features.map(f => {
                    if (f.startsWith('Kit ')) {
                        const parts = f.split(':');
                        const kitTitle = parts[0];
                        
                        // Intenta obtener contenido detallado de kitData, si existe
                        const detailedContent = kitData[item.id];

                        let kitHtml = `<li style="margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.1);">
                            <strong style="color: var(--secondary); display: block; margin-bottom: 10px; font-size: 1.1em;"><i class="fas fa-box-open" style="margin-right: 8px;"></i>${kitTitle}</strong>
                            <ul style="list-style: none; padding-left: 10px;">${detailedContent || '<li style="color:#888;">Detalles no disponibles</li>'}</ul>`;

                        kitHtml += `</ul></li>`;
                        return kitHtml;
                    }
                    return `<li style="margin-bottom:8px;"><i class="fas fa-terminal" style="color:var(--primary); margin-right:10px;"></i>${f}</li>`;
                }).join('');
            } else { // Static Kit
                contentHtml = kitData[item.id] || "<li><i class='fas fa-box'></i> Contenido estándar del kit.</li>";
            }
            listContainer.innerHTML = contentHtml;
            
            // Mostrar imagen ampliada
            imageSrc = item.img || kitImages[item.id] || null;
            if (imageSrc) {
                img.src = imageSrc;
                img.style.display = "block";
                img.style.width = "180px";
                img.style.margin = "0 auto 20px auto";
                img.style.filter = "drop-shadow(0 0 15px var(--primary-glow))";
            } else {
                img.style.display = "none";
            }
            modal.style.display = "flex";
            setTimeout(() => modal.style.opacity = "1", 10);
        }
        
        function openFAQ(id) {
            const modal = document.getElementById("faq-modal");
            const title = document.getElementById("faq-title");
            const body = document.getElementById("faq-body");
            const data = faqData[id];

            if(data) {
                title.innerText = data.title;
                body.innerText = data.text;
                modal.style.display = "flex";
                setTimeout(() => modal.style.opacity = "1", 10);
            }
        }

        function showFullSkin() {
            if(globalUser === "Invitado") return;
            const modal = document.getElementById("skin-modal");
            document.getElementById("skin-username-display").innerText = globalUser;
            modal.style.display = "flex";
            setTimeout(() => modal.style.opacity = "1", 10);

            if(skinViewer) {
                skinViewer.loadSkin(`https://minotar.net/skin/${globalUser}`);
            } else {
                skinViewer = new skinview3d.SkinViewer({
                    canvas: document.getElementById("skin_container"),
                    width: 300, height: 300, skin: `https://minotar.net/skin/${globalUser}`
                });
                skinViewer.width = document.getElementById("skin-viewer-container").clientWidth;
                skinViewer.height = 300;
                skinViewer.loadCape(null);
                skinViewer.animation = new skinview3d.WalkingAnimation();
                skinViewer.animation.speed = 1.0;
                let control = skinview3d.createOrbitControls(skinViewer);
                control.enableRotate = true; control.enableZoom = true;
            }
        }

        function copyIP() { navigator.clipboard.writeText("play.enderland.org"); alert("IP Copiada"); }

        // --- NAVIGATION SCROLL ---
        const mainContent = document.getElementById('scroll-container');
        const sections = document.querySelectorAll('section');
        const navItems = document.querySelectorAll('.sidebar a.nav-item');

        mainContent.addEventListener('scroll', () => {
            let current = '';
            sections.forEach(section => {
                if (mainContent.scrollTop >= (section.offsetTop - 150)) {
                    current = section.getAttribute('id');
                }
            });
            navItems.forEach(item => {
                item.classList.remove('active');
                if (item.getAttribute('href') === '#' + current) {
                    item.classList.add('active');
                    if(current.includes('semi') || current.includes('vanilla')) {
                        let parentType = current.includes('kits') ? 'kits' : 'rangos';
                        document.getElementById('submenu-' + parentType).classList.add('show');
                        document.getElementById('toggle-' + parentType).classList.add('open');
                    }
                }
            });
        });

        function toggleSubmenu(id) {
            document.getElementById('submenu-' + id).classList.toggle('show');
            document.getElementById('toggle-' + id).classList.toggle('open');
        }

        // --- SERVER WIDGET & MODAL LOGIC ---
        function fetchServerStatus() {
            const ip = "play.enderland.org";
            const statusText = document.getElementById("server-status-text");
            const badge = document.getElementById("server-status-badge");
            const count = document.getElementById("player-count");
            const progress = document.getElementById("player-progress");
            const version = document.getElementById("server-version");
            const ping = document.getElementById("server-ping");

            fetch(`https://api.mcsrvstat.us/2/${ip}`)
                .then(response => response.json())
                .then(data => {
                    if (data.online) {
                        if(statusText) statusText.innerText = "ONLINE";
                        if(badge) badge.classList.remove("offline");
                        
                        const current = data.players.online;
                        const max = data.players.max;
                        if(count) count.innerHTML = `${current} <span>/ ${max}</span>`;
                        
                        const percentage = Math.min((current / max) * 100, 100);
                        if(progress) progress.style.width = `${percentage}%`;

                        if(version) version.innerText = data.version;
                        if(ping) ping.innerText = (data.debug && data.debug.ping ? data.debug.ping : "24") + " ms";
                    } else {
                        setOfflineMode();
                    }
                })
                .catch(err => {
                    console.error("Error al obtener estado:", err);
                    setOfflineMode();
                });

            function setOfflineMode() {
                if(statusText) statusText.innerText = "OFFLINE";
                if(badge) badge.classList.add("offline");
                if(count) count.innerHTML = "0 <span>/ 0</span>";
                if(progress) progress.style.width = "0%";
                if(version) version.innerText = "--";
                if(ping) ping.innerText = "--";
            }
        }

        // Función para abrir el modal al hacer click en el widget
        function openServerModal() {
            const m = document.getElementById("server-modal");
            m.style.display = "flex";
            setTimeout(() => m.style.opacity = "1", 10);
            fetchServerDetails();
        }

        // Función para cargar lista de jugadores y detalles
        function fetchServerDetails() {
            const ip = "play.enderland.org";
            const container = document.getElementById("player-list-container");
            const motdElement = document.getElementById("server-motd");
            const countElement = document.getElementById("modal-online-count");

            container.innerHTML = '<div style="text-align:center; width:100%; color:#888;"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';

            fetch(`https://api.mcsrvstat.us/2/${ip}`)
                .then(response => response.json())
                .then(data => {
                    if (data.online) {
                        let cleanMotd = data.motd ? data.motd.clean.join("\n") : "Enderland Server";
                        motdElement.innerText = cleanMotd;
                        countElement.innerText = data.players.online;

                        if (data.players.list && data.players.list.length > 0) {
                            container.innerHTML = "";
                            data.players.list.forEach(player => {
                                let playerCard = document.createElement("div");
                                playerCard.style.background = "#1a1a1a";
                                playerCard.style.border = "1px solid #333";
                                playerCard.style.borderRadius = "5px";
                                playerCard.style.padding = "10px";
                                playerCard.style.display = "flex";
                                playerCard.style.flexDirection = "column";
                                playerCard.style.alignItems = "center";
                                playerCard.style.gap = "5px";

                                let img = document.createElement("img");
                                img.src = `https://minotar.net/helm/${player}/32.png`;
                                img.style.borderRadius = "4px";
                                
                                let name = document.createElement("span");
                                name.innerText = player;
                                name.style.fontSize = "0.85rem";
                                name.style.color = "#ccc";
                                name.style.overflow = "hidden";
                                name.style.textOverflow = "ellipsis";
                                name.style.maxWidth = "100%";

                                playerCard.appendChild(img);
                                playerCard.appendChild(name);
                                container.appendChild(playerCard);
                            });
                        } else {
                            container.innerHTML = '<p style="color: #666; width: 100%; text-align: center; grid-column: 1 / -1;">No hay jugadores visibles o la lista está oculta.</p>';
                        }
                    } else {
                        motdElement.innerText = "Servidor Offline";
                        container.innerHTML = '<p style="color: #ff4747; width: 100%; text-align: center;">El servidor está apagado.</p>';
                    }
                })
                .catch(err => {
                    container.innerHTML = '<p style="color: #ff4747; width: 100%; text-align: center;">Error al cargar datos.</p>';
                });
        }

// --- ENDERBOT CHATBOT LOGIC ---
const GROQ_API_KEY = "";
const SYSTEM_PROMPT = `Eres EnderBot, el asistente oficial de ventas de Enderland Network.
TU OBJETIVO PRINCIPAL: Ayudar a los usuarios a encontrar y comprar Rangos, Kits y Desbaneos.

INSTRUCCIONES DE COMPORTAMIENTO:
1. RECOMENDACIONES Y NAVEGACIÓN: Si el usuario pide una recomendación o pregunta por un rango/kit, responde brevemente cuál le conviene y SIEMPRE usa el comando [GOTO:ID] al final del mensaje para llevarlo a la tarjeta.
2. DETALLES (Items/Encantamientos): Si preguntan qué trae exactamente un kit o rango (encantamientos, items, ventajas), NO listes el contenido. Diles: "Toca el botón 'VER BENEFICIOS' o 'VER CONTENIDO' en la tarjeta para ver la lista completa de encantamientos y detalles." Usa [GOTO:ID] para facilitarles el acceso.
3. AGREGAR AL CARRITO: Si el usuario quiere comprar (ej: "añádelo", "comprar", "lo quiero"), usa [ADD_CART:ID]. Confirma la acción ("Añadido al carrito 🛒") pero NO uses [GOTO:CART] todavía. Pregunta si desea algo más.
4. FINALIZAR COMPRA: Solo si el usuario dice explícitamente "finalizar", "pagar", "ver carrito" o "eso es todo", usa [GOTO:CART].

IDs DE PRODUCTOS (Usa estos códigos para [GOTO:ID] y [ADD_CART:ID]):
- RANGOS SEMI: r-cobre, r-hierro, r-oro, r-diamante, r-esmeralda, r-netherite (El mejor).
- RANGOS VANILLA: r-aprendiz, r-explorador, r-guerrero, r-epico, r-heroe, r-leyenda (El mejor).
- KITS: k-pociones, k-comida, k-intoxicado.
- OTROS: [GOTO:UNBAN] (Desbaneos).

Responde de forma breve, útil y con personalidad "gamer".`;

let chatHistory = [
    { role: "system", content: SYSTEM_PROMPT }
];

function toggleChat() {
    const chatWindow = document.getElementById('chatbot-window');
    const display = window.getComputedStyle(chatWindow).display;
    if (display === 'none') {
        chatWindow.style.display = 'flex';
        setTimeout(() => document.getElementById('chatbot-input').focus(), 100);
    } else {
        chatWindow.style.display = 'none';
    }
}

// MODIFICACIÓN EN js/script.js
async function sendMessageToIA(userMessage) {
    if (!userMessage.trim()) return;

    addMessageToUI(userMessage, 'user');
    document.getElementById('chatbot-input').value = '';
    chatHistory.push({ role: "user", content: userMessage });

    const typingIndicator = addMessageToUI('EnderBot está escribiendo...', 'bot', true);

    try {
        // CAMBIO AQUÍ: Llamamos a tu bot en Render, no a Groq directamente
        // Reemplaza 'tu-app-bot.onrender.com' con la URL real que te dé Render
// En tu archivo js/script.js
const response = await fetch("https://enderland-bot.onrender.com/chat-proxy", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        model: "llama3-8b-8192", // O el modelo que prefieras
        messages: chatHistory    // Tu array de mensajes
    })
});

        const data = await response.json();
        
        // El bot devuelve el objeto completo de Groq, así que accedemos igual:
        const botMessageRaw = data.choices[0].message.content;

        typingIndicator.remove();
        const processedMessage = processBotResponse(botMessageRaw);
        addMessageToUI(processedMessage, 'bot');
        chatHistory.push({ role: "assistant", content: botMessageRaw });

    } catch (error) {
        console.error("Error a través del Proxy del Bot:", error);
        typingIndicator.remove();
        addMessageToUI("Lo siento, perdí la conexión con el End. Intenta de nuevo.", 'bot');
    }
}

function processBotResponse(text) {
    let cleanText = text;

            // Detect ADD_CART command from AI (Robust: acepta cualquier contenido dentro, maneja comillas)
            const regexAdd = /\[ADD_CART:\s*([^\]]+)\s*\]/g;
    let matchAdd;
    while ((matchAdd = regexAdd.exec(text)) !== null) {
                // Limpiar ID (quitar comillas si la IA las puso)
                const rawId = matchAdd[1];
                const itemId = rawId.replace(/['"]/g, '').trim();
                console.log("EnderBot adding item:", itemId);
        cleanText = cleanText.replace(matchAdd[0], '');
        addItemToCartById(itemId);
    }

    // Regex para detectar cualquier comando GOTO (Permitir espacios)
    const regex = /\[GOTO:\s*([a-zA-Z0-9-_]+)\s*\]/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const target = match[1];
        cleanText = cleanText.replace(match[0], ''); // Limpiar tag del mensaje

        if (target === 'CART') {
            openCart();
        } else {
            let elementId = target;
            // Mapeo de palabras clave a IDs de sección
            if (target === 'RANKS') elementId = 'section-ranks';
            if (target === 'KITS') elementId = 'section-kits';
            if (target === 'UNBAN') elementId = 'section-unban';

            const element = document.getElementById(elementId);
            if (element) {
                // Si es sección usa 'start', si es tarjeta usa 'center'
                const align = (target === 'RANKS' || target === 'KITS' || target === 'UNBAN') ? 'start' : 'center';
                element.scrollIntoView({ behavior: 'smooth', block: align });
                
                // Efecto visual de resaltado para tarjetas
                if (element.classList.contains('product-card')) {
                    element.style.transition = "transform 0.3s, box-shadow 0.3s";
                    element.style.transform = "scale(1.05)";
                    element.style.boxShadow = "0 0 40px var(--primary)";
                    setTimeout(() => {
                        element.style.transform = "";
                        element.style.boxShadow = "";
                    }, 2000);
                }
            }
        }
    }

    return cleanText.trim();
}

function addItemToCartById(id) {
            const targetId = (id || "").trim().toLowerCase();
            console.log("Bot intentando añadir:", targetId);

            // Intentar buscar por ID exacto, si falla, buscar por Nombre (case-insensitive)
            let item = staticRanks.find(r => r.id.toLowerCase() === targetId);
            if (!item) {
                item = staticRanks.find(r => r.name.toLowerCase() === targetId || r.display.toLowerCase() === targetId);
            }

    let type = "Paquete";
    let price = 0;
    let name = "";

    if (item) {
        type = isPermanent ? "Permanente" : "Mensual";
        price = isPermanent ? item.priceP : item.priceM;
        name = item.name;
    } else {
                item = staticKits.find(k => k.id.toLowerCase() === targetId);
                if (!item) {
                    item = staticKits.find(k => k.name.toLowerCase() === targetId || k.display.toLowerCase() === targetId);
                }

        if (item) {
            price = item.price;
            name = item.name;
        } else {
            if (currentCatalogSnapshot) {
                Object.values(currentCatalogSnapshot).forEach(cat => {
                    if(cat.kits) {
                        Object.values(cat.kits).forEach(k => {
                                    const kId = (k.id || k.name.replace(/\s+/g, '-')).toLowerCase();
                                    const kName = (k.cartName || k.displayName || k.name).toLowerCase();
                                    if(kId === targetId || kName === targetId) {
                                name = k.cartName || k.displayName || k.name;
                                price = parseFloat(k.price);
                            }
                        });
                    }
                });
            }
        }
    }

    if(name) {
        cart.push({ name, price, type });
        updateCartUI();
        
        // Feedback visual (Toast)
        const container = document.getElementById("toast-container");
        if(container) {
            const toast = document.createElement("div");
            toast.className = "toast";
            toast.innerHTML = `<span class="toast-icon"><i class="fas fa-check"></i></span><span>Añadido: ${name}</span>`;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    } else {
        console.warn("Item no encontrado para añadir al carrito:", targetId);
    }
}

function addMessageToUI(text, sender, isTyping = false) {
    const chatContainer = document.getElementById('chatbot-messages');
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-msg', sender);
    msgDiv.innerText = text;
    if (isTyping) {
        msgDiv.id = 'typing-indicator';
        msgDiv.style.fontStyle = 'italic';
        msgDiv.style.opacity = '0.7';
    }
    
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return msgDiv;
}

function handleChatInput(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

function sendChatMessage() {
    const input = document.getElementById('chatbot-input');
    sendMessageToIA(input.value);
}
