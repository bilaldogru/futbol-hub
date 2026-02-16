// games/footle/script.js

// OYUNCU VERİTABANI
const oyuncular = [
    { isim: "Mauro Icardi", uyruk: "🇦🇷", lig: "Süper Lig", takim: "GS", pozisyon: "ATT", yas: 31 },
    { isim: "Edin Dzeko", uyruk: "🇧🇦", lig: "Süper Lig", takim: "FB", pozisyon: "ATT", yas: 37 },
    { isim: "Arda Guler", uyruk: "🇹🇷", lig: "La Liga", takim: "RMA", pozisyon: "MID", yas: 19 },
    { isim: "Hakan Calhanoglu", uyruk: "🇹🇷", lig: "Serie A", takim: "INT", pozisyon: "MID", yas: 30 },
    { isim: "Victor Osimhen", uyruk: "🇳🇬", lig: "Süper Lig", takim: "GS", pozisyon: "ATT", yas: 25 },
    { isim: "Kerem Akturkoglu", uyruk: "🇹🇷", lig: "Premier L.", takim: "BJK", pozisyon: "MID", yas: 25 },
    { isim: "Ciro Immobile", uyruk: "🇮🇹", lig: "Süper Lig", takim: "BJK", pozisyon: "ATT", yas: 34 },
    { isim: "Fred", uyruk: "🇧🇷", lig: "Süper Lig", takim: "FB", pozisyon: "MID", yas: 31 }
];

// GÜNLÜK HEDEF SEÇİMİ
const hedefOyuncu = oyuncular[Math.floor(Math.random() * oyuncular.length)];
let oyunBitti = false;
let denemeSayisi = 0;
const maxHak = 5;

// DOM ELEMENTLERİ
const input = document.getElementById('playerInput');
const autocompleteList = document.getElementById('autocomplete-list');
const submitBtn = document.getElementById('submitBtn');
const hakGosterge = document.getElementById('hakGosterge');

console.log("Hedef (Kopya):", hedefOyuncu.isim);

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

// TAHMİN FONKSİYONU
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

// OYUN BİTİRME FONKSİYONU (Refaktör Edildi: Artık HTML içinde geziyor)
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
    
    // Yeni eklediğimiz statik HTML elementleri
    const resultStats = document.getElementById('resultStats');
    const gainedScoreEl = document.getElementById('gainedScore');
    const newTotalScoreEl = document.getElementById('newTotalScore');

    targetName.innerText = hedefOyuncu.isim.toUpperCase();

    if (kazandi) {
        // --- KAZANMA DURUMU ---
        
        // 1. Puan İşlemleri
        const kazanilanPuan = (6 - denemeSayisi) * 100;
        const yeniToplamPuan = addGlobalScore(kazanilanPuan);

        // 2. Görsel Ayarlar
        content.classList.remove('border-red-500', 'shadow-[0_0_50px_rgba(239,68,68,0.3)]');
        content.classList.add('border-green-500', 'shadow-[0_0_50px_rgba(34,197,94,0.3)]');
        
        emoji.innerText = "🏆";
        title.innerText = "TEBRİKLER!";
        title.className = "text-3xl font-black mb-2 tracking-tighter text-green-400";
        desc.innerText = `${denemeSayisi}. denemede doğru bildin.`;

        // 3. İstatistik Alanını Doldur ve Göster
        gainedScoreEl.innerText = kazanilanPuan;
        newTotalScoreEl.innerText = yeniToplamPuan;
        resultStats.classList.remove('hidden'); // Kutuyu görünür yap

    } else {
        // --- KAYBETME DURUMU ---
        content.classList.remove('border-green-500', 'shadow-[0_0_50px_rgba(34,197,94,0.3)]');
        content.classList.add('border-red-500', 'shadow-[0_0_50px_rgba(239,68,68,0.3)]');
        
        emoji.innerText = "❌";
        title.innerText = "MAÇ BİTTİ";
        title.className = "text-3xl font-black mb-2 tracking-tighter text-red-500";
        desc.innerText = "Hakların tükendi. Bir dahaki sefere!";
        
        // Puan alanını gizle (eğer önceki oyundan açık kaldıysa)
        resultStats.classList.add('hidden');
    }

    modal.classList.remove('hidden');
}

// Event Listeners
submitBtn.addEventListener('click', tahminYap);
input.addEventListener('keypress', (e) => { if (e.key === 'Enter') tahminYap(); });
document.addEventListener('click', (e) => { 
    if (e.target !== input && e.target !== autocompleteList) {
        autocompleteList.classList.add('hidden'); 
    }
});

// --- PUAN SİSTEMİ ---
function addGlobalScore(points) {
    let currentScore = parseInt(localStorage.getItem('futbolHub_totalScore')) || 0;
    currentScore += points;
    localStorage.setItem('futbolHub_totalScore', currentScore);
    console.log(`${points} puan eklendi. Yeni Toplam: ${currentScore}`);
    return currentScore;
}