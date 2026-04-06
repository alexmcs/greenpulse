import { create } from 'zustand';

interface GPSCoords {
  lat: number;
  lng: number;
  accuracy: number;
}

interface SpeciesCandidate {
  species_id: number;
  name_latin: string;
  name_common_ru: string;
  confidence: number;
}

interface VerificationResult {
  certificate_id?: string;
  species: string;
  co2_kg_year: number;
  qr_url?: string;
  confidence: number;
  antifrod_flags: string[];
  species_candidates?: SpeciesCandidate[];
}

interface VerificationState {
  currentPhoto: string | null;
  gpsCoords: GPSCoords | null;
  verificationResult: VerificationResult | null;
  paymentStatus: 'idle' | 'pending' | 'success' | 'failed';

  setCurrentPhoto: (uri: string | null) => void;
  setGpsCoords: (coords: GPSCoords | null) => void;
  setVerificationResult: (result: VerificationResult | null) => void;
  setPaymentStatus: (status: VerificationState['paymentStatus']) => void;
  reset: () => void;
}

export const useVerificationStore = create<VerificationState>(set => ({
  currentPhoto: null,
  gpsCoords: null,
  verificationResult: null,
  paymentStatus: 'idle',

  setCurrentPhoto: uri => set({ currentPhoto: uri }),
  setGpsCoords: coords => set({ gpsCoords: coords }),
  setVerificationResult: result => set({ verificationResult: result }),
  setPaymentStatus: status => set({ paymentStatus: status }),
  reset: () => set({ currentPhoto: null, gpsCoords: null, verificationResult: null, paymentStatus: 'idle' }),
}));
