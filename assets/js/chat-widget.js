/* ============================================================
   Qafilet Al-Nour — AI Chat Widget
   Floating assistant that answers visitor questions in Arabic.
   Uses the pure-JS backend in api/chat.js (works on GitHub Pages).
   ============================================================ */
(function () {
    'use strict';

    // ---- Build the widget DOM --------------------------------------------
    var launcher = document.createElement('button');
    launcher.className = 'qn-chat-launcher';
    launcher.setAttribute('aria-label', 'المساعد الذكي — قافلة النور');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML =
        '<span class="qn-chat-launcher-icon">&#128172;</span>' + // 💬
        '<span class="qn-chat-dot"></span>';

    var panel = document.createElement('div');
    panel.className = 'qn-chat-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'محادثة المساعد الذكي');
    panel.innerHTML =
        '<div class="qn-chat-header">' +
        '  <div class="qn-chat-header-avatar">&#127776;</div>' + // 🌙
        '  <div class="qn-chat-header-titles">' +
        '    <p class="qn-chat-header-title">مساعد قافلة النور</p>' +
        '    <p class="qn-chat-header-status"><span class="qn-status-dot"></span> متصل الآن — يجيب بالعربية</p>' +
        '  </div>' +
        '  <button type="button" class="qn-chat-header-close" aria-label="إغلاق المحادثة">&#10005;</button>' +
        '</div>' +
        '<div class="qn-chat-messages" id="qnChatMessages" aria-live="polite"></div>' +
        '<div class="qn-chat-quick" id="qnChatQuick"></div>' +
        '<form class="qn-chat-input-row" id="qnChatForm">' +
        '  <input type="text" id="qnChatInput" placeholder="اكتب سؤالك هنا..." maxlength="1000" autocomplete="off" />' +
        '  <button type="submit" class="qn-chat-send" aria-label="إرسال">&#10148;</button>' + // ➞
        '</form>';

    var messagesEl = panel.querySelector('#qnChatMessages');
    var quickEl = panel.querySelector('#qnChatQuick');
    var form = panel.querySelector('#qnChatForm');
    var input = panel.querySelector('#qnChatInput');
    var sendBtn = panel.querySelector('.qn-chat-send');
    var closeBtn = panel.querySelector('.qn-chat-header-close');

    var history = []; // { role: 'user'|'assistant', content: string }
    var pending = false;
    var welcomeShown = false;

    function appendMsg(text, who) {
        var div = document.createElement('div');
        div.className = 'qn-msg ' + who;
        div.textContent = text;
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return div;
    }

    function showTyping(on) {
        var t = panel.querySelector('.qn-typing');
        if (on) {
            if (!t) {
                t = document.createElement('div');
                t.className = 'qn-typing';
                t.innerHTML = '<span></span><span></span><span></span>';
                messagesEl.appendChild(t);
            }
            t.style.display = 'block';
            messagesEl.scrollTop = messagesEl.scrollHeight;
        } else if (t) {
            t.remove();
        }
    }

    function setPending(on) {
        pending = on;
        sendBtn.disabled = on;
        input.disabled = on;
        if (on) {
            launcher.classList.add('qn-chat-loading');
            showTyping(true);
        } else {
            launcher.classList.remove('qn-chat-loading');
            showTyping(false);
            input.disabled = false;
            input.focus();
        }
    }

    function showWelcome() {
        appendMsg(
            'أهلاً وسهلاً بك في قافلة النور 🌙\nأنا مساعدك الذكي، اسألني عن رحلات العمرة، الباصات، الفنادق، الباقات، أو أوقات العمل — وأجيبك فوراً!',
            'bot'
        );
        renderQuickReplies();
    }

    function renderQuickReplies() {
        var questions = [
            'ما هي باقاتكم؟',
            'كيف أحجز رحلة؟',
            'ما هي الفنادق المتوفرة؟',
            'أوقات العمل والعنوان؟'
        ];
        quickEl.innerHTML = '';
        questions.forEach(function (q) {
            var b = document.createElement('button');
            b.type = 'button';
            b.textContent = q;
            b.addEventListener('click', function () {
                sendMessage(q);
            });
            quickEl.appendChild(b);
        });
    }

    function sendMessage(text) {
        var msg = (text || '').trim();
        if (!msg || pending) { return; }

        appendMsg(msg, 'user');
        history.push({ role: 'user', content: msg });
        if (history.length > 20) { history = history.slice(-20); }

        setPending(true);

        var send = window.QNChat && window.QNChat.getReply
            ? window.QNChat.getReply(msg, history.slice(0, -1))
            : Promise.resolve({ fallback: true, reply: 'خدمة المساعد غير متوفرة حالياً. تواصل معنا مباشرة على واتساب: 0561126760' });

        send
            .then(function (data) {
                if (data && data.reply) {
                    appendMsg(data.reply, 'bot');
                    history.push({ role: 'assistant', content: data.reply });
                    if (history.length > 20) { history = history.slice(-20); }
                } else {
                    appendMsg('حدث خطأ غير متوقع. جرّب مرة أخرى أو تواصل معنا على واتساب: 0561126760', 'error');
                }
            })
            .catch(function () {
                appendMsg('تعذر الاتصال. تحقق من اتصالك بالإنترنت أو تواصل معنا مباشرة على واتساب: 0561126760', 'error');
            })
            .then(function () {
                setPending(false);
                if (!panel.classList.contains('open')) {
                    launcher.classList.add('has-unread');
                }
            });
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var val = input.value;
        input.value = '';
        sendMessage(val);
    });

    function openPanel() {
        panel.classList.add('open');
        launcher.classList.remove('has-unread');
        launcher.setAttribute('aria-expanded', 'true');
        if (!welcomeShown) {
            welcomeShown = true;
            showWelcome();
        }
        setTimeout(function () { input.focus(); }, 150);
    }

    function closePanel() {
        panel.classList.remove('open');
        launcher.setAttribute('aria-expanded', 'false');
    }

    launcher.addEventListener('click', function () {
        panel.classList.contains('open') ? closePanel() : openPanel();
    });
    closeBtn.addEventListener('click', closePanel);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && panel.classList.contains('open')) {
            closePanel();
        }
    });

    // ---- Mount ------------------------------------------------------------
    function mount() {
        document.body.appendChild(panel);
        document.body.appendChild(launcher);
    }
    if (document.body) {
        mount();
    } else {
        document.addEventListener('DOMContentLoaded', mount);
    }
})();
