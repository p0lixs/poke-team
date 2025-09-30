import { Injectable } from '@angular/core';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../../shared/firebase/firebase.config';
import { PokemonVM } from '../models/view.model';

interface TeamDocument {
  members?: PokemonVM[];
}

const TEAM_COLLECTION = 'teams';
const TEAM_DOCUMENT_ID = 'default';

@Injectable({ providedIn: 'root' })
export class TeamRepository {
  private readonly docRef = doc(firestore, TEAM_COLLECTION, TEAM_DOCUMENT_ID);

  async loadTeam(): Promise<PokemonVM[]> {
    try {
      const snapshot = await getDoc(this.docRef);
      if (!snapshot.exists()) {
        return [];
      }
      const data = snapshot.data() as TeamDocument | undefined;
      return Array.isArray(data?.members) ? data!.members : [];
    } catch (error) {
      console.error('Error loading team from Firebase', error);
      throw error;
    }
  }

  async saveTeam(team: PokemonVM[]): Promise<void> {
    try {
      await setDoc(this.docRef, { members: team });
    } catch (error) {
      console.error('Error saving team to Firebase', error);
      throw error;
    }
  }
}
