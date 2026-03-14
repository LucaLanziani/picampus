let tickets = [];
let ticketIdCounter = 1;

const ticketInput = document.getElementById('ticketInput');
const submitBtn = document.getElementById('submitBtn');
const voiceBtn = document.getElementById('voiceBtn');
const ticketsList = document.getElementById('ticketsList');

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

voiceBtn.addEventListener('click', async () => {
    if (isRecording) {
        stopRecording();
    } else {
        await startRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Use audio/webm;codecs=opus for better compatibility
        const options = { mimeType: 'audio/webm;codecs=opus' };
        mediaRecorder = new MediaRecorder(stream, options);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await transcribeAudio(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        isRecording = true;
        voiceBtn.classList.add('recording');
        voiceBtn.textContent = '⏹️ Stop';
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Could not access microphone. Please grant permission.');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        isRecording = false;
        voiceBtn.classList.remove('recording');
        voiceBtn.textContent = '🎤 Voice';
        voiceBtn.disabled = true;
        voiceBtn.textContent = '⏳ Transcribing...';
    }
}

async function transcribeAudio(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        
        if (data.text) {
            ticketInput.value += (ticketInput.value ? ' ' : '') + data.text;
        }
    } catch (error) {
        console.error('Transcription error:', error);
        alert('Transcription failed. Please try again.');
    } finally {
        voiceBtn.disabled = false;
        voiceBtn.textContent = '🎤 Voice';
    }
}

submitBtn.addEventListener('click', async () => {
    const description = ticketInput.value.trim();
    if (!description) return;

    const ticket = {
        id: ticketIdCounter++,
        description,
        classification: 'classifying',
        timestamp: new Date().toISOString()
    };

    tickets.unshift(ticket);
    ticketInput.value = '';
    renderTickets();

    const classification = await classifyTicket(description);
    ticket.classification = classification;
    renderTickets();
});

async function classifyTicket(description) {
    try {
        const response = await fetch('/api/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ description })
        });
        
        const data = await response.json();
        return data.classification || 'other';
    } catch (error) {
        console.error('Classification error:', error);
        return 'other';
    }
}

function renderTickets() {
    if (tickets.length === 0) {
        ticketsList.innerHTML = '<p style="color: #999;">No tickets yet</p>';
        return;
    }

    ticketsList.innerHTML = tickets.map(ticket => `
        <div class="ticket">
            <div class="ticket-header">
                <span class="ticket-id">Ticket #${ticket.id}</span>
                <span class="ticket-classification classification-${ticket.classification}">
                    ${ticket.classification.toUpperCase()}
                </span>
            </div>
            <div class="ticket-description">${escapeHtml(ticket.translatedText || ticket.description)}</div>
            <div class="ticket-actions">
                <select class="language-select" data-ticket-id="${ticket.id}">
                    <option value="">Translate to...</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Italian">Italian</option>
                    <option value="Portuguese">Portuguese</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Chinese">Chinese</option>
                    <option value="Korean">Korean</option>
                    <option value="Russian">Russian</option>
                    <option value="Arabic">Arabic</option>
                </select>
                ${ticket.translatedText ? `<button class="reset-btn" data-ticket-id="${ticket.id}">Show Original</button>` : ''}
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.language-select').forEach(select => {
        select.addEventListener('change', handleTranslate);
    });

    document.querySelectorAll('.reset-btn').forEach(btn => {
        btn.addEventListener('click', handleReset);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

renderTickets();


async function handleTranslate(event) {
    const ticketId = parseInt(event.target.dataset.ticketId);
    const language = event.target.value;
    
    if (!language) return;

    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return;

    event.target.disabled = true;
    
    try {
        const response = await fetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: ticket.description,
                language 
            })
        });
        
        const data = await response.json();
        ticket.translatedText = data.translation;
        ticket.translatedLanguage = language;
        renderTickets();
    } catch (error) {
        console.error('Translation error:', error);
        event.target.disabled = false;
    }
}

function handleReset(event) {
    const ticketId = parseInt(event.target.dataset.ticketId);
    const ticket = tickets.find(t => t.id === ticketId);
    
    if (ticket) {
        delete ticket.translatedText;
        delete ticket.translatedLanguage;
        renderTickets();
    }
}
