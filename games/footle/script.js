// --- 1. GLOBAL DEĞİŞKENLER ---
let oyuncular = [];
let hedefOyuncu = {};
let oyunBitti = false;
let denemeSayisi = 0;
const maxHak = 7;
let bonusKazanilanlar = { uyruk: false, lig: false, takim: false, pozisyon: false, yas: false };

// --- MULTIPLAYER DEĞİŞKENLERİ ---
let isMultiplayer = false;
let roomId = null;
let playerRole = null; 
let multiRounds = 3;
let currentMultiRound = 0;
let multiTargets = [];
let myScore = 0;
let oppScore = 0;
let roomUnsubscribe = null;
let lobbyUnsubscribe = null; 
let myGuesses = []; 
let selectedRoundsToCreate = 3; 
let roomExpireTimer = null;
let buTurKazanilanPuan = 0;

// --- BOT DEĞİŞKENLERİ ---
let botJoinTimer = null;
let botLobbyTimer = null;
let botPlayInterval = null;
let isBotMatch = false;
let botGuesses = 0;

// DOM Elementleri
const input = document.getElementById('playerInput');
const autocompleteList = document.getElementById('autocomplete-list');
const submitBtn = document.getElementById('submitBtn');
const hakGosterge = document.getElementById('hakGosterge');

// --- BİLDİRİM SİSTEMİ (TOAST) ---
window.showToast = function(msg, type = 'error') {
    let toast = document.getElementById('customToast');
    if(!toast) {
        toast = document.createElement('div');
        toast.id = 'customToast';
        toast.innerHTML = `<i id="toastIcon" class="text-2xl"></i><span id="toastMsg"></span>`;
        document.body.appendChild(toast);
    }
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');

    toastMsg.innerHTML = msg;
    toast.className = "fixed top-10 left-1/2 transform -translate-x-1/2 z-[9999] transition-all duration-300 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl font-bold text-white border-2";

    if(type === 'error') {
        toast.classList.add('bg-red-900/90', 'border-red-500', 'shadow-[0_0_30px_rgba(239,68,68,0.4)]');
        toastIcon.className = "fa-solid fa-circle-exclamation text-red-400 text-2xl";
    } else if (type === 'success') {
        toast.classList.add('bg-green-900/90', 'border-green-500', 'shadow-[0_0_30px_rgba(34,197,94,0.4)]');
        toastIcon.className = "fa-solid fa-circle-check text-green-400 text-2xl";
    }

    toast.classList.remove('opacity-0', '-translate-y-24');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', '-translate-y-24');
    }, 3000);
}

// --- FOOTLE İÇİN GÜNLÜK OYUN KİLİDİ KONTROLÜ ---
function checkDailyLock() {
    const btn = document.getElementById('btnDailyMode');
    const icon = document.getElementById('dailyModeIcon');
    const text = document.getElementById('dailyModeText');
    
    if(!btn) return;
    
    const today = new Date().toDateString();
    const lastPlayed = localStorage.getItem('footle_daily_last_played');
    
    if(lastPlayed === today) {
        btn.disabled = true; 
        
        btn.classList.add('opacity-50', 'cursor-not-allowed', 'bg-black');
        btn.classList.remove('hover:bg-gray-700', 'hover:border-white');
        
        if(icon) icon.className = "fa-solid fa-lock text-red-500 mr-2";
        if(text) text.innerText = "GÜNLÜK OYNANDI (YARIN GEL)";
    }
}

// --- 2. BAŞLANGIÇ ---
document.addEventListener('DOMContentLoaded', () => {
    checkDailyLock(); 
    
    fetch('../../oyuncular.json')
        .then(response => response.json())
        .then(data => {
            oyuncular = data;
            const urlParams = new URLSearchParams(window.location.search);
            const joinRoomId = urlParams.get('room');
            
            if (joinRoomId) {
                document.getElementById('modeSelectionModal').classList.add('hidden');
                joinRoom(joinRoomId);
            }
        })
        .catch(err => console.error("Veri çekme hatası:", err));
});

// --- 3. MENÜ VE LOBİ YÖNETİMİ ---
window.startSinglePlayer = function() {
    const today = new Date().toDateString();
    if(localStorage.getItem('footle_daily_last_played') === today) {
        window.showToast("Bugünkü hakkını zaten kullandın. Yarın tekrar gel!", "error");
        return;
    }

    document.getElementById('modeSelectionModal').classList.add('hidden');
    isMultiplayer = false;
    oyunuBaslat(); 
};

window.openLobby = function() {
    document.getElementById('modeSelectionModal').classList.add('hidden');
    document.getElementById('lobbyModal').classList.remove('hidden');
    fetchLobbyRooms(); 
};

window.backToModeSelectionFromLobby = function() {
    if(lobbyUnsubscribe) lobbyUnsubscribe(); 
    document.getElementById('lobbyModal').classList.add('hidden');
    document.getElementById('modeSelectionModal').classList.remove('hidden');
    checkDailyLock(); 
};

window.showMultiplayerSetup = function() {
    if(lobbyUnsubscribe) lobbyUnsubscribe(); 
    document.getElementById('lobbyModal').classList.add('hidden');
    document.getElementById('multiplayerSetupModal').classList.remove('hidden');
    
    document.getElementById('setupControls').classList.remove('hidden');
    document.getElementById('linkArea').classList.add('hidden');
    selectRounds(3); 
};

window.backToLobby = async function() {
    if (roomExpireTimer) clearTimeout(roomExpireTimer); 
    if (botJoinTimer) clearTimeout(botJoinTimer);
    if (botPlayInterval) clearInterval(botPlayInterval);

    if (roomId && playerRole) {
        try {
            // Eğer oyun aktifse ve terk ediyorsam
            if (document.getElementById('multiplayerScoreBoard').classList.contains('hidden') === false) {
                await window.updateDoc(window.doc(window.db, "footle_rooms", roomId), {
                    abandonedBy: playerRole
                });
            } else if (playerRole === 'player1') {
                await window.deleteDoc(window.doc(window.db, "footle_rooms", roomId));
            }
        } catch(e) {}
    }
    
    roomId = null;
    playerRole = null;
    isMultiplayer = false;
    isBotMatch = false;
    if(roomUnsubscribe) roomUnsubscribe();

    document.getElementById('multiplayerSetupModal').classList.add('hidden');
    document.getElementById('lobbyModal').classList.remove('hidden');
    fetchLobbyRooms();
};

