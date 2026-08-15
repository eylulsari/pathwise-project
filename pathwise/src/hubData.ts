// ─────────────────────────────────────────────────────────────────────────
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced from the backend datasets by `node scripts/sync-frontend-places.mjs`:
//   pathwise-backend/src/modules/places/infrastructure/persistence/place.dataset.ts
//   pathwise-backend/src/modules/places/infrastructure/persistence/hub.dataset.ts
//
// The backend is the single source of truth for places and hubs. Edit the
// datasets there and re-run the script; CI runs it with --check and fails if
// this file is stale, so the two halves cannot drift apart again.
//
// `PLACES` here is a deliberate PROJECTION, not the full `Place` record —
// only the fields the synchronous `PLACES_BY_ID` lookups actually read. Full
// place objects reach the UI on itinerary stops, straight from the API.
// ─────────────────────────────────────────────────────────────────────────
import type { HubMeta, PlaceSummary } from './types';

export const HUBS: HubMeta[] = [
  { id: 'sultanahmet', name: 'Sultanahmet & Old City', side: 'European', blurb: 'Byzantine + Ottoman monuments packed into a walkable peninsula.', center: [41.0086, 28.9785], accent: '#C56F52' },
  { id: 'eminonu-sirkeci', name: 'Eminönü & Sirkeci', side: 'European', blurb: 'Covered bazaars, spice stalls and the ferry horns below them.', center: [41.0165, 28.9705], accent: '#B0603A' },
  { id: 'beyoglu-taksim', name: 'Beyoğlu & Taksim', side: 'European', blurb: 'İstiklal, hidden arcades and meyhanes — the city after dark.', center: [41.0345, 28.9782], accent: '#7A5C9E' },
  { id: 'karakoy-galata', name: 'Karaköy & Galata', side: 'European', blurb: 'Galata Tower, third-wave coffee, galleries and baklava.', center: [41.0243, 28.9748], accent: '#4A7C82' },
  { id: 'besiktas-bogaz', name: 'Beşiktaş & Bosphorus', side: 'European', blurb: 'Palaces, fish markets and student-quarter energy.', center: [41.0426, 29.0064], accent: '#5E8C74' },
  { id: 'ortakoy-bebek', name: 'Ortaköy & Bebek', side: 'European', blurb: 'The Bosphorus run — waterside mosque, kumpir, shoreline walks.', center: [41.0553, 29.0335], accent: '#3E7BA6' },
  { id: 'balat-fener', name: 'Balat & Fener', side: 'European', blurb: 'Rainbow houses, antique shops and Orthodox heritage.', center: [41.0292, 28.9492], accent: '#A87F28' },
  { id: 'kadikoy-moda', name: 'Kadıköy & Moda', side: 'Asian', blurb: 'The Asian side: markets, meyhanes and a seaside sunset.', center: [40.9887, 29.027], accent: '#C97B8E' },
  { id: 'uskudar', name: 'Üsküdar', side: 'Asian', blurb: 'Sinan mosques, the Maiden’s Tower view and Kuzguncuk’s lanes.', center: [41.0255, 29.0152], accent: '#6B8E5A' },
  { id: 'adalar', name: 'Princes’ Islands (Adalar)', side: 'Islands', blurb: 'A ferry day out — no cars, pine woods and wooden mansions.', center: [40.8608, 29.1236], accent: '#2E8B87' },
];

export const HUB_BY_ID: Record<string, HubMeta> = Object.fromEntries(
  HUBS.map((h) => [h.id, h]),
);

// Transit hubs / ferry piers for the start-point selector (IBB Open Data).
export const TRANSIT_HUBS: { label: string; lat: number; lng: number }[] = [
  { label: 'Eminönü Pier', lat: 41.0175, lng: 28.9705 },
  { label: 'Kadıköy Pier', lat: 40.9925, lng: 29.0213 },
  { label: 'Karaköy Pier', lat: 41.0223, lng: 28.9776 },
  { label: 'Sirkeci Marmaray', lat: 41.0138, lng: 28.9772 },
  { label: 'Üsküdar Pier', lat: 41.0255, lng: 29.0148 },
  { label: 'Taksim Metro', lat: 41.0369, lng: 28.9857 },
  { label: 'Beşiktaş Pier', lat: 41.0409, lng: 29.0053 },
  { label: 'Büyükada Pier', lat: 40.8757, lng: 29.1288 },
];

