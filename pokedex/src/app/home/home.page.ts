import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

interface PokemonResponse {
  id: number;
  name: string;
  height: number;
  weight: number;
  types: { type: { name: string } }[];
  abilities: { ability: { name: string }; is_hidden: boolean }[];
  stats: { base_stat: number; stat: { name: string } }[];
  sprites: {
    front_default: string | null;
    other?: {
      'official-artwork'?: {
        front_default: string | null;
      };
    };
  };
  species: { url: string };
}

interface PokemonSpeciesResponse {
  names: { name: string; language: { name: string } }[];
  flavor_text_entries: {
    flavor_text: string;
    language: { name: string };
  }[];
}

interface GeminiResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
  }[];
  error?: { message?: string };
}

interface PokemonGuess {
  isPokemon: boolean;
  name: string;
  confidence: number;
}

interface PokemonDetails {
  id: number;
  name: string;
  englishName: string;
  image: string;
  description: string;
  height: number;
  weight: number;
  types: string[];
  abilities: string[];
  stats: { name: string; value: number }[];
}

const POKE_API = 'https://pokeapi.co/api/v2';
const GEMINI_MODEL = 'gemini-2.5-flash';
const REQUEST_TIMEOUT_MS = 20_000;
const POKEMON_TYPES: Record<string, string> = {
  normal: 'Normal',
  fire: 'Fuego',
  water: 'Agua',
  electric: 'Eléctrico',
  grass: 'Planta',
  ice: 'Hielo',
  fighting: 'Lucha',
  poison: 'Veneno',
  ground: 'Tierra',
  flying: 'Volador',
  psychic: 'Psíquico',
  bug: 'Bicho',
  rock: 'Roca',
  ghost: 'Fantasma',
  dragon: 'Dragón',
  dark: 'Siniestro',
  steel: 'Acero',
  fairy: 'Hada',
};
const STAT_NAMES: Record<string, string> = {
  hp: 'PS',
  attack: 'Ataque',
  defense: 'Defensa',
  'special-attack': 'At. especial',
  'special-defense': 'Def. especial',
  speed: 'Velocidad',
};

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [FormsModule],
})
export class HomePage implements OnDestroy {
  @ViewChild('cameraPreview') cameraPreview?: ElementRef<HTMLVideoElement>;
  @ViewChild('filePicker') filePicker?: ElementRef<HTMLInputElement>;

  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly Math = Math;
  apiKey = '';
  keySaved = false;
  cameraActive = false;
  isLoading = false;
  isIdentifyingPhoto = false;
  isPhotoResult = false;
  searchQuery = '';
  photoPreview = '';
  pokemon: PokemonDetails | null = null;
  confidence: number | null = null;
  errorMessage = '';
  infoMessage = '';

  private cameraStream: MediaStream | null = null;
  private photoData = '';