window.addEventListener('beforeunload', (e) => {
    if (roomId && playerRole) {
        if (document.getElementById('multiplayerScoreBoard').classList.contains('hidden') === false) {
             window.updateDoc(window.doc(window.db, "footle_rooms", roomId), {
                 abandonedBy: playerRole
             });
        } else if (playerRole === 'player1') {
             window.deleteDoc(window.doc(window.db, "footle_rooms", roomId));
        }
    }
});

// --- 4. AÇIK LOBİLERİ ÇEKME ---
window.fetchLobbyRooms = function() {
    if(!window.db) return;
    
    const roomsRef = window.collection(window.db, "footle_rooms");
    const q = window.query(roomsRef, window.where("status", "==", "waiting_for_p2"), window.where("isPrivate", "==", false));
    
    if(lobbyUnsubscribe) lobbyUnsubscribe();
    
    lobbyUnsubscribe = window.onSnapshot(q, (snapshot) => {
        const roomList = document.getElementById('roomList');
        roomList.innerHTML = '';
        
        let validRoomCount = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const roomId = doc.id;
            
            const now = new Date().getTime();
            if (data.createdAtMs && (now - data.createdAtMs > 300000)) return; 

            validRoomCount++;
            
            const roomItem = document.createElement('div');
            roomItem.className = "flex justify-between items-center bg-gray-800 p-3 rounded-lg hover:bg-gray-700 border border-gray-700 transition";
            roomItem.innerHTML = `
                <div>
                    <p class="text-white font-bold text-sm">Oda: #${roomId}</p>
                    <p class="text-xs text-blue-400">${data.rounds} Tur</p>
                </div>
                <button onclick="joinRoom('${roomId}')" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded transition shadow-lg shadow-blue-500/20">KATIL</button>
            `;
            roomList.appendChild(roomItem);
        });

        if(validRoomCount === 0) {
            roomList.innerHTML = '<p class="text-gray-500 text-sm text-center mt-4">Şu an açık oda yok. Yeni bir tane kur!</p>';
        }
        
        // BOT LOBİ KURMA SİMÜLASYONU
        if (document.getElementById('lobbyModal').classList.contains('hidden') === false) {
            if (!botLobbyTimer) {
                const randomDelay = Math.floor(Math.random() * (45000 - 15000 + 1)) + 15000; // 15-45 saniye
                botLobbyTimer = setTimeout(() => {
                    createBotLobbyForPlayer();
                }, randomDelay);
            }
        } else {
            if (botLobbyTimer) { clearTimeout(botLobbyTimer); botLobbyTimer = null; }
        }
    });
};

function createBotLobbyForPlayer() {
    if (!window.db || isMultiplayer) return;
    botLobbyTimer = null; // Reset for next
    
    const rounds = [3, 5, 10][Math.floor(Math.random() * 3)];
    const tempRoomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    
    const kolayOyuncular = oyuncular.filter(p => p.zorluk === 'kolay');
    let shuffled = [...kolayOyuncular].sort(() => 0.5 - Math.random());
    const tempTargets = shuffled.slice(0, rounds).map(p => p.isim);

    const roomRef = window.doc(window.db, "footle_rooms", tempRoomId);
    window.setDoc(roomRef, {
        rounds: rounds,
        targets: tempTargets,
        isPrivate: false, 
        p1Score: 0,
        p2Score: 0,
        p1Status: 'playing',
        p2Status: 'waiting',
        p1DocId: 'BOT_PLAYER',
        p2DocId: null,
        p1Guesses: [], 
        p2Guesses: [], 
        currentRound: 1,
        status: 'waiting_for_p2',
        createdAtMs: new Date().getTime(),
        isBotLobby: true // Custom flag for bot
    }).then(() => {
        // Auto remove bot lobby after 60 seconds if nobody joins
        setTimeout(() => {
            window.getDoc(roomRef).then((snap) => {
                if (snap.exists() && snap.data().status === 'waiting_for_p2') {
                    window.deleteDoc(roomRef).catch(e=>console.log(e));
                }
            });
        }, 60000);
    }).catch(e=>console.log(e));
}

// --- 5. ODA OLUŞTURMA VE KATILMA ---
window.selectRounds = function(rounds) {
    selectedRoundsToCreate = rounds;
    
    document.getElementById('btnRound3').className = "flex-1 bg-gray-800 text-white font-bold py-3 rounded-xl border border-gray-600 hover:bg-gray-700 hover:border-blue-500 transition";
    document.getElementById('btnRound5').className = "flex-1 bg-gray-800 text-white font-bold py-3 rounded-xl border border-gray-600 hover:bg-gray-700 hover:border-blue-500 transition";
    document.getElementById('btnRound10').className = "flex-1 bg-gray-800 text-white font-bold py-3 rounded-xl border border-gray-600 hover:bg-gray-700 hover:border-blue-500 transition";
    
    const activeBtn = document.getElementById('btnRound' + rounds);
    activeBtn.className = "flex-1 bg-blue-900/30 text-white font-bold py-3 rounded-xl border border-blue-500 hover:bg-gray-700 transition";
};

window.confirmAndCreateRoom = async function() {
    if(!window.db) { alert("Bağlantı bekleniyor..."); return; }
    
    const rounds = selectedRoundsToCreate;
    multiRounds = rounds;
    roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
    playerRole = 'player1';
    isMultiplayer = true;
    
    const isPrivate = document.getElementById('privateRoomCheck').checked;

    const kolayOyuncular = oyuncular.filter(p => p.zorluk === 'kolay');
    let shuffled = [...kolayOyuncular].sort(() => 0.5 - Math.random());
    multiTargets = shuffled.slice(0, rounds).map(p => p.isim);

    const nowMs = new Date().getTime(); 

    const roomRef = window.doc(window.db, "footle_rooms", roomId);
    await window.setDoc(roomRef, {
        rounds: rounds,
        targets: multiTargets,
        isPrivate: isPrivate, 
        p1Score: 0,
        p2Score: 0,
        p1Status: 'playing',
        p2Status: 'waiting',
        p1DocId: window.userFirebaseDocId || null,
        p2DocId: null,
        p1Guesses: [], 
        p2Guesses: [], 
        currentRound: 1,
        status: 'waiting_for_p2',
        createdAtMs: nowMs 
    });

    roomExpireTimer = setTimeout(async () => {
        if (roomId && playerRole === 'player1') {
            try {
                await window.deleteDoc(window.doc(window.db, "footle_rooms", roomId));
                alert("5 dakika boyunca kimse katılmadığı için oda iptal edildi.");
                window.backToLobby(); 
            } catch(e) {}
        }
    }, 300000);
    
    // BOT KATILMA SİMÜLASYONU 
    if (!isPrivate) {
        const joinDelay = Math.floor(Math.random() * (30000 - 20000 + 1)) + 20000; // 20-30 saniye
        botJoinTimer = setTimeout(() => {
            simulateBotJoining(roomId);
        }, joinDelay);
    }

    document.getElementById('setupControls').classList.add('hidden');
    
    const linkStr = window.location.origin + window.location.pathname + "?room=" + roomId;
    document.getElementById('inviteLink').value = linkStr;
    document.getElementById('linkArea').classList.remove('hidden');

    listenToRoom(); 
};

