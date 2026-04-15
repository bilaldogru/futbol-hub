# ⚽ Futbol Hub

**Futbol Hub**, futbol tutkusunu strateji, hız ve rekabetle harmanlayan kapsamlı bir web tabanlı oyun platformudur. Bursa Teknik Üniversitesi Bilgisayar Mühendisliği öğrencileri tarafından tasarlanıp geliştirilen bu proje, sıradan bilgi yarışmalarının ötesine geçerek kullanıcılara gerçek zamanlı 1v1 kapışmalar, günlük bulmacalar ve detaylı bir profil/başarım sistemi sunar.

🔗 **Canlı Demo:** [Futbol Hub'ı Oyna](https://futbol-hub0.firebaseapp.com) *(Linkini kendi canlı site linkinle güncellemeyi unutma)*

---

## 🎮 Oyunlar ve İçerikler

Platform içerisinde farklı dinamiklere sahip oyun modları bulunmaktadır:

* **Footle & Gizli Efsane:** Wordle ve Adam Asmaca (Hangman) konseptlerinin futbola uyarlanmış hali. Kullanıcılar her gün yenilenen ipuçları (Uyruk, Lig, Yaş, Pozisyon) ile günün gizli futbolcusunu bulmaya çalışır. Her zorluk seviyesi için günde yalnızca 1 hak bulunur.
* **Grid Savaşları (1v1):** Tic-Tac-Toe (X-O-X) mantığının taktiksel futbol versiyonu. Verilen satır ve sütun kriterlerinin kesişimine uyan futbolcuyu yazarak kareleri ele geçirme mücadelesi.
* **Arena (Kafa Topu - 1v1):** Kullanıcıların WebRTC altyapısı üzerinden aynı lobiye bağlanarak, sıfır sunucu gecikmesiyle (P2P) gerçek zamanlı maç yapabildiği rekabetçi oyun modu. Çeşitli güçlendiriciler (dev top, dev kale, rakibi dondurma) içerir.

---

## 🏆 Platform Özellikleri

* **Kullanıcı ve Profil Sistemi:** Firebase Authentication (Google Login) entegrasyonu ile güvenli giriş. Kullanıcılar toplam maç sayılarını ve kazanma oranlarını (Win Rate) profillerinden takip edebilir.
* **Oyunlaştırma & Başarım Rozetleri:** Belirli hedeflere ulaşan oyuncular prestijli rozetler kazanır (*Örn: İlk 1000 puanda "Acemi", 50 maçta "Müptela", %80 Win Rate ile "Yenilmez"*).
* **Gerçek Zamanlı Liderlik Tablosu:** Her hafta sıfırlanan "Haftanın Kralları" tablosunda zirve yarışına dahil olma imkanı.
* **Dinamik Haber Akışı (Ticker):** Anlık sistem mesajları ve güncellemelerin geçtiği sürekli kayan bildirim çubuğu.

---

## 🛠️ Kullanılan Teknolojiler & Mimari Kararlar

Bu proje, modern web geliştirme pratikleri göz önünde bulundurularak, harici bir frontend framework'ü (React/Vue vb.) **kullanılmadan**, doğrudan Vanilla JS gücüyle inşa edilmiştir.

* **Frontend:** HTML5, CSS3, **Vanilla JavaScript**
* **UI/Tasarım:** **Tailwind CSS** (Tamamen Custom Config, %100 Mobil Uyumlu / Responsive Design)
* **Backend & Veritabanı:** **Firebase** (Cloud Firestore, Authentication)
* **Gerçek Zamanlı Çok Oyunculu Altyapı:** **WebRTC** ve **PeerJS** (Sunucusuz, Peer-to-Peer bağlantı modeli)
* **Oyun & Fizik Motoru:** **Phaser.js** (Arena modu mekanikleri ve çarpışma hesaplamaları için)

### 💡 Teknik Öne Çıkanlar (Engineering Highlights)
1.  **State Management:** Herhangi bir kütüphane kullanılmadan, saf JavaScript ile modüler durum (state) yönetimi sağlandı.
2.  **Real-Time Data Sync:** Firestore `onSnapshot` dinleyicileri ile lobiler, maç skorları ve liderlik tablosu anlık olarak senkronize edildi.
3.  **Atomik Güncellemeler & Anti-Cheat:** Eş zamanlı veri yazma sorunlarını (Race-condition) engellemek için veritabanında `increment` fonksiyonları kullanıldı. Oyun ilerlemeleri localStorage ve veritabanı validasyonlarıyla korumaya alındı.
4.  **Seeded Randomization:** Günlük oyunlarda tüm kullanıcılara aynı futbolcunun sorulmasını garantilemek için tarihe dayalı (Date-based) Seed algoritması yazıldı.

---

## 🚀 Kurulum ve Çalıştırma

Projeyi bilgisayarınızda yerel olarak çalıştırmak için aşağıdaki adımları izleyebilirsiniz:

1. Depoyu bilgisayarınıza klonlayın:
   ```bash
   git clone [https://github.com/bilaldogru/futbol-hub.git](https://github.com/bilaldogru/futbol-hub.git)
