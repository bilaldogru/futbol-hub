// --- GLOBAL DEĞİŞKENLER ---
let allPlayers = [];
let dailyPlayers = [];
let targetPlayer = {};
let questionIndex = 0;
let maxQuestions = 10;
let username = "Misafir"; 
let timerInterval;
let seconds = 0;
let currentScore = 100;
let totalScore = 0;
let revealedIndices = [];
let globalLetterIndexMap = [];
let isGameOver = false;

// --- 1. BAŞLANGIÇ VE OTO-GİRİŞ ---
document.addEventListener('DOMContentLoaded', () => {
    // Tarih Gösterimi
    const dateStr = new Date().toLocaleDateString('tr-TR');
    if(document.getElementById('date-display')) {
        document.getElementById('date-display').innerText = dateStr;
    }

    // Kullanıcı Kontrolü (OTOMATİK GİRİŞ)
    checkUserAndStart();

    // Verileri Yükle
    loadLeaderboard();
    fetch('../../oyuncular.json') 
        .then(response => response.json())
        .then(data => {
            allPlayers = data;
            console.log("Oyuncu verileri yüklendi.");
        })
        .catch(err => console.error("JSON Hatası:", err));

    // Enter tuşu ile tahmin yapma
    document.getElementById('guess-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') makeGuess();
    });
});

// KULLANICIYI TANI VE OYUNU BAŞLAT
function checkUserAndStart() {
    const userStr = localStorage.getItem('firebaseUser');
    
    // Eğer giriş yapılmamışsa ana sayfaya at (veya misafir oynat)
    if (!userStr) {
        alert("Bu oyunu oynamak ve puan kazanmak için Ana Sayfadan GİRİŞ yapmalısın!");
        window.location.href = "../../index.html"; // Ana menüye postala
        return;
    }

    // Giriş yapılmışsa bilgileri al
    const user = JSON.parse(userStr);
    username = user.name; // Google ismini al
    
    // Modalı gizle ve oyunu başlat
    const loginModal = document.getElementById('login-modal');
    if(loginModal) loginModal.style.display = 'none'; // Kutuyu yok et
    
    document.getElementById('game-wrapper').classList.remove('blurred');
    
    // Verilerin yüklenmesini azıcık bekle sonra başlat
    setTimeout(() => {
        if(allPlayers.length > 0) {
            prepareDailyQuestions();
            loadQuestion();
        } else {
            // Eğer JSON geç yüklenirse 1 sn sonra tekrar dene
            setTimeout(() => {
                prepareDailyQuestions();
                loadQuestion();
            }, 1000);
        }
    }, 500);
}

// KARAKTER TEMİZLEYİCİ
function normalizeInput(text) {
    if (!text) return "";
    return text.toString()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/ğ/g, "g").replace(/Ğ/g, "g")
        .replace(/ü/g, "u").replace(/Ü/g, "u")
        .replace(/ş/g, "s").replace(/Ş/g, "s")
        .replace(/ı/g, "i").replace(/İ/g, "i").replace(/I/g, "i")
        .replace(/ö/g, "o").replace(/Ö/g, "o")
        .replace(/ç/g, "c").replace(/Ç/g, "c")
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .trim().toUpperCase();
}

function prepareDailyQuestions() {
    const today = new Date();
    // Her gün aynı sorular gelsin diye tarih bazlı "seed" (tohum) oluşturuyoruz
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    
    // Listeyi karıştır ama her gün aynı şekilde karıştır
    const shuffled = seededShuffle([...allPlayers], seed);
    
    dailyPlayers = shuffled.slice(0, maxQuestions);
    questionIndex = 0;
    totalScore = 0;
    document.getElementById('total-score').innerText = "0";
}

// Rastgelelik Algoritması (Seed tabanlı)
function seededShuffle(array, seed) {
    let m = array.length, t, i;
    const random = () => { var x = Math.sin(seed++) * 10000; return x - Math.floor(x); };
    while (m) {
        i = Math.floor(random() * m--);
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }
    return array;
}