// --- BOT SİMÜLASYON FONKSİYONLARI ---
async function simulateBotJoining(targetRoomId) {
    if (!window.db) return;
    const roomRef = window.doc(window.db, "footle_rooms", targetRoomId);
    try {
        const snap = await window.getDoc(roomRef);
        if (snap.exists() && snap.data().status === 'waiting_for_p2') {
            isBotMatch = true;
            await window.updateDoc(roomRef, {
                p2Status: 'playing',
                p2DocId: 'BOT_PLAYER'
            });
            window.showToast("Biri odaya katıldı!", "success");
        }
    } catch(e) { console.warn("Bot join error", e); }
}

// Bot'un mantığı için state değişkenleri (botGuesses zaten var)
let botPossiblePlayers = [];

function simulateBotTurn(roomRef, rolePrefix, currentRoundData, currentRoundIndex) {
    if (!isMultiplayer || oyunBitti || !roomId) return;
    
    const targetName = multiTargets[currentRoundIndex - 1];
    const targetPlayer = oyuncular.find(p => p.isim === targetName);
    if (!targetPlayer) return;
    
    // Eğer ilk tahminsi (botGuesses 0), tüm oyunculardan başla (sadece kolay zorluk veya tümü)
    if (botGuesses === 0) {
        botPossiblePlayers = oyuncular.filter(p => p.zorluk === 'kolay'); 
        if (botPossiblePlayers.length === 0) botPossiblePlayers = [...oyuncular];
        
        // İlk tahminde doğru bilmesini %100 engellemek için hedefi havuzdan geçici çıkar
        botPossiblePlayers = botPossiblePlayers.filter(p => p.isim !== targetPlayer.isim);
    }
    
    const maxBotGuesses = 7;
    botGuesses++;

    // Tahmin yapacak oyuncuyu seç
    let guessPlayer;
    if (botPossiblePlayers.length > 0) {
        const randomIndex = Math.floor(Math.random() * botPossiblePlayers.length);
        guessPlayer = botPossiblePlayers[randomIndex];
    } else {
        // Havuz boşaldıysa fallback olarak rastgele herhangi biri (nadir durum)
        guessPlayer = oyuncular[Math.floor(Math.random() * oyuncular.length)];
    }

    // Seçilen tahmin ile hedefi karşılaştır
    const kriterler = [
        { id: 'uyruk', val: guessPlayer.uyruk, target: targetPlayer.uyruk, type: 'text' },
        { id: 'lig', val: guessPlayer.lig, target: targetPlayer.lig, type: 'text' },
        { id: 'takim', val: guessPlayer.takim, target: targetPlayer.takim, type: 'text' },
        { id: 'pozisyon', val: guessPlayer.pozisyon, target: targetPlayer.pozisyon, type: 'text' },
        { id: 'yas', val: guessPlayer.yas, target: targetPlayer.yas, type: 'number' }
    ];

    let simColors = [];
    let corrects = []; 
    let kazanilanEkstraPuan = 0;

    kriterler.forEach(k => {
        let renk = 'wrong';
        if (k.val === k.target) {
            renk = 'correct';
            corrects.push(k.id);
            kazanilanEkstraPuan += (k.id === 'lig' || k.id === 'pozisyon' || k.id === 'yas') ? 25 : 50;
        } else if (k.type === 'number') {
            renk = 'partial'; 
        }
        simColors.push(renk);
    });

    const isBotWin = (guessPlayer.isim === targetPlayer.isim);
    
    const updateData = {};
    const guessesArray = currentRoundData[rolePrefix + 'Guesses'] || [];
    guessesArray.push(simColors.join('-'));
    updateData[rolePrefix + 'Guesses'] = guessesArray;
    
    if (isBotWin) {
        // Bot kazandı
        const temelPuan = (8 - botGuesses) * 100;
        updateData[rolePrefix + 'Score'] = currentRoundData[rolePrefix + 'Score'] + temelPuan + kazanilanEkstraPuan;
        updateData[rolePrefix + 'Status'] = 'finished';
        window.updateDoc(roomRef, updateData).catch(e => console.log(e));
        if (botPlayInterval) clearInterval(botPlayInterval);
    } else if (botGuesses >= maxBotGuesses) {
        // Bot hakkını doldurdu ve kaybetti
        updateData[rolePrefix + 'Score'] = currentRoundData[rolePrefix + 'Score'] + kazanilanEkstraPuan;
        updateData[rolePrefix + 'Status'] = 'finished';
        window.updateDoc(roomRef, updateData).catch(e => console.log(e));
        if (botPlayInterval) clearInterval(botPlayInterval);
    } else {
        // Bot devam ediyor. Havuzu daralt (Ama insan gibi hata yapması için %50 ihtimalle bir bilgiyi unutabilir)
        updateData[rolePrefix + 'Score'] = currentRoundData[rolePrefix + 'Score'] + kazanilanEkstraPuan;
        window.updateDoc(roomRef, updateData).catch(e => console.log(e));
        
        botPossiblePlayers = botPossiblePlayers.filter(p => {
            let passes = true;
            
            // Botun o özelliği doğru bilmesine rağmen, dikkatsizlikten (%50 ihtimalle o özelliği) filtrelemeyi unutması
            const rememberUyruk = Math.random() > 0.50;
            const rememberLig = Math.random() > 0.50;
            const rememberTakim = Math.random() > 0.50;
            const rememberPozisyon = Math.random() > 0.50;
            const rememberYas = Math.random() > 0.50;

            if (corrects.includes('uyruk') && rememberUyruk && p.uyruk !== guessPlayer.uyruk) passes = false;
            if (corrects.includes('lig') && rememberLig && p.lig !== guessPlayer.lig) passes = false;
            if (corrects.includes('takim') && rememberTakim && p.takim !== guessPlayer.takim) passes = false;
            if (corrects.includes('pozisyon') && rememberPozisyon && p.pozisyon !== guessPlayer.pozisyon) passes = false;
            if (corrects.includes('yas') && rememberYas && p.yas !== guessPlayer.yas) passes = false;
            
            return passes;
        });
        
        // Eğer havuz yanlışlıkla tamamen boşalırsa (çok fazla hata yaparsa), havuzu tekrar doldur
        if (botPossiblePlayers.length === 0) {
            botPossiblePlayers = oyuncular.filter(p => p.zorluk === 'kolay');
        }
    }
}

