// --- GLOBAL DEĞİŞKENLER ---
let allPlayers = [];     // JSON'dan gelen tüm oyuncu havuzu
let dailyPlayers = [];   // Bugünün seçilen 10 oyuncusu
let targetPlayer = {};   // Şu anki sorudaki oyuncu
let questionIndex = 0;   // Kaçıncı sorudayız (0-9)
let maxQuestions = 10;   // Günlük soru limiti
let username = "";       // Kullanıcı adı

// Oyun Motoru Değişkenleri
let timerInterval;
let seconds = 0;
let currentScore = 100;
let totalScore = 0;
let revealedIndices = [];       // Açılan harflerin indeksleri
let globalLetterIndexMap = [];  // Harflerin konum haritası
let isGameOver = false;         // Tur bitti mi?

// --- 1. BAŞLANGIÇ VE AYARLAR ---
document.addEventListener('DOMContentLoaded', () => {
    // Tarihi ekrana yaz
    const dateStr = new Date().toLocaleDateString('tr-TR');
    if(document.getElementById('date-display')) {
        document.getElementById('date-display').innerText = dateStr;
    }

    // Liderlik tablosunu (önceki kayıtlardan) yükle
    loadLeaderboard();

    // JSON Verisini Çek
    fetch('oyuncular.json')
        .then(response => response.json())
        .then(data => {
            allPlayers = data;
            console.log("Veri yüklendi. Toplam oyuncu:", allPlayers.length);
        })
        .catch(err => console.error("JSON Hatası:", err));

    // Enter tuşu ile tahmin yapabilme
    document.getElementById('guess-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') makeGuess();
    });
});

// İsim girip "BAŞLA" butonuna basınca çalışır
function startDailyChallenge() {
    const input = document.getElementById('username-input');
    const val = input.value.trim();
    
    if (val.length < 3) {
        alert("Lütfen en az 3 karakterli bir isim gir.");
        return;
    }
    
    if (allPlayers.length === 0) {
        alert("Oyuncu verileri henüz yüklenmedi, lütfen sayfayı yenile.");
        return;
    }

    username = val;
    
    // Modalı kapat, oyun alanını netleştir
    document.getElementById('login-modal').classList.add('display-none');
    document.getElementById('game-wrapper').classList.remove('blurred');

    // Bugüne özel soruları hazırla
    prepareDailyQuestions();
    
    // İlk soruyu başlat
    loadQuestion();
}

// --- 2. GÜNLÜK SEED (TOHUM) ALGORİTMASI ---
function prepareDailyQuestions() {
    // Bugünü sayısal bir şifreye dönüştür (Örn: 20260216)
    // Bu sayede herkes aynı gün AYNI soruları görür.
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

    // Listeyi bu şifreye göre karıştır
    const shuffled = seededShuffle([...allPlayers], seed);
    
    // İlk 10 oyuncuyu seç
    dailyPlayers = shuffled.slice(0, maxQuestions);
    
    // Değişkenleri sıfırla
    questionIndex = 0;
    totalScore = 0;
    document.getElementById('total-score').innerText = "0";
}

