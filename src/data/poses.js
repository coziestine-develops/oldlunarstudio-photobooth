/**
 * PairSnap pose library.
 *
 * To add a pose: drop the image in /public/poses/ and add one entry below.
 * Category counts in the UI are generated from this array — nothing is hardcoded.
 *
 *   id          unique, stable id
 *   title       shown on cards and the camera screen
 *   image       path served from /public (use BASE_URL so sub-path deploys work)
 *   category    'solo' | 'duo'
 *   description optional hint shown under the title on the camera screen
 *   tags        optional
 */

const img = (name) => `${import.meta.env.BASE_URL}poses/${name}`;

export const POSE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'solo', label: 'Solo' },
  { id: 'duo', label: 'Duo' },
];

export const POSES = [
  /** DUO */
  {
    id: 'duo-arm-rest',
    image: img('pose4.jpg'),
    category: 'duo',
    tags: ['selfie', 'playful'],
  },
  {
    id: 'duo-cheek-hug',
    image: img('pose3.jpg'),
    category: 'duo',
    tags: ['hug', 'cute'],
  },
  {
    id: 'duo-surprise',
    image: img('pose2.jpg'),
    category: 'duo',
    tags: ['funny face', 'selfie'],
  },
  {
    id: 'duo-classic',
    image: img('pose1.jpg'),
    category: 'duo',
    tags: ['classic', 'smile'],
  },

  {
    id: 'spyxfamily-arm-rest',
    image: img('spyxfamily0.jpg'),
    category: 'duo',
    tags: ['selfie', 'playful'],
  },
  {
    id: 'spyxfamily-cheek-hug',
    image: img('spyxfamily1.jpg'),
    category: 'duo',
    tags: ['hug', 'cute'],
  },
  {
    id: 'spyxfamily-surprise',
    image: img('spyxfamily2.jpg'),
    category: 'duo',
    tags: ['funny face', 'selfie'],
  },
  {
    id: 'spyxfamily-classic',
    image: img('spyxfamily3.jpg'),
    category: 'duo',
    tags: ['classic', 'smile'],
  },

  {
    id: 'kitagawa-gojo-arm-rest',
    image: img('kitagawa&gojo0.jpg'),
    category: 'duo',
    tags: ['selfie', 'playful'],
  },
  {
    id: 'kitagawa-gojo-cheek-hug',
    image: img('kitagawa&gojo1.jpg'),
    category: 'duo',
    tags: ['hug', 'cute'],
  },
  {
    id: 'kitagawa-gojo-surprise',
    image: img('kitagawa&gojo2.jpg'),
    category: 'duo',
    tags: ['funny face', 'selfie'],
  },
  {
    id: 'kitagawa-gojo-classic',
    image: img('kitagawa&gojo3.jpg'),
    category: 'duo',
    tags: ['classic', 'smile'],
  },

  {
    id: 'spiderman-arm-rest',
    image: img('spiderman0.jpg'),
    category: 'duo',
    tags: ['selfie', 'playful'],
  },
  {
    id: 'spiderman-cheek-hug',
    image: img('spiderman1.jpg'),
    category: 'duo',
    tags: ['hug', 'cute'],
  },
  {
    id: 'spiderman-surprise',
    image: img('spiderman2.jpg'),
    category: 'duo',
    tags: ['funny face', 'selfie'],
  },
  {
    id: 'spiderman-classic',
    image: img('spiderman3.jpg'),
    category: 'duo',
    tags: ['classic', 'smile'],
  },

  {
    id: 'monkey-arm-rest',
    image: img('monkey0.jpg'),
    category: 'duo',
    tags: ['selfie', 'playful'],
  },
  {
    id: 'monkey-cheek-hug',
    image: img('monkey1.jpg'),
    category: 'duo',
    tags: ['hug', 'cute'],
  },
  {
    id: 'monkey-surprise',
    image: img('monkey2.jpg'),
    category: 'duo',
    tags: ['funny face', 'selfie'],
  },
  {
    id: 'monkey-classic',
    image: img('monkey3.jpg'),
    category: 'duo',
    tags: ['classic', 'smile'],
  },

  /** SOLO */
  {
    id: 'solo-0',
    image: img('solo0.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-1',
    image: img('solo1.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-2',
    image: img('solo2.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-3',
    image: img('solo3.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-4',
    image: img('solo4.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-5',
    image: img('solo5.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-6',
    image: img('solo6.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-7',
    image: img('solo7.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-8',
    image: img('solo8.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-9',
    image: img('solo9.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-10',
    image: img('solo10.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
  {
    id: 'solo-11',
    image: img('solo11.jpg'),
    category: 'solo',
    tags: ['funny', 'meme', 'philippines'],
  },
];

export const poseCounts = (poses = POSES) => {
  const counts = { all: poses.length };

  for (const p of poses) {
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }

  return counts;
};

export const POSE_MAP = Object.fromEntries(
  POSES.map((p) => [p.id, p])
);