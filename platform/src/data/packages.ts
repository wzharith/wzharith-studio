export interface Package {
  id: string;
  name: string;
  price: string;
  priceNote?: string;
  description: string;
  features: string[];
  popular?: boolean;
  songs: string;
  duration: string;
}

export const packages: Package[] = [
  {
    id: 'entrance',
    name: 'Entrance',
    price: 'RM 400',
    priceNote: 'starting from',
    description: 'Perfect for couples who want a grand entrance with live saxophone.',
    features: [
      '1-2 songs during entrance',
      'Sound check 30 mins before',
      'Professional attire',
      'Song customization',
    ],
    songs: '1-2 songs',
    duration: '15-20 minutes',
  },
  {
    id: 'classic',
    name: 'Entrance + Cake',
    price: 'RM 600',
    priceNote: 'starting from',
    description: 'The most popular package for intimate weddings.',
    features: [
      'Everything in Entrance',
      '1-2 songs for cake cutting',
      'Emcee coordination',
      'Professional photos welcome',
    ],
    popular: true,
    songs: '3-4 songs',
    duration: '30-45 minutes',
  },
  {
    id: 'full',
    name: 'Full Package',
    price: 'RM 1,000',
    priceNote: 'starting from',
    description: 'Complete saxophone experience for your special day.',
    features: [
      'Everything in Classic',
      'Meal accompaniment (30-45 min)',
      '5-8 additional songs',
      'Walkabout performance',
    ],
    songs: '8-10 songs',
    duration: '1.5-2 hours',
  },
  {
    id: 'premium',
    name: 'Premium Experience',
    price: 'RM 1,800',
    priceNote: 'starting from',
    description: 'The ultimate live music experience with collaboration options.',
    features: [
      'Everything in Full Package',
      'Pre-event consultation',
      'Unlimited song requests',
      'Duo performance option',
      'Extended performance (2+ hours)',
    ],
    songs: 'Unlimited',
    duration: '2+ hours',
  },
];

export const addOns = [
  { name: 'Additional song', price: 'RM 50/song' },
  { name: 'Custom song learning', price: 'RM 100/song' },
  { name: 'Second location (same day)', price: 'RM 300' },
  { name: 'Outstation (within Selangor)', price: '+RM 100-200' },
  { name: 'Outstation (outside Selangor)', price: '+RM 300-500' },
];
