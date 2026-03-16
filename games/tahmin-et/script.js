// --- GLOBAL DEĞİŞKENLER ---
let allPlayers = [];
let dailyPlayers = [];
let targetPlayer = {};
let questionIndex = 0;
let maxQuestions = 10;
let username = "Misafir"; 
let timerInterval;
let seconds = 0;
let baseScore = 100; // Zorluğa göre (Kolay 100, Orta 150, Zor 250)
let currentScore = 100;
let totalScore = 0;
let revealedIndices = [];
let globalLetterIndexMap = [];
let isGameOver = false;
let currentDifficulty = "";

// --- 1. BAŞLANGIÇ VE KONTROLLER ---
document.addEventListener('DOMContentLoaded', () => {
    const dateStr = new Date().toLocaleDateString('tr-TR');
    if(document.getElementById('date-display')) {
        document.getElementById('date-display').innerText = dateStr;
    }

    const userStr = localStorage.getItem('firebaseUser');
    if (!userStr) {
        alert("Bu oyunu oynamak ve puan kazanmak için Ana Sayfadan GİRİŞ yapmalısın!");
        window.location.href = "../../index.html"; 
        return;
    }
    username = JSON.parse(userStr).name; 

        fetch('../../oyuncular.json') 
        .then(response => response.json())
        .then(data => {
            allPlayers = data;
            console.log("Oyuncu verileri yüklendi.");
            checkPlayedDifficulties(); 
            // --- YENİ: OTOMATİK BAŞLATMA KONTROLÜ ---
            const autoStart = localStorage.getItem('autoStartArena');
            if (autoStart) {
                // Hafızadan sil ki sürekli aynı yeri açmasın
                localStorage.removeItem('autoStartArena');
                // Oyuncu verileri yüklendikten hemen sonra oyunu başlat
                startGame(autoStart); 
            }
            // ----------------------------------------
        })
        .catch(err => console.error("JSON Hatası:", err));

    document.getElementById('guess-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') makeGuess();
    });
});

// --- YENİLENMİŞ KİLİT KONTROL SİSTEMİ ---
function checkPlayedDifficulties() {
    // (Eğer hala test etmek istersen bu satırın başındaki // işaretlerini silersin)
    // localStorage.removeItem('playedBilmece'); 

    const today = new Date().toLocaleDateString('tr-TR');
    const played = JSON.parse(localStorage.getItem('playedBilmece')) || {};
    
    if(played[today]) {
        // Hangi modlar oynandıysa onları görsel olarak kilitle
        if(played[today].includes('kolay')) lockButton('btn-kolay', 'KOLAY');
        if(played[today].includes('orta')) lockButton('btn-orta', 'ORTA');
        if(played[today].includes('zor')) lockButton('btn-zor', 'ZOR');
    }
}

// GÖRSEL KİLİTLEME FONKSİYONU
function lockButton(btnId, levelName) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    btn.disabled = true; // Tıklamayı kapat
    
    // Footle'daki gibi soluk, siyah, tıklanamaz tasarım
    btn.className = "w-full bg-black border border-gray-700 text-gray-500 font-black py-4 rounded-xl opacity-60 cursor-not-allowed flex flex-col items-center justify-center transition-all";
    
    // İçeriği Kırmızı Kilit ve Çizili Yazı ile değiştir
    btn.innerHTML = `
        <div class="flex items-center gap-2 mb-1">
            <i class="fa-solid fa-lock text-red-500"></i>
            <span class="text-xl line-through">${levelName}</span>
        </div>
        <span class="text-[10px] text-red-400 font-bold tracking-widest">BUGÜN OYNANDI</span>
    `;
}

