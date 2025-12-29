// ============================================
// MOLECULAR JARVIS - Main Application
// 20 struktur molekularnych z opisami dla dzieci
// ============================================

// ------- GLOBALS -------
let viewer = null;
let currentStructureIndex = 0;
let currentStyle = "cartoon";
let currentLang = "pl";

// ------- TRACKING STATE -------
let lastX = null;
let lastY = null;
let lastDistance = null;
let handCanvas = null;
let handCtx = null;

// ------- CONTROL PARAMETERS -------
const ROTATION_SCALE = 180;
const ZOOM_SCALE = 3;
const MIN_DELTA = 0.005;
const SMOOTHING = 0.3;

// Smoothed values
let smoothX = null;
let smoothY = null;
let smoothDist = null;

// ------- STRUKTUR MOLEKULARNYCH - wczytywane z JSON -------
let STRUCTURES = [];

// ------- FUNKCJA WCZYTUJĄCA STRUKTURY Z JSON -------
async function loadStructures() {
  try {
    const response = await fetch('proteins.json');
    if (!response.ok) {
      throw new Error('Nie można załadować pliku proteins.json');
    }
    STRUCTURES = await response.json();
    console.log('📌 Załadowano ' + STRUCTURES.length + ' struktur molekularnych');
  } catch (error) {
    console.error('Błąd podczas ładowania struktur:', error);
    alert('Nie można załadować danych białek. Sprawdź czy plik proteins.json jest dostępny.');
  }
}

// ------- TRANSLATIONS -------
const TRANSLATIONS = {
  pl: {
    tagline: "Interaktywna wizualizacja struktur molekularnych",
    instr1: "Jedna ręka = obracanie",
    instr2: "Dwie ręce = zoom",
    instr3: "Strzałki = zmiana struktury",
    style: "Styl:",
    reset: "Reset widoku",
    loading: "Ładowanie struktury...",
    noHand: "Szukam dłoni...",
    oneHand: "Obracanie",
    twoHands: "Zoom"
  },
  en: {
    tagline: "Interactive molecular structure visualization",
    instr1: "One hand = rotation",
    instr2: "Two hands = zoom",
    instr3: "Arrows = change structure",
    style: "Style:",
    reset: "Reset view",
    loading: "Loading structure...",
    noHand: "Looking for hands...",
    oneHand: "Rotating",
    twoHands: "Zooming"
  }
};

// ============================================
// PARTICLES & EFFECTS
// ============================================

function initParticles() {
  const container = document.getElementById('particles-container');
  const colors = ['#6366f1', '#8b5cf6', '#d946ef', '#0ea5e9', '#10b981', '#f59e0b'];
  
  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.width = (Math.random() * 8 + 4) + 'px';
    particle.style.height = particle.style.width;
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.animationDelay = Math.random() * 15 + 's';
    particle.style.animationDuration = (Math.random() * 10 + 10) + 's';
    container.appendChild(particle);
  }
}

function createConfetti() {
  const container = document.getElementById('confetti-container');
  const colors = ['#ff6b9d', '#4fc3f7', '#81c784', '#ffd54f', '#ba68c8', '#ffb74d', '#6366f1'];
  const shapes = ['square', 'circle'];
  
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = Math.random() * 0.5 + 's';
    confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
    
    if (shapes[Math.floor(Math.random() * shapes.length)] === 'circle') {
      confetti.style.borderRadius = '50%';
    }
    
    confetti.style.width = (Math.random() * 10 + 5) + 'px';
    confetti.style.height = confetti.style.width;
    
    container.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 3500);
  }
}

function showNavFeedback(emoji) {
  const feedback = document.getElementById('thumb-feedback');
  const icon = document.getElementById('thumb-feedback-icon');
  
  icon.textContent = emoji;
  feedback.classList.add('show');
  
  setTimeout(() => {
    feedback.classList.remove('show');
  }, 500);
}

// ============================================
// VIEWER INITIALIZATION
// ============================================

function initViewer() {
  const element = document.getElementById("viewer");
  if (!element || typeof $3Dmol === "undefined") {
    console.error("Viewer element or 3Dmol.js not found");
    return;
  }

  viewer = $3Dmol.createViewer(element, {
    backgroundColor: "black"
  });

  loadStructure(currentStructureIndex);
}

