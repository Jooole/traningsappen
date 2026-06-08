import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, updateDoc, onSnapshot, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Din Firebase Konfiguration
const firebaseConfig = {
    apiKey: "AIzaSyBcNw_0c3lXLfiTGKcAwZgXNlp2VADARCU",
    authDomain: "traningsappen-5e9a1.firebaseapp.com",
    projectId: "traningsappen-5e9a1",
    storageBucket: "traningsappen-5e9a1.firebasestorage.app",
    messagingSenderId: "233817536260",
    appId: "1:233817536260:web:e99541571b2a5106b78251"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Vi antar att vi har ett hårdkodat dokument för användaren i Firestore, t.ex. "users/user1"
const userDocRef = doc(db, "users", "user1");

// Appens lokala state
let allExercises = []; // Alla tillgängliga övningar i databasen
let isEditing = false;

// DOM-element
const exerciseListEl = document.getElementById('exercise-list');
const editBtn = document.getElementById('edit-btn');
const searchInput = document.getElementById('search-input');

// 2. Lyssna på data i realtid från Firebase
onSnapshot(userDocRef, (docSnap) => {
    if (docSnap.exists()) {
        allExercises = docSnap.data().exercises || [];
        renderExercises();
    } else {
        console.log("Inget dokument hittades!");
    }
});

// 3. Rendera övningarna baserat på läge och sökfilter
function renderExercises() {
    exerciseListEl.innerHTML = '';
    const searchTerm = searchInput.value.toLowerCase();

    allExercises.forEach((ex, index) => {
        // Om vi INTE redigerar, visa bara de som är valda (visible)
        if (!isEditing && !ex.visible) return;

        // Filtrera på sökord
        if (searchTerm && !ex.title.toLowerCase().includes(searchTerm)) return;

        const card = document.createElement('div');
        card.className = `exercise-card ${isEditing ? 'editing' : ''} ${ex.visible ? 'selected' : ''}`;

        card.innerHTML = `
    <div class="exercise-main-row">
        <div class="checkbox-container">
            <input type="checkbox" ${ex.visible ? 'checked' : ''} data-index="${index}" class="status-checkbox">
        </div>
        <img src="${ex.image || 'https://via.placeholder.com/80'}" alt="${ex.title}" class="exercise-img">
        
        <div class="exercise-info">
            <div class="exercise-title">${ex.title}</div>
            
            <div class="weight-container">
                Vikt: 
                <span class="weight-badge" data-index="${index}">${ex.weight} kg</span>
            </div>

            <div class="toggle-instructions" data-index="${index}">
                <span>Visa instruktioner</span>
                <svg class="chevron-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
        </div>
    </div>

    <div class="instructions-text" id="inst-${index}">
        <strong>Instruktioner</strong>
        <p>${ex.instructions || 'Inga instruktioner tillgängliga.'}</p>
    </div>
`;

        // Event: Klicka på vikten för att redigera
        const weightBadge = card.querySelector('.weight-badge');
        if (weightBadge) {
            weightBadge.addEventListener('click', (e) => startEditWeight(e, index, ex.weight));
        }

        // Event: Expandera instruktioner
        const toggleBtn = card.querySelector('.toggle-instructions');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const text = card.querySelector('.instructions-text');
                const icon = card.querySelector('.chevron-icon');
                const span = toggleBtn.querySelector('span');

                text.classList.toggle('open');
                icon.classList.toggle('rotate');

                span.textContent = text.classList.contains('open') ? 'Dölj instruktioner' : 'Visa instruktioner';
            });
        }
        // Event: Klicka på hela kortet i redigeringsläge
        card.addEventListener('click', (e) => {
            // Om vi INTE är i redigeringsläge, gör ingenting och låt vanliga klick fungera
            if (!isEditing) return;

            // Säkra att vi inte triggar detta om användaren klickar på vikt-inputen eller instruktionerna
            if (
                e.target.closest('.weight-container') ||
                e.target.closest('.toggle-instructions') ||
                e.target.closest('.instructions-text') ||
                e.target.className === 'weight-input'
            ) {
                return;
            }

            // Hämta kryssrutan inuti detta kort
            const checkbox = card.querySelector('.status-checkbox');
            if (checkbox) {
                // Växla värdet (om den var ikryssad blir den urkryssad, och tvärtom)
                checkbox.checked = !checkbox.checked;

                // Uppdatera vårt lokala state direkt så att det sparas rätt sen
                allExercises[index].visible = checkbox.checked;

                // Växla den blåa ramen på kortet direkt i gränssnittet för skön visuell feedback
                card.classList.toggle('selected', checkbox.checked);
            }
        });

        exerciseListEl.appendChild(card);
    });
}

