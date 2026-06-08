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
        if (!isEditing && !ex.visible) return;
        if (searchTerm && !ex.title.toLowerCase().includes(searchTerm)) return;

        const card = document.createElement('div');
        card.className = `exercise-card ${isEditing ? 'editing' : ''} ${ex.visible ? 'selected' : ''}`;

        // HÄR ÄR NYTT: Gör kortet dragbart ENBART om vi är i redigeringsläge
        if (isEditing) {
            card.setAttribute('draggable', 'true');
            card.setAttribute('data-index', index);
        }

        card.innerHTML = `
            <div class="exercise-main-row">
                ${isEditing ? '<div class="drag-handle"><i class="mdi mdi-drag-vertical"></i></div>' : ''}
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

        // Event: Klicka på hela kortet i redigeringsläge (justerad för att inte krocka med drag-handtaget)
        card.addEventListener('click', (e) => {
            if (!isEditing) return;
            if (
                e.target.closest('.weight-container') ||
                e.target.closest('.toggle-instructions') ||
                e.target.closest('.instructions-text') ||
                e.target.closest('.drag-handle') || // NYTT: Klicka på drag-handtaget ska inte toggla checkboxen
                e.target.className === 'weight-input'
            ) {
                return;
            }

            const checkbox = card.querySelector('.status-checkbox');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                allExercises[index].visible = checkbox.checked;
                card.classList.toggle('selected', checkbox.checked);
            }
        });

        // HÄR ÄR NYTT: Lägg till drag-events på kortet
        if (isEditing) {
            setupDragAndDropEvents(card);
        }

        exerciseListEl.appendChild(card);
    });
}

// Helt ny funktion för att hantera själva flytt-logiken
function setupDragAndDropEvents(card) {
    const dragHandle = card.querySelector('.drag-handle');
    if (!dragHandle) return;

    let startY = 0;
    let currentTranslateY = 0;
    let initialIndex = 0;
    let currentIndex = 0;
    let cardHeight = 0;
    let allCards = [];

    dragHandle.addEventListener('touchstart', (e) => {
        if (!isEditing) return;

        const touch = e.touches[0];
        startY = touch.clientY;
        currentTranslateY = 0;

        // Sätt kortet i "svävande" läge
        card.classList.add('dragging');

        // Hämta en färsk lista på alla kort och ta reda på var vi startar
        allCards = Array.from(exerciseListEl.querySelectorAll('.exercise-card'));
        initialIndex = allCards.indexOf(card);
        currentIndex = initialIndex;

        // Räkna ut höjden på kortet inklusive gapet (marginalen) till nästa kort
        cardHeight = card.offsetHeight + 12; // 12px är gapet i din .exercise-list
    }, { passive: true });

    dragHandle.addEventListener('touchmove', (e) => {
        if (!isEditing) return;
        if (e.cancelable) e.preventDefault(); // Stoppa mobilens skroll

        const touch = e.touches[0];
        currentTranslateY = touch.clientY - startY;

        // Flytta det upplyfta kortet i realtid efter tummen
        card.style.transform = `translateY(${currentTranslateY}px)`;

        // Räkna ut hur många positioner upp eller ner vi har flyttat fingret
        // Genom att lägga till (cardHeight / 2) reagerar listan precis när vi passerat halvvägs över ett annat kort!
        const direction = currentTranslateY > 0 ? 1 : -1;
        const positionsMoved = Math.round(currentTranslateY / cardHeight);
        const targetIndex = initialIndex + positionsMoved;

        // Håll målet inom listans gränser
        const boundedTargetIndex = Math.max(0, Math.min(allCards.length - 1, targetIndex));

        if (boundedTargetIndex !== currentIndex) {
            currentIndex = boundedTargetIndex;
        }

        // Animera de ANDRA korten för att göra plats
        allCards.forEach((otherCard, idx) => {
            if (otherCard === card) return; // Hoppa över kortet vi håller i

            // Om vi drar NEDÅT och detta kort ligger mellan startpositionen och där vi är nu:
            // Animera detta kort UPPÅT för att ge plats under
            if (idx > initialIndex && idx <= currentIndex) {
                otherCard.style.transform = `translateY(${-cardHeight}px)`;
            }
            // Om vi drar UPPÅT och detta kort ligger mellan startpositionen och där vi är nu:
            // Animera detta kort NEDÅT för att ge plats över
            else if (idx < initialIndex && idx >= currentIndex) {
                otherCard.style.transform = `translateY(${cardHeight}px)`;
            }
            // Annars ska kortet ligga kvar på sin vanliga plats
            else {
                otherCard.style.transform = '';
            }
        });
    }, { passive: false });

    dragHandle.addEventListener('touchend', () => {
        if (!isEditing) return;

        // Avsluta det svävande läget
        card.classList.remove('dragging');
        card.style.transform = '';

        // Återställ animationstexten på alla andra kort
        allCards.forEach(otherCard => {
            otherCard.style.transform = '';
        });

        // Flytta kortet permanent i DOM-trädet till sin nya position
        if (currentIndex !== initialIndex) {
            const referenceCard = allCards[currentIndex];
            if (currentIndex > initialIndex) {
                // Om vi flyttat ner, lägg kortet efter målkortet
                exerciseListEl.insertBefore(card, referenceCard.nextSibling);
            } else {
                // Om vi flyttat upp, lägg kortet före målkortet
                exerciseListEl.insertBefore(card, referenceCard);
            }
        }

        // Spara den nya ordningen i din array för Firebase
        reorderExercisesArray();
    });
}

// Hjälpfunktion som läser av den nya ordningen i DOM:en och sparar om i allExercises-arrayen
function reorderExercisesArray() {
    const currentCards = Array.from(exerciseListEl.querySelectorAll('.exercise-card'));
    const newOrderedExercises = [];

    currentCards.forEach(card => {
        const origIndex = parseInt(card.getAttribute('data-index'));
        if (!isNaN(origIndex)) {
            newOrderedExercises.push(allExercises[origIndex]);
        }
    });

    // Spara den nya ordningen i vår lokala array (Firebase sparar detta sen när man trycker på "Klar")
    allExercises = newOrderedExercises;

    // Uppdatera data-attributen i DOM:en utan att rendera om (vilket skulle avbryta draget)
    currentCards.forEach((card, newIdx) => {
        card.setAttribute('data-index', newIdx);
        const cb = card.querySelector('.status-checkbox');
        if (cb) cb.setAttribute('data-index', newIdx);
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