window.copyInviteLink = function() {
    const linkInput = document.getElementById('inviteLink');
    const copyIcon = document.getElementById('copyIcon');
    const copyTooltip = document.getElementById('copyTooltip');
    const copyBtn = document.getElementById('copyBtn');

    linkInput.select();
    linkInput.setSelectionRange(0, 99999); 
    
    navigator.clipboard.writeText(linkInput.value).then(() => {
        copyIcon.classList.remove('fa-copy');
        copyIcon.classList.add('fa-check', 'text-blue-500');
        copyBtn.classList.replace('bg-gray-800', 'bg-blue-900/30');
        copyBtn.classList.add('border', 'border-blue-500');
        copyTooltip.classList.remove('opacity-0', 'translate-y-2');
        copyTooltip.classList.add('opacity-100', 'translate-y-0');

        setTimeout(() => {
            copyIcon.classList.add('fa-copy');
            copyIcon.classList.remove('fa-check', 'text-blue-500');
            copyBtn.classList.replace('bg-blue-900/30', 'bg-gray-800');
            copyBtn.classList.remove('border', 'border-blue-500');
            copyTooltip.classList.remove('opacity-100', 'translate-y-0');
            copyTooltip.classList.add('opacity-0', 'translate-y-2');
        }, 2000);
        
    }).catch(err => { document.execCommand("copy"); });
};

async function joinRoom(id) {
    if(!window.db) { setTimeout(() => joinRoom(id), 200); return; }

    roomId = id;
    playerRole = 'player2';
    isMultiplayer = true;
    
    if(lobbyUnsubscribe) lobbyUnsubscribe();
    document.getElementById('lobbyModal').classList.add('hidden');
    
    showWaitingOverlay("ODAYA BAĞLANILIYOR...");

    const roomRef = window.doc(window.db, "footle_rooms", roomId);
    const docSnap = await window.getDoc(roomRef);

    if (!docSnap.exists() || docSnap.data().status !== 'waiting_for_p2') {
        alert("Oda bulunamadı, dolu veya süresi dolmuş!");
        window.location.href = "index.html"; 
        return;
    }

    const data = docSnap.data();
    multiRounds = data.rounds;
    multiTargets = data.targets;

    if (data.isBotLobby) { isBotMatch = true; }

    await window.updateDoc(roomRef, { 
        p2Status: 'playing',
        p2DocId: window.userFirebaseDocId || null,
        status: 'active' // Ensure game starts immediately for bot lobbies
    });
    listenToRoom();
}

