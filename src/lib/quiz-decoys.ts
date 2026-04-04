// Static decoy pools for generating wrong answers in quiz questions
// These are well-known names that serve as plausible distractors

export const DECOY_DIRECTORS = [
  'Steven Spielberg', 'Martin Scorsese', 'Christopher Nolan', 'Quentin Tarantino',
  'Ridley Scott', 'David Fincher', 'James Cameron', 'Denis Villeneuve',
  'Wes Anderson', 'Coen Brothers', 'Stanley Kubrick', 'Alfred Hitchcock',
  'Francis Ford Coppola', 'Tim Burton', 'Guillermo del Toro', 'Clint Eastwood',
  'Peter Jackson', 'Spike Lee', 'Woody Allen', 'Roman Polanski',
  'Jean-Luc Godard', 'Luc Besson', 'Jacques Audiard', 'Cédric Klapisch',
  'François Truffaut', 'Jean-Pierre Jeunet', 'Olivier Nakache', 'Michel Hazanavicius',
  'Mathieu Kassovitz', 'Patrice Leconte',
]

export const DECOY_ACTORS = [
  'Leonardo DiCaprio', 'Brad Pitt', 'Tom Hanks', 'Meryl Streep',
  'Scarlett Johansson', 'Robert De Niro', 'Al Pacino', 'Morgan Freeman',
  'Denzel Washington', 'Cate Blanchett', 'Natalie Portman', 'Joaquin Phoenix',
  'Christian Bale', 'Matt Damon', 'Samuel L. Jackson', 'Kate Winslet',
  'Johnny Depp', 'Keanu Reeves', 'Ryan Gosling', 'Emma Stone',
  'Timothée Chalamet', 'Florence Pugh', 'Margot Robbie', 'Tom Cruise',
  'Jean Dujardin', 'Omar Sy', 'Marion Cotillard', 'Léa Seydoux',
  'Vincent Cassel', 'Audrey Tautou', 'Gérard Depardieu', 'Jean Reno',
  'Romain Duris', 'Mélanie Laurent', 'Tahar Rahim', 'Adèle Exarchopoulos',
  'Daniel Auteuil', 'Isabelle Huppert', 'Catherine Deneuve', 'Mathieu Amalric',
]

export const DECOY_TAGLINES = [
  'May the Force be with you.',
  'I\'ll be back.',
  'Houston, we have a problem.',
  'Life is like a box of chocolates.',
  'Here\'s looking at you, kid.',
  'To infinity and beyond!',
  'Just when you thought it was safe to go back in the water.',
  'In space, no one can hear you scream.',
  'The truth is out there.',
  'After all this time? Always.',
  'Why so serious?',
  'I see dead people.',
  'There is no spoon.',
  'With great power comes great responsibility.',
  'A long time ago in a galaxy far, far away...',
  'You talking to me?',
  'Here\'s Johnny!',
  'Elementary, my dear Watson.',
  'I\'m the king of the world!',
  'Hasta la vista, baby.',
]

export const DECOY_COUNTRIES = [
  { code: 'US', name: 'États-Unis' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'Royaume-Uni' },
  { code: 'DE', name: 'Allemagne' },
  { code: 'IT', name: 'Italie' },
  { code: 'ES', name: 'Espagne' },
  { code: 'JP', name: 'Japon' },
  { code: 'KR', name: 'Corée du Sud' },
  { code: 'IN', name: 'Inde' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australie' },
  { code: 'BR', name: 'Brésil' },
  { code: 'SE', name: 'Suède' },
  { code: 'DK', name: 'Danemark' },
  { code: 'CN', name: 'Chine' },
  { code: 'RU', name: 'Russie' },
  { code: 'MX', name: 'Mexique' },
  { code: 'AR', name: 'Argentine' },
  { code: 'NZ', name: 'Nouvelle-Zélande' },
  { code: 'BE', name: 'Belgique' },
]

// Runtime ranges for multiple choice
export const RUNTIME_RANGES = [
  { label: 'Moins de 90 min', min: 0, max: 89 },
  { label: '90 – 120 min', min: 90, max: 120 },
  { label: '120 – 150 min', min: 121, max: 150 },
  { label: 'Plus de 150 min', min: 151, max: 999 },
]