function loadQuestion() {
    if (questionIndex >= maxQuestions) { finishDailyChallenge(); return; }
    
    targetPlayer = dailyPlayers[questionIndex];
    document.getElementById('q-count').innerText = questionIndex + 1;
    
    clearInterval(timerInterval);
    seconds = 0;
    currentScore = 100;
    revealedIndices = [];
    globalLetterIndexMap = [];
    isGameOver = false;

    document.getElementById('current-score').innerText = currentScore;
    document.getElementById('message-area').classList.add('hidden');
    document.getElementById('next-btn').classList.add('hidden');
    
    const input = document.getElementById('guess-input');
    input.value = ''; 
    input.disabled = false; 
    input.focus();
    input.style.borderBottomColor = "#555"; // Rengi sıfırla

    renderHangman();
    renderClues();
    timerInterval = setInterval(gameLoop, 1000);
}

function nextQuestion() {
    questionIndex++;
    loadQuestion();
}

function finishDailyChallenge() {
    const gameContainer = document.querySelector('.game-container');
    
    // Oyun bitti ekranı
    gameContainer.innerHTML = `
        <div style="text-align:center; padding: 40px;">
            <h1 style="color:var(--matte-green); font-size: 3rem;">GÖREV TAMAMLANDI!</h1>
            <p style="color:#aaa; margin-top:10px;">Günün Toplam Puanı</p>
            <div style="font-size: 5rem; font-weight:bold; color: white; text-shadow: 0 0 20px rgba(255,255,255,0.2); margin: 20px 0;">
                ${totalScore}
            </div>
            <p style="color:#fff;">Tebrikler ${username}!</p>
            <br>
            <button onclick="location.href='../../index.html'" class="action-btn" style="background:#444;">ANA MENÜYE DÖN</button>
        </div>`;
    
    // PUANI KAYDET (Global Firebase Fonksiyonu)
    if(window.saveScoreToFirebase) {
        window.saveScoreToFirebase(totalScore, "Bilmece");
    } else {
        saveScoreToLocal(username, totalScore);
    }
}

// ⚠️ DEĞİŞİKLİK 1: .name -> .isim YAPILDI
function renderHangman() {
    const container = document.getElementById('hangman-area');
    container.innerHTML = '';
    const cleanFullName = normalizeInput(targetPlayer.isim); // BURASI DEĞİŞTİ
    const nameParts = cleanFullName.split(' ');
    let globalCounter = 0;

    nameParts.forEach(part => {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'hangman-row';
        for (let i = 0; i < part.length; i++) {
            const char = part[i];
            const span = document.createElement('span');
            span.className = 'letter-box empty';
            span.id = `char-${globalCounter}`;
            span.innerText = char;
            globalLetterIndexMap.push({ id: globalCounter, char: char });
            rowDiv.appendChild(span);
            globalCounter++;
        }
        container.appendChild(rowDiv);
    });
}

// ⚠️ DEĞİŞİKLİK 2: TÜRKÇE ANAHTARLAR EKLENDİ
function renderClues() {
    const container = document.getElementById('clues-area');
    container.innerHTML = '';
    
    // JSON dosyasındaki Türkçe anahtarları kullanıyoruz artık:
    const clues = [
        { t: "Lig", v: targetPlayer.lig },        // league -> lig
        { t: "Uyruk", v: targetPlayer.uyruk },    // nationality -> uyruk
        { t: "Yaş", v: targetPlayer.yas },        // age -> yas
        { t: "Takım", v: targetPlayer.takim },    // team -> takim
        { t: "Pozisyon", v: targetPlayer.pozisyon } // position -> pozisyon
    ];
    
    clues.forEach((clue, index) => {
        const div = document.createElement('div');
        div.className = 'clue-card';
        div.id = `clue-${index}`;
        div.innerHTML = `<strong>${clue.t}:</strong> ${clue.v}`;
        container.appendChild(div);
    });
}

function gameLoop() {
    if (isGameOver) return;
    seconds++;
    
    // İpuçları (3 saniyede bir açılır)
    if (seconds <= 15 && seconds % 3 === 0) {
        revealClueCard((seconds / 3) - 1);
        decreaseScore(5);
    }
    
    // Harfler (15. saniyeden sonra açılmaya başlar)
    if (seconds > 15 && seconds % 2 === 0) {
        revealRandomLetter();
        decreaseScore(8);
    }
    
    if (currentScore <= 0) endGame(false);
}

function revealClueCard(index) {
    const card = document.getElementById(`clue-${index}`);
    if (card) card.classList.add('active');
}

