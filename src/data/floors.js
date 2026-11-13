export const FLOOR_DEFINITIONS = {
  hospital: {
    ground: { id: "ground", index: 0, name: "Первый этаж" },
    upper: { id: "upper", index: 1, name: "Второй этаж" },
    basement: { id: "basement", index: -1, name: "Подвал" },
  },
  gunstore: {
    ground: { id: "ground", index: 0, name: "Первый этаж" },
    basement: { id: "basement", index: -1, name: "Оружейный подвал" },
  },
  apartments: {
    ground: { id: "ground", index: 0, name: "Первый этаж" },
    upper: { id: "upper", index: 1, name: "Второй этаж" },
    basement: { id: "basement", index: -1, name: "Подвал" },
  },
};

export const FLOOR_LINKS = [
  { buildingId: "hospital", from: "ground", to: "upper", type: "stairs" },
  { buildingId: "hospital", from: "upper", to: "ground", type: "stairs" },
  { buildingId: "hospital", from: "ground", to: "basement", type: "stairs" },
  { buildingId: "hospital", from: "basement", to: "ground", type: "stairs" },
  { buildingId: "gunstore", from: "ground", to: "basement", type: "stairs" },
  { buildingId: "gunstore", from: "basement", to: "ground", type: "stairs" },
  { buildingId: "apartments", from: "ground", to: "upper", type: "stairs" },
  { buildingId: "apartments", from: "upper", to: "ground", type: "stairs" },
  { buildingId: "apartments", from: "ground", to: "basement", type: "stairs" },
  { buildingId: "apartments", from: "basement", to: "ground", type: "stairs" },
];
