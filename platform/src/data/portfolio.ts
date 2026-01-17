export interface Event {
  id: string;
  date: string;
  title: string;
  venue?: string;
  type: 'wedding' | 'corporate' | 'private';
  songs: string[];
  testimonial?: {
    text: string;
    author: string;
  };
}

export const events: Event[] = [
  {
    id: '30',
    date: '2025-12-25',
    title: 'Wedding of Izzat & Tion',
    type: 'wedding',
    songs: ['Make You Feel My Love', 'Endless Love', 'Bukan Cinta Biasa', "Can't Help Falling in Love"],
  },
  {
    id: '29',
    date: '2025-12-21',
    title: 'Wedding of Faris (SMSS)',
    type: 'wedding',
    songs: ['Beautiful In White', 'Gurindam Jiwa', 'Bukan Cinta Biasa', 'Belaian Jiwa'],
  },
  {
    id: '28',
    date: '2025-11-23',
    title: 'Wedding of Afiqah (Skyeglass)',
    type: 'wedding',
    songs: ["Can't Help Falling in Love", 'Stargazing', 'Perfect', 'A Thousand Years'],
  },
  {
    id: '27',
    date: '2025-11-08',
    title: 'Wedding of Munirah & Afiq',
    type: 'wedding',
    songs: ['Satu Shaf Di Belakangku', 'Selawat Badar', 'My All', 'Until I Found You'],
  },
  {
    id: '26',
    date: '2025-10-24',
    title: 'Wedding of Mahirah',
    type: 'wedding',
    songs: ["Can't Help Falling in Love", 'Terima Kasih Cinta', 'Bukan Cinta Biasa'],
  },
  {
    id: '25',
    date: '2025-10-19',
    title: 'Wedding of Glenn & Izzah',
    type: 'wedding',
    songs: ['Sampai Jadi Debu', 'Make You Feel My Love', 'Young and Beautiful', 'A Thousand Years'],
  },
  {
    id: '24',
    date: '2025-09-28',
    title: 'Wedding of Wan Naim',
    type: 'wedding',
    songs: ['A Thousand Years', 'Perfect', "Can't Help Falling in Love", 'Endless Love'],
  },
  {
    id: '23',
    date: '2025-08-30',
    title: 'Wedding of Al & Qamarina',
    type: 'wedding',
    songs: ['Never Enough', 'Endless Love', "You'll Be In My Heart", 'Perfect'],
  },
  {
    id: '22',
    date: '2025-08-23',
    title: 'Wedding of Hafiy & Umi',
    type: 'wedding',
    songs: ['Sempurna', "Can't Help Falling in Love", 'Until I Found You', 'Bukan Cinta Biasa'],
  },
  {
    id: '21',
    date: '2025-07-05',
    title: 'Wedding of Hazuan',
    type: 'wedding',
    songs: ["Can't Help Falling in Love", 'A Thousand Years', 'Penjaga Hati', 'Until I Found You'],
  },
];

export const stats = {
  totalWeddings: 30,
  totalSongsPlayed: 155,
  uniqueSongs: 46,
  yearsActive: 2,
  signatureSong: "Can't Help Falling in Love",
  signatureSongPercentage: 71,
  walkDownPercentage: 93,
};
