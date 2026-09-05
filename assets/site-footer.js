/* ============================================================
   into3.ai — STANDARD SITE FOOTER BEHAVIOUR
   Dynamic copyright year + newsletter client-side validation.
   Safe to load on every page (no-ops when the footer is absent).
   ============================================================ */
(function () {
    'use strict';

    function init() {
        /* ---------- Dynamic copyright year ---------- */
        var year = new Date().getFullYear();
        document.querySelectorAll('.sf .sf-copy').forEach(function (el) {
            el.textContent = el.textContent.replace(/\b20\d{2}\b/, year);
        });

        /* ---------- Newsletter form ---------- */
        document.querySelectorAll('.sf .sf-nl-form').forEach(function (form) {
            var input = form.querySelector('.sf-nl-input');
            var btn = form.querySelector('.sf-nl-btn');
            if (!input || !btn) return;

            var timer = null;

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var email = input.value.trim();
                var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

                if (timer) clearTimeout(timer);

                if (!valid) {
                    input.style.borderColor = 'rgba(255,95,87,0.5)';
                    input.setAttribute('aria-invalid', 'true');
                    timer = setTimeout(function () {
                        input.style.borderColor = '';
                        input.removeAttribute('aria-invalid');
                    }, 2000);
                    return;
                }

                input.removeAttribute('aria-invalid');
                input.style.borderColor = 'rgba(0,255,157,0.4)';
                input.value = '';
                btn.textContent = 'Subscribed!';
                btn.style.background = 'rgba(0,255,157,0.15)';
                btn.style.color = '#00ff9d';
                timer = setTimeout(function () {
                    btn.textContent = 'Subscribe';
                    btn.style.background = '';
                    btn.style.color = '';
                    input.style.borderColor = '';
                }, 3000);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
