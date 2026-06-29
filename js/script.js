// --- TEBEX MANAGER ---
        const TebexManager = {
            categories: [],
            cart: JSON.parse(localStorage.getItem('enderland_cart')) || [],
            appliedCoupon: '',
            couponDiscountPercent: 0,
            
            async init() {
                await this.loadProducts();
                this.updateCartUI();
            },

            async loadProducts() {
                try {
                    console.log("Cargando productos de Tebex...");
                    const res = await fetch('/api/tebex/categories');
                    const data = await res.json();
                    console.log("Datos de Tebex recibidos:", data);
                    if (data && data.data) {
                        this.categories = data.data;
                        this.updateCategoryButtons();
                        // Forzar renderizado inicial de la primera categoría si existe
                        if (this.categories.length > 0) {
                            this.filterByCategory(this.categories[0].id);
                        }
                    }
                } catch (e) {
                    console.error("Error loading Tebex products:", e);
                }
            },

            updateCategoryButtons() {
                const wrapper = document.querySelector('.categories-wrapper');
                if (!wrapper) return;
                
                wrapper.innerHTML = '';
                this.categories.forEach(cat => {
                    const btn = document.createElement('button');
                    btn.className = 'cat-btn';
                    
                    // Iconos según nombre
                    let icon = 'fa-tag';
                    const name = cat.name.toLowerCase();
                    if (name.includes('items')) icon = 'fa-sword';
                    else if (name.includes('rangos')) icon = 'fa-crown';
                    else if (name.includes('llaves')) icon = 'fa-key';
                    else if (name.includes('spawner')) icon = 'fa-box-open';
                    else if (name.includes('decoración')) icon = 'fa-paint-brush';
                    else if (name.includes('otros')) icon = 'fa-plus';
                    else if (name.includes('protecciones')) icon = 'fa-shield-alt';

                    btn.innerHTML = `<i class="fas ${icon}"></i> ${cat.name}`;
                    btn.onclick = (e) => {
                        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        this.filterByCategory(cat.id);
                    };
                    wrapper.appendChild(btn);
                });
            },

            filterByCategory(catId) {
                console.log("Filtrando por categoría ID:", catId);
                // Ocultar todas las secciones de Survival OP
                document.querySelectorAll('#survival-op-sections > div').forEach(s => {
                    s.style.display = 'none';
                    s.classList.remove('active-section');
                });
                this.renderAllProducts(catId);
            },

            renderAllProducts(filterCatId = null) {
                console.log("Renderizando productos. Filtro:", filterCatId);
                // Limpiar todos los contenedores antes de renderizar
                document.querySelectorAll('#survival-op-sections .products-grid').forEach(g => g.innerHTML = '');
                
                this.categories.forEach(cat => {
                    if (filterCatId && cat.id !== filterCatId) return;

                    // Mapeo simplificado para Survival OP
                    let gridId = ''; 
                    const name = cat.name.toLowerCase();
                    
                    if (name.includes('items')) gridId = 'semi-anarquico'; 
                    else if (name.includes('rangos') || name.includes('rank')) gridId = 'vanilla-rangos';
                    else if (name.includes('llaves') || name.includes('crate') || name.includes('key')) gridId = 'arena-rangos';
                    else if (name.includes('spawner')) gridId = 'kits-container';
                    else if (name.includes('decoración') || name.includes('decoracion') || name.includes('cosmetic')) gridId = 'kits-container';
                    else if (name.includes('protecciones')) gridId = 'kits-container';
                    else if (name.includes('otros')) gridId = 'kits-container';
                    else if (name.includes('survival') || name.includes(' op')) gridId = 'semi-anarquico';
                    else if (name.includes('kit') || name.includes('paquete')) gridId = 'kits-container';
                    else if (name.includes('package') || name.includes('pack')) gridId = 'kits-container';
                    
                    if (!gridId) {
                        console.warn("Categoría sin grid asignado:", name);
                        return;
                    }

                    const container = document.getElementById(gridId);
                    if (!container) {
                        console.warn("No se encontró el contenedor HTML con ID:", gridId);
                        return;
                    }
                    
                    const grid = container.querySelector('.products-grid');
                    
                    if (cat.packages && grid) {
                        console.log(`Inyectando ${cat.packages.length} productos en ${gridId}`);
                        container.style.display = 'block';

                        cat.packages.forEach(pkg => {
                            const card = document.createElement("div");
                            card.className = "card";
                            
                            // Imagen o icono por defecto
                            const imgHtml = pkg.image 
                                ? `<div class="kit-image-container"><img src="${pkg.image}" alt="${pkg.name}" class="kit-image"></div>`
                                : `<div class="kit-image-container"><i class="fas fa-gem" style="font-size:2.5rem;color:var(--primary);opacity:0.5;"></i></div>`;
                            
                            card.innerHTML = `
                                ${imgHtml}
                                <h3>${pkg.name}</h3>
                                <div class="price-tag">
                                    <span class="currency-symbol">$</span>${pkg.base_price.toFixed(2)}
                                    <span class="currency-code">${pkg.currency}</span>
                                </div>
                                ${pkg.description ? `<p style="color:#999;font-size:0.82rem;margin-bottom:14px;line-height:1.5;">${pkg.description}</p>` : ''}
                                <div style="margin-top:auto;">
                                    <button class="btn-add" onclick="TebexManager.addToCart(${pkg.id}, '${pkg.name.replace(/'/g, "\\'")}', ${pkg.base_price})">
                                        <i class="fas fa-shopping-cart"></i> AÑADIR
                                    </button>
                                </div>
                            `;
                            grid.appendChild(card);
                        });
                    }
                });
            },

            addToCart(id, name, price) {
                const existing = this.cart.find(item => item.id === id);
                if (existing) {
                    existing.qty++;
                } else {
                    this.cart.push({ id, name, price, qty: 1 });
                }
                this.saveCart();
                this.updateCartUI();
                showToast(`✅ ${name} añadido`);
            },

            removeFromCart(id) {
                this.cart = this.cart.filter(item => item.id !== id);
                this.saveCart();
                this.updateCartUI();
            },

            updateQty(id, delta) {
                const item = this.cart.find(i => i.id === id);
                if (item) {
                    item.qty += delta;
                    if (item.qty <= 0) this.removeFromCart(id);
                    else {
                        this.saveCart();
                        this.updateCartUI();
                    }
                }
            },

            saveCart() {
                localStorage.setItem('enderland_cart', JSON.stringify(this.cart));
            },

            updateCartUI() {
                const badge = document.getElementById('cart-count');
                const totalItems = this.cart.reduce((sum, item) => sum + item.qty, 0);
                if (badge) {
                    badge.textContent = totalItems;
                    if (totalItems > 0) {
                        badge.classList.remove('hidden');
                        badge.style.display = 'flex';
                    } else {
                        badge.classList.add('hidden');
                        badge.style.display = 'none';
                    }
                }
                if (document.getElementById('cart-modal')?.style.display === 'flex') {
                    this.renderCartItems();
                }
            },

            renderCartItems() {
                const container = document.getElementById('cart-items-container');
                const totalDisplay = document.getElementById('cart-total-price');
                if (!container) return;

                if (this.cart.length === 0) {
                    container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">Tu carrito está vacío.</p>';
                    totalDisplay.textContent = '0.00';
                    return;
                }

                container.innerHTML = this.cart.map(item => `
                    <div class="cart-item-row" style="display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                        <div class="cart-item-info">
                            <div style="font-weight:600; color:#fff;">${item.name}</div>
                            <div style="font-size:0.8rem; color:var(--primary);">$${item.price.toFixed(2)} c/u</div>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px;">
                                <button onclick="TebexManager.updateQty(${item.id}, -1)" style="background:none; border:none; color:#fff; cursor:pointer;"><i class="fas fa-minus" style="font-size:0.7rem;"></i></button>
                                <span style="font-weight:700; min-width:15px; text-align:center;">${item.qty}</span>
                                <button onclick="TebexManager.updateQty(${item.id}, 1)" style="background:none; border:none; color:#fff; cursor:pointer;"><i class="fas fa-plus" style="font-size:0.7rem;"></i></button>
                            </div>
                            <button onclick="TebexManager.removeFromCart(${item.id})" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                `).join('');

                const total = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
                totalDisplay.textContent = total.toFixed(2);
            },

            async validateCoupon() {
                const input = document.getElementById('cart-coupon-input');
                const status = document.getElementById('cart-coupon-status');
                const discountRow = document.getElementById('cart-discount-row');
                const discountAmount = document.getElementById('cart-discount-amount');
                const couponBadge = document.getElementById('cart-coupon-badge');
                
                if (!input || !input.value.trim()) return;
                
                if (this.cart.length === 0) {
                    status.textContent = "⚠️ El carrito está vacío. Agrega productos primero.";
                    status.style.color = "var(--danger)";
                    return;
                }
                
                status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando cupón...';
                status.style.color = "var(--text-muted)";

                try {
                    const res = await fetch('/api/tebex/validate-coupon', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            coupon: input.value.trim(),
                            cart: this.cart.map(item => ({ id: item.id, qty: item.qty }))
                        })
                    });
                    const data = await res.json();
                    
                    if (data.valid) {
                        this.appliedCoupon = data.coupon_code;
                        status.textContent = `✅ Cupón aplicado: -${data.discount_percent}% (-$${data.discount_amount.toFixed(2)})`;
                        status.style.color = "var(--success)";
                        
                        // Show discount row
                        if (discountRow && discountAmount && couponBadge) {
                            discountRow.style.display = 'flex';
                            discountAmount.textContent = data.discount_amount.toFixed(2);
                            couponBadge.textContent = data.coupon_code;
                        }
                        
                        // Update total to show discounted price
                        const totalDisplay = document.getElementById('cart-total-price');
                        if (totalDisplay && data.total) {
                            totalDisplay.textContent = data.total.toFixed(2);
                        }
                        
                        showToast(`🎉 Cupón "${data.coupon_code}" aplicado! Ahorras $${data.discount_amount.toFixed(2)}`);
                    } else {
                        this.appliedCoupon = '';
                        this.couponDiscountPercent = 0;
                        status.textContent = data.error || "❌ Cupón inválido";
                        status.style.color = "var(--danger)";
                        
                        // Hide discount row
                        if (discountRow) discountRow.style.display = 'none';
                        this.renderCartItems(); // Restore original total
                    }
                } catch (e) {
                    console.error("Error validating coupon:", e);
                    status.textContent = "❌ Error de conexión";
                    status.style.color = "var(--danger)";
                    if (discountRow) discountRow.style.display = 'none';
                }
            },

            async checkout() {
                const nickname = document.getElementById('nick-input')?.value;
                if (!nickname || nickname === "Invitado") {
                    showToast("⚠️ Ingresa tu Nickname primero");
                    return;
                }

                if (this.cart.length === 0) {
                    showToast("⚠️ El carrito está vacío");
                    return;
                }

                const btn = document.getElementById('checkout-btn');
                const originalContent = btn.innerHTML;
                btn.disabled = true;
                btn.innerHTML = 'Procesando... <i class="fas fa-spinner fa-spin"></i>';

                try {
                    const res = await fetch('/api/tebex-checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            nick: nickname,
                            cart: this.cart,
                            coupon: this.appliedCoupon
                        })
                    });
                    const data = await res.json();
                    if (data.success && data.url) {
                        const width = 800;
                        const height = 900;
                        const left = (window.screen.width / 2) - (width / 2);
                        const top = (window.screen.height / 2) - (height / 2);
                        
                        window.open(
                            data.url, 
                            'TebexCheckout', 
                            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`
                        );
                        
                        showToast("✅ Ventana de pago abierta");
                    } else {
                        showToast("❌ Error al generar el pago");
                    }
                } catch (e) {
                    console.error(e);
                    showToast("❌ Error de conexión");
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            }
        };

        // Redefine global functions for backward compatibility
        window.addToCart = (name, btn = null) => {
            let foundPkg = null;
            TebexManager.categories.forEach(cat => {
                const pkg = cat.packages.find(p => p.name === name || p.name.includes(name));
                if (pkg) foundPkg = pkg;
            });
            if (foundPkg) TebexManager.addToCart(foundPkg.id, foundPkg.name, foundPkg.base_price);
            else showToast(`⚠️ No se encontró "${name}"`);
        };

        window.openCart = () => {
            const modal = document.getElementById('cart-modal');
            if (!modal) return;
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
            TebexManager.renderCartItems();
        };

        window.closeModal = (id) => {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.remove('active');
                setTimeout(() => modal.style.display = 'none', 300);
            }
        };

        window.checkout = () => TebexManager.checkout();
        window.applyCouponFromCart = () => TebexManager.validateCoupon();

        function showToast(msg) {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
            container.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        document.addEventListener('DOMContentLoaded', () => TebexManager.init());

        // --- PROTECCIÓN ---
        (function() {
            document.addEventListener('contextmenu', e => e.preventDefault());
        })();

        let globalUser = null;
        function enterShop() {
            const nicknameInput = document.getElementById("nick-input");
            const nickname = nicknameInput ? nicknameInput.value.trim() : "";
            
            if(!nickname) {
                if(nicknameInput) nicknameInput.style.borderColor = "red";
                return;
            }
            
            globalUser = nickname;
            
            // Actualizar UIs con el nick
            const cartUserDisplay = document.getElementById("cart-username");
            if(cartUserDisplay) cartUserDisplay.innerText = globalUser;
            
            const mobileNickDisplay = document.getElementById("mobile-sidebar-username");
            if(mobileNickDisplay) mobileNickDisplay.innerText = globalUser;
            
            const sidebarNickDisplay = document.getElementById("sidebar-username");
            if(sidebarNickDisplay) sidebarNickDisplay.innerText = globalUser;

            // Cerrar overlays
            const termsOverlay = document.getElementById("terms-overlay");
            if(termsOverlay) {
                termsOverlay.style.opacity = "0";
                setTimeout(() => termsOverlay.style.display = "none", 500);
            }
            
            // Iniciar carga de Tebex
            fetchServerStatus();
            TebexManager.init();
            
            // Cargar compras recientes y top buyer
            fetchRecentPurchases();
            fetchTopBuyer();

            // Iniciar refresh automático cada 20s
            startPurchaseRefresh();
        }

        function updateSkin() {
            const nick = document.getElementById("nick-input").value;
            const preview = document.getElementById("avatar-preview");
            const url = nick.length > 0 ? `https://minotar.net/helm/${nick}/100.png` : `https://minotar.net/helm/Steve/100.png`;
            if(preview) preview.style.backgroundImage = `url('${url}')`;
        }

        function submitLogin() {
            const input = document.getElementById("nick-input");
            if(input.value.trim() === "") {
                input.style.borderColor = "red";
                setTimeout(() => input.style.borderColor = "#333", 1000);
                return;
            }
            document.getElementById("login-overlay").style.opacity = "0";
            setTimeout(() => {
                document.getElementById("login-overlay").style.display = "none";
                document.getElementById("terms-overlay").style.display = "flex";
                setTimeout(() => document.getElementById("terms-overlay").style.opacity = "1", 50);
            }, 500);
        }

        function fetchServerStatus() {
            fetch(`https://api.mcsrvstat.us/2/play.enderland.org`)
                .then(r => r.json())
                .then(data => {
                    if (data.online) {
                        const badge = document.querySelector('.server-status-badge');
                        if (badge) {
                            badge.style.display = 'inline-flex';
                        }
                    }
                }).catch(() => {});
        }

        function copyIP() { navigator.clipboard.writeText("play.enderland.org"); showToast("IP Copiada"); }

        /* =========== TOGGLE MOBILE SIDEBAR =========== */
        function toggleMobileSidebar() {
            const sidebar = document.getElementById("mobile-sidebar");
            const overlay = document.getElementById("mobile-sidebar-overlay");
            if (!sidebar) return;
            const isActive = sidebar.classList.toggle("active");
            if (overlay) {
                overlay.classList.toggle("active", isActive);
            }
            document.body.style.overflow = isActive ? "hidden" : "";
        }

        function scrollToCategory(catId) {
            const el = document.getElementById(catId);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }

        function toggleChat() {
            const w = document.getElementById("chatbot-window");
            w.style.display = (w.style.display === "flex") ? "none" : "flex";
        }

        function handleChatInput(e) {
            if (e.key === 'Enter') sendChatMessage();
        }

        function sendChatMessage() {
            const input = document.getElementById("chatbot-input");
            const container = document.getElementById("chatbot-messages");
            if (!input || !input.value.trim() || !container) return;
            const msg = input.value.trim();
            
            // User message
            const userDiv = document.createElement("div");
            userDiv.style.cssText = "margin-bottom:8px;display:flex;justify-content:flex-end;gap:8px;";
            userDiv.innerHTML = `<div style="background:rgba(157,0,255,0.25);padding:10px 14px;border-radius:12px 12px 0 12px;color:#fff;font-size:0.85rem;max-width:80%;">${escapeHtml(msg)}</div>`;
            container.appendChild(userDiv);
            
            // Bot response
            setTimeout(() => {
                const botDiv = document.createElement("div");
                botDiv.style.cssText = "margin-bottom:8px;display:flex;gap:8px;";
                botDiv.innerHTML = `<div style="background:rgba(157,0,255,0.15);padding:10px 14px;border-radius:12px 12px 12px 0;color:#ddd;font-size:0.85rem;max-width:80%;">¡Gracias por tu mensaje! Un miembro del staff te atenderá pronto. 🚀</div>`;
                container.appendChild(botDiv);
                container.scrollTop = container.scrollHeight;
            }, 600);
            
            input.value = '';
            container.scrollTop = container.scrollHeight;
        }

        /* =========== COMPRAS RECIENTES & TOP BUYER =========== */

        function fetchRecentPurchases() {
            const container = document.getElementById("recent-purchases-container");
            const section = document.getElementById("section-recent-purchases");
            if (!container) return;

            fetch("/api/tebex/recent-purchases")
                .then(r => {
                    if (!r.ok) throw new Error("HTTP " + r.status);
                    return r.json();
                })
                .then(response => {
                    const purchases = response.data || response;
                    if (!purchases || purchases.length === 0) {
                        container.innerHTML = '<div class="top-buyer-empty">Aún no hay compras recientes.</div>';
                        return;
                    }
                    section.style.display = "block";
                    let html = '<div class="recent-purchases-list">';
                    purchases.forEach(p => {
                        const nick = p.nickname || "Desconocido";
                        const avatarUrl = `https://mc-heads.net/avatar/${nick}/44`;
                        const amount = parseFloat(p.amount || 0).toFixed(2);
                        const product = p.product_name || p.products || p.product || "Producto";
                        const time = p.timestamp ? formatTimeAgo(p.timestamp) : "";
                        html += `
                            <div class="purchase-item">
                                <div class="purchase-avatar" style="background-image:url('${avatarUrl}')"></div>
                                <div class="purchase-info">
                                    <div class="purchase-nick">${escapeHtml(nick)}</div>
                                    <div class="purchase-product">${escapeHtml(product)}</div>
                                </div>
                                <div class="purchase-meta">
                                    <div class="purchase-amount">$${amount}</div>
                                    ${time ? `<div class="purchase-time">${time}</div>` : ""}
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                    container.innerHTML = html;
                })
                .catch(err => {
                    console.warn("Error fetching recent purchases:", err);
                    container.innerHTML = '<div class="top-buyer-empty">No se pudieron cargar las compras.</div>';
                });
        }

        function fetchTopBuyer() {
            const container = document.getElementById("top-buyer-container");
            const section = document.getElementById("section-top-buyer");
            if (!container) return;

            fetch("/api/tebex/top-buyer")
                .then(r => {
                    if (!r.ok) throw new Error("HTTP " + r.status);
                    return r.json();
                })
                .then(response => {
                    const data = response.data || response;
                    if (!data || !data.nickname) {
                        container.innerHTML = '<div class="top-buyer-empty">Aún no hay compradores destacados.</div>';
                        return;
                    }
                    section.style.display = "block";
                    const nick = data.nickname;
                    const total = parseFloat(data.total || 0).toFixed(2);
                    const avatarUrl = `https://mc-heads.net/avatar/${nick}/70`;
                    const flag = data.country_flag || "";
                    container.innerHTML = `
                        <div class="top-buyer-card">
                            <div class="top-buyer-avatar" style="background-image:url('${avatarUrl}')"></div>
                            <div class="top-buyer-info">
                                <div class="top-buyer-label"><i class="fas fa-crown"></i> MEJOR COMPRADOR</div>
                                <div class="top-buyer-nick">${escapeHtml(nick)} ${flag}</div>
                                <div class="top-buyer-amount">$${total} USD gastados</div>
                            </div>
                            <div class="top-buyer-trophy">🏆</div>
                        </div>
                    `;
                })
                .catch(err => {
                    console.warn("Error fetching top buyer:", err);
                    container.innerHTML = '<div class="top-buyer-empty">No se pudo cargar el mejor comprador.</div>';
                });
        }

        function formatTimeAgo(timestamp) {
            if (!timestamp) return "";
            const now = Date.now();
            const diff = now - timestamp;
            const seconds = Math.floor(diff / 1000);
            if (seconds < 60) return "Hace " + seconds + "s";
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return "Hace " + minutes + "m";
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return "Hace " + hours + "h";
            const days = Math.floor(hours / 24);
            return "Hace " + days + "d";
        }

        function escapeHtml(str) {
            if (!str) return "";
            const div = document.createElement("div");
            div.textContent = str;
            return div.innerHTML;
        }

        /* =========== SKIN VIEWER =========== */
        function showFullSkin() {
            const nick = globalUser || "Steve";
            const container = document.getElementById("skin-render-container");
            const modal = document.getElementById("skin-viewer-overlay");
            if (!container || !modal) return;
            modal.style.display = 'flex';
            container.innerHTML = `<img src="https://minotar.net/armor/body/${nick}/150.png" alt="${nick}" style="image-rendering:pixelated;">`;
        }

        function closeSkinViewer() {
            const modal = document.getElementById("skin-viewer-overlay");
            if (modal) modal.style.display = 'none';
        }

        function openPrivacyModal() {
            const modal = document.getElementById("privacy-modal");
            if (modal) modal.style.display = 'flex';
        }

        function toggleGiftInput() {
            const checkbox = document.getElementById("is-gift");
            const input = document.getElementById("gift-nickname");
            if (checkbox && input) {
                input.style.display = checkbox.checked ? "block" : "none";
            }
        }

        function resetNavigation() {
            if (TebexManager.categories.length > 0) {
                TebexManager.filterByCategory(TebexManager.categories[0].id);
                // Update active button
                document.querySelectorAll('.cat-btn').forEach((btn, i) => {
                    btn.classList.toggle('active', i === 0);
                });
            }
        }

        function closeKitPreview() {
            const modal = document.getElementById("kit-preview-overlay");
            if (modal) modal.style.display = 'none';
        }

        // Load purchases & top buyer after login
        document.addEventListener("DOMContentLoaded", function() {
            // Called when entering shop
        });

        // Auto-refresh purchases every 20 seconds after login
        let purchaseRefreshInterval = null;

        function startPurchaseRefresh() {
            if (purchaseRefreshInterval) clearInterval(purchaseRefreshInterval);
            purchaseRefreshInterval = setInterval(() => {
                fetchRecentPurchases();
                fetchTopBuyer();
            }, 20000);
        }

        function stopPurchaseRefresh() {
            if (purchaseRefreshInterval) {
                clearInterval(purchaseRefreshInterval);
                purchaseRefreshInterval = null;
            }
        }

        // Override the checkout to refresh after payment window closes
        const originalCheckout = TebexManager.checkout.bind(TebexManager);
        TebexManager.checkout = async function() {
            await originalCheckout();
            // Poll for new purchases after checkout attempt
            setTimeout(() => {
                fetchRecentPurchases();
                fetchTopBuyer();
            }, 5000);
            setTimeout(() => {
                fetchRecentPurchases();
                fetchTopBuyer();
            }, 15000);
        };
