
// Service to handle speech recognition and synthesis
import { toast } from "sonner";

export class SpeechService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesisUtterance;
  private isListening: boolean = false;
  private onResultCallback: (text: string) => void = () => {};
  private onListeningChangeCallback: (isListening: boolean) => void = () => {};
  private onErrorCallback: (error: string | Error) => void = () => {};
  private speechEndCallbacks: Array<() => void> = [];
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoiceIndex: number = 0;

  constructor() {
    // Initialize speech synthesis
    this.synthesis = new SpeechSynthesisUtterance();
    this.synthesis.rate = 1.0;
    this.synthesis.pitch = 1.0;
    this.synthesis.volume = 1.0;
    this.synthesis.lang = 'en-US';
    
    // Load voices when available
    if (window.speechSynthesis) {
      // Some browsers need a slight delay to load voices
      setTimeout(() => {
        this.loadVoices();
      }, 100);
      
      // Add event listener for voice changed
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = this.loadVoices.bind(this);
      }
    }
    
    // Set up the onend event handler for the utterance
    this.synthesis.onend = () => {
      this.speechEndCallbacks.forEach(callback => callback());
    };
    
    // Try to initialize speech recognition if supported
    try {
      // Use the proper type for SpeechRecognition
      const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognitionImpl) {
        this.recognition = new SpeechRecognitionImpl();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        this.recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          // Only send final results to the callback
          if (event.results[0].isFinal) {
            this.onResultCallback(transcript);
          }
        };
        
        this.recognition.onend = () => {
          this.isListening = false;
          this.onListeningChangeCallback(false);
        };
        
        this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          this.isListening = false;
          this.onListeningChangeCallback(false);
          this.onErrorCallback(event.error);
          
          console.error("Speech recognition error:", event);
          
          // Show toast for user-facing errors
          if (event.error === 'not-allowed') {
            toast.error("Microphone access denied. Please check your browser settings.");
          } else if (event.error === 'network') {
            toast.error("Network error occurred during speech recognition.");
          } else if (event.error === 'no-speech') {
            toast.error("No speech detected. Please try again.");
          }
        };
      }
    } catch (error) {
      console.error('Speech recognition not supported:', error);
    }
  }

  private loadVoices(): void {
    if (window.speechSynthesis) {
      this.voices = window.speechSynthesis.getVoices();
      
      // Try to select a good default voice
      if (this.voices.length > 0) {
        // Prefer Google US English voice if available
        const googleVoice = this.voices.findIndex(
          voice => voice.name.includes('Google') && voice.lang.includes('en-US')
        );
        
        if (googleVoice !== -1) {
          this.selectedVoiceIndex = googleVoice;
        } else {
          // Otherwise just use the first English voice
          const englishVoice = this.voices.findIndex(voice => voice.lang.includes('en'));
          if (englishVoice !== -1) {
            this.selectedVoiceIndex = englishVoice;
          }
        }
        
        // Set the selected voice
        this.synthesis.voice = this.voices[this.selectedVoiceIndex];
      }
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  public setVoice(index: number): void {
    if (index >= 0 && index < this.voices.length) {
      this.selectedVoiceIndex = index;
      this.synthesis.voice = this.voices[index];
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null && window.speechSynthesis !== undefined;
  }

  public setVoiceCallbacks(
    onResult: (text: string) => void,
    onListeningChange: (isListening: boolean) => void,
    onError: (error: string | Error) => void
  ) {
    this.onResultCallback = onResult;
    this.onListeningChangeCallback = onListeningChange;
    this.onErrorCallback = onError;
  }

  public startListening(): boolean {
    if (!this.recognition) {
      this.onErrorCallback('Speech recognition not supported in this browser.');
      return false;
    }
    
    try {
      // Stop any ongoing speech first
      this.stopSpeaking();
      
      this.recognition.start();
      this.isListening = true;
      this.onListeningChangeCallback(true);
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      this.onErrorCallback('Failed to start speech recognition.');
      return false;
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
        this.onListeningChangeCallback(false);
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }

  public speak(text: string): void {
    if ('speechSynthesis' in window) {
      // Stop any current speech
      this.stopSpeaking();
      
      // Check if text is too long and split if needed
      if (text.length > 500) {
        // Split long text into sentences or chunks
        const sentences = this.splitIntoSentences(text);
        this.speakSentences(sentences);
      } else {
        this.synthesis.text = text;
        window.speechSynthesis.speak(this.synthesis);
      }
    } else {
      console.error('Speech synthesis not supported');
    }
  }
  
  private splitIntoSentences(text: string): string[] {
    // Split text by sentence boundaries (. ! ?)
    const rawSentences = text.split(/(?<=[.!?])\s+/);
    
    // Further process very long sentences
    const sentences: string[] = [];
    
    for (const rawSentence of rawSentences) {
      if (rawSentence.length > 200) {
        // Split long sentences by commas, semicolons, or conjunctions
        const chunks = rawSentence.split(/(?<=[,;])\s+|(?<=\sand\s|\sor\s|\sbut\s)/);
        sentences.push(...chunks);
      } else if (rawSentence.trim()) {
        sentences.push(rawSentence);
      }
    }
    
    return sentences;
  }
  
  private speakSentences(sentences: string[]): void {
    if (sentences.length === 0) return;
    
    let currentIndex = 0;
    
    // Speak the first sentence
    this.synthesis.text = sentences[currentIndex];
    
    // Handle end of utterance
    const originalEndHandler = this.synthesis.onend;
    
    this.synthesis.onend = () => {
      currentIndex++;
      
      if (currentIndex < sentences.length) {
        // Speak the next sentence
        this.synthesis.text = sentences[currentIndex];
        window.speechSynthesis.speak(this.synthesis);
      } else {
        // Restore original end handler and call all callbacks
        this.synthesis.onend = originalEndHandler;
        if (originalEndHandler) {
          originalEndHandler.call(this.synthesis);
        }
      }
    };
    
    window.speechSynthesis.speak(this.synthesis);
  }
  
  public stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
  
  public onSpeechEnd(callback: () => void): void {
    this.speechEndCallbacks.push(callback);
  }
  
  public offSpeechEnd(callback: () => void): void {
    this.speechEndCallbacks = this.speechEndCallbacks.filter(cb => cb !== callback);
  }
}

export default new SpeechService();
