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

// --- GLOBAL DEĞİŞKENLER ---
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

// --- PHASER DEĞİŞKENLERİ ---
let game = null;
let p1, p2, p1Leg, p2Leg, ball;
let cursors, shootKeys;
let sRed = 0, sBlue = 0;
let goalLock = false;
let p1CanShoot = true, p2CanShoot = true;
let gameActive = false; 
let timeLeft = 60; 
let timerInterval;
let goalAnnouncerText;
let currentGoalMsg = ""; 
let remoteKeys = { up: false, left: false, right: false, flat: false, high: false };
let prevRemoteKeys = { flat: false, high: false };

// --- BAŞLANGIÇ VE URL KONTROLÜ (MEYDAN OKUMA) ---
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
        // 1. DURUM: Link ile gelindi! Lobiyi hiç gösterme, direkt bilgileri çek.
        // Firebase yüklenene kadar boşluk olmasın diye kısa bir yükleniyor yazısı gösterelim
        document.getElementById('waitText').innerText = "DAVET BİLGİLERİ ALINIYOR...";
        document.getElementById('waitOverlay').classList.remove('hidden');
        document.getElementById('waitOverlay').classList.add('flex');

        setTimeout(() => {
            document.getElementById('waitOverlay').classList.add('hidden');
            document.getElementById('waitOverlay').classList.remove('flex');
            window.joinRoomByButton(roomFromUrl);
        }, 1500); 

    } else {
        // 2. DURUM: Normal giriş yapıldı. Lobiyi görünür yap ve odaları çek.
        document.getElementById('lobbyModal').classList.remove('hidden');
        window.fetchLobbyRooms();
    }
});

// --- PUAN İŞLEMLERİ ---
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

