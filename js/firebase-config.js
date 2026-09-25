/* =========================================================
   BADILISHA (REPLACE) hizi thamani na za mradi wako wa Firebase.
   Zinapatikana: Firebase Console > Project settings > General
   > Your apps > SDK setup and configuration.
   Soma README.md kwa maelekezo kamili hatua kwa hatua.
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyCuGqjis89oc5oT1cIRGQ9xVW13tv50z4I",
  authDomain: "xyz-pharmacy-5728a.firebaseapp.com",
  projectId: "xyz-pharmacy-5728a",
  storageBucket: "xyz-pharmacy-5728a.firebasestorage.app",
  messagingSenderId: "1063144655492",
  appId: "1:1063144655492:web:9cab34a4b9b8527fa490d1"
};

/* Namba ya WhatsApp itakayopokea oda (fomati: nchi+namba, bila + wala nafasi) */
const WHATSAPP_NUMBER = "255742417963";

/* Cloudinary — kwa ajili ya kupakia picha za post/bidhaa bila gharama ya server.
   1) Fungua akaunti bure: https://cloudinary.com
   2) Dashboard > pata "Cloud name" yako
   3) Settings > Upload > Upload presets > Add upload preset
      - Signing mode: Unsigned
      - Weka jina la preset hapa chini
*/
const CLOUDINARY_CLOUD_NAME = "ez7tr8c3";
const CLOUDINARY_UPLOAD_PRESET = "xyz_pharmacy";

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