function revealRandomLetter() {
    let availableGlobalIndices = [];
    for(let i=0; i < globalLetterIndexMap.length; i++) {
        if(!revealedIndices.includes(i)) availableGlobalIndices.push(i);
    }
    if (availableGlobalIndices.length > 0) {
        const randomIndex = availableGlobalIndices[Math.floor(Math.random() * availableGlobalIndices.length)];
        revealedIndices.push(randomIndex);
        const charBox = document.getElementById(`char-${randomIndex}`);
        if(charBox) {
            charBox.classList.remove('empty');
            // Otomatik açılan harfleri biraz soluk yapalım
            charBox.style.color = "#aaa"; 
        }
    }
}

function decreaseScore(amount) {
    currentScore -= amount;
    if (currentScore < 0) currentScore = 0;
    document.getElementById('current-score').innerText = currentScore;
}

// ⚠️ DEĞİŞİKLİK 3: .name -> .isim YAPILDI
function makeGuess() {
    if (isGameOver) return;
    const input = document.getElementById('guess-input');
    const rawGuess = input.value;
    const cleanGuess = normalizeInput(rawGuess);
    
    if (cleanGuess.length === 0) return;

    // TAM AD KONTROLÜ
    const correctFullName = normalizeInput(targetPlayer.isim); // BURASI DEĞİŞTİ

    if (cleanGuess === correctFullName) {
        endGame(true);
    } else {
        // Yanlış cevap efekti
        input.style.borderBottomColor = "var(--matte-red)";
        input.animate([
            { transform: 'translateX(0px)' },
            { transform: 'translateX(5px)' },
            { transform: 'translateX(-5px)' },
            { transform: 'translateX(0px)' }
        ], { duration: 200 });

        setTimeout(() => input.style.borderBottomColor = "#555", 1000);
        decreaseScore(10);
        input.value = '';
    }
}

// ⚠️ DEĞİŞİKLİK 4: .name -> .isim YAPILDI
function endGame(isWin) {
    isGameOver = true;
    clearInterval(timerInterval);
    const msgArea = document.getElementById('message-area');
    const nextBtn = document.getElementById('next-btn');
    const input = document.getElementById('guess-input');

    if (isWin) {
        msgArea.innerHTML = `DOĞRU! <strong>${targetPlayer.isim}</strong> +${currentScore} P`; // BURASI DEĞİŞTİ
        msgArea.className = "message success";
        totalScore += currentScore;
        document.getElementById('total-score').innerText = totalScore;
        
        // Tüm kutuları yeşil yap
        document.querySelectorAll('.letter-box').forEach(box => {
            box.classList.remove('empty'); box.classList.add('solved');
            box.innerText = box.innerText; // İçeriği tazele
            box.style.color = "white";
        });
    } else {
        msgArea.innerHTML = `SÜRE BİTTİ! Cevap: ${targetPlayer.isim}`; // BURASI DEĞİŞTİ
        msgArea.className = "message fail";
        document.querySelectorAll('.letter-box').forEach(box => box.classList.remove('empty'));
    }
    
    msgArea.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
    input.disabled = true;
    nextBtn.focus();
}

// YEDEK: LocalStorage (Firebase çalışmazsa diye)
function saveScoreToLocal(user, score) {
    const dateKey = new Date().toLocaleDateString('tr-TR');
    let leaderboard = JSON.parse(localStorage.getItem('daily_leaderboard')) || {};
    if (!leaderboard[dateKey]) leaderboard[dateKey] = [];
    leaderboard[dateKey].push({ name: user, score: score });
    leaderboard[dateKey].sort((a, b) => b.score - a.score);
    localStorage.setItem('daily_leaderboard', JSON.stringify(leaderboard));
    loadLeaderboard();
}

function loadLeaderboard() {
    const dateKey = new Date().toLocaleDateString('tr-TR');
    const listEl = document.getElementById('leaderboard-list');
    if(!listEl) return;
    listEl.innerHTML = '';
    const allData = JSON.parse(localStorage.getItem('daily_leaderboard')) || {};
    const todaysData = allData[dateKey] || [];
    if (todaysData.length === 0) {
        listEl.innerHTML = '<li style="justify-content:center; color:#555;">Henüz yerel skor yok.</li>';
        return;
    }
    todaysData.slice(0, 10).forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${index + 1}. ${item.name}</span> <span>${item.score} P</span>`;
        listEl.appendChild(li);
    });
}