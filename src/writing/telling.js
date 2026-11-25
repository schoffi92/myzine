/*
 * Words that tell instead of show, for the "What the camera sees" practice:
 * what a camera can't film (thoughts, feelings named outright) and camera
 * directions that belong to the director. Per language, whole words only,
 * case-insensitive; each entry is a regex fragment (inflected forms spelled
 * out or with a short ending group).
 *
 *   inner:   thinking, knowing, remembering, wanting, deciding…
 *   emotion: a feeling named instead of shown (sad, nervous, angry…)
 *   camera:  "we see", "close-up", "the camera pans"…
 */
export const TELLING = {
  en: {
    inner: [
      'think(s|ing)?', 'thought(s)?', 'feel(s|ing|ings)?', 'felt', 'remember(s|ing|ed)?', 'reali[sz](e|es|ed|ing)',
      'know(s|ing)?', 'knew', 'want(s|ed|ing)?', 'decid(e|es|ed|ing)', 'wonder(s|ed|ing)?', 'hop(e|es|ed|ing)',
      'wish(es|ed|ing)?', 'understand(s|ing)?', 'understood', 'believ(e|es|ed|ing)', 'imagin(e|es|ed|ing)', 'recogni[sz](e|es|ed|ing)',
    ],
    emotion: [
      'sad(ly|ness)?', 'angr(y|ily)', 'anger', 'nervous(ly)?', 'happ(y|ily|iness)', 'afraid', 'scared', 'frightened', 'fear(s|ful)?',
      'upset', 'worr(y|ied|ies)', 'ashamed', 'jealous', 'lonely', 'bored', 'excited', 'embarrassed', 'annoyed', 'frustrated',
      'furious', 'calm(ly)?', 'relieved', 'guilty', 'proud', 'heartbroken', 'desperate(ly)?', 'anxious(ly)?', 'confused',
      'surprised', 'disappointed', 'grateful', 'terrified', 'miserable', 'joy(ful)?', 'love(s|d)?', 'hate(s|d)?',
    ],
    camera: ['we see', 'we hear', '(the )?camera', 'close[- ]up(s)?', 'zoom(s|ed|ing)?( in| out)?', 'pan(s|ned)? (to|across|over)', 'slow motion'],
  },
  de: {
    inner: [
      'denk(t|en|st)', 'dachte(n|st)?', 'gedacht', 'Gedanke(n)?', 'nachdenklich(e|en|er|es|em)?', 'überleg(t|en|te|ten)',
      '(?<=(?:er|sie|es|man|niemand|keiner|jeder|wer) )weiß', 'weiß(?=,?\\s+(nicht|es|genau|sofort|jetzt|plötzlich|längst|schon|dass|ob|wo|wie|was|wer|wohin|warum|alles|nichts)(?![\\p{L}\\p{N}]))',
      'weißt', 'wissen', 'wusste(n|st)?', 'gewusst',
      'erinner(t|n|st|te|ten)', 'Erinnerung(en)?',
      'fällt( (ihm|ihr|ihnen))? ein(?=\\s*([,.;:!?]|$))', 'fiel(en)?( (ihm|ihr|ihnen))? ein(?=\\s*([,.;:!?]|$))', 'einfallen', 'eingefallen',
      'will', 'willst', 'wollen', 'wollte(n|st)?', 'möchte(n|st)?', 'wünsch(t|en|te|ten)', 'gewünscht', 'Wunsch',
      'beschließ(t|en)', 'beschloss(en)?', 'entscheid(et|en)', 'entschied(en)?', 'entschlossen(e|en|er|es|em)?',
      'merk(t|en|te|ten)', 'gemerkt', 'begreif(t|en)', 'begriff(en)?', 'versteh(t|en)', 'verstand(en)?',
      'erkenn(t|en)', 'erkannte(n)?', 'erkannt', 'wird (ihm|ihr|ihnen) (plötzlich |endlich |langsam )?(klar|bewusst)', '(ihm|ihr|ihnen) wird (plötzlich |endlich |langsam )?(klar|bewusst)', '(ihm|ihr|ihnen) (plötzlich |endlich |langsam )?(klar|bewusst) wird',
      'hoff(t|en|te|ten)', 'gehofft', 'Hoffnung(en)?', 'frag(t|en|te|ten) sich', 'wunder(t|n|te|ten) sich',
      'glaub(t|en|te|ten)', 'geglaubt', 'stell(t|en|te|ten) sich (\\p{L}+ ){0,3}vor(?=\\s*([,.;:!?]|$))', 'vorstellen',
      'fühl(t|en|te|ten)', 'gefühlt', 'Gefühl(e|en)?', 'spür(t|en|te|ten)', 'gespürt', 'ahn(t|en|te|ten)', 'geahnt',
      'vermut(et|en|ete|eten)', 'bereu(t|en|te|ten)', 'zweifel(t|n|te|ten)',
    ],
    emotion: [
      'traurig(e|en|er|es|em)?', 'Traurigkeit', 'Trauer', 'nervös(e|en|er|es|em)?', 'Nervosität', 'wütend(e|en|er|es|em)?', 'Wut',
      'zornig(e|en|er|es|em)?', 'Zorn', 'verärgert(e|en|er|es|em)?', 'ärgerlich(e|en|er|es|em)?', 'ärger(t|n) sich', 'glücklich(e|en|er|es|em)?',
      'unglücklich(e|en|er|es|em)?', 'froh(e|en|er|es|em)?', 'fröhlich(e|en|er|es|em)?', 'Freude', 'freu(t|en|te|ten) sich',
      'ängstlich(e|en|er|es|em)?', 'Angst', 'verängstigt(e|en|er|es|em)?', 'erschrocken(e|en|er|es|em)?', 'fürchte(t|n|te|ten) sich', 'Furcht',
      'besorgt(e|en|er|es|em)', 'beunruhigt(e|en|er|es|em)?', 'mach(t|en|te|ten) sich (\\p{L}+ )?Sorgen', 'sorg(t|en|te|ten) sich',
      'einsam(e|en|er|es|em)?', 'Einsamkeit', 'stolz(e|en|er|es|em)?', 'beschämt(e|en|er|es|em)?', 'schäm(t|en|te|ten) sich', 'Scham',
      'eifersüchtig(e|en|er|es|em)?', 'Eifersucht', 'neidisch(e|en|er|es|em)?', 'gelangweilt(e|en|er|es|em)?', 'Langeweile',
      'aufgeregt(e|en|er|es|em)?', 'Aufregung', 'verlegen(e|er|es|em)?', 'genervt(e|en|er|es|em)?', 'frustriert(e|en|er|es|em)?',
      'erleichtert(e|en|er|es|em)?', 'Erleichterung', 'schuldig(e|en|er|es|em)?', 'Schuldgefühl(e|en)?', 'verzweifelt(e|en|er|es|em)?', 'Verzweiflung',
      'verwirrt(e|en|er|es|em)?', 'überrascht(e|en|er|es|em)?', 'enttäuscht(e|en|er|es|em)?', 'Enttäuschung', 'dankbar(e|en|er|es|em)?',
      'entsetzt(e|en|er|es|em)?', 'panisch(e|en|er|es|em)?', 'Panik', 'deprimiert(e|en|er|es|em)?', 'gestresst(e|en|er|es|em)?',
      'beleidigt(e|en|er|es|em)?', 'gekränkt(e|en|er|es|em)?', 'schüchtern(e|en|er|es|em)?', 'zufrieden(e|en|er|es|em)?', 'Sehnsucht', 'sehn(t|en|te|ten) sich',
      'verliebt(e|en|er|es|em)?', 'lieb(t|en|te|ten)', 'geliebt', 'Liebe', 'hass(t|en|te|ten)', 'gehasst', 'Hass',
    ],
    camera: [
      'wir sehen', 'wir hören', 'sehen wir', 'hören wir', 'Kamera(s|fahrt|schwenk|einstellung)?', 'Großaufnahme(n)?', 'Nahaufnahme(n)?',
      'Detailaufnahme(n)?', 'Totale', 'Halbtotale', 'Close-?up(s)?', 'Zoom(s)?', 'zoom(t|en|te|ten)', 'heranzoomen', 'herangezoomt',
      'schwenk(t|en|te|ten) (zu|zum|zur|auf|über|nach|hinüber|herum|zurück)', 'Schwenk', 'Zeitlupe',
    ],
  },
  es: {
    inner: [
      'piens(a|an|as|o)', 'pens(aba|abas|aban|ó|aron|ando|ar)', 'pensamiento(s)?', 'sient(e|en|es)', 'sint(ió|ieron|iendo)', 'sent(ía|ían)',
      'recuerd(a|an|as)', 'record(aba|aban|ó|aron|ando|ar)', 'se acuerd(a|an)', 'se acord(ó|aron|aba|aban)',
      'sabe(n)?', 'sabía(n)?', 'supo', 'supieron', 'quier(e|en)', 'quer(ía|ían)', 'quis(o|ieron)',
      'decid(e|en|ió|ieron|ía|ían|iendo|ir)', 'se (da|dan|dio|dieron|daba|daban) cuenta', 'darse cuenta', 'dándose cuenta',
      'se percat(a|an|ó|aron)', 'dese(a|an|aba|aban|ó|aron)', 'se pregunt(a|an|aba|aban|ó|aron)', 'ojalá',
      'entiend(e|en)', 'entend(ió|ieron|ía|ían)', 'comprend(e|en|ió|ieron|ía|ían)', 'cre(e|en|ía|ían|yó|yeron)',
      'imagin(a|an|aba|aban|ó|aron)', 'reconoc(e|en|ió|ieron|ía|ían)', 'ech(a|an|aba|aban|ó) de menos', 'añor(a|an|aba|aban|ó)',
    ],
    emotion: [
      'trist(e|es|eza|emente)', 'nervios(o|a|os|as|amente|ismo)', 'enfadad(o|a|os|as)', 'enojad(o|a|os|as)', 'furios(o|a|os|as|amente)', 'rabia',
      'feliz', 'felices', 'felicidad', 'felizmente', 'content(o|a|os|as)', 'alegr(e|es|emente|ía)',
      'asustad(o|a|os|as)', 'miedo(s)?', 'aterrad(o|a|os|as)', 'aterrorizad(o|a|os|as)', 'temeros(o|a|os|as)',
      'preocupad(o|a|os|as)', 'preocupación', 'avergonzad(o|a|os|as)', 'vergüenza', 'celos(o|a|os|as)?', 'soledad',
      'aburrid(o|a|os|as)', 'emocionad(o|a|os|as)', 'ilusionad(o|a|os|as)', 'molest(o|a|os|as)', 'frustrad(o|a|os|as)', 'irritad(o|a|os|as)',
      'tranquil(o|a|os|as|amente)', 'aliviad(o|a|os|as)', 'alivio', 'culpable(s)?', 'desesperad(o|a|os|as|amente)', 'desesperación',
      'ansios(o|a|os|as|amente)', 'ansiedad', 'angustiad(o|a|os|as)', 'angustia', 'confundid(o|a|os|as)', 'confus(o|a|os|as)',
      'sorprendid(o|a|os|as)', 'decepcionad(o|a|os|as)', 'decepción', 'agradecid(o|a|os|as)', 'orgullos(o|a|os|as)', 'orgullo',
      'desdichad(o|a|os|as)', 'impaciente(s)?', 'enamorad(o|a|os|as)', 'amor', 'am(a|an)(?! de (casa|llaves))', 'odi(a|an|o)',
    ],
    camera: [
      'vemos', 'o[ií]mos', 'escuchamos', '(la )?c[aá]mara(?! (de fotos|de vídeo|de seguridad|fotográfica|digital))', 'primer(os)? plano(s)?', 'contraplano(s)?',
      'plano(s)? (general|generales|medio|medios|detalle|corto|cortos|largo|americano|picado|contrapicado|fijo|secuencia|cenital|subjetivo)',
      'zoom', 'travel(l)?ing', 'panorámica',
    ],
  },
  fr: {
    inner: [
      'pens(e|es|ent|ait|aient|é|ée|és|ées)', 'pensées?', 'réfléchi(t|ssent|ssait|ssaient)',
      'sait', 'savent', 'sav(ait|aient)', 'sent(ent|ait|aient)?', 'ressent(ent|ait|aient)?',
      '(se|s[’\']en) souvien(t|nent)', '(se|s[’\']en) souven(ait|aient)', '(se|s[’\']en) rappel(le|lent|ait|aient)', 'se remémor(e|ent|ait|aient)',
      'veu(t|lent)', 'voul(ait|aient)', 'voudrai(t|ent)', '(a|ont|avait|avaient) envie',
      'décid(e|ent|ait|aient|é|ée|és|ées)', '(se|s[’\']en) rend(ent|ait|aient)? compte',
      'comprend', 'comprennent', 'compren(ait|aient)', '(a|ont|avait|avaient) compris',
      'esp(è|e)r(e|ent)', 'espér(ait|aient)', 'se demand(e|ent|ait|aient)', 'se di(t|sent|sait|saient)',
      'souhait(e|ent|ait|aient)', 'cro(it|ient|yait|yaient)', 'imagin(e|ent|ait|aient)', 'devin(e|ent|ait|aient)',
      'reconna(î|i)t', 'reconnaiss(ent|ait|aient)',
    ],
    emotion: [
      'triste(s|ment|sse)?', 'en colère', 'colère', 'furieu(x|se|ses|sement)', 'fâché(e|s|es)?', 'énervé(e|s|es)?', 'agacé(e|s|es)?',
      'irrité(e|s|es)?', 'frustré(e|s|es)?', 'nerveu(x|se|ses|sement)', 'nervosité', 'heureu(x|se|ses|sement)', 'bonheur',
      'malheureu(x|se|ses|sement)', 'joyeu(x|se|ses|sement)', 'joie', 'content(e|es)?', 'peur', 'effrayé(e|s|es)?', 'apeuré(e|s|es)?',
      'terrifié(e|s|es)?', 'terrorisé(e|s|es)?', 'inqui(et|ets|ète|ètes)', 'inquiétude', 'anxieu(x|se|ses|sement)', 'angoissé(e|s|es)?', 'angoisse',
      'stressé(e|s|es)?', 'honteu(x|se|ses|sement)', 'honte', 'jalou(x|se|ses)', 'jalousie', 's[’\']ennu(ie|ient|yait|yaient)', 'ennuyé(e|s|es)?',
      'excité(e|s|es)?', 'impatient(e|s|es)?', 'impatiemment', 'impatience', 'gêné(e|s|es)?', 'embarrassé(e|s|es)?', 'mal à l[’\']aise',
      'calme(s|ment)?', 'soulagé(e|s|es)?', 'soulagement', 'coupable(s)?', 'culpabilité', 'fier|fiers|fière|fières|fièrement|fierté',
      'désespéré(e|s|es)?', 'désespérément', 'désespoir', 'confus(e|es)?', 'surpris(e|es)?', 'étonné(e|s|es)?', 'déçu(e|s|es)?', 'déception',
      'reconnaissant(e|s|es)?', 'ému(e|s|es)?', 'bouleversé(e|s|es)?', 'amoureu(x|se|ses)', 'amour', 'aim(e|ent|ait|aient)', 'détest(e|ent|ait|aient)', 'haine',
      'solitude',
    ],
    camera: [
      '(l[’\'])?on voit', 'nous voyons', '(l[’\'])?on entend', 'nous entendons', '(la |une )?caméra(s)?', 'gros(-| )plans?',
      'plans? (larges?|serrés?|rapprochés?|américains?|d[’\']ensemble|moyens?|fixes?)', 'zoom(e|ent|s)?( avant| arrière)?',
      'panoramique(s)?', 'travelling(s)?', '(au )?ralenti', 'champ[- ]contrechamp', 'contre-plongée', 'hors[- ]champ',
    ],
  },
  hu: {
    inner: [
      '(el|meg|át|végig|ki|vissza|újra)?gondol\\p{L}*', '(meg)?érez\\p{L}*', '(meg)?érz(i|ik|em|ed|ünk|itek|ett|ette|ették|és|ése|ései|ést|ések|éseit)',
      '(vissza)?emlékez\\p{L}*', 'emléksz\\p{L}*', 'felidéz\\p{L}*', 'tud(ja|ják|ta|ták)(?!\\s+\\p{L}*ni(?!\\p{L}))', 'sejt(i|ik|ette|ették)', 'gyanít\\p{L}*',
      'akar(ja|ják|nak|t|ta|ták|tak|na|ná|nának)?', 'szeretné(nek)?', 'szeretne', 'eldönt\\p{L}*', 'elhatároz\\p{L}*', 'döntés\\p{L}*',
      'rájö(n|nnek)', 'rájött\\p{L}*', 'ráébred\\p{L}*', 'rádöbben\\p{L}*', 'megért(i|ik|ette|ették)', 'ért(i|ik|ette|ették)',
      'remél\\p{L}*', 'reményked\\p{L}*', 'tűnőd\\p{L}*', 'töpreng\\p{L}*', 'elmélked\\p{L}*', 'kíváncsi\\p{L}*',
      '(el)?hi(szi|szik|tte|tték)', 'elhisz\\p{L}*', '(el)?képzel\\p{L}*', 'felismer\\p{L}*', 'kíván(ja|ják|ta|ták)', 'vágy(ik|nak|ott|akoz\\p{L}*|ódik|ódva)',
    ],
    emotion: [
      'szomorú\\p{L}*', 'elszomorod\\p{L}*', 'bánat\\p{L}*', 'ideges\\p{L}*', 'dühös\\p{L}*', 'dühöng\\p{L}*', 'feldühöd\\p{L}*', 'düh(e|ében|ét|vel)?',
      'mérges\\p{L}*', 'harag\\p{L}*', 'haragsz\\p{L}*', 'bosszús\\p{L}*', 'ingerült\\p{L}*', 'boldog\\p{L}*', 'vidám\\p{L}*', 'örül\\p{L}*', 'öröm(mel|ében|e)?',
      'elégedett\\p{L}*', 'fél(nek)?,? (hogy|attól|tőle)', 'félelm\\p{L}*', 'félelem', 'félve', 'félős\\p{L}*', 'ijedt\\p{L}*', 'megijed\\p{L}*', 'rémült\\p{L}*', 'megrémül\\p{L}*', 'retteg\\p{L}*', 'félénk\\p{L}*',
      'aggód\\p{L}*', 'aggodalm\\p{L}*', 'aggodalom', 'szorong\\p{L}*', 'szégyell\\p{L}*', 'szégyen(kez\\p{L}*|ében|letében)?', 'féltékeny\\p{L}*', 'irigy\\p{L}*',
      'magányos\\p{L}*', 'unatkoz\\p{L}*', 'un(ja|ják)', 'izgatott\\p{L}*', 'izgul\\p{L}*', 'zavart(an)?', 'zavarban', 'zavarodott\\p{L}*', 'nyugodt(an)?', 'megnyugsz\\p{L}*', 'megnyugod\\p{L}*',
      'megkönnyebbül\\p{L}*', 'bűntudat\\p{L}*', 'büszk\\p{L}*', 'kétségbeesett\\p{L}*', 'kétségbe ?es(ik|nek|ve|és\\p{L}*)', 'meglepőd\\p{L}*', 'meglepett(en)?',
      'csalód\\p{L}*', 'hálás\\p{L}*', 'nyomorult\\p{L}*', 'boldogtalan\\p{L}*', 'elkeseredett\\p{L}*', 'reménytelen\\p{L}*', 'türelmetlen\\p{L}*',
      'megsértőd\\p{L}*', 'sértődött\\p{L}*', 'összetört\\p{L}* szív\\p{L}*', 'szeret(i|ik|te|ték|em)?', 'gyűlöl\\p{L}*', 'utál\\p{L}*', 'kedvetlen\\p{L}*', 'meghatód\\p{L}*', 'meghatott(an)?',
    ],
    camera: [
      'látjuk', 'látunk', 'láthatjuk', 'halljuk', 'hallunk', 'hallhatjuk', 'kamer\\p{L}*', 'közelkép\\p{L}*', 'közeli (kép\\p{L}*|felvétel\\p{L}*|plán\\p{L}*)',
      '(nagy|szuper|fél)közeli\\p{L}*', 'premier ?plán\\p{L}*', '(nagy|kis)?totál ?(plán|kép)\\p{L}*', '(nagy|kis)totál\\p{L}*', 'totálban', 'zoom\\p{L}*', 'ráközelít\\p{L}*', 'svenk\\p{L}*',
      'lassított (felvétel\\p{L}*|kép\\p{L}*)', 'slow motion',
    ],
  },
  pl: {
    inner: [
      'myśl(i|ą|ał|ała|ało|eli|ały|eć)?', 'pomyśl(i|ą|ał|ała|eli|ały)', 'zamyśl(a|ają|ił|iła|ili|iły) się', 'zamyślon(y|a|e|i|ego|ej)',
      'czu(je|ją|ł|ła|li|ły|ć)', 'poczu(je|ją|ł|ła|li|ły|ć)', 'uczuci(e|a|em)',
      'pamięt(a|ają|ał|ała|ali|ały|ać)', 'zapamięt(uje|ują|ał|ała|ali|ały)', 'przypomin(a|ają|ał|ała|ali|ały) sobie', 'przypomn(i|ą|iał|iała|ieli|iały) sobie', 'wspomin(a|ają|ał|ała|ali|ały)',
      'wie', 'wiedz(ą|ieć|iał|iała|ieli|iały)', 'zna(ją|ł|ła|li|ły)?',
      'chc(e|ę|ą|ieć|iał|iała|ieli|iały)', 'pragn(ie|ą|ął|ęła|ęli|ęły)',
      'decyd(uje|ują|ował|owała|owali|owały)', 'zdecyd(uje|ują|ował|owała|owali|owały)', 'postanawia(ją|ł|ła|li|ły)?', 'postanowi(ą|ł|ła|li|ły)?',
      'uświadami(a|ają|ał|ała|ali|ały) sobie', 'uświadomi(ą|ł|ła|li|ły)? sobie', 'zda(je|ją|ł|ła|li|ły) sobie sprawę', 'domyśl(a|ają|ał|ała|ali|ały|i|ił|iła|ili|iły) się',
      'zorient(uje|ują|ował|owała|owali|owały) się', 'rozumi(e|eją|ał|ała|eli|ały|eć)', 'zrozumi(e|eją|ał|ała|eli|ały)',
      'nadziej(a|ę|i|ą)', 'zastanawia(ją|ł|ła|li|ły)? się', 'zastanowi(ą|ł|ła|li|ły)? się',
      'marz(y|ą|ył|yła|yli|yły|enie|enia)', 'wierz(y|ą|ył|yła|yli|yły)', 'uwierz(y|ą|ył|yła|yli|yły)',
      'wyobraż(a|ają|ał|ała|ali|ały)', 'wyobrazi(ą|ł|ła|li|ły)? sobie', 'rozpozna(je|ją|ł|ła|li|ły)?',
    ],
    emotion: [
      'smut(ny|na|ne|ni|nego|nej|ną|nym|nych|no|ek|ku|kiem)', 'smuci(ą)? się', 'zasmucon(y|a|e|i)',
      'zdenerwowan(y|a|e|i|ego|ej|ie|ia)', 'nerwow(y|a|e|o|i|ego|ej)', 'denerwu(je|ją) się', 'denerwował(a|o)? się', 'zestresowan(y|a|e|i)',
      'zły', 'zła', 'źli', 'złoś(ć|ci|cią)', 'złości(ł|ła|li|ły)? się', 'rozzłoszczon(y|a|e|i)', 'wściek(ły|ła|łe|li|le|łego|łej|łą|łość|łości|łością)', 'wścieka(ją)? się',
      'gniew(u|em)?', 'gniewn(y|a|e|i|ie|ego|ej)', 'zirytowan(y|a|e|i)', 'poirytowan(y|a|e|i)', 'irytacj(a|i|ą)',
      'szczęśliw(y|a|e|i|ie|ego|ej|ą)', 'nieszczęśliw(y|a|e|i|ie)', 'zadowolon(y|a|e|i|ego|ej)', 'radosn(y|a|e|i|ego|ej)', 'radoś(ć|ci|cią|nie)', 'wesoł(y|a|e|o)', 'weseli', 'ciesz(y|ą|ył|yła|yli|yły) się',
      'boi', 'boją', 'bał(a|o)?', 'bali', 'bały', 'przestraszon(y|a|e|i)', 'wystraszon(y|a|e|i)', 'przerażon(y|a|e|i)', 'przerażeni(e|a|em)', 'strach(u|em)?', 'lęk(u|iem)?',
      'zmartwion(y|a|e|i)', 'martw(i|ią|ił|iła|ili|iły) się', 'zaniepokojon(y|a|e|i)', 'niespokojn(y|a|e|i|ie)', 'niepok(ój|oju|ojem)',
      'wstyd(u|em|zi|zą|ził|ziła|zili|ziły)?', 'zawstydzon(y|a|e|i)', 'zakłopotan(y|a|e|i)', 'zazdros(ny|na|ne|ni|nie|ć|ci|cią)',
      'samotn(y|a|e|i|ego|ej|ość|ości)', 'znudzon(y|a|e|i)', 'nudzi się', 'podekscytowan(y|a|e|i)', 'zniecierpliwion(y|a|e|i)', 'niecierpliw(y|a|e|i|ie)',
      'spokojn(y|a|e|i|ie|ego|ej)', 'ulg(a|ę|i|ą)', 'winn(y|a|i)', 'winy', 'dum(a|y|ą|ny|na|ne|ni|nie|nego|nej)',
      'zrozpaczon(y|a|e|i)', 'rozpacz(y|ą|liwie|liw(y|a|e|i))?', 'zdesperowan(y|a|e|i)', 'zaskoczon(y|a|e|i)', 'zdziwion(y|a|e|i)', 'zdezorientowan(y|a|e|i)',
      'rozczarowan(y|a|e|i|ie|ia)', 'zawiedzion(y|a|e|i)', 'wdzięczn(y|a|e|i|ość|ości)', 'przygnębion(y|a|e|i)', 'załaman(y|a|e|i)', 'obrażon(y|a|e|i)',
      'tęskn(i|ią|ił|iła|ili|iły|ota|oty|otą)', 'żal(u)?', 'żału(je|ją)', 'żałował(a|o)?', 'żałowali',
      'koch(a|ają|ał|ała|ali|ały)', 'zakochan(y|a|e|i)', 'miłoś(ć|ci|cią)', 'nienawidz(i|ą|ił|iła|ili|iły)', 'nienawiś(ć|ci|cią)', 'emocj(a|e|i|ami)',
    ],
    camera: [
      'widzimy', 'słyszymy', 'kamer(a|ę|y|ą|ze)', 'zbliżeni(e|a|u|em)', 'zoom(uje|ujemy|em)?', 'najazd(u|em)?', 'odjazd kamery',
      'panoramuj(e|emy)', 'ujęci(e|a|u|em)', 'w kadrze', 'kadr(u)?', 'w zwolnionym tempie', 'zwolnione tempo',
    ],
  },
}

const W = (src) => `(?<![\\p{L}\\p{N}])(?:${src})(?![\\p{L}\\p{N}])`
const cache = {}

function patterns(locale) {
  if (!cache[locale]) {
    const lists = TELLING[locale] || TELLING.en
    cache[locale] = Object.entries(lists).map(([cat, list]) => ({ cat, re: new RegExp(W(list.join('|')), 'giu') }))
  }
  return cache[locale]
}

/** Telling words in a text, in order: [{ cat, word, index }]. */
export function findTelling(text, locale) {
  const out = []
  for (const { cat, re } of patterns(locale)) {
    re.lastIndex = 0
    for (const m of (text || '').matchAll(re)) out.push({ cat, word: m[0], index: m.index })
  }
  return out.sort((a, b) => a.index - b.index)
}
