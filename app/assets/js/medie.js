// #52: rendering udledes deterministisk af materialer[].url — intet nyt felt
// (arkitektur 2.2). Ukendt er aldrig en fejl, det er default (link).

const BILLED_EXT = /\.(jpe?g|png|webp|svg|gif)$/i;
const LYD_EXT = /\.(mp3|ogg|m4a|wav)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
const YOUTUBE_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/;
const VIMEO_RE = /vimeo\.com\/(\d+)/;

// Kilder der strukturelt ALDRIG kan embeddes, uanset filendelse — ikke fordi
// vi vælger det, men fordi de ligger bag login (UNI-Login for mitCFU). Én
// navngivet liste, ikke en regel spredt ud i medietype(): en fremtidig
// login-mur-kilde er herefter én linje, ikke en ny funktion.
const ALDRIG_EMBED_DOMAENER = [/mitcfu\.dk/i];

// Sporings-parametre der aldrig siger noget om selve materialet — luges ud af
// enhver URL før den gemmes/vises. Ikke en adblocker (det kræver netværkslag-
// håndhævelse, som et statisk site ikke har); dette er den mekaniske del af
// "ingen tredjeparts-sporing" som rent faktisk kan gøres uden en server.
const SPORINGS_PARAMS = /^(utm_|fbclid$|gclid$|mc_eid$|mc_cid$|igshid$|ref_src$|ref$|si$)/i;

export function renseUrl(url) {
  try {
    const u = new URL(url);
    [...u.searchParams.keys()].forEach((k) => { if (SPORINGS_PARAMS.test(k)) u.searchParams.delete(k); });
    return u.toString();
  } catch {
    return url; // relative/ugyldige URL'er rørt ikke — kun rigtige links renses
  }
}

export function medietype(url) {
  if (!url) return "link";
  if (ALDRIG_EMBED_DOMAENER.some((re) => re.test(url))) return "link";
  if (BILLED_EXT.test(url)) return "billede";
  if (LYD_EXT.test(url)) return "lyd";
  if (VIDEO_EXT.test(url)) return "video";
  if (YOUTUBE_RE.test(url)) return "youtube";
  if (VIMEO_RE.test(url)) return "vimeo";
  return "link";
}

// Direkte medie-element — brugt på lærerfladen (sequence/preview), hvor
// indlejring uden klik er acceptabelt (2.2).
export function medieElement(m, type) {
  if (type === "billede") {
    const img = document.createElement("img");
    img.src = renseUrl(m.url); img.alt = m.titel || ""; img.loading = "lazy";
    img.className = "medie-billede";
    return img;
  }
  if (type === "lyd") {
    const audio = document.createElement("audio");
    audio.controls = true; audio.src = renseUrl(m.url); audio.className = "medie-lyd";
    return audio;
  }
  if (type === "video") {
    const video = document.createElement("video");
    video.controls = true; video.src = renseUrl(m.url); video.className = "medie-video";
    return video;
  }
  if (type === "youtube") {
    const id = m.url.match(YOUTUBE_RE)?.[1];
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}`;
    iframe.className = "medie-youtube";
    iframe.title = m.titel || "YouTube-video";
    iframe.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    return iframe;
  }
  if (type === "vimeo") {
    const id = m.url.match(VIMEO_RE)?.[1];
    const iframe = document.createElement("iframe");
    iframe.src = `https://player.vimeo.com/video/${id}?dnt=1`; // dnt=1: Vimeos egen sporingsfri afspilningstilstand
    iframe.className = "medie-youtube"; // samme 16:9-styling som YouTube-embeddet
    iframe.title = m.titel || "Vimeo-video";
    iframe.allow = "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.loading = "lazy";
    return iframe;
  }
  return null;
}

// Click-to-load-facade — ufravigelig på elevfladen (1.4 punkt 3): intet
// tredjeparts-kald (ikke engang et thumbnail) før eleven selv klikker.
export function medieFacade(m, type) {
  const knap = document.createElement("button");
  knap.type = "button";
  knap.className = "medie-facade";
  const MEDIE_NAVN = { billede: "billede", lyd: "lyd", video: "video", youtube: "video (YouTube)", vimeo: "video (Vimeo)" };
  knap.innerHTML = `<span class="medie-facade-ikon" aria-hidden="true">&#9654;</span> Afspil ${MEDIE_NAVN[type] || "medie"}: ${m.titel || ""}`;
  knap.addEventListener("click", () => {
    const el = medieElement(m, type);
    if (el) knap.replaceWith(el);
  }, { once: true });
  return knap;
}