// OYUNU BAŞLATMA FONKSİYONU (Güvenlik Korumalı)
window.startGame = function(difficulty) {
    // Güvenlik: Eğer bugün oynanmışsa girilmesini kesinlikle engelle
    const today = new Date().toLocaleDateString('tr-TR');
    const played = JSON.parse(localStorage.getItem('playedBilmece')) || {};
    if (played[today] && played[today].includes(difficulty)) {
        alert("Bu zorluk seviyesini bugün zaten oynadın. Yarın tekrar gel!");
        return;
    }

    currentDifficulty = difficulty;
    document.getElementById('difficulty-modal').classList.add('hidden'); // Tailwind gizleme sınıfı
    
    let pool = [];
    if(difficulty === 'kolay') {
        baseScore = 100;
        pool = allPlayers.filter(p => p.zorluk && p.zorluk.toLowerCase() === "kolay");
    } else if (difficulty === 'orta') {
        baseScore = 150;
        pool = allPlayers.filter(p => p.zorluk && p.zorluk.toLowerCase() === "orta");
    } else {
        baseScore = 250;
        pool = allPlayers.filter(p => p.zorluk === "zor");
    }

    if(pool.length < maxQuestions) {
        console.warn("DİKKAT: JSON dosyasında bu zorlukta yeterli oyuncu yok! Tüm oyuncular alınıyor.");
        pool = allPlayers;
    }

    prepareDailyQuestions(pool);
}

// --- YENİLENMİŞ SORU HAZIRLAMA (KALDIĞI YERDEN DEVAM ETME MANTIĞI) ---
async function prepareDailyQuestions(pool) {
    if (!window.db) {
        setTimeout(() => prepareDailyQuestions(pool), 100);
        return;
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    const documentId = `${year}-${month}-${day}-${currentDifficulty}`; 

    try {
        const docRef = window.doc(window.db, "daily_tahmin_et", documentId);
        const docSnap = await window.getDoc(docRef);

        if (docSnap.exists()) {
            const targetPlayerNames = docSnap.data().players;
            dailyPlayers = [];
            targetPlayerNames.forEach(name => {
                const playerObj = allPlayers.find(p => p.isim === name);
                if (playerObj) dailyPlayers.push(playerObj);
            });
        } else {
            const seed = year * 10000 + (today.getMonth() + 1) * 100 + today.getDate() + (currentDifficulty === 'kolay' ? 1 : currentDifficulty === 'orta' ? 2 : 3);
            const shuffled = seededShuffle([...pool], seed);
            dailyPlayers = shuffled.slice(0, maxQuestions);
            
            const playerNamesToSave = dailyPlayers.map(p => p.isim);
            await window.setDoc(docRef, {
                players: playerNamesToSave,
                createdAt: new Date()
            });
        }
    } catch (error) {
        console.error("Firebase Hatası, yerel mod başlatılıyor:", error);
        const seed = year * 10000 + (today.getMonth() + 1) * 100 + today.getDate() + (currentDifficulty === 'kolay' ? 1 : 2);
        dailyPlayers = seededShuffle([...pool], seed).slice(0, maxQuestions);
    }

    // --- YENİ: İLERLEMEYİ KONTROL ET VE YÜKLE ---
    const todayStr = new Date().toLocaleDateString('tr-TR');
    let progress = JSON.parse(localStorage.getItem('arenaProgress')) || {};
    
    // Eğer bugün bu zorluk seviyesinde kaydedilmiş bir ilerleme varsa:
    if (progress[todayStr] && progress[todayStr][currentDifficulty]) {
        questionIndex = progress[todayStr][currentDifficulty].questionIndex;
        totalScore = progress[todayStr][currentDifficulty].totalScore;
        console.log(`Kayıt bulundu: Soru ${questionIndex + 1}, Puan ${totalScore}`);
    } else {
        // Yoksa sıfırdan başlat
        questionIndex = 0;
        totalScore = 0;
    }

    // Arayüzdeki skoru güncelle ve soruyu yükle
    document.getElementById('total-score').innerText = totalScore;
    loadQuestion();
}

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
    currentScore = baseScore; 
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
    input.style.borderBottomColor = "#555"; 

    renderHangman();
    renderClues();
    timerInterval = setInterval(gameLoop, 1000);
}