function loadStructure(index) {
  if (!viewer) return;

  showLoader();
  document.body.classList.add('protein-changing');
  const structure = STRUCTURES[index];

  viewer.removeAllModels();

  // Sprawdź czy struktura ma określony biological assembly
  if (structure.assembly) {
    // Dla biological assembly używamy formatu mmCIF z assembly
    const assemblyUrl = `https://files.rcsb.org/download/${structure.pdb.toLowerCase()}-assembly${structure.assembly}.cif`;
    
    console.log("Ładowanie biological assembly z:", assemblyUrl);
    
    // Pobierz plik i załaduj
    fetch(assemblyUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(data => {
        viewer.addModel(data, "cif");
        applyStyle(currentStyle);
        viewer.zoomTo();
        viewer.render();
        updateStructureInfo(index);
        updateStructureCounter();
        hideLoader();
        
        setTimeout(() => {
          document.body.classList.remove('protein-changing');
        }, 500);
      })
      .catch(error => {
        console.error("Błąd ładowania biological assembly:", error);
        console.log("Próbuję standardowego PDB...");
        
        // Fallback - spróbuj standardowego PDB
        $3Dmol.download(`pdb:${structure.pdb}`, viewer, {}, function () {
          applyStyle(currentStyle);
          viewer.zoomTo();
          viewer.render();
          updateStructureInfo(index);
          updateStructureCounter();
          hideLoader();
          
          setTimeout(() => {
            document.body.classList.remove('protein-changing');
          }, 500);
        });
      });
  } else {
    // Standardowe ładowanie dla zwykłych struktur
    $3Dmol.download(`pdb:${structure.pdb}`, viewer, {}, function () {
      applyStyle(currentStyle);
      viewer.zoomTo();
      viewer.render();
      updateStructureInfo(index);
      updateStructureCounter();
      hideLoader();
      
      setTimeout(() => {
        document.body.classList.remove('protein-changing');
      }, 500);
    });
  }
}

function applyStyle(style) {
  if (!viewer) return;

  viewer.setStyle({}, {});

  switch (style) {
    case "cartoon":
      viewer.setStyle({}, { cartoon: { color: "spectrum" } });
      break;
    case "stick":
      viewer.setStyle({}, { stick: { colorscheme: "Jmol" } });
      break;
    case "sphere":
      viewer.setStyle({}, { sphere: { colorscheme: "Jmol", scale: 0.3 } });
      break;
    case "surface":
      viewer.setStyle({}, { cartoon: { color: "spectrum", opacity: 0.5 } });
      viewer.addSurface($3Dmol.SurfaceType.VDW, {
        opacity: 0.85,
        colorscheme: "whiteCarbon"
      });
      break;
    case "line":
      viewer.setStyle({}, { line: { colorscheme: "Jmol" } });
      break;
    default:
      viewer.setStyle({}, { cartoon: { color: "spectrum" } });
  }

  viewer.render();
}

function resetView() {
  if (!viewer) return;
  viewer.zoomTo();
  viewer.render();
}

function updateStructureInfo(index) {
  const structure = STRUCTURES[index];
  document.getElementById("protein-emoji").textContent = structure.emoji;
  document.getElementById("protein-name").textContent = structure.name[currentLang];
  document.getElementById("protein-pdb").textContent = `PDB: ${structure.pdb} | ${structure.category[currentLang]}`;
  document.getElementById("protein-desc").textContent = structure.desc[currentLang];
  document.getElementById("fun-fact-text").textContent = structure.funFact[currentLang];
}

function updateStructureCounter() {
  document.getElementById("protein-counter").textContent =
    `${currentStructureIndex + 1} / ${STRUCTURES.length}`;
}

function nextStructure() {
  currentStructureIndex = (currentStructureIndex + 1) % STRUCTURES.length;
  showNavFeedback(STRUCTURES[currentStructureIndex].emoji);
  createConfetti();
  loadStructure(currentStructureIndex);
}

function prevStructure() {
  currentStructureIndex = (currentStructureIndex - 1 + STRUCTURES.length) % STRUCTURES.length;
  showNavFeedback(STRUCTURES[currentStructureIndex].emoji);
  createConfetti();
  loadStructure(currentStructureIndex);
}

// ============================================
// HAND TRACKING
// ============================================

function initHandTracking() {
  const videoElement = document.getElementById("input_video");
  handCanvas = document.getElementById("hand_canvas");

  if (!videoElement || !handCanvas) {
    console.error("Video or canvas element not found");
    return;
  }

  handCtx = handCanvas.getContext("2d");

  const hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });

  hands.onResults(onResults);

  const camera = new Camera(videoElement, {
    onFrame: async () => {
      try {
        await hands.send({ image: videoElement });
      } catch (e) {
        console.error("Hand tracking error:", e);
      }
    },
    width: 640,
    height: 480
  });

  camera.start();
}

