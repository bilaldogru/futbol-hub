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
        })
        .catch(err => console.error("JSON Hatası:", err));

    document.getElementById('guess-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') makeGuess();
    });
});

function checkPlayedDifficulties() {
    const today = new Date().toLocaleDateString('tr-TR');
    const played = JSON.parse(localStorage.getItem('playedBilmece')) || {};
    
    if(played[today]) {
        if(played[today].includes('kolay')) document.getElementById('btn-kolay').disabled = true;
        if(played[today].includes('orta')) document.getElementById('btn-orta').disabled = true;
        if(played[today].includes('zor')) document.getElementById('btn-zor').disabled = true;
    }
}

window.startGame = function(difficulty) {
    currentDifficulty = difficulty;
    document.getElementById('difficulty-modal').style.display = 'none';
    document.getElementById('game-wrapper').classList.remove('blurred');
    
    let pool = [];
    if(difficulty === 'kolay') {
        baseScore = 100;
        pool = allPlayers.filter(p => p.zorluk === "kolay");
    } else if (difficulty === 'orta') {
        baseScore = 150;
        pool = allPlayers.filter(p => p.zorluk === "orta");
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

// --- 2. GÜNLÜK SORULAR (FIREBASE KAYITLI v9 Modüler Yapı) ---
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
            console.log(`✅ ${documentId} listesi Firebase'den çekildi.`);
            const targetPlayerNames = docSnap.data().players;
            
            dailyPlayers = [];
            targetPlayerNames.forEach(name => {
                const playerObj = allPlayers.find(p => p.isim === name);
                if (playerObj) dailyPlayers.push(playerObj);
            });
        } else {
            console.log(`⚡ ${documentId} Firebase'de yok. Seçiliyor ve kaydediliyor...`);
            
            const seed = year * 10000 + (today.getMonth() + 1) * 100 + today.getDate() + (currentDifficulty === 'kolay' ? 1 : currentDifficulty === 'orta' ? 2 : 3);
            const shuffled = seededShuffle([...pool], seed);
            dailyPlayers = shuffled.slice(0, maxQuestions);
            
            const playerNamesToSave = dailyPlayers.map(p => p.isim);
            await window.setDoc(docRef, {
                players: playerNamesToSave,
                createdAt: new Date()
            });
            console.log("💾 Seçim Firebase'e kaydedildi!");
        }

        questionIndex = 0;
        totalScore = 0;
        document.getElementById('total-score').innerText = "0";
        loadQuestion();

    } catch (error) {
        console.error("Firebase Hatası, yerel mod başlatılıyor:", error);
        const seed = year * 10000 + (today.getMonth() + 1) * 100 + today.getDate() + (currentDifficulty === 'kolay' ? 1 : 2);
        dailyPlayers = seededShuffle([...pool], seed).slice(0, maxQuestions);
        questionIndex = 0;
        loadQuestion();
    }
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

function finishDailyChallenge() {
    const today = new Date().toLocaleDateString('tr-TR');
    let played = JSON.parse(localStorage.getItem('playedBilmece')) || {};
    if(!played[today]) played[today] = [];
    played[today].push(currentDifficulty);
    localStorage.setItem('playedBilmece', JSON.stringify(played));

    const gameContainer = document.querySelector('.game-container');
    
    gameContainer.innerHTML = `
        <div style="text-align:center; padding: 40px;">
            <h1 style="color:var(--matte-green); font-size: 3rem;">GÖREV TAMAMLANDI!</h1>
            <p style="color:#aaa; margin-top:10px;">${currentDifficulty.toUpperCase()} Zorluk Puanı</p>
            <div style="font-size: 5rem; font-weight:bold; color: white; text-shadow: 0 0 20px rgba(255,255,255,0.2); margin: 20px 0;">
                ${totalScore}
            </div>
            <p style="color:#fff;">Tebrikler ${username}!</p>
            <br>
            <button onclick="location.href='../../index.html'" class="action-btn" style="background:#444;">ANA MENÜYE DÖN</button>
        </div>`;
    
    if(window.saveScoreToFirebase) {
        window.saveScoreToFirebase(totalScore, `Bilmece (${currentDifficulty.toUpperCase()})`);
    }
}

function renderHangman() {
    const container = document.getElementById('hangman-area');
    container.innerHTML = '';
    const cleanFullName = normalizeInput(targetPlayer.isim);
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

function endGame(isWin) {
    isGameOver = true;
    clearInterval(timerInterval);
    const msgArea = document.getElementById('message-area');
    const nextBtn = document.getElementById('next-btn');
    const input = document.getElementById('guess-input');

    if (isWin) {
        msgArea.innerHTML = `DOĞRU! <strong>${targetPlayer.isim}</strong> +${currentScore} P`;
        msgArea.className = "message success";
        totalScore += currentScore;
        document.getElementById('total-score').innerText = totalScore;
        
        document.querySelectorAll('.letter-box').forEach(box => {
            box.classList.remove('empty'); box.classList.add('solved');
            box.innerText = box.innerText;
            box.style.color = "white";
        });
    } else {
        msgArea.innerHTML = `SÜRE BİTTİ! Cevap: ${targetPlayer.isim}`;
        msgArea.className = "message fail";
        document.querySelectorAll('.letter-box').forEach(box => box.classList.remove('empty'));
    }
    
    msgArea.classList.remove('hidden');
    nextBtn.classList.remove('hidden');
    input.disabled = true;
    nextBtn.focus();
}