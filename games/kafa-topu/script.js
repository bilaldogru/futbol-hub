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
    }

    toast.classList.remove('opacity-0', '-translate-y-24');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', '-translate-y-24');
    }, 3000);
}

// --- ZORUNLU AVCI FONKSİYON 1: "Bekleniyor..." yazısını sayfada bulup ezer ---
function clearWaitingTexts() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while (node = walker.nextNode()) {
        if (node.nodeValue.trim() === 'Bekleniyor...') {
            node.nodeValue = 'Bağlandı';
            if (node.parentElement) {
                node.parentElement.classList.remove('text-red-500', 'text-gray-400', 'text-gray-500');
                node.parentElement.classList.add('text-green-500');
            }
        }
    }
}

// --- ZORUNLU AVCI FONKSİYON 2: HTML ID'si ne olursa olsun süreyi bulur ve günceller ---
function updateTimerUI(t) {
    let m = Math.floor(t / 60);
    let s = t % 60;
    let text = `0${m}:${s < 10 ? '0'+s : s}`;
    
    // Önce klasik ID'leri dener
    let possibleIds = ['timer-display', 'timer', 'time', 'game-timer'];
    let found = false;
    for(let id of possibleIds) {
        let el = document.getElementById(id);
        if(el) { el.innerText = text; found = true; }
    }
    
    // Eğer HTML'de ID yoksa, sayfadaki 01:00 vb. yazıları bulup zorla değiştirir
    if(!found) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            let val = node.nodeValue.trim();
            if (val.match(/^[0-9]{2}:[0-9]{2}$/)) { 
                node.nodeValue = text;
            }
        }
    }
}

