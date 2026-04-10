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
    // Load pet state and config from main process
    const petData = await window.tamugatchi.getPetState();
    const config = await window.tamugatchi.getConfig();
    this.nameEl.textContent = petData.name || 'Tamu';
    this.pendingSuggestions = petData.pendingSuggestions || [];

    // Apply saved color
    if (config.petColor) this.setColor(config.petColor);

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

    // Listen for live config changes (e.g. color, name)
    window.tamugatchi.onConfigChange((key, value) => {
      if (key === 'petColor') this.setColor(value);
      if (key === 'petName') this.nameEl.textContent = value;
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

  setColor(hex) {
    // Derive lighter (inner body) and darker (ear inner, blush) variants
    const lighter = this._adjustColor(hex, 20);
    const darker = this._adjustColor(hex, -30);

    // Body
    document.querySelectorAll('.pet-body').forEach(el => el.setAttribute('fill', hex));
    document.querySelectorAll('.pet-body-inner').forEach(el => el.setAttribute('fill', lighter));

    // Ears
    document.querySelectorAll('.pet-ear-left, .pet-ear-right').forEach(el => el.setAttribute('fill', hex));

    // Ear inner (the smaller ellipses after ears — select by darker fill)
    const earInners = document.querySelectorAll('#pet-svg ellipse[fill="#FF9EC5"]');
    earInners.forEach(el => el.setAttribute('fill', darker));

    // Arms & feet
    document.querySelectorAll('.arm-left, .arm-right, .foot-left, .foot-right').forEach(el => el.setAttribute('fill', hex));

    // Blush
    document.querySelectorAll('.blush-left, .blush-right').forEach(el => el.setAttribute('fill', darker));
  }

  _adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
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
