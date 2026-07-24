export interface VanillaKeys {
  army: string[];
  shipSize: string[];
  planetClass: string[];
}

export interface SpeciesNameEntry {
  key: string;
  name: string;
  plural: string;
  home_planet?: string;
  home_system?: string;
  portrait: string;
  species_class?: string;
}
