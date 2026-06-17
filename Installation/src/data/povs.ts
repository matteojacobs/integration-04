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
      { id: "bg1", label: "bg1 name" },
      { id: "bg2", label: "bg2 name" },
      { id: "bg3", label: "bg3 name" },
    ],
    routeLabel: "Main-character",
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
      { id: "bg1", label: "bg1 name" },
      { id: "bg2", label: "bg2 name" },
      { id: "bg3", label: "bg3 name" },
    ],
    routeLabel: "Nightlife",
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
      { id: "bg1", label: "bg1 name" },
      { id: "bg2", label: "bg2 name" },
      { id: "bg3", label: "bg3 name" },
    ],
    routeLabel: "Fashion",
  },
];