// 4. Hantera viktändring (Byt ut till inputfält)
function startEditWeight(event, index, currentWeight) {
    const badge = event.target;
    const container = badge.parentElement;

    // Skapa inputfältet
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.1'; // Tillåter hekton
    input.className = 'weight-input';
    input.value = currentWeight;

    // Byt ut den blåa brickan mot inputfältet och sätt fokus direkt
    container.replaceChild(input, badge);
    input.focus();

    // Flagga för att förhindra att funktionen körs dubbelt (t.ex. om man trycker Enter vilket triggar både keydown och blur)
    let isSaved = false;

    // Funktion för att spara och ALLTID återställa vyn
    const saveWeight = async () => {
        if (isSaved) return;
        isSaved = true;

        // Hämta det nya värdet. Om det är tomt eller ogiltigt, behåll den gamla vikten
        const inputValue = parseFloat(input.value);
        const newWeight = !isNaN(inputValue) ? inputValue : currentWeight;

        // Uppdatera vårt lokala state
        allExercises[index].weight = newWeight;

        // Skapa en ny, fräsch blå viktbricka med det uppdaterade (eller gamla) värdet
        const newBadge = document.createElement('span');
        newBadge.className = 'weight-badge';
        newBadge.setAttribute('data-index', index);
        newBadge.textContent = `${newWeight} kg`;

        // Lägg till eventlyssnaren på den nya brickan så den går att klicka på igen
        newBadge.addEventListener('click', (e) => startEditWeight(e, index, newWeight));

        // Byt tillbaka: ut med inputfältet och in med den blåa brickan
        if (container.contains(input)) {
            container.replaceChild(newBadge, input);
        }

        // Skicka bara upp till Firebase om användaren faktiskt ändrade siffran
        if (newWeight !== currentWeight) {
            try {
                await updateDoc(userDocRef, { exercises: allExercises });
                console.log("Vikten sparades i Firebase!");
            } catch (error) {
                console.error("Kunde inte spara vikten i Firebase:", error);
            }
        }
    };

    // Event: Spara om man trycker på Enter
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Hindrar eventuella standardbeteenden
            saveWeight();
        }
    });

    // Event: Avsluta och återställ om man klickar varsomhelst utanför (blur)
    input.addEventListener('blur', saveWeight);
}

// 5. Växla Redigeringsläge (Knappen i headern)
editBtn.addEventListener('click', async () => {
    if (isEditing) {
        // Vi klickade på "Klar" -> Spara valda/bortvalda övningar till Firebase
        const checkboxes = document.querySelectorAll('.status-checkbox');
        checkboxes.forEach(cb => {
            const idx = cb.getAttribute('data-index');
            allExercises[idx].visible = cb.checked;
        });

        await updateDoc(userDocRef, { exercises: allExercises });

        isEditing = false;
        editBtn.textContent = 'Redigera';
        editBtn.className = 'btn btn-secondary';
    } else {
        // Vi klickade på "Redigera"
        isEditing = true;
        editBtn.textContent = 'Klar';
        editBtn.className = 'btn btn-primary';
    }
    renderExercises();
});

// Hämta det nya elementet för rensaknappen
const clearSearchBtn = document.getElementById('clear-search-btn');

// Uppdaterad sökfunktion som också styr kryssets synlighet
searchInput.addEventListener('input', () => {
    // Visa krysset om det finns text, annars dölj det
    if (searchInput.value.trim().length > 0) {
        clearSearchBtn.classList.add('show');
    } else {
        clearSearchBtn.classList.remove('show');
    }

    // Kör din befintliga render-funktion
    renderExercises();
});

// Eventlyssnare för att rensa sökningen när man klickar på krysset
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = ''; // Tömmer sökfältet
    clearSearchBtn.classList.remove('show'); // Gömmer krysset
    searchInput.focus(); // Sätter tillbaka markören i rutan för smidighet
    renderExercises(); // Rendera om listan så alla övningar visas igen
});