window.nextQuestion = function() {
    questionIndex++;
    loadQuestion();
}

// --- 1. GÜNCELLENMİŞ OYUN BİTİŞ EKRANI ---
function finishDailyChallenge() {
    const today = new Date().toLocaleDateString('tr-TR');
    let played = JSON.parse(localStorage.getItem('playedBilmece')) || {};
    if(!played[today]) played[today] = [];
    played[today].push(currentDifficulty);
    localStorage.setItem('playedBilmece', JSON.stringify(played));

    let nextDiff = null;
    let nextDiffText = "";
    let nextDiffColor = "";
    
    // Eğer kolaydaysa ve ortayı henüz oynamadıysa
    if (currentDifficulty === 'kolay' && !played[today].includes('orta')) {
        nextDiff = 'orta';
        nextDiffText = 'ORTA SEVİYEYE GEÇ';
        // text-black yerine text-white yapıldı
        nextDiffColor = 'bg-yellow-500 text-white hover:bg-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.2)]';
    } 
    // Eğer ortadaysa ve zoru henüz oynamadıysa
    else if (currentDifficulty === 'orta' && !played[today].includes('zor')) {
        nextDiff = 'zor';
        nextDiffText = 'ZOR SEVİYEYE GEÇ';
        // text-black yerine text-white yapıldı
        nextDiffColor = 'bg-red-500 text-white hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.2)]';
    }

    let nextButtonHTML = "";
    if (nextDiff) {
        nextButtonHTML = `
            <button onclick="playNextMode('${nextDiff}')" class="w-full max-w-sm ${nextDiffColor} font-black py-4 rounded-xl transition-all active:scale-95 mb-4 border border-transparent">
                ${nextDiffText} <i class="fa-solid fa-forward-step ml-2"></i>
            </button>
        `;
    }

    const gameWrapper = document.getElementById('game-wrapper');
    
    gameWrapper.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-6 text-center animate-[modalShow_0.5s_ease-out_forwards]">
            
            <div class="text-7xl mb-4 drop-shadow-[0_0_20px_rgba(255,215,0,0.6)]">🏆</div>
            <h1 class="text-4xl sm:text-5xl font-black mb-2 tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-yellow-300">
                GÖREV TAMAMLANDI!
            </h1>
            <p class="text-gray-400 font-bold uppercase tracking-widest mb-8 text-sm">
                ${currentDifficulty} SEVİYE
            </p>
            
            <div class="bg-gray-900/80 border-2 border-green-500 rounded-3xl p-8 mb-8 shadow-[0_0_40px_rgba(34,197,94,0.2)] w-full max-w-sm">
                <p class="text-xs text-gray-500 uppercase font-black tracking-widest mb-2">TOPLAM KAZANILAN PUAN</p>
                <div class="text-6xl sm:text-7xl font-black text-green-400 drop-shadow-[0_0_15px_rgba(34,197,94,0.6)]">
                    ${totalScore}
                </div>
            </div>
            
            <p class="text-lg text-white font-bold mb-8">Tebrikler <span class="text-green-400">${username}</span>!</p>
            
            ${nextButtonHTML}
            
            <button onclick="location.href='../../index.html'" class="w-full max-w-sm bg-gray-800 text-white font-black py-4 rounded-xl transition-all active:scale-95 hover:bg-gray-700 border border-gray-600">
                ANA MENÜYE DÖN <i class="fa-solid fa-house ml-2"></i>
            </button>
            
        </div>
    `;

    if(window.saveScoreToFirebase) {
        window.saveScoreToFirebase(totalScore, `Arena (${currentDifficulty.toUpperCase()})`);
    }
}

// --- YENİLENMİŞ AKILLI VE MOBİL UYUMLU HARF KUTULARI ---
function renderHangman() {
    const container = document.getElementById('hangman-area');
    
    // Kelimeler arası boşluk (gap-x-6). Satırlar arası boşluk (gap-y-3).
    container.className = "flex flex-wrap justify-center gap-x-6 sm:gap-x-8 gap-y-3 mb-6 min-h-[60px] w-full max-w-lg shrink-0";
    container.innerHTML = '';
    
    const cleanFullName = normalizeInput(targetPlayer.isim);
    const nameParts = cleanFullName.split(' '); 
    let globalCounter = 0;

    nameParts.forEach((part) => {
        const wordDiv = document.createElement('div');
        
        // YENİ: "flex-wrap" KALDIRILDI! Artık kelimenin harfleri ASLA alt satıra düşemez, yan yana kalmaya zorlanır.
        wordDiv.className = 'flex justify-center gap-1 sm:gap-1.5';

        // YENİ: Kelime 7 harften uzunsa (Örn: CHRISTOPHER), kutuları mobilde biraz daha küçük yap.
        const isLongWord = part.length > 7;
        const sizeClasses = isLongWord 
            ? 'w-6 h-8 sm:w-10 sm:h-12 text-base sm:text-xl' // Uzun kelimeler için dar kutular
            : 'w-8 h-10 sm:w-11 sm:h-14 text-xl sm:text-2xl'; // Normal kelimeler için standart kutular

        for (let i = 0; i < part.length; i++) {
            const char = part[i];
            const span = document.createElement('span');
            
            // "flex-shrink" eklendi. Ekran çok darsa kutular taşmak yerine esneyip hafifçe daralacak.
            span.className = `letter-box ${sizeClasses} flex-shrink bg-gray-800 border-2 border-gray-600 rounded-lg flex items-center justify-center font-black text-transparent shadow-md transition-all duration-300 select-none`;
            
            span.classList.add('empty'); 
            span.id = `char-${globalCounter}`;
            span.innerText = char; 
            
            globalLetterIndexMap.push({ id: globalCounter, char: char });
            wordDiv.appendChild(span);
            globalCounter++;
        }
        
        container.appendChild(wordDiv);
    });
}

function renderClues() {
    const container = document.getElementById('clues-area');
    container.innerHTML = '';
    
    const clues = [
        { t: "Lig", v: targetPlayer.lig },
        { t: "Uyruk", v: targetPlayer.uyruk },
        { t: "Yaş", v: targetPlayer.yas },
        { t: "Takım", v: targetPlayer.takim },
        { t: "Pozisyon", v: targetPlayer.pozisyon } 
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
    
    if (seconds <= 15 && seconds % 3 === 0) {
        revealClueCard((seconds / 3) - 1);
        decreaseScore(Math.floor(baseScore * 0.05)); 
    }
    
    if (seconds > 15 && seconds % 2 === 0) {
        revealRandomLetter();
        decreaseScore(Math.floor(baseScore * 0.08)); 
    }
    
    if (currentScore <= 0) endGame(false);
}

function revealClueCard(index) {
    const card = document.getElementById(`clue-${index}`);
    if (card && !card.classList.contains('active')) { // Zaten açık değilse
        card.classList.add('active');
        playSound('reveal'); // YENİ: Kutu açılma sesi
    }
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
            charBox.style.color = "#aaa"; 
        }
    }
}

function decreaseScore(amount) {
    currentScore -= amount;
    if (currentScore < 0) currentScore = 0;
    document.getElementById('current-score').innerText = currentScore;
}

function makeGuess() {
    if (isGameOver) return;
    const input = document.getElementById('guess-input');
    const rawGuess = input.value;
    const cleanGuess = normalizeInput(rawGuess);
    
    if (cleanGuess.length === 0) return;

    const correctFullName = normalizeInput(targetPlayer.isim);
    const nameParts = correctFullName.split(' ');
    
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : firstName;

    if (cleanGuess === correctFullName || cleanGuess === firstName || cleanGuess === lastName) {
        endGame(true);
    } else {
        playSound('wrong'); // YENİ: Yanlış tahmin sesi
        input.style.borderBottomColor = "var(--matte-red)";
        input.animate([
            { transform: 'translateX(0px)' },
            { transform: 'translateX(5px)' },
            { transform: 'translateX(-5px)' },
            { transform: 'translateX(0px)' }
        ], { duration: 200 });

        setTimeout(() => input.style.borderBottomColor = "#555", 1000);
        decreaseScore(15);
        input.value = '';
    }
}

// --- YENİLENMİŞ OTOMATİK GEÇİŞLİ VE HİLE KORUMALI OYUN BİTİŞİ ---
function endGame(isWin) {
    isGameOver = true;
    clearInterval(timerInterval);
    const msgArea = document.getElementById('message-area');
    const input = document.getElementById('guess-input');

    if (isWin) {
        // KAZANMA DURUMU
        playSound('success');
        msgArea.innerHTML = `<span class="text-green-400">DOĞRU!</span> <strong>${targetPlayer.isim}</strong> <br><span class="text-sm text-gray-400">Bu sorudan +${currentScore} Puan aldın.</span>`;
        msgArea.className = "text-center font-black text-xl mb-4 p-4 bg-green-900/20 border border-green-500 rounded-xl shadow-[0_0_20px_rgba(34,197,94,0.3)] block";
        
        totalScore += currentScore;
        document.getElementById('total-score').innerText = totalScore;
        
        document.querySelectorAll('.letter-box, span[id^="char-"]').forEach(box => {
            box.classList.remove('empty', 'text-transparent', 'bg-gray-800', 'border-gray-600'); 
            box.classList.add('bg-green-500', 'border-green-400', 'text-black', 'shadow-[0_0_15px_rgba(34,197,94,0.5)]');
        });

        setTimeout(() => { nextQuestion(); }, 2000);

    } else {
        // KAYBETME DURUMU
        playSound('wrong');
        msgArea.innerHTML = `<span class="text-red-500">SÜRE BİTTİ!</span> <br><span class="text-sm text-gray-400">Doğru Cevap: <span class="text-white">${targetPlayer.isim}</span></span>`;
        msgArea.className = "text-center font-black text-xl mb-4 p-4 bg-red-900/20 border border-red-500 rounded-xl shadow-[0_0_20px_rgba(239,68,68,0.3)] block";
        
        document.querySelectorAll('.letter-box, span[id^="char-"]').forEach(box => {
            box.classList.remove('empty', 'text-transparent', 'bg-gray-800', 'border-gray-600');
            box.classList.add('bg-red-900/50', 'border-red-500', 'text-red-200');
        });

        setTimeout(() => { nextQuestion(); }, 3000);
    }
    
    input.disabled = true;

    // --- YENİ: İLERLEMEYİ ANINDA KAYDET (HİLE KORUMASI) ---
    // Oyuncu soruyu doğru/yanlış bitirdiği SALİSEDE, bir sonraki soruya geçeceğini ve güncel puanını hafızaya kazıyoruz.
    const todayStr = new Date().toLocaleDateString('tr-TR');
    let progress = JSON.parse(localStorage.getItem('arenaProgress')) || {};
    if (!progress[todayStr]) progress[todayStr] = {};
    
    progress[todayStr][currentDifficulty] = {
        questionIndex: questionIndex + 1, // Bir sonraki soruya geçmeye hak kazandı
        totalScore: totalScore            // Güncel toplam puanı
    };
    
    localStorage.setItem('arenaProgress', JSON.stringify(progress));
}

window.playNextMode = function(nextDifficulty) {
    // Tarayıcının hafızasına "Bu sayfa açıldığında direkt şu zorlukla başla" talimatını veriyoruz.
    localStorage.setItem('autoStartArena', nextDifficulty);
    
    // Sayfayı tamamen yeniliyoruz ki her şey sıfırlansın, tertemiz başlasın.
    window.location.reload();
}