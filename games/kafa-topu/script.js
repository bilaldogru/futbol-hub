const config = {
    type: Phaser.AUTO,
    width: 1400,  // YENİ: Saha iyice uzatıldı!
    height: 600,
    parent: 'game-container',
    transparent: true,
    scale: {
        mode: Phaser.Scale.FIT, // Ekrana taşıyıp bozulmasın diye otomatik ölçekler
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 2400 }, debug: false }
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let p1, p2, ball;
let cursors, wasdKeys, shootKeys;
let sRed = 0, sBlue = 0;
let goalLock = false;
let p1CanShoot = true, p2CanShoot = true;
let gameActive = true; 

// Zamanlayıcı Değişkenleri
let timeLeft = 60; // 1 Dakika
let timerInterval;

function preload() {
    let gfx = this.add.graphics();
    
    // Zemin: 1400 Genişliğe uyarlandı
    gfx.fillStyle(0x0a0a0c, 0.9); gfx.fillRect(0, 0, 1400, 80);
    gfx.lineStyle(4, 0xe67e22, 1); gfx.beginPath(); gfx.moveTo(0, 0); gfx.lineTo(1400, 0); gfx.strokePath();
    gfx.generateTexture('ground', 1400, 80);
    
    // Direk
    gfx.clear(); gfx.fillStyle(0xffffff, 1); gfx.fillRect(0, 0, 80, 10); gfx.generateTexture('post_h', 80, 10);
    
    // SOL KALE
    gfx.clear();
    gfx.lineStyle(2, 0xffffff, 0.2); 
    for(let i=0; i<=80; i+=15) { gfx.moveTo(i,0); gfx.lineTo(i,200); }
    for(let i=0; i<=200; i+=15) { gfx.moveTo(0,i); gfx.lineTo(80,i); }
    gfx.strokePath();
    gfx.lineStyle(6, 0xe67e22, 1); 
    gfx.beginPath(); gfx.moveTo(0,0); gfx.lineTo(80,0); gfx.lineTo(80,200); gfx.strokePath();
    gfx.generateTexture('goal_left', 80, 200);

    // SAĞ KALE
    gfx.clear();
    gfx.lineStyle(2, 0xffffff, 0.2); 
    for(let i=0; i<=80; i+=15) { gfx.moveTo(i,0); gfx.lineTo(i,200); }
    for(let i=0; i<=200; i+=15) { gfx.moveTo(0,i); gfx.lineTo(80,i); }
    gfx.strokePath();
    gfx.lineStyle(6, 0xe67e22, 1); 
    gfx.beginPath(); gfx.moveTo(80,0); gfx.lineTo(0,0); gfx.lineTo(0,200); gfx.strokePath();
    gfx.generateTexture('goal_right', 80, 200);
    
    // Mavi Oyuncu (P1 - Sağ)
    gfx.clear(); gfx.fillStyle(0x111111, 1); gfx.fillCircle(35, 35, 33); 
    gfx.lineStyle(4, 0x1e90ff, 1); gfx.strokeCircle(35, 35, 33); 
    gfx.fillStyle(0x1e90ff, 1); gfx.fillRect(15, 20, 45, 15); 
    gfx.generateTexture('p1', 70, 70); 
    
    // Kırmızı Oyuncu (P2 - Sol)
    gfx.clear(); gfx.fillStyle(0x111111, 1); gfx.fillCircle(35, 35, 33); 
    gfx.lineStyle(4, 0xff4757, 1); gfx.strokeCircle(35, 35, 33); 
    gfx.fillStyle(0xff4757, 1); gfx.fillRect(10, 20, 45, 15); 
    gfx.generateTexture('p2', 70, 70);
    
    // Top
    gfx.clear(); gfx.fillStyle(0xffffff, 1); gfx.fillCircle(25, 25, 23);
    gfx.lineStyle(4, 0x000000, 1);
    gfx.beginPath(); gfx.moveTo(25, 0); gfx.lineTo(25, 50); gfx.strokePath();
    gfx.beginPath(); gfx.moveTo(0, 25); gfx.lineTo(50, 25); gfx.strokePath();
    gfx.generateTexture('ball', 50, 50);
    
    gfx.destroy(); 
}

