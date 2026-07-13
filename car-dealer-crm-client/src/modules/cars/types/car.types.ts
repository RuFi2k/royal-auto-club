export interface Car {
  id: number;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  color: string;
  vinNumber: string;
  registrationNumber: string;
  countryOfRegistration: string;
  engineType: string;
  engineVolume: number;
  enginePower: number;
  gearboxType: string;
  drivetrain: string;
  bodyType: string;
  doorsCount: number;
  seatsCount: number;
  carOrigin: string;
  carLocation: string;
  location: string;
  sellType: string;
  isCryptoAvailable: boolean;
  ownerPrice: number;
  dealerPrice: number;
  isAvailable: boolean;
  responsiblePerson: string;
  shortDescription: string | null;
  description: string | null;
  // Lifecycle / upcoming
  listingStatus: "upcoming" | "available" | "sold" | "archived";
  eta: string | null;
  transitStage: "ordered" | "in_transit" | "at_port" | "customs" | "ready" | null;
  estimatedPrice: number | null;
  accidentFree: boolean;
  crashed: boolean;
  airbagReplaced: boolean;
  crashDetails: string | null;
  crashBodyParts: string[];
  photoUrl: string | null;
  techPassportUrl: string | null;
  defectsCheckUrl: string | null;
  priceChangedAt: string | null;
  telegramMessageId?: number | null;
  autoriaAdId?: string | null;
  options?: SelectedOption[];
  createdAt: string;
  updatedAt: string;
}

export interface SelectableValue {
  id: number;
  label: string;
}

export interface BinaryOption {
  id: number;
  label: string;
  group: string;
}

export interface SelectableOption {
  id: number;
  field: string;
  label: string;
  group: string;
  values: SelectableValue[];
}

export interface AutoRiaOptionsCatalog {
  groups: string[];
  binary: BinaryOption[];
  selectable: SelectableOption[];
}

export interface SelectedOption {
  optionId: number;
  valueId: number | null;
}

export interface CarFilters {
  id?: string;
  brand?: string;
  model?: string;
  mileageMin?: string;
  mileageMax?: string;
  priceMin?: string;
  priceMax?: string;
  carOrigin?: string;
  carLocation?: string;
  isAvailable?: string; // "true" | "false" | "" (all)
  // Extended filters
  bodyType?: string;
  engineType?: string;
  gearboxType?: string;
  drivetrain?: string;
  sellType?: string;
  yearMin?: string;
  yearMax?: string;
  enginePowerMin?: string;
  enginePowerMax?: string;
  engineVolumeMin?: string;
  engineVolumeMax?: string;
  isCryptoAvailable?: string; // "true" | "false" | ""
  q?: string;
}

export interface CarPhotoArchive {
  id: number;
  carId: number;
  url: string;
  filename: string;
  createdAt: string;
}

export interface CarPhoto {
  id: number;
  carId: number;
  url: string;
  alt: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface CarsPage {
  data: Car[];
  total: number;
  page: number;
  pageSize: number;
}
