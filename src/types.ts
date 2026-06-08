export interface StudentRecord {
  scores: number[];      // index is student number - 1
  opinions: string[];    // index is student number - 1
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  pillar?: string; // Optional pillar classification
}
