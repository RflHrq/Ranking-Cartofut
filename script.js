document.addEventListener('DOMContentLoaded', () => {
    // Lendo a posicaoId diretamente do atributo data-posicao-id do body
    const bodyElement = document.querySelector('body');
    const posicaoId = parseInt(bodyElement.dataset.posicaoId);
    
    // Verificando se a posicaoId foi encontrada, senão define um valor padrão para evitar erros.
    if (isNaN(posicaoId)) {
        console.error("Posição do jogador não definida. Usando valor padrão: 4.");
        posicaoId = 4; 
    }
    
    // CHAVE ÚNICA PARA O localStorage
    const storageKey = `rankingState-${window.location.pathname}`;

    const wrapperNumberSelect = document.getElementById('wrapperNumber');
    const cardNumberSelect = document.getElementById('cardNumber');
    const rankingsWrapper = document.getElementById('rankings-wrapper');
    const rankingTemplate = document.getElementById('ranking-template');
    const selectMenu = document.getElementById('select-menu');
    const selectMenuTitle = document.getElementById('select-menu-title');
    const playerSearchInput = document.getElementById('player-search');
    const playerListUl = document.getElementById('player-list');

    let allPlayers = [];
    let selectedPlayers = new Set();
    let maxPlayersAllowed = 0;
    let clubesData = {};

    const statusMapping = {
        3: { text: "SUSPENSO", color: "red" },
        5: { text: "CONTUNDIDO", color: "maroon" },
        6: { text: "NULO", color: "gray" },
        2: { text: "DÚVIDA", color: "#ffc700" },
        7: { text: "PROVÁVEL", color: "green" }
    };

    function saveState() {
        const rankingsData = [];
        const rankingElements = document.querySelectorAll('.main-content-containers');
        rankingElements.forEach(rankingEl => {
            const rankingName = rankingEl.querySelector('.ranking-title-editable').textContent || 'Nome do Ranking';
            const slots = rankingEl.querySelectorAll('.ranking-slot-item .card');
            const rankedPlayers = Array.from(slots).map(card => card ? card.dataset.playerId : null);
            rankingsData.push({
                name: rankingName,
                rankedPlayers: rankedPlayers
            });
        });

        const state = {
            wrapperNumber: wrapperNumberSelect.value,
            cardNumber: cardNumberSelect.value,
            selectedPlayers: Array.from(selectedPlayers),
            rankings: rankingsData
        };

        localStorage.setItem(storageKey, JSON.stringify(state));
        console.log('Estado salvo com sucesso!');
    }

    function loadState() {
        const savedState = localStorage.getItem(storageKey);
        if (savedState) {
            const state = JSON.parse(savedState);
            console.log('Estado carregado:', state);

            wrapperNumberSelect.value = state.wrapperNumber;
            cardNumberSelect.value = state.cardNumber;
            selectedPlayers = new Set(state.selectedPlayers);
            maxPlayersAllowed = parseInt(state.cardNumber);
            
            rankingsWrapper.innerHTML = '';
            for (let i = 0; i < state.rankings.length; i++) {
                const rankingData = state.rankings[i];
                const clone = rankingTemplate.content.cloneNode(true);
                const rankingId = `ranking-${i}`;
                const draggable = clone.querySelector('.draggable-container');
                const rankingCardWrapper = clone.querySelector('.ranking-card-wrapper');
                const rankingTitle = clone.querySelector('.ranking-title-editable');

                rankingTitle.textContent = rankingData.name;
                draggable.id = `draggable-container-${rankingId}`;

                let playersInSlots = new Set();
                
                for (let j = 0; j < maxPlayersAllowed; j++) {
                    const slotContainer = document.createElement('div');
                    slotContainer.className = 'ranking-slot-item';

                    const positionSpan = document.createElement('span');
                    positionSpan.className = 'slot-position';
                    positionSpan.textContent = `${j + 1}.`;

                    const slot = createFixedSlot();
                    slot.id = `fixed-slot-${rankingId}-${j}`;

                    const playerIdInSlot = rankingData.rankedPlayers[j];
                    if (playerIdInSlot && selectedPlayers.has(playerIdInSlot)) {
                        const player = allPlayers.find(p => p.id === playerIdInSlot);
                        if (player) {
                            const card = createCard(player);
                            slot.appendChild(card);
                            playersInSlots.add(playerIdInSlot);
                        }
                    }
                    slotContainer.appendChild(positionSpan);
                    slotContainer.appendChild(slot);
                    rankingCardWrapper.appendChild(slotContainer);
                }

                const playersForDraggable = Array.from(selectedPlayers).filter(id => !playersInSlots.has(id));
                playersForDraggable.forEach(playerId => {
                     const player = allPlayers.find(p => p.id === playerId);
                     if (player) {
                         const card = createCard(player);
                         draggable.appendChild(card);
                     }
                });

                const numPlayersInDraggable = playersForDraggable.length;
                const emptyCardsNeeded = maxPlayersAllowed - selectedPlayers.size;
                
                for (let j = 0; j < emptyCardsNeeded; j++) {
                     const dummyCard = createCard({ id: `temp-card-draggable-${Date.now()}-${i}-${j}`, name: `Jogador (Vazio)`, club: '', status_text: '', status_color: '' });
                     draggable.appendChild(dummyCard);
                }

                rankingsWrapper.appendChild(clone);
                const fixedSlots = rankingCardWrapper.querySelectorAll('.fixed-slot');
                setupDragAndDrop(draggable, fixedSlots);
                
                rankingTitle.addEventListener('input', () => {
                    saveState();
                });
            }
            updatePlayerList();
        } else {
            console.log('Nenhum estado salvo encontrado. Carregando configurações padrão.');
            setupCards();
        }
    }

   async function loadPlayersFromAPI() {
    try {
        const response = await fetch('http://localhost:3000/api/cartola/mercado');
        if (!response.ok) {
            throw new Error(`Erro ao carregar jogadores: ${response.statusText}`);
        }
        const data = await response.json();
        clubesData = data.clubes;
        const atletasArray = Object.values(data.atletas);

        // 🔹 Atualiza o título da rodada
        const mainTitleRound = document.getElementById('main-site-title-round');
        if (mainTitleRound && atletasArray.length > 0) {
            const maiorRodada = Math.max(...atletasArray.map(atleta => atleta.rodada_id));
            mainTitleRound.textContent = `Ranking da Rodada ${maiorRodada + 1}`;
        }

        const jogadoresDaPosicao = atletasArray.filter(atleta => atleta.posicao_id === posicaoId);

        allPlayers = jogadoresDaPosicao.map(atleta => {
            const clubeId = atleta.clube_id;
            const clubeInfo = clubesData[clubeId];
            const clubName = clubeInfo ? (clubeInfo.nome || clubeInfo.nome_fantasia) : `ID do Clube: ${clubeId}`;
            const statusInfo = statusMapping[atleta.status_id] || { text: "Desconhecido", color: "lightgray" };
            return {
                id: atleta.atleta_id.toString(),
                name: atleta.apelido,
                club: clubName,
                status_id: atleta.status_id,
                status_text: statusInfo.text,
                status_color: statusInfo.color,
                preco_num: atleta.preco_num,
                clube_id: clubeId
            };
        }).sort((a, b) => a.name.localeCompare(b.name));
        
        loadState(); 
        updatePlayerList();
    } catch (error) {
        console.error('Erro ao carregar jogadores da API do Cartola:', error);
    }
}


    document.querySelector('#menu button').addEventListener('click', () => {
        setupCards();
        saveState();
    });

    document.addEventListener('keydown', function (event) {
        const active = document.activeElement;
        const isTyping = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);

        if (isTyping) {
            return;
        }

        if (event.ctrlKey && (event.key === 'e' || event.key === 'E')) {
            event.preventDefault(); 
            toggleMenu('menu');
        } else if (event.ctrlKey && (event.key === 's' || event.key === 'S')) {
            event.preventDefault(); 
            toggleMenu('select-menu');
        } else if (event.ctrlKey && (event.key === 'i' || event.key === 'I')) {
            event.preventDefault(); 
            resetRankings();
        }
    });

    function setupCards() {
        const numRankings = parseInt(wrapperNumberSelect.value);
        maxPlayersAllowed = parseInt(cardNumberSelect.value);
        rankingsWrapper.innerHTML = '';
        selectedPlayers.clear();

        for (let i = 0; i < numRankings; i++) {
            const clone = rankingTemplate.content.cloneNode(true);
            const rankingId = `ranking-${i}`;
            const draggable = clone.querySelector('.draggable-container');
            const rankingCardWrapper = clone.querySelector('.ranking-card-wrapper');
            const rankingTitle = clone.querySelector('.ranking-title-editable');

            draggable.id = `draggable-container-${rankingId}`;

            for (let j = 1; j <= maxPlayersAllowed; j++) {
                const card = createCard({ id: `temp-card-${rankingId}-${j}`, name: `Jogador ${j} (Vazio)`, club: '', status_text: '', status_color: '' });
                draggable.appendChild(card);
            }

            for (let j = 0; j < maxPlayersAllowed; j++) {
                const slotContainer = document.createElement('div');
                slotContainer.className = 'ranking-slot-item';

                const positionSpan = document.createElement('span');
                positionSpan.className = 'slot-position';
                positionSpan.textContent = `${j + 1}.`;

                const slot = createFixedSlot();
                slot.id = `fixed-slot-${rankingId}-${j}`;

                slotContainer.appendChild(positionSpan);
                slotContainer.appendChild(slot);
                rankingCardWrapper.appendChild(slotContainer);
            }

            rankingsWrapper.appendChild(clone);
            const fixedSlots = rankingCardWrapper.querySelectorAll('.fixed-slot');
            setupDragAndDrop(draggable, fixedSlots);
            
            rankingTitle.addEventListener('input', () => {
                saveState();
            });
        }
    }

    function createCard(player) {
        const card = document.createElement('div');
        card.className = 'card';
        card.id = player.id;
        card.draggable = true;
        card.dataset.playerId = player.id;
        card.style.position = 'relative';

        const playerImageContainer = document.createElement('div');
        playerImageContainer.className = 'player-image-container';
        if (player.name && !player.name.includes('(Vazio)')) {
            const playerImage = document.createElement('img');
            playerImage.src = `assets/Fotos Jogadores/${player.id}.png`;
            playerImage.draggable = false;
            playerImage.onerror = function() {
                this.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                this.style.backgroundColor = '#ccc';
            };
            playerImage.alt = player.name;
            playerImageContainer.appendChild(playerImage);
        }
        card.appendChild(playerImageContainer);

        const playerInfoContainer = document.createElement('div');
        playerInfoContainer.className = 'player-info-container';

        const playerNameSpan = document.createElement('span');
        playerNameSpan.className = 'player-name';
        playerNameSpan.textContent = player.name;

        const playerPriceSpan = document.createElement('span');
        playerPriceSpan.className = 'player-price';
        playerPriceSpan.textContent = player.preco_num !== undefined
            ? `C$ ${player.preco_num.toFixed(2).replace('.', ',')}`
            : 'C$ 0,00';

        playerInfoContainer.appendChild(playerNameSpan);
        playerInfoContainer.appendChild(playerPriceSpan);
        card.appendChild(playerInfoContainer);

        const statusAndBadgeContainer = document.createElement('div');
        statusAndBadgeContainer.className = 'status-badge-container';

        const clubBadge = document.createElement('img');
        clubBadge.className = 'club-badge';
        if (player.clube_id !== undefined && player.clube_id !== null) {
            clubBadge.src = `assets/Fotos Jogadores/${player.clube_id}.png`;
            clubBadge.draggable = false;
        }
        statusAndBadgeContainer.appendChild(clubBadge);
        card.appendChild(statusAndBadgeContainer);

        const statusLightContainer = document.createElement('div');
        statusLightContainer.className = 'status-light-container';
        const statusLight = document.createElement('div');
        statusLight.className = 'status-light';
        statusLight.style.backgroundColor = player.status_color || 'transparent';
        statusLight.classList.add(`status-${player.status_text.toLowerCase().replace(/ /g, '-')}`);
        statusLightContainer.appendChild(statusLight);
        card.appendChild(statusLightContainer);

        return card;
    }


    function createFixedSlot() {
        const slot = document.createElement('div');
        slot.className = 'fixed-slot';
        return slot;
    }

    function setupDragAndDrop(draggableContainer, fixedSlots) {
        let draggedCard = null;
        let originalParent = null;
        let originalNextSibling = null;

        const onDragStart = (event) => {
            if (!event.target.classList.contains('card')) return;
            draggedCard = event.target;
            originalParent = draggedCard.parentElement;
            originalNextSibling = draggedCard.nextElementSibling;
            event.dataTransfer.setData('text/plain', draggedCard.id);

            const dragImage = draggedCard.cloneNode(true);
            const cardWidth = draggedCard.offsetWidth;
            const cardHeight = draggedCard.offsetHeight;
            
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-1000px';
            dragImage.style.left = '-1000px';
            dragImage.style.width = cardWidth + 'px';
            dragImage.style.height = cardHeight + 'px';
            document.body.appendChild(dragImage);

            event.dataTransfer.setDragImage(dragImage, 100 , 60);

            draggedCard.addEventListener('dragend', () => {
                dragImage.remove();
            }, { once: true });
        };

        const onDrop = (event, targetElement) => {
            event.preventDefault();
            const targetSlot = event.target.closest('.fixed-slot');

            fixedSlots.forEach(slot => slot.classList.remove('drag-over'));

            if (!draggedCard) return;

            if (targetSlot) {
                if (targetSlot.children.length === 0) {
                    targetSlot.appendChild(draggedCard);
                } else {
                    const existingCard = targetSlot.querySelector('.card');
                    if (existingCard) {
                        existingCard.remove();
                        targetSlot.appendChild(draggedCard);

                        if (originalNextSibling) {
                            originalParent.insertBefore(existingCard, originalNextSibling);
                        } else {
                            originalParent.appendChild(existingCard);
                        }
                    }
                }
            } else if (targetElement === draggableContainer || draggableContainer.contains(event.target)) {
                draggableContainer.appendChild(draggedCard);
            }

            draggedCard = null;
            originalParent = null;
            originalNextSibling = null;

            saveState();
        };

        draggableContainer.addEventListener('dragstart', onDragStart);
        draggableContainer.addEventListener('dragover', event => event.preventDefault());
        draggableContainer.addEventListener('drop', event => onDrop(event, draggableContainer));

        fixedSlots.forEach(slot => {
            slot.addEventListener('dragstart', onDragStart);

            slot.addEventListener('dragover', event => {
                event.preventDefault();
                event.target.closest('.fixed-slot').classList.add('drag-over');
            });

            slot.addEventListener('dragleave', event => {
                event.target.closest('.fixed-slot').classList.remove('drag-over');
            });

            slot.addEventListener('drop', event => onDrop(event, slot));
        });
    }

    function toggleMenu(menuId) {
        const menu = document.getElementById(menuId);
        const overlayId = 'overlay-' + menuId;
        let overlay = document.getElementById(overlayId);

        if (menu.style.display === 'none' || menu.style.display === '') {
            menu.style.display = 'block';

            if (!overlay) {
                const newOverlay = document.createElement('div');
                newOverlay.className = 'overlay';
                newOverlay.id = overlayId;
                document.body.appendChild(newOverlay);
                newOverlay.addEventListener('click', () => closeMenu(menuId));
                newOverlay.style.display = 'block';
            } else {
                overlay.style.display = 'block';
            }

            document.body.classList.add('no-scroll');

            if (menuId === 'select-menu') {
                updatePlayerList();
                playerSearchInput.value = '';
                playerSearchInput.blur();
                selectMenuTitle.textContent = `Selecionar Jogadores (${selectedPlayers.size}/${maxPlayersAllowed})`;
            }

        } else {
            menu.style.display = 'none';
            if (overlay) {
                overlay.style.display = 'none';
            }
            document.body.classList.remove('no-scroll');
        }
    }

    function closeMenu(menuId) {
        const menu = document.getElementById(menuId);
        const overlayId = 'overlay-' + menuId;
        let overlay = document.getElementById(overlayId);

        menu.style.display = 'none';
        if (overlay) {
            overlay.style.display = 'none';
        }
        document.body.classList.remove('no-scroll');
    }

    function updatePlayerList(searchTerm = '') {
        playerListUl.innerHTML = '';

        const filteredPlayers = allPlayers.filter(player =>
            player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            player.club.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const selectedFilteredPlayers = filteredPlayers.filter(player => selectedPlayers.has(player.id));
        const unselectedFilteredPlayers = filteredPlayers.filter(player => !selectedPlayers.has(player.id));

        const orderedPlayers = [...selectedFilteredPlayers, ...unselectedFilteredPlayers];

        orderedPlayers.forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.name} (${player.club})`;
            li.dataset.playerId = player.id;
            if (selectedPlayers.has(player.id)) {
                li.classList.add('selected');
            }
            li.addEventListener('click', () => togglePlayerSelection(player));
            playerListUl.appendChild(li);
        });
    }

    function togglePlayerSelection(player) {
        const listItem = playerListUl.querySelector(`[data-player-id="${player.id}"]`);

        if (selectedPlayers.has(player.id)) {
            selectedPlayers.delete(player.id);
            listItem.classList.remove('selected');
            removePlayerCard(player.id);
        } else {
            if (selectedPlayers.size < maxPlayersAllowed) {
                selectedPlayers.add(player.id);
                listItem.classList.add('selected');
                addPlayerCard(player);
            } else {
                alert(`Você pode selecionar no máximo ${maxPlayersAllowed} jogadores.`);
            }
        }
        selectMenuTitle.textContent = `Selecionar Jogadores (${selectedPlayers.size}/${maxPlayersAllowed})`;
        updatePlayerList(playerSearchInput.value);
        saveState();
    }
    
    function addPlayerCard(player) {
        const draggableContainers = document.querySelectorAll('.draggable-container');
        draggableContainers.forEach(container => {
            const existingCards = Array.from(container.children);
            const emptyCard = existingCards.find(card => card.textContent.includes('(Vazio)'));

            if (emptyCard) {
                emptyCard.remove();
                const newCard = createCard(player);
                container.appendChild(newCard);
            }
        });
    }

    function removePlayerCard(playerId) {
        const cardsToRemove = document.querySelectorAll(`.card[data-player-id="${playerId}"]`);
        cardsToRemove.forEach(card => card.remove());

        const currentSelectedCount = selectedPlayers.size;
        const maxPlayers = parseInt(cardNumberSelect.value);

        if (currentSelectedCount < maxPlayers) {
            const draggableContainers = document.querySelectorAll('.draggable-container');
            draggableContainers.forEach(container => {
                const dummyCard = createCard({ id: `temp-card-draggable-${Date.now()}`, name: `Jogador (Vazio)`, club: '', status_text: '', status_color: '' });
                container.appendChild(dummyCard);
            });
        }

        const fixedSlots = document.querySelectorAll('.fixed-slot');
        fixedSlots.forEach(slot => slot.classList.remove('drag-over'));
    }

    function resetRankings() {
        const rankingCardWrappers = document.querySelectorAll('.ranking-card-wrapper');
        
        rankingCardWrappers.forEach(wrapper => {
            const cardsInSlots = wrapper.querySelectorAll('.fixed-slot .card');
            const draggableContainer = wrapper.closest('.main-content-containers').querySelector('.draggable-container');

            cardsInSlots.forEach(card => {
                draggableContainer.appendChild(card);
            });
        });
        
        console.log('Rankings resetados! Todos os jogadores voltaram para o container de seleção.');
        saveState();
    }

    playerSearchInput.addEventListener('input', (event) => {
        updatePlayerList(event.target.value);
    });

    window.setupCards = setupCards;
    window.toggleMenu = toggleMenu;
    window.closeMenu = closeMenu;

    loadPlayersFromAPI();
});