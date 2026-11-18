/*
 * Word lists for the Taboo writing practice: personality traits (each one
 * becomes a taboo word) and everyday situations, per language.
 * Same order in every language, so a drawn item can follow a language switch.
 */

export const TRAITS = {
  en: ['shy', 'nervous', 'generous', 'stubborn', 'curious', 'arrogant', 'lonely', 'cheerful', 'jealous', 'patient', 'impatient', 'honest', 'secretive', 'proud', 'anxious', 'brave', 'lazy', 'ambitious', 'kind', 'rude', 'clumsy', 'polite', 'greedy', 'nostalgic', 'suspicious', 'optimistic', 'grumpy', 'careful', 'restless', 'romantic'],
  de: ['schüchtern', 'nervös', 'großzügig', 'stur', 'neugierig', 'arrogant', 'einsam', 'fröhlich', 'eifersüchtig', 'geduldig', 'ungeduldig', 'ehrlich', 'verschlossen', 'stolz', 'ängstlich', 'mutig', 'faul', 'ehrgeizig', 'freundlich', 'unhöflich', 'ungeschickt', 'höflich', 'gierig', 'nostalgisch', 'misstrauisch', 'optimistisch', 'mürrisch', 'vorsichtig', 'rastlos', 'romantisch'],
  es: ['tímido', 'nervioso', 'generoso', 'terco', 'curioso', 'arrogante', 'solitario', 'alegre', 'celoso', 'paciente', 'impaciente', 'honesto', 'reservado', 'orgulloso', 'ansioso', 'valiente', 'perezoso', 'ambicioso', 'amable', 'grosero', 'torpe', 'educado', 'codicioso', 'nostálgico', 'desconfiado', 'optimista', 'gruñón', 'prudente', 'inquieto', 'romántico'],
  fr: ['timide', 'nerveux', 'généreux', 'têtu', 'curieux', 'arrogant', 'solitaire', 'joyeux', 'jaloux', 'patient', 'impatient', 'honnête', 'secret', 'fier', 'anxieux', 'courageux', 'paresseux', 'ambitieux', 'gentil', 'grossier', 'maladroit', 'poli', 'avide', 'nostalgique', 'méfiant', 'optimiste', 'grincheux', 'prudent', 'agité', 'romantique'],
  hu: ['félénk', 'ideges', 'nagylelkű', 'makacs', 'kíváncsi', 'arrogáns', 'magányos', 'vidám', 'féltékeny', 'türelmes', 'türelmetlen', 'őszinte', 'titkolózó', 'büszke', 'szorongó', 'bátor', 'lusta', 'becsvágyó', 'kedves', 'goromba', 'ügyetlen', 'udvarias', 'kapzsi', 'nosztalgikus', 'gyanakvó', 'optimista', 'morcos', 'óvatos', 'nyughatatlan', 'romantikus'],
  pl: ['nieśmiały', 'nerwowy', 'hojny', 'uparty', 'ciekawski', 'arogancki', 'samotny', 'pogodny', 'zazdrosny', 'cierpliwy', 'niecierpliwy', 'szczery', 'skryty', 'dumny', 'lękliwy', 'odważny', 'leniwy', 'ambitny', 'życzliwy', 'niegrzeczny', 'niezdarny', 'uprzejmy', 'chciwy', 'nostalgiczny', 'podejrzliwy', 'optymistyczny', 'zrzędliwy', 'ostrożny', 'niespokojny', 'romantyczny'],
}