export const PLACES: PlaceSummary[] = [
  // ── Sultanahmet & Old City (14) ──
  { placeId: 'ChIJ-sultanahmet-hagiasophia', name: 'Hagia Sophia', hub: 'sultanahmet', lat: 41.0086, lng: 28.9802, entryFeeTry: 1500, entryFeeApprox: true },
  { placeId: 'ChIJ-sultanahmet-bluemosque', name: 'Blue Mosque (Sultanahmet Camii)', hub: 'sultanahmet', lat: 41.0054, lng: 28.9768, entryFeeTry: 0 },
  { placeId: 'ChIJ-sultanahmet-topkapi', name: 'Topkapı Palace', hub: 'sultanahmet', lat: 41.0115, lng: 28.9834, entryFeeTry: 1700, entryFeeApprox: true },
  { placeId: 'ChIJ-sultanahmet-basilicacistern', name: 'Basilica Cistern (Yerebatan Sarnıcı)', hub: 'sultanahmet', lat: 41.0084, lng: 28.9779, entryFeeTry: 900, entryFeeApprox: true },
  { placeId: 'ChIJ-sultanahmet-hippodrome', name: 'Hippodrome (Sultanahmet Meydanı)', hub: 'sultanahmet', lat: 41.0056, lng: 28.9754, entryFeeTry: 0 },
  { placeId: 'ChIJ-sultanahmet-kucukayasofya', name: 'Little Hagia Sophia (Küçük Ayasofya)', hub: 'sultanahmet', lat: 41.0027, lng: 28.9719, entryFeeTry: 0 },
  { placeId: 'ChIJ-sultanahmet-turkislam', name: 'Museum of Turkish & Islamic Arts', hub: 'sultanahmet', lat: 41.0061, lng: 28.9748, entryFeeTry: 700, entryFeeApprox: true },
  { placeId: 'ChIJ-sultanahmet-istanbularkeolojimuzeler', name: 'İstanbul Arkeoloji Müzeleri', hub: 'sultanahmet', lat: 41.0116987, lng: 28.9813227, entryFeeTry: 600, entryFeeApprox: true },
  { placeId: 'ChIJ-sultanahmet-gulhane', name: 'Gülhane Park', hub: 'sultanahmet', lat: 41.0134, lng: 28.9812, entryFeeTry: 0 },
  { placeId: 'ChIJ-sultanahmet-koftecisi', name: 'Tarihi Sultanahmet Köftecisi', hub: 'sultanahmet', lat: 41.0086, lng: 28.9762, entryFeeTry: 0 },
  { placeId: 'ChIJ-sultanahmet-arastacarsisi', name: 'Arasta Çarşısı', hub: 'sultanahmet', lat: 41.0049274, lng: 28.9779026, entryFeeTry: 0 },
  { placeId: 'ChIJ-sultanahmet-binbirdireksarnici', name: 'Binbirdirek Sarnıcı', hub: 'sultanahmet', lat: 41.007606, lng: 28.9744173, entryFeeTry: 400, entryFeeApprox: true },
  { placeId: 'ChIJ-sultanahmet-sogukcesmesokagi', name: 'Soğukçeşme Sokağı', hub: 'sultanahmet', lat: 41.0091697, lng: 28.9805148, entryFeeTry: 0 },
  { placeId: 'ChIJ-sultanahmet-cagalogluhamami', name: 'Cağaloğlu Hamamı', hub: 'sultanahmet', lat: 41.0106906, lng: 28.9756423, entryFeeTry: 3000, entryFeeApprox: true },
  // ── Eminönü & Sirkeci (15) ──
  { placeId: 'ChIJ-sultanahmet-grandbazaar', name: 'Grand Bazaar (Kapalıçarşı)', hub: 'eminonu-sirkeci', lat: 41.0106, lng: 28.968, entryFeeTry: 0 },
  { placeId: 'ChIJ-sultanahmet-spicebazaar', name: 'Spice Bazaar (Mısır Çarşısı)', hub: 'eminonu-sirkeci', lat: 41.0165, lng: 28.9707, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-suleymaniyecamii', name: 'Süleymaniye Camii', hub: 'eminonu-sirkeci', lat: 41.0162287, lng: 28.9639548, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-rustempasacamii', name: 'Rüstem Paşa Camii', hub: 'eminonu-sirkeci', lat: 41.0176652, lng: 28.9686992, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-yenicami', name: 'Yeni Cami', hub: 'eminonu-sirkeci', lat: 41.0169482, lng: 28.9721115, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-sirkecigari', name: 'Sirkeci Garı', hub: 'eminonu-sirkeci', lat: 41.015206, lng: 28.9763512, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-hamdirestaurant', name: 'Hamdi Restaurant', hub: 'eminonu-sirkeci', lat: 41.0171629, lng: 28.9698993, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-vefabozacisi', name: 'Vefa Bozacısı', hub: 'eminonu-sirkeci', lat: 41.0153241, lng: 28.9584185, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-eminonubalikekmek', name: 'Eminönü Balık Ekmek', hub: 'eminonu-sirkeci', lat: 41.0183562, lng: 28.9712101, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-nuruosmaniyecamii', name: 'Nuruosmaniye Camii', hub: 'eminonu-sirkeci', lat: 41.0103392, lng: 28.9703883, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-sahaflarcarsisi', name: 'Sahaflar Çarşısı', hub: 'eminonu-sirkeci', lat: 41.0102668, lng: 28.9661808, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-beyazitmeydani', name: 'Beyazıt Meydanı', hub: 'eminonu-sirkeci', lat: 41.0102262, lng: 28.9642308, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-tahtakalecarsisi', name: 'Tahtakale Çarşısı', hub: 'eminonu-sirkeci', lat: 41.0162853, lng: 28.9689108, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-eminonuvapuriskelesi', name: 'Eminönü Vapur İskelesi', hub: 'eminonu-sirkeci', lat: 41.0171316, lng: 28.976271, entryFeeTry: 0 },
  { placeId: 'ChIJ-eminonu-hafizmustafa1864', name: 'Hafız Mustafa 1864', hub: 'eminonu-sirkeci', lat: 41.0271958, lng: 28.9849177, entryFeeTry: 0 },
  // ── Beyoğlu & Taksim (14) ──
  { placeId: 'ChIJ-beyoglu-istiklalcaddesi', name: 'İstiklal Caddesi', hub: 'beyoglu-taksim', lat: 41.033865, lng: 28.9781765, entryFeeTry: 0 },
  { placeId: 'ChIJ-beyoglu-taksimmeydani', name: 'Taksim Meydanı', hub: 'beyoglu-taksim', lat: 41.0379547, lng: 28.9852034, entryFeeTry: 0 },
  { placeId: 'ChIJ-galata-mevlevihane', name: 'Galata Mevlevi Lodge Museum', hub: 'beyoglu-taksim', lat: 41.0295, lng: 28.9748, entryFeeTry: 300, entryFeeApprox: true },
  { placeId: 'ChIJ-beyoglu-cicekpasaji', name: 'Çiçek Pasajı', hub: 'beyoglu-taksim', lat: 41.0340997, lng: 28.9779211, entryFeeTry: 0 },
  { placeId: 'ChIJ-beyoglu-nevizadesokak', name: 'Nevizade Sokak', hub: 'beyoglu-taksim', lat: 41.0348129, lng: 28.9777882, entryFeeTry: 0 },
  { placeId: 'ChIJ-beyoglu-peramuzesi', name: 'Pera Müzesi', hub: 'beyoglu-taksim', lat: 41.0318031, lng: 28.9752038, entryFeeTry: 400, entryFeeApprox: true },
  { placeId: 'ChIJ-beyoglu-sentantuankilisesi', name: 'Sent Antuan Kilisesi', hub: 'beyoglu-taksim', lat: 41.0322763, lng: 28.9771979, entryFeeTry: 0 },
  { placeId: 'ChIJ-beyoglu-cezayirsokagi', name: 'Cezayir Sokağı', hub: 'beyoglu-taksim', lat: 41.0313437, lng: 28.9791557, entryFeeTry: 0 },
  { placeId: 'ChIJ-beyoglu-tunelmeydani', name: 'Tünel Meydanı', hub: 'beyoglu-taksim', lat: 41.0284063, lng: 28.97416, entryFeeTry: 0 },
  { placeId: 'ChIJ-beyoglu-saltbeyoglu', name: 'SALT Beyoğlu', hub: 'beyoglu-taksim', lat: 41.0320737, lng: 28.9760955, entryFeeTry: 0 },
  { placeId: 'ChIJ-beyoglu-geziparki', name: 'Gezi Parkı', hub: 'beyoglu-taksim', lat: 41.0388419, lng: 28.9870409, entryFeeTry: 0 },
  { placeId: 'ChIJ-beyoglu-atlaspasaji', name: 'Atlas Pasajı', hub: 'beyoglu-taksim', lat: 41.0341134, lng: 28.9792135, entryFeeTry: 0 },
  { placeId: 'ChIJ-beyoglu-taksimcamii', name: 'Taksim Camii', hub: 'beyoglu-taksim', lat: 41.0369981, lng: 28.9840246, entryFeeTry: 0 },
  { placeId: 'ChIJ-beyoglu-nostaljiktramvay', name: 'Nostaljik Tramvay (İstiklal)', hub: 'beyoglu-taksim', lat: 41.0369981, lng: 28.9837401, entryFeeTry: 30, entryFeeApprox: true },
  // ── Karaköy & Galata (12) ──
  { placeId: 'ChIJ-galata-tower', name: 'Galata Tower', hub: 'karakoy-galata', lat: 41.0256, lng: 28.9744, entryFeeTry: 1000, entryFeeApprox: true },
  { placeId: 'ChIJ-galata-gulluoglu', name: 'Karaköy Güllüoğlu', hub: 'karakoy-galata', lat: 41.0231, lng: 28.9781, entryFeeTry: 0 },
  { placeId: 'ChIJ-galata-camondo', name: 'Camondo Steps', hub: 'karakoy-galata', lat: 41.0243, lng: 28.9737, entryFeeTry: 0 },
  { placeId: 'ChIJ-galata-istanbulmodern', name: 'Istanbul Modern', hub: 'karakoy-galata', lat: 41.0247, lng: 28.9799, entryFeeTry: 650, entryFeeApprox: true },
  { placeId: 'ChIJ-galata-saltgalata', name: 'SALT Galata', hub: 'karakoy-galata', lat: 41.0231, lng: 28.9741, entryFeeTry: 0 },
  { placeId: 'ChIJ-galata-karakoyrihtimi', name: 'Karaköy Rıhtımı', hub: 'karakoy-galata', lat: 41.0214286, lng: 28.9767318, entryFeeTry: 0 },
  { placeId: 'ChIJ-galata-arapcamii', name: 'Arap Camii', hub: 'karakoy-galata', lat: 41.0243421, lng: 28.9710674, entryFeeTry: 0 },
  { placeId: 'ChIJ-galata-yeralticamii', name: 'Yeraltı Camii', hub: 'karakoy-galata', lat: 41.0223504, lng: 28.9766316, entryFeeTry: 0 },
  { placeId: 'ChIJ-galata-karakoylokantasi', name: 'Karaköy Lokantası', hub: 'karakoy-galata', lat: 41.0242, lng: 28.9776, entryFeeTry: 0 },
  { placeId: 'ChIJ-galata-serdariekremcaddesi', name: 'Serdar-ı Ekrem Caddesi', hub: 'karakoy-galata', lat: 41.0279561, lng: 28.9770558, entryFeeTry: 0 },
  { placeId: 'ChIJ-galata-kilicalipasa', name: 'Kılıç Ali Paşa Mosque & Hamam', hub: 'karakoy-galata', lat: 41.0238, lng: 28.9805, entryFeeTry: 0 },
  { placeId: 'ChIJ-galata-namli', name: 'Namlı Gurme (Karaköy)', hub: 'karakoy-galata', lat: 41.0227, lng: 28.9772, entryFeeTry: 0 },
  // ── Beşiktaş & Bosphorus (8) ──
  { placeId: 'ChIJ-besiktas-dolmabahce', name: 'Dolmabahçe Palace', hub: 'besiktas-bogaz', lat: 41.0392, lng: 29.0001, entryFeeTry: 1450, entryFeeApprox: true },
  { placeId: 'ChIJ-besiktas-yildiz-park', name: 'Yıldız Park', hub: 'besiktas-bogaz', lat: 41.0501, lng: 29.0125, entryFeeTry: 0 },
  { placeId: 'ChIJ-besiktas-besiktascarsisi', name: 'Beşiktaş Çarşısı', hub: 'besiktas-bogaz', lat: 41.0427392, lng: 29.0052546, entryFeeTry: 0 },
  { placeId: 'ChIJ-besiktas-fishmarket', name: 'Beşiktaş Fish Market', hub: 'besiktas-bogaz', lat: 41.0426, lng: 29.0064, entryFeeTry: 0 },
  { placeId: 'ChIJ-besiktas-ihlamurkasri', name: 'Ihlamur Kasrı', hub: 'besiktas-bogaz', lat: 41.0507128, lng: 29.0011982, entryFeeTry: 300, entryFeeApprox: true },
  { placeId: 'ChIJ-besiktas-denizmuzesi', name: 'Deniz Müzesi', hub: 'besiktas-bogaz', lat: 41.0410591, lng: 29.0056913, entryFeeTry: 250, entryFeeApprox: true },
  { placeId: 'ChIJ-besiktas-ciragansarayidiscephesi', name: 'Çırağan Sarayı Dış Cephesi', hub: 'besiktas-bogaz', lat: 41.0434671, lng: 29.0153145, entryFeeTry: 0 },
  { placeId: 'ChIJ-besiktas-besiktassahili', name: 'Beşiktaş Sahili', hub: 'besiktas-bogaz', lat: 41.041076, lng: 29.0073612, entryFeeTry: 0 },
  // ── Ortaköy & Bebek (12) ──
  { placeId: 'ChIJ-besiktas-ortakoy-mosque', name: 'Ortaköy Mosque', hub: 'ortakoy-bebek', lat: 41.0473, lng: 29.0272, entryFeeTry: 0 },
  { placeId: 'ChIJ-besiktas-ortakoy-kumpir', name: 'Ortaköy Kumpir & Waffle Row', hub: 'ortakoy-bebek', lat: 41.0476, lng: 29.0266, entryFeeTry: 0 },
  { placeId: 'ChIJ-ortakoy-ortakoymeydani', name: 'Ortaköy Meydanı', hub: 'ortakoy-bebek', lat: 41.0472754, lng: 29.0256249, entryFeeTry: 0 },
  { placeId: 'ChIJ-besiktas-bebek-sahil', name: 'Bebek Seaside', hub: 'ortakoy-bebek', lat: 41.0776, lng: 29.0433, entryFeeTry: 0 },
  { placeId: 'ChIJ-ortakoy-rumelihisari', name: 'Rumeli Hisarı', hub: 'ortakoy-bebek', lat: 41.0849171, lng: 29.0567125, entryFeeTry: 400, entryFeeApprox: true },
  { placeId: 'ChIJ-ortakoy-emirgankorusu', name: 'Emirgan Korusu', hub: 'ortakoy-bebek', lat: 41.1090119, lng: 29.0525172, entryFeeTry: 0 },
  { placeId: 'ChIJ-ortakoy-sakipsabancimuzesi', name: 'Sakıp Sabancı Müzesi', hub: 'ortakoy-bebek', lat: 41.106019, lng: 29.0556289, entryFeeTry: 600, entryFeeApprox: true },
  { placeId: 'ChIJ-ortakoy-asiyanmuzesi', name: 'Aşiyan Müzesi', hub: 'ortakoy-bebek', lat: 41.0826576, lng: 29.0534518, entryFeeTry: 150, entryFeeApprox: true },
  { placeId: 'ChIJ-ortakoy-arnavutkoysahilyolu', name: 'Arnavutköy Sahil Yolu', hub: 'ortakoy-bebek', lat: 41.0672342, lng: 29.0432537, entryFeeTry: 0 },
  { placeId: 'ChIJ-ortakoy-bebekbademezmesi', name: 'Bebek Badem Ezmesi', hub: 'ortakoy-bebek', lat: 41.0777546, lng: 29.0438253, entryFeeTry: 0 },
  { placeId: 'ChIJ-ortakoy-bebekparki', name: 'Bebek Parkı', hub: 'ortakoy-bebek', lat: 41.0758381, lng: 29.04379, entryFeeTry: 0 },
  { placeId: 'ChIJ-ortakoy-bogazturu', name: 'Boğaz Turu (Ortaköy kalkışlı)', hub: 'ortakoy-bebek', lat: 41.0179386, lng: 28.9739295, entryFeeTry: 500, entryFeeApprox: true },
  // ── Balat & Fener (11) ──
  { placeId: 'ChIJ-balat-colorfulhouses', name: 'Balat Colorful Houses (Kiremit Cd.)', hub: 'balat-fener', lat: 41.0294, lng: 28.9487, entryFeeTry: 0 },
  { placeId: 'ChIJ-balat-fenerpatriarchate', name: 'Ecumenical Patriarchate (Fener)', hub: 'balat-fener', lat: 41.0293, lng: 28.9513, entryFeeTry: 0 },
  { placeId: 'ChIJ-balat-kariyecamii', name: 'Kariye Camii (Chora)', hub: 'balat-fener', lat: 41.0312136, lng: 28.9389547, entryFeeTry: 800, entryFeeApprox: true },
  { placeId: 'ChIJ-balat-svetistefanbulgarkilises', name: 'Sveti Stefan Bulgar Kilisesi', hub: 'balat-fener', lat: 41.0317775, lng: 28.949686, entryFeeTry: 0 },
  { placeId: 'ChIJ-balat-fenerrumlisesi', name: 'Fener Rum Lisesi (Kırmızı Mektep)', hub: 'balat-fener', lat: 41.0292156, lng: 28.9493924, entryFeeTry: 0 },
  { placeId: 'ChIJ-balat-vodinacaddesi', name: 'Vodina Caddesi', hub: 'balat-fener', lat: 41.0307783, lng: 28.9495429, entryFeeTry: 0 },
  { placeId: 'ChIJ-balat-cafe', name: 'Forno Balat (Café)', hub: 'balat-fener', lat: 41.029, lng: 28.9482, entryFeeTry: 0 },
  { placeId: 'ChIJ-balat-agora', name: 'Agora Meyhanesi 1890', hub: 'balat-fener', lat: 41.0286, lng: 28.9497, entryFeeTry: 0 },
  { placeId: 'ChIJ-balat-ayvansaraysurlari', name: 'Ayvansaray Surları', hub: 'balat-fener', lat: 41.0322193, lng: 28.9378722, entryFeeTry: 0 },
  { placeId: 'ChIJ-balat-antiqueshops', name: 'Balat Antique & Vintage Shops', hub: 'balat-fener', lat: 41.0301, lng: 28.9479, entryFeeTry: 0 },
  { placeId: 'ChIJ-balat-cibalikapisi', name: 'Cibali Kapısı', hub: 'balat-fener', lat: 41.0235835, lng: 28.9593551, entryFeeTry: 0 },
  // ── Kadıköy & Moda (15) ──
  { placeId: 'ChIJ-kadikoy-moda-sahil', name: 'Moda Seaside (Sahil)', hub: 'kadikoy-moda', lat: 40.9812, lng: 29.024, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-carsi', name: 'Kadıköy Market (Çarşı)', hub: 'kadikoy-moda', lat: 40.9903, lng: 29.0277, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-modacaybahcesi', name: 'Moda Çay Bahçesi', hub: 'kadikoy-moda', lat: 40.9807672, lng: 29.0207963, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-barlar', name: 'Kadıköy Barlar Sokağı', hub: 'kadikoy-moda', lat: 40.9895, lng: 29.0292, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-sureyya', name: 'Süreyya Opera House', hub: 'kadikoy-moda', lat: 40.9906, lng: 29.0286, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-yeldegirmeni', name: 'Yeldeğirmeni Murals', hub: 'kadikoy-moda', lat: 40.9962, lng: 29.0258, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-ciya', name: 'Çiya Sofrası', hub: 'kadikoy-moda', lat: 40.9899, lng: 29.0271, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-alimuhiddinhacibekir', name: 'Ali Muhiddin Hacı Bekir (Kadıköy)', hub: 'kadikoy-moda', lat: 40.9903002, lng: 29.0237155, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-bahariye', name: 'Bahariye Caddesi', hub: 'kadikoy-moda', lat: 40.9902, lng: 29.0289, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-kadikoybogaheykeli', name: 'Kadıköy Boğa Heykeli', hub: 'kadikoy-moda', lat: 40.9904912, lng: 29.0292074, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-modadenizkulubuyuruyusyo', name: 'Moda Deniz Kulübü Yürüyüş Yolu', hub: 'kadikoy-moda', lat: 40.9789076, lng: 29.0232905, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-kadikoyvapuriskelesi', name: 'Kadıköy Vapur İskelesi', hub: 'kadikoy-moda', lat: 40.9929083, lng: 29.0228684, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-baylan', name: 'Baylan Pastanesi', hub: 'kadikoy-moda', lat: 40.9905, lng: 29.0282, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-moda-icecream', name: 'Moda Dondurma (Ali Usta)', hub: 'kadikoy-moda', lat: 40.9836, lng: 29.0263, entryFeeTry: 0 },
  { placeId: 'ChIJ-kadikoy-modapier', name: 'Moda Pier (Moda İskelesi)', hub: 'kadikoy-moda', lat: 40.9789, lng: 29.0268, entryFeeTry: 0 },
  // ── Üsküdar (13) ──
  { placeId: 'ChIJ-uskudar-kizkulesi', name: 'Kız Kulesi', hub: 'uskudar', lat: 41.0210488, lng: 29.0041322, entryFeeTry: 800, entryFeeApprox: true },
  { placeId: 'ChIJ-uskudar-mihrimahsultancamii', name: 'Mihrimah Sultan Camii (Üsküdar)', hub: 'uskudar', lat: 41.0268224, lng: 29.015967, entryFeeTry: 0 },
  { placeId: 'ChIJ-uskudar-semsipasacamii', name: 'Şemsi Paşa Camii', hub: 'uskudar', lat: 41.0259442, lng: 29.0113524, entryFeeTry: 0 },
  { placeId: 'ChIJ-uskudar-kuzguncukmahallesi', name: 'Kuzguncuk Mahallesi', hub: 'uskudar', lat: 41.03216, lng: 29.0360265, entryFeeTry: 0 },
  { placeId: 'ChIJ-uskudar-buyukcamlicacamii', name: 'Büyük Çamlıca Camii', hub: 'uskudar', lat: 41.0345279, lng: 29.070587, entryFeeTry: 0 },
  { placeId: 'ChIJ-uskudar-camlicatepesi', name: 'Çamlıca Tepesi', hub: 'uskudar', lat: 41.0278163, lng: 29.0692717, entryFeeTry: 0 },
  { placeId: 'ChIJ-uskudar-beylerbeyisarayi', name: 'Beylerbeyi Sarayı', hub: 'uskudar', lat: 41.0427184, lng: 29.0400359, entryFeeTry: 700, entryFeeApprox: true },
  { placeId: 'ChIJ-uskudar-uskudarsahili', name: 'Üsküdar Sahili', hub: 'uskudar', lat: 41.0281402, lng: 29.0152875, entryFeeTry: 0 },
  { placeId: 'ChIJ-uskudar-fethipasakorusu', name: 'Fethi Paşa Korusu', hub: 'uskudar', lat: 41.0327055, lng: 29.0274349, entryFeeTry: 0 },
  { placeId: 'ChIJ-uskudar-kanaatlokantasi', name: 'Kanaat Lokantası', hub: 'uskudar', lat: 41.0258196, lng: 29.0164724, entryFeeTry: 0 },
  { placeId: 'ChIJ-uskudar-nakkastepemilletbahcesi', name: 'Nakkaştepe Millet Bahçesi', hub: 'uskudar', lat: 41.0362262, lng: 29.0379719, entryFeeTry: 0 },
  { placeId: 'ChIJ-uskudar-atikvalidecamii', name: 'Atik Valide Camii', hub: 'uskudar', lat: 41.0188911, lng: 29.0238857, entryFeeTry: 0 },
  { placeId: 'ChIJ-uskudar-kuzguncukbostani', name: 'Kuzguncuk Bostanı', hub: 'uskudar', lat: 41.0347737, lng: 29.0318137, entryFeeTry: 0 },
  // ── Princes’ Islands (Adalar) (10) ──
  { placeId: 'ChIJ-adalar-buyukadaiskelesi', name: 'Büyükada İskelesi', hub: 'adalar', lat: 40.8749412, lng: 29.1283038, entryFeeTry: 0 },
  { placeId: 'ChIJ-adalar-ayayorgikilisesi', name: 'Aya Yorgi Kilisesi', hub: 'adalar', lat: 40.8488447, lng: 29.1188324, entryFeeTry: 0 },
  { placeId: 'ChIJ-adalar-buyukadaelektriklifayton', name: 'Büyükada Elektrikli Fayton Turu', hub: 'adalar', lat: 40.8749412, lng: 29.1283038, entryFeeTry: 400, entryFeeApprox: true },
  { placeId: 'ChIJ-adalar-buyukadabisikletturu', name: 'Büyükada Bisiklet Turu', hub: 'adalar', lat: 40.8749412, lng: 29.1283038, entryFeeTry: 300, entryFeeApprox: true },
  { placeId: 'ChIJ-adalar-splendidpalasoteli', name: 'Splendid Palas Oteli', hub: 'adalar', lat: 40.8727296, lng: 29.1264372, entryFeeTry: 0 },
  { placeId: 'ChIJ-adalar-prinkiporumyetimhanesi', name: 'Prinkipo Rum Yetimhanesi', hub: 'adalar', lat: 40.8610115, lng: 29.1230776, entryFeeTry: 0 },
  { placeId: 'ChIJ-adalar-heybeliadaruhbanokulu', name: 'Heybeliada Ruhban Okulu', hub: 'adalar', lat: 40.8821315, lng: 29.094627, entryFeeTry: 0 },
  { placeId: 'ChIJ-adalar-buyukadacarsicaddesi', name: 'Büyükada Çarşı (Şehit Recep Koç Cd.)', hub: 'adalar', lat: 40.8743554, lng: 29.1307589, entryFeeTry: 0 },
  { placeId: 'ChIJ-adalar-heybeliadasahili', name: 'Heybeliada Sahili', hub: 'adalar', lat: 40.8778466, lng: 29.1008681, entryFeeTry: 0 },
  { placeId: 'ChIJ-adalar-adalarvapuryolculugu', name: 'Adalar Vapur Yolculuğu', hub: 'adalar', lat: 40.8749412, lng: 29.1283038, entryFeeTry: 60, entryFeeApprox: true },
];

export const PLACES_BY_ID: Record<string, PlaceSummary> = Object.fromEntries(
  PLACES.map((p) => [p.placeId, p]),
);
