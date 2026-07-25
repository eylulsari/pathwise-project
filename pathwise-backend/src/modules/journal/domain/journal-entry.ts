/** A Trip Journal entry for a visited place: photo, note, 1–5 rating. */
export interface JournalEntryProps {
  id: string;
  userId: string;
  placeId: string;
  photoUrl?: string | null;
  note?: string | null;
  rating: number; // 1–5
  createdAt: Date;
}

export class JournalEntry {
  readonly id: string;
  readonly userId: string;
  readonly placeId: string;
  photoUrl: string | null;
  note: string | null;
  rating: number;
  readonly createdAt: Date;

  constructor(p: JournalEntryProps) {
    this.id = p.id;
    this.userId = p.userId;
    this.placeId = p.placeId;
    this.photoUrl = p.photoUrl ?? null;
    this.note = p.note ?? null;
    this.rating = p.rating;
    this.createdAt = p.createdAt;
  }

  toJSON() {
    return {
      id: this.id,
      placeId: this.placeId,
      photoUrl: this.photoUrl,
      note: this.note,
      rating: this.rating,
      createdAt: this.createdAt,
    };
  }
}
