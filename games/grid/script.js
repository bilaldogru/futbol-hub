// --- BİLDİRİM SİSTEMİ (TOAST) ---
window.showToast = function(msg, type = 'error') {
    const toast = document.getElementById('customToast');
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
    } else {
        toast.classList.add('bg-blue-900/90', 'border-blue-500', 'shadow-[0_0_30px_rgba(59,130,246,0.4)]');
        toastIcon.className = "fa-solid fa-info-circle text-blue-400 text-2xl";
    }

    toast.classList.remove('opacity-0', '-translate-y-24');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', '-translate-y-24');
    }, 3000);
}

// --- GLOBAL DEĞİŞKENLER ---
let countryCodes = {};
let teamLogos = {};
let currentUser = null;
let userFirebaseDocId = null;
let currentRoomId = null;
let playerNum = 0; 
let playerRole = null;
let allPlayers = [];
let currentSelectedCell = null;
let timerInterval = null;
let timeLeft = 30;

// LOBİ DEĞİŞKENLERİ
let lobbyUnsubscribe = null; 
let roomUnsubscribe = null;
let roomExpireTimer = null; 

// --- ÇIKIŞ VE TEMİZLİK ---
window.leaveGame = async function() {
    if (currentRoomId && playerNum !== 0) {
        try {
            await window.updateDoc(window.doc(window.db, "grid_rooms", currentRoomId), {
                abandonedBy: playerNum
            });
        } catch(e) {}
    }
    window.location.href = "../../index.html";
}

window.addEventListener('beforeunload', (e) => {
    if (currentRoomId && playerNum !== 0 && document.getElementById('game-main-container').classList.contains('flex')) {
        window.updateDoc(window.doc(window.db, "grid_rooms", currentRoomId), { abandonedBy: playerNum });
    }
    else if (playerNum === 1 && currentRoomId) {
        window.deleteDoc(window.doc(window.db, "grid_rooms", currentRoomId));
    }
});

// --- BAŞLANGIÇ ---
document.addEventListener('DOMContentLoaded', () => {
    const userStr = localStorage.getItem('firebaseUser');
    if (!userStr) {
        alert("Oynamak için Ana Sayfadan GİRİŞ yapmalısın!");
        window.location.href = "../../index.html"; 
        return;
    }
    currentUser = JSON.parse(userStr);

    Promise.all([
        fetch('../../oyuncular.json').then(res => res.json()),
        fetch('../../logolar.json').then(res => res.json())
    ]).then(([oyuncularData, logolarData]) => {
        allPlayers = oyuncularData;
        countryCodes = logolarData.ulkeler;
        teamLogos = logolarData.takimlar;
        
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        if (!roomId) {
            window.fetchLobbyRooms();
        }
    }).catch(err => {
        showToast("Veri bağlantı hatası!", "error");
    });

    // LİNK İLE GELENLER VE ÖZEL DAVET EKRANI
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');

    if (roomId) {
        document.getElementById('lobbyModal').classList.add('hidden');
        document.getElementById('multiplayerSetupModal').classList.add('hidden');
        
        currentRoomId = roomId;
        playerNum = 2;
        
        document.getElementById('waitText').innerText = "ODAYA BAĞLANILIYOR...";
        document.getElementById('waitOverlay').classList.remove('hidden');
        document.getElementById('waitOverlay').classList.add('flex');
        
        setTimeout(async() => {
            if(!window.db) return;
            try {
                const docSnap = await window.getDoc(window.doc(window.db, "grid_rooms", roomId));
                if(docSnap.exists()){
                    const data = docSnap.data();
                    const bet = data.bet;
                    const p1Name = data.p1;
                    
                    document.getElementById('waitOverlay').classList.add('hidden');
                    document.getElementById('waitOverlay').classList.remove('flex');
                    
                    document.getElementById('invite-prize').innerText = bet * 2;
                    document.getElementById('invite-challenger-name').innerText = `${p1Name} seni maça davet ediyor!`;
                    document.getElementById('inviteModal').classList.remove('hidden');
                    
                    document.getElementById('acceptInviteBtn').onclick = () => {
                        document.getElementById('inviteModal').classList.add('hidden');
                        window.joinRoomByButton(roomId);
                    };
                } else {
                    alert("Oda bulunamadı veya süresi dolmuş.");
                    window.location.href = "../../index.html";
                }
            } catch (e) {
                alert("Bağlantı hatası.");
                window.location.href = "../../index.html";
            }
        }, 1500);
    } else {
        playerNum = 1;
    }
});

