import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  limit, 
  serverTimestamp, 
  onSnapshot,
  Timestamp,
  getDocFromServer,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../firebase';
import { Registration, VaccineData } from '../types';

const COLLECTION_NAME = 'registrations';

export const firebaseService = {
  // Test connection
  async testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration.");
      }
    }
  },

  // Check if citizen ID exists
  async checkCitizenId(citizenId: string): Promise<Registration | null> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME), 
        where('citizenId', '==', citizenId),
        where('status', '==', 'active'),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        return { ...docData, id: querySnapshot.docs[0].id } as Registration;
      }
      return null;
    } catch (error) {
      console.error("Error checking citizen ID:", error);
      throw error;
    }
  },

  // Generate new QSMI-XXXXX ID
  async generateNewId(): Promise<string> {
    try {
      const q = query(collection(db, COLLECTION_NAME), orderBy('id', 'desc'), limit(1));
      const querySnapshot = await getDocs(q);
      let maxId = 0;
      if (!querySnapshot.empty) {
        const lastId = querySnapshot.docs[0].id;
        const parts = lastId.split('-');
        if (parts.length === 2 && parts[0] === 'QSMI') {
          maxId = parseInt(parts[1], 10);
        }
      }
      return `QSMI-${String(maxId + 1).padStart(5, '0')}`;
    } catch (error) {
      console.error("Error generating new ID:", error);
      // Fallback to timestamp-based ID if query fails (e.g. due to missing index)
      return `QSMI-${Date.now().toString().slice(-5)}`;
    }
  },

  // Create new registration
  async createRegistration(formData: Omit<Registration, 'id' | 'createdAt' | 'status'>): Promise<Registration> {
    const newId = await this.generateNewId();
    const registration: Registration = {
      ...formData,
      id: newId,
      createdAt: Timestamp.now(),
      status: 'active'
    };
    await setDoc(doc(db, COLLECTION_NAME, newId), registration);
    return registration;
  },

  // Update registration
  async updateRegistration(id: string, data: Partial<Registration>): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
  },

  // Delete registration
  async deleteRegistration(id: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  },

  // Get all registrations by date range for CSV export
  async getRegistrationsByDateRange(startDate: Date, endDate: Date): Promise<Registration[]> {
    try {
      // Set end date to end of day
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      const q = query(
        collection(db, COLLECTION_NAME),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        where('createdAt', '<=', Timestamp.fromDate(endOfDay)),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt
        } as Registration;
      });
    } catch (error) {
      console.error("Error fetching registrations by date range:", error);
      throw error;
    }
  },

  // Get paginated registrations (for admin)
  async getRegistrationsPage(pageSize: number, lastDoc?: QueryDocumentSnapshot<DocumentData> | null, searchQuery?: string): Promise<{ data: Registration[], lastDoc: QueryDocumentSnapshot<DocumentData> | null, hasMore: boolean }> {
    try {
      let q;
      
      // If there's a search query, we might need to fetch more or use a different approach
      // For simplicity in Firestore without Algolia, we'll do a basic prefix search on citizenId if it looks like numbers
      // Otherwise, we'll just fetch by ID desc. True full-text search requires external services.
      if (searchQuery && /^\d+$/.test(searchQuery)) {
        q = query(
          collection(db, COLLECTION_NAME), 
          where('citizenId', '>=', searchQuery),
          where('citizenId', '<=', searchQuery + '\uf8ff'),
          orderBy('citizenId'),
          limit(pageSize)
        );
        if (lastDoc) {
          q = query(
            collection(db, COLLECTION_NAME), 
            where('citizenId', '>=', searchQuery),
            where('citizenId', '<=', searchQuery + '\uf8ff'),
            orderBy('citizenId'),
            startAfter(lastDoc),
            limit(pageSize)
          );
        }
      } else {
        q = query(collection(db, COLLECTION_NAME), orderBy('id', 'desc'), limit(pageSize));
        if (lastDoc) {
          q = query(collection(db, COLLECTION_NAME), orderBy('id', 'desc'), startAfter(lastDoc), limit(pageSize));
        }
      }

      const querySnapshot = await getDocs(q);
      const registrations = querySnapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt
        } as Registration;
      });
      
      return {
        data: registrations,
        lastDoc: querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null,
        hasMore: querySnapshot.docs.length === pageSize
      };
    } catch (error) {
      console.error("Error fetching registrations page:", error);
      throw error;
    }
  }
};
