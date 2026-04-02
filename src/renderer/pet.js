const PET_STATES = {
  IDLE: 'idle',
  THINKING: 'thinking',
  EXCITED: 'excited',
  HAPPY: 'happy',
  SAD: 'sad',
  SLEEPING: 'sleeping'
};

class Pet {
  constructor() {
    this.state = PET_STATES.IDLE;
    this.petEl = document.getElementById('pet');
    this.nameEl = document.getElementById('pet-name');
    this.pendingSuggestions = [];

    this._init();
  }

  async _init() {
    // Load pet state from main process
    const petData = await window.tamugatchi.getPetState();
    this.nameEl.textContent = petData.name || 'Tamu';
    this.pendingSuggestions = petData.pendingSuggestions || [];

    if (this.pendingSuggestions.length > 0) {
      this.setState(PET_STATES.EXCITED);
      showSuggestion(this.pendingSuggestions[0]);
    } else {
      this.setState(petData.state || PET_STATES.IDLE);
    }

    // Listen for state changes from main
    window.tamugatchi.onPetStateChange((state) => {
      this.setState(state);
    });

    window.tamugatchi.onNewSuggestion((suggestion) => {
      this.pendingSuggestions.push(suggestion);
      this.setState(PET_STATES.EXCITED);
      showSuggestion(suggestion);
    });

    window.tamugatchi.onSuggestionExecuted(({ id }) => {
      this.pendingSuggestions = this.pendingSuggestions.filter(s => s.id !== id);
      if (this.pendingSuggestions.length > 0) {
        showSuggestion(this.pendingSuggestions[0]);
      } else {
        hideBubble();
      }
    });

    window.tamugatchi.onSuggestionDismissed(({ id }) => {
      this.pendingSuggestions = this.pendingSuggestions.filter(s => s.id !== id);
      if (this.pendingSuggestions.length > 0) {
        showSuggestion(this.pendingSuggestions[0]);
      } else {
        hideBubble();
      }
    });

    // Click pet to cycle through pending suggestions or open settings
    this.petEl.addEventListener('click', () => {
      if (this.pendingSuggestions.length > 0) {
        showSuggestion(this.pendingSuggestions[0]);
      } else {
        window.tamugatchi.openSettings();
      }
    });
  }

  setState(state) {
    this.state = state;

    // Remove all state classes
    this.petEl.className = '';
    this.petEl.classList.add(`pet-${state}`);

    // Toggle SVG elements based on state
    this._toggleEyes(state);
    this._toggleMouth(state);
    this._toggleExtras(state);
  }

  _toggleEyes(state) {
    const normal = document.getElementById('eyes-normal');
    const sparkle = document.getElementById('eyes-sparkle');
    const closed = document.getElementById('eyes-closed');
    const swirl = document.getElementById('eyes-swirl');

    [normal, sparkle, closed, swirl].forEach(el => el.classList.add('hidden'));

    switch (state) {
      case PET_STATES.EXCITED:
        sparkle.classList.remove('hidden');
        break;
      case PET_STATES.SLEEPING:
        closed.classList.remove('hidden');
        break;
      case PET_STATES.THINKING:
        swirl.classList.remove('hidden');
        break;
      default:
        normal.classList.remove('hidden');
    }
  }

  _toggleMouth(state) {
    const smile = document.getElementById('mouth-smile');
    const open = document.getElementById('mouth-open');
    const sad = document.getElementById('mouth-sad');

    [smile, open, sad].forEach(el => el.classList.add('hidden'));

    switch (state) {
      case PET_STATES.EXCITED:
      case PET_STATES.HAPPY:
        open.classList.remove('hidden');
        break;
      case PET_STATES.SAD:
        sad.classList.remove('hidden');
        break;
      default:
        smile.classList.remove('hidden');
    }
  }

  _toggleExtras(state) {
    const zzz = document.getElementById('zzz');
    const hearts = document.getElementById('hearts');
    const dots = document.getElementById('thinking-dots');

    [zzz, hearts, dots].forEach(el => el.classList.add('hidden'));

    switch (state) {
      case PET_STATES.SLEEPING:
        zzz.classList.remove('hidden');
        break;
      case PET_STATES.HAPPY:
        hearts.classList.remove('hidden');
        break;
      case PET_STATES.THINKING:
        dots.classList.remove('hidden');
        break;
    }
  }
}

// Initialize pet when DOM ready
const pet = new Pet();