// --- 6. MULTIPLAYER: GERÇEK ZAMANLI SENKRONİZASYON ---
function listenToRoom() {
    const roomRef = window.doc(window.db, "footle_rooms", roomId);
    
    roomUnsubscribe = window.onSnapshot(roomRef, async (docSnap) => {
        if(!docSnap.exists()) return;
        const data = docSnap.data();

        // RAKİP OYUNU TERK ETTİYSE:
        if (data.abandonedBy && data.status !== 'game_over') {
            if (data.abandonedBy !== playerRole) {
                if (roomUnsubscribe) roomUnsubscribe(); // Dinlemeyi bırak
                
                // ODADA KALAN KİŞİYİM (BEN TERK ETMEDİM). PUAN ÖNDEYSEM GALİP SAYILACAK.
                const myFinalScore = playerRole === 'player1' ? data.p1Score : data.p2Score;
                const oppFinalScore = playerRole === 'player1' ? data.p2Score : data.p1Score;
                
                if (myFinalScore > oppFinalScore) {
                    // Hükmen Galibiyet
                    const myDocId = playerRole === 'player1' ? data.p1DocId : data.p2DocId;
                    if (myDocId) {
                        try {
                           await window.updateDoc(window.doc(window.db, "scores", myDocId), { wins: window.increment(1) });
                        } catch(e) { console.error("Win ekleme hatası:", e); }
                    }
                    if(window.playSound) window.playSound('success');
                    showCustomEndModal("🏆", "HÜKMEN KAZANDIN!", "Rakip oyundan çıktığı için ve sen puanda önde olduğun için hükmen galip geldin.", "success");
                } else {
                    // Puanlar eşitse veya gerideyken rakip çıkarsa berabere / iptal sayılır
                    showCustomEndModal("⚠️", "MAÇ İPTAL EDİLDİ", "Sen gerideyken (veya berabereyken) rakip çıktığı için puanlaman etkilenmedi.", "error");
                }
                
                // Odayı kapat
                if (playerRole === 'player1') {
                    window.deleteDoc(roomRef).catch(e=>console.log(e));
                }
            }
            return;
        }

        myScore = playerRole === 'player1' ? data.p1Score : data.p2Score;
        oppScore = playerRole === 'player1' ? data.p2Score : data.p1Score;
        document.getElementById('myScore').innerText = myScore;
        document.getElementById('opponentScore').innerText = oppScore;
        document.getElementById('currentRoundDisplay').innerText = data.currentRound;
        document.getElementById('totalRoundsDisplay').innerText = data.rounds;

        const oppGuesses = playerRole === 'player1' ? data.p2Guesses : data.p1Guesses;
        renderOpponentBoard(oppGuesses || []);

        if (playerRole === 'player1' && data.status === 'waiting_for_p2' && data.p2Status === 'playing') {
            if (roomExpireTimer) clearTimeout(roomExpireTimer); 
            window.updateDoc(roomRef, { status: 'active' });
        }

        if (data.status === 'active' && currentMultiRound !== data.currentRound) {
            currentMultiRound = data.currentRound;
            document.getElementById('multiplayerSetupModal').classList.add('hidden');
            document.getElementById('multiplayerScoreBoard').classList.remove('hidden');
            
            const oppBoardContainer = document.getElementById('opponentBoardContainer');
            oppBoardContainer.classList.remove('hidden');
            oppBoardContainer.classList.add('flex');
            
            if (botJoinTimer) clearTimeout(botJoinTimer);
            hideWaitingOverlay();
            oyunuBaslat();
            
            // Eğer Bot oyunuysa, botun hamlelerini başlat
            if (isBotMatch || data.p2DocId === 'BOT_PLAYER' || data.p1DocId === 'BOT_PLAYER') {
                isBotMatch = true;
                botGuesses = 0;
                if (botPlayInterval) clearInterval(botPlayInterval);
                
                // Bot playerRole'a göre karşı taraf
                const botRolePrefix = playerRole === 'player1' ? 'p2' : 'p1';
                
                botPlayInterval = setInterval(() => {
                    window.getDoc(roomRef).then((snap) => {
                        if(snap.exists() && snap.data().status === 'active' && snap.data().currentRound === currentMultiRound) {
                            // Kontrol et bot bitirmiş mi?
                            if (snap.data()[botRolePrefix + 'Status'] !== 'finished') {
                                simulateBotTurn(roomRef, botRolePrefix, snap.data(), currentMultiRound);
                            } else {
                                clearInterval(botPlayInterval);
                            }
                        }
                    });
                }, Math.floor(Math.random() * 4000) + 6000); // 6-10 saniye arası
            }
        }

        if (playerRole === 'player1' && data.status === 'active' && data.p1Status === 'finished' && data.p2Status === 'finished') {
            if (data.currentRound < data.rounds) {
                window.updateDoc(roomRef, {
                    currentRound: data.currentRound + 1,
                    p1Status: 'playing', p2Status: 'playing',
                    p1Guesses: [], p2Guesses: []
                });
            } else {
                
                // MULTIPLAYER MAÇ BİTİŞ KONTROLÜ - KAZANMA/KAYBETME YAZDIRMA İŞLEMİ (SADECE P1 YAPIYOR)
                let p1Wins = false;
                let p2Wins = false;
                
                if (data.p1Score > data.p2Score) p1Wins = true;
                else if (data.p2Score > data.p1Score) p2Wins = true;

                if (p1Wins && data.p1DocId) {
                    window.updateDoc(window.doc(window.db, "scores", data.p1DocId), { wins: window.increment(1) });
                    if (data.p2DocId) window.updateDoc(window.doc(window.db, "scores", data.p2DocId), { losses: window.increment(1) });
                } else if (p2Wins && data.p2DocId) {
                    window.updateDoc(window.doc(window.db, "scores", data.p2DocId), { wins: window.increment(1) });
                    if (data.p1DocId) window.updateDoc(window.doc(window.db, "scores", data.p1DocId), { losses: window.increment(1) });
                }
                
                window.updateDoc(roomRef, { status: 'game_over' });
            }
        }

        if (data.status === 'game_over') { 
            if (botPlayInterval) clearInterval(botPlayInterval);
            showMultiplayerResult(data); 
        }
    });
}

function renderOpponentBoard(guesses) {
    const oppBoard = document.getElementById('opponentBoard');
    if(!oppBoard) return;
    
    oppBoard.className = "flex justify-center w-full transition-all duration-300";
    oppBoard.innerHTML = '';
    
    if (!guesses || guesses.length === 0) {
        oppBoard.innerHTML = '<span class="text-xs text-gray-500 font-bold animate-pulse">İlk tahmin bekleniyor...</span>';
        return;
    }

    const currentGuessNumber = guesses.length;
    const lastGuessStr = guesses[currentGuessNumber - 1];
    const rowColors = lastGuessStr.split('-'); 
    
    const rowDiv = document.createElement('div');
    rowDiv.className = "flex items-center gap-3 bg-gray-900/80 px-4 py-2 rounded-full border border-gray-700 shadow-lg";
    
    const label = document.createElement('span');
    label.className = "text-xs font-bold text-gray-400 tracking-wider uppercase";
    label.innerText = `Tahmin ${currentGuessNumber}:`;
    rowDiv.appendChild(label);

    const boxesDiv = document.createElement('div');
    boxesDiv.className = "flex gap-1.5";

    rowColors.forEach(color => {
        const box = document.createElement('div');
        box.className = "w-4 h-4 sm:w-5 sm:h-5 rounded-sm transition-all duration-300 transform scale-100";
        if (color === 'correct') box.className += " bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]";
        else if (color === 'partial') box.className += " bg-yellow-500";
        else box.className += " bg-gray-700";
        boxesDiv.appendChild(box);
    });
    
    rowDiv.appendChild(boxesDiv);
    oppBoard.appendChild(rowDiv);
}

function showWaitingOverlay(msg) {
    let el = document.getElementById('waitOverlay');
    if(!el) {
        el = document.createElement('div');
        el.id = 'waitOverlay';
        el.className = 'fixed inset-0 z-[150] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md text-white font-black text-2xl text-center px-4';
        document.body.appendChild(el);
    }
    el.innerHTML = `<i class="fa-solid fa-futbol animate-bounce text-6xl text-blue-500 mb-6 shadow-[0_0_20px_rgba(59,130,246,0.5)] rounded-full"></i><p>${msg}</p>`;
    el.style.display = 'flex';
}

function hideWaitingOverlay() {
    const el = document.getElementById('waitOverlay');
    if(el) el.style.display = 'none';
}