function resetTrackingState() {
  lastX = null;
  lastY = null;
  lastDistance = null;
  smoothX = null;
  smoothY = null;
  smoothDist = null;
}

function onResults(results) {
  const videoElement = document.getElementById("input_video");
  handCanvas.width = videoElement.videoWidth || 640;
  handCanvas.height = videoElement.videoHeight || 480;

  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  const landmarks = results.multiHandLandmarks || [];

  if (landmarks.length === 0) {
    resetTrackingState();
    updateGestureIndicator("none");
    return;
  }

  drawHands(results);

  if (landmarks.length === 1) {
    handleSingleHand(landmarks[0]);
    updateGestureIndicator("one");
  } else if (landmarks.length >= 2) {
    handleTwoHands(landmarks[0], landmarks[1]);
    updateGestureIndicator("two");
  }
}

function drawHands(results) {
  const landmarks = results.multiHandLandmarks || [];

  for (const hand of landmarks) {
    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [0, 9], [9, 10], [10, 11], [11, 12],
      [0, 13], [13, 14], [14, 15], [15, 16],
      [0, 17], [17, 18], [18, 19], [19, 20],
      [5, 9], [9, 13], [13, 17]
    ];

    const gradient = handCtx.createLinearGradient(0, 0, handCanvas.width, handCanvas.height);
    gradient.addColorStop(0, "#6366f1");
    gradient.addColorStop(0.5, "#8b5cf6");
    gradient.addColorStop(1, "#d946ef");
    
    handCtx.strokeStyle = gradient;
    handCtx.lineWidth = 4;
    handCtx.lineCap = "round";
    handCtx.shadowColor = "#6366f1";
    handCtx.shadowBlur = 10;

    for (const [i, j] of connections) {
      const p1 = hand[i];
      const p2 = hand[j];
      handCtx.beginPath();
      handCtx.moveTo(p1.x * handCanvas.width, p1.y * handCanvas.height);
      handCtx.lineTo(p2.x * handCanvas.width, p2.y * handCanvas.height);
      handCtx.stroke();
    }

    handCtx.shadowBlur = 0;
    
    for (let i = 0; i < hand.length; i++) {
      const landmark = hand[i];
      const x = landmark.x * handCanvas.width;
      const y = landmark.y * handCanvas.height;

      const isWrist = i === 0;
      
      handCtx.beginPath();
      handCtx.arc(x, y, isWrist ? 10 : 6, 0, 2 * Math.PI);
      
      if (isWrist) {
        handCtx.fillStyle = "#f59e0b";
      } else {
        handCtx.fillStyle = "#818cf8";
      }
      
      handCtx.fill();
      handCtx.strokeStyle = "#ffffff";
      handCtx.lineWidth = 2;
      handCtx.stroke();
    }
  }
}

function handleSingleHand(hand) {
  if (!viewer) return;

  const palm = hand[0];
  const middle = hand[9];
  const x = (palm.x + middle.x) / 2;
  const y = (palm.y + middle.y) / 2;

  if (smoothX === null) {
    smoothX = x;
    smoothY = y;
  } else {
    smoothX = smoothX + SMOOTHING * (x - smoothX);
    smoothY = smoothY + SMOOTHING * (y - smoothY);
  }

  if (lastX !== null && lastY !== null) {
    const dx = smoothX - lastX;
    const dy = smoothY - lastY;

    if (Math.abs(dx) > MIN_DELTA || Math.abs(dy) > MIN_DELTA) {
      const angleY = -dx * ROTATION_SCALE;
      const angleX = dy * ROTATION_SCALE;

      viewer.rotate(angleY, "y");
      viewer.rotate(angleX, "x");
      viewer.render();
    }
  }

  lastX = smoothX;
  lastY = smoothY;
  lastDistance = null;
  smoothDist = null;
}

