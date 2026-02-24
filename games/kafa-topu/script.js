const config = {
    type: Phaser.AUTO,
    width: 1400,  
    height: 600,
    parent: 'game-container',
    transparent: true,
    scale: {
        mode: Phaser.Scale.FIT, 
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 2800 }, debug: false } 
    },
    scene: { preload: preload, create: create, update: update }
};

const game = new Phaser.Game(config);

let p1, p2, p1Leg, p2Leg, ball;
let cursors, wasdKeys, shootKeys;
let sRed = 0, sBlue = 0;
let goalLock = false;
let p1CanShoot = true, p2CanShoot = true;
let gameActive = true; 
let timeLeft = 60; 
let timerInterval;

const goalMessages = [
    "GOOOOOL!", "HARİKA BİR ŞUT!", "AĞLARI SARSTI!", 
    "MÜKEMMEL VURUŞ!", "ÇOK KLAS BİR GOL!", "KALECİ BAKAKALDI!"
];
let goalAnnouncerText;

function preload() {
    this.load.image('proBall', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Soccer_ball.svg/240px-Soccer_ball.svg.png');

    let gfx = this.add.graphics();
    
    // Zemin (Y: 530'dan başlar, yüksekliği 80)
    gfx.fillStyle(0x0a0a0c, 0.9); gfx.fillRect(0, 0, 1400, 80);
    gfx.lineStyle(4, 0xe67e22, 1); gfx.beginPath(); gfx.moveTo(0, 0); gfx.lineTo(1400, 0); gfx.strokePath();
    gfx.generateTexture('ground', 1400, 80);
    
    gfx.clear(); gfx.fillStyle(0xffffff, 1); gfx.fillRect(0, 0, 80, 10); gfx.generateTexture('post_h', 80, 10);
    drawGoal(gfx, 'goal_left', true);
    drawGoal(gfx, 'goal_right', false);
    
    // --- PİKSEL ART KARAKTER ÇİZİMİ ---
    const pixelSize = 6; 
    const headArt = [
        "...TTTTTT...", ".TTTTTTTTTT.", "111111111111", "111111111111",
        "111334113341", "111334113341", "111111111111", "111115555111", 
        ".1111111111.", "...111111..."
    ];
    const shoeArt = [
        "...2222...", "...2222...", "1111111...",
        "111441111.", "1111111111", ".3..3..3.."
    ];

    createPixelTexture(gfx, 'p2_head', headArt, { '1': 0xcccccc, '3': 0xffffff, '4': 0x000000, '5': 0x555555, 'T': 0xff4757 }, pixelSize);
    createPixelTexture(gfx, 'p1_head', headArt, { '1': 0xcccccc, '3': 0xffffff, '4': 0x000000, '5': 0x555555, 'T': 0x1e90ff }, pixelSize);
    createPixelTexture(gfx, 'p2_shoe', shoeArt, { '1': 0xff4757, '2': 0xeeeeee, '3': 0x111111, '4': 0xffffff }, pixelSize);
    createPixelTexture(gfx, 'p1_shoe', shoeArt, { '1': 0x1e90ff, '2': 0xeeeeee, '3': 0x111111, '4': 0xffffff }, pixelSize);

    gfx.destroy(); 
}

function createPixelTexture(gfx, key, art, palette, pSize) {
    gfx.clear();
    for (let y = 0; y < art.length; y++) {
        for (let x = 0; x < art[y].length; x++) {
            let char = art[y][x];
            if (char !== '.') {
                gfx.fillStyle(palette[char], 1);
                gfx.fillRect(x * pSize, y * pSize, pSize, pSize);
            }
        }
    }
    gfx.generateTexture(key, art[0].length * pSize, art.length * pSize);
}

function drawGoal(gfx, name, isLeft) {
    gfx.clear();
    gfx.lineStyle(2, 0xffffff, 0.2); 
    for(let i=0; i<=80; i+=15) { gfx.moveTo(i,0); gfx.lineTo(i,200); }
    for(let i=0; i<=200; i+=15) { gfx.moveTo(0,i); gfx.lineTo(80,i); }
    gfx.strokePath();
    gfx.lineStyle(6, 0xe67e22, 1); 
    gfx.beginPath(); 
    if(isLeft) { gfx.moveTo(0,0); gfx.lineTo(80,0); gfx.lineTo(80,200); }
    else { gfx.moveTo(80,0); gfx.lineTo(0,0); gfx.lineTo(0,200); }
    gfx.strokePath();
    gfx.generateTexture(name, 80, 200);
}

function create() {
    // 1. ZEMİN DÜZELTİLDİ: Sınır 550px'e çekildi. Top artık görselin üzerine tam oturacak.
    this.physics.world.setBounds(0, 0, 1400, 550);

    const platforms = this.physics.add.staticGroup();
    // Zemin görseli Y:530'da başlıyor ama merkezi 570'de (530 + 80/2)
    let ground = platforms.create(700, 570, 'ground'); 
    ground.refreshBody();

    let ceiling = this.add.rectangle(700, -10, 1400, 20, 0x000000, 0); 
    this.physics.add.existing(ceiling, true); 
    platforms.add(ceiling);

    this.add.image(40, 440, 'goal_left').setDepth(0);
    this.add.image(1360, 440, 'goal_right').setDepth(0);
    platforms.create(40, 345, 'post_h'); platforms.create(1360, 345, 'post_h'); 

    let leftGoal = this.add.zone(40, 460, 70, 160); this.physics.add.existing(leftGoal, true);
    let rightGoal = this.add.zone(1360, 460, 70, 160); this.physics.add.existing(rightGoal, true);

    p2 = this.physics.add.sprite(300, 400, 'p2_head').setDepth(2); 
    p2.setBounce(0.2).setCollideWorldBounds(true).setCircle(30, 6, 0).setMass(3); 

    p1 = this.physics.add.sprite(1100, 400, 'p1_head').setDepth(2); 
    p1.setFlipX(true); 
    p1.setBounce(0.2).setCollideWorldBounds(true).setCircle(30, 6, 0).setMass(3);

    p2Leg = this.add.sprite(p2.x, p2.y, 'p2_shoe').setDepth(1).setOrigin(0.3, 0.5); 
    p2Leg.isKicking = false;
    p1Leg = this.add.sprite(p1.x, p1.y, 'p1_shoe').setDepth(1).setOrigin(0.7, 0.5); 
    p1Leg.setFlipX(true);
    p1Leg.isKicking = false;

    ball = this.physics.add.sprite(700, 200, 'proBall').setDepth(3).setScale(0.22);
    ball.setCircle(ball.width / 2); 
    ball.setBounce(0.7); 
    ball.setMass(1.2);   
    ball.setDrag(150, 10); 
    ball.setCollideWorldBounds(true); 

    this.physics.add.collider(p1, platforms);
    this.physics.add.collider(p2, platforms);
    this.physics.add.collider(ball, platforms);
    
    this.physics.add.collider(p1, p2, () => {
        let pushForce = 300;
        if (p1.x < p2.x) { p1.setVelocityX(-pushForce); p2.setVelocityX(pushForce); } 
        else { p1.setVelocityX(pushForce); p2.setVelocityX(-pushForce); }
    });

    // 2. YENİ GELİŞMİŞ KAFA VURUŞU ÇARPIŞMASI
    this.physics.add.collider(p1, ball, () => handleHeaderCollision(p1, ball));
    this.physics.add.collider(p2, ball, () => handleHeaderCollision(p2, ball));

    this.physics.add.overlap(ball, leftGoal, () => goal(1, this), null, this);
    this.physics.add.overlap(ball, rightGoal, () => goal(2, this), null, this);

    cursors = this.input.keyboard.createCursorKeys();
    wasdKeys = this.input.keyboard.addKeys({ up: 'W', left: 'A', right: 'D' });
    shootKeys = this.input.keyboard.addKeys({ p1Flat: 'K', p1High: 'L', p2Flat: 'F', p2High: 'G' });

    goalAnnouncerText = this.add.text(700, 250, '', { 
        fontSize: '60px', fill: '#ffd700', fontFamily: 'Rajdhani', fontStyle: 'bold', 
        shadow: { offsetX: 3, offsetY: 3, color: '#ff4757', blur: 10, fill: true },
        stroke: '#000', strokeThickness: 6
    }).setOrigin(0.5).setAlpha(0).setDepth(10);

    startTimer();
}

// YENİ: Gelişmiş Kafa Vuruşu ve Vücut Çarpışması Fonksiyonu
function handleHeaderCollision(player, b) {
    // Top oyuncunun merkezinin (göz hizasının) üstünde mi?
    let isHeader = b.y < player.y - 20;

    if (isHeader) {
        // KAFA VURUŞU!
        // Topun kafanın merkezinden ne kadar uzakta (sağda/solda) olduğunu bul
        let offsetX = b.x - player.x;

        // Güçlü bir yukarı fırlatma kuvveti (Kafa atma hissi)
        let jumpPowerY = -850; 

        // Yatay kuvvet: Merkeze çarparsa az, köşelere çarparsa çok
        let pushX = offsetX * 15; 

        // Oyuncunun koşu momentumunu da ekle (Daha gerçekçi)
        pushX += player.body.velocity.x * 0.5;

        b.setVelocity(pushX, jumpPowerY);
    } else {
        // VÜCUT ÇARPIŞMASI (Daha zayıf itme, sadece yapışmayı önler)
        let angle = Phaser.Math.Angle.Between(player.x, player.y, b.x, b.y);
        let force = 200; 
        b.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
        // Eğer top kafanın üstünde duruyorsa hafif zıplat
        if (Math.abs(b.body.velocity.y) < 50 && b.y < player.y) {
             b.setVelocityY(-150);
        }
    }
}

function update() {
    if (goalLock || !gameActive) return;
    if (ball.body.velocity.x !== 0) ball.rotation += ball.body.velocity.x * 0.0003; 
    p1Leg.setPosition(p1.x - 5, p1.y + 35);
    p2Leg.setPosition(p2.x + 5, p2.y + 35);
    if(!p1Leg.isKicking) p1Leg.setAngle(0); 
    if(!p2Leg.isKicking) p2Leg.setAngle(0);

    if (cursors.left.isDown) p1.setVelocityX(-400); else if (cursors.right.isDown) p1.setVelocityX(400); else p1.setVelocityX(0);
    if (cursors.up.isDown && p1.body.blocked.down) p1.setVelocityY(-950);
    if (Phaser.Input.Keyboard.JustDown(shootKeys.p1Flat) && p1CanShoot) doShoot(p1, -1, 1, this, 'flat');
    if (Phaser.Input.Keyboard.JustDown(shootKeys.p1High) && p1CanShoot) doShoot(p1, -1, 1, this, 'high');
    if (wasdKeys.left.isDown) p2.setVelocityX(-400); else if (wasdKeys.right.isDown) p2.setVelocityX(400); else p2.setVelocityX(0);
    if (wasdKeys.up.isDown && p2.body.blocked.down) p2.setVelocityY(-950);
    if (Phaser.Input.Keyboard.JustDown(shootKeys.p2Flat) && p2CanShoot) doShoot(p2, 1, 2, this, 'flat');
    if (Phaser.Input.Keyboard.JustDown(shootKeys.p2High) && p2CanShoot) doShoot(p2, 1, 2, this, 'high');
}

function doShoot(p, dir, pid, scene, shotType) {
    let leg = (pid === 1) ? p1Leg : p2Leg;
    let dist = Phaser.Math.Distance.Between(leg.x + (dir * 30), leg.y, ball.x, ball.y);
    leg.isKicking = true;
    let targetAngle = (shotType === 'flat') ? (pid === 1 ? 30 : -30) : (pid === 1 ? 70 : -70);
    scene.tweens.add({ targets: leg, angle: targetAngle, duration: 100, yoyo: true, ease: 'Quad.easeOut', onComplete: () => { leg.isKicking = false; } });
    if (dist < 90) { 
        let powerX = (shotType === 'flat') ? 1100 : 700; let powerY = (shotType === 'flat') ? -250 : -950;
        if (shotType === 'high' && ball.y < p.y) { powerY -= 300; powerX += 100; }
        ball.setVelocity(dir * powerX, powerY);
    }
    if (pid === 1) { p1CanShoot = false; setTimeout(() => p1CanShoot = true, 300); } else { p2CanShoot = false; setTimeout(() => p2CanShoot = true, 300); }
}

function goal(scorer, scene) {
    if (goalLock || !gameActive) return;
    goalLock = true;
    if (scorer === 1) { sBlue++; document.getElementById('score-blue').innerText = sBlue; } else { sRed++; document.getElementById('score-red').innerText = sRed; }
    const scoreBoard = document.querySelector('.score-board');
    scoreBoard.style.transform = 'scale(1.2)';
    setTimeout(() => scoreBoard.style.transform = 'scale(1)', 300);
    p1.setVelocity(0, 0); p2.setVelocity(0, 0); p1.body.allowGravity = false; p2.body.allowGravity = false;

    let randomMsg = goalMessages[Math.floor(Math.random() * goalMessages.length)];
    goalAnnouncerText.setText(randomMsg);
    goalAnnouncerText.setAlpha(1).setScale(0.2).setAngle(-10);
    scene.tweens.add({
        targets: goalAnnouncerText, scale: 1.0, angle: 0, duration: 800, ease: 'Elastic.easeOut', 
        onComplete: () => { scene.tweens.add({targets: goalAnnouncerText, alpha: 0, delay: 1000, duration: 500}); }
    });
    setTimeout(() => { if (!gameActive) return; p2.setPosition(300, 400); p1.setPosition(1100, 400); ball.setPosition(700, 150); ball.setVelocity(0, 0); p1.body.allowGravity = true; p2.body.allowGravity = true; goalLock = false; }, 2500);
}

function startTimer() {
    const timeDisplay = document.getElementById('timer-display');
    timerInterval = setInterval(() => { if(goalLock || !gameActive) return; timeLeft--; let m = Math.floor(timeLeft / 60); let s = timeLeft % 60; timeDisplay.innerText = `0${m}:${s < 10 ? '0'+s : s}`; if(timeLeft <= 10) { timeDisplay.style.backgroundColor = '#ff4757'; timeDisplay.style.color = '#fff'; } if (timeLeft <= 0) { clearInterval(timerInterval); endGame(); } }, 1000);
}

function endGame() {
    gameActive = false; ball.setVelocity(0, 0); p1.setVelocity(0, 0); p2.setVelocity(0, 0); ball.body.allowGravity = false; p1.body.allowGravity = false; p2.body.allowGravity = false; document.getElementById('game-over-screen').style.display = 'flex';
}