// --- LOBİ YÖNETİMİ ---
window.showMultiplayerSetup = function() {
    if(lobbyUnsubscribe) lobbyUnsubscribe(); 
    document.getElementById('lobbyModal').classList.add('hidden');
    document.getElementById('multiplayerSetupModal').classList.remove('hidden');
    
    document.getElementById('setupControls').classList.remove('hidden');
    document.getElementById('linkArea').classList.add('hidden');
};

window.backToLobby = async function() {
    try {
        if (roomExpireTimer) clearTimeout(roomExpireTimer);

        if (playerRole === 'player1' && currentRoomId) {
            const docSnap = await window.getDoc(window.doc(window.db, "grid_rooms", currentRoomId));
            if(docSnap.exists()){
                const betAmount = docSnap.data().bet;
                if(userFirebaseDocId) {
                    await window.updateDoc(window.doc(window.db, "scores", userFirebaseDocId), { 
                        score: window.increment(betAmount) 
                    });
                }
            }
            await window.deleteDoc(window.doc(window.db, "grid_rooms", currentRoomId));
        }
    } catch(e) { 
        console.error("Geri çıkma/İptal işlemi hatası:", e); 
    } finally {
        currentRoomId = null;
        playerRole = null;
        if(roomUnsubscribe) roomUnsubscribe();

        const setupModal = document.getElementById('multiplayerSetupModal');
        const lobbyModal = document.getElementById('lobbyModal');
        const linkArea = document.getElementById('linkArea');
        const setupControls = document.getElementById('setupControls');
        
        if (setupModal) setupModal.classList.add('hidden');
        if (lobbyModal) lobbyModal.classList.remove('hidden');
        if (setupControls) setupControls.classList.remove('hidden');
        if (linkArea) linkArea.classList.add('hidden');

        if (typeof window.fetchLobbyRooms === 'function') {
            window.fetchLobbyRooms();
        }
    }
};