function handleTwoHands(hand1, hand2) {
  if (!viewer) return;

  const p1x = (hand1[0].x + hand1[9].x) / 2;
  const p1y = (hand1[0].y + hand1[9].y) / 2;
  const p2x = (hand2[0].x + hand2[9].x) / 2;
  const p2y = (hand2[0].y + hand2[9].y) / 2;

  const dx = p1x - p2x;
  const dy = p1y - p2y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (smoothDist === null) {
    smoothDist = dist;
  } else {
    smoothDist = smoothDist + SMOOTHING * (dist - smoothDist);
  }

  if (lastDistance !== null) {
    const diff = smoothDist - lastDistance;

    if (Math.abs(diff) > MIN_DELTA) {
      const zoomFactor = 1 + diff * ZOOM_SCALE;

      if (zoomFactor > 0.5 && zoomFactor < 2) {
        viewer.zoom(zoomFactor);
        viewer.render();
      }
    }
  }

  lastDistance = smoothDist;
  lastX = null;
  lastY = null;
  smoothX = null;
  smoothY = null;
}

// ============================================
// UI UPDATES
// ============================================

function updateGestureIndicator(type) {
  const indicator = document.getElementById("gesture-indicator");
  const icon = document.getElementById("gesture-icon");
  const text = document.getElementById("gesture-text");

  indicator.classList.remove("active");

  switch (type) {
    case "none":
      icon.textContent = "👋";
      text.textContent = TRANSLATIONS[currentLang].noHand;
      break;
    case "one":
      icon.textContent = "✋";
      text.textContent = TRANSLATIONS[currentLang].oneHand;
      indicator.classList.add("active");
      break;
    case "two":
      icon.textContent = "🤲";
      text.textContent = TRANSLATIONS[currentLang].twoHands;
      indicator.classList.add("active");
      break;
  }
}

function showLoader() {
  document.getElementById("loader").classList.remove("hidden");
}

function hideLoader() {
  document.getElementById("loader").classList.add("hidden");
}

// ============================================
// LANGUAGE HANDLING
// ============================================

function setLanguage(lang) {
  currentLang = lang;

  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.getElementById(`lang-${lang}`).classList.add("active");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (TRANSLATIONS[lang][key]) {
      el.textContent = TRANSLATIONS[lang][key];
    }
  });

  updateStructureInfo(currentStructureIndex);
}

// ============================================
// EVENT LISTENERS
// ============================================

function initEventListeners() {
  document.getElementById("lang-pl").addEventListener("click", () => setLanguage("pl"));
  document.getElementById("lang-en").addEventListener("click", () => setLanguage("en"));

  document.querySelectorAll(".style-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".style-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentStyle = btn.getAttribute("data-style");

      if (viewer) {
        viewer.removeAllSurfaces();
        applyStyle(currentStyle);
      }
    });
  });

  document.getElementById("reset-btn").addEventListener("click", resetView);

  document.getElementById("prev-protein").addEventListener("click", prevStructure);
  document.getElementById("next-protein").addEventListener("click", nextStructure);

  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowLeft":
        prevStructure();
        break;
      case "ArrowRight":
        nextStructure();
        break;
      case "r":
      case "R":
        resetView();
        break;
      case "1":
        setStyleByIndex(0);
        break;
      case "2":
        setStyleByIndex(1);
        break;
      case "3":
        setStyleByIndex(2);
        break;
      case "4":
        setStyleByIndex(3);
        break;
      case "5":
        setStyleByIndex(4);
        break;
    }
  });
}

function setStyleByIndex(index) {
  const buttons = document.querySelectorAll(".style-btn");
  if (buttons[index]) {
    buttons[index].click();
  }
}

// ============================================
// INITIALIZATION
// ============================================

window.addEventListener("DOMContentLoaded", async () => {
  initParticles();
  initEventListeners();
  
  // Najpierw ładujemy struktury z JSON
  await loadStructures();
  
  // Potem inicjalizujemy widok i tracking
  initViewer();
  initHandTracking();
  setLanguage("pl");
  
  console.log("🧬 Molecular Jarvis załadowany!");
  console.log("📌 Użyj strzałek ← → aby zmieniać struktury");
  console.log("📌 Dostępnych jest " + STRUCTURES.length + " struktur molekularnych");
});