export const SITUATIONS = {
  en: [
    'Walking through a forest at dusk',
    'Walking down a busy street',
    'On a crowded bus',
    'On a long train journey',
    'Sitting alone in a café',
    'At a bar, waiting for someone who is late',
    'In a doctor’s waiting room',
    'Queueing at the post office',
    'At a family dinner',
    'Stuck in a lift with a stranger',
    'At a job interview',
    'Buying vegetables at a market',
    'On a park bench, feeding pigeons',
    'At an airport gate, the flight delayed',
    'In a launderette, waiting for the wash',
    'At a wedding where they know nobody',
  ],
  de: [
    'Bei Einbruch der Dämmerung in einem Wald unterwegs',
    'Auf einer belebten Straße unterwegs',
    'In einem vollen Bus',
    'Auf einer langen Zugfahrt',
    'Allein in einem Café',
    'In einer Bar, wartend auf jemanden, der zu spät kommt',
    'Im Wartezimmer einer Arztpraxis',
    'In der Schlange auf der Post',
    'Bei einem Familienessen',
    'Mit einer fremden Person im Aufzug stecken geblieben',
    'Bei einem Vorstellungsgespräch',
    'Beim Gemüsekauf auf dem Markt',
    'Auf einer Parkbank, beim Taubenfüttern',
    'Am Flughafengate, der Flug hat Verspätung',
    'Im Waschsalon, wartend auf die Wäsche',
    'Auf einer Hochzeit, auf der die Figur niemanden kennt',
  ],
  es: [
    'Caminando por un bosque al anochecer',
    'Caminando por una calle concurrida',
    'En un autobús lleno',
    'En un largo viaje en tren',
    'A solas en una cafetería',
    'En un bar, esperando a alguien que llega tarde',
    'En la sala de espera del médico',
    'Haciendo cola en correos',
    'En una cena familiar',
    'Atrapado en un ascensor con un desconocido',
    'En una entrevista de trabajo',
    'Comprando verdura en el mercado',
    'En un banco del parque, dando de comer a las palomas',
    'En la puerta de embarque, con el vuelo retrasado',
    'En una lavandería, esperando la colada',
    'En una boda donde no conoce a nadie',
  ],
  fr: [
    'En marchant dans une forêt à la tombée du jour',
    'En marchant dans une rue animée',
    'Dans un bus bondé',
    'Pendant un long voyage en train',
    'Seul dans un café',
    'Dans un bar, à attendre quelqu’un qui est en retard',
    'Dans la salle d’attente d’un médecin',
    'Dans la file d’attente à la poste',
    'À un dîner de famille',
    'Coincé dans un ascenseur avec un inconnu',
    'À un entretien d’embauche',
    'En achetant des légumes au marché',
    'Sur un banc public, en nourrissant les pigeons',
    'À la porte d’embarquement, le vol retardé',
    'Dans une laverie, en attendant la lessive',
    'À un mariage où il ne connaît personne',
  ],
  hu: [
    'Séta egy erdőben szürkületkor',
    'Séta egy forgalmas utcán',
    'Egy zsúfolt buszon',
    'Egy hosszú vonatúton',
    'Egyedül egy kávézóban',
    'Egy bárban, várva valakire, aki késik',
    'Egy orvosi váróteremben',
    'Sorban állva a postán',
    'Egy családi vacsorán',
    'Egy idegennel a liftben ragadva',
    'Egy állásinterjún',
    'Zöldségvásárlás a piacon',
    'Egy parkpadon, galambokat etetve',
    'A reptéri kapunál, a járat késik',
    'Egy önkiszolgáló mosodában, a mosásra várva',
    'Egy esküvőn, ahol senkit sem ismer',
  ],
  pl: [
    'Spacer po lesie o zmierzchu',
    'Spacer zatłoczoną ulicą',
    'W zatłoczonym autobusie',
    'W długiej podróży pociągiem',
    'Samotnie w kawiarni',
    'W barze, czekając na kogoś, kto się spóźnia',
    'W poczekalni u lekarza',
    'W kolejce na poczcie',
    'Na rodzinnym obiedzie',
    'Uwięziony w windzie z nieznajomym',
    'Na rozmowie o pracę',
    'Na targu, kupując warzywa',
    'Na ławce w parku, karmiąc gołębie',
    'Przy bramce na lotnisku, lot opóźniony',
    'W pralni samoobsługowej, czekając na pranie',
    'Na weselu, na którym nikogo nie zna',
  ],
}

export const MAX_TRAITS = 5

const listFor = (lists, locale) => lists[locale] || lists.en

/** Up to `n` random traits not already in `taken` (case-insensitive). */
export function drawTraits(locale, n, taken = []) {
  const used = new Set(taken.map((x) => x.toLowerCase()))
  const pool = listFor(TRAITS, locale).filter((x) => !used.has(x.toLowerCase()))
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

/** A random situation, different from `current` when possible. */
export function drawSituation(locale, current = '') {
  const pool = listFor(SITUATIONS, locale).filter((x) => x !== current)
  return pool[Math.floor(Math.random() * pool.length)]
}

/* ---------- taboo word matching ---------- */

const WORD_RE = /[\p{L}\p{M}][\p{L}\p{M}'’-]*/gu
const norm = (s) => s.normalize('NFC').toLocaleLowerCase()

/**
 * Turn traits and extra words into match stems. Words of 5+ letters drop their
 * last letter, so word forms match too (tímido → tímid → tímida, nervous →
 * nervousness); 3–4 letter words match as a prefix; shorter words are ignored.
 */
export function tabooStems(words) {
  const stems = new Map() // stem → the word the user sees
  for (const w of words) {
    for (const part of norm(w).match(WORD_RE) || []) {
      if (part.length < 3) continue
      const stem = part.length >= 5 ? part.slice(0, -1) : part
      if (!stems.has(stem)) stems.set(stem, w.trim())
    }
  }
  return stems
}

/** Taboo words used in `text`: [{ word (as listed), hits: ['Nervously', …] }]. */
export function findTaboo(text, stems) {
  const found = new Map()
  for (const token of text.match(WORD_RE) || []) {
    const lower = norm(token)
    // the whole token and its parts: l'arrogant → arrogant, not-shy → shy
    const parts = [lower, ...lower.split(/['’-]/).filter((x) => x && x !== lower)]
    for (const [stem, word] of stems) {
      if (parts.some((x) => x.startsWith(stem))) {
        if (!found.has(word)) found.set(word, [])
        found.get(word).push(token)
        break
      }
    }
  }
  return [...found].map(([word, hits]) => ({ word, hits }))
}
