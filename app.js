// 1. عناصر الواجهة (DOM Elements)
const amountInput = document.getElementById('amount');
const fromSelect = document.getElementById('from-currency');
const toSelect = document.getElementById('to-currency');
const swapBtn = document.getElementById('swap-btn');
const rateInfo = document.getElementById('exchange-rate-info');
const resultDisplay = document.getElementById('conversion-result');
const resultBox = document.getElementById('result-box');
const lastUpdatedDisplay = document.getElementById('last-updated');
const newsContainer = document.getElementById('news-container');
const selectedCurrencyName = document.getElementById('selected-currency-name');
const marketTicker = document.getElementById('market-ticker');

// 2. ثوابت التخزين المؤقت والتحديث التلقائي
const RATES_CACHE_KEY = 'currency_radar_rates_v3';
const NEWS_CACHE_KEY = 'currency_radar_news_v2';
const PREV_RATES_KEY = 'currency_radar_prev_rates_v1';
const ONE_HOUR_MS = 60 * 60 * 1000;

// 3. أسماء العملات بالعربية لسهولة الاختيار
const currencyNamesAr = {
    USD: "الدولار الأمريكي (USD)",
    JOD: "الدينار الأردني (JOD)",
    EUR: "اليورو الأوروبي (EUR)",
    SAR: "الريال السعودي (SAR)",
    AED: "الدرهم الإماراتي (AED)",
    TRY: "الليرة التركية (TRY)",
    GBP: "الجنيه الإسترليني (GBP)",
    EGP: "الجنيه المصري (EGP)",
    KWD: "الدينار الكويتي (KWD)",
    QAR: "الريال القطري (QAR)",
    SYP: "الليرة السورية (SYP)",
    IQD: "الدينار العراقي (IQD)",
    LBP: "الليرة اللبنانية (LBP)",
    JPY: "الين الياباني (JPY)",
    CNY: "اليوان الصيني (CNY)",
    RUB: "الروبل الروسي (RUB)",
    CHF: "الفرنك السويسري (CHF)",
    CAD: "الدولار الكندي (CAD)",
    AUD: "الدولار الأسترالي (AUD)",
    XAU: "الذهب / أونصة (XAU)"
};

// 4. المؤشرات التي نعرض اتجاه أسهمها (صعود / هبوط / ثبات)
const trackedIndicators = [
    { code: 'JOD', label: 'USD / JOD', decimals: 4 },
    { code: 'EUR', label: 'EUR / USD', decimals: 4, invertFromUSD: true },
    { code: 'GBP', label: 'GBP / USD', decimals: 4, invertFromUSD: true },
    { code: 'SAR', label: 'USD / SAR', decimals: 4 },
    { code: 'AED', label: 'USD / AED', decimals: 4 },
    { code: 'TRY', label: 'USD / TRY', decimals: 2 },
    { code: 'EGP', label: 'USD / EGP', decimals: 2 },
    { code: 'XAU', label: 'الذهب (XAU)', decimals: 2, invertFromUSD: true }
];

// 5. الكلمات المفتاحية لفلترة الأخبار المؤثرة (حقائق فقط بدون توقعات)
const newsKeywordsByCurrency = {
    USD: ['الدولار', 'الفيدرالي', 'الفائدة', 'التضخم', 'أمريكا', 'الأمريكي', 'عقوبات', 'رسوم', 'حرب', 'النفط', 'الذهب', 'أزمة', 'الديون'],
    JOD: ['الأردن', 'الدينار', 'المركزي الأردني', 'الاحتياطيات', 'الدولار', 'الفائدة', 'التضخم', 'المنطقة', 'النفط'],
    EUR: ['اليورو', 'أوروبا', 'المركزي الأوروبي', 'ألمانيا', 'الغاز', 'الطاقة', 'التضخم', 'الفائدة', 'حرب'],
    TRY: ['الليرة', 'تركيا', 'المركزي التركي', 'التضخم', 'الفائدة', 'أردوغان', 'النفط'],
    DEFAULT: ['اقتصاد', 'حرب', 'أزمة', 'النفط', 'الذهب', 'التضخم', 'الفائدة', 'عقوبات', 'البنك المركزي']
};

