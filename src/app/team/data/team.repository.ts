import { Injectable } from '@angular/core';
import { addDoc, collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { firestore } from '../../shared/firebase/firebase.config';
import { PokemonVM } from '../models/view.model';
import { SavedTeam } from '../models/team.model';

interface TeamDocument {
  name?: string;
  members?: PokemonVM[];
}

const TEAM_COLLECTION = 'teams';

@Injectable({ providedIn: 'root' })
export class TeamRepository {
  private readonly collectionRef = collection(firestore, TEAM_COLLECTION);

  async loadTeams(): Promise<SavedTeam[]> {
    try {
      const snapshot = await getDocs(this.collectionRef);
      return snapshot.docs.map((docSnapshot: QueryDocumentSnapshot<DocumentData>) => {
        const data = (docSnapshot.data() as TeamDocument | undefined) ?? {};
        return {
          id: docSnapshot.id,
          name: (data.name ?? '').trim() || 'Unnamed team',
          members: Array.isArray(data.members) ? data.members : [],
        } satisfies SavedTeam;
      });
    } catch (error) {
      console.error('Error loading teams from Firebase', error);
      throw error;
    }
  }

  async createTeam(name: string, members: PokemonVM[]): Promise<string> {
    try {
      const docRef = await addDoc(this.collectionRef, {
        name,
        members,
        updatedAt: Date.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating team in Firebase', error);
      throw error;
    }
  }

  async updateTeam(id: string, payload: { name: string; members: PokemonVM[] }): Promise<void> {
    try {
      const ref = doc(this.collectionRef, id);
      await updateDoc(ref, {
        ...payload,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Error updating team in Firebase', error);
      throw error;
    }
  }
}
