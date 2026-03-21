export interface VaccineData {
  serviceDate: string;
  hn: string;
  treatmentType: string;
  injectionMethod: string;
  vaccineName: string;
  note: string;
}

export interface Registration {
  id: string;
  createdAt: any; // Firestore Timestamp
  prefix: string;
  otherPrefix?: string;
  firstName: string;
  lastName: string;
  gender: string;
  citizenId: string;
  phone: string;
  dobDay: string;
  dobMonth: string;
  dobYearBE: string;
  age: number;
  university: string;
  yearLevel: string;
  studentId?: string;
  status: 'active' | 'deleted';
  vaccineData?: VaccineData;
}