// --- GLOBAL DEĞİŞKENLER VE TAKIM VERİLERİ ---
const TEAMS = {
    'gs': { primary: 0xfdb913, secondary: 0xa90432, hex: '#fdb913', logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Galatasaray_Sports_Club_Logo.png', name: 'GS' }, 
    'fb': { primary: 0xffff00, secondary: 0x000080, hex: '#ffff00', logo: 'https://upload.wikimedia.org/wikipedia/tr/8/86/Fenerbah%C3%A7e_SK.png', name: 'FB' }, 
    'bjk': { primary: 0xffffff, secondary: 0x111111, hex: '#ffffff', logo: 'https://upload.wikimedia.org/wikipedia/commons/2/20/Logo_of_Be%C5%9Fikta%C5%9F_JK.svg', name: 'BJK' }, 
    'ts': { primary: 0x800000, secondary: 0x3498db, hex: '#800000', logo: 'https://upload.wikimedia.org/wikipedia/tr/a/ab/TrabzonsporAmblemi.png', name: 'TS' }  
};

let currentUser = null;
let userFirebaseDocId = null;
let currentRoomId = null;
let lobbyUnsubscribe = null;
let roomUnsubscribe = null;
let roomExpireTimer = null;
let betAmountGlobal = 0;
let peer = null;
let conn = null;
let isHost = false;

let selectedHostTeam = 'gs';
let selectedClientTeam = 'gs';
let roomToJoinId = null;
let globalP1Team = 'gs';
let globalP2Team = 'fb';

let game = null;
let p1, p2, p1Leg, p2Leg, ball;
let cursors, shootKeys;
let sRed = 0, sBlue = 0;
let goalLock = false;
let p1CanShoot = true, p2CanShoot = true;
let gameActive = false; 
let timeLeft = 90; // Başlangıç global süre
let timerInterval;
let goalAnnouncerText;
let currentGoalMsg = ""; 
let remoteKeys = { up: false, left: false, right: false, flat: false, high: false };
let prevRemoteKeys = { flat: false, high: false };

let powerUpsGroup;
let powerUpTimer;
let activePowerUps = [];
let lastTouchedPlayer = 0; 
let powerUpAnnouncer;

let leftGoalVisual, rightGoalVisual;
let leftPostObj, rightPostObj;
let leftGoalZone, rightGoalZone;

const POWER_TYPES = [
    { id: 'grow_player', color: 0x2ecc71, text: 'DEV OYUNCU!', icon: '🍄' }, 
    { id: 'big_goal', color: 0xe74c3c, text: 'DEV KALE!', icon: '🥅' }, 
    { id: 'small_goal', color: 0x8e44ad, text: 'MİNİ KALE!', icon: '🤏' }, 
    { id: 'bouncy_ball', color: 0x3498db, text: 'SÜPER TOP!', icon: '⚽' }, 
    { id: 'small_ball', color: 0xf1c40f, text: 'MİNİ TOP!', icon: '🍋' }, 
    { id: 'freeze_opponent', color: 0x00ffff, text: 'DONDURUCU!', icon: '❄️' } 
];

document.addEventListener('DOMContentLoaded', () => {
    const userStr = localStorage.getItem('firebaseUser');
    if (!userStr) {
        alert("Oynamak için Ana Sayfadan GİRİŞ yapmalısın!");
        window.location.href = "../../index.html"; 
        return;
    }
    currentUser = JSON.parse(userStr);

    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');

    if (roomFromUrl) {
        document.getElementById('waitText').innerText = "DAVET BİLGİLERİ ALINIYOR...";
        document.getElementById('waitOverlay').classList.remove('hidden');
        document.getElementById('waitOverlay').classList.add('flex');

        setTimeout(() => {
            document.getElementById('waitOverlay').classList.add('hidden');
            document.getElementById('waitOverlay').classList.remove('flex');
            
            roomToJoinId = roomFromUrl;
            document.getElementById('clientTeamModal').classList.remove('hidden');
        }, 1500); 
    } else {
        document.getElementById('lobbyModal').classList.remove('hidden');
        window.fetchLobbyRooms();
    }
});

window.selectHostTeam = function(teamKey) {
    selectedHostTeam = teamKey;
    document.querySelectorAll('.host-team-btn').forEach(b => b.classList.replace('border-orange-500', 'border-transparent'));
    document.getElementById(`host-team-${teamKey}`).classList.replace('border-transparent', 'border-orange-500');
};

window.selectClientTeam = function(teamKey) {
    selectedClientTeam = teamKey;
    document.querySelectorAll('.client-team-btn').forEach(b => b.classList.replace('border-orange-500', 'border-transparent'));
    document.getElementById(`client-team-${teamKey}`).classList.replace('border-transparent', 'border-orange-500');
};

window.cancelClientTeamSelection = function() {
    document.getElementById('clientTeamModal').classList.add('hidden');
    const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({path:newurl},'',newurl);
    document.getElementById('lobbyModal').classList.remove('hidden');
    window.fetchLobbyRooms();
};

window.confirmClientTeamAndJoin = function() {
    document.getElementById('clientTeamModal').classList.add('hidden');
    executeRoomJoin(roomToJoinId, selectedClientTeam);
};

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

window.fetchLobbyRooms = function() {
    if(!window.db) return;
    const roomsRef = window.collection(window.db, "arena_rooms");
    const q = window.query(roomsRef, window.where("status", "==", "waiting_for_p2"), window.where("isPrivate", "==", false));
    if(lobbyUnsubscribe) lobbyUnsubscribe();
    
    lobbyUnsubscribe = window.onSnapshot(q, (snapshot) => {
        const roomList = document.getElementById('roomList');
        roomList.innerHTML = '';
        let validRoomCount = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const now = new Date().getTime();
            if (data.createdAtMs && (now - data.createdAtMs > 300000)) return; 
            validRoomCount++;
            const roomItem = document.createElement('div');
            roomItem.className = "flex justify-between items-center bg-gray-800 p-3 rounded-lg hover:bg-gray-700 border border-gray-700 transition";
            
            roomItem.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${TEAMS[data.p1Team].logo}" class="w-8 h-8 bg-white rounded-full p-0.5 object-contain">
                    <div>
                        <p class="text-white font-bold text-sm">Kurucu: ${data.p1Name}</p>
                        <p class="text-xs text-orange-400">Bahis: ${data.bet} Puan</p>
                    </div>
                </div>
                <button onclick="joinRoomByButton('${doc.id}')" class="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded transition shadow-lg">KATIL</button>
            `;
            roomList.appendChild(roomItem);
        });
        if(validRoomCount === 0) roomList.innerHTML = '<p class="text-gray-500 text-sm text-center mt-4">Şu an açık oda yok. Yeni bir tane kur!</p>';
    });
};

window.joinRoomByButton = async (roomId) => {
    if(!window.db) return;
    const docRef = window.doc(window.db, "arena_rooms", roomId);
    const docSnap = await window.getDoc(docRef);

    if (docSnap.exists()) {
        const roomData = docSnap.data();
        document.getElementById('invite-challenger-name').innerText = `${roomData.p1Name.toUpperCase()} seni maça davet ediyor!`;
        document.getElementById('invite-prize').innerText = roomData.bet * 2;
        
        document.getElementById('inviteModal').classList.remove('hidden');

        document.getElementById('acceptInviteBtn').onclick = () => {
            document.getElementById('inviteModal').classList.add('hidden');
            roomToJoinId = roomId;
            document.getElementById('clientTeamModal').classList.remove('hidden');
        };
    } else { showToast("Oda bulunamadı veya süre doldu!", "error"); }
};

window.closeInviteModal = () => {
    document.getElementById('inviteModal').classList.add('hidden');
    const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({path:newurl},'',newurl);
    document.getElementById('lobbyModal').classList.remove('hidden');
    window.fetchLobbyRooms();
};

async function executeRoomJoin(roomId, chosenTeam) {
    if(lobbyUnsubscribe) lobbyUnsubscribe();
    document.getElementById('waitText').innerText = "ODAYA GİRİLİYOR...";
    document.getElementById('waitOverlay').classList.remove('hidden');
    document.getElementById('waitOverlay').classList.add('flex');

    currentRoomId = roomId;
    const docRef = window.doc(window.db, "arena_rooms", roomId);
    const docSnap = await window.getDoc(docRef);
    
    if (!docSnap.exists() || docSnap.data().status !== 'waiting_for_p2') {
        document.getElementById('waitOverlay').classList.add('hidden');
        return alert("Oda bulunamadı veya dolu!");
    }
    
    const roomData = docSnap.data();
    betAmountGlobal = roomData.bet;
    globalP1Team = roomData.p1Team; 
    globalP2Team = chosenTeam;      

    const userDocRef = await handleBetTransaction(betAmountGlobal);
    if(!userDocRef) { 
        document.getElementById('waitOverlay').classList.add('hidden'); 
        document.getElementById('lobbyModal').classList.remove('hidden');
        return; 
    }
    
    await window.updateDoc(docRef, { p2Name: currentUser.name, p2DocId: userDocRef.id, p2Team: chosenTeam, status: 'playing' });
    
    isHost = false; 
    peer = new Peer();
    
    peer.on('open', () => {
        document.getElementById('waitText').innerText = "P2P BAĞLANTISI KURULUYOR...";
        conn = peer.connect(roomData.hostPeerId, { reliable: true });
        conn.on('open', () => {
            conn.send({ type: 'init', p2Team: globalP2Team });
            
            document.getElementById('p1-name-display').innerText = `${roomData.p1Name.toUpperCase()}`;
            document.getElementById('p2-name-display').innerText = `${currentUser.name.toUpperCase()} (SEN)`;
            setupClientConnection();
        });
        conn.on('error', (err) => alert("Bağlantı koptu!"));
    });
}

window.confirmAndCreateRoom = async () => {
    if (!window.db) return showToast("Bağlantı Bekleniyor...", "error");
    betAmountGlobal = parseInt(document.getElementById('bet-amount').value);
    if (!betAmountGlobal || isNaN(betAmountGlobal) || betAmountGlobal <= 0) return showToast("Geçerli bahis girin!", "error");
    
    const isPrivate = document.getElementById('privateRoomCheck').checked;
    document.getElementById('waitText').innerText = "PEER AĞINA BAĞLANILIYOR...";
    document.getElementById('waitOverlay').classList.remove('hidden');
    document.getElementById('waitOverlay').classList.add('flex');

    const userDocRef = await handleBetTransaction(betAmountGlobal);
    if (!userDocRef) { document.getElementById('waitOverlay').classList.add('hidden'); return; }

    globalP1Team = selectedHostTeam; 

    peer = new Peer(); 
    peer.on('open', async (peerId) => {
        isHost = true;
        currentRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        await window.setDoc(window.doc(window.db, "arena_rooms", currentRoomId), {
            bet: betAmountGlobal, isPrivate: isPrivate, p1Name: currentUser.name, p1DocId: userDocRef.id,
            p1Team: globalP1Team, 
            hostPeerId: peerId, status: 'waiting_for_p2', createdAtMs: new Date().getTime()
        });

        roomExpireTimer = setTimeout(async () => {
            if (currentRoomId && isHost && !gameActive) {
                await window.deleteDoc(window.doc(window.db, "arena_rooms", currentRoomId));
                alert("Süre doldu, puan iade edildi.");
                await window.updateDoc(userDocRef, { score: window.increment(betAmountGlobal) });
                window.location.reload();
            }
        }, 300000);

        document.getElementById('setupControls').classList.add('hidden');
        document.getElementById('waitOverlay').classList.add('hidden');
        document.getElementById('waitOverlay').classList.remove('flex');

        const linkStr = window.location.origin + window.location.pathname + "?room=" + currentRoomId;
        document.getElementById('inviteLink').value = linkStr;
        document.getElementById('linkArea').classList.remove('hidden');

        peer.on('connection', (connection) => { conn = connection; setupHostConnection(); });
    });
};

window.showMultiplayerSetup = function() {
    if(lobbyUnsubscribe) lobbyUnsubscribe(); 
    document.getElementById('lobbyModal').classList.add('hidden');
    document.getElementById('multiplayerSetupModal').classList.remove('hidden');
};

window.backToLobby = async function() {
    if (roomExpireTimer) clearTimeout(roomExpireTimer);
    if (isHost && currentRoomId) {
        try {
            if(userFirebaseDocId) await window.updateDoc(window.doc(window.db, "scores", userFirebaseDocId), { score: window.increment(betAmountGlobal) });
            await window.deleteDoc(window.doc(window.db, "arena_rooms", currentRoomId));
        } catch(e) { }
    }
    if (peer) { peer.destroy(); peer = null; }
    currentRoomId = null; isHost = false;
    document.getElementById('multiplayerSetupModal').classList.add('hidden');
    document.getElementById('lobbyModal').classList.remove('hidden');
    document.getElementById('setupControls').classList.remove('hidden');
    document.getElementById('linkArea').classList.add('hidden');
    window.fetchLobbyRooms();
};

window.copyInviteLink = function() {
    const linkInput = document.getElementById('inviteLink');
    const copyIcon = document.getElementById('copyIcon');
    linkInput.select();
    navigator.clipboard.writeText(linkInput.value).then(() => {
        copyIcon.classList.replace('fa-copy', 'fa-check');
        setTimeout(() => copyIcon.classList.replace('fa-check', 'fa-copy'), 2000);
    });
};

window.leaveGame = async function() {
    if (currentRoomId && isHost && gameActive) {
        await window.deleteDoc(window.doc(window.db, "arena_rooms", currentRoomId));
    }
    window.location.href = "../../index.html";
};

function updateScoreboardUI() {
    const t1 = TEAMS[globalP1Team];
    const t2 = TEAMS[globalP2Team];

    const logo1 = document.getElementById('score-logo-p1');
    logo1.src = t1.logo;
    logo1.classList.remove('hidden');
    logo1.classList.add('object-contain'); 
    
    const logo2 = document.getElementById('score-logo-p2');
    logo2.src = t2.logo;
    logo2.classList.remove('hidden');
    logo2.classList.add('object-contain'); 

    document.getElementById('score-red').style.color = t1.hex;
    document.getElementById('score-red').style.textShadow = `0 0 20px ${t1.hex}`;
    
    document.getElementById('score-blue').style.color = t2.hex;
    document.getElementById('score-blue').style.textShadow = `0 0 20px ${t2.hex}`;
    
    document.getElementById('hud-p1-box').style.color = t1.hex;
    document.getElementById('hud-p2-box').style.color = t2.hex;
}

function setupHostConnection() {
    clearTimeout(roomExpireTimer);
    document.getElementById('multiplayerSetupModal').classList.add('hidden');
    document.getElementById('game-wrapper').classList.remove('hidden');
    document.getElementById('game-wrapper').classList.add('flex');
    document.getElementById('p1-name-display').innerText = `${currentUser.name.toUpperCase()} (SEN)`;
    document.getElementById('p2-name-display').innerText = `RAKİP BAĞLANDI`;
    
    clearWaitingTexts(); 
    
    conn.on('data', (data) => { 
        if (data.type === 'init') {
            globalP2Team = data.p2Team; 
            updateScoreboardUI();
            startPhaserGame(); 
        }
        if (data.type === 'input') remoteKeys = data.keys; 
    });
    conn.on('close', () => { if(gameActive) handleDisconnect(); });
}

function setupClientConnection() {
    document.getElementById('waitOverlay').classList.add('hidden');
    document.getElementById('waitOverlay').classList.remove('flex');
    document.getElementById('game-wrapper').classList.remove('hidden');
    document.getElementById('game-wrapper').classList.add('flex');
    
    clearWaitingTexts(); 
    
    updateScoreboardUI();
    startPhaserGame();
    
    conn.on('data', (data) => {
        if (data.type === 'state') updateClientState(data.state);
        else if (data.type === 'gameover') showGameOver(data.winner);
    });
    conn.on('close', () => { if(gameActive) handleDisconnect(); });
}

function handleDisconnect() {
    gameActive = false;
    showToast("Rakip bağlantıyı kopardı!", "error");
    setTimeout(() => window.location.href = "../../index.html", 3000);
}

// ==========================================
// --- PHASER OYUN MANTIĞI ---
// ==========================================

function startPhaserGame() {
    const config = {
        type: Phaser.AUTO,
        width: 1400, height: 600,
        parent: 'game-container',
        transparent: true,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 2000 }, debug: false } 
        },
        scene: { preload: preload, create: create, update: update }
    };
    game = new Phaser.Game(config);
}

function preload() {
    this.load.image('proBall', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Soccer_ball.svg/240px-Soccer_ball.svg.png');
    let gfx = this.add.graphics();
    
    gfx.fillStyle(0x0a0a0c, 0.9); gfx.fillRect(0, 0, 1400, 80);
    gfx.lineStyle(4, 0xe67e22, 1); gfx.beginPath(); gfx.moveTo(0, 0); gfx.lineTo(1400, 0); gfx.strokePath();
    gfx.generateTexture('ground', 1400, 80);
    
    gfx.clear(); gfx.fillStyle(0xffffff, 1); gfx.fillRect(0, 0, 80, 10); gfx.generateTexture('post_h', 80, 10);
    
    gfx.clear();
    gfx.fillStyle(0xf0f0f0, 1); gfx.fillRoundedRect(0,0, 80, 80, 15);
    gfx.lineStyle(6, 0x000000, 1); gfx.strokeRoundedRect(0,0, 80, 80, 15);
    gfx.generateTexture('power_box', 80, 80);

    drawGoal(gfx, 'goal_left', true);
    drawGoal(gfx, 'goal_right', false);
    
    const pixelSize = 6; 
    const headArt = [
        "....2222....", "...222222...", "..22222222..", ".22TTTTTT22.", 
        ".2111111112.", ".1131111311.", ".1131111311.", ".1111441111.", 
        "..11111111..", "..11222211..", "...111111...", "............"
    ];
    
    const shoeArt = [
        "...2222...", "...2222...", "1111111...",
        "111441111.", "1111111111", ".3..3..3.."
    ];

    const createTex = (key, art, palette) => {
        gfx.clear();
        for (let y = 0; y < art.length; y++) {
            for (let x = 0; x < art[y].length; x++) {
                if (art[y][x] !== '.') { gfx.fillStyle(palette[art[y][x]], 1); gfx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize); }
            }
        }
        gfx.generateTexture(key, art[0].length * pixelSize, art.length * pixelSize);
    };

    const commonPalette = { '1': 0xf1c27d, '2': 0x4a3121, '3': 0x000000, '4': 0xdcb26c };
    const c1 = TEAMS[globalP1Team];
    const c2 = TEAMS[globalP2Team];

    createTex('p1_head', headArt, { ...commonPalette, 'T': c1.primary }); 
    createTex('p2_head', headArt, { ...commonPalette, 'T': c2.primary }); 
    
    createTex('p1_shoe', shoeArt, { '1': c1.secondary, '2': c1.primary, '3': 0x111111, '4': 0xffffff });
    createTex('p2_shoe', shoeArt, { '1': c2.secondary, '2': c2.primary, '3': 0x111111, '4': 0xffffff });
    
    gfx.destroy(); 
}

function drawGoal(gfx, name, isLeft) {
    gfx.clear();
    gfx.lineStyle(2, 0xffffff, 0.2); 
    for(let i=0; i<=80; i+=15) { gfx.moveTo(i,0); gfx.lineTo(i,260); }
    for(let i=0; i<=260; i+=15) { gfx.moveTo(0,i); gfx.lineTo(80,i); }
    gfx.strokePath();
    gfx.lineStyle(6, 0xe67e22, 1); 
    gfx.beginPath(); 
    if(isLeft) { gfx.moveTo(0,0); gfx.lineTo(80,0); gfx.lineTo(80,260); }
    else { gfx.moveTo(80,0); gfx.lineTo(0,0); gfx.lineTo(0,260); }
    gfx.strokePath();
    gfx.generateTexture(name, 80, 260);
}

function create() {
    this.physics.world.setBounds(0, -100, 1400, 635); 

    this.add.image(700, 575, 'ground'); 
    let ceiling = this.add.rectangle(700, -10, 1400, 20, 0x000000, 0); 
    this.physics.add.existing(ceiling, true); 
    
    leftGoalVisual = this.add.image(40, 410, 'goal_left').setDepth(0); 
    rightGoalVisual = this.add.image(1360, 410, 'goal_right').setDepth(0);
    
    const posts = this.physics.add.staticGroup();
    leftPostObj = posts.create(40, 285, 'post_h'); 
    rightPostObj = posts.create(1360, 285, 'post_h'); 
    
    leftGoalZone = this.add.zone(40, 430, 70, 220); this.physics.add.existing(leftGoalZone, true);
    rightGoalZone = this.add.zone(1360, 430, 70, 220); this.physics.add.existing(rightGoalZone, true);

    p1 = this.physics.add.sprite(300, 400, 'p1_head').setDepth(2).setBounce(0.2).setCollideWorldBounds(true).setCircle(35, 0, 5).setMass(500); 
    p2 = this.physics.add.sprite(1100, 400, 'p2_head').setFlipX(true).setDepth(2).setBounce(0.2).setCollideWorldBounds(true).setCircle(35, 0, 5).setMass(500);
    
    p1Leg = this.add.sprite(p1.x, p1.y, 'p1_shoe').setDepth(1).setOrigin(0.3, 0.5); p1Leg.isKicking = false;
    p2Leg = this.add.sprite(p2.x, p2.y, 'p2_shoe').setDepth(1).setOrigin(0.7, 0.5).setFlipX(true); p2Leg.isKicking = false;

    ball = this.physics.add.sprite(700, 200, 'proBall').setDepth(3).setScale(0.22);
    ball.setCircle(115); 
    ball.setBounce(0.85); 
    ball.setMass(1);      
    ball.setDragX(100); 
    ball.setCollideWorldBounds(true); 

    powerUpsGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    
    powerUpAnnouncer = this.add.text(700, 150, '', { 
        fontSize: '50px', fill: '#fff', fontFamily: 'Rajdhani', fontStyle: 'bold', 
        shadow: { offsetX: 0, offsetY: 0, color: '#000', blur: 15, fill: true },
        stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5).setAlpha(0).setDepth(20);

    goalAnnouncerText = this.add.text(700, 250, '', { 
        fontSize: '60px', fill: '#ffd700', fontFamily: 'Rajdhani', fontStyle: 'bold', 
        shadow: { offsetX: 3, offsetY: 3, color: '#ff4757', blur: 10, fill: true },
        stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    if (!isHost) {
        ball.body.moves = false; p1.body.moves = false; p2.body.moves = false;
    } else {
        this.physics.add.collider(ceiling, ball);
        
        this.physics.add.collider(ball, posts, (b, p) => {
            if (Math.abs(b.body.velocity.y) < 30 && b.y < p.y) {
                let dir = (b.x < 700) ? 1 : -1; 
                b.setVelocity(dir * 250, -300); 
            }
        }); 

        this.physics.add.collider(p1, p2, () => {
            let push = 300;
            if (p1.x < p2.x) { p1.setVelocityX(-push); p2.setVelocityX(push); } else { p1.setVelocityX(push); p2.setVelocityX(-push); }
        });
        
        this.physics.add.collider(p1, ball, () => handlePlayerBallCollision(p1, ball, 1));
        this.physics.add.collider(p2, ball, () => handlePlayerBallCollision(p2, ball, 2));
        
        this.physics.add.overlap(ball, powerUpsGroup, collectPowerUp, null, this);
        this.physics.add.overlap(ball, leftGoalZone, () => goal(2, this));
        this.physics.add.overlap(ball, rightGoalZone, () => goal(1, this));
        
        powerUpTimer = this.time.addEvent({
            delay: 5000, 
            callback: spawnPowerUp, 
            callbackScope: this, 
            loop: true 
        });
    }
    
    cursors = this.input.keyboard.createCursorKeys();
    shootKeys = this.input.keyboard.addKeys({ flat: 'K', high: 'L' });
    gameActive = true;
    if (isHost) startTimer();
}

function spawnPowerUp() {
    if (!gameActive || goalLock) return;
    if (powerUpsGroup.getChildren().length >= 3) return;

    let randX = Phaser.Math.Between(300, 1100);
    let randY = Phaser.Math.Between(300, 480);
    let randomType = POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)];
    
    let pu = powerUpsGroup.create(randX, randY, 'power_box').setDepth(1);
    pu.setTint(randomType.color);
    pu.powerType = randomType;
    
    let icon = pu.scene.add.text(randX, randY, randomType.icon, { fontSize: '50px' }).setOrigin(0.5).setDepth(2);
    pu.iconRef = icon;

    pu.scene.tweens.add({
        targets: [pu, icon],
        y: randY - 15, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        onUpdate: () => { if (pu && pu.body) pu.body.updateFromGameObject(); }
    });
}

function collectPowerUp(ball, powerUp) {
    let takerId = lastTouchedPlayer;
    
    if (takerId === 0) {
        let d1 = Phaser.Math.Distance.Between(ball.x, ball.y, p1.x, p1.y);
        let d2 = Phaser.Math.Distance.Between(ball.x, ball.y, p2.x, p2.y);
        takerId = d1 < d2 ? 1 : 2;
    }

    let type = powerUp.powerType;
    if(powerUp.iconRef) powerUp.iconRef.destroy();
    powerUp.destroy();
    applyPowerUp(type, takerId);
}

function applyPowerUp(type, takerId) {
    let targetPlayer = (takerId === 1) ? p1 : p2;
    let targetLeg = (takerId === 1) ? p1Leg : p2Leg;
    let otherPlayer = (takerId === 1) ? p2 : p1;
    let otherLeg = (takerId === 1) ? p2Leg : p1Leg;

    powerUpAnnouncer.setText(type.icon + " " + type.text).setColor('#' + type.color.toString(16));
    powerUpAnnouncer.setAlpha(1).setScale(0.5);
    game.scene.scenes[0].tweens.add({ targets: powerUpAnnouncer, scale: 1, duration: 500, yoyo: true, hold: 1500, onComplete: () => powerUpAnnouncer.setAlpha(0) });

    let powerObj = { id: type.id, taker: takerId, timer: null };

    if (type.id === 'grow_player') {
        targetPlayer.setScale(1.5); targetLeg.setScale(1.5); targetPlayer.setMass(1000);
        powerObj.timer = setTimeout(() => { if(targetPlayer.active) { targetPlayer.setScale(1); targetLeg.setScale(1); targetPlayer.setMass(500); } }, 7000);
    } 
    else if (type.id === 'big_goal') {
        let goalToScaleZone = (takerId === 1) ? rightGoalZone : leftGoalZone;
        let visualGoal = (takerId === 1) ? rightGoalVisual : leftGoalVisual;
        let targetPost = (takerId === 1) ? rightPostObj : leftPostObj;

        visualGoal.setScale(1, 1.6); visualGoal.y = 332; 
        targetPost.setY(129); targetPost.refreshBody(); 
        goalToScaleZone.body.setSize(70, 416);

        powerObj.timer = setTimeout(() => { 
            if(visualGoal.active) { 
                visualGoal.setScale(1, 1); visualGoal.y = 410; 
                targetPost.setY(285); targetPost.refreshBody();
                goalToScaleZone.body.setSize(70, 220); 
            } 
        }, 7000);
    }
    else if (type.id === 'small_goal') {
        let goalToScaleZone = (takerId === 1) ? leftGoalZone : rightGoalZone;
        let visualGoal = (takerId === 1) ? leftGoalVisual : rightGoalVisual;
        let targetPost = (takerId === 1) ? leftPostObj : rightPostObj;

        visualGoal.setScale(1, 0.5); visualGoal.y = 475; 
        targetPost.setY(415); targetPost.refreshBody(); 
        goalToScaleZone.body.setSize(70, 130);

        powerObj.timer = setTimeout(() => { 
            if(visualGoal.active) { 
                visualGoal.setScale(1, 1); visualGoal.y = 410; 
                targetPost.setY(285); targetPost.refreshBody();
                goalToScaleZone.body.setSize(70, 220); 
            } 
        }, 7000);
    }
    else if (type.id === 'freeze_opponent') {
        otherPlayer.body.moves = false; 
        otherLeg.setVisible(false); 
        otherPlayer.setTint(0x00ffff); 
        if(takerId === 1) p2CanShoot = false; else p1CanShoot = false; 
        powerObj.timer = setTimeout(() => {
            if(otherPlayer.active) {
                otherPlayer.body.moves = true; otherLeg.setVisible(true); otherPlayer.clearTint();
                if(takerId === 1) p2CanShoot = true; else p1CanShoot = true;
            }
        }, 3000);
    }
    else if (type.id === 'bouncy_ball') {
        ball.setBounce(1.1); ball.setDragX(0); ball.setTint(0x3498db);
        powerObj.timer = setTimeout(() => { if(ball.active) { ball.setBounce(0.85); ball.setDragX(100); ball.clearTint(); } }, 7000);
    }
    else if (type.id === 'small_ball') {
        ball.setScale(0.12); ball.setMass(2.5); ball.setTint(0xf1c40f);
        powerObj.timer = setTimeout(() => { if(ball.active) { ball.setScale(0.22); ball.setMass(1); ball.clearTint(); } }, 7000);
    }

    activePowerUps.push(powerObj);
}

function clearAllPowerUps() {
    activePowerUps.forEach(pu => clearTimeout(pu.timer));
    activePowerUps = [];
    
    if(p1 && p1.active) { p1.setScale(1); p1Leg.setScale(1); p1.setMass(500); p1.clearTint(); p1.body.moves = true; p1Leg.setVisible(true); p1CanShoot = true; }
    if(p2 && p2.active) { p2.setScale(1); p2Leg.setScale(1); p2.setMass(500); p2.clearTint(); p2.body.moves = true; p2Leg.setVisible(true); p2CanShoot = true; }
    
    if(ball && ball.active) { ball.setScale(0.22); ball.setBounce(0.85); ball.setMass(1); ball.setDragX(100); ball.clearTint(); }
    
    if(leftGoalVisual) { 
        leftGoalVisual.setScale(1,1); leftGoalVisual.y = 410; 
        if(leftPostObj) { leftPostObj.setY(285); leftPostObj.refreshBody(); }
        if(leftGoalZone) leftGoalZone.body.setSize(70, 220); 
    }
    if(rightGoalVisual) { 
        rightGoalVisual.setScale(1,1); rightGoalVisual.y = 410; 
        if(rightPostObj) { rightPostObj.setY(285); rightPostObj.refreshBody(); }
        if(rightGoalZone) rightGoalZone.body.setSize(70, 220); 
    }

    powerUpsGroup.getChildren().forEach(pu => {
        if(pu.iconRef) pu.iconRef.destroy();
    });
    powerUpsGroup.clear(true, true);
}

function handlePlayerBallCollision(player, b, playerId) {
    lastTouchedPlayer = playerId;

    let dx = b.x - player.x;
    let dy = b.y - player.y;
    
    let dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) dist = 1;
    let dirX = dx / dist;
    let dirY = dy / dist;

    let isHeader = (b.y < player.y - 18);
    let powerMulti = player.scaleX > 1 ? 1.5 : 1.0;

    if (isHeader) {
        let headerForceY = -850 * powerMulti; 
        let headerForceX = (dirX * 300 + (player.body.velocity.x * 0.5)) * powerMulti; 
        b.setVelocity(headerForceX, headerForceY);
    } else {
        let baseForce = 250 * powerMulti; 
        b.setVelocity(dirX * baseForce, dirY * baseForce);
        if(Math.abs(b.body.velocity.y) < 50 && b.y < player.y) b.setVelocityY(-150);
    }
}

function update() {
    if (!gameActive) return;
    
    if (isHost) {
        if (!goalLock) {
            if (ball.body.velocity.x !== 0) ball.rotation += ball.body.velocity.x * 0.0001;

            if (cursors.left.isDown) p1.setVelocityX(-400); else if (cursors.right.isDown) p1.setVelocityX(400); else p1.setVelocityX(0);
            if (cursors.up.isDown && p1.body.blocked.down) p1.setVelocityY(-800);
            if (shootKeys.flat.isDown && p1CanShoot) doShoot(p1, 1, 1, this, 'flat');
            if (shootKeys.high.isDown && p1CanShoot) doShoot(p1, 1, 1, this, 'high');
            
            if (remoteKeys.left) p2.setVelocityX(-400); else if (remoteKeys.right) p2.setVelocityX(400); else p2.setVelocityX(0);
            if (remoteKeys.up && p2.body.blocked.down) p2.setVelocityY(-800);
            if (remoteKeys.flat && !prevRemoteKeys.flat && p2CanShoot) doShoot(p2, -1, 2, this, 'flat');
            if (remoteKeys.high && !prevRemoteKeys.high && p2CanShoot) doShoot(p2, -1, 2, this, 'high');
            
            prevRemoteKeys.flat = remoteKeys.flat; prevRemoteKeys.high = remoteKeys.high;
        }
        
        p1Leg.setPosition(p1.x - 5, p1.y + 35); p2Leg.setPosition(p2.x + 5, p2.y + 35);
        if(!p1Leg.isKicking) p1Leg.setAngle(0); if(!p2Leg.isKicking) p2Leg.setAngle(0);
        
        let currentPowerUps = [];
        powerUpsGroup.getChildren().forEach(p => {
            currentPowerUps.push({ x: p.x, y: p.y, color: p.powerType.color, icon: p.powerType.icon, id: p.powerType.id });
        });

        if (conn && conn.open) {
            conn.send({ 
                type: 'state', 
                state: { 
                    p1: { x: p1.x, y: p1.y, la: p1Leg.angle, s: p1.scaleX, tint: p1.tintTopLeft, vis: p1.body.moves }, 
                    p2: { x: p2.x, y: p2.y, la: p2Leg.angle, s: p2.scaleX, tint: p2.tintTopLeft, vis: p2.body.moves }, 
                    b: { x: ball.x, y: ball.y, r: ball.rotation, s: ball.scaleX, c: ball.tintTopLeft }, 
                    goals: {
                        l: { s: leftGoalVisual.scaleY, y: leftGoalVisual.y, py: leftPostObj.y },
                        r: { s: rightGoalVisual.scaleY, y: rightGoalVisual.y, py: rightPostObj.y }
                    },
                    sRed: sRed, sBlue: sBlue, time: timeLeft, msg: currentGoalMsg,
                    powerUps: currentPowerUps, 
                    announcer: { text: powerUpAnnouncer.text, color: powerUpAnnouncer.style.color, alpha: powerUpAnnouncer.alpha, scale: powerUpAnnouncer.scaleX }
                } 
            });
        }
    } else if (conn && conn.open) {
        conn.send({ type: 'input', keys: { up: cursors.up.isDown, left: cursors.left.isDown, right: cursors.right.isDown, flat: shootKeys.flat.isDown, high: shootKeys.high.isDown } });
    }
}

let clientPowerUpIcons = [];

function updateClientState(data) {
    if (!gameActive) return;
    
    p1.setPosition(data.p1.x, data.p1.y).setScale(data.p1.s); 
    if(data.p1.tint !== 16777215) p1.setTint(data.p1.tint); else p1.clearTint();
    p1Leg.setPosition(p1.x - 5, p1.y + 35).setAngle(data.p1.la).setScale(data.p1.s).setVisible(data.p1.vis);

    p2.setPosition(data.p2.x, data.p2.y).setScale(data.p2.s);
    if(data.p2.tint !== 16777215) p2.setTint(data.p2.tint); else p2.clearTint();
    p2Leg.setPosition(p2.x + 5, p2.y + 35).setAngle(data.p2.la).setScale(data.p2.s).setVisible(data.p2.vis);
    
    ball.setPosition(data.b.x, data.b.y).setRotation(data.b.r).setScale(data.b.s); 
    if(data.b.c !== 16777215) ball.setTint(data.b.c); else ball.clearTint(); 
    
    if(data.goals) {
        leftGoalVisual.setScale(1, data.goals.l.s).setY(data.goals.l.y);
        leftPostObj.setY(data.goals.l.py);
        
        rightGoalVisual.setScale(1, data.goals.r.s).setY(data.goals.r.y);
        rightPostObj.setY(data.goals.r.py);
    }

    powerUpsGroup.clear(true, true);
    clientPowerUpIcons.forEach(i => i.destroy()); clientPowerUpIcons = [];
    
    data.powerUps.forEach(pData => {
        let pu = powerUpsGroup.create(pData.x, pData.y, 'power_box').setDepth(1);
        pu.setTint(pData.color);
        let icon = game.scene.scenes[0].add.text(pData.x, pData.y, pData.icon, { fontSize: '50px' }).setOrigin(0.5).setDepth(2);
        clientPowerUpIcons.push(icon);
    });

    powerUpAnnouncer.setText(data.announcer.text).setColor(data.announcer.color).setAlpha(data.announcer.alpha).setScale(data.announcer.scale);

    document.getElementById('score-red').innerText = data.sRed; document.getElementById('score-blue').innerText = data.sBlue;
    
    // YENİ GÜÇLÜ FONKSİYON İLE SÜREYİ EKRANA YAZDIR
    updateTimerUI(data.time);
    
    if (data.msg !== currentGoalMsg) { 
        currentGoalMsg = data.msg; 
        if (currentGoalMsg !== "") playGoalAnimation(game.scene.scenes[0], currentGoalMsg); 
    }
}

function doShoot(p, dir, pid, scene, type) {
    let leg = (pid === 1) ? p1Leg : p2Leg;
    let dist = Phaser.Math.Distance.Between(leg.x + (dir * 30), leg.y, ball.x, ball.y);
    leg.isKicking = true;
    
    let ang = (type === 'flat') ? (pid === 1 ? -30 : 30) : (pid === 1 ? -70 : 70);
    scene.tweens.add({ targets: leg, angle: ang, duration: 100, yoyo: true, onComplete: () => leg.isKicking = false });
    
    let reach = p.scaleX > 1 ? 140 : 90;
    let powerMulti = p.scaleX > 1 ? 1.5 : 1.0;

    if (dist < reach) { 
        lastTouchedPlayer = pid; 
        let px = (type === 'flat') ? 1100 * powerMulti : 700 * powerMulti; 
        let py = (type === 'flat') ? -250 * powerMulti : -950 * powerMulti;
        ball.setVelocity(dir * px, py);
    }
    
    if (pid === 1) { p1CanShoot = false; setTimeout(() => p1CanShoot = true, 300); } 
    else { p2CanShoot = false; setTimeout(() => p2CanShoot = true, 300); }
}

function goal(scorer, scene) {
    if (goalLock || !gameActive || !isHost) return;
    goalLock = true;
    
    if (scorer === 2) sBlue++; else sRed++; 
    
    document.getElementById('score-red').innerText = sRed; 
    document.getElementById('score-blue').innerText = sBlue;
    
    const messages = ["GOOOOOL!", "AĞLARI DELDİ!", "MÜKEMMEL ŞUT!", "İNANILMAZ!"];
    currentGoalMsg = messages[Math.floor(Math.random() * messages.length)];
    
    playGoalAnimation(scene, currentGoalMsg);
    
    clearAllPowerUps();

    setTimeout(() => { 
        if (!gameActive) return; 
        currentGoalMsg = ""; 
        p1.setPosition(300, 400); p2.setPosition(1100, 400); 
        ball.setPosition(700, 150).setVelocity(0,0);
        lastTouchedPlayer = 0;
        goalLock = false; 
    }, 2500);
}

function playGoalAnimation(scene, msg) {
    goalAnnouncerText.setText(msg).setAlpha(1).setScale(0.2);
    scene.tweens.add({ targets: goalAnnouncerText, scale: 1, duration: 800, ease: 'Elastic.easeOut', onComplete: () => { scene.tweens.add({ targets: goalAnnouncerText, alpha: 0, delay: 1000, duration: 500 }); } });
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = 90; // OYUN BAŞLADIĞINDA SÜREYİ KESİN OLARAK SIFIRLAR
    
    updateTimerUI(timeLeft); 

    timerInterval = setInterval(() => { 
        if(goalLock || !gameActive) return; 
        timeLeft--; 
        
        updateTimerUI(timeLeft);

        if (timeLeft <= 0) { 
            clearInterval(timerInterval); 
            if(powerUpTimer) powerUpTimer.remove(); 
            let win = sRed > sBlue ? 1 : (sBlue > sRed ? 2 : 0);
            if (conn && conn.open) conn.send({ type: 'gameover', winner: win });
            showGameOver(win); 
        } 
    }, 1000);
}

async function showGameOver(win) {
    gameActive = false;
    document.getElementById('game-over-screen').style.display = 'flex';
    const wt = document.getElementById('winner-text');
    
    if (isHost && win !== 0) {
        const docSnap = await window.getDoc(window.doc(window.db, "arena_rooms", currentRoomId));
        const winnerDocId = win === 1 ? docSnap.data().p1DocId : docSnap.data().p2DocId;
        await window.updateDoc(window.doc(window.db, "scores", winnerDocId), { score: window.increment(betAmountGlobal * 2) });
    }
    
    if (win === 0) wt.innerText = "BERABERE!";
    else if ((win === 1 && isHost) || (win === 2 && !isHost)) wt.innerText = "KAZANDIN!";
    else wt.innerText = "KAYBETTİN!";
}