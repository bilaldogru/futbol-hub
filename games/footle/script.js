const oyuncular = [
    { isim: "Mauro Icardi", uyruk: "🇦🇷", lig: "Süper Lig", takim: "GS", pozisyon: "ATT", yas: 31 },
    { isim: "Edin Dzeko", uyruk: "🇧🇦", lig: "Süper Lig", takim: "FB", pozisyon: "ATT", yas: 37 },
    { isim: "Arda Guler", uyruk: "🇹🇷", lig: "La Liga", takim: "RMA", pozisyon: "MID", yas: 19 },
    { isim: "Hakan Calhanoglu", uyruk: "🇹🇷", lig: "Serie A", takim: "INT", pozisyon: "MID", yas: 30 },
    { isim: "Victor Osimhen", uyruk: "🇳🇬", lig: "Süper Lig", takim: "GS", pozisyon: "ATT", yas: 25 },
    { isim: "Kerem Akturkoglu", uyruk: "🇹🇷", lig: "Süper Lig", takim: "GS", pozisyon: "MID", yas: 25 }
];

const hedefOyuncu = oyuncular[Math.floor(Math.random() * oyuncular.length)];
let oyunBitti = false;
let denemeSayisi = 0;
const maxHak = 5;

const input = document.getElementById('playerInput');
const autocompleteList = document.getElementById('autocomplete-list');
const submitBtn = document.getElementById('submitBtn');
const hakGosterge = document.getElementById('hakGosterge');

// Autocomplete Mantığı
input.addEventListener('input', function() {
    const val = this.value.trim().toLowerCase();
    autocompleteList.innerHTML = '';
    if (!val || oyunBitti) { autocompleteList.classList.add('hidden'); return; }
    const matches = oyuncular.filter(o => o.isim.toLowerCase().includes(val)).slice(0, 5);
    if (matches.length > 0) {
        autocompleteList.classList.remove('hidden');
        matches.forEach(m => {
            const item = document.createElement('div');
            item.className = "p-4 hover:bg-green-600 cursor-pointer border-b border-gray-700 last:border-0";
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

// Tahmin Etme
function tahminYap() {
    if (oyunBitti) return;
    const isim = input.value.trim().toLowerCase();
    const tahmin = oyuncular.find(o => o.isim.toLowerCase() === isim);
    
    if (!tahmin) {
        alert("Lütfen listeden bir oyuncu seçin!");
        return;
    }

    denemeSayisi++;
    hakGosterge.innerText = maxHak - denemeSayisi;
    input.value = "";
    autocompleteList.classList.add('hidden');
    satirEkle(tahmin);

    if (tahmin.isim === hedefOyuncu.isim) {
        bitir(true);
    } else if (denemeSayisi >= maxHak) {
        bitir(false);
    }
}

function satirEkle(tahmin) {
    const board = document.getElementById('gameBoard');
    const row = document.createElement('div');
    row.className = "grid grid-cols-5 gap-2 h-16";
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
        let renk = k.val === k.target ? "correct" : (k.type === 'number' ? "partial" : "wrong");
        let icerik = k.type === 'number' && k.val !== k.target ? `${k.val} ${k.val < k.target ? '↑' : '↓'}` : k.val;
        card.innerHTML = `<div class="flip-inner h-full w-full"><div class="flip-front"></div><div class="flip-back ${renk} font-bold text-[10px] sm:text-[11px]">${icerik}</div></div>`;
        row.appendChild(card);
        setTimeout(() => { card.classList.add('flipped'); card.style.opacity = "1"; }, i * 200);
    });
    board.appendChild(row);
    row.scrollIntoView({ behavior: 'smooth' });
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
        title.innerText = "GOOOOOL!";
        desc.innerText = `Harika! Oyuncuyu ${denemeSayisi}. denemede buldun.`;
    } else {
        content.classList.add('border-red-500', 'shadow-[0_0_50px_rgba(239,68,68,0.3)]');
        emoji.innerText = "🟥";
        title.innerText = "MAÇ BİTTİ!";
        desc.innerText = "Maalesef tüm haklarını tükettin.";
    }

    setTimeout(() => { modal.classList.remove('hidden'); }, 1800);
}

// Event Listeners
submitBtn.addEventListener('click', tahminYap);
input.addEventListener('keypress', (e) => { if (e.key === 'Enter') tahminYap(); });
document.addEventListener('click', (e) => { if (e.target !== input) autocompleteList.classList.add('hidden'); });