export type ExtraAccessory = {
  id: string;
  label: string;
};

export type BackgroundOption = {
  id: string;
  label: string;
  preview?: string;
};

export type PovText = {
  before: string;
  green: string;
  after?: string;
};

export type Pov = {
  id: string;
  name: string;
  lensId: string;
  povText: PovText;
  extraAccessories: ExtraAccessory[];
  backgrounds: BackgroundOption[];
  routeLabel: string;
};


export const POVS: Pov[] = [
  {
    id: "main-character",
    name: "Main character",
    lensId: import.meta.env.VITE_LENS_ID_1,
    povText: {
      before: "You are the ",
      green: "main character",
    },
    extraAccessories: [
      { id: "spotlight", label: "Medaillon" },
      { id: "sjerp", label: "Confidence meter" },
    ],
    backgrounds: [
      { id: "bg1", label: "Zurenborg", preview:"main-character-zurenborg" },
      { id: "bg2", label: "View on MAS", preview:"main-character-mas" },
      { id: "bg3", label: "Cozy street", preview: "main-character-cozystreet" },
    ],
    routeLabel: "mc",
  },
  {
    id: "raver",
    name: "Raver",
    lensId: import.meta.env.VITE_LENS_ID_2,
    povText: {
      before: "You like Antwerp ",
      green: "raves",
    },
    extraAccessories: [
      { id: "bracelets", label: "Bracelets" },
      { id: "energy", label: "Energy drink" },
    ],
    backgrounds: [
      { id: "bg1", label: "Rave", preview: "raver-rave" },
      { id: "bg2", label: "Cafe", preview: "raver-cafe" },
      { id: "bg3", label: "Festival", preview: "raver-festival" },
    ],
    routeLabel: "raver",
  },
  {
    id: "fashionista",
    name: "Fashionista",
    lensId: import.meta.env.VITE_LENS_ID_3,
    povText: {
      before: "You are an Antwerp ",
      green: "fashionista",
    },
    extraAccessories: [
      { id: "earrings", label: "Earrings" },
      { id: "bracelet", label: "Bracelet" },
    ],
    backgrounds: [
      { id: "bg1", label: "Catwalk", preview: "fashionista-catwalk" },
      { id: "bg2", label: "Meir", preview: "fashionista-meir" },
      { id: "bg3", label: "Fitting room", preview: "fashionista-fittingroom" },
    ],
    routeLabel: "fashionista",
  },
];