function showMultiplayerResult(data) {
    hideWaitingOverlay();
    document.getElementById('opponentBoardContainer').classList.remove('flex');
    document.getElementById('opponentBoardContainer').classList.add('hidden');
    if(roomUnsubscribe) roomUnsubscribe(); 
    
    const myFinalScore = playerRole === 'player1' ? data.p1Score : data.p2Score;
    const oppFinalScore = playerRole === 'player1' ? data.p2Score : data.p1Score;

    let titleStr, colorClass;
    if (myFinalScore > oppFinalScore) { 
        titleStr = "🏆 KAZANDIN!"; 
        colorClass = "text-green-500"; 
        if(window.playSound) window.playSound('success'); 
    } 
    else if (myFinalScore < oppFinalScore) { 
        titleStr = "❌ KAYBETTİN!"; 
        colorClass = "text-red-500"; 
        if(window.playSound) window.playSound('wrong'); 
    } 
    else { 
        titleStr = "🤝 BERABERE!"; 
        colorClass = "text-yellow-500"; 
    }

    const modal = document.getElementById('endModal');
    const content = document.getElementById('modalContent');
    
    content.innerHTML = `
        <h2 class="text-4xl font-black mb-4 ${colorClass}">${titleStr}</h2>
        <div class="flex justify-around items-center bg-gray-800 p-6 rounded-2xl mb-6 border border-gray-700">
            <div class="text-center">
                <p class="text-gray-400 text-xs mb-1">SEN</p>
                <p class="text-4xl font-bold text-white">${myFinalScore}</p>
            </div>
            <div class="text-2xl text-gray-600 font-black">VS</div>
            <div class="text-center">
                <p class="text-gray-400 text-xs mb-1">RAKİP</p>
                <p class="text-4xl font-bold text-white">${oppFinalScore}</p>
            </div>
        </div>
        <button onclick="location.href='index.html'" class="w-full bg-white text-black font-black py-4 rounded-xl hover:bg-gray-200 shadow-lg">ANA MENÜYE DÖN</button>
    `;
    modal.classList.remove('hidden');
}

// --- 7. OYUN MOTORU ---
function resetBoard() {
    document.getElementById('gameBoard').innerHTML = '';
    denemeSayisi = 0;
    oyunBitti = false;
    myGuesses = []; 
    hakGosterge.innerText = maxHak;
    input.disabled = false;
    submitBtn.disabled = false;
    input.value = '';
    input.focus();
    autocompleteList.innerHTML = '';
    autocompleteList.classList.add('hidden');
    
    bonusKazanilanlar = { uyruk: false, lig: false, takim: false, pozisyon: false, yas: false };
    buTurKazanilanPuan = 0;
}

