const APARTMENT_WALLS = [
  ...[0.42, 0.58].flatMap((v, side) =>
    [
      [0.05, 0.25],
      [0.25, 0.5],
      [0.5, 0.75],
      [0.75, 0.95],
    ].map(([from, to], room) => ({
      id: `corridor-${side}-${room}`,
      a: [from, v],
      b: [to, v],
      gaps: [{ from: 0.35, to: 0.5 }],
    })),
  ),
  ...[0.25, 0.5, 0.75].flatMap((u, index) => [
    {
      id: `partition-north-${index}`,
      a: [u, 0.07],
      b: [u, 0.42],
      gaps: [],
    },
    {
      id: `partition-south-${index}`,
      a: [u, 0.58],
      b: [u, 0.93],
      gaps: [],
    },
  ]),
];

const APARTMENT_FURNITURE = [0.125, 0.375, 0.625, 0.875].flatMap((u, room) => [
  {
    id: `bed-${room}`,
    type: "bed",
    at: [u - 0.035, 0.2],
    w: 48,
    h: 24,
    rotation: room % 2 ? 90 : 0,
  },
  {
    id: `table-${room}`,
    type: "table",
    at: [u + 0.05, 0.3],
    w: 24,
    h: 24,
    rotation: 0,
  },
  {
    id: `sofa-${room}`,
    type: "sofa",
    at: [u - 0.035, 0.8],
    w: 40,
    h: 20,
    rotation: room % 2 ? 90 : 0,
  },
  {
    id: `kitchen-${room}`,
    type: "kitchen",
    at: [u + 0.05, 0.7],
    w: 32,
    h: 20,
    rotation: 0,
  },
]);

const APARTMENT_CONTAINERS = [
  { id: "fridge-0", type: "fridge", at: [0.19, 0.12] },
  { id: "cabinet-1", type: "cabinet", at: [0.31, 0.88] },
  { id: "desk-2", type: "desk", at: [0.69, 0.12] },
  { id: "shelf-3", type: "shelf", at: [0.81, 0.88] },
];

export const BUILDING_LAYOUTS = {
  112436182: {
    id: "pilot-apartment",
    sourceWayId: 112436182,
    minLevels: 2,
    footprint: {
      pixelsPerMeter: 1,
      points: [
        [0, 0],
        [0.800360695, 7.881456],
        [1.453866216, 14.349148],
        [67.663521111, 6.912972],
        [67.076099418, 0.534336],
        [72.208688725, -2.426776],
        [77.862612898, -6.022412],
        [71.657981825, -9.673708],
        [68.757592152, -8.01504],
        [66.569450072, -6.890708],
      ],
    },
    floors: {
      ground: {
        walls: APARTMENT_WALLS,
        furniture: APARTMENT_FURNITURE,
        containers: APARTMENT_CONTAINERS,
      },
      upper: {
        walls: APARTMENT_WALLS,
        furniture: APARTMENT_FURNITURE,
        containers: APARTMENT_CONTAINERS.map((container) => ({
          ...container,
          id: `upper-${container.id}`,
        })),
      },
    },
  },
};