// --- LOBİ LİSTESİ ---
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
                <div>
                    <p class="text-white font-bold text-sm">Kurucu: ${data.p1Name}</p>
                    <p class="text-xs text-orange-400">Bahis: ${data.bet} Puan</p>
                </div>
                <button onclick="joinRoomByButton('${doc.id}')" class="bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded transition shadow-lg">KATIL</button>
            `;
            roomList.appendChild(roomItem);
        });

        if(validRoomCount === 0) roomList.innerHTML = '<p class="text-gray-500 text-sm text-center mt-4">Şu an açık oda yok. Yeni bir tane kur!</p>';
    });
};

// --- MEYDAN OKUMA (GRID TARZI ONAY) ---
window.joinRoomByButton = async (roomId) => {
    if(!window.db) return;

    const docRef = window.doc(window.db, "arena_rooms", roomId);
    const docSnap = await window.getDoc(docRef);

    if (docSnap.exists()) {
        const roomData = docSnap.data();
        
        // Grid'deki Meydan Okuma ekranını doldur (Toplam ödül genellikle bahis x2'dir)
        document.getElementById('invite-challenger-name').innerText = `${roomData.p1Name.toUpperCase()} seni maça davet ediyor!`;
        document.getElementById('invite-prize').innerText = roomData.bet * 2;
        
        // Modalı göster
        document.getElementById('inviteModal').classList.remove('hidden');

        // KABUL ET butonuna asıl katılma kodunu bağla
        document.getElementById('acceptInviteBtn').onclick = () => {
            document.getElementById('inviteModal').classList.add('hidden');
            executeRoomJoin(roomId);
        };
    } else {
        showToast("Oda bulunamadı veya süre doldu!", "error");
    }
};

// --- DAVETİ REDDETME VE MODAL KAPATMA ---
window.closeInviteModal = () => {
    document.getElementById('inviteModal').classList.add('hidden');
    
    // URL'yi temizle
    const newurl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.pushState({path:newurl},'',newurl);
    
    // Daveti reddettiği için şimdi Lobiyi göster
    document.getElementById('lobbyModal').classList.remove('hidden');
    window.fetchLobbyRooms();
};

// --- ASIL KATILMA İŞLEMİ ---
async function executeRoomJoin(roomId) {
    if(lobbyUnsubscribe) lobbyUnsubscribe();
    document.getElementById('lobbyModal').classList.add('hidden');
    
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

    // PUAN BURADA DÜŞER
    const userDocRef = await handleBetTransaction(betAmountGlobal);
    if(!userDocRef) { 
        document.getElementById('waitOverlay').classList.add('hidden'); 
        document.getElementById('lobbyModal').classList.remove('hidden');
        return; 
    }
    
    await window.updateDoc(docRef, { p2Name: currentUser.name, p2DocId: userDocRef.id, status: 'playing' });

    isHost = false;
    peer = new Peer();
    
    peer.on('open', () => {
        document.getElementById('waitText').innerText = "P2P BAĞLANTISI KURULUYOR...";
        conn = peer.connect(roomData.hostPeerId, { reliable: true });
        conn.on('open', () => {
            setupClientConnection();
            document.getElementById('p1-name-display').innerText = `${roomData.p1Name.toUpperCase()}`;
            document.getElementById('p2-name-display').innerText = `${currentUser.name.toUpperCase()} (SEN)`;
        });
        conn.on('error', (err) => alert("Bağlantı koptu!"));
    });
}

// --- HOST ODA KURMA ---
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

    peer = new Peer(); 
    peer.on('open', async (peerId) => {
        isHost = true;
        currentRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        await window.setDoc(window.doc(window.db, "arena_rooms", currentRoomId), {
            bet: betAmountGlobal,
            isPrivate: isPrivate,
            p1Name: currentUser.name,
            p1DocId: userDocRef.id,
            hostPeerId: peerId,
            status: 'waiting_for_p2',
            createdAtMs: new Date().getTime()
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

        peer.on('connection', (connection) => {
            conn = connection;
            setupHostConnection();
        });
    });
};

// --- YÖNLENDİRME VE DİĞER BUTONLAR ---
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

// --- BAĞLANTI KURULUMLARI ---
function setupHostConnection() {
    clearTimeout(roomExpireTimer);
    document.getElementById('multiplayerSetupModal').classList.add('hidden');
    document.getElementById('game-wrapper').classList.remove('hidden');
    document.getElementById('game-wrapper').classList.add('flex');
    document.getElementById('p1-name-display').innerText = `${currentUser.name.toUpperCase()} (SEN)`;
    document.getElementById('p2-name-display').innerText = `RAKİP BAĞLANDI`;
    conn.on('data', (data) => { if (data.type === 'input') remoteKeys = data.keys; });
    conn.on('close', () => { if(gameActive) handleDisconnect(); });
    startPhaserGame();
}

function setupClientConnection() {
    document.getElementById('waitOverlay').classList.add('hidden');
    document.getElementById('waitOverlay').classList.remove('flex');
    document.getElementById('game-wrapper').classList.remove('hidden');
    document.getElementById('game-wrapper').classList.add('flex');
    conn.on('data', (data) => {
        if (data.type === 'state') updateClientState(data.state);
        else if (data.type === 'gameover') showGameOver(data.winner);
    });
    conn.on('close', () => { if(gameActive) handleDisconnect(); });
    startPhaserGame();
}

function handleDisconnect() {
    gameActive = false;
    showToast("Rakip bağlantıyı kopardı!", "error");
    setTimeout(() => window.location.href = "../../index.html", 3000);
}

// --- PHASER OYUN MANTIĞI ---
function startPhaserGame() {
    const config = {
        type: Phaser.AUTO,
        width: 1400, height: 600,
        parent: 'game-container',
        transparent: true,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        physics: {
            default: 'arcade',
            arcade: { gravity: { y: 2800 }, debug: false } 
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
    gfx.clear(); gfx.lineStyle(2, 0xffffff, 0.2); 
    for(let i=0; i<=80; i+=15) { gfx.moveTo(i,0); gfx.lineTo(i,200); }
    for(let i=0; i<=200; i+=15) { gfx.moveTo(0,i); gfx.lineTo(80,i); }
    gfx.strokePath(); gfx.lineStyle(6, 0xe67e22, 1); gfx.beginPath(); 
    gfx.moveTo(0,0); gfx.lineTo(80,0); gfx.lineTo(80,200); gfx.strokePath();
    gfx.generateTexture('goal_left', 80, 200);
    gfx.clear(); gfx.lineStyle(2, 0xffffff, 0.2); 
    for(let i=0; i<=80; i+=15) { gfx.moveTo(i,0); gfx.lineTo(i,200); }
    for(let i=0; i<=200; i+=15) { gfx.moveTo(0,i); gfx.lineTo(80,i); }
    gfx.strokePath(); gfx.lineStyle(6, 0xe67e22, 1); gfx.beginPath(); 
    gfx.moveTo(80,0); gfx.lineTo(0,0); gfx.lineTo(0,200); gfx.strokePath();
    gfx.generateTexture('goal_right', 80, 200);
    const pixelSize = 6; 
    const headArt = ["...TTTTTT...", ".TTTTTTTTTT.", "111111111111", "111111111111", "111334113341", "111334113341", "111111111111", "111115555111", ".1111111111.", "...111111..."];
    const shoeArt = ["...2222...", "...2222...", "1111111...", "111441111.", "1111111111", ".3..3..3.."];
    const createTex = (key, art, palette) => {
        gfx.clear();
        for (let y = 0; y < art.length; y++) {
            for (let x = 0; x < art[y].length; x++) {
                if (art[y][x] !== '.') { gfx.fillStyle(palette[art[y][x]], 1); gfx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize); }
            }
        }
        gfx.generateTexture(key, art[0].length * pixelSize, art.length * pixelSize);
    };
    createTex('p1_head', headArt, { '1': 0xcccccc, '3': 0xffffff, '4': 0x000000, '5': 0x555555, 'T': 0xff4757 });
    createTex('p2_head', headArt, { '1': 0xcccccc, '3': 0xffffff, '4': 0x000000, '5': 0x555555, 'T': 0x1e90ff });
    createTex('p1_shoe', shoeArt, { '1': 0xff4757, '2': 0xeeeeee, '3': 0x111111, '4': 0xffffff });
    createTex('p2_shoe', shoeArt, { '1': 0x1e90ff, '2': 0xeeeeee, '3': 0x111111, '4': 0xffffff });
    gfx.destroy(); 
}

function create() {
    this.physics.world.setBounds(0, 0, 1400, 550);
    const platforms = this.physics.add.staticGroup();
    platforms.create(700, 570, 'ground').refreshBody();
    let ceiling = this.add.rectangle(700, -10, 1400, 20, 0x000000, 0); 
    this.physics.add.existing(ceiling, true); platforms.add(ceiling);
    this.add.image(40, 440, 'goal_left'); this.add.image(1360, 440, 'goal_right');
    platforms.create(40, 345, 'post_h'); platforms.create(1360, 345, 'post_h'); 
    let leftGoal = this.add.zone(40, 460, 70, 160); this.physics.add.existing(leftGoal, true);
    let rightGoal = this.add.zone(1360, 460, 70, 160); this.physics.add.existing(rightGoal, true);
    p1 = this.physics.add.sprite(300, 400, 'p1_head').setDepth(2).setBounce(0.2).setCollideWorldBounds(true).setCircle(30, 6, 0).setMass(3); 
    p2 = this.physics.add.sprite(1100, 400, 'p2_head').setFlipX(true).setDepth(2).setBounce(0.2).setCollideWorldBounds(true).setCircle(30, 6, 0).setMass(3);
    p1Leg = this.add.sprite(p1.x, p1.y, 'p1_shoe').setDepth(1).setOrigin(0.3, 0.5); 
    p1Leg.isKicking = false;
    p2Leg = this.add.sprite(p2.x, p2.y, 'p2_shoe').setDepth(1).setOrigin(0.7, 0.5).setFlipX(true); 
    p2Leg.isKicking = false;
    ball = this.physics.add.sprite(700, 200, 'proBall').setDepth(3).setScale(0.22).setCircle(100).setBounce(0.7).setMass(1.2).setDrag(150, 10).setCollideWorldBounds(true); 

    if (!isHost) {
        ball.body.moves = false; p1.body.moves = false; p2.body.moves = false;
    } else {
        this.physics.add.collider(p1, platforms); this.physics.add.collider(p2, platforms); this.physics.add.collider(ball, platforms);
        this.physics.add.collider(p1, p2, () => {
            let push = 300;
            if (p1.x < p2.x) { p1.setVelocityX(-push); p2.setVelocityX(push); } else { p1.setVelocityX(push); p2.setVelocityX(-push); }
        });
        this.physics.add.collider(p1, ball, () => handleHeaderCollision(p1, ball));
        this.physics.add.collider(p2, ball, () => handleHeaderCollision(p2, ball));
        this.physics.add.overlap(ball, leftGoal, () => goal(2, this));
        this.physics.add.overlap(ball, rightGoal, () => goal(1, this));
    }
    cursors = this.input.keyboard.createCursorKeys();
    shootKeys = this.input.keyboard.addKeys({ flat: 'K', high: 'L' });
    goalAnnouncerText = this.add.text(700, 250, '', { fontSize: '60px', fill: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5).setAlpha(0);
    gameActive = true;
    if (isHost) startTimer();
}

function handleHeaderCollision(player, b) {
    if (b.y < player.y - 20) b.setVelocity((b.x - player.x) * 15 + player.body.velocity.x * 0.5, -850);
    else b.setVelocity((b.x - player.x) * 5, (b.y - player.y) * 5);
}

function update() {
    if (!gameActive) return;
    if (isHost) {
        if (!goalLock) {
            if (cursors.left.isDown) p1.setVelocityX(-400); else if (cursors.right.isDown) p1.setVelocityX(400); else p1.setVelocityX(0);
            if (cursors.up.isDown && p1.body.blocked.down) p1.setVelocityY(-950);
            if (shootKeys.flat.isDown && p1CanShoot) doShoot(p1, 1, 1, this, 'flat');
            if (shootKeys.high.isDown && p1CanShoot) doShoot(p1, 1, 1, this, 'high');
            if (remoteKeys.left) p2.setVelocityX(-400); else if (remoteKeys.right) p2.setVelocityX(400); else p2.setVelocityX(0);
            if (remoteKeys.up && p2.body.blocked.down) p2.setVelocityY(-950);
            if (remoteKeys.flat && !prevRemoteKeys.flat && p2CanShoot) doShoot(p2, -1, 2, this, 'flat');
            if (remoteKeys.high && !prevRemoteKeys.high && p2CanShoot) doShoot(p2, -1, 2, this, 'high');
            prevRemoteKeys.flat = remoteKeys.flat; prevRemoteKeys.high = remoteKeys.high;
        }
        p1Leg.setPosition(p1.x - 5, p1.y + 35); p2Leg.setPosition(p2.x + 5, p2.y + 35);
        if(!p1Leg.isKicking) p1Leg.setAngle(0); if(!p2Leg.isKicking) p2Leg.setAngle(0);
        if (conn && conn.open) conn.send({ type: 'state', state: { p1: { x: p1.x, y: p1.y, la: p1Leg.angle }, p2: { x: p2.x, y: p2.y, la: p2Leg.angle }, b: { x: ball.x, y: ball.y, r: ball.rotation }, sRed: sRed, sBlue: sBlue, time: timeLeft, msg: currentGoalMsg } });
    } else if (conn && conn.open) {
        conn.send({ type: 'input', keys: { up: cursors.up.isDown, left: cursors.left.isDown, right: cursors.right.isDown, flat: shootKeys.flat.isDown, high: shootKeys.high.isDown } });
    }
}

function updateClientState(data) {
    if (!gameActive) return;
    p1.setPosition(data.p1.x, data.p1.y); p1Leg.setPosition(p1.x - 5, p1.y + 35).setAngle(data.p1.la);
    p2.setPosition(data.p2.x, data.p2.y); p2Leg.setPosition(p2.x + 5, p2.y + 35).setAngle(data.p2.la);
    ball.setPosition(data.b.x, data.b.y).setRotation(data.b.r);
    document.getElementById('score-red').innerText = data.sRed;
    document.getElementById('score-blue').innerText = data.sBlue;
    let m = Math.floor(data.time / 60), s = data.time % 60;
    document.getElementById('timer-display').innerText = `0${m}:${s < 10 ? '0'+s : s}`;
    if (data.msg !== currentGoalMsg) { currentGoalMsg = data.msg; if (currentGoalMsg !== "") playGoalAnimation(game.scene.scenes[0], currentGoalMsg); }
}

function doShoot(p, dir, pid, scene, type) {
    let leg = (pid === 1) ? p1Leg : p2Leg;
    let dist = Phaser.Math.Distance.Between(leg.x + (dir * 30), leg.y, ball.x, ball.y);
    leg.isKicking = true;
    let ang = (type === 'flat') ? (pid === 1 ? -30 : 30) : (pid === 1 ? -70 : 70);
    scene.tweens.add({ targets: leg, angle: ang, duration: 100, yoyo: true, onComplete: () => leg.isKicking = false });
    if (dist < 90) { 
        let px = (type === 'flat') ? 1100 : 700, py = (type === 'flat') ? -250 : -950;
        ball.setVelocity(dir * px, py);
    }
    if (pid === 1) { p1CanShoot = false; setTimeout(() => p1CanShoot = true, 300); } else { p2CanShoot = false; setTimeout(() => p2CanShoot = true, 300); }
}

function goal(scorer, scene) {
    if (goalLock || !gameActive || !isHost) return;
    goalLock = true;
    if (scorer === 2) sBlue++; else sRed++;
    document.getElementById('score-red').innerText = sRed; document.getElementById('score-blue').innerText = sBlue;
    currentGoalMsg = "GOOOOOL!";
    playGoalAnimation(scene, currentGoalMsg);
    setTimeout(() => { 
        if (!gameActive) return; 
        currentGoalMsg = ""; p1.setPosition(300, 400); p2.setPosition(1100, 400); ball.setPosition(700, 150).setVelocity(0,0);
        goalLock = false; 
    }, 2500);
}

function playGoalAnimation(scene, msg) {
    goalAnnouncerText.setText(msg).setAlpha(1).setScale(0.2);
    scene.tweens.add({ targets: goalAnnouncerText, scale: 1, duration: 800, ease: 'Elastic.easeOut', onComplete: () => { scene.tweens.add({ targets: goalAnnouncerText, alpha: 0, delay: 1000, duration: 500 }); } });
}

function startTimer() {
    timerInterval = setInterval(() => { 
        if(goalLock || !gameActive) return; 
        timeLeft--; 
        if (timeLeft <= 0) { 
            clearInterval(timerInterval); 
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