function create() {
    // 1. SORUNUN ÇÖZÜMÜ: Topun dibe gömülmesini kesin engellemek için sınırları katı belirledik (Y: 540)
    this.physics.world.setBounds(0, 0, 1400, 540);

    const platforms = this.physics.add.staticGroup();
    let ground = platforms.create(700, 580, 'ground'); 
    ground.refreshBody();

    // Kaleler geniş sahaya göre yerleştirildi (40 ve 1360)
    this.add.image(40, 440, 'goal_left').setDepth(0);
    this.add.image(1360, 440, 'goal_right').setDepth(0);

    platforms.create(40, 345, 'post_h'); 
    platforms.create(1360, 345, 'post_h'); 

    let leftGoal = this.add.zone(40, 460, 70, 160); this.physics.add.existing(leftGoal, true);
    let rightGoal = this.add.zone(1360, 460, 70, 160); this.physics.add.existing(rightGoal, true);

    p2 = this.physics.add.sprite(300, 400, 'p2').setDepth(1); 
    p2.setBounce(0.0).setCollideWorldBounds(true).setCircle(35).setMass(2);

    p1 = this.physics.add.sprite(1100, 400, 'p1').setDepth(1); 
    p1.setBounce(0.0).setCollideWorldBounds(true).setCircle(35).setMass(2);

    ball = this.physics.add.sprite(700, 200, 'ball').setDepth(1);
    ball.setBounce(0.85).setCollideWorldBounds(true).setCircle(25).setMass(1).setDrag(15);

    this.physics.add.collider(p1, platforms);
    this.physics.add.collider(p2, platforms);
    this.physics.add.collider(ball, platforms);
    this.physics.add.collider(p1, ball);
    this.physics.add.collider(p2, ball);
    this.physics.add.collider(p1, p2);

    this.physics.add.overlap(ball, leftGoal, () => goal(1), null, this);
    this.physics.add.overlap(ball, rightGoal, () => goal(2), null, this);

    cursors = this.input.keyboard.createCursorKeys();
    wasdKeys = this.input.keyboard.addKeys({ up: 'W', left: 'A', right: 'D' });
    shootKeys = this.input.keyboard.addKeys({ p1: 'ENTER', p2: 'SPACE' });

    // Sayacı Başlat
    startTimer();
}

function update() {
    // Maç bittiyse veya gol olduysa hareket durur
    if (goalLock || !gameActive) return;

    if (cursors.left.isDown) p1.setVelocityX(-450);
    else if (cursors.right.isDown) p1.setVelocityX(450);
    else p1.setVelocityX(0);

    if (cursors.up.isDown && p1.body.blocked.down) p1.setVelocityY(-900);
    if (Phaser.Input.Keyboard.JustDown(shootKeys.p1) && p1CanShoot) doShoot(p1, -1, 1);

    if (wasdKeys.left.isDown) p2.setVelocityX(-450);
    else if (wasdKeys.right.isDown) p2.setVelocityX(450);
    else p2.setVelocityX(0);

    if (wasdKeys.up.isDown && p2.body.blocked.down) p2.setVelocityY(-900);
    if (Phaser.Input.Keyboard.JustDown(shootKeys.p2) && p2CanShoot) doShoot(p2, 1, 2);
}

function doShoot(p, dir, pid) {
    let dist = Phaser.Math.Distance.Between(p.x, p.y, ball.x, ball.y);
    if (dist < 85) { 
        ball.setVelocity(dir * 1000, -600); 
        if (pid === 1) { p1CanShoot = false; setTimeout(() => p1CanShoot = true, 400); }
        else { p2CanShoot = false; setTimeout(() => p2CanShoot = true, 400); }
    }
}

function goal(scorer) {
    if (goalLock || !gameActive) return;
    goalLock = true;
    
    // HTML'deki Skoru Güncelle
    if (scorer === 1) {
        sBlue++; // Sol kaleye (kırmızının kalesine) gol atıldıysa P1(Mavi) atmıştır
        document.getElementById('score-blue').innerText = sBlue;
    } else {
        sRed++; // Sağ kaleye gol atıldıysa P2(Kırmızı) atmıştır
        document.getElementById('score-red').innerText = sRed;
    }
    
    // Tabelaya animasyon ver
    const scoreBoard = document.querySelector('.score-board');
    scoreBoard.style.transform = 'scale(1.2)';
    setTimeout(() => scoreBoard.style.transform = 'scale(1)', 300);

    ball.setVelocity(0, 0); p1.setVelocity(0, 0); p2.setVelocity(0, 0);
    ball.body.allowGravity = false;
    
    setTimeout(() => {
        if (!gameActive) return; // Maç bittiyse ışınlama yapma
        p2.setPosition(300, 400); p1.setPosition(1100, 400);
        ball.setPosition(700, 150); ball.setVelocity(0, 0);
        ball.body.allowGravity = true; goalLock = false;
    }, 2000);
}

// --- ZAMANLAYICI FONKSİYONU ---
function startTimer() {
    const timeDisplay = document.getElementById('timer-display');
    
    timerInterval = setInterval(() => {
        if(goalLock || !gameActive) return; // Gol sevincinde süre akmasın
        
        timeLeft--;
        
        // Dakika ve Saniye hesaplama
        let m = Math.floor(timeLeft / 60);
        let s = timeLeft % 60;
        timeDisplay.innerText = `0${m}:${s < 10 ? '0'+s : s}`;
        
        // Son 10 saniye uyarı rengi
        if(timeLeft <= 10) {
            timeDisplay.style.backgroundColor = '#ff4757';
            timeDisplay.style.color = '#fff';
        }

        // Süre Bittiğinde
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000);
}

// --- MAÇ BİTİŞ FONKSİYONU ---
function endGame() {
    gameActive = false;
    
    // Herkesi dondur
    ball.setVelocity(0, 0); p1.setVelocity(0, 0); p2.setVelocity(0, 0);
    ball.body.allowGravity = false; p1.body.allowGravity = false; p2.body.allowGravity = false;
    
    // Maç bitti ekranını göster
    document.getElementById('game-over-screen').style.display = 'flex';
}