// Standart 'Shuffle' yerine, Seed tabanlı karıştırıcı
function seededShuffle(array, seed) {
    let m = array.length, t, i;
    
    // Basit bir rastgele sayı üreteci (Sinüs fonksiyonu tabanlı)
    const random = () => {
        var x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    while (m) {
        i = Math.floor(random() * m--);
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }
    return array;
}

// --- 3. SORU YÖNETİMİ ---
function loadQuestion() {
    // Eğer 10 soru bittiyse final ekranına git
    if (questionIndex >= maxQuestions) {
        finishDailyChallenge();
        return;
    }

    // Hedef oyuncuyu belirle
    targetPlayer = dailyPlayers[questionIndex];

    // Arayüzü güncelle
    document.getElementById('q-count').innerText = questionIndex + 1;
    
    // Tur değişkenlerini sıfırla
    clearInterval(timerInterval);
    seconds = 0;
    currentScore = 100;
    revealedIndices = [];
    globalLetterIndexMap = [];
    isGameOver = false;

    // UI Temizliği
    document.getElementById('current-score').innerText = currentScore;
    document.getElementById('message-area').classList.add('hidden');
    document.getElementById('next-btn').classList.add('hidden'); // Sonraki soru butonu gizli
    
    const input = document.getElementById('guess-input');
    input.value = '';
    input.disabled = false;
    input.focus();

    // Konsola kopya (Geliştirici için)
    console.log(`Soru ${questionIndex + 1} Cevap:`, targetPlayer.name);

    // Görsel öğeleri oluştur
    renderHangman();
    renderClues();

    // Süreyi başlat
    timerInterval = setInterval(gameLoop, 1000);
}

function nextQuestion() {
    questionIndex++;
    loadQuestion();
}

function finishDailyChallenge() {
    // Tüm sorular bittiğinde oyun alanını değiştir
    const gameContainer = document.querySelector('.game-container');
    gameContainer.innerHTML = `
        <div style="text-align:center; padding: 40px;">
            <h1 style="color:var(--matte-green); margin-bottom:10px;">GÖREV TAMAMLANDI!</h1>
            <p style="font-size: 1.2rem; color:#888;">Günün Toplam Puanı</p>
            <div style="font-size: 4rem; font-weight:bold; color: white; margin: 20px 0;">${totalScore}</div>
            <p style="margin-bottom:30px;">Yarın yeni 10 futbolcu ile görüşmek üzere!</p>
            <button onclick="location.reload()" class="action-btn">LİDERLİK TABLOSUNU GÜNCELLE</button>
        </div>
    `;
    
    // Skoru kaydet
    saveScoreToLeaderboard(username, totalScore);
}

// --- 4. OYUN MOTORU (GÖRSELLİK VE MANTIK) ---

// İsmi ekrana "Düz Yazı" ve "Alt Alta" olarak basar
function renderHangman() {
    const container = document.getElementById('hangman-area');
    container.innerHTML = '';
    
    // BURASI DEĞİŞTİ: İsmi direkt alıp temizliyoruz (João -> JOAO)
    const cleanFullName = normalizeInput(targetPlayer.name); 
    const nameParts = cleanFullName.split(' '); // Boşluktan böl
    
    let globalCounter = 0;

    nameParts.forEach(part => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'hangman-row';
        
        for (let i = 0; i < part.length; i++) {
            const char = part[i];
            const span = document.createElement('span');
            
            span.className = 'letter-box empty';
            span.id = `char-${globalCounter}`; 
            span.innerText = char; // Artık ekranda da temiz harf (A, O, C) yazacak
            
            // Harita dizisine kaydet
            globalLetterIndexMap.push({ id: globalCounter, char: char });
            
            rowDiv.appendChild(span);
            globalCounter++;
        }
        container.appendChild(rowDiv);
    });
}

// İpuçlarını oluşturur
function renderClues() {
    const container = document.getElementById('clues-area');
    container.innerHTML = '';

    const clues = [
        { t: "Lig", v: targetPlayer.league },
        { t: "Uyruk", v: targetPlayer.nationality },
        { t: "Yaş", v: targetPlayer.age },
        { t: "Takım", v: targetPlayer.team },
        { t: "Gol Sayısı", v: targetPlayer.stats.goals }
    ];

    clues.forEach((clue, index) => {
        const div = document.createElement('div');
        div.className = 'clue-card';
        div.id = `clue-${index}`;
        div.innerHTML = `<strong>${clue.t}:</strong> ${clue.v}`;
        container.appendChild(div);
    });
}

