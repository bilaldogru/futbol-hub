// Global Değişkenler
let oyuncular = [];
let hedefOyuncu = {};
let oyunBitti = false;
let denemeSayisi = 0;
const maxHak = 5;

// DOM Elementleri
const input = document.getElementById('playerInput');
const autocompleteList = document.getElementById('autocomplete-list');
const submitBtn = document.getElementById('submitBtn');
const hakGosterge = document.getElementById('hakGosterge');

// SAYFA YÜKLENİNCE VERİLERİ ÇEK
document.addEventListener('DOMContentLoaded', () => {
    fetch('../../oyuncular.json')
        .then(response => response.json())
        .then(data => {
            oyuncular = data;
            oyunuBaslat(); 
        })
        .catch(err => {
            console.error("Veri çekme hatası:", err);
            alert("Oyuncu listesi yüklenemedi!");
        });
});

// --- FIREBASE ENTEGRASYONLU BAŞLATMA (v9 Modüler Yapı İçin) ---
async function oyunuBaslat() {
    // window.db yüklenene kadar biraz bekle (hata almamak için)
    if (!window.db) {
        setTimeout(oyunuBaslat, 100);
        return;
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`; 

    try {
        // v9 Kullanımı
        const docRef = window.doc(window.db, "daily_footle", dateString);
        const docSnap = await window.getDoc(docRef);

        if (docSnap.exists()) {
            console.log("✅ Footle hedefi Firebase'den çekildi.");
            const targetName = docSnap.data().player;
            hedefOyuncu = oyuncular.find(p => p.isim === targetName) || oyuncular[0];
        } else {
            console.log("⚡ Footle hedefi yok. Sistem seçiyor ve kaydediyor...");
            
            const seed = year * 10000 + (today.getMonth() + 1) * 100 + today.getDate() + 99;
            let m = oyuncular.length;
            const random = () => { var x = Math.sin(seed) * 10000; return x - Math.floor(x); };
            const randomIndex = Math.floor(random() * m);
            
            hedefOyuncu = oyuncular[randomIndex];

            // Seçileni kaydet (v9)
            await window.setDoc(docRef, {
                player: hedefOyuncu.isim,
                createdAt: new Date()
            });
            console.log("💾 Seçim Firebase'e kaydedildi!");
        }
    } catch (error) {
        console.error("Firebase Hatası, yerel mod başlatılıyor:", error);
        hedefOyuncu = oyuncular[Math.floor(Math.random() * oyuncular.length)];
    }

    console.log("Hedef:", hedefOyuncu.isim); 
}

// AUTOCOMPLETE
input.addEventListener('input', function() {
    const val = this.value.trim().toLowerCase();
    autocompleteList.innerHTML = '';
    
    if (!val || oyunBitti) { 
        autocompleteList.classList.add('hidden'); 
        return; 
    }

    const matches = oyuncular.filter(o => o.isim.toLowerCase().includes(val)).slice(0, 5);
    
    if (matches.length > 0) {
        autocompleteList.classList.remove('hidden');
        matches.forEach(m => {
            const item = document.createElement('div');
            item.className = "p-3 hover:bg-green-900/50 cursor-pointer border-b border-gray-700 last:border-0 text-white font-semibold";
            item.innerText = m.isim;
            
            item.onclick = () => {
                input.value = m.isim;
                autocompleteList.classList.add('hidden');
                tahminYap();
            };
            autocompleteList.appendChild(item);
        });
    } else { 
        autocompleteList.classList.add('hidden'); 
    }
});

function tahminYap() {
    if (oyunBitti) return;
    
    const isim = input.value.trim();
    const tahmin = oyuncular.find(o => o.isim.toLowerCase() === isim.toLowerCase());
    
    if (!tahmin) {
        alert("Lütfen listeden geçerli bir oyuncu seçin!");
        return;
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
        { val: tahmin.uyruk, target: hedefOyuncu.uyruk, type: 'text' },
        { val: tahmin.lig, target: hedefOyuncu.lig, type: 'text' },
        { val: tahmin.takim, target: hedefOyuncu.takim, type: 'text' },
        { val: tahmin.pozisyon, target: hedefOyuncu.pozisyon, type: 'text' },
        { val: tahmin.yas, target: hedefOyuncu.yas, type: 'number' }
    ];

    kriterler.forEach((k, i) => {
        const card = document.createElement('div');
        card.className = "flip-card h-full w-full";
        
        let renk = "wrong";
        if (k.val === k.target) renk = "correct";
        else if (k.type === 'number') renk = "partial"; 

        let icerik = k.val;
        if (k.type === 'number' && k.val !== k.target) {
            icerik += k.val < k.target ? ' ↑' : ' ↓';
        }

        card.innerHTML = `
            <div class="flip-inner h-full w-full">
                <div class="flip-front"></div>
                <div class="flip-back ${renk} font-bold text-[10px] sm:text-xs">
                    ${icerik}
                </div>
            </div>`;
            
        row.appendChild(card);
        
        setTimeout(() => { 
            card.classList.add('flipped'); 
            card.style.opacity = "1"; 
        }, i * 300);
    });

    board.appendChild(row);
    setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
}

function bitir(kazandi) {
    oyunBitti = true;
    input.disabled = true;
    submitBtn.disabled = true;

    const modal = document.getElementById('endModal');
    const content = document.getElementById('modalContent');
    const emoji = document.getElementById('modalEmoji');
    const title = document.getElementById('modalTitle');
    const desc = document.getElementById('modalDescription');
    const targetName = document.getElementById('targetPlayerName');
    
    const resultStats = document.getElementById('resultStats');
    const gainedScoreEl = document.getElementById('gainedScore');
    const newTotalScoreEl = document.getElementById('newTotalScore');

    targetName.innerText = hedefOyuncu.isim.toUpperCase();

    if (kazandi) {
        const kazanilanPuan = (6 - denemeSayisi) * 100;
        const yeniToplamPuan = addGlobalScore(kazanilanPuan);

        content.classList.remove('border-red-500', 'shadow-[0_0_50px_rgba(239,68,68,0.3)]');
        content.classList.add('border-green-500', 'shadow-[0_0_50px_rgba(34,197,94,0.3)]');
        
        emoji.innerText = "🏆";
        title.innerText = "TEBRİKLER!";
        title.className = "text-3xl font-black mb-2 tracking-tighter text-green-400";
        desc.innerText = `${denemeSayisi}. denemede doğru bildin.`;

        gainedScoreEl.innerText = kazanilanPuan;
        newTotalScoreEl.innerText = yeniToplamPuan;
        resultStats.classList.remove('hidden'); 

    } else {
        content.classList.remove('border-green-500', 'shadow-[0_0_50px_rgba(34,197,94,0.3)]');
        content.classList.add('border-red-500', 'shadow-[0_0_50px_rgba(239,68,68,0.3)]');
        
        emoji.innerText = "❌";
        title.innerText = "MAÇ BİTTİ";
        title.className = "text-3xl font-black mb-2 tracking-tighter text-red-500";
        desc.innerText = "Hakların tükendi. Bir dahaki sefere!";
        
        resultStats.classList.add('hidden');
    }

    const puan = (maxHak - denemeSayisi + 1) * 100; 
    
    if(window.saveScoreToFirebase) {
        setTimeout(() => {
            window.saveScoreToFirebase(puan, "Footle");
        }, 1000);
    }

    modal.classList.remove('hidden');
}

submitBtn.addEventListener('click', tahminYap);
input.addEventListener('keypress', (e) => { if (e.key === 'Enter') tahminYap(); });
document.addEventListener('click', (e) => { 
    if (e.target !== input && e.target !== autocompleteList) {
        autocompleteList.classList.add('hidden'); 
    }
});

function addGlobalScore(points) {
    let currentScore = parseInt(localStorage.getItem('futbolHub_totalScore')) || 0;
    currentScore += points;
    localStorage.setItem('futbolHub_totalScore', currentScore);
    console.log(`${points} puan eklendi. Yeni Toplam: ${currentScore}`);
    return currentScore;
}