// كلمات محظورة لاستبعاد مقالات التوقعات والتحليلات غير المؤكدة
const bannedPredictionWords = ['توقعات', 'يتوقع', 'قد يرتفع', 'قد ينخفض', 'ربما', 'تنبؤات', 'سيناريوهات', 'رأي'];

let exchangeRates = {};
let liveNewsArticles = [];
let isInitialLoad = true;

// 6. دوال التخزين المؤقت للأسعار والأخبار والمؤشرات السابقة
function saveRatesToCache(rates, timestampUnix) {
    try {
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({
            rates,
            timestampUnix,
            savedAt: Date.now()
        }));
    } catch (e) {
        console.warn("تعذر حفظ أسعار الصرف في التخزين المحلي");
    }
}

function loadRatesFromCache() {
    try {
        const raw = localStorage.getItem(RATES_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function saveNewsToCache(articles) {
    try {
        localStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({
            articles,
            savedAt: Date.now()
        }));
    } catch (e) {
        console.warn("تعذر حفظ الأخبار في التخزين المحلي");
    }
}

function loadNewsFromCache() {
    try {
        const raw = localStorage.getItem(NEWS_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function getPreviousRates() {
    try {
        const raw = localStorage.getItem(PREV_RATES_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function savePreviousRates(rates) {
    try {
        localStorage.setItem(PREV_RATES_KEY, JSON.stringify(rates));
    } catch (e) {
        console.warn("تعذر حفظ لقطة الأسعار السابقة");
    }
}

// 7. توليد شريط الأسهم والاتجاهات تلقائياً
function renderMarketTicker(currentRates) {
    if (!marketTicker || !currentRates) return;

    const prevRates = getPreviousRates();
    const computedSnapshot = {};
    marketTicker.innerHTML = '';

    trackedIndicators.forEach(item => {
        const rawRate = currentRates[item.code];
        if (typeof rawRate !== 'number' || rawRate <= 0) return;

        const value = item.invertFromUSD ? (1 / rawRate) : rawRate;
        computedSnapshot[item.code] = value;

        const prevValue = prevRates[item.code];
        let directionClass = 'ticker-flat';
        let arrowSymbol = '•';

        if (typeof prevValue === 'number') {
            if (value > prevValue) {
                directionClass = 'ticker-up';
                arrowSymbol = '▲';
            } else if (value < prevValue) {
                directionClass = 'ticker-down';
                arrowSymbol = '▼';
            }
        }

        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = `ticker-item ${directionClass}`;
        pill.title = `انقر لاختيار ${item.code}`;
        pill.innerHTML = `
            <span>${item.label}</span>
            <span class="ticker-val">${value.toFixed(item.decimals)}</span>
            <span class="ticker-arrow" aria-hidden="true">${arrowSymbol}</span>
        `;

        pill.addEventListener('click', () => {
            if (fromSelect && toSelect && currentRates[item.code]) {
                if (item.invertFromUSD) {
                    fromSelect.value = item.code;
                    toSelect.value = 'USD';
                } else {
                    fromSelect.value = 'USD';
                    toSelect.value = item.code;
                }
                calculateConversion();
            }
        });

        marketTicker.appendChild(pill);
    });

    savePreviousRates(computedSnapshot);
}

// 8. جلب أسعار الصرف المباشرة مع دعم النسخة الاحتياطية
async function fetchRates() {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!response.ok) {
            throw new Error("استجابة غير ناجحة من خادم الأسعار");
        }
        const data = await response.json();

        if (data.result === "success" && data.rates) {
            exchangeRates = data.rates;
            saveRatesToCache(data.rates, data.time_last_update_unix);
            renderMarketTicker(exchangeRates);

            if (fromSelect.options.length === 0) {
                populateCurrencyDropdowns();
            }
            calculateConversion();

            const now = new Date();
            lastUpdatedDisplay.textContent = `محدث تلقائياً (${now.toLocaleTimeString('ar-JO')}) • يتجدد كل ساعة`;
            isInitialLoad = false;
        } else {
            throw new Error("بيانات أسعار الصرف غير مكتملة");
        }
    } catch (error) {
        console.warn("فشل جلب الأسعار مباشرة، جاري فحص النسخة الاحتياطية...", error);
        const cached = loadRatesFromCache();
        if (cached && cached.rates) {
            exchangeRates = cached.rates;
            renderMarketTicker(exchangeRates);
            if (fromSelect.options.length === 0) {
                populateCurrencyDropdowns();
            }
            calculateConversion();
            const cachedDate = new Date(cached.savedAt);
            lastUpdatedDisplay.textContent = `نسخة احتياطية محفوظة (${cachedDate.toLocaleTimeString('ar-JO')}) • يعاد المحاولة كل ساعة`;
            isInitialLoad = false;
        } else {
            rateInfo.textContent = "تعذر جلب الأسعار؛ يرجى التحقق من اتصال الإنترنت.";
            resultDisplay.textContent = "---";
        }
    }
}

// 9. جلب الأخبار الاقتصادية الحية وفلترتها مع دعم النسخة الاحتياطية
async function fetchLiveEconomicNews() {
    const cachedNews = loadNewsFromCache();

    if (liveNewsArticles.length === 0 && cachedNews && Array.isArray(cachedNews.articles) && cachedNews.articles.length > 0) {
        liveNewsArticles = cachedNews.articles;
        updateNewsSection(fromSelect.value || 'USD');
    } else if (liveNewsArticles.length === 0) {
        newsContainer.innerHTML = `<div class="news-item"><p>جاري رصد وفلترة الأخبار الجيوسياسية والاقتصادية المباشرة...</p></div>`;
    }

    const rssFeedUrl = encodeURIComponent('https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/73d0e1b4-532f-45ef-b135-bfdff8b8cab9');
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${rssFeedUrl}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error("استجابة غير ناجحة من خادم الأخبار");
        }
        const data = await response.json();

        if (data.status === 'ok' && Array.isArray(data.items)) {
            liveNewsArticles = data.items.map(item => {
                const rawDescription = item.description || '';
                const cleanSummary = rawDescription.replace(/<[^>]*>?/gm, '').trim();
                const pubDate = new Date(item.pubDate);

                return {
                    title: (item.title || 'خبر اقتصادي').trim(),
                    summary: cleanSummary.length > 145 ? cleanSummary.substring(0, 145) + '...' : cleanSummary,
                    link: item.link || '',
                    source: "الجزيرة اقتصاد",
                    time: isNaN(pubDate)
                        ? "مباشر"
                        : pubDate.toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' })
                };
            });

            saveNewsToCache(liveNewsArticles);
            updateNewsSection(fromSelect.value || 'USD');
        } else {
            throw new Error("قائمة الأخبار فارغة أو غير صالحة");
        }
    } catch (error) {
        console.warn("تعذر تحديث الأخبار مباشرة، جاري فحص النسخة الاحتياطية...", error);
        if (cachedNews && Array.isArray(cachedNews.articles) && cachedNews.articles.length > 0) {
            liveNewsArticles = cachedNews.articles;
            updateNewsSection(fromSelect.value || 'USD');
        } else if (liveNewsArticles.length === 0) {
            newsContainer.innerHTML = `
                <article class="news-item">
                    <div class="news-meta"><span class="news-tag"># تنبيه النظام</span><span>مباشر</span></div>
                    <h3>تعذر الاتصال بخادم الأخبار اللحظية</h3>
                    <p>سيحاول الرادار إعادة الاتصال تلقائياً كل ساعة دون التأثير على دقة أسعار الصرف.</p>
                </article>
            `;
        }
    }
}

// 10. فلترة وعرض الأخبار المؤثرة حسب العملة المختارة (بدون توقعات)
function updateNewsSection(currencyCode) {
    selectedCurrencyName.textContent = currencyCode;
    const keywords = newsKeywordsByCurrency[currencyCode] || newsKeywordsByCurrency.DEFAULT;

    let filtered = liveNewsArticles.filter(article => {
        const fullText = `${article.title} ${article.summary}`;
        const hasKeyword = keywords.some(kw => fullText.includes(kw));
        const hasPrediction = bannedPredictionWords.some(bw => fullText.includes(bw));
        return hasKeyword && !hasPrediction;
    });

    if (filtered.length === 0) {
        filtered = liveNewsArticles.filter(article => {
            const fullText = `${article.title} ${article.summary}`;
            return !bannedPredictionWords.some(bw => fullText.includes(bw));
        }).slice(0, 4);
    } else {
        filtered = filtered.slice(0, 5);
    }

    newsContainer.innerHTML = '';

    if (filtered.length === 0) {
        newsContainer.innerHTML = `<div class="news-item"><p>لا توجد أحداث طارئة مرصودة حالياً تؤثر بشكل مباشر على ${currencyCode}.</p></div>`;
        return;
    }

    filtered.forEach(item => {
        const article = document.createElement('article');
        article.className = 'news-item';

        const safeLink = item.link && /^https?:\/\//i.test(item.link) ? item.link : '';
        if (safeLink) {
            article.style.cursor = 'pointer';
            article.onclick = () => window.open(safeLink, '_blank', 'noopener,noreferrer');
        }

        article.innerHTML = `
            <div class="news-meta">
                <span class="news-tag"># حدث مؤثر</span>
                <span>${item.source} • ${item.time}</span>
            </div>
            <h3></h3>
            <p></p>
        `;

        article.querySelector('h3').textContent = item.title;
        article.querySelector('p').textContent = item.summary;

        newsContainer.appendChild(article);
    });
}

// 11. تعبئة القوائم المنسدلة بالعملات مع تقديم العملات الأكثر طلباً
function populateCurrencyDropdowns() {
    const allCurrencies = Object.keys(exchangeRates);
    const priorityCurrencies = ['USD', 'JOD', 'EUR', 'SAR', 'AED', 'TRY', 'GBP', 'EGP', 'KWD', 'QAR'];

    const orderedCurrencies = [
        ...priorityCurrencies.filter(code => exchangeRates[code]),
        ...allCurrencies.filter(code => !priorityCurrencies.includes(code))
    ];

    fromSelect.innerHTML = '';
    toSelect.innerHTML = '';

    orderedCurrencies.forEach(code => {
        const label = currencyNamesAr[code] ? currencyNamesAr[code] : code;
        fromSelect.add(new Option(label, code));
        toSelect.add(new Option(label, code));
    });

    fromSelect.value = 'USD';
    toSelect.value = 'JOD';
}

// 12. تشغيل ومضة التحديث عند تغير النتيجة
function triggerResultFlash() {
    if (isInitialLoad || !resultBox) return;
    resultBox.classList.remove('result-flash');
    void resultBox.offsetWidth;
    resultBox.classList.add('result-flash');
}

// 13. حساب التحويل وتحديث واجهة النتيجة والأخبار
function calculateConversion() {
    const amount = parseFloat(amountInput.value);
    const from = fromSelect.value;
    const to = toSelect.value;

    if (isNaN(amount) || amount < 0 || !exchangeRates[from] || !exchangeRates[to]) {
        resultDisplay.textContent = "---";
        return;
    }

    const amountInUSD = amount / exchangeRates[from];
    const convertedAmount = amountInUSD * exchangeRates[to];
    const singleUnitRate = (1 / exchangeRates[from]) * exchangeRates[to];

    rateInfo.textContent = `1 ${from} = ${singleUnitRate.toFixed(4)} ${to}`;
    resultDisplay.textContent = `${convertedAmount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })} ${to}`;

    triggerResultFlash();
    updateNewsSection(from);
}

// 14. ربط الأحداث بالتفاعل الفوري
amountInput.addEventListener('input', calculateConversion);
fromSelect.addEventListener('change', calculateConversion);
toSelect.addEventListener('change', calculateConversion);

swapBtn.addEventListener('click', () => {
    const tempCode = fromSelect.value;
    fromSelect.value = toSelect.value;
    toSelect.value = tempCode;
    calculateConversion();
});

// 15. التشغيل الفوري + ضبط المؤقت التلقائي كل ساعة
fetchRates();
fetchLiveEconomicNews();

setInterval(() => {
    fetchRates();
    fetchLiveEconomicNews();
}, ONE_HOUR_MS);