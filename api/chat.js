/* ============================================================
   Qafilet Al-Nour — AI Chat backend (pure browser JS)
   Runs entirely client-side so it works on GitHub Pages.
   Calls the Cohere Chat API (https://cohere.com) directly.

   API KEY (environment secret):
   - Locally:   cp api/config.sample.js api/config.js  then paste your key.
   - On GitHub Pages: the deploy workflow (see
     .github/workflows/deploy.yml) generates api/config.js at build time
     from the COHERE_API_KEY repository/environment secret.
     The key never appears in the git repository.

   SECURITY NOTE: any key shipped to a browser is visible to whoever
   opens DevTools. Protect the key with a spending limit at
   https://dashboard.cohere.com and rotate it if abused. The widget's
   built-in rate limiting (see RATE_LIMIT below) slows abuse down.
   ============================================================ */
(function (global) {
    'use strict';

    var COHERE_CHAT_URL = 'https://api.cohere.com/v2/chat';
    var MODEL = 'command-a-03-2025';

    // Client-side rate limit: 15 messages / 5 minutes per visitor (localStorage).
    var RATE_LIMIT = { max: 15, windowMs: 5 * 60 * 1000 };

    // ---------- Site knowledge base (the bot's "brain") ----------
    var KB = {
        site_name: 'قافلة النور',
        phone: '0561126760 (+966561126760)',
        whatsapp: 'https://wa.me/9660561126760',
        location: 'البطحاء، الرياض، المملكة العربية السعودية',
        hours: 'طوال أيام الأسبوع من 9:00 صباحاً حتى 9:00 مساءً',
        packages: [
            'حجز رحلات 3 أيام (يوم سكن + يوم ذهاب + يوم عودة)',
            'حجز رحلات 5 أيام (يوم ونص مكة + يوم ونص المدينة + ذهاب وعودة)',
            'عروض خاصة للجمعيات الخيرية، المدارس، الشركات والمجموعات',
            'باصات عادية 49 و47 مقعد موديل 2024/2025 (باص كامل أو مقعد، ذهاب أو ذهاب وعودة)',
            'باصات VIP بـ32 مقعد موديل 2025 (باص كامل أو مقعد، ذهاب أو ذهاب وعودة)'
        ],
        hotels: [
            'فندق الدودامي 4 نجوم — 8 دقائق من الحرم',
            'فندق برج الضيافة 4 نجوم — خدمة توصيل مجانية على مدار الساعة',
            'فندق سما المقام — 8 دقائق من الحرم',
            'فندق موطن لمار 4 نجوم — شارع إبراهيم الخليل',
            'فندق ميلنيوم 5 نجوم — خدمة توصيل مجانية على مدار الساعة'
        ],
        destinations: ['المسجد الحرام', 'غار حراء', 'بئر زمزم', 'المسجد النبوي الشريف']
    };

    var FALLBACKS = [
        'أهلاً بك في قافلة النور! 🌙 نقدم رحلات عمرة وزيارات مكة والمدينة المنورة بباصات حديثة وفنادق مميزة. للاستفسار أو الحجز تواصل معنا على واتساب: 0561126760',
        'يمكنك الحجز يومياً من الرياض إلى مكة والمدينة عبر واتساب: 0561126760. لدينا باقات 3 أيام و5 أيام وباصات عادية و VIP.',
        'أوقات العمل: طوال أيام الأسبوع من 9 صباحاً حتى 9 مساءً. نحن في البطحاء، الرياض. يسعدنا خدمتك على واتساب: 0561126760',
        'لدينا فنادق 4 و5 نجوم قريبة من الحرم مثل الدودامي، سما المقام، وميلنيوم. للحجز والأسعار تواصل معنا على واتساب: 0561126760'
    ];

    // ---------- API key from config.js ----------
    function getApiKey() {
        var cfg = global.QN_CHAT_CONFIG || {};
        var key = String(cfg.cohereApiKey || '').trim();
        if (!key || key === 'PUT_YOUR_COHERE_API_KEY_HERE') { return ''; }
        return key;
    }

    // ---------- Rate limiting (localStorage) ----------
    function rateLimitState() {
        var now = Date.now();
        var hits = [];
        try {
            hits = JSON.parse(localStorage.getItem('qnChatHits') || '[]');
            if (!Array.isArray(hits)) { hits = []; }
            hits = hits.filter(function (t) { return typeof t === 'number' && now - t < RATE_LIMIT.windowMs; });
        } catch (e) { hits = []; }
        return hits;
    }

    function checkRateLimit() {
        var hits = rateLimitState();
        if (hits.length >= RATE_LIMIT.max) { return false; }
        hits.push(Date.now());
        try { localStorage.setItem('qnChatHits', JSON.stringify(hits)); } catch (e) { /* private mode */ }
        return true;
    }

    // ---------- Input sanitizing ----------
    function cleanText(s, maxLen) {
        s = String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
        return s.slice(0, maxLen || 1000);
    }

    function sanitizeHistory(history) {
        var out = [];
        if (!Array.isArray(history)) { return out; }
        history.slice(-20).forEach(function (m) {
            if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()) {
                out.push({ role: m.role, content: cleanText(m.content, 2000) });
            }
        });
        return out;
    }

    // ---------- Arabic system prompt ----------
    function buildSystemPrompt() {
        var kb = JSON.stringify(KB, null, 2);
        return 'أنت "مساعد قافلة النور" — مساعد ذكي يجيب على أسئلة الزوار في موقع "قافلة النور".\n\n' +
            'معلومات الموقع والشركة (مصدر الحقيقة الوحيد):\n' + kb + '\n\n' +
            'قواعد الإجابة:\n' +
            '1. أجب دائماً بالعربية الفصحى المبسطة بأسلوب ودود واحترافي.\n' +
            '2. أجب فقط من المعلومات أعلاه أو من سياق المحادثة.\n' +
            '3. أسئلة الأسعار: اعتذر بلطف بأن الأسعار تتغير حسب الموسم والمواعيد، ووجّه العميل للتواصل على واتساب ' + KB.whatsapp + ' أو الهاتف ' + KB.phone + ' لمعرفة الأسعار الحالية.\n' +
            '4. الحجز يتم عبر واتساب أو الهاتف — شجّع العميل على الحجز من هناك.\n' +
            '5. لأسئلة عن الشركة، فنادقنا، باصاتنا، باقاتنا، أوقات العمل، أو العنوان: استخدم المعلومات أعلاه بدقة.\n' +
            '6. أسئلة عن مواضيع خارج نطاق الشركة والموقع (سياسة، رياضة، أكواد، أسئلة عامة): ارفض بلطف واختصر الإجابة بما يشبه: "أنا مساعد قافلة النور وأجيب فقط عن أسئلة رحلات العمرة والسفر في الموقع. كيف أستطيع مساعدتك في حجز رحلتك؟" ثم اقترح ما يخص خدماتنا.\n' +
            '7. كن مختصراً: 2–4 جمل في الغالب، واستخدم قوائم قصيرة عند السرد.\n' +
            '8. لا تخترع أسعاراً، مواعيد، أو خدمات غير مذكورة أعلاه.\n' +
            '9. عندما يعبّر الزائر عن رغبته في الحجز (مثال: "أريد الحجز"، "أحجز باص"، "ابغى مقعد"، "عندي مجموعة") أجب بجملة قصيرة تشجعه على تعبئة نموذج الحجز، وأدرج في نهاية ردك هذا الرمز حرفياً: [[BOOKING_FORM]] — سيظهر له نموذج حجز يُرسل عبر واتساب. لا تكتب الرمز إلا في سياق الحجز.';
    }

    // ---------- Cohere call ----------
    function callCohere(apiKey, systemPrompt, history, message) {
        var messages = [{ role: 'system', content: systemPrompt }].concat(history);
        messages.push({ role: 'user', content: message });

        return fetch(COHERE_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey
            },
            body: JSON.stringify({
                model: MODEL,
                messages: messages,
                temperature: 0.3,
                max_tokens: 700
            })
        }).then(function (res) {
            return res.json().catch(function () { return {}; }).then(function (data) {
                if (res.ok && data && data.message && Array.isArray(data.message.content) && data.message.content[0] && data.message.content[0].text) {
                    return { ok: true, text: String(data.message.content[0].text) };
                }
                if (res.status === 429) { return { ok: false, kind: 'cohere_rate' }; }
                if (res.status === 401 || res.status === 403) { return { ok: false, kind: 'auth' }; }
                return { ok: false, kind: 'api', status: res.status };
            });
        });
    }

    function demoReply(historyLen) {
        return {
            reply: FALLBACKS[historyLen % FALLBACKS.length],
            demo: true
        };
    }

    function fallbackReply(historyLen) {
        return {
            reply: FALLBACKS[historyLen % FALLBACKS.length] + ' (خدمة المساعد الذكي مشغولة حالياً، لكن فريقنا جاهز لخدمتك مباشرة!)',
            fallback: true
        };
    }

    // ---------- Public API: getReply(message, history) -> Promise ----------
    function getReply(message, history) {
        var msg = cleanText(message, 1000);
        var hist = sanitizeHistory(history);

        if (!msg) {
            return Promise.resolve({ error: 'empty', reply: 'الرجاء كتابة رسالة.' });
        }
        if (!checkRateLimit()) {
            return Promise.resolve({
                error: 'rate_limited',
                reply: 'عدد كبير من الرسائل! يرجى الانتظار قليلاً قبل المحاولة مرة أخرى. يمكنك دائماً التواصل معنا مباشرة على واتساب: 0561126760'
            });
        }

        var apiKey = getApiKey();
        if (!apiKey) {
            // Demo mode: no key configured — helpful canned answers, no Cohere call.
            return new Promise(function (resolve) {
                setTimeout(function () { resolve(demoReply(hist.length)); }, 500);
            });
        }

        return callCohere(apiKey, buildSystemPrompt(), hist, msg).then(function (res) {
            if (res.ok) { return { reply: res.text }; }
            if (res.kind === 'auth') {
                console.error('[QNChat] Cohere rejected the API key (401/403). Check api/config.js or the COHERE_API_KEY secret.');
                return fallbackReply(hist.length);
            }
            if (res.kind === 'cohere_rate') {
                return { reply: 'المساعد يستقبل عدداً كبيراً من الأسئلة الآن ⏳ جرّب بعد قليل، أو تواصل معنا فوراً على واتساب: 0561126760', fallback: true };
            }
            return fallbackReply(hist.length);
        }).catch(function () {
            return fallbackReply(hist.length);
        });
    }

    // Export
    global.QNChat = {
        getReply: getReply,
        KB: KB,
        isConfigured: function () { return getApiKey() !== ''; }
    };
})(window);
