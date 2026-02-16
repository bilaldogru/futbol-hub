// games/footle/script.js

// OYUNCU VERİTABANI (Burası genişletilebilir)
const oyuncular = [
    { isim: "Mauro Icardi", uyruk: "🇦🇷", lig: "Süper Lig", takim: "GS", pozisyon: "ATT", yas: 31 },
    { isim: "Edin Dzeko", uyruk: "🇧🇦", lig: "Süper Lig", takim: "FB", pozisyon: "ATT", yas: 37 },
    { isim: "Arda Guler", uyruk: "🇹🇷", lig: "La Liga", takim: "RMA", pozisyon: "MID", yas: 19 },
    { isim: "Hakan Calhanoglu", uyruk: "🇹🇷", lig: "Serie A", takim: "INT", pozisyon: "MID", yas: 30 },
    { isim: "Victor Osimhen", uyruk: "🇳🇬", lig: "Süper Lig", takim: "GS", pozisyon: "ATT", yas: 25 },
    { isim: "Kerem Akturkoglu", uyruk: "🇹🇷", lig: "Premier L.", takim: "BJK", pozisyon: "MID", yas: 25 }, // Örnek düzeltme
    { isim: "Ciro Immobile", uyruk: "🇮🇹", lig: "Süper Lig", takim: "BJK", pozisyon: "ATT", yas: 34 },
    { isim: "Fred", uyruk: "🇧🇷", lig: "Süper Lig", takim: "FB", pozisyon: "MID", yas: 31 }
];

// GÜNLÜK HEDEF SEÇİMİ (Rastgele)
const hedefOyuncu = oyuncular[Math.floor(Math.random() * oyuncular.length)];
let oyunBitti = false;
let denemeSayisi = 0;
const maxHak = 5;

// DOM ELEMENTLERİ
const input = document.getElementById('playerInput');
const autocompleteList = document.getElementById('autocomplete-list');
const submitBtn = document.getElementById('submitBtn');
const hakGosterge = document.getElementById('hakGosterge');

console.log("Hedef (Kopya):", hedefOyuncu.isim); // Test için konsola yaz

// AUTOCOMPLETE (Otomatik Tamamlama)
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
    // Büyük küçük harf duyarsız arama
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
        setTimeout(() => bitir(true), 2500); // Kartlar dönünce bitir
    } else if (denemeSayisi >= maxHak) {
        setTimeout(() => bitir(false), 2500);
    }
}

function satirEkle(tahmin) {
    const board = document.getElementById('gameBoard');
    const row = document.createElement('div');
    row.className = "grid grid-cols-5 gap-2 h-14 sm:h-16 w-full"; // Mobilde biraz küçülttük
    
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
        
        // Renk Mantığı
        let renk = "wrong";
        if (k.val === k.target) renk = "correct";
        // Yaş veya benzeri sayısal değerler için yakınlık/ok mantığı (Partial)
        // Burada basitçe sayı ise ve tutmuyorsa partial yapıyoruz, geliştirebilirsiniz.
        else if (k.type === 'number') renk = "partial"; 

        // İçerik (Ok işareti ekleme)
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
        
        // Sırayla dönme efekti
        setTimeout(() => { 
            card.classList.add('flipped'); 
            card.style.opacity = "1"; 
        }, i * 300);
    });

    board.appendChild(row);
    // Otomatik kaydırma
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

    targetName.innerText = hedefOyuncu.isim.toUpperCase();

    if (kazandi) {
        content.classList.add('border-green-500', 'shadow-[0_0_50px_rgba(34,197,94,0.3)]');
        emoji.innerText = "🏆";
        title.innerText = "TEBRİKLER!";
        desc.innerText = `${denemeSayisi}. denemede doğru bildin.`;
        title.className = "text-3xl font-black mb-2 tracking-tighter text-green-400";
    } else {
        content.classList.add('border-red-500', 'shadow-[0_0_50px_rgba(239,68,68,0.3)]');
        emoji.innerText = "❌";
        title.innerText = "MAÇ BİTTİ";
        desc.innerText = "Hakların tükendi. Bir dahaki sefere!";
        title.className = "text-3xl font-black mb-2 tracking-tighter text-red-500";
    }

    modal.classList.remove('hidden');
}

// Event Listeners
submitBtn.addEventListener('click', tahminYap);
input.addEventListener('keypress', (e) => { if (e.key === 'Enter') tahminYap(); });

// Dışarı tıklayınca listeyi kapat
document.addEventListener('click', (e) => { 
    if (e.target !== input && e.target !== autocompleteList) {
        autocompleteList.classList.add('hidden'); 
    }
});