window.fetchLobbyRooms = function() {
    if(!window.db) return;
    
    const roomsRef = window.collection(window.db, "grid_rooms");
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
                    <p class="text-xs text-fuchsia-400">Bahis: ${data.bet} Puan</p>
                </div>
                <button onclick="joinRoomByButton('${roomId}')" class="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold px-4 py-2 rounded transition shadow-lg">KATIL</button>
            `;
            roomList.appendChild(roomItem);
        });

        if(validRoomCount === 0) {
            roomList.innerHTML = '<p class="text-gray-500 text-sm text-center mt-4">Şu an açık oda yok. Yeni bir tane kur!</p>';
        }
    });
};

// --- PUAN DÜŞME ---
async function handleBetTransaction(betAmount) {
    const q = window.query(window.collection(window.db, "scores"), window.where("email", "==", currentUser.email));
    const qs = await window.getDocs(q);
    
    let userDocRef;
    let currentScore = 0;

    if (qs.empty) {
        const newDoc = await window.addDoc(window.collection(window.db, "scores"), {
            name: currentUser.name, email: currentUser.email, photo: currentUser.photo || "", score: 0
        });
        userDocRef = window.doc(window.db, "scores", newDoc.id);
    } else {
        userDocRef = window.doc(window.db, "scores", qs.docs[0].id);
        currentScore = qs.docs[0].data().score;
    }

    userFirebaseDocId = userDocRef.id;

    if (currentScore < betAmount) {
        showToast(`Yetersiz Puan! (Mevcut Puanın: ${currentScore})`, "error");
        return null;
    }

    await window.updateDoc(userDocRef, { score: window.increment(-betAmount) });
    return userDocRef;
}

// --- GRID ALGORİTMASI ---
function generateBestGrid() {
    let validTeams = Object.keys(teamLogos);
    let validNations = Object.keys(countryCodes);

    let availablePairs = new Set();
    allPlayers.forEach(p => {
        if (validTeams.includes(p.takim) && validNations.includes(p.uyruk)) {
            availablePairs.add(`${p.takim}-${p.uyruk}`);
        }
    });

    let dbTeams = [...new Set(allPlayers.map(p => p.takim))].filter(t => validTeams.includes(t));
    let dbNations = [...new Set(allPlayers.map(p => p.uyruk))].filter(n => validNations.includes(n));

    let bestGrids = [];
    let maxScore = -1;

    const getCombinations = (array, size) => {
        const result = [];
        const f = (prefix, arr) => {
            if (prefix.length === size) { result.push(prefix); return; }
            for (let i = 0; i < arr.length; i++) {
                f([...prefix, arr[i]], arr.slice(i + 1));
            }
        };
        f([], array);
        return result;
    };

    let teamCombs = getCombinations(dbTeams, 3).sort(() => 0.5 - Math.random());
    let nationCombs = getCombinations(dbNations, 3).sort(() => 0.5 - Math.random());

    for (let t of teamCombs) {
        for (let n of nationCombs) {
            let score = 0;
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    if (availablePairs.has(`${t[i]}-${n[j]}`)) score++;
                }
            }

            if (score > maxScore) {
                maxScore = score;
                bestGrids = [{ teams: t, nations: n }];
            } else if (score === maxScore) {
                bestGrids.push({ teams: t, nations: n });
            }

            if (maxScore === 9 && bestGrids.length > 5) break;
        }
        if (maxScore === 9 && bestGrids.length > 5) break;
    }

    let chosen = bestGrids[Math.floor(Math.random() * bestGrids.length)];
    chosen.teams = chosen.teams.sort(() => 0.5 - Math.random());
    chosen.nations = chosen.nations.sort(() => 0.5 - Math.random());

    return chosen;
}

// --- ODA OLUŞTURMA VE KATILMA ---
window.confirmAndCreateRoom = async () => {
    try {
        if (!window.db) return showToast("Bağlantı Bekleniyor...", "error");

        const inputEl = document.getElementById('bet-amount');
        let finalBet = parseInt(inputEl.value);

        if (!finalBet || isNaN(finalBet) || finalBet <= 0) {
            return showToast("Lütfen geçerli bir bahis miktarı girin!", "error");
        }
        
        const isPrivate = document.getElementById('privateRoomCheck').checked;

        document.getElementById('waitText').innerText = "ODA KURULUYOR...";
        document.getElementById('waitOverlay').classList.remove('hidden');
        document.getElementById('waitOverlay').classList.add('flex');

        const userDocRef = await handleBetTransaction(finalBet);
        if (!userDocRef) {
            document.getElementById('waitOverlay').classList.add('hidden');
            document.getElementById('waitOverlay').classList.remove('flex');
            return; 
        }

        const bestGrid = generateBestGrid();
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const nowMs = new Date().getTime();
        
        await window.setDoc(window.doc(window.db, "grid_rooms", roomId), {
            bet: finalBet,
            isPrivate: isPrivate,
            p1: currentUser.name,
            p1DocId: userDocRef.id,
            p2: null,
            p2DocId: null,
            p1Wins: 0, 
            p2Wins: 0, 
            currentRound: 1, 
            matchWinner: null, 
            turn: 1,
            gridState: [0, 0, 0, 0, 0, 0, 0, 0, 0], 
            gridDetails: ["", "", "", "", "", "", "", "", ""], 
            cols: bestGrid.teams,
            rows: bestGrid.nations,
            moveHistory: [], 
            status: 'waiting_for_p2',
            createdAtMs: nowMs
        });

        currentRoomId = roomId;
        playerRole = 'player1';
        playerNum = 1;

        roomExpireTimer = setTimeout(async () => {
            if (currentRoomId && playerRole === 'player1') {
                try {
                    await window.deleteDoc(window.doc(window.db, "grid_rooms", currentRoomId));
                    alert("5 dakika boyunca kimse katılmadığı için oda iptal edildi. Puanın iade edildi.");
                    await window.updateDoc(userDocRef, { score: window.increment(finalBet) });
                    window.backToLobby(); 
                } catch(e) {}
            }
        }, 300000);

        document.getElementById('setupControls').classList.add('hidden');
        const linkStr = window.location.origin + window.location.pathname + "?room=" + roomId;
        document.getElementById('inviteLink').value = linkStr;
        document.getElementById('linkArea').classList.remove('hidden');
        
        document.getElementById('waitOverlay').classList.add('hidden');
        document.getElementById('waitOverlay').classList.remove('flex');

        listenToRoom(roomId);

    } catch (error) {
        showToast("Bir hata oluştu: " + error.message, "error");
        document.getElementById('waitOverlay').classList.add('hidden');
        document.getElementById('waitOverlay').classList.remove('flex');
    }
};

window.copyInviteLink = function() {
    const linkInput = document.getElementById('inviteLink');
    const copyIcon = document.getElementById('copyIcon');
    const copyTooltip = document.getElementById('copyTooltip');
    const copyBtn = document.getElementById('copyBtn');

    linkInput.select(); 
    linkInput.setSelectionRange(0, 99999); 
    
    navigator.clipboard.writeText(linkInput.value).then(() => {
        copyIcon.classList.replace('fa-copy', 'fa-check');
        copyIcon.classList.add('text-white');
        copyBtn.classList.replace('bg-gray-800', 'bg-fuchsia-900/50');
        copyBtn.classList.add('border', 'border-fuchsia-500');
        copyTooltip.classList.remove('opacity-0', 'translate-y-2');
        copyTooltip.classList.add('opacity-100', 'translate-y-0');

        setTimeout(() => {
            copyIcon.classList.replace('fa-check', 'fa-copy');
            copyBtn.classList.replace('bg-fuchsia-900/50', 'bg-gray-800');
            copyBtn.classList.remove('border', 'border-fuchsia-500');
            copyTooltip.classList.remove('opacity-100', 'translate-y-0');
            copyTooltip.classList.add('opacity-0', 'translate-y-2');
        }, 2000);
    }).catch(() => document.execCommand("copy"));
};

window.joinRoomByButton = async (roomId) => {
    try {
        if(lobbyUnsubscribe) lobbyUnsubscribe();
        document.getElementById('lobbyModal').classList.add('hidden');
        
        document.getElementById('waitText').innerText = "ODAYA GİRİLİYOR...";
        document.getElementById('waitOverlay').classList.remove('hidden');
        document.getElementById('waitOverlay').classList.add('flex');

        currentRoomId = roomId;
        playerNum = 2;
        playerRole = 'player2';

        const docRef = window.doc(window.db, "grid_rooms", roomId);
        const docSnap = await window.getDoc(docRef);
        
        if (!docSnap.exists() || docSnap.data().status !== 'waiting_for_p2') {
            document.getElementById('waitOverlay').classList.add('hidden');
            return alert("Oda bulunamadı, dolu veya süresi dolmuş!");
        }
        
        const roomData = docSnap.data();
        const userDocRef = await handleBetTransaction(roomData.bet);
        
        if(!userDocRef) {
            document.getElementById('waitOverlay').classList.add('hidden');
            window.location.href = "index.html";
            return;
        }
        
        await window.updateDoc(docRef, { p2: currentUser.name, p2DocId: userDocRef.id, status: 'playing' });
        
        document.getElementById('waitOverlay').classList.add('hidden');
        listenToRoom(roomId);
    } catch (error) {
        showToast("Bir hata oluştu.", "error");
        document.getElementById('waitOverlay').classList.add('hidden');
    }
};

// --- OYUN İÇİ SENKRONİZASYON VE ÇİZİMLER ---
function listenToRoom(roomId) {
    roomUnsubscribe = window.onSnapshot(window.doc(window.db, "grid_rooms", roomId), (docSnap) => {
        if(!docSnap.exists()) return;
        const data = docSnap.data();

        if (playerRole === 'player1' && data.status === 'playing' && roomExpireTimer) {
            clearTimeout(roomExpireTimer);
        }

        if (data.abandonedBy && !data.matchWinner) {
            if (data.abandonedBy !== playerNum) {
                handleGameEnd(playerNum, data.bet, true);
            }
            return;
        }

        if(data.status === 'playing') {
            const interOverlay = document.getElementById('intermissionOverlay');
            if (interOverlay) {
                interOverlay.classList.add('hidden');
                interOverlay.classList.remove('flex');
            }

            document.getElementById('multiplayerSetupModal').classList.add('hidden');
            document.getElementById('game-main-container').classList.remove('hidden');
            document.getElementById('game-main-container').classList.add('flex');

            const amIP1 = (playerNum === 1);
            document.getElementById('my-name').innerText = amIP1 ? data.p1 : data.p2;
            document.getElementById('opp-name').innerText = amIP1 ? (data.p2 || "Bekleniyor...") : data.p1;

            if(document.getElementById('round-display')) {
                document.getElementById('round-display').innerText = `TUR ${data.currentRound} / 3`;
                document.getElementById('score-p1').innerText = amIP1 ? data.p1Wins : data.p2Wins;
                document.getElementById('score-p2').innerText = amIP1 ? data.p2Wins : data.p1Wins;
            }

            drawHeaders(data.cols, data.rows);
            updateGridVisuals(data.gridState, data.gridDetails);
            updateTurnIndicator(data.turn);
            updateSidebarsHistory(data.moveHistory);

            if(data.matchWinner !== null) {
                handleGameEnd(data.matchWinner, data.bet);
            } else {
                startTimer(data.turn);
            }
        }
        else if (data.status === 'intermission') {
            if (timerInterval) clearInterval(timerInterval); 
            closeSearch();
            showIntermissionScreen(data.lastRoundWinner);

            if (playerNum === 1 && !window.intermissionStarted) {
                window.intermissionStarted = true;
                setTimeout(async () => {
                    window.intermissionStarted = false;
                    let newGrid = generateBestGrid();
                    await window.updateDoc(window.doc(window.db, "grid_rooms", currentRoomId), {
                        currentRound: data.currentRound + 1,
                        gridState: [0,0,0,0,0,0,0,0,0],
                        gridDetails: ["","","","","","","","",""],
                        cols: newGrid.teams,
                        rows: newGrid.nations,
                        moveHistory: [],
                        turn: ((data.currentRound + 1) % 2 === 0) ? 2 : 1,
                        status: 'playing' 
                    });
                }, 10000); 
            }
        }
    });
}

let intermissionInterval = null;
function showIntermissionScreen(lastRoundWinner) {
    const overlay = document.getElementById('intermissionOverlay');
    if(!overlay) return;
    
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');

    const title = document.getElementById('intermissionTitle');
    if (lastRoundWinner === 0) {
        title.innerText = "TUR BERABERE!";
        title.className = "text-5xl md:text-7xl font-black mb-4 text-yellow-500 drop-shadow-lg";
    } else if (lastRoundWinner === playerNum) {
        title.innerText = "TURU KAZANDIN!";
        title.className = "text-5xl md:text-7xl font-black mb-4 text-green-500 drop-shadow-lg";
        if(window.playSound) window.playSound('success'); // TUR KAZANMA SESİ
    } else {
        title.innerText = "TURU KAYBETTİN!";
        title.className = "text-5xl md:text-7xl font-black mb-4 text-red-500 drop-shadow-lg";
        if(window.playSound) window.playSound('wrong'); // TUR KAYBETME SESİ
    }

    let t = 10;
    document.getElementById('intermissionTimer').innerText = t;
    if (intermissionInterval) clearInterval(intermissionInterval);
    intermissionInterval = setInterval(() => {
        t--;
        document.getElementById('intermissionTimer').innerText = t;
        if (t <= 0) clearInterval(intermissionInterval);
    }, 1000);
}

function startTimer(turn) {
    if (timerInterval) clearInterval(timerInterval);

    timeLeft = 30;
    const timerDisplay = document.getElementById('timer-display');
    timerDisplay.innerText = timeLeft;

    timerInterval = setInterval(async () => {
        timeLeft--;
        timerDisplay.innerText = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            closeSearch(); 
            
            if (turn === playerNum) {
                showToast("Süre doldu! Sıra rakibe geçti.", "error");
                if(window.playSound) window.playSound('wrong'); // ZAMAN AŞIMI SESİ EKLENDİ

                const docSnap = await window.getDoc(window.doc(window.db, "grid_rooms", currentRoomId));
                let hist = docSnap.data().moveHistory || [];
                hist.push({ p: playerNum, name: "Zaman Aşımı", team: "-", nation: "-", correct: false });

                const newTurn = (turn === 1) ? 2 : 1;
                await window.updateDoc(window.doc(window.db, "grid_rooms", currentRoomId), { turn: newTurn, moveHistory: hist });
            } else {
                showToast("Rakibin süresi doldu!", "success");
            }
        }
    }, 1000);
}

function drawHeaders(cols, rows) {
    for(let i=0; i<3; i++) {
        let team = cols[i];
        document.getElementById(`col-${i}`).innerHTML = teamLogos[team] 
            ? `<img src="${teamLogos[team]}" class="header-img" title="${team}">` 
            : `<span class="header-text">${team}</span>`;

        let nation = rows[i];
        let natCode = countryCodes[nation];
        document.getElementById(`row-${i}`).innerHTML = natCode 
            ? `<img src="https://flagcdn.com/w80/${natCode}.png" class="header-img shadow-md border border-gray-600 rounded-sm" title="${nation}">` 
            : `<span class="header-text">${nation}</span>`;
    }
}

function updateTurnIndicator(turn) {
    const myBox = document.getElementById('my-box');
    const oppBox = document.getElementById('opp-box');
    const timerDisplay = document.getElementById('timer-display');
    
    if(turn === playerNum) {
        myBox.classList.add('my-active'); 
        oppBox.classList.remove('opp-active');
        document.getElementById('turn-indicator').innerText = "SIRA SENDE!";
        timerDisplay.classList.remove('text-red-500'); timerDisplay.classList.add('text-yellow-400');
    } else {
        oppBox.classList.add('opp-active'); 
        myBox.classList.remove('my-active');
        document.getElementById('turn-indicator').innerText = "RAKİP DÜŞÜNÜYOR";
        timerDisplay.classList.remove('text-yellow-400'); timerDisplay.classList.add('text-red-500');
    }
}

function updateGridVisuals(state, details) {
    for(let r=0; r<3; r++) {
        for(let c=0; c<3; c++) {
            let i = r * 3 + c; 
            let cell = document.getElementById(`cell-${r}-${c}`);
            let owner = state[i];

            cell.className = "cell grid-cell"; 
            
            if (owner === 0) {
                cell.innerHTML = "";
            } else if (owner === playerNum) {
                cell.classList.add('my-cell');
                cell.innerHTML = `<span class="won-icon text-green-500">✔️</span><span class="won-name">${details[i]}</span>`;
            } else {
                cell.classList.add('opp-cell');
                cell.innerHTML = `<span class="won-icon text-red-500">❌</span><span class="won-name">${details[i]}</span>`;
            }
        }
    }
}

function updateSidebarsHistory(moveHistory) {
    const myMovesList = document.getElementById('my-moves-list');
    const oppMovesList = document.getElementById('opp-moves-list');
    
    if(!myMovesList || !oppMovesList) return;

    myMovesList.innerHTML = ''; 
    oppMovesList.innerHTML = '';

    if (!moveHistory) return;

    moveHistory.slice().reverse().forEach(move => {
        const icon = move.correct ? '<span class="text-green-500 font-black">✔️</span>' : '<span class="text-red-500 font-black">❌</span>';
        const borderColor = move.correct ? 'border-green-500/50' : 'border-red-500/50';
        const bgColor = move.correct ? 'bg-green-900/20' : 'bg-red-900/20';

        const itemHtml = `
            <div class="flex items-center justify-between w-full">
                <div class="flex flex-col">
                    <span class="text-white font-bold">${move.name}</span>
                    <span class="text-[10px] text-gray-400">${move.team} - ${move.nation}</span>
                </div>
                <div>${icon}</div>
            </div>
        `;
        
        const div = document.createElement('div');
        div.className = `history-item ${borderColor} ${bgColor} p-2 rounded-xl mb-2 border flex w-full transition-all`;
        div.innerHTML = itemHtml;

        if(move.p === playerNum) myMovesList.appendChild(div);
        else oppMovesList.appendChild(div);
    });
}

window.openSearch = async function(row, col) {
    const docSnap = await window.getDoc(window.doc(window.db, "grid_rooms", currentRoomId));
    const data = docSnap.data();

    if(data.turn !== playerNum) return showToast("Sıra sende değil!", "error");
    
    let index = row * 3 + col; 
    if(data.gridState[index] !== 0) return showToast("Bu kutu zaten dolu!", "error");

    currentSelectedCell = { r: row, c: col, i: index };
    
    const bottomBar = document.getElementById('bottom-search-bar');
    document.getElementById('selected-cell-info').innerText = `${data.cols[col]} & ${data.rows[row]} için oyuncu aranıyor...`;
    bottomBar.classList.remove('translate-y-full');
    bottomBar.classList.add('translate-y-0');
    
    document.getElementById('bottom-player-search').value = '';
    document.getElementById('bottom-search-results').innerHTML = '';
    setTimeout(() => document.getElementById('bottom-player-search').focus(), 100);
}

window.closeSearch = () => {
    const bottomBar = document.getElementById('bottom-search-bar');
    bottomBar.classList.remove('translate-y-0');
    bottomBar.classList.add('translate-y-full');
    document.getElementById('bottom-player-search').blur();
}

window.filterPlayersBottom = function() {
    let query = document.getElementById('bottom-player-search').value.toLowerCase();
    let resultsDiv = document.getElementById('bottom-search-results');
    if(query.length < 2) { resultsDiv.innerHTML = ''; return; }

    let filtered = allPlayers.filter(p => p.isim.toLowerCase().includes(query)).slice(0, 5);
    resultsDiv.innerHTML = '';
    filtered.forEach(p => {
        let div = document.createElement('div');
        div.className = "search-result-item";
        div.innerText = p.isim;
        div.onclick = () => selectPlayer(p);
        resultsDiv.appendChild(div);
    });
}

window.selectPlayer = async function(player) {
    closeSearch();
    
    const docRef = window.doc(window.db, "grid_rooms", currentRoomId);
    const docSnap = await window.getDoc(docRef);
    const data = docSnap.data();

    let r = currentSelectedCell.r;
    let c = currentSelectedCell.c;
    let idx = currentSelectedCell.i; 
    let isCorrect = false;
    
    // TAHMİN KONTROLÜ VE SESLER
    if(player.takim === data.cols[c] && player.uyruk === data.rows[r]) {
        data.gridState[idx] = playerNum;
        data.gridDetails[idx] = player.isim;
        isCorrect = true;
        if(window.playSound) window.playSound('success'); // BİLDİĞİNDE WIN SESİ ÇALAR
        showToast("DOĞRU TAHMİN!", "success");
    } else {
        if(window.playSound) window.playSound('wrong'); // BİLEMEDİĞİNDE LOSE SESİ ÇALAR
        showToast("YANLIŞ TAHMİN! Sıra rakibe geçti.", "error");
    }

    let newMove = {
        p: playerNum,
        name: player.isim,
        team: player.takim, 
        nation: player.uyruk, 
        correct: isCorrect
    };
    data.moveHistory = data.moveHistory || [];
    data.moveHistory.push(newMove);

    if (timerInterval) clearInterval(timerInterval);

    // KAZANMA DURUMLARINI KONTROL ET
    let roundWinner = 0;
    let winLines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(let line of winLines) {
        let a = data.gridState[line[0]];
        let b = data.gridState[line[1]];
        let c = data.gridState[line[2]];
        if (a !== 0 && a === b && a === c) {
            roundWinner = a; break;
        }
    }

    let possibleWin = false;
    for (let line of winLines) {
        let marks = [data.gridState[line[0]], data.gridState[line[1]], data.gridState[line[2]]];
        if (!(marks.includes(1) && marks.includes(2))) {
            possibleWin = true;
            break;
        }
    }
    let isDraw = !data.gridState.includes(0) || !possibleWin;

    if (roundWinner !== 0 || isDraw) {
        if (roundWinner === 1) data.p1Wins++;
        if (roundWinner === 2) data.p2Wins++;

        let matchEnded = false;
        if (data.p1Wins === 2) { data.matchWinner = 1; matchEnded = true; }
        else if (data.p2Wins === 2) { data.matchWinner = 2; matchEnded = true; }
        else if (data.currentRound === 3) {
            if(data.p1Wins > data.p2Wins) data.matchWinner = 1;
            else if(data.p2Wins > data.p1Wins) data.matchWinner = 2;
            else data.matchWinner = 0; 
            matchEnded = true;
        }

        if (!matchEnded) {
            data.status = 'intermission';
            data.lastRoundWinner = roundWinner;
        }

    } else {
        data.turn = (data.turn === 1) ? 2 : 1;
    }

    await window.updateDoc(docRef, data);
}

async function handleGameEnd(winnerNum, bet, isAbandoned = false) {
    if (timerInterval) clearInterval(timerInterval);
    const interOverlay = document.getElementById('intermissionOverlay');
    if(interOverlay) { interOverlay.classList.add('hidden'); interOverlay.classList.remove('flex'); }

    const modal = document.getElementById('endModal');
    const title = document.getElementById('modalTitle');
    const desc = document.getElementById('modalDesc');
    const emoji = document.getElementById('modalEmoji');

    const docSnap = await window.getDoc(window.doc(window.db, "grid_rooms", currentRoomId));
    
    if (isAbandoned) {
        if(window.playSound) window.playSound('success'); // HÜKMEN GALİBİYET SESİ EKLENDİ
        title.innerText = "HÜKMEN KAZANDIN!";
        title.className = "text-4xl font-black mb-2 text-green-400";
        emoji.innerText = "🏃‍♂️💨";
        desc.innerText = `Rakibin korkup kaçtı! Masadaki ${bet * 2} puan senin oldu.`;
        
        const winnerDocId = playerNum === 1 ? docSnap.data().p1DocId : docSnap.data().p2DocId;
        await window.updateDoc(window.doc(window.db, "scores", winnerDocId), { score: window.increment(bet * 2) });
        await window.updateDoc(window.doc(window.db, "grid_rooms", currentRoomId), { matchWinner: playerNum });
    }
    else if (winnerNum === 0) {
        title.innerText = "BERABERE!";
        title.className = "text-4xl font-black mb-2 text-yellow-500";
        emoji.innerText = "🤝";
        desc.innerText = "3 turun sonunda eşitlik bozulmadı! Bahisler iade edildi.";
        await window.updateDoc(window.doc(window.db, "scores", userFirebaseDocId), { score: window.increment(bet) });
    } 
    else if(winnerNum === playerNum) {
        if(window.playSound) window.playSound('success'); // MAÇI KAZANMA SESİ EKLENDİ
        title.innerText = "KAZANDIN!";
        title.className = "text-4xl font-black mb-2 text-green-400";
        emoji.innerText = "🏆";
        desc.innerText = `Muhteşem oynadın! Masadaki ${bet * 2} puan senin oldu.`;
        const winnerDocId = winnerNum === 1 ? docSnap.data().p1DocId : docSnap.data().p2DocId;
        await window.updateDoc(window.doc(window.db, "scores", winnerDocId), { score: window.increment(bet * 2) });
    } 
    else {
        if(window.playSound) window.playSound('wrong'); // MAÇI KAYBETME SESİ EKLENDİ
        title.innerText = "KAYBETTİN!";
        title.className = "text-4xl font-black mb-2 text-red-500";
        emoji.innerText = "💀";
        desc.innerText = `Rakibin daha iyiydi. Ortadaki ${bet * 2} Puanı kaptırdın.`;
    }
    
    modal.classList.remove('hidden');
}