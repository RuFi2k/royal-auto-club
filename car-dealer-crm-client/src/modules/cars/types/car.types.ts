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
  cabinType: string;
  customsStatus: string;
  carOrigin: string;
  carLocation: string;
  location: string;
  sellType: string;
  isCryptoAvailable: boolean;
  ownerPrice: number;
  websitePrice: number;
  dealerPrice: number;
  generalPrice: number;
  isAvailable: boolean;
  responsiblePerson: string;
  photoUrl: string | null;
  techPassportUrl: string | null;
  defectsCheckUrl: string | null;
  priceChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
}

export interface CarPhotoArchive {
  id: number;
  carId: number;
  url: string;
  filename: string;
  createdAt: string;
}

export interface CarsPage {
  data: Car[];
  total: number;
  page: number;
  pageSize: number;
}