// --- 7. OYUN MOTORU (GÜNCELLENMİŞ BAŞLATMA MANTIĞI) ---
async function oyunuBaslat() {
    resetBoard(); 

    if (isMultiplayer) {
        const targetName = multiTargets[currentMultiRound - 1];
        hedefOyuncu = oyuncular.find(p => p.isim === targetName) || oyuncular[0];
        return;
    }

    if (!window.db) { setTimeout(oyunuBaslat, 100); return; }
    
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`; 

    // YENİ: Sadece "kolay" zorluktaki oyuncuları filtrele (büyük/küçük harf duyarsız)
    let kolayOyuncular = oyuncular.filter(p => p.zorluk && p.zorluk.toLowerCase() === "kolay");
    
    // Güvenlik: Eğer JSON dosyasında hiç "kolay" oyuncu yoksa sistem çökmesin diye tümünü al
    if (kolayOyuncular.length === 0) {
        console.warn("Dikkat: JSON'da 'kolay' zorluğunda oyuncu bulunamadı! Tüm liste kullanılıyor.");
        kolayOyuncular = oyuncular;
    }

    try {
        const docRef = window.doc(window.db, "daily_footle", dateString);
        const docSnap = await window.getDoc(docRef);

        if (docSnap.exists()) {
            // Bugünün oyuncusu zaten seçilmişse onu getir
            const targetName = docSnap.data().player;
            hedefOyuncu = oyuncular.find(p => p.isim === targetName) || kolayOyuncular[0];
        } else {
            // Bugünün oyuncusu henüz seçilmemişse "KOLAY" listesinden rastgele seç ve kaydet
            const seed = year * 10000 + (today.getMonth() + 1) * 100 + today.getDate() + 99;
            let m = kolayOyuncular.length;
            const random = () => { var x = Math.sin(seed) * 10000; return x - Math.floor(x); };
            const randomIndex = Math.floor(random() * m);
            
            hedefOyuncu = kolayOyuncular[randomIndex];

            await window.setDoc(docRef, { player: hedefOyuncu.isim, createdAt: new Date() });
        }
    } catch (error) {
        console.error("Firebase'e erişilirken veya yazılırken hata oluştu:", error);
        // Çevrimdışı/Yetki hatası: Firebase'e yazılamasa bile günün oyuncusu herkes için aynı kalsın diye seed ile seç
        const seed = year * 10000 + (today.getMonth() + 1) * 100 + today.getDate() + 99;
        let m = kolayOyuncular.length;
        const random = () => { var x = Math.sin(seed) * 10000; return x - Math.floor(x); };
        const randomIndex = Math.floor(random() * m);
        hedefOyuncu = kolayOyuncular[randomIndex];
    }
}

input.addEventListener('input', function() {
    const val = this.value.trim().toLowerCase();
    autocompleteList.innerHTML = '';
    if (!val || oyunBitti) { autocompleteList.classList.add('hidden'); return; }

    const matches = oyuncular.filter(o => o.isim.toLowerCase().includes(val)).slice(0, 5);
    if (matches.length > 0) {
        autocompleteList.classList.remove('hidden');
        matches.forEach(m => {
            const item = document.createElement('div');
            item.className = "p-3 hover:bg-blue-900/50 cursor-pointer border-b border-gray-700 last:border-0 text-white font-semibold";
            item.innerText = m.isim;
            item.onclick = () => {
                input.value = m.isim;
                autocompleteList.classList.add('hidden');
                tahminYap();
            };
            autocompleteList.appendChild(item);
        });
    } else { autocompleteList.classList.add('hidden'); }
});

document.getElementById('submitBtn').addEventListener('click', tahminYap);
input.addEventListener('keypress', function(e) {
    if(e.key === 'Enter') tahminYap();
});

function tahminYap() {
    if (oyunBitti) return;
    const isim = input.value.trim();
    const tahmin = oyuncular.find(o => o.isim.toLowerCase() === isim.toLowerCase());
    if (!tahmin) { alert("Lütfen listeden geçerli bir oyuncu seçin!"); return; }

    const hint = document.getElementById('first-guess-hint');
    if (hint && !hint.classList.contains('hidden')) {
        hint.classList.replace('opacity-40', 'opacity-0'); 
        setTimeout(() => hint.classList.add('hidden'), 700); 
    }

    denemeSayisi++;
    hakGosterge.innerText = maxHak - denemeSayisi;
    input.value = "";
    autocompleteList.classList.add('hidden');
    satirEkle(tahmin);

    if (tahmin.isim === hedefOyuncu.isim) {
        setTimeout(() => bitir(true), 2500); 
    } else if (denemeSayisi >= maxHak) {
        setTimeout(() => bitir(false), 2500);
    }
}

function satirEkle(tahmin) {
    const board = document.getElementById('gameBoard');
    const row = document.createElement('div');
    row.className = "grid grid-cols-5 gap-2 h-14 sm:h-16 w-full"; 
    
    const kriterler = [
        { id: 'uyruk', val: tahmin.uyruk, target: hedefOyuncu.uyruk, type: 'text', puan: 50 },
        { id: 'lig', val: tahmin.lig, target: hedefOyuncu.lig, type: 'text', puan: 25 },
        { id: 'takim', val: tahmin.takim, target: hedefOyuncu.takim, type: 'text', puan: 50 },
        { id: 'pozisyon', val: tahmin.pozisyon, target: hedefOyuncu.pozisyon, type: 'text', puan: 25 },
        { id: 'yas', val: tahmin.yas, target: hedefOyuncu.yas, type: 'number', puan: 25 }
    ];

    let currentGuessColors = []; 
    let kazanilanEkstraPuan = 0; 
    
    const eklenecekPuanlar = kriterler.map(k => {
        if (k.val === k.target && isMultiplayer && !bonusKazanilanlar[k.id]) {
            bonusKazanilanlar[k.id] = true;
            kazanilanEkstraPuan += k.puan;
            return k.puan; 
        }
        return 0;
    });

    kriterler.forEach((k, i) => {
        const card = document.createElement('div');
        card.className = "flip-card h-full w-full relative"; 
        
        let renk = "wrong";
        if (k.val === k.target) renk = "correct";
        else if (k.type === 'number') renk = "partial"; 

        currentGuessColors.push(renk); 

        let icerik = k.val;
        if (k.type === 'number' && k.val !== k.target) {
            icerik += k.val < k.target ? ' ↑' : ' ↓';
        }

        card.innerHTML = `
            <div class="flip-inner h-full w-full">
                <div class="flip-front"></div>
                <div class="flip-back ${renk} font-bold text-[10px] sm:text-xs">${icerik}</div>
            </div>`;
        row.appendChild(card);

        // KART DÖNME ANİMASYONU VE SES TETİKLEYİCİSİ
        setTimeout(() => { 
            card.classList.add('flipped'); 
            card.style.opacity = "1"; 
            
            // YENİ SES MANTIĞI: Eğer doğruysa (yeşil) success, değilse flip çal!
            if(window.playSound) {
                if (renk === 'correct') {
                    window.playSound('success');
                } else {
                    window.playSound('flip');
                }
            }

            const kazanilan = eklenecekPuanlar[i];
            if (kazanilan > 0) {
                myScore += kazanilan;
                buTurKazanilanPuan += kazanilan;
                const scoreEl = document.getElementById('myScore');
                if(scoreEl) {
                    scoreEl.innerText = myScore;
                    scoreEl.classList.add('text-green-400', 'scale-150', 'drop-shadow-[0_0_10px_rgba(34,197,94,1)]', 'inline-block', 'transition-all', 'duration-300');
                    setTimeout(() => scoreEl.classList.remove('text-green-400', 'scale-150', 'drop-shadow-[0_0_10px_rgba(34,197,94,1)]'), 400);
                }

                const floatingText = document.createElement('div');
                floatingText.innerText = `+${kazanilan}`;
                floatingText.className = "absolute -top-4 left-1/2 transform -translate-x-1/2 text-green-400 font-black text-2xl sm:text-3xl z-[100] drop-shadow-[0_0_12px_rgba(0,0,0,1)] pointer-events-none transition-all duration-1000 ease-out opacity-100";
                
                card.appendChild(floatingText);

                setTimeout(() => floatingText.classList.replace('-top-4', '-top-24'), 50);
                setTimeout(() => floatingText.classList.replace('opacity-100', 'opacity-0'), 1200);
                setTimeout(() => floatingText.remove(), 2500);
            }
        }, i * 300); 
    });

    board.appendChild(row);
    setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);

    if (isMultiplayer) {
        myGuesses.push(currentGuessColors.join('-'));
        
        setTimeout(() => {
            const roomRef = window.doc(window.db, "footle_rooms", roomId);
            const updateData = {};
            const prefix = playerRole === 'player1' ? 'p1' : 'p2';
            
            updateData[prefix + 'Guesses'] = myGuesses; 
            if (kazanilanEkstraPuan > 0) {
                updateData[prefix + 'Score'] = myScore;
            }

            window.updateDoc(roomRef, updateData).catch(e => console.error("Firebase Hatası:", e));
        }, kriterler.length * 300); 
    }
}

// --- 8. OYUN BİTİŞ MANTIĞI ---
function bitir(kazandi) {
    oyunBitti = true;
    input.disabled = true;
    submitBtn.disabled = true;

    if (!isMultiplayer) {
        localStorage.setItem('footle_daily_last_played', new Date().toDateString());
    }

    if (isMultiplayer) {
        const temelPuan = kazandi ? (8 - denemeSayisi) * 100 : 0;
        myScore += temelPuan; 
        buTurKazanilanPuan += temelPuan; 
        
        const roomRef = window.doc(window.db, "footle_rooms", roomId);
        const updateData = {};
        if (playerRole === 'player1') {
            updateData.p1Score = myScore;
            updateData.p1Status = 'finished';
        } else {
            updateData.p2Score = myScore;
            updateData.p2Status = 'finished';
        }
        window.updateDoc(roomRef, updateData); 

        let waitMsg = `RAKİBİN BİTİRMESİ BEKLENİYOR...<br><span class='text-sm text-green-400 font-normal mt-2 block'>Bu turdan toplam +${buTurKazanilanPuan} Puan aldın.</span>`;
        
        if (!kazandi) {
            if(window.playSound) window.playSound('wrong'); 
            waitMsg += `
            <div class="mt-8 bg-red-900/40 border-2 border-red-500/50 p-4 rounded-xl inline-block min-w-[250px] shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                <p class="text-xs text-red-400 font-black mb-1 tracking-widest">BULAMADIN! DOĞRU CEVAP:</p>
                <p class="text-2xl font-black text-white">${hedefOyuncu.isim.toUpperCase()}</p>
                <p class="text-xs text-gray-400 mt-2">${hedefOyuncu.takim} • ${hedefOyuncu.uyruk}</p>
            </div>`;
        } else {
            if(window.playSound) window.playSound('success'); 
            waitMsg += `
            <div class="mt-8 bg-green-900/40 border border-green-500/50 p-4 rounded-xl inline-block min-w-[250px]">
                <p class="text-xs text-green-400 font-bold mb-1 tracking-widest">TEBRİKLER, BİLDİN!</p>
                <p class="text-2xl font-black text-white">${hedefOyuncu.isim.toUpperCase()}</p>
            </div>`;
        }

        showWaitingOverlay(waitMsg);
        return; 
    }

    // TEK OYUNCULU MOD İÇİN OYUN BİTİŞİ EKRANI
    const modal = document.getElementById('endModal');
    const content = document.getElementById('modalContent');
    const emoji = document.getElementById('modalEmoji');
    const title = document.getElementById('modalTitle');
    const desc = document.getElementById('modalDescription');
    
    const targetName = document.getElementById('targetPlayerName');
    const correctPlayerContainer = document.getElementById('correctPlayerContainer');
    const correctPlayerLabel = document.getElementById('correctPlayerLabel');
    const targetPlayerDetails = document.getElementById('targetPlayerDetails');

    if(targetName) targetName.innerText = hedefOyuncu.isim.toUpperCase();
    if(targetPlayerDetails) {
        targetPlayerDetails.innerHTML = `
            <span class="bg-black/50 border border-gray-600 px-2 py-1 rounded-md">${hedefOyuncu.uyruk}</span>
            <span class="bg-black/50 border border-gray-600 px-2 py-1 rounded-md">${hedefOyuncu.takim}</span>
            <span class="bg-black/50 border border-gray-600 px-2 py-1 rounded-md">${hedefOyuncu.pozisyon}</span>
        `;
    }

    if (kazandi) {
        if(window.playSound) window.playSound('success'); 
        
        // YENİ PUANLAMA MANTIĞI: Kalan Hakka Göre Puan
        // denemeSayisi = kaçıncı tahminde bildiği.
        // Toplam 7 hak var.
        // Örn: 1. tahminde bilirse (7 - 1 + 1) * 100 = 700 Puan
        // Örn: 7. tahminde bilirse (7 - 7 + 1) * 100 = 100 Puan
        const kalanHak = 7 - denemeSayisi + 1;
        const kazanilanPuan = kalanHak * 100;

        if(content) {
            content.classList.remove('border-red-500');
            content.classList.add('border-green-500');
        }
        
        if(emoji) emoji.innerText = "🏆";
        if(title) {
            title.innerText = "TEBRİKLER!";
            title.className = "text-3xl font-black mb-2 tracking-tighter text-green-400";
        }
        if(desc) desc.innerText = `${denemeSayisi}. denemede doğru bildin. Kalan Hak: ${kalanHak} (+${kazanilanPuan} P)`;

        if(correctPlayerContainer) correctPlayerContainer.className = "bg-green-900/20 p-4 rounded-2xl mb-6 border border-green-500/30";
        if(correctPlayerLabel) {
            correctPlayerLabel.innerText = "GİZLİ OYUNCU";
            correctPlayerLabel.className = "text-xs text-green-500 font-bold tracking-widest uppercase mb-1";
        }

        if(window.saveScoreToFirebase) {
            setTimeout(() => window.saveScoreToFirebase(kazanilanPuan, "Footle"), 1000);
        }

    } else {
        if(window.playSound) window.playSound('wrong'); 
        if(content) {
            content.classList.remove('border-green-500');
            content.classList.add('border-red-500');
        }
        
        if(emoji) emoji.innerText = "❌";
        if(title) {
            title.innerText = "MAÇ BİTTİ";
            title.className = "text-3xl font-black mb-2 tracking-tighter text-red-500";
        }
        if(desc) desc.innerText = "Hakların tükendi. Yarın tekrar dene!";
        
        if(correctPlayerContainer) correctPlayerContainer.className = "bg-red-900/30 p-4 rounded-2xl mb-6 border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]";
        if(correctPlayerLabel) {
            correctPlayerLabel.innerText = "DOĞRU CEVAP NEYDİ?";
            correctPlayerLabel.className = "text-xs text-red-400 font-black tracking-widest uppercase mb-1";
        }
    }

    if(modal) modal.classList.remove('hidden');
}

// --- HÜKMEN GALİBİYET / İPTAL İÇİN ÖZEL EKRAN ---
function showCustomEndModal(emojiIcon, titleText, descText, type) {
    const modal = document.getElementById('endModal');
    const content = document.getElementById('modalContent');
    const emoji = document.getElementById('modalEmoji');
    const title = document.getElementById('modalTitle');
    const desc = document.getElementById('modalDescription');
    const correctPlayerContainer = document.getElementById('correctPlayerContainer');
    const footerBtn = document.querySelector('#endModal button');

    if(content) {
        content.classList.remove('border-red-500', 'border-green-500');
        content.classList.add(type === 'success' ? 'border-green-500' : 'border-red-500');
    }
    
    if(emoji) emoji.innerText = emojiIcon;
    if(title) {
        title.innerText = titleText;
        title.className = `text-3xl font-black mb-2 tracking-tighter ${type === 'success' ? 'text-green-400' : 'text-yellow-400'}`;
    }
    if(desc) desc.innerText = descText;
    
    // Futbolcu bilgisini gizle (Hükmen durumda gerek yok)
    if(correctPlayerContainer) correctPlayerContainer.style.display = 'none';

    if(modal) modal.classList.remove('hidden');
    
    // Sonraki Oyna butonunu Lobiye Dön yapsın
    if(footerBtn) {
        footerBtn.innerText = "LOBİYE DÖN";
        footerBtn.onclick = () => window.location.href = "index.html";
    }
}