// Her saniye çalışan ana döngü
function gameLoop() {
    if (isGameOver) return;
    
    seconds++;

    // --- AŞAMA 1: METİN İPUÇLARI (Çok daha hızlı) ---
    // Saniye 15'e kadar, her 3 saniyede bir yeni ipucu (3, 6, 9, 12, 15)
    if (seconds <= 15 && seconds % 3 === 0) {
        const clueIndex = (seconds / 3) - 1;
        revealClueCard(clueIndex);
        decreaseScore(5); // Hızlı aktığı için ceza aynı kalabilir veya artırabilirsin
    }

    // --- AŞAMA 2: HARF AÇILMA (15. Saniyeden sonra) ---
    // İpuçları bitti, artık her 2 saniyede bir harf açılıyor
    if (seconds > 15 && seconds % 2 === 0) {
        revealRandomLetter();
        decreaseScore(8); 
    }

    // Puan biterse
    if (currentScore <= 0) {
        endGame(false);
    }
}

function revealClueCard(index) {
    const card = document.getElementById(`clue-${index}`);
    if (card) card.classList.add('active');
}

function revealRandomLetter() {
    // Henüz açılmamış harflerin ID'lerini bul
    let availableGlobalIndices = [];
    for(let i=0; i < globalLetterIndexMap.length; i++) {
        if(!revealedIndices.includes(i)) {
            availableGlobalIndices.push(i);
        }
    }

    // Rastgele bir tane seç
    if (availableGlobalIndices.length > 0) {
        const randomIndex = availableGlobalIndices[Math.floor(Math.random() * availableGlobalIndices.length)];
        revealedIndices.push(randomIndex);
        
        const charBox = document.getElementById(`char-${randomIndex}`);
        if(charBox) {
            charBox.classList.remove('empty');
            // CSS'ten gelen varsayılan renk kullanılır
        }
    }
}

function decreaseScore(amount) {
    currentScore -= amount;
    if (currentScore < 0) currentScore = 0;
    document.getElementById('current-score').innerText = currentScore;
}

// --- 5. TAHMİN KONTROLÜ (FLEXIBLE GUESSING) ---
function makeGuess() {
    if (isGameOver) return;
    const input = document.getElementById('guess-input');
    
    // Kullanıcının girdisini temizle (joão -> JOAO)
    const guess = normalizeInput(input.value);
    
    if (guess.length === 0) return;

    // Hedef ismi temizle (João Félix -> JOAO FELIX)
    const correctFullName = normalizeInput(targetPlayer.name);
    
    let isCorrect = false;

    // 1. TAM EŞLEŞME
    if (guess === correctFullName) {
        isCorrect = true;
    } 
    // 2. PARÇA EŞLEŞME
    else {
        const targetWords = correctFullName.split(" ");
        const guessWords = guess.split(" ");
        
        // Yazılan tüm kelimeler ismin içinde var mı?
        const allWordsFound = guessWords.every(word => targetWords.includes(word));

        if (allWordsFound) {
            isCorrect = true;
        }
    }

    if (isCorrect) {
        endGame(true);
    } else {
        input.style.borderBottomColor = "var(--matte-red)";
        setTimeout(() => input.style.borderBottomColor = "#555", 1000);
        decreaseScore(10);
        input.value = '';
    }
}

function endGame(isWin) {
    isGameOver = true;
    clearInterval(timerInterval);
    const msgArea = document.getElementById('message-area');
    const input = document.getElementById('guess-input');
    const nextBtn = document.getElementById('next-btn');

    if (isWin) {
        // --- BURASI GÜNCELLENDİ ---
        
        // 1. Bu oturumdaki (Daily Challenge) skoru artır
        totalScore += currentScore;
        document.getElementById('total-score').innerText = totalScore;
        
        // 2. ANA MENÜ PUANINA (Global Score) ANINDA EKLE
        // Her doğru cevapta localStorage güncellenir.
        addGlobalScore(currentScore);

        // --------------------------

        msgArea.innerHTML = `DOĞRU! <strong>${targetPlayer.name}</strong> <br> +${currentScore} Puan`;
        msgArea.className = "message success";
        
        // Tüm harfleri aç ve YEŞİL (solved) yap
        document.querySelectorAll('.letter-box').forEach(box => {
            box.classList.remove('empty');
            box.classList.add('solved');
        });
        
    } else {
        msgArea.innerHTML = `SÜRE BİTTİ! Doğru Cevap: <strong>${targetPlayer.name}</strong>`;
        msgArea.className = "message fail";
        
        // Sadece harfleri görünür yap
        document.querySelectorAll('.letter-box').forEach(box => box.classList.remove('empty'));
    }

    msgArea.classList.remove('hidden');
    
    // Sonraki soru butonunu aç
    nextBtn.classList.remove('hidden');
    input.disabled = true;
    
    // Enter'a basınca sıradaki soruya geçmesi için butona odaklan
    nextBtn.focus();
}

// --- 6. LİDERLİK TABLOSU (LOCAL STORAGE) ---
function saveScoreToLeaderboard(user, score) {
    const dateKey = new Date().toLocaleDateString('tr-TR');
    let leaderboard = JSON.parse(localStorage.getItem('daily_leaderboard')) || {};

    if (!leaderboard[dateKey]) leaderboard[dateKey] = [];

    // Yeni skoru ekle
    leaderboard[dateKey].push({ name: user, score: score });

    // Puana göre sırala (Büyükten küçüğe)
    leaderboard[dateKey].sort((a, b) => b.score - a.score);

    // Tekrar kaydet
    localStorage.setItem('daily_leaderboard', JSON.stringify(leaderboard));
    
    loadLeaderboard();
}

function loadLeaderboard() {
    const dateKey = new Date().toLocaleDateString('tr-TR');
    const listEl = document.getElementById('leaderboard-list');
    
    if(!listEl) return; // Sayfada liste yoksa hata verme
    
    listEl.innerHTML = '';

    const allData = JSON.parse(localStorage.getItem('daily_leaderboard')) || {};
    const todaysData = allData[dateKey] || [];

    if (todaysData.length === 0) {
        listEl.innerHTML = '<li style="justify-content:center; color:#555;">Henüz skor yok. İlk sen ol!</li>';
        return;
    }

    // İlk 10 kişiyi göster
    todaysData.slice(0, 10).forEach((item, index) => {
        const li = document.createElement('li');
        
        // İlk 3'e özel renkler
        let colorStyle = "";
        if(index === 0) colorStyle = "color: gold; font-weight:bold;";
        else if(index === 1) colorStyle = "color: silver;";
        else if(index === 2) colorStyle = "color: #cd7f32;";

        li.innerHTML = `<span style="${colorStyle}">${index + 1}. ${item.name}</span> <span style="${colorStyle}">${item.score} P</span>`;
        listEl.appendChild(li);
    });
}

function normalizeInput(text) {
    if (!text) return "";
    return text
        .toString()
        .normalize("NFD") // Harfi ve şapkasını ayırır (ã -> a + ~)
        .replace(/[\u0300-\u036f]/g, "") // Şapkaları/işaretleri siler
        .replace(/ğ/g, "g").replace(/Ğ/g, "g") // Türkçeleri elle düzelt
        .replace(/ü/g, "u").replace(/Ü/g, "u")
        .replace(/ş/g, "s").replace(/Ş/g, "s")
        .replace(/ı/g, "i").replace(/İ/g, "i").replace(/I/g, "i")
        .replace(/ö/g, "o").replace(/Ö/g, "o")
        .replace(/ç/g, "c").replace(/Ç/g, "c")
        .replace(/[^a-zA-Z0-9 ]/g, "") // Harf ve rakam dışındaki her şeyi (virgül, nokta) sil
        .trim()
        .toUpperCase(); // Hepsini BÜYÜK HARF yap (Görsel uyum için)
}

// --- PUAN SİSTEMİ ENTEGRASYONU (GÜNCELLENMİŞ) ---
function addGlobalScore(points) {
    let currentScore = parseInt(localStorage.getItem('futbolHub_totalScore')) || 0;
    currentScore += points;
    localStorage.setItem('futbolHub_totalScore', currentScore);
    
    // Alert yerine sadece konsola yazıyoruz, oyun bölünmesin diye.
    console.log(`${points} puan eklendi. Ana Hub Toplamı: ${currentScore}`);
}