  constructor() {
    try {
      this.apiKey = sessionStorage.getItem('gemini-api-key') ?? '';
      this.keySaved = this.apiKey.length > 0;
    } catch {
      this.errorMessage =
        'El navegador no permite guardar la clave de sesión. Puedes volver a introducirla antes de cada búsqueda.';
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  saveApiKey(): void {
    const key = this.apiKey.trim();
    if (!key) {
      this.errorMessage = 'Escribe tu clave de Google AI Studio para continuar.';
      this.keySaved = false;
      return;
    }

    try {
      sessionStorage.setItem('gemini-api-key', key);
      this.apiKey = key;
      this.keySaved = true;
      this.errorMessage = '';
      this.infoMessage = 'Clave guardada solo en esta pestaña del navegador.';
    } catch {
      this.keySaved = false;
      this.errorMessage =
        'El navegador no permite guardar la clave en esta sesión. Revisa su configuración de privacidad.';
    }
  }

  clearApiKey(): void {
    try {
      sessionStorage.removeItem('gemini-api-key');
    } catch {
      this.errorMessage =
        'No se pudo borrar la clave de la sesión. Cierra esta pestaña para eliminarla.';
      return;
    }

    this.apiKey = '';
    this.keySaved = false;
    this.infoMessage = 'Se eliminó la clave de esta sesión.';
    this.errorMessage = '';
  }

  async startCamera(): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorMessage =
        'Este navegador no permite acceder a la cámara. Abre la app en un navegador compatible y usa una conexión segura (HTTPS).';
      return;
    }

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      this.cameraActive = true;
      this.changeDetector.markForCheck();
      const video = this.cameraPreview?.nativeElement;
      if (video) {
        video.srcObject = this.cameraStream;
        await video.play();
      }
    } catch (error) {
      this.stopCamera();
      this.errorMessage =
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'No se concedió permiso para usar la cámara. Habilítalo en los ajustes del navegador.'
          : 'No se pudo iniciar la cámara. Comprueba los permisos o elige una foto desde tu dispositivo.';
      this.changeDetector.markForCheck();
    }
  }

  stopCamera(): void {
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
    this.cameraActive = false;
  }

  async capturePhoto(): Promise<void> {
    const video = this.cameraPreview?.nativeElement;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      this.errorMessage = 'La cámara todavía no está lista. Inténtalo de nuevo.';
      return;
    }

    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1200 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      this.errorMessage = 'No se pudo procesar la imagen de la cámara.';
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.photoData = canvas.toDataURL('image/jpeg', 0.86);
    this.photoPreview = this.photoData;
    this.pokemon = null;
    this.confidence = null;
    this.isPhotoResult = false;
    this.errorMessage = '';
    this.infoMessage = 'Foto lista. Ahora puedes identificar el Pokémon.';
    this.stopCamera();
  }

  openFilePicker(): void {
    this.filePicker?.nativeElement.click();
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Elige un archivo de imagen válido.';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      this.errorMessage = 'La foto debe pesar menos de 15 MB.';
      return;
    }

    try {
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        image.close();
        throw new Error('No se pudo procesar la imagen seleccionada.');
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      this.photoData = canvas.toDataURL('image/jpeg', 0.86);
      this.photoPreview = this.photoData;
      this.pokemon = null;
      this.confidence = null;
      this.isPhotoResult = false;
      this.errorMessage = '';
      this.infoMessage = 'Foto cargada. Lista para analizar.';
      this.stopCamera();
      this.changeDetector.markForCheck();
    } catch (error) {
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'No se pudo abrir esta imagen. Prueba con otra foto.';
      this.changeDetector.markForCheck();
    }
  }

  async identifyPokemon(): Promise<void> {
    if (!this.photoData) {
      this.errorMessage = 'Primero toma una foto o elige una imagen.';
      return;
    }
    if (!this.apiKey.trim()) {
      this.errorMessage =
        'Añade tu clave de Google AI Studio para activar el reconocimiento con IA.';
      return;
    }

    this.isLoading = true;
    this.isIdentifyingPhoto = true;
    this.errorMessage = '';
    this.infoMessage = 'Analizando la imagen…';
    this.pokemon = null;
    this.confidence = null;
    this.isPhotoResult = false;

    try {
      const guess = await this.classifyPhoto();
      if (!guess.isPokemon || !guess.name.trim()) {
        this.infoMessage = '';
        this.errorMessage =
          'No se identificó un Pokémon en la foto. Prueba con una imagen más nítida y con el Pokémon centrado.';
        return;
      }
      if (!Number.isFinite(guess.confidence) || guess.confidence < 0.4) {
        this.infoMessage = '';
        this.errorMessage =
          'La identificación no es lo bastante segura. Prueba con una foto más clara.';
        return;
      }

      const details = await this.getPokemonDetails(guess.name);
      this.pokemon = details;
      this.confidence = Math.round(Math.min(1, Math.max(0, guess.confidence)) * 100);
      this.isPhotoResult = true;
      this.infoMessage = '¡Pokémon identificado!';
    } catch (error) {
      this.infoMessage = '';
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'Ocurrió un error al identificar el Pokémon. Inténtalo de nuevo.';
    } finally {
      this.isLoading = false;
      this.isIdentifyingPhoto = false;
      this.changeDetector.markForCheck();
    }
  }

  async searchPokemon(): Promise<void> {
    const query = this.searchQuery.trim();
    if (!query) {
      this.errorMessage = 'Escribe el nombre o número de un Pokémon.';
      return;
    }

    this.isLoading = true;
    this.isIdentifyingPhoto = false;
    this.errorMessage = '';
    this.infoMessage = 'Buscando en la Pokédex…';
    this.pokemon = null;
    this.confidence = null;
    this.isPhotoResult = false;

    try {
      this.pokemon = await this.getPokemonDetails(query);
      this.infoMessage = 'Pokémon encontrado en la Pokédex.';
    } catch (error) {
      this.infoMessage = '';
      this.errorMessage =
        error instanceof Error
          ? error.message
          : 'No se pudo consultar la Pokédex. Inténtalo de nuevo.';
    } finally {
      this.isLoading = false;
      this.changeDetector.markForCheck();
    }
  }

  clearPhoto(): void {
    this.photoData = '';
    this.photoPreview = '';
    this.pokemon = null;
    this.confidence = null;
    this.isPhotoResult = false;
    this.errorMessage = '';
    this.infoMessage = '';
  }

  formatPokemonId(id: number): string {
    return `N.º ${String(id).padStart(4, '0')}`;
  }

  private async classifyPhoto(): Promise<PokemonGuess> {
    const [mimeType, encodedImage] = this.photoData.split(',');
    if (!mimeType || !encodedImage) {
      throw new Error('La imagen no tiene un formato válido.');
    }

    const imageType = mimeType.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64$/)?.[1];
    if (!imageType) {
      throw new Error('La imagen debe estar en un formato compatible.');
    }

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey.trim(),
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Identifica al Pokémon que aparece en esta imagen. Si no aparece un Pokémon claramente identificable, devuelve isPokemon=false. Devuelve únicamente JSON con esta forma exacta: {"isPokemon":boolean,"name":"nombre oficial en inglés en minúsculas","confidence":number}. El nombre debe ser el nombre inglés usado por la PokéAPI, sin explicaciones. confidence debe ser un número entre 0 y 1.',
                  },
                  { inline_data: { mime_type: imageType, data: encodedImage } },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  isPokemon: { type: 'BOOLEAN' },
                  name: { type: 'STRING' },
                  confidence: { type: 'NUMBER' },
                },
                required: ['isPokemon', 'name', 'confidence'],
              },
            },
          }),
        },
      );
    } catch {
      throw new Error(
        'No se pudo conectar con Google Gemini. Comprueba tu conexión a internet e inténtalo de nuevo.',
      );
    }

    const result = (await response.json()) as GeminiResponse;
    if (!response.ok) {
      throw new Error(
        result.error?.message ??
          `Google Gemini rechazó la solicitud (error ${response.status}). Comprueba tu clave y sus permisos.`,
      );
    }

    const responseText = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();
    if (!responseText) {
      throw new Error('Google Gemini no devolvió una identificación. Inténtalo de nuevo.');
    }

    let guess: unknown;
    try {
      guess = JSON.parse(responseText) as unknown;
    } catch {
      throw new Error('No se pudo interpretar el resultado de Google Gemini.');
    }

    if (
      typeof guess !== 'object' ||
      guess === null ||
      !('isPokemon' in guess) ||
      typeof guess.isPokemon !== 'boolean' ||
      !('name' in guess) ||
      typeof guess.name !== 'string' ||
      !('confidence' in guess) ||
      typeof guess.confidence !== 'number'
    ) {
      throw new Error('Google Gemini devolvió un resultado de identificación inválido.');
    }

    return {
      isPokemon: guess.isPokemon,
      name: guess.name.toLowerCase().trim().replaceAll(' ', '-'),
      confidence: guess.confidence,
    };
  }

  private async getPokemonDetails(query: string): Promise<PokemonDetails> {
    const normalizedQuery = query
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replaceAll(' ', '-');
    const safeQuery = encodeURIComponent(normalizedQuery);

    let response: Response;
    try {
      response = await fetch(`${POKE_API}/pokemon/${safeQuery}`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new Error(
        'PokéAPI no respondió a tiempo. Revisa tu conexión a internet e inténtalo de nuevo.',
      );
    }
    if (response.status === 404) {
      throw new Error(
        `No se encontró «${query}» en la Pokédex. Prueba con su nombre en inglés o su número.`,
      );
    }
    if (!response.ok) {
      throw new Error(`PokéAPI respondió con un error (${response.status}). Inténtalo de nuevo.`);
    }

    const pokemon = (await response.json()) as PokemonResponse;
    let speciesResponse: Response;
    try {
      speciesResponse = await fetch(pokemon.species.url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new Error(
        'Se encontró el Pokémon, pero no se pudieron cargar sus datos en español desde PokéAPI.',
      );
    }
    if (!speciesResponse.ok) {
      throw new Error(
        `Se encontró el Pokémon, pero PokéAPI no pudo cargar su ficha (${speciesResponse.status}).`,
      );
    }

    const species = (await speciesResponse.json()) as PokemonSpeciesResponse;
    const spanishName = species.names.find(
      (entry) => entry.language.name === 'es',
    )?.name;
    const spanishDescription = species.flavor_text_entries.find(
      (entry) => entry.language.name === 'es',
    )?.flavor_text;
    const image =
      pokemon.sprites.other?.['official-artwork']?.front_default ??
      pokemon.sprites.front_default ??
      '';

    return {
      id: pokemon.id,
      name: spanishName ?? pokemon.name,
      englishName: pokemon.name,
      image,
      description:
        spanishDescription?.replace(/[\n\f\r]+/g, ' ') ??
        'No hay una descripción disponible en español.',
      height: pokemon.height / 10,
      weight: pokemon.weight / 10,
      types: pokemon.types.map(({ type }) => POKEMON_TYPES[type.name] ?? type.name),
      abilities: pokemon.abilities
        .filter(({ is_hidden }) => !is_hidden)
        .map(({ ability }) => ability.name.replaceAll('-', ' ')),
      stats: pokemon.stats
        .filter(({ stat }) => stat.name in STAT_NAMES)
        .map(({ base_stat, stat }) => ({
          name: STAT_NAMES[stat.name],
          value: base_stat,
        })),
    };
  }
}
