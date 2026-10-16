import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI || "mongodb+srv://errandr:errandr@errandr.eknah3x.mongodb.net/test?appName=errandr";

export interface RawInstitution {
  name: string;
  shortName: string;
  slug: string;
  city: string;
  state: string;
  category: 'university' | 'health_sciences' | 'polytechnic' | 'college_of_education';
  tagline?: string;
  isActive?: boolean;
}

export const INSTITUTIONS_DATA: RawInstitution[] = [
  // ==================== LAGOS STATE ====================
  {
    name: 'College of Medicine, University of Lagos',
    shortName: 'CMUL',
    slug: 'cmul',
    city: 'Idi-Araba',
    state: 'Lagos',
    category: 'health_sciences',
    tagline: 'Campus life, elevated. (Founding Campus)',
    isActive: true
  },
  {
    name: 'University of Lagos (Akoka)',
    shortName: 'UNILAG',
    slug: 'unilag',
    city: 'Akoka',
    state: 'Lagos',
    category: 'university',
    tagline: 'In deed and in truth.',
    isActive: true
  },
  {
    name: 'Lagos State University (Ojo)',
    shortName: 'LASU',
    slug: 'lasu',
    city: 'Ojo',
    state: 'Lagos',
    category: 'university',
    tagline: 'For truth and service.',
    isActive: true
  },
  {
    name: 'Lagos State University College of Medicine (LASUTH)',
    shortName: 'LASUCOM',
    slug: 'lasucom',
    city: 'Ikeja',
    state: 'Lagos',
    category: 'health_sciences',
    tagline: 'Excellence in medicine.',
    isActive: true
  },
  {
    name: 'Lagos State University of Science and Technology',
    shortName: 'LASUSTECH',
    slug: 'lasustech',
    city: 'Ikorodu',
    state: 'Lagos',
    category: 'university',
    tagline: 'Technology and innovation.',
    isActive: true
  },
  {
    name: 'Lagos State University of Education',
    shortName: 'LASUED',
    slug: 'lasued',
    city: 'Otto/Ijanikin',
    state: 'Lagos',
    category: 'university',
    tagline: 'Education for national development.',
    isActive: true
  },
  {
    name: 'Pan-Atlantic University',
    shortName: 'PAU',
    slug: 'pau',
    city: 'Lekki',
    state: 'Lagos',
    category: 'university',
    tagline: 'Educating the whole person.',
    isActive: true
  },
  {
    name: 'Caleb University',
    shortName: 'CALEB',
    slug: 'caleb-university',
    city: 'Imota',
    state: 'Lagos',
    category: 'university',
    tagline: 'For God and humanity.',
    isActive: true
  },
  {
    name: 'Caleb University College of Health Sciences',
    shortName: 'CALEB-MED',
    slug: 'caleb-med',
    city: 'Imota',
    state: 'Lagos',
    category: 'health_sciences',
    tagline: 'Compassionate medical care.',
    isActive: true
  },
  {
    name: 'Augustine University',
    shortName: 'AUI',
    slug: 'augustine-university',
    city: 'Epe',
    state: 'Lagos',
    category: 'university',
    tagline: 'For learning and character.',
    isActive: true
  },
  {
    name: 'Anchor University',
    shortName: 'AUL',
    slug: 'anchor-university',
    city: 'Ayobo',
    state: 'Lagos',
    category: 'university',
    tagline: 'Character, competence, courage.',
    isActive: true
  },
  {
    name: 'Eko University of Medicine and Health Sciences',
    shortName: 'EKOUNIMED',
    slug: 'ekounimed',
    city: 'Ijanikin',
    state: 'Lagos',
    category: 'health_sciences',
    tagline: 'Advancing healthcare frontiers.',
    isActive: true
  },
  {
    name: 'Trinity University',
    shortName: 'TRINITY',
    slug: 'trinity-university',
    city: 'Yaba',
    state: 'Lagos',
    category: 'university',
    tagline: 'Empowering minds, transforming society.',
    isActive: true
  },
  {
    name: 'National Open University of Nigeria (Lagos Study Centre)',
    shortName: 'NOUN-LAGOS',
    slug: 'noun-lagos',
    city: 'Victoria Island',
    state: 'Lagos',
    category: 'university',
    tagline: 'Work and learn.',
    isActive: true
  },
  {
    name: 'Yaba College of Technology',
    shortName: 'YABATECH',
    slug: 'yabatech',
    city: 'Yaba',
    state: 'Lagos',
    category: 'polytechnic',
    tagline: 'The first and still the best.',
    isActive: true
  },
  {
    name: 'Lagos City Polytechnic',
    shortName: 'LCP',
    slug: 'lagos-city-poly',
    city: 'Ikeja',
    state: 'Lagos',
    category: 'polytechnic',
    tagline: 'Practical technical education.',
    isActive: true
  },
  {
    name: 'Grace Polytechnic',
    shortName: 'GRACE-POLY',
    slug: 'grace-poly',
    city: 'Surulere',
    state: 'Lagos',
    category: 'polytechnic',
    tagline: 'Excellence in vocation.',
    isActive: true
  },
  {
    name: 'Federal College of Education (Technical) Akoka',
    shortName: 'FCET-AKOKA',
    slug: 'fcet-akoka',
    city: 'Akoka',
    state: 'Lagos',
    category: 'college_of_education',
    tagline: 'Teachers of technical excellence.',
    isActive: true
  },
  {
    name: 'Adeniran Ogunsanya College of Education',
    shortName: 'AOCOED',
    slug: 'aocoed',
    city: 'Otto/Ijanikin',
    state: 'Lagos',
    category: 'college_of_education',
    tagline: 'Pedagogical brilliance.',
    isActive: true
  },
  {
    name: 'Michael Otedola College of Primary Education',
    shortName: 'MOCPED',
    slug: 'mocped',
    city: 'Epe',
    state: 'Lagos',
    category: 'college_of_education',
    tagline: 'Foundation for future leaders.',
    isActive: true
  },

  // ==================== ABIA STATE ====================
  { name: 'Abia State University (Uturu)', shortName: 'ABSU', slug: 'absu', city: 'Uturu', state: 'Abia', category: 'university', isActive: true },
  { name: 'Abia State University College of Medicine (ABSUTH)', shortName: 'ABSU-MED', slug: 'absu-med', city: 'Aba', state: 'Abia', category: 'health_sciences', isActive: true },
  { name: 'Michael Okpara University of Agriculture (Umudike)', shortName: 'MOUAU', slug: 'mouau', city: 'Umudike', state: 'Abia', category: 'university', isActive: true },
  { name: 'Gregory University', shortName: 'GOU', slug: 'gregory-university', city: 'Uturu', state: 'Abia', category: 'university', isActive: true },
  { name: 'Clifford University', shortName: 'CLU', slug: 'clifford-university', city: 'Owerrinta', state: 'Abia', category: 'university', isActive: true },
  { name: 'Rhema University', shortName: 'RHEMA', slug: 'rhema-university', city: 'Aba', state: 'Abia', category: 'university', isActive: true },
  { name: 'Spiritan University', shortName: 'SPIRITAN', slug: 'spiritan-university', city: 'Nneochi', state: 'Abia', category: 'university', isActive: true },
  { name: 'Abia State Polytechnic', shortName: 'ABIAPOLY', slug: 'abiapoly', city: 'Aba', state: 'Abia', category: 'polytechnic', isActive: true },
  { name: 'Abia State College of Education (Technical) Arochukwu', shortName: 'ASCETA', slug: 'asceta', city: 'Arochukwu', state: 'Abia', category: 'college_of_education', isActive: true },

  // ==================== ADAMAWA STATE ====================
  { name: 'Modibbo Adama University', shortName: 'MAU', slug: 'mau-yola', city: 'Yola', state: 'Adamawa', category: 'university', isActive: true },
  { name: 'Modibbo Adama University College of Medical Sciences', shortName: 'MAU-MED', slug: 'mau-med', city: 'Yola', state: 'Adamawa', category: 'health_sciences', isActive: true },
  { name: 'Adamawa State University', shortName: 'ADSU', slug: 'adsu', city: 'Mubi', state: 'Adamawa', category: 'university', isActive: true },
  { name: 'American University of Nigeria', shortName: 'AUN', slug: 'aun', city: 'Yola', state: 'Adamawa', category: 'university', isActive: true },
  { name: 'Federal Polytechnic Mubi', shortName: 'FPM', slug: 'fedpoly-mubi', city: 'Mubi', state: 'Adamawa', category: 'polytechnic', isActive: true },
  { name: 'Adamawa State Polytechnic', shortName: 'ADAMAWAPOLY', slug: 'adamawapoly', city: 'Yola', state: 'Adamawa', category: 'polytechnic', isActive: true },
  { name: 'Federal College of Education Yola', shortName: 'FCE-YOLA', slug: 'fce-yola', city: 'Yola', state: 'Adamawa', category: 'college_of_education', isActive: true },

  // ==================== AKWA IBOM STATE ====================
  { name: 'University of Uyo', shortName: 'UNIUYO', slug: 'uniuyo', city: 'Uyo', state: 'Akwa Ibom', category: 'university', isActive: true },
  { name: 'University of Uyo College of Health Sciences (UUTH)', shortName: 'UNIUYO-MED', slug: 'uniuyo-med', city: 'Uyo', state: 'Akwa Ibom', category: 'health_sciences', isActive: true },
  { name: 'Akwa Ibom State University', shortName: 'AKSU', slug: 'aksu', city: 'Ikot Akpaden', state: 'Akwa Ibom', category: 'university', isActive: true },
  { name: 'Federal University of Technology Ikot Abasi', shortName: 'FUTIA', slug: 'futia', city: 'Ikot Abasi', state: 'Akwa Ibom', category: 'university', isActive: true },
  { name: 'Obong University', shortName: 'OBONG', slug: 'obong-university', city: 'Obong Ntak', state: 'Akwa Ibom', category: 'university', isActive: true },
  { name: 'Ritman University', shortName: 'RITMAN', slug: 'ritman-university', city: 'Ikot Ekpene', state: 'Akwa Ibom', category: 'university', isActive: true },
  { name: 'Topfaith University', shortName: 'TOPFAITH', slug: 'topfaith-university', city: 'Mkpatak', state: 'Akwa Ibom', category: 'university', isActive: true },
  { name: 'Akwa Ibom State Polytechnic', shortName: 'AKWAPOLY', slug: 'akwapoly', city: 'Ikot Osurua', state: 'Akwa Ibom', category: 'polytechnic', isActive: true },
  { name: 'Akwa Ibom State College of Education', shortName: 'AKSCOE', slug: 'akscoe', city: 'Afaha Nsit', state: 'Akwa Ibom', category: 'college_of_education', isActive: true },

  // ==================== ANAMBRA STATE ====================
  { name: 'Nnamdi Azikiwe University (Awka)', shortName: 'UNIZIK', slug: 'unizik', city: 'Awka', state: 'Anambra', category: 'university', isActive: true },
  { name: 'Nnamdi Azikiwe University College of Health Sciences (Nnewi / NAUTH)', shortName: 'UNIZIK-MED', slug: 'unizik-med', city: 'Nnewi', state: 'Anambra', category: 'health_sciences', isActive: true },
  { name: 'Chukwuemeka Odumegwu Ojukwu University', shortName: 'COOU', slug: 'coou', city: 'Uli', state: 'Anambra', category: 'university', isActive: true },
  { name: 'Paul University', shortName: 'PAUL', slug: 'paul-university', city: 'Awka', state: 'Anambra', category: 'university', isActive: true },
  { name: 'Tansian University', shortName: 'TANSIAN', slug: 'tansian-university', city: 'Umunya', state: 'Anambra', category: 'university', isActive: true },
  { name: 'Madonna University (Okija)', shortName: 'MADONNA-OKIJA', slug: 'madonna-okija', city: 'Okija', state: 'Anambra', category: 'university', isActive: true },
  { name: 'Federal Polytechnic Oko', shortName: 'OKOPOLY', slug: 'okopoly', city: 'Oko', state: 'Anambra', category: 'polytechnic', isActive: true },
  { name: 'Federal College of Education (Technical) Umunze', shortName: 'FCET-UMUNZE', slug: 'fcet-umunze', city: 'Umunze', state: 'Anambra', category: 'college_of_education', isActive: true },
  { name: 'Nwafor Orizu College of Education', shortName: 'NOCEN', slug: 'nocen', city: 'Nsugbe', state: 'Anambra', category: 'college_of_education', isActive: true },

  // ==================== BAUCHI STATE ====================
  { name: 'Abubakar Tafawa Balewa University', shortName: 'ATBU', slug: 'atbu', city: 'Bauchi', state: 'Bauchi', category: 'university', isActive: true },
  { name: 'Abubakar Tafawa Balewa University College of Medical Sciences (ATBUTH)', shortName: 'ATBU-MED', slug: 'atbu-med', city: 'Bauchi', state: 'Bauchi', category: 'health_sciences', isActive: true },
  { name: 'Bauchi State University (Gadau)', shortName: 'BASUG', slug: 'basug', city: 'Gadau', state: 'Bauchi', category: 'university', isActive: true },
  { name: 'Federal University of Health Sciences (Azare)', shortName: 'FUHSA', slug: 'fuhsa', city: 'Azare', state: 'Bauchi', category: 'health_sciences', isActive: true },
  { name: 'Federal Polytechnic Bauchi', shortName: 'FEDPOLY-BAUCHI', slug: 'fedpoly-bauchi', city: 'Bauchi', state: 'Bauchi', category: 'polytechnic', isActive: true },

  // ==================== BAYELSA STATE ====================
  { name: 'Niger Delta University', shortName: 'NDU', slug: 'ndu', city: 'Amassoma', state: 'Bayelsa', category: 'university', isActive: true },
  { name: 'Niger Delta University College of Health Sciences', shortName: 'NDU-MED', slug: 'ndu-med', city: 'Amassoma', state: 'Bayelsa', category: 'health_sciences', isActive: true },
  { name: 'Federal University Otuoke', shortName: 'FUOTUOKE', slug: 'fuotuoke', city: 'Otuoke', state: 'Bayelsa', category: 'university', isActive: true },
  { name: 'Bayelsa Medical University', shortName: 'BMU', slug: 'bmu', city: 'Yenagoa', state: 'Bayelsa', category: 'health_sciences', isActive: true },
  { name: 'Federal Polytechnic Ekowe', shortName: 'FPE', slug: 'fedpoly-ekowe', city: 'Ekowe', state: 'Bayelsa', category: 'polytechnic', isActive: true },

  // ==================== BENUE STATE ====================
  { name: 'Benue State University (Makurdi)', shortName: 'BSUM', slug: 'bsum', city: 'Makurdi', state: 'Benue', category: 'university', isActive: true },
  { name: 'Benue State University College of Health Sciences', shortName: 'BSU-MED', slug: 'bsu-med', city: 'Makurdi', state: 'Benue', category: 'health_sciences', isActive: true },
  { name: 'Joseph Sarwuan Tarka University', shortName: 'JOSTUM', slug: 'jostum', city: 'Makurdi', state: 'Benue', category: 'university', isActive: true },
  { name: 'Federal University of Health Sciences (Otukpo)', shortName: 'FUHSO', slug: 'fuhso', city: 'Otukpo', state: 'Benue', category: 'health_sciences', isActive: true },
  { name: 'Benue State Polytechnic', shortName: 'BENPOLY', slug: 'benpoly', city: 'Ugbokolo', state: 'Benue', category: 'polytechnic', isActive: true },

  // ==================== BORNO STATE ====================
  { name: 'University of Maiduguri', shortName: 'UNIMAID', slug: 'unimaid', city: 'Maiduguri', state: 'Borno', category: 'university', isActive: true },
  { name: 'University of Maiduguri College of Medical Sciences (UMTH)', shortName: 'UNIMAID-MED', slug: 'unimaid-med', city: 'Maiduguri', state: 'Borno', category: 'health_sciences', isActive: true },
  { name: 'Borno State University', shortName: 'BOSU', slug: 'bosu', city: 'Maiduguri', state: 'Borno', category: 'university', isActive: true },
  { name: 'Nigerian Army University (Biu)', shortName: 'NAUB', slug: 'naub', city: 'Biu', state: 'Borno', category: 'university', isActive: true },
  { name: 'Ramat Polytechnic', shortName: 'RAMAT', slug: 'ramat-poly', city: 'Maiduguri', state: 'Borno', category: 'polytechnic', isActive: true },

  // ==================== CROSS RIVER STATE ====================
  { name: 'University of Calabar', shortName: 'UNICAL', slug: 'unical', city: 'Calabar', state: 'Cross River', category: 'university', isActive: true },
  { name: 'University of Calabar College of Medical Sciences (UCTH)', shortName: 'UNICAL-MED', slug: 'unical-med', city: 'Calabar', state: 'Cross River', category: 'health_sciences', isActive: true },
  { name: 'Cross River University of Technology', shortName: 'CRUTECH', slug: 'crutech', city: 'Calabar', state: 'Cross River', category: 'university', isActive: true },
  { name: 'Federal College of Education Obudu', shortName: 'FCE-OBUDU', slug: 'fce-obudu', city: 'Obudu', state: 'Cross River', category: 'college_of_education', isActive: true },

  // ==================== DELTA STATE ====================
  { name: 'Delta State University (Abraka)', shortName: 'DELSU', slug: 'delsu', city: 'Abraka', state: 'Delta', category: 'university', isActive: true },
  { name: 'Delta State University College of Health Sciences (Oghara)', shortName: 'DELSU-MED', slug: 'delsu-med', city: 'Oghara', state: 'Delta', category: 'health_sciences', isActive: true },
  { name: 'Federal University of Petroleum Resources (Effurun)', shortName: 'FUPRE', slug: 'fupre', city: 'Effurun', state: 'Delta', category: 'university', isActive: true },
  { name: 'Dennis Osadebay University', shortName: 'DOU', slug: 'dennis-osadebay', city: 'Asaba', state: 'Delta', category: 'university', isActive: true },
  { name: 'University of Delta (Agbor)', shortName: 'UNIDEL', slug: 'unidel', city: 'Agbor', state: 'Delta', category: 'university', isActive: true },
  { name: 'Delta State University of Science and Technology', shortName: 'DSUST', slug: 'dsust', city: 'Ozoro', state: 'Delta', category: 'university', isActive: true },
  { name: 'Western Delta University', shortName: 'WDU', slug: 'wdu', city: 'Oghara', state: 'Delta', category: 'university', isActive: true },
  { name: 'Petroleum Training Institute (Effurun)', shortName: 'PTI', slug: 'pti-effurun', city: 'Effurun', state: 'Delta', category: 'polytechnic', isActive: true },
  { name: 'Delta State Polytechnic (Ogwashi-Uku)', shortName: 'DSPG', slug: 'dspg-ogwashi', city: 'Ogwashi-Uku', state: 'Delta', category: 'polytechnic', isActive: true },

  // ==================== EBONYI STATE ====================
  { name: 'Alex Ekwueme Federal University (Ndufu-Alike)', shortName: 'AE-FUNAI', slug: 'funai', city: 'Ndufu-Alike', state: 'Ebonyi', category: 'university', isActive: true },
  { name: 'Ebonyi State University', shortName: 'EBSU', slug: 'ebsu', city: 'Abakaliki', state: 'Ebonyi', category: 'university', isActive: true },
  { name: 'David Umahi Federal University of Health Sciences (Uburu)', shortName: 'DUFUHS', slug: 'dufuhs', city: 'Uburu', state: 'Ebonyi', category: 'health_sciences', isActive: true },
  { name: 'Akanu Ibiam Federal Polytechnic (Unwana)', shortName: 'AIFPU', slug: 'aifpu', city: 'Unwana', state: 'Ebonyi', category: 'polytechnic', isActive: true },

  // ==================== EDO STATE ====================
  { name: 'University of Benin', shortName: 'UNIBEN', slug: 'uniben', city: 'Benin City', state: 'Edo', category: 'university', isActive: true },
  { name: 'University of Benin College of Medical Sciences (UBTH)', shortName: 'UNIBEN-MED', slug: 'uniben-med', city: 'Benin City', state: 'Edo', category: 'health_sciences', isActive: true },
  { name: 'Ambrose Alli University (Ekpoma)', shortName: 'AAU', slug: 'aau-ekpoma', city: 'Ekpoma', state: 'Edo', category: 'university', isActive: true },
  { name: 'Ambrose Alli University College of Medicine (ISTH Irrua)', shortName: 'AAU-MED', slug: 'aau-med', city: 'Irrua', state: 'Edo', category: 'health_sciences', isActive: true },
  { name: 'Edo State University (Uzairue)', shortName: 'EDSU', slug: 'edsu', city: 'Iyamho', state: 'Edo', category: 'university', isActive: true },
  { name: 'Igbinedion University (Okada)', shortName: 'IUO', slug: 'iuo', city: 'Okada', state: 'Edo', category: 'university', isActive: true },
  { name: 'Benson Idahosa University', shortName: 'BIU', slug: 'biu', city: 'Benin City', state: 'Edo', category: 'university', isActive: true },
  { name: 'Auchi Polytechnic', shortName: 'AUCHI-POLY', slug: 'auchi-poly', city: 'Auchi', state: 'Edo', category: 'polytechnic', isActive: true },

  // ==================== EKITI STATE ====================
  { name: 'Federal University Oye-Ekiti', shortName: 'FUOYE', slug: 'fuoye', city: 'Oye-Ekiti', state: 'Ekiti', category: 'university', isActive: true },
  { name: 'Ekiti State University (Ado-Ekiti)', shortName: 'EKSU', slug: 'eksu', city: 'Ado-Ekiti', state: 'Ekiti', category: 'university', isActive: true },
  { name: 'Ekiti State University College of Medicine (EKSUTH)', shortName: 'EKSU-MED', slug: 'eksu-med', city: 'Ado-Ekiti', state: 'Ekiti', category: 'health_sciences', isActive: true },
  { name: 'Afe Babalola University (Ado-Ekiti)', shortName: 'ABUAD', slug: 'abuad', city: 'Ado-Ekiti', state: 'Ekiti', category: 'university', isActive: true },
  { name: 'Federal Polytechnic Ado-Ekiti', shortName: 'FEDPOLY-ADO', slug: 'fedpoly-ado', city: 'Ado-Ekiti', state: 'Ekiti', category: 'polytechnic', isActive: true },

  // ==================== ENUGU STATE ====================
  { name: 'University of Nigeria (Nsukka)', shortName: 'UNN', slug: 'unn', city: 'Nsukka', state: 'Enugu', category: 'university', isActive: true },
  { name: 'University of Nigeria (Enugu Campus - UNEC)', shortName: 'UNEC', slug: 'unec', city: 'Enugu', state: 'Enugu', category: 'university', isActive: true },
  { name: 'University of Nigeria College of Medicine (UNTH Ituku-Ozalla)', shortName: 'UNN-MED', slug: 'unn-med', city: 'Ituku-Ozalla', state: 'Enugu', category: 'health_sciences', isActive: true },
  { name: 'Enugu State University of Science and Technology', shortName: 'ESUT', slug: 'esut', city: 'Enugu', state: 'Enugu', category: 'university', isActive: true },
  { name: 'Enugu State University College of Medicine (Parklane)', shortName: 'ESUT-MED', slug: 'esut-med', city: 'Enugu', state: 'Enugu', category: 'health_sciences', isActive: true },
  { name: 'Enugu State University of Medical and Applied Sciences (Igbo-Eno)', shortName: 'SUMAS', slug: 'sumas', city: 'Igbo-Eno', state: 'Enugu', category: 'health_sciences', isActive: true },
  { name: 'Godfrey Okoye University', shortName: 'GO-UNI', slug: 'gouni', city: 'Enugu', state: 'Enugu', category: 'university', isActive: true },
  { name: 'Institute of Management and Technology (IMT)', shortName: 'IMT', slug: 'imt-enugu', city: 'Enugu', state: 'Enugu', category: 'polytechnic', isActive: true },

  // ==================== FCT ABUJA ====================
  { name: 'University of Abuja', shortName: 'UNIABUJA', slug: 'uniabuja', city: 'Gwagwalada', state: 'FCT Abuja', category: 'university', isActive: true },
  { name: 'University of Abuja College of Health Sciences (UATH)', shortName: 'UNIABUJA-MED', slug: 'uniabuja-med', city: 'Gwagwalada', state: 'FCT Abuja', category: 'health_sciences', isActive: true },
  { name: 'Baze University', shortName: 'BAZE', slug: 'baze-university', city: 'Abuja', state: 'FCT Abuja', category: 'university', isActive: true },
  { name: 'Nile University of Nigeria', shortName: 'NILE', slug: 'nile-university', city: 'Abuja', state: 'FCT Abuja', category: 'university', isActive: true },
  { name: 'Veritas University', shortName: 'VERITAS', slug: 'veritas-university', city: 'Bwari', state: 'FCT Abuja', category: 'university', isActive: true },
  { name: 'National Open University of Nigeria (HQ)', shortName: 'NOUN-HQ', slug: 'noun-hq', city: 'Jabi', state: 'FCT Abuja', category: 'university', isActive: true },
  { name: 'FCT College of Education (Zuba)', shortName: 'FCOE-ZUBA', slug: 'fcoe-zuba', city: 'Zuba', state: 'FCT Abuja', category: 'college_of_education', isActive: true },

  // ==================== IMO STATE ====================
  { name: 'Federal University of Technology Owerri', shortName: 'FUTO', slug: 'futo', city: 'Owerri', state: 'Imo', category: 'university', isActive: true },
  { name: 'Imo State University', shortName: 'IMSU', slug: 'imsu', city: 'Owerri', state: 'Imo', category: 'university', isActive: true },
  { name: 'Imo State University College of Medicine (Orlu)', shortName: 'IMSU-MED', slug: 'imsu-med', city: 'Orlu', state: 'Imo', category: 'health_sciences', isActive: true },
  { name: 'Federal Polytechnic Nekede', shortName: 'FEDPONEK', slug: 'fedponek', city: 'Nekede', state: 'Imo', category: 'polytechnic', isActive: true },

  // ==================== KADUNA STATE ====================
  { name: 'Ahmadu Bello University (Zaria)', shortName: 'ABU', slug: 'abu-zaria', city: 'Zaria', state: 'Kaduna', category: 'university', isActive: true },
  { name: 'Ahmadu Bello University College of Medical Sciences (ABUTH Shika)', shortName: 'ABU-MED', slug: 'abu-med', city: 'Shika', state: 'Kaduna', category: 'health_sciences', isActive: true },
  { name: 'Kaduna State University', shortName: 'KASU', slug: 'kasu', city: 'Kaduna', state: 'Kaduna', category: 'university', isActive: true },
  { name: 'Nigerian Defence Academy', shortName: 'NDA', slug: 'nda', city: 'Kaduna', state: 'Kaduna', category: 'university', isActive: true },
  { name: 'Kaduna Polytechnic', shortName: 'KADPOLY', slug: 'kadpoly', city: 'Kaduna', state: 'Kaduna', category: 'polytechnic', isActive: true },

  // ==================== KANO STATE ====================
  { name: 'Bayero University Kano', shortName: 'BUK', slug: 'buk', city: 'Kano', state: 'Kano', category: 'university', isActive: true },
  { name: 'Bayero University Kano College of Health Sciences (AKTH)', shortName: 'BUK-MED', slug: 'buk-med', city: 'Kano', state: 'Kano', category: 'health_sciences', isActive: true },
  { name: 'Aliko Dangote University of Science and Technology (Wudil)', shortName: 'ADUSTECH', slug: 'adustech', city: 'Wudil', state: 'Kano', category: 'university', isActive: true },
  { name: 'Yusuf Maitama Sule University', shortName: 'YUMSUK', slug: 'yumsuk', city: 'Kano', state: 'Kano', category: 'university', isActive: true },
  { name: 'Kano State Polytechnic', shortName: 'KANOPOLY', slug: 'kanopoly', city: 'Kano', state: 'Kano', category: 'polytechnic', isActive: true },
  { name: 'Federal College of Education Kano', shortName: 'FCE-KANO', slug: 'fce-kano', city: 'Kano', state: 'Kano', category: 'college_of_education', isActive: true },

  // ==================== KWARA STATE ====================
  { name: 'University of Ilorin', shortName: 'UNILORIN', slug: 'unilorin', city: 'Ilorin', state: 'Kwara', category: 'university', isActive: true },
  { name: 'University of Ilorin College of Health Sciences (UITH)', shortName: 'UNILORIN-MED', slug: 'unilorin-med', city: 'Ilorin', state: 'Kwara', category: 'health_sciences', isActive: true },
  { name: 'Kwara State University (Malete)', shortName: 'KWASU', slug: 'kwasu', city: 'Malete', state: 'Kwara', category: 'university', isActive: true },
  { name: 'Al-Hikmah University', shortName: 'AL-HIKMAH', slug: 'al-hikmah', city: 'Ilorin', state: 'Kwara', category: 'university', isActive: true },
  { name: 'Landmark University (Omu-Aran)', shortName: 'LMU', slug: 'landmark', city: 'Omu-Aran', state: 'Kwara', category: 'university', isActive: true },
  { name: 'Federal Polytechnic Offa', shortName: 'OFFAPOLY', slug: 'offapoly', city: 'Offa', state: 'Kwara', category: 'polytechnic', isActive: true },
  { name: 'Kwara State Polytechnic', shortName: 'KWARAPOLY', slug: 'kwarapoly', city: 'Ilorin', state: 'Kwara', category: 'polytechnic', isActive: true },

  // ==================== OGUN STATE ====================
  { name: 'Federal University of Agriculture Abeokuta', shortName: 'FUNAAB', slug: 'funaab', city: 'Abeokuta', state: 'Ogun', category: 'university', isActive: true },
  { name: 'Olabisi Onabanjo University (Ago-Iwoye)', shortName: 'OOU', slug: 'oou', city: 'Ago-Iwoye', state: 'Ogun', category: 'university', isActive: true },
  { name: 'Olabisi Onabanjo University College of Health Sciences (Sagamu / OOUTH)', shortName: 'OOU-MED', slug: 'oou-med', city: 'Sagamu', state: 'Ogun', category: 'health_sciences', isActive: true },
  { name: 'Covenant University (Ota)', shortName: 'CU', slug: 'covenant', city: 'Ota', state: 'Ogun', category: 'university', isActive: true },
  { name: 'Babcock University (Ilishan-Remo)', shortName: 'BABCOCK', slug: 'babcock', city: 'Ilishan-Remo', state: 'Ogun', category: 'university', isActive: true },
  { name: 'Babcock University College of Health and Medical Sciences', shortName: 'BABCOCK-MED', slug: 'babcock-med', city: 'Ilishan-Remo', state: 'Ogun', category: 'health_sciences', isActive: true },
  { name: 'Bells University of Technology (Ota)', shortName: 'BELLSTECH', slug: 'bellstech', city: 'Ota', state: 'Ogun', category: 'university', isActive: true },
  { name: 'Tai Solarin University of Education (Ijagun)', shortName: 'TASUED', slug: 'tasued', city: 'Ijagun', state: 'Ogun', category: 'university', isActive: true },
  { name: 'Moshood Abiola Polytechnic (MAPOLY)', shortName: 'MAPOLY', slug: 'mapoly', city: 'Abeokuta', state: 'Ogun', category: 'polytechnic', isActive: true },
  { name: 'Federal Polytechnic Ilaro', shortName: 'ILAROPOLY', slug: 'ilaropoly', city: 'Ilaro', state: 'Ogun', category: 'polytechnic', isActive: true },

  // ==================== ONDO STATE ====================
  { name: 'Federal University of Technology Akure', shortName: 'FUTA', slug: 'futa', city: 'Akure', state: 'Ondo', category: 'university', isActive: true },
  { name: 'Adekunle Ajasin University (Akungba)', shortName: 'AAUA', slug: 'aaua', city: 'Akungba', state: 'Ondo', category: 'university', isActive: true },
  { name: 'University of Medical Sciences (Ondo)', shortName: 'UNIMED', slug: 'unimed', city: 'Ondo City', state: 'Ondo', category: 'health_sciences', isActive: true },
  { name: 'Achievers University (Owo)', shortName: 'ACHIEVERS', slug: 'achievers', city: 'Owo', state: 'Ondo', category: 'university', isActive: true },
  { name: 'Rufus Giwa Polytechnic (Owo)', shortName: 'RUGIPO', slug: 'rugipo', city: 'Owo', state: 'Ondo', category: 'polytechnic', isActive: true },

  // ==================== OSUN STATE ====================
  { name: 'Obafemi Awolowo University (Ile-Ife)', shortName: 'OAU', slug: 'oau', city: 'Ile-Ife', state: 'Osun', category: 'university', isActive: true },
  { name: 'Obafemi Awolowo University College of Health Sciences (OAUTHC)', shortName: 'OAU-MED', slug: 'oau-med', city: 'Ile-Ife', state: 'Osun', category: 'health_sciences', isActive: true },
  { name: 'Osun State University (Osogbo)', shortName: 'UNIOSUN', slug: 'uniosun', city: 'Osogbo', state: 'Osun', category: 'university', isActive: true },
  { name: 'Bowen University (Iwo)', shortName: 'BOWEN', slug: 'bowen', city: 'Iwo', state: 'Osun', category: 'university', isActive: true },
  { name: 'Redeemer’s University (Ede)', shortName: 'RUN', slug: 'run', city: 'Ede', state: 'Osun', category: 'university', isActive: true },
  { name: 'Adeleke University (Ede)', shortName: 'ADELEKE', slug: 'adeleke', city: 'Ede', state: 'Osun', category: 'university', isActive: true },
  { name: 'Federal Polytechnic Ede', shortName: 'EDEPOLY', slug: 'edepoly', city: 'Ede', state: 'Osun', category: 'polytechnic', isActive: true },
  { name: 'Osun State Polytechnic (Iree)', shortName: 'OSPOM', slug: 'ospom-iree', city: 'Iree', state: 'Osun', category: 'polytechnic', isActive: true },

  // ==================== OYO STATE ====================
  { name: 'University of Ibadan', shortName: 'UI', slug: 'ui', city: 'Ibadan', state: 'Oyo', category: 'university', isActive: true },
  { name: 'University of Ibadan College of Medicine (UCH)', shortName: 'UI-MED', slug: 'ui-med', city: 'Ibadan', state: 'Oyo', category: 'health_sciences', isActive: true },
  { name: 'Ladoke Akintola University of Technology', shortName: 'LAUTECH', slug: 'lautech', city: 'Ogbomoso', state: 'Oyo', category: 'university', isActive: true },
  { name: 'LAUTECH College of Health Sciences', shortName: 'LAUTECH-MED', slug: 'lautech-med', city: 'Ogbomoso', state: 'Oyo', category: 'health_sciences', isActive: true },
  { name: 'Lead City University', shortName: 'LCU', slug: 'lead-city', city: 'Ibadan', state: 'Oyo', category: 'university', isActive: true },
  { name: 'Ajayi Crowther University (Oyo)', shortName: 'ACU', slug: 'acu', city: 'Oyo', state: 'Oyo', category: 'university', isActive: true },
  { name: 'The Polytechnic Ibadan', shortName: 'POLY-IBADAN', slug: 'poly-ibadan', city: 'Ibadan', state: 'Oyo', category: 'polytechnic', isActive: true },

  // ==================== PLATEAU STATE ====================
  { name: 'University of Jos', shortName: 'UNIJOS', slug: 'unijos', city: 'Jos', state: 'Plateau', category: 'university', isActive: true },
  { name: 'University of Jos College of Health Sciences (JUTH)', shortName: 'UNIJOS-MED', slug: 'unijos-med', city: 'Jos', state: 'Plateau', category: 'health_sciences', isActive: true },
  { name: 'Plateau State Polytechnic', shortName: 'PLAPOLY', slug: 'plapoly', city: 'Barkin Ladi', state: 'Plateau', category: 'polytechnic', isActive: true },

  // ==================== RIVERS STATE ====================
  { name: 'University of Port Harcourt', shortName: 'UNIPORT', slug: 'uniport', city: 'Port Harcourt', state: 'Rivers', category: 'university', isActive: true },
  { name: 'University of Port Harcourt College of Health Sciences (UPTH)', shortName: 'UNIPORT-MED', slug: 'uniport-med', city: 'Port Harcourt', state: 'Rivers', category: 'health_sciences', isActive: true },
  { name: 'Rivers State University', shortName: 'RSU', slug: 'rsu', city: 'Port Harcourt', state: 'Rivers', category: 'university', isActive: true },
  { name: 'Pamo University of Medical Sciences', shortName: 'PAMO', slug: 'pamo', city: 'Port Harcourt', state: 'Rivers', category: 'health_sciences', isActive: true },
  { name: 'Port Harcourt Polytechnic', shortName: 'PORTHARCOURTPOLY', slug: 'portharcourtpoly', city: 'Port Harcourt', state: 'Rivers', category: 'polytechnic', isActive: true },

  // ==================== SOKOTO STATE ====================
  { name: 'Usmanu Danfodiyo University', shortName: 'UDUSOK', slug: 'udusok', city: 'Sokoto', state: 'Sokoto', category: 'university', isActive: true },
  { name: 'Usmanu Danfodiyo University College of Health Sciences (UDUTH)', shortName: 'UDUSOK-MED', slug: 'udusok-med', city: 'Sokoto', state: 'Sokoto', category: 'health_sciences', isActive: true },
  { name: 'Sokoto State University', shortName: 'SSU', slug: 'ssu', city: 'Sokoto', state: 'Sokoto', category: 'university', isActive: true },

  // ==================== TARABA, YOBE, ZAMFARA, GOMBE, JIGAWA, KATSINA, KEBBI, KOGI, NASARAWA, NIGER ====================
  { name: 'Federal University Wukari', shortName: 'FUWUKARI', slug: 'fuwukari', city: 'Wukari', state: 'Taraba', category: 'university', isActive: true },
  { name: 'Federal University Gashua', shortName: 'FU-GASHUA', slug: 'fugashua', city: 'Gashua', state: 'Yobe', category: 'university', isActive: true },
  { name: 'Yobe State University', shortName: 'YSU', slug: 'ysu', city: 'Damaturu', state: 'Yobe', category: 'university', isActive: true },
  { name: 'Federal University Gusau', shortName: 'FUGUS', slug: 'fugus', city: 'Gusau', state: 'Zamfara', category: 'university', isActive: true },
  { name: 'Federal University Kashere', shortName: 'FUKASHERE', slug: 'fukashere', city: 'Kashere', state: 'Gombe', category: 'university', isActive: true },
  { name: 'Federal University Dutse', shortName: 'FUD', slug: 'fud', city: 'Dutse', state: 'Jigawa', category: 'university', isActive: true },
  { name: 'Federal University Dutsin-Ma', shortName: 'FUDMA', slug: 'fudma', city: 'Dutsin-Ma', state: 'Katsina', category: 'university', isActive: true },
  { name: 'Umaru Musa Yar’adua University', shortName: 'UMYU', slug: 'umyu', city: 'Katsina', state: 'Katsina', category: 'university', isActive: true },
  { name: 'Federal University Birnin Kebbi', shortName: 'FUBK', slug: 'fubk', city: 'Birnin Kebbi', state: 'Kebbi', category: 'university', isActive: true },
  { name: 'Federal University Lokoja', shortName: 'FULOKOJA', slug: 'fulokoja', city: 'Lokoja', state: 'Kogi', category: 'university', isActive: true },
  { name: 'Prince Abubakar Audu University', shortName: 'PAAU', slug: 'paau', city: 'Anyigba', state: 'Kogi', category: 'university', isActive: true },
  { name: 'Federal University Lafia', shortName: 'FULAFIA', slug: 'fulafia', city: 'Lafia', state: 'Nasarawa', category: 'university', isActive: true },
  { name: 'Nasarawa State University (Keffi)', shortName: 'NSUK', slug: 'nsuk', city: 'Keffi', state: 'Nasarawa', category: 'university', isActive: true },
  { name: 'Federal University of Technology Minna', shortName: 'FUTMINNA', slug: 'futminna', city: 'Minna', state: 'Niger', category: 'university', isActive: true },
  { name: 'Federal Polytechnic Bida', shortName: 'FEDPOLY-BIDA', slug: 'fedpoly-bida', city: 'Bida', state: 'Niger', category: 'polytechnic', isActive: true }
];

async function seed() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');
  console.log('Connected to MongoDB Atlas.');

  let inserted = 0;
  let updated = 0;

  for (const item of INSTITUTIONS_DATA) {
    const doc = {
      name: item.name,
      shortName: item.shortName,
      slug: item.slug,
      city: item.city,
      state: item.state,
      country: 'Nigeria',
      category: item.category,
      isActive: item.isActive !== false,
      deliveryRadiusKm: 8,
      center: { type: 'Point', coordinates: [3.3469, 6.5147] },
      branding: {
        primaryColor: '#FF5C1A',
        tagline: item.tagline || `${item.shortName} • Campus life, elevated.`
      },
      supportedAppTypes: ['student', 'vendor', 'dispatch']
    };

    const res = await db.collection('institutions').updateOne(
      { slug: item.slug },
      { $set: doc },
      { upsert: true }
    );

    if (res.upsertedCount > 0) inserted++;
    else if (res.modifiedCount > 0) updated++;
  }

  const total = await db.collection('institutions').countDocuments();
  console.log(`Seeding complete: ${inserted} inserted, ${updated} updated. Total institutions in DB